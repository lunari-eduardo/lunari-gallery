
# Correção Robusta: Recebimento Manual + Pagamento Online sem inconsistências

## Diagnóstico confirmado

O erro atual não é um único bug; são várias fragilidades juntas:

1. **401 acontece antes da function rodar**
   - `confirm-payment-manual` está com `verify_jwt = true` no `supabase/config.toml`
   - O erro do screenshot é do gateway do Supabase, por isso quase não há logs da function
   - Hoje o frontend usa `getSession()`, que pode devolver token velho; não garante renovação

2. **O fluxo manual não está integrado ao restante do sistema**
   - `pago_manual` foi adicionado no card e na nova migration, mas o restante do backend ainda trata só `pago`
   - `ensure_transaction_on_cobranca_paid()` só cria financeiro quando `NEW.status = 'pago'`
   - `gallery-access` só faz auto-heal quando encontra cobrança `status = 'pago'`
   - várias sincronizações antigas ainda comparam `!= 'pago'`

3. **Há risco de comportamento divergente no banco**
   - existem **duas assinaturas** de `finalize_gallery_payment` no banco:
     - antiga: `(uuid, text, timestamptz)`
     - nova: `(uuid, text, timestamptz, text, text)`
   - isso funciona, mas aumenta ambiguidade e risco de chamadas diferentes seguirem caminhos diferentes

4. **Ainda existe lógica paralela fora da RPC central**
   - `GalleryDetail.tsx` faz update direto em `galerias` e `clientes_sessoes`
   - isso enfraquece a arquitetura e pode gerar divergência entre manual, PIX manual, webhook e polling

## Objetivo da correção

Criar um fluxo único e resiliente onde:

- **pagamento online** continua vindo por webhook/polling
- **recebimento manual** não depende de gateway
- ambos convergem para a mesma finalização
- o status final aceito pelo sistema é **quitado**, vindo de:
  - `pago`
  - `pago_manual`

## Plano de implementação

### 1. Corrigir a autenticação da Edge Function manual
**Arquivos:**
- `supabase/config.toml`
- `supabase/functions/confirm-payment-manual/index.ts`

**Mudanças:**
- remover a dependência do gateway com `verify_jwt = true`
- deixar `verify_jwt = false`
- validar JWT **dentro da própria function** via `Authorization` + `getClaims()`
- manter checagem de ownership da cobrança/galeria pelo `user_id`

**Resultado:**
- elimina o 401 opaco do gateway
- mantém segurança
- permite mensagens de erro claras e logs úteis

---

### 2. Fortalecer o frontend para sessão expirada
**Arquivo:**
- `src/components/PaymentStatusCard.tsx`

**Mudanças:**
- trocar `getSession()` por `refreshSession()` antes do invoke
- se não houver sessão renovada, mostrar erro explícito
- propagar a mensagem real retornada pela function

**Resultado:**
- reduz falhas por token expirado
- melhora diagnóstico do usuário

---

### 3. Unificar o conceito de “pagamento quitado”
**Arquivos:**
- nova migration SQL
- `supabase/functions/gallery-access/index.ts`
- eventuais functions de polling/check

**Mudanças:**
- tratar `pago` e `pago_manual` como estados finais equivalentes para acesso/liberação
- `gallery-access` deve procurar cobrança quitada com:
  - `status IN ('pago', 'pago_manual')`
- auto-heal deve sincronizar a galeria quando houver qualquer um desses status
- sessão do cliente não pode continuar em “aguardando pagamento” se já houver quitação manual

**Resultado:**
- o cliente não fica vendo pendência após recebimento manual
- o painel do fotógrafo reflete o estado real

---

### 4. Ajustar a RPC central para ser a única fonte de verdade
**Arquivo:**
- nova migration SQL para `finalize_gallery_payment`

**Mudanças:**
- consolidar a RPC para aceitar manual e online de forma oficial
- manter lock/advisory lock
- considerar `pago_manual` como terminal e idempotente
- no ramo “already paid”, sincronizar galeria/sessão mesmo se o status já for `pago_manual`
- garantir persistência de:
  - `metodo_manual`
  - `obs_manual`
  - `data_pagamento`
- revisar incrementos para não duplicar contadores em reprocessamentos

**Resultado:**
- mesma regra para webhook, polling e recebimento manual
- menos chance de divergência

---

### 5. Corrigir o financeiro para aceitar recebimento manual
**Arquivo:**
- nova migration SQL para `ensure_transaction_on_cobranca_paid()`

**Mudanças:**
- o trigger deve reagir quando status mudar para:
  - `pago`
  - `pago_manual`
- criar `clientes_transacoes` com descrição coerente para manual
- manter idempotência para não duplicar lançamento

**Resultado:**
- o recebimento manual entra no financeiro real
- `valor_pago` da sessão continua consistente

---

### 6. Remover atualizações paralelas fora da RPC central
**Arquivo:**
- `src/pages/GalleryDetail.tsx`

**Mudanças:**
- substituir o update direto em `galerias` / `clientes_sessoes` por chamada ao mesmo fluxo central
- qualquer “Confirmar recebimento” de PIX manual também deve usar a mesma finalização centralizada

**Resultado:**
- todos os caminhos usam a mesma regra
- reduz regressões futuras

---

### 7. Fazer limpeza estrutural para evitar regressões
**Arquivo:**
- nova migration SQL

**Mudanças:**
- revisar e padronizar consultas e sincronizações antigas que ainda usam apenas `pago`
- manter uma única implementação oficial da lógica de quitação
- documentar no topo das functions e da RPC:
  - online e manual são caminhos distintos
  - ambos finalizam via RPC central
  - `pago_manual` prevalece como quitado independentemente do gateway

**Resultado:**
- menos drift entre Gallery e Gestão
- menor risco de quebrar o fluxo ao mexer em webhooks/functions

## Arquivos impactados

- `supabase/config.toml`
- `supabase/functions/confirm-payment-manual/index.ts`
- `supabase/functions/gallery-access/index.ts`
- `src/components/PaymentStatusCard.tsx`
- `src/pages/GalleryDetail.tsx`
- nova migration para:
  - ajustar `finalize_gallery_payment`
  - ajustar `ensure_transaction_on_cobranca_paid`
  - padronizar `pago_manual` como quitado

## Regras finais que o sistema deve obedecer

```text
Pagamento online:
gateway/webhook/polling -> finalize_gallery_payment -> galeria quitada

Recebimento manual:
fotógrafo registra -> confirm-payment-manual -> finalize_gallery_payment -> galeria quitada
```

```text
Estados quitados aceitos pelo sistema:
- pago
- pago_manual
```

## Critérios de aceite

1. Registrar recebimento manual não retorna 401
2. Ao registrar manualmente:
   - cobrança fica quitada
   - galeria muda para quitada
   - sessão sai de aguardando pagamento
   - financeiro recebe a entrada
3. Pagamento online continua funcionando sem depender do fluxo manual
4. Cliente nunca vê tela pendente se já existir cobrança `pago` ou `pago_manual`
5. Reprocessar webhook/polling/manual não duplica venda nem transação
