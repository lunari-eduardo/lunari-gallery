
# Plano de Correção: Mercado Pago PIX Automatizado + Sistema Robusto

## Problemas Identificados

### Problema 1: PIX do MP não tem checkoutUrl

Quando **apenas PIX está habilitado** no Mercado Pago (`habilitarCartao: false`):

1. `mercadopago-create-link` cria pagamento PIX direto (linha 239-309)
2. A resposta contém `qr_code` e `qr_code_base64`, mas **NÃO inclui `checkoutUrl`**
3. `confirm-selection` lê `paymentData.paymentLink` → **undefined**
4. O frontend verifica `data.checkoutUrl` → **undefined**
5. Cai no fallback "sem pagamento" → vai para `'confirmed'`

```text
Fluxo Atual (QUEBRADO):

mercadopago-create-link retorna:
{
  success: true,
  payment_method: 'pix',
  qr_code: "00020126...",         ← QR Code está aqui!
  qr_code_base64: "data:image...", ← Imagem também!
  cobrancaId: "uuid...",
  // checkoutUrl: UNDEFINED!       ← FALTA este campo
}

confirm-selection lê:
paymentData.paymentLink → undefined  ← ERRO!

ClientGallery verifica:
if (data.requiresPayment && data.checkoutUrl) { ← FALSE!
  // Nunca entra aqui
}
setCurrentStep('confirmed'); ← Pula direto para finalizado!
```

### Problema 2: Não há tratamento para "MP PIX Automatizado"

O frontend reconhece apenas dois tipos:

| Tipo | Condição | Ação |
|------|----------|------|
| PIX Manual | `paymentMethod === 'pix_manual'` | Mostra `PixPaymentScreen` interno |
| Checkout Externo | `checkoutUrl !== undefined` | Redireciona para MP/InfinitePay |

O **PIX automatizado do Mercado Pago** (com `qr_code` próprio) não é tratado!

### Problema 3: Número máximo de parcelas pode não funcionar

O `maxParcelas` é lido corretamente das configurações (linha 313 de `mercadopago-create-link`), porém, se a configuração nunca foi salva ou está mal formatada, pode haver problemas.

## Análise de Decisão: Como Tratar MP PIX?

Existem duas opções arquiteturais:

### Opção A: PIX do MP = Tela Interna (como PIX Manual)
- Mostrar QR Code do Mercado Pago no próprio frontend
- Vantagem: Cliente não sai do site
- Desvantagem: Requer polling para saber se pagou

### Opção B: PIX do MP = Sempre criar Preference (checkout externo) ✓ RECOMENDADA
- Mesmo com só PIX, criar uma "Preference" do Checkout Pro
- O checkout do MP mostra apenas opção PIX
- Vantagem: Fluxo consistente, confirmação automática via redirect
- Desvantagem: Cliente sai momentaneamente do site

**Escolha: Opção B** - Mais simples, robusto e mantém consistência com outros provedores.

## Solução

### Mudança 1: Sempre criar Preference quando for checkout de galeria

Quando `paymentMethod` não é explicitamente `'pix'`, sempre criar uma Preference do Checkout Pro. A API do MP já cuida de mostrar apenas as opções habilitadas.

**Arquivo: `supabase/functions/mercadopago-create-link/index.ts`**

Remover a lógica que força `paymentMethod = 'pix'` quando só PIX habilitado (linhas 232-236):

```typescript
// ANTES (REMOVER):
if (!paymentMethod && pixHabilitado && !cartaoHabilitado) {
  console.log('📱 Apenas PIX habilitado - criando pagamento PIX direto');
  paymentMethod = 'pix';
}

// DEPOIS:
// Apenas criar pagamento PIX direto se EXPLICITAMENTE solicitado
// Caso contrário, sempre criar Preference (checkout externo)
// A Preference vai excluir cartão automaticamente se não habilitado
```

