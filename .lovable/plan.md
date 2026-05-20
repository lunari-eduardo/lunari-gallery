# Corrigir provedor de pagamentos manuais no histórico

## Causa raiz

Quando o fotógrafo clica em **"Registrar recebimento"** numa galeria que já tem um link InfinitePay pendente:

1. O frontend (`PaymentStatusCard.tsx`) envia `cobrancaId` da cobrança InfinitePay pendente.
2. A edge function `confirm-payment-manual` chama a RPC `finalize_gallery_payment`.
3. A RPC, no **Branch 3** (primeira finalização), atualiza `status='pago_manual'`, `metodo_manual='dinheiro'`, `obs_manual`, mas **nunca toca em `provedor`** — que permanece `'infinitepay'`.
4. O histórico (`PaymentHistoryCard`, `ClientProfile`) lê `provedor` para o logo/label → mostra "InfinitePay" indevidamente.

Cobranças pagas via fluxo "cobrancaId=null" (sem link prévio) já funcionam corretamente, porque a edge function cria nova cobrança com `provedor='manual'` e cancela a digital pendente.

## Solução (2 camadas, defensiva)

### 1. Edge function `confirm-payment-manual` — forçar fluxo "nova cobrança manual"

Sempre que `metodoManual` for informado e existir `galleryId`/`sessionId`, ignorar o `cobrancaId` recebido e seguir o caminho que **cria cobrança nova com `provedor='manual'` + cancela as digitais pendentes**. Isso já existe e é seguro:

- O cancelamento da pendente (`status='cancelado'`) preserva auditoria via `obs_manual`.
- A RPC recalcula `valor_total_vendido` somando todas as `pago/pago_manual` da galeria → contadores e fotos extras não mudam.
- O dedup de 60s já evita duplicação por duplo-clique.

Benefício: cada recebimento manual fica como linha própria no histórico, com `provedor='manual'` e `metodo_manual='dinheiro'|'pix_externo'|...`, totalmente fiel ao que o fotógrafo escolheu.

### 2. RPC `finalize_gallery_payment` — fallback defensivo

Para casos em que a edge function (ou integrações futuras) ainda passem um `cobrancaId` digital com `p_manual_method`, ajustar o **Branch 3** para também setar `provedor='manual'` quando `p_manual_method IS NOT NULL`, preservando o provedor antigo em `obs_manual` (ex.: prefixo `"[orig: infinitepay] ..."`).

Isso garante que mesmo legado / chamadas diretas à RPC fiquem consistentes, sem afetar cobranças digitais reais (Asaas, InfinitePay webhook, MP) que nunca passam `p_manual_method`.

### 3. UI — exibir método manual

Em `PaymentHistoryCard.tsx` e `ClientProfile.tsx`, quando `provedor === 'manual'`, exibir o `metodo_manual` (Dinheiro, PIX Externo, Transferência, Outro) com ícone genérico (`Wallet`/`Banknote`) ao invés de "Desconhecido".

Para isso `useClientProfile.ts` precisa incluir `metodo_manual` no `select` de `cobrancas` (campo já existe na tabela).

## Migração de dados (opcional — recomendada)

Backfill defensivo, executado uma vez:

```sql
UPDATE public.cobrancas
SET provedor = 'manual',
    obs_manual = COALESCE('[orig: ' || provedor || '] ', '') || COALESCE(obs_manual, '')
WHERE status = 'pago_manual'
  AND metodo_manual IS NOT NULL
  AND provedor <> 'manual';
```

Corrige o histórico já existente (ex.: as 4 cobranças "InfinitePay" da captura).

## Arquivos afetados

- `supabase/functions/confirm-payment-manual/index.ts` — forçar `targetCobrancaId=null` quando `metodoManual` presente e há galleryId/sessionId.
- `supabase/migrations/<novo>.sql` — atualizar RPC `finalize_gallery_payment` (Branch 3) + backfill.
- `src/components/PaymentHistoryCard.tsx` — label + ícone para `provedor='manual'` usando `metodo_manual`.
- `src/pages/ClientProfile.tsx` — mesmo tratamento.
- `src/hooks/useClientProfile.ts` — incluir `metodo_manual` no select de `cobrancas`.

## Garantias de não-regressão

- **Fotos extras / contadores**: a RPC recalcula `total_fotos_extras_vendidas` e `valor_total_vendido` somando todas as cobranças pagas — independente de quantas linhas existam → resultado idêntico.
- **Sessões / clientes_sessoes**: mesma lógica de sum, sem impacto.
- **Webhooks Asaas/InfinitePay/MP**: nunca chamam `confirm-payment-manual` nem passam `p_manual_method` → Branch 2/3 da RPC seguem inalterados para eles.
- **Galeria reativada**: o pre-check existente que rejeita cobranças já `pago/pago_manual/cancelado` continua intacto.
- **Audit log**: já registra `provedor: metodoManual` no `confirm-payment-manual`; passa a refletir o que de fato foi gravado.

## Fora de escopo

- Migrar provedor de cobranças digitais pagas legítimas.
- Mudanças na criação de links InfinitePay/Asaas/MP.
- Alteração no fluxo de webhook de qualquer provedor.
