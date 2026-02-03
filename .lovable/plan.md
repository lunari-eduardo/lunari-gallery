
# Plano: Correção do Fluxo de Checkout e Download para Galerias Públicas

## Problemas Identificados

Após análise detalhada do código, identifiquei **4 bugs críticos** que impedem o redirecionamento correto para checkout:

---

## Bug 1: `chargeType: 'all_selected'` Ignorado no Backend

### Causa
O Edge Function `confirm-selection` **sempre** calcula extras como:
```typescript
// Linha 211 - PROBLEMA
const extrasNecessarias = Math.max(0, selectedCount - fotos_incluidas);
```

Isso assume que apenas fotos **além do limite** são cobradas, ignorando o `chargeType: 'all_selected'` que deveria cobrar **TODAS** as fotos selecionadas.

### Impacto
Se a galeria tem `chargeType: 'all_selected'` e `fotos_incluidas = 0`, funcionaria. Mas se `fotos_incluidas > 0`, o cálculo descarta fotos que deveriam ser cobradas.

### Solução
Adicionar lógica para ler `chargeType` das configurações:

```typescript
const chargeType = configuracoes?.saleSettings?.chargeType || 'only_extras';

const extrasNecessarias = chargeType === 'all_selected'
  ? selectedCount  // TODAS as selecionadas
  : Math.max(0, selectedCount - (gallery.fotos_incluidas || 0));  // Apenas extras
```

---

## Bug 2: `chargeType` Ignorado no Cliente

### Causa
Em `ClientGallery.tsx`, linhas 765-774 e 829-831, o cálculo também ignora `chargeType`:

```typescript
// PROBLEMA - sempre calcula como "only_extras"
const extrasNecessarias = Math.max(0, selectedCount - gallery.includedPhotos);
```

### Solução
Usar o mesmo padrão consistente:

```typescript
const chargeType = gallery.saleSettings?.chargeType || 'only_extras';
const extrasNecessarias = chargeType === 'all_selected'
  ? selectedCount
  : Math.max(0, selectedCount - gallery.includedPhotos);
```

---

## Bug 3: Ordem de State Updates no `onSuccess`

### Causa
Em `ClientGallery.tsx`, linha 425-426:

```typescript
onSuccess: (data) => {
  setIsConfirmed(true);  // ← Define ANTES de verificar pagamento
  // ...
```

Isso pode causar um flash na tela de confirmação antes de ir para pagamento em cenários de edge case.

### Solução
Mover `setIsConfirmed(true)` para DEPOIS de determinar se vai para pagamento ou confirmação:

```typescript
onSuccess: (data) => {
  // PIX Manual - vai para tela de pagamento
  if (data.requiresPayment && data.paymentMethod === 'pix_manual' && data.pixData) {
    setIsConfirmed(true);  // ← Depois de determinar destino
    setPixPaymentData({...});
    setCurrentStep('payment');
    return;
  }
  
  // Checkout externo - redireciona
  if (data.requiresPayment && data.checkoutUrl) {
    setIsConfirmed(true);  // ← Depois de determinar destino
    setPaymentInfo({...});
    setCurrentStep('payment');
    return;
  }
  
  // Sem pagamento - confirmação final
  setIsConfirmed(true);
  setCurrentStep('confirmed');
}
```

---

## Bug 4: Modal de Download Não Abre Automaticamente

### Causa
O plano de implementação do Premium Download mencionava um `useEffect` para abrir o modal automaticamente após confirmação, mas isso não foi implementado.

### Solução
Adicionar `useEffect` para abrir modal após confirmação quando `allowDownload` está ativo:

```typescript
// Auto-open download modal after confirmation (if allowed)
useEffect(() => {
  // Só abre se acabou de confirmar E download está liberado
  const shouldAutoOpen = isConfirmed && 
                         currentStep === 'confirmed' && 
                         gallery?.settings.allowDownload &&
                         localPhotos.some(p => p.isSelected);
  
  if (shouldAutoOpen && !showDownloadModal) {
    // Delay para animação de sucesso terminar
    const timer = setTimeout(() => setShowDownloadModal(true), 800);
    return () => clearTimeout(timer);
  }
}, [isConfirmed, currentStep, gallery?.settings.allowDownload]);
```

