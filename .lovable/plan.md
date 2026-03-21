

# Fix: "Confirmar Pago" retorna 401 Unauthorized

## Causa

A função `confirm-payment-manual` tem `verify_jwt = true` no `config.toml`. O Supabase gateway rejeita a chamada com 401 se o JWT estiver expirado. O código atual não faz refresh de sessão antes de chamar a função.

O screenshot confirma: `POST .../confirm-payment-manual 401 (Unauthorized)`.

## Correção

### `src/components/PaymentStatusCard.tsx`

Adicionar refresh proativo da sessão antes de invocar a Edge Function (mesmo padrão já usado no `handleRebill`):

```typescript
const handleConfirmPaid = async () => {
  if (!cobrancaId) { ... }
  setIsConfirming(true);
  try {
    // Refresh session to ensure fresh JWT
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      toast.error('Sessão expirada. Recarregue a página e tente novamente.');
      setIsConfirming(false);
      return;
    }

    const response = await supabase.functions.invoke('confirm-payment-manual', {
      body: { cobrancaId },
    });
    // ... rest unchanged
```

Isso é o mesmo padrão já implementado em `handleRebill` (linha ~135) no mesmo componente.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/PaymentStatusCard.tsx` | Adicionar `getSession()` antes do invoke em `handleConfirmPaid` |

