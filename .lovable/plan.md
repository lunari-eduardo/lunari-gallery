# Mercado Pago Checkout Transparente - Implementação Concluída

## Status: ✅ IMPLEMENTADO

---

## Resumo

Sistema de compra de créditos via Mercado Pago Checkout Transparente implementado com:
- **PIX**: QR Code e Copia e Cola
- **Cartão de Crédito**: Pagamento à vista via tokenização segura
- **Webhook Global**: Confirmação automática
- **Polling**: Fallback para detecção de pagamento

---

## Pacotes de Créditos

| Créditos | Preço   | Nome       |
|----------|---------|------------|
| 2.000    | R$ 19   | Starter    |
| 5.000    | R$ 39   | Basic      |
| 10.000   | R$ 69   | Pro        |
| 20.000   | R$ 99   | Enterprise |

---

## Arquivos Criados

### Banco de Dados
- `gallery_credit_packages` - Pacotes disponíveis para compra
- `credit_purchases` - Histórico de compras
- `purchase_credits()` - RPC para adicionar créditos atomicamente

### Edge Functions
| Função | Descrição |
|--------|-----------|
| `mercadopago-credits-payment` | Cria pagamento PIX ou Cartão |
| `mercadopago-webhook` | Processa notificações do MP |
| `mercadopago-check-payment` | Polling de status |
| `mercadopago-public-key` | Retorna public key para frontend |

### Frontend
| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useCreditPackages.ts` | Hook de pacotes e pagamentos |
| `src/components/credits/CreditPackageCard.tsx` | Card de pacote |
| `src/components/credits/CreditCheckoutModal.tsx` | Modal de checkout |
| `src/components/credits/PixPaymentDisplay.tsx` | Exibição QR Code PIX |
| `src/components/credits/CardPaymentForm.tsx` | Formulário de cartão |
| `src/pages/Credits.tsx` | Página de créditos atualizada |

---

## Configuração Necessária

### 1. Secrets Configurados ✅
- `MERCADOPAGO_ACCESS_TOKEN` - Token de acesso (produção)
- `MERCADOPAGO_PUBLIC_KEY` - Chave pública (produção)

### 2. Webhook no Painel Mercado Pago ⚠️ PENDENTE

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Selecione sua aplicação
3. Vá em **Webhooks** → **Configurar notificações**
4. Configure:
   - **URL**: `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/mercadopago-webhook`
   - **Eventos**: Marque APENAS:
     - `payment.created`
     - `payment.updated`
   - **Modo**: Produção
5. Salvar

### 3. Configurações NÃO Utilizadas (Confirmação)

| Configuração | Status |
|--------------|--------|
| `back_urls` | ❌ NÃO USAR - checkout interno |
| `notification_url` por pagamento | ❌ NÃO USAR - webhook global |
| Redirect após pagamento | ❌ NÃO USAR - apenas polling |

---

## Fluxo de Pagamento

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE COMPRA DE CRÉDITOS                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Usuário acessa /credits e escolhe pacote                                 │
│     └── Clica no card do pacote desejado                                     │
│                                                                              │
│  2. Modal de checkout abre com tabs PIX/Cartão                               │
│                                                                              │
│  3A. PIX:                                                                    │
│      └── Clica "Gerar PIX"                                                   │
│      └── mercadopago-credits-payment cria pagamento                          │
│      └── Exibe QR Code + Copia e Cola                                        │
│      └── Polling automático a cada 5s                                        │
│                                                                              │
│  3B. Cartão:                                                                 │
│      └── Preenche dados do cartão                                            │
│      └── MercadoPago.js tokeniza (dados seguros)                             │
│      └── mercadopago-credits-payment processa                                │
│      └── Se approved: créditos adicionados imediatamente                     │
│                                                                              │
│  4. Confirmação via Webhook (PIX) ou Polling                                 │
│     └── mercadopago-webhook recebe payment.updated                           │
│     └── Chama RPC purchase_credits                                           │
│     └── Atualiza photographer_accounts e credit_ledger                       │
│                                                                              │
│  5. Polling detecta aprovação → Modal mostra sucesso                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Segurança

| Camada | Proteção |
|--------|----------|
| Access Token | Apenas em Supabase Secrets (backend) |
| Public Key | Via Edge Function (não hardcoded) |
| Cartão | Tokenizado via MercadoPago.js (dados nunca chegam ao servidor) |
| Webhook | Logs imediatos + verificação via API |
| RLS | Usuários só veem próprias compras |
| Idempotência | Verificação de status antes de processar |

---

## Testes

Para testar em produção com uso interno:
1. Use o menor pacote (R$ 19 - 2.000 créditos)
2. Teste PIX com sua conta bancária pessoal
3. Teste cartão de crédito pessoal
4. Verifique se créditos aparecem na página /credits
5. Confira o histórico de compras

---

## Troubleshooting

### Pagamento não confirmado
1. Verifique logs da Edge Function: https://supabase.com/dashboard/project/tlnjspsywycbudhewsfv/functions/mercadopago-webhook/logs
2. Clique em "Já paguei, verificar status" no modal PIX
3. Confira webhook_logs no banco de dados

### Cartão rejeitado
1. Verifique se os dados estão corretos
2. Confira se o cartão tem limite disponível
3. Tente outro cartão

### Public Key não carrega
1. Verifique se o secret MERCADOPAGO_PUBLIC_KEY está configurado
2. Teste a edge function: `curl https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/mercadopago-public-key`
