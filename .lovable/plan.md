

# Substituir "Confirmar Pago" por "Registrar Recebimento" com Modal

## Problema
O botão "Confirmar Pago" chama a Edge Function `confirm-payment-manual` que exige JWT e tenta validar cobrança existente do gateway, gerando erro 401. O fotógrafo precisa de uma forma simples de registrar que recebeu o valor (dinheiro, pix externo, etc.) sem depender do gateway.

## Solução

### 1. Novo status de pagamento: `pago_manual`

Migração SQL para:
- Adicionar `pago_manual` como status válido no `statusConfig` (frontend) e suportar na RPC
- Atualizar a RPC `finalize_gallery_payment` para aceitar um parâmetro `p_manual_method` (text, opcional) e `p_manual_obs` (text, opcional). Quando fornecidos, gravar na cobrança em campos `metodo_manual` e `obs_manual` (novos campos na tabela `cobrancas`)

### 2. Atualizar Edge Function `confirm-payment-manual`

Aceitar novos campos no body:
- `metodoManual` (string: 'dinheiro' | 'pix_externo' | 'cartao_externo' | 'outro')
- `valorManual` (number, opcional — permite registrar valor diferente)
- `observacao` (string, opcional)

Passar esses campos para a RPC. Gravar na cobrança os campos `metodo_manual` e `obs_manual`. Se não existir cobrança (`cobrancaId` null), criar uma nova cobrança do tipo manual diretamente vinculada à galeria/sessão.

### 3. Redesign do `PaymentStatusCard.tsx`

**Remover:** botão "Confirmar Pago" e toda a lógica `handleConfirmPaid` atual.

**Adicionar:** botão "Registrar recebimento" que abre um modal com:
- Select: forma de pagamento (Dinheiro, PIX externo, Cartão externo, Outro)
- Input numérico: valor (pré-preenchido com `valor` pendente, editável)
- Textarea: observação (opcional)
- Botão "Confirmar recebimento"

Ao confirmar, chamar `confirm-payment-manual` com os novos campos. Após sucesso, `onStatusUpdated()`.

**Novo status visual:** Adicionar `pago_manual` ao `statusConfig` com label "Pago manualmente" e cor verde, e mostrar o método e observação quando disponíveis.

### 4. Suporte a registro sem cobrança existente

Quando `cobrancaId` é null (galeria pendente sem cobrança no banco), o botão "Registrar recebimento" ainda deve funcionar. A Edge Function criará uma cobrança manual automaticamente com `provedor = 'manual'`.

Para isso, passar `galleryId` e `sessionId` como fallback na chamada.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/...` | Adicionar colunas `metodo_manual`, `obs_manual` em `cobrancas`; atualizar RPC |
| `supabase/functions/confirm-payment-manual/index.ts` | Aceitar novos campos; criar cobrança se inexistente |
| `src/components/PaymentStatusCard.tsx` | Remover "Confirmar Pago"; adicionar modal "Registrar recebimento" |

