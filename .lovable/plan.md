

# Fix: 2 Galerias pagas mas com status pendente + Prevenção

## Diagnóstico

Apenas **2 galerias** estão dessincronizadas:

| Galeria | Cobrança | Provedor | Status cobrança | Status galeria |
|---|---|---|---|---|
| `8ca891fc` | `dc7c8539` | MercadoPago | `pago` | `pendente` |
| `3493ada1` | `f289469f` | InfinitePay | `pago` | `pendente` |

**Causa**: ambas as cobranças foram criadas com `galeria_id = NULL` (bug do deploy do Gestão). Quando o webhook processou o pagamento, a RPC `finalize_gallery_payment` não encontrou a galeria. Migrações posteriores vincularam o `galeria_id`, mas a cobrança já estava `pago` — nenhum trigger ou RPC foi re-executado.

**Todas as outras cobranças pagas** com `galeria_id = NULL` não têm galerias pendentes correspondentes (já foram corrigidas por auto-heal ou são cobranças de teste).

## Estado atual do sistema

A arquitetura agora está correta:
- Todos os webhooks (Asaas, MP, InfinitePay) chamam a RPC `finalize_gallery_payment`
- `check-payment-status` faz auto-heal
- `gallery-access` faz auto-heal
- `confirm-payment-manual` funciona como chave mestra
- A RPC resolve `galeria_id` via `session_id` como fallback

O problema é **apenas dados históricos** — não há falha estrutural ativa.

## Plano

### 1. Migração SQL: corrigir as 2 galerias + prevenção

**Correção imediata** — chamar a RPC para cada uma das 2 galerias (usa o mecanismo already_paid + auto-heal):

```sql
SELECT finalize_gallery_payment('dc7c8539-3c47-477c-9a24-bde150c3d791');
SELECT finalize_gallery_payment('f289469f-901d-4a13-95f0-c9977da648e6');
```

**Prevenção** — adicionar um trigger de segurança no `cobrancas` que sincroniza a galeria automaticamente quando o status muda para `pago`/`pago_manual`, como rede de segurança além da RPC:

```sql
CREATE FUNCTION sync_gallery_on_cobranca_paid()
  -- Quando cobrança muda para pago/pago_manual:
  -- 1. Resolver galeria_id via session_id se NULL
  -- 2. Atualizar galerias.status_pagamento
  -- 3. Atualizar clientes_sessoes
```

Esse trigger atua como **última linha de defesa** — mesmo que um webhook hipotético faça UPDATE direto no futuro, a galeria será sincronizada.

### 2. Nenhuma mudança em código

Todos os caminhos de código já estão corretos.

## Arquivo

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Corrigir 2 galerias via RPC + trigger de segurança |