Manter a exclusão de cartão na Preference (já existe, linha 319-323):
```typescript
if (!cartaoHabilitado) {
  excludedTypes.push({ id: 'credit_card' });
  excludedTypes.push({ id: 'debit_card' });
  console.log('💳 Cartão desabilitado - excluindo do checkout');
}
```

### Mudança 2: Adicionar validação de maxParcelas

Garantir que `maxParcelas` seja sempre um número válido:

```typescript
// Validar maxParcelas
const maxParcelas = Math.min(
  Math.max(1, parseInt(String(settings?.maxParcelas)) || 12),
  24 // Limite máximo do MP
);
console.log(`📊 Parcelas máximas configuradas: ${maxParcelas}`);
```

### Mudança 3: Atualizar confirm-selection para compatibilidade

Garantir que `confirm-selection` leia corretamente tanto `checkoutUrl` quanto `paymentLink`:

**Arquivo: `supabase/functions/confirm-selection/index.ts` (linha 370-372)**

```typescript
// ANTES:
const checkoutUrl = integracao.provedor === 'infinitepay'
  ? paymentData.checkoutUrl
  : paymentData.paymentLink;

// DEPOIS (mais robusto):
const checkoutUrl = paymentData.checkoutUrl || paymentData.paymentLink;
```

## Fluxo Corrigido

```text
1. Fotógrafo configura MP: PIX ✓, Cartão ✗

2. Cliente confirma seleção
          ↓
3. confirm-selection → mercadopago-create-link
          ↓
4. mercadopago-create-link:
   - NÃO força paymentMethod = 'pix'
   - Cria Preference com excludedTypes = ['ticket', 'credit_card', 'debit_card']
          ↓
5. Preference retorna:
   {
     init_point: "https://www.mercadopago.com.br/checkout/...",
     // Checkout mostrará apenas PIX!
   }
          ↓
6. Resposta normalizada:
   {
     success: true,
     checkoutUrl: "https://...",    ✓
     paymentLink: "https://...",    ✓
     cobrancaId: "...",             ✓
   }
          ↓
7. confirm-selection captura checkoutUrl ✓
          ↓
8. ClientGallery:
   if (data.requiresPayment && data.checkoutUrl) {
     setCurrentStep('payment');  ← Funciona!
   }
          ↓
9. PaymentRedirect → Cliente vai ao MP, vê só PIX
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/mercadopago-create-link/index.ts` | 1. Remover lógica que força PIX direto (linhas 232-236)<br>2. Validar maxParcelas com limites |
| `supabase/functions/confirm-selection/index.ts` | Fallback para `checkoutUrl OR paymentLink` (linha 370-372) |

## Validações de Robustez Adicionais

Para blindar o sistema, também adicionaremos:

1. **Log detalhado** quando criar Preference com exclusões
2. **Validação de tipo** para maxParcelas (converter string para número)
3. **Fallback seguro** se configurações estiverem vazias ou malformadas

## Cenários de Teste

Após implementação:

- [ ] Galeria com MP (só PIX) → Deve redirecionar para checkout MP com só PIX
- [ ] Galeria com MP (PIX + Cartão) → Deve redirecionar para checkout MP completo
- [ ] Galeria com MP (só Cartão) → Deve redirecionar para checkout MP com só cartão
- [ ] Galeria pública + MP (qualquer config) → Deve funcionar
- [ ] Galeria com InfinitePay → Sem alteração (continua funcionando)
- [ ] Galeria com PIX Manual → Sem alteração (continua funcionando)
- [ ] Verificar se parcelas estão limitadas conforme configuração

## Benefícios

1. **Correção imediata**: PIX-only do MP vai funcionar
2. **Fluxo consistente**: Sempre checkout externo para provedores automatizados
3. **Sistema robusto**: Validações previnem erros de configuração
4. **Sem regressão**: InfinitePay e PIX Manual continuam iguais
