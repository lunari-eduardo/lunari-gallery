

# Diagnóstico: Bônus de indicação não concedido via Asaas

## Problema raiz

O `grant_referral_select_bonus` só é chamado nos fluxos do **Mercado Pago** (`mercadopago-credits-payment` e `mercadopago-webhook`), mas **nunca no fluxo do Asaas**.

O usuário `emailtesterefe@gmail.com` comprou créditos via **Asaas** (edge function `asaas-create-payment`), que processa o pagamento e adiciona créditos, mas não chama o bônus de indicação.

Confirmação no banco:
- Referral existe: `emailtesterefe` → referido por `eduardo` ✅
- Compra aprovada: 5.000 créditos via Asaas ✅
- `select_bonus_granted` = `false` ❌ (nunca foi chamado)
- Nenhuma chamada ao `grant_referral_select_bonus` nos logs do Asaas

## Correção

### 1. `supabase/functions/asaas-create-payment/index.ts`
Após o bloco que adiciona créditos Select (linha ~343), adicionar chamada ao `grant_referral_select_bonus`:

```typescript
// Após purchase_credits bem-sucedido (linha 343)
try {
  const { data: bonusGranted, error: bonusError } = await adminClient.rpc('grant_referral_select_bonus', {
    _referred_user_id: userId,
  });
  if (bonusError) {
    console.warn('Referral bonus error (non-fatal):', bonusError.message);
  } else if (bonusGranted) {
    console.log(`[${requestId}] 🎁 Referral Select bonus granted for user:`, userId);
  }
} catch (e) {
  console.warn('Referral bonus exception (non-fatal):', e);
}
```

### 2. `supabase/functions/asaas-webhook/index.ts`
O webhook Asaas também pode confirmar pagamentos de créditos (PIX/boleto). Verificar se há tratamento de `credit_purchases` no webhook e adicionar a mesma chamada.

### 3. Correção manual dos dados de teste
Executar SQL para conceder retroativamente o bônus para ambos os usuários de teste:
- +1.000 créditos para `eduardo` (referrer)
- +1.000 créditos para `emailtesterefe` (referred)
- Marcar `select_bonus_granted = true`

### 4. Re-deploy
Deploy das edge functions `asaas-create-payment` e `asaas-webhook` após as alterações.

---

**Resumo**: 2 edge functions para editar + 1 SQL manual + deploy. Mudança cirúrgica, ~15 linhas de código.