**Nota**: Precisa de flag adicional para evitar reabrir em reloads.

---

## Arquivos a Modificar

| Arquivo | Bug | Alteração |
|---------|-----|-----------|
| `supabase/functions/confirm-selection/index.ts` | Bug 1 | Adicionar suporte a `chargeType` no cálculo de extras |
| `src/pages/ClientGallery.tsx` | Bug 2, 3, 4 | Corrigir cálculo de extras, ordem de states, auto-open modal |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO CORRETO PÓS-CORREÇÃO                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Cliente seleciona fotos                                                 │
│     └─> chargeType='all_selected' → conta TODAS as fotos                    │
│     └─> chargeType='only_extras' → conta apenas extras                      │
│                                                                             │
│  2. Cliente clica "Confirmar e Pagar"                                       │
│     └─> handleConfirm() com cálculo correto de extras                       │
│                                                                             │
│  3. Edge Function processa                                                  │
│     └─> Lê chargeType das configurações                                     │
│     └─> Calcula valor correto                                               │
│     └─> Cria link de pagamento InfinitePay/MP                               │
│     └─> Retorna { requiresPayment: true, checkoutUrl: '...' }               │
│                                                                             │
│  4. onSuccess no cliente                                                    │
│     └─> Detecta checkoutUrl → setCurrentStep('payment')                     │
│     └─> Renderiza PaymentRedirect com countdown                             │
│     └─> Redireciona para checkout                                           │
│                                                                             │
│  5. Após pagamento (retorno)                                                │
│     └─> Detecta ?payment=success                                            │
│     └─> Confirma via check-payment-status                                   │
│     └─> setIsConfirmed(true) + setCurrentStep('confirmed')                  │
│     └─> Auto-abre DownloadModal (se allowDownload=true)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Seção Técnica Detalhada

### Alterações no Edge Function (confirm-selection)

**Linha ~268-272** - Adicionar leitura de `chargeType`:

```typescript
const saleMode = configuracoes?.saleSettings?.mode;
const chargeType = configuracoes?.saleSettings?.chargeType || 'only_extras';
const configuredPaymentMethod = configuracoes?.saleSettings?.paymentMethod;
```

**Linha ~211** - Corrigir cálculo de extras:

```typescript
// Calculate extras based on chargeType
const chargeType = configuracoes?.saleSettings?.chargeType || 'only_extras';

const extrasNecessarias = chargeType === 'all_selected'
  ? (selectedCount || 0)  // ALL selected photos are chargeable
  : Math.max(0, (selectedCount || 0) - (gallery.fotos_incluidas || 0));  // Only extras
```

### Alterações no ClientGallery.tsx

**Linha ~765** - Cálculo corrigido:

```typescript
const chargeType = gallery.saleSettings?.chargeType || 'only_extras';
const extrasNecessarias = chargeType === 'all_selected'
  ? selectedCount
  : Math.max(0, selectedCount - gallery.includedPhotos);
```

**Linha ~828-848** - handleConfirm corrigido:

```typescript
const handleConfirm = () => {
  const currentSelectedCount = localPhotos.filter(p => p.isSelected).length;
  const chargeType = gallery.saleSettings?.chargeType || 'only_extras';
  
  const currentExtrasNecessarias = chargeType === 'all_selected'
    ? currentSelectedCount
    : Math.max(0, currentSelectedCount - gallery.includedPhotos);
    
  const currentExtrasACobrar = Math.max(0, currentExtrasNecessarias - extrasPagasTotal);
  // ... resto do código
};
```

---

## Resultado Esperado

1. **Galerias `chargeType: 'all_selected'`** cobram corretamente TODAS as fotos selecionadas
2. **Checkout é exibido** antes da tela de confirmação quando há valor a pagar
3. **Modal de download abre automaticamente** após pagamento confirmado
4. **Sem flash de tela** entre confirmação e pagamento
