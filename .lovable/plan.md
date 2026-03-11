

## Correção: Flash de "Galeria não encontrada" no retorno de pagamento

### Causa raiz

Quando o cliente retorna do InfinitePay com `?payment=success`:

1. `isProcessingPaymentReturn` é setado para `true`
2. A URL é limpa e `check-payment-status` é chamado
3. Ao confirmar, `refetchGallery()` é chamado
4. Durante o refetch, a resposta do `gallery-access` muda de estado (de `pendingPayment` para `finalized`), e `gallery` (transformedGallery) pode ser momentaneamente `null`
5. `isProcessingPaymentReturn = true` faz o código pular a tela de pending payment (linha 940)
6. O código cai na verificação da linha 1037: `if (galleryError || !gallery)` → mostra "Galeria não encontrada"

### Correção

Na linha 1037 de `ClientGallery.tsx`, adicionar `isProcessingPaymentReturn` como guard. Se estamos processando retorno de pagamento e `gallery` é null, mostrar um loading em vez de erro:

```typescript
// Error state - gallery not found
// BUT: if processing payment return, show loading instead of error
if (isProcessingPaymentReturn && !gallery) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background" style={themeStyles}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Finalizando...</p>
    </div>
  );
}

if (galleryError || !gallery) {
  // existing error UI...
}
```

### Arquivo modificado

1. **`src/pages/ClientGallery.tsx`** (linha ~1036): Inserir guard de loading antes do check de erro, protegendo contra o flash durante o refetch pós-pagamento

