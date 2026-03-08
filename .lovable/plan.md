

## Plano: Corrigir loop de redirecionamento pós-pagamento InfinitePay

### Problema identificado

Quando o cliente retorna do checkout InfinitePay com `?payment=success`, ocorre uma **corrida entre dois fluxos**:

1. **Layer 2** (useEffect linha 546): Detecta `?payment=success` e chama `check-payment-status` para confirmar o pagamento
2. **Pending Payment Screen** (linha 888): `gallery-access` retorna `pendingPayment: true` com `checkoutUrl` da cobrança ainda pendente → renderiza `PaymentRedirect` que **auto-redireciona para o checkout novamente**

O Layer 2 não tem tempo de processar antes da tela de pagamento pendente ser renderizada. Resultado: loop infinito de checkout.

### Solução

**1. Detectar retorno de pagamento ANTES de renderizar tela de pagamento pendente**

No `ClientGallery.tsx`, quando `?payment=success` está na URL:
- NÃO renderizar a tela de `PaymentRedirect` (pendingPayment)
- Mostrar uma tela de "Verificando pagamento..." enquanto `check-payment-status` processa
- Se confirmado → mostrar tela de sucesso (confirmed)
- Se não confirmado após timeout → mostrar botão para tentar novamente ou voltar ao checkout

**2. Tela de processamento de pagamento (UX aprimorada)**

Criar um estado visual intermediário com:
- Logo do estúdio
- Spinner + mensagem "Confirmando seu pagamento..."
- Animação de sucesso quando confirmado
- Transição suave para tela de confirmação

**3. Evitar re-render do PaymentRedirect no retorno**

Na condição da linha 888 (`if (galleryResponse?.pendingPayment)`), adicionar guard:
```
if (galleryResponse?.pendingPayment && !isProcessingPaymentReturn)
```

Isso impede que a tela de redirect apareça enquanto o sistema está verificando o pagamento.

### Arquivos a modificar

- `src/pages/ClientGallery.tsx`: Adicionar guard no bloco pendingPayment + criar tela de verificação de pagamento
- `src/components/PaymentRedirect.tsx`: Nenhuma alteração necessária

### Fluxo corrigido

```text
Cliente paga no InfinitePay
  → InfinitePay redireciona para /g/TOKEN?payment=success
  → Gallery detecta ?payment=success
  → Mostra "Confirmando pagamento..." (NÃO mostra PaymentRedirect)
  → check-payment-status confirma
  → Transição para tela de sucesso
  → Limpa URL params
```

