
# Diagnóstico Completo: Galerias Pagas com Status Pendente

## Causa raiz confirmada com evidências do banco

A **"Antônia 4 anos"** foi paga via PIX InfinitePay (R$ 25,00). O webhook chegou **5 vezes** entre 14:03 e 14:05 UTC. Todas as 5 tentativas falharam com o **mesmo erro**:

```text
Could not choose the best candidate function between:
  finalize_gallery_payment(uuid, text, timestamptz)
  finalize_gallery_payment(uuid, text, timestamptz, text, text)
```

A migração que adicionou a versão com 5 parâmetros (para pagamento manual) **não removeu a versão antiga com 3 parâmetros**. O PostgreSQL não consegue desambiguar chamadas com 3 args quando a versão de 5 tem `DEFAULT NULL` nos últimos 2 — ambas são candidatas válidas.

Após a InfinitePay esgotar as 5 tentativas de retry, parou de enviar. A migração seguinte corrigiu a ambiguidade (ficou só 1 versão), mas o dano já estava feito.

### Galerias afetadas (3 no total)

| Galeria | Cobrança | Provedor | Valor | Situação |
|---|---|---|---|---|
| Antônia 4 anos | `25b5dfd1` | InfinitePay | R$ 25 | Paga (receipt existe nos webhook_logs), webhook falhou por ambiguidade RPC |
| Lorena 9 meses | `0ffb440c` | InfinitePay | R$ 92 | ip_order_nsu = UUID (deploy antigo), nenhum webhook recebido |
| Mensal | `7eb21a3c` | InfinitePay | R$ 138 | ip_order_nsu correto, nenhum webhook recebido |

A Antônia tem **prova de pagamento** nos logs (receipt_url, paid_amount=2500). As outras duas não têm evidência nos logs — podem estar genuinamente pendentes ou o webhook se perdeu.

## O que já está corrigido

- A ambiguidade RPC **já foi resolvida** — existe apenas 1 versão da função agora
- O trigger `sync_gallery_on_cobranca_paid` já existe como rede de segurança
- Os webhooks futuros vão funcionar normalmente

## O que falta corrigir

### 1. Correção imediata: Antônia 4 anos

Migração SQL para finalizar a cobrança `25b5dfd1` usando os dados do webhook (receipt_url confirmado nos logs):

```sql
-- Atualizar cobrança com dados do pagamento confirmado
UPDATE cobrancas
SET ip_receipt_url = 'https://recibo.infinitepay.io/77cc7ac0-baa4-4684-b597-28fd07a89acd',
    ip_transaction_nsu = '77cc7ac0-baa4-4684-b597-28fd07a89acd'
WHERE id = '25b5dfd1-d696-4ce8-85d8-ca946cb5e445';

-- Chamar RPC para finalizar atomicamente
SELECT finalize_gallery_payment(
  '25b5dfd1-d696-4ce8-85d8-ca946cb5e445',
  'https://recibo.infinitepay.io/77cc7ac0-baa4-4684-b597-28fd07a89acd',
  '2026-03-21T14:02:14Z'
);
```

O trigger `sync_gallery_on_cobranca_paid` cuidará da galeria e sessão automaticamente.

### 2. Proteção: garantir que a ambiguidade nunca volte

Adicionar na mesma migração um `DROP FUNCTION IF EXISTS` explícito da assinatura antiga de 3 args, como segurança caso alguma migração futura recrie a versão antiga:

```sql
DROP FUNCTION IF EXISTS finalize_gallery_payment(uuid, text, timestamptz);
```

Isso não afeta a versão de 5 args (que tem assinatura diferente).

### 3. Atualizar webhook_logs das 5 tentativas falhadas

Marcar os 5 registros de erro como `recovered` para auditoria:

```sql
UPDATE webhook_logs
SET status = 'recovered', 
    error_message = error_message || ' [recovered via migration]'
WHERE order_nsu = 'gallery-1774101734173-jr3t9g' AND status = 'error';
```

## Detalhes técnicos

### Por que o trigger `sync_gallery_on_cobranca_paid` não salvou?

Porque a cobrança **nunca teve seu status alterado para `pago`**. Todas as 5 tentativas do webhook falharam na chamada RPC, então o `UPDATE cobrancas SET status = 'pago'` nunca foi executado, e o trigger nunca disparou.

### Por que o `check-payment-status` (polling) não salvou?

O polling depende do cliente ficar na página. Se o cliente viu "pagamento confirmado" no checkout InfinitePay e saiu, o polling nunca executou. Além disso, durante o período da ambiguidade, o polling também teria falhado na mesma chamada RPC.

### Por que o `gallery-access` (auto-heal) não salvou?

O auto-heal verifica se existe cobrança com `status IN ('pago', 'pago_manual')`. Como a cobrança ficou em `pendente` (RPC nunca executou), o auto-heal não encontrou nada para corrigir.

### Sobre Lorena e Mensal

Sem evidência de pagamento nos webhook_logs. Se o usuário confirmar que foram pagas, pode usar o botão "Registrar recebimento" que agora funciona corretamente.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Finalizar Antônia + DROP da assinatura antiga como prevenção + marcar logs como recovered |
