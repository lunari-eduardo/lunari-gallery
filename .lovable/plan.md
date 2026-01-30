
# Plano: Corrigir Sistema de Créditos para PIX Manual

## Problema Identificado

Quando o fotógrafo clica em "Confirmar Recebimento" para pagamentos PIX Manual, o sistema apenas atualiza o `status_pagamento` para 'pago', mas **não incrementa os contadores de crédito**:

| Campo | Valor Atual | Valor Esperado |
|-------|-------------|----------------|
| `total_fotos_extras_vendidas` | 0 | 2 |
| `valor_total_vendido` | 0 | 20.00 |
| `status_pagamento` | pago | pago ✓ |

### Consequência

No segundo ciclo de seleção, a fórmula de crédito não reconhece as fotos já pagas:
```
extrasACobrar = extrasNecessarias - total_fotos_extras_vendidas
             = 2 - 0 = 2  ← Deveria ser 2 - 2 = 0!
```

---

## Causa Raiz

A confirmação manual no frontend (`GalleryDetail.tsx` linhas 489-516) não replica a lógica dos webhooks automatizados (InfinitePay/Mercado Pago), que incrementam corretamente os contadores.

### Código Atual (Incompleto)
```javascript
// Apenas atualiza status - FALTAM os contadores!
await supabase
  .from('galerias')
  .update({ status_pagamento: 'pago' })
  .eq('id', supabaseGallery.id);
```

### Código dos Webhooks (Correto)
```javascript
// Incrementa contadores + status
await supabase
  .from('galerias')
  .update({
    total_fotos_extras_vendidas: extrasAtuais + extrasNovas,
    valor_total_vendido: valorAtual + valorCobranca,
    status_pagamento: 'pago',
  })
  .eq('id', galeria.id);
```

---

## Solução

Atualizar a confirmação manual de PIX no `GalleryDetail.tsx` para incluir a mesma lógica de crédito usada pelos webhooks.

### Mudanças em `src/pages/GalleryDetail.tsx`

Alterar o handler do botão "Confirmar Recebimento" (linhas 489-516):

**ANTES:**
```javascript
onClick={async () => {
  const valorExtras = supabaseGallery.valorExtras || calculatedExtraTotal;
  
  // Update gallery payment status
  await supabase
    .from('galerias')
    .update({ status_pagamento: 'pago' })
    .eq('id', supabaseGallery.id);
  
  // Update clientes_sessoes.valor_pago...
}}
```

**DEPOIS:**
```javascript
onClick={async () => {
  const valorExtras = supabaseGallery.valorExtras || calculatedExtraTotal;
  
  // Calculate extras to credit
  const fotosIncluidas = supabaseGallery.fotosIncluidas || 0;
  const fotosSelecionadas = supabaseGallery.fotosSelecionadas || 0;
  const extrasNovas = Math.max(0, fotosSelecionadas - fotosIncluidas);
  
  // Get current credit values
  const extrasAtuais = supabaseGallery.totalFotosExtrasVendidas || 0;
  const valorAtual = supabaseGallery.valorTotalVendido || 0;
  
  // Update gallery with CREDIT SYSTEM increments
  await supabase
    .from('galerias')
    .update({ 
      status_pagamento: 'pago',
      total_fotos_extras_vendidas: extrasAtuais + extrasNovas,
      valor_total_vendido: valorAtual + valorExtras,
    })
    .eq('id', supabaseGallery.id);
  
  // Update clientes_sessoes.valor_pago...
}}
```

---

## Validação do Fluxo Corrigido

Após a correção, o segundo ciclo calculará corretamente:

```
Primeiro Ciclo:
- Cliente seleciona 3 fotos (1 incluída + 2 extras)
- Fotógrafo confirma PIX: +2 extras, +R$ 20
- galerias.total_fotos_extras_vendidas = 2 ✓

Segundo Ciclo (reativação):
- Cliente seleciona 4 fotos (1 incluída + 3 extras)
- extrasNecessarias = 3
- extrasPagasTotal = 2 (do banco)
- extrasACobrar = 3 - 2 = 1 foto ✓
- Valor a cobrar: 1 × R$ 10 = R$ 10 ✓
```

---

## Arquivos a Modificar

1. **`src/pages/GalleryDetail.tsx`** (linhas 489-516):
   - Calcular quantidade de extras baseado em `fotosIncluidas` vs `fotosSelecionadas`
   - Incrementar `total_fotos_extras_vendidas` com as novas extras
   - Incrementar `valor_total_vendido` com o valor pago
   - Manter atualização de `status_pagamento: 'pago'`

---

## Verificação Adicional

Também verificar se o hook `useSupabaseGalleries` está retornando corretamente os campos `fotosIncluidas`, `fotosSelecionadas`, `totalFotosExtrasVendidas` e `valorTotalVendido` para que o cálculo no frontend funcione.

---

## Benefícios

1. **Correção imediata**: PIX Manual funcionará igual aos webhooks automatizados
2. **Consistência**: Mesma fórmula de crédito para todos os provedores
3. **Sem regressão**: Não afeta fluxos existentes de InfinitePay/Mercado Pago
