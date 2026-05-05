# Plano: Corrigir Registro de Recebimento Manual em Galerias Reativadas

## Diagnóstico do Bug

Na galeria da Gisele (reativada), o cliente já havia pago R$50 (2 extras) na rodada anterior. Após reativação, selecionou +4 extras (R$100) e pagou externamente. Ao clicar **"Registrar recebimento"**, o modal mostrou R$50 e estava prestes a marcar a **cobrança antiga já paga** como "paga manualmente" novamente.

### Causa raiz (3 falhas combinadas)

1. **`GalleryDetail.tsx` — query `galeria-cobranca-pendente`** (linha 244–276) busca a *última* cobrança da galeria/sessão **sem filtrar status**. Em galerias reativadas, retorna a cobrança `pago_manual` antiga (R$50), não a pendente atual.

2. **`PaymentStatusCard`** recebe esse `cobrancaId` antigo + um `valor` confuso (mistura de `valorTotalVendido`, `valorExtras`, `calculatedExtraTotal`) e pré-preenche o campo com `valor.toFixed(2)`.

3. **`confirm-payment-manual`** recebe `cobrancaId` de cobrança já paga → o RPC `finalize_gallery_payment` retorna `already_paid: true` (idempotente), mas no caminho de `valorManual !== cobranca.valor` ele **sobrescreve `cobrancas.valor`** ANTES da checagem de idempotência (linhas 175–181), corrompendo o histórico.

### Cenário do usuário (não registrou) — o que teria acontecido se confirmasse R$100
- Cobrança antiga (R$50, qtd_fotos=2) seria sobrescrita para R$100 → trigger `cobranca_infer_qtd_fotos` poderia recalcular qtd_fotos para 4 → contadores agregados duplicariam fotos vendidas.
- Saldo de R$100 da nova rodada continuaria contando como pendente → cliente apareceria devendo R$100 mesmo após pago.

---

## Solução

Princípio: **toda rodada de extras pendente vive em sua própria cobrança**. O modal sempre opera sobre o saldo da rodada atual, nunca sobre cobranças finalizadas.

### 1. Frontend — `GalleryDetail.tsx`

**Separar a query em três conceitos distintos:**

```text
cobrancasPagas         → histórico (já existe, ok)
cobrancaPendenteAtiva  → status IN ('pendente','aguardando_confirmacao') APENAS
                         da rodada atual (created_at > último pagamento OU
                         valor === extrasACobrar × valor_foto_extra)
saldoPendente          → extrasACobrar × valor_foto_extra (sempre derivado)
```

A query `galeria-cobranca-pendente` passa a filtrar `.in('status', ['pendente','aguardando_confirmacao'])`. Se nada retornar e `extrasACobrar > 0`, `cobrancaPendenteAtiva = null` (será criada nova manual ao confirmar).

**No `PaymentStatusCard` props:**
- `valor` = `saldoPendente` (não mais `valorTotalVendido`).
- `cobrancaId` = `cobrancaPendenteAtiva?.id` (pode ser `null` → função cria nova).
- `extraCount` = `extrasACobrar`.

### 2. Frontend — `PaymentStatusCard.tsx`

- `openReceiptModal()` pré-preenche com `valor` (já será o saldo pendente, R$100 no caso).
- Adicionar **dica visual** abaixo do input: *"Saldo pendente: R$ 100,00. Você pode registrar valores parciais."*
- Remover assunção de que `cobrancaId` sempre existe — passar `null` é válido (back cria cobrança manual nova).
- Após sucesso: `toast.success('Recebimento de R$ X registrado')` + invalidar queries.

### 3. Backend — `confirm-payment-manual/index.ts`

**Bloco crítico a reescrever:**

a) **Validação de cobrança alvo:** se `cobrancaId` fornecido aponta para cobrança com status `pago` ou `pago_manual`, **rejeitar** (HTTP 409 `COBRANCA_JA_QUITADA`) e instruir frontend a criar nova. Evita a sobrescrita acidental.

b) **Cancelar cobrança digital pendente** quando criar manual nova: se existir `cobrancas` com `status='pendente'` e `provedor IN ('infinitepay','mercadopago','asaas','pix_manual')` para a mesma galeria, marcar como `cancelada` com `obs_cancelamento='Substituída por recebimento manual #<novo_id>'`. Conforme escolha do usuário (opção 2 da pergunta 3).

c) **Suportar pagamentos parciais:** ao criar cobrança manual, usar exatamente `valorManual` (não o saldo total). O RPC `finalize_gallery_payment` já recalcula `valor_extras_pago` somando todas as cobranças `pago/pago_manual` da galeria — portanto múltiplos recebimentos parciais somam corretamente até atingir o total e mudar status para `pago_manual`.

d) **Inferência de `qtd_fotos`:** ao criar manual parcial, calcular `qtd_fotos = ROUND(valorManual / valor_foto_extra)` para alimentar o trigger e contadores corretamente.

e) **Remover sobrescrita de valor** (linhas 175–181 atuais) — nunca alterar `cobrancas.valor` de cobrança existente.

### 4. RPC `finalize_gallery_payment` (verificação)

Confirmar que já implementa pagamentos parciais corretamente:
- Se `SUM(valor pago) < valor_total_devido` → status galeria = `parcialmente_pago`.
- Se `SUM(valor pago) >= valor_total_devido` → status = `pago_manual` (ou `pago` se algum digital).

Se não suportar, adicionar lógica condicional. (Memória *Finalize Pay RPC Logic* já indica suporte a parciais — apenas validar com query.)

### 5. Hardening adicional

- **Constraint defensiva:** trigger `BEFORE UPDATE ON cobrancas` que bloqueia mudança de `valor` quando `status IN ('pago','pago_manual')` salvo via flag `_allow_value_correction` na sessão.
- **Audit log enriquecido:** registrar saldo antes/depois e cobrança cancelada em metadata.

---

## Detalhes Técnicos (resumo de arquivos)

| Arquivo | Mudança |
|---|---|
| `src/pages/GalleryDetail.tsx` | Filtrar `cobrancaData` por status pendente; passar `saldoPendente` ao card |
| `src/components/PaymentStatusCard.tsx` | Pré-preencher saldo correto; texto auxiliar; aceitar `cobrancaId=null` |
| `supabase/functions/confirm-payment-manual/index.ts` | Rejeitar cobrança quitada; cancelar pendente digital; criar manual com `qtd_fotos` inferido; remover sobrescrita de valor |
| Migration nova | Trigger anti-sobrescrita de `valor` em cobranças quitadas |

---

## Fluxo Esperado Pós-Correção (cenário Gisele)

```text
Estado: cobrança#1 pago_manual R$50 (2 fotos) | saldo pendente R$100 (4 fotos)

[Fotógrafo clica "Registrar recebimento"]
  ↓
Modal abre com Valor = R$100,00 (saldo correto)
Dica: "Saldo pendente: R$ 100,00 — pode registrar parcial"
  ↓
[Confirma R$100 em Dinheiro]
  ↓
Backend: cobrancaId=null → cria cobrança#2 manual R$100 qtd_fotos=4
       → finalize_gallery_payment(cobrança#2)
       → SUM pago = 50+100 = 150 = total devido
       → galeria.status = 'pago_manual', valor_extras_pago=150
  ↓
UI: Status "Pago manualmente" | Histórico mostra 2 recebimentos
```

Para parcial (R$60 + R$40 depois): mesmo fluxo cria 2 cobranças manuais, status fica `parcialmente_pago` até o segundo recebimento fechar o saldo.