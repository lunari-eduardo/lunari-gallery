
## Plano: Status de Pagamento na Galeria e Sincronização com clientes_sessoes

### Visao Geral

Adicionar status detalhado de pagamento na tela de detalhes da galeria (nas abas "Selecao" e "Detalhes") e criar o webhook InfinitePay que esta faltando para processar confirmacoes de pagamento automaticamente e atualizar `clientes_sessoes.valor_pago`.

---

### Estrutura Atual

**Tabelas envolvidas:**
- `galerias` - status_pagamento (sem_vendas, pendente, aguardando_confirmacao, pago)
- `cobrancas` - registros de pagamento com status, valor, provedor, data_pagamento
- `clientes_sessoes` - valor_pago (precisa ser atualizado quando pagamento confirmado)

**Problema identificado:**
1. Nao existe `infinitepay-webhook` Edge Function para processar confirmacoes automaticas
2. A confirmacao manual de PIX nao atualiza `clientes_sessoes.valor_pago`
3. Nao ha exibicao de status de pagamento nas abas Selecao e Detalhes

---

### Arquivos a Criar

#### 1. `supabase/functions/infinitepay-webhook/index.ts`

Edge Function para receber webhooks da InfinitePay quando pagamento e aprovado.

**Funcionalidades:**
- Receber POST da InfinitePay com dados do pagamento
- Buscar cobranca pelo `order_nsu` ou `transaction_nsu`
- Atualizar `cobrancas.status` para 'pago' e salvar `data_pagamento`, `ip_transaction_nsu`, `ip_receipt_url`
- Atualizar `galerias.status_pagamento` para 'pago'
- Atualizar `clientes_sessoes.valor_pago` somando o valor da cobranca (se session_id existir)

```typescript
// Logica principal
1. Parse body do webhook InfinitePay
2. Buscar cobranca por ip_order_nsu
3. Se encontrada e status != 'pago':
   - Atualizar cobranca para 'pago'
   - Buscar galeria pelo session_id da cobranca
   - Atualizar galerias.status_pagamento
   - Somar valor em clientes_sessoes.valor_pago
```

---

### Arquivos a Modificar

#### 2. `src/pages/GalleryDetail.tsx`

**Adicoes na aba "Selecao" (linha ~437):**

Criar novo componente de card para status de pagamento abaixo do SelectionSummary:

```
Card "Status do Pagamento"
  - Status: Pendente / Pago / Aguardando Confirmacao
  - Provedor: InfinitePay / PIX Manual
  - Valor: R$ X.XX
  - Data pagamento: dd/MM/yyyy HH:mm (se pago)
  - Link do comprovante (se disponivel)
```

**Adicoes na aba "Detalhes" (linha ~486):**

Adicionar novo card "Informacoes de Pagamento" ao lado das configuracoes:

```
Card "Informacoes de Pagamento"
  - Status do pagamento: Badge colorido
  - Metodo: InfinitePay / PIX Manual / Sem cobranca
  - Valor extras: R$ X.XX
  - Valor pago: R$ X.XX (se houver)
  - Valor pendente: R$ X.XX (se houver)
```

**Adicoes no topo da pagina:**

Buscar dados de cobranca relacionada a galeria para exibir informacoes de pagamento:

```typescript
// Query adicional
const { data: cobrancaData } = useQuery({
  queryKey: ['galeria-cobranca', supabaseGallery?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('session_id', supabaseGallery.sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!supabaseGallery?.sessionId,
});
```

#### 3. Modificar confirmacao manual de PIX (linha ~343-367)

Quando fotografo confirma recebimento manual:
- Atualizar `galerias.status_pagamento` para 'pago'
- Se houver `session_id`, somar valor em `clientes_sessoes.valor_pago`

```typescript
// Adicionar logica para atualizar sessao
if (supabaseGallery.sessionId) {
  const { data: sessao } = await supabase
    .from('clientes_sessoes')
    .select('valor_pago')
    .eq('session_id', supabaseGallery.sessionId)
    .single();
  
  if (sessao) {
    await supabase
      .from('clientes_sessoes')
      .update({ 
        valor_pago: (sessao.valor_pago || 0) + valorExtras 
      })
      .eq('session_id', supabaseGallery.sessionId);
  }
}
```

---

### Componentes Visuais

#### Status Badge de Pagamento

| Status | Cor | Texto |
|--------|-----|-------|
| sem_vendas | Cinza | Sem cobranca |
| pendente | Amarelo | Pendente |
| aguardando_confirmacao | Laranja | Aguardando confirmacao |
| pago | Verde | Pago |

#### Card Status Pagamento (aba Selecao)

```
+------------------------------------------+
| Status do Pagamento                      |
+------------------------------------------+
| Status       [Badge: Pago]               |
| Provedor     InfinitePay                 |
| Valor        R$ 5.00                     |
| Data         26/01/2026 14:30            |
| [Link] Ver comprovante                   |
+------------------------------------------+
```

#### Card Info Pagamento (aba Detalhes)

```
+------------------------------------------+
| Informacoes de Pagamento                 |
+------------------------------------------+
| Status           [Badge: Pendente]       |
| Metodo           Pagamento online        |
| Provedor         InfinitePay             |
| Valor extras     R$ 5.00                 |
| Valor pago       R$ 0.00                 |
| Pendente         R$ 5.00                 |
+------------------------------------------+
```

---

### Webhook InfinitePay - Payload Esperado

Conforme documentacao oficial:

```json
{
  "invoice_slug": "abc123",
  "amount": 1000,
  "paid_amount": 1010,
  "installments": 1,
  "capture_method": "credit_card",
  "transaction_nsu": "UUID",
  "order_nsu": "gallery-timestamp-random",
  "receipt_url": "https://comprovante.com/123",
  "items": [...]
}
```

---

### Deploy Necessario

Apos as modificacoes:
- Deploy da nova Edge Function `infinitepay-webhook`

---

### Fluxo Completo Apos Implementacao

```
1. Cliente finaliza pagamento no checkout InfinitePay
2. InfinitePay envia POST para /functions/v1/infinitepay-webhook
3. Webhook:
   a) Busca cobranca por order_nsu
   b) Atualiza cobrancas.status = 'pago'
   c) Atualiza galerias.status_pagamento = 'pago'
   d) Soma valor em clientes_sessoes.valor_pago
4. Fotografo ve status atualizado na tela de detalhes
5. Workflow reflete valor pago atualizado
```

---

### Resumo das Modificacoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `supabase/functions/infinitepay-webhook/index.ts` | Criar | Webhook para processar confirmacoes InfinitePay |
| `src/pages/GalleryDetail.tsx` | Modificar | Adicionar cards de status de pagamento nas abas |
| `src/pages/GalleryDetail.tsx` | Modificar | Atualizar valor_pago na confirmacao manual PIX |

---

### Sessao Tecnica

**Query para buscar cobranca:**
```sql
SELECT * FROM cobrancas 
WHERE session_id = 'workflow-xxx' 
ORDER BY created_at DESC 
LIMIT 1
```

**Update em clientes_sessoes:**
```sql
UPDATE clientes_sessoes 
SET valor_pago = valor_pago + [valor_cobranca]
WHERE session_id = 'workflow-xxx'
```

**Resposta ao webhook:**
- Sucesso: HTTP 200 OK
- Erro: HTTP 400 Bad Request (InfinitePay tenta novamente)

