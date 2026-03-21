
# Diagnóstico: pagamento InfinitePay confirmado, mas galeria continua pendente

## Do I know what the issue is?
Sim.

## O que confirmei com dados reais
No teste mais recente:

- **Galeria** `3493ada1-b5db-4a0b-bfc3-b9fffc5157b0`
- **Session** `workflow-1774053782993-w64ywy8ypyc`
- **Cobrança** `f289469f-901d-4a13-95f0-c9977da648e6`
- **Cobrança está `pago`**, com `data_pagamento` e `ip_receipt_url`
- **Galeria continua** `status_pagamento='pendente'` e `status_selecao='aguardando_pagamento'`
- A cobrança foi criada com **`galeria_id = NULL`**
- O `ip_order_nsu` veio como **UUID da cobrança**, não no padrão do código atual (`gallery-...`)
- Há `webhook_logs` marcados como **processed**

## Causa raiz
São **3 falhas encadeadas**:

### 1) Drift de deploy nas functions do InfinitePay
A cobrança criada em produção **não bate com o código atual do repositório**.

Evidências:
- o código atual de `infinitepay-create-link` deveria salvar:
  - `galeria_id`
  - `qtd_fotos`
  - `ip_order_nsu = gallery-...`
- mas a cobrança real foi criada com:
  - `galeria_id = NULL`
  - `ip_order_nsu = UUID`

Isso indica que **a function publicada foi sobrescrita por outra versão** (provavelmente do Gestão ou deploy antigo).

### 2) `check-payment-status` não faz auto-correção quando a cobrança já está paga
Hoje ele faz:

```text
se cobranca.status === 'pago' → retorna status pago
```

e **não chama a RPC** `finalize_gallery_payment` para re-sincronizar galeria/sessão.

Resultado:
- o checkout confirma
- o webhook pode até marcar a cobrança como paga
- mas se a galeria ficou dessincronizada, o retorno do cliente **não corrige mais nada**

### 3) `gallery-access` mostra a galeria como pendente só olhando estado da galeria
Hoje o fluxo de acesso:
- entra em `aguardando_pagamento`
- procura cobrança pendente por `galeria_id`
- como a cobrança órfã está com `galeria_id = NULL`, não encontra
- mesmo assim mantém o cliente na tela de “aguardando confirmação”

Resultado:
- o cliente viu o pagamento aprovado no checkout
- volta ao link
- continua vendo galeria pendente
- isso gera confusão grave

## Plano de correção

### 1. Corrigir e redeployar o contrato InfinitePay
**Arquivos:**
- `supabase/functions/infinitepay-create-link/index.ts`
- `supabase/functions/infinitepay-webhook/index.ts`

**Ajustes:**
- garantir que `infinitepay-create-link` sempre grave:
  - `galeria_id`
  - `session_id`
  - `qtd_fotos`
  - `ip_order_nsu` no padrão oficial esperado
- garantir que `infinitepay-webhook` use sempre a lógica oficial atual
- adicionar um **header de contrato imutável** no topo dessas functions:
  - “não sobrescrever sem coordenação”
  - campos obrigatórios
  - formato de `order_nsu`
  - obrigação de manter `galeria_id`

### 2. Tornar `check-payment-status` um auto-heal real
**Arquivo:**
- `supabase/functions/check-payment-status/index.ts`

**Mudança principal:**
quando a cobrança já estiver `pago`, ele deve:
- chamar `finalize_gallery_payment` novamente **ou**
- executar um bloco explícito de ressincronização

Objetivo:
- se webhook marcou só a cobrança, o retorno do checkout corrige galeria e sessão
- isso vale para redirect, polling e “Verificar agora”

### 3. Blindar `gallery-access` contra galeria presa em pendente
**Arquivo:**
- `supabase/functions/gallery-access/index.ts`

**Mudança:**
antes de retornar `pendingPayment: true`, verificar:
- se existe cobrança recente da sessão
- se a cobrança mais recente já está `pago`
- se estiver `pago`, sincronizar a galeria e retornar estado finalizado

Além disso:
- procurar cobrança por **`galeria_id` e fallback por `session_id`**
- não deixar cliente preso em “aguardando confirmação” quando o pagamento já foi confirmado

### 4. Fortalecer o webhook para auto-recuperação
**Arquivo:**
- `supabase/functions/infinitepay-webhook/index.ts`

**Mudança:**
mesmo se identificar cenário “já pago”, ele deve:
- verificar se a galeria/sessão já foram sincronizadas
- se não, disparar a correção

Assim evitamos o caso:
```text
cobrança = pago
galeria = pendente
webhook responde “already processed”
nada é corrigido
```

### 5. Corrigir dados já quebrados
**Banco / migração SQL:**
- vincular cobranças órfãs usando `session_id`
- sincronizar galerias com cobrança `pago` mas status pendente
- sincronizar `clientes_sessoes`

Alvo mínimo:
- o caso do teste atual
- e uma varredura de todas as cobranças InfinitePay recentes com:
  - `status='pago'`
  - `galeria_id IS NULL`
  - ou galeria ainda `pendente`

### 6. Criar proteção para o projeto Gestão nunca quebrar isso de novo
Como esse problema já se repetiu, precisamos de uma regra técnica, não só combinada.

**Proteções propostas:**
- comentário de contrato obrigatório nas functions compartilhadas
- regra de revisão: **Gestão não pode alterar `infinitepay-create-link`, `infinitepay-webhook`, `check-payment-status`, `confirm-selection` sem coordenação**
- adicionar validação defensiva:
  - se criar cobrança InfinitePay sem `galeria_id` e sem `session_id`, falhar
  - se `ip_order_nsu` vier fora do contrato, logar erro forte
- criar um **script/consulta de auditoria** para detectar diariamente:
  - cobranças pagas com galeria pendente
  - cobranças órfãs
  - galerias em `aguardando_pagamento` com comprovante existente

## Arquivos impactados
- `supabase/functions/infinitepay-create-link/index.ts`
- `supabase/functions/infinitepay-webhook/index.ts`
- `supabase/functions/check-payment-status/index.ts`
- `supabase/functions/gallery-access/index.ts`
- nova migração em `supabase/migrations/...`

## Critério de aceite
- pagamento InfinitePay confirmado → cliente volta e **vê galeria finalizada**
- painel do fotógrafo passa para **Pago** automaticamente
- se webhook falhar parcialmente, o retorno/polling corrige sozinho
- cliente nunca fica preso em tela de pendência quando a cobrança já está paga
- nenhuma nova cobrança InfinitePay é criada sem `galeria_id`/`session_id`
