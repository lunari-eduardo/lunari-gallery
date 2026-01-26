
## Plano de Correção: Fluxo InfinitePay no Gallery

### Diagnóstico Completo

Analisando os logs detalhadamente, encontrei a **causa raiz** do problema:

**EVIDÊNCIA NOS LOGS:**
```
💳 InfinitePay checkout URL generated: https://checkout.infinitepay.io/lisediehl?lenc=G9UAYByJcUzKoj-YL...

ERROR Charge creation error: {
  code: "23514",
  message: 'new row for relation "cobrancas" violates check constraint "cobrancas_tipo_cobranca_check"'
}
```

**O QUE ESTÁ ACONTECENDO:**
1. A chamada para API InfinitePay **FUNCIONA** - retorna checkout URL corretamente
2. Ao tentar salvar na tabela `cobrancas`, a inserção **FALHA**
3. O `infinitepay-create-link` retorna erro 500
4. O `confirm-selection` captura o erro mas não retorna `checkoutUrl`
5. O frontend recebe `requiresPayment: false` e vai direto para página de confirmação

---

### PROBLEMA IDENTIFICADO

**Constraint CHECK na tabela `cobrancas`:**
```sql
CHECK ((tipo_cobranca = ANY (ARRAY['pix'::text, 'link'::text, 'card'::text, 'presencial'::text])))
```

**Código no `infinitepay-create-link` (linha 186):**
```typescript
tipo_cobranca: 'foto_extra',  // ❌ Valor inválido!
```

O valor `'foto_extra'` NÃO está na lista de valores permitidos.

---

### CORREÇÕES NECESSÁRIAS

#### 1. Atualizar a constraint CHECK no banco de dados

Adicionar `'foto_extra'` à lista de valores permitidos:

```sql
ALTER TABLE cobrancas 
DROP CONSTRAINT cobrancas_tipo_cobranca_check;

ALTER TABLE cobrancas 
ADD CONSTRAINT cobrancas_tipo_cobranca_check 
CHECK (tipo_cobranca = ANY (ARRAY['pix', 'link', 'card', 'presencial', 'foto_extra']));
```

#### 2. Alternativa: Usar valor existente no código

Se preferir não alterar o banco, usar `'link'` em vez de `'foto_extra'`:

**Arquivo:** `supabase/functions/infinitepay-create-link/index.ts` (linha 186)

```typescript
// ANTES (linha 186):
tipo_cobranca: 'foto_extra',

// DEPOIS:
tipo_cobranca: 'link',  // Checkout link InfinitePay
```

---

### SOLUÇÃO RECOMENDADA

**Opção 2 (Usar `'link'`)** é mais simples e não requer migração de banco:

- `'link'` semanticamente descreve um link de checkout externo
- Evita risco de quebrar outras integrações que usam a tabela
- Deploy imediato sem SQL migration

---

### ARQUIVOS A MODIFICAR

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `supabase/functions/infinitepay-create-link/index.ts` | 186 | `tipo_cobranca: 'link'` |

---

### CÓDIGO DA CORREÇÃO

```typescript
// supabase/functions/infinitepay-create-link/index.ts (linhas 177-192)
const { data: cobranca, error: cobrancaError } = await supabase
  .from('cobrancas')
  .insert({
    user_id: userId,
    cliente_id: clienteId,
    session_id: sessionId || null,
    valor,
    descricao,
    tipo_cobranca: 'link',  // ✅ Valor válido na constraint
    provedor: 'infinitepay',
    status: 'pendente',
    ip_checkout_url: checkoutUrl,
    ip_order_nsu: orderNsu,
  })
  .select('id')
  .single();
```

---

### DEPLOY NECESSÁRIO

Após a correção, realizar deploy da Edge Function:
- `infinitepay-create-link`

---

### FLUXO ESPERADO APÓS CORREÇÃO

```
1. Cliente clica "Confirmar e Pagar"
2. ClientGallery → confirm-selection (requestPayment: true)
3. confirm-selection → infinitepay-create-link
4. infinitepay-create-link chama API InfinitePay ✅
5. API retorna { url: "https://checkout.infinitepay.io/..." } ✅
6. infinitepay-create-link insere em cobrancas com tipo='link' ✅ (AGORA FUNCIONA)
7. infinitepay-create-link retorna { success: true, checkoutUrl } ✅
8. confirm-selection recebe checkoutUrl e retorna para frontend ✅
9. ClientGallery → setPaymentInfo({ checkoutUrl, ... }) ✅
10. ClientGallery → setCurrentStep('payment') ✅
11. PaymentRedirect exibe countdown e redireciona ✅
12. Cliente é levado para checkout InfinitePay ✅
```

---

### RESUMO

| Problema | Causa Raiz | Solução |
|----------|------------|---------|
| Não redireciona para checkout | Constraint CHECK rejeita `'foto_extra'` | Usar `tipo_cobranca: 'link'` |
| Erro 500 no infinitepay-create-link | Falha ao inserir em `cobrancas` | Corrigir valor da coluna |
| requiresPayment: false | checkoutUrl não retornado | Inserção bem-sucedida resolve |
