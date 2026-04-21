
# Plano: centralizar e-mails no Lunari e silenciar notificações do Asaas

## Objetivo

Evitar que o cliente receba e-mails duplicados do Asaas, deixando a comunicação principal centralizada no Lunari:

```text
Cobrança criada / pagamento confirmado → Lunari envia o e-mail
Asaas → não envia notificações de cobrança ao cliente quando possível
```

Isso deve funcionar tanto para cobranças de galerias quanto para usuários/clientes vinculados aos fluxos de pagamento internos.

## Diagnóstico

O Asaas possui notificações próprias de cobrança e confirmação. Pela API, o controle mais seguro é feito no cadastro do cliente Asaas usando:

```text
notificationDisabled: true
```

Esse campo desativa notificações de cobrança do Asaas para aquele cliente.

Também existe controle em cobranças para envio por Correios:

```text
postalService: false
```

O sistema hoje cria/atualiza clientes e cobranças Asaas em alguns pontos, mas não está enviando esses campos. Por isso o Asaas pode continuar mandando e-mails próprios.

## Comportamento esperado

Quando o Lunari criar ou localizar um cliente no Asaas:

- definir `notificationDisabled: true`;
- manter o e-mail do cliente cadastrado no Asaas quando necessário para cartão, antifraude, recibo e dados do pagador;
- não depender do Asaas para comunicar o cliente;
- deixar o envio de e-mails de galeria e confirmação centralizado na função `send-email` do Lunari.

Quando o Lunari criar uma cobrança no Asaas:

- adicionar `postalService: false`;
- manter PIX, cartão e boleto funcionando normalmente;
- manter webhooks e confirmação de pagamento intactos.

Observação importante: isso desativa notificações de cobrança do Asaas configuráveis via API. E-mails obrigatórios, transacionais internos ou exigidos pelo próprio provedor podem não ser totalmente bloqueáveis se forem impostos pelo Asaas.

---

## 1. Adicionar preferência de centralização nas configurações Asaas

Arquivos:

```text
src/hooks/usePaymentIntegration.ts
src/components/settings/PaymentSettings.tsx
src/components/settings/PaymentConfigDrawer.tsx
src/utils/paymentSettingsContext.ts
```

Criar uma nova configuração no `dados_extras` do Asaas:

```text
centralizarEmailsLunari: boolean
```

Padrão recomendado:

```text
true
```

Na interface do Asaas, adicionar um card/toggle claro:

```text
Centralizar e-mails no Lunari
```

Descrição:

```text
Quando ativo, o Lunari tenta desativar notificações de cobrança do Asaas para evitar e-mails duplicados. Os e-mails de galeria e pagamento confirmado continuam sendo enviados pelo Lunari.
```

UX recomendada:

- deixar ativado por padrão;
- mostrar como “Recomendado”;
- explicar que o Asaas ainda pode enviar mensagens obrigatórias do próprio provedor;
- salvar com toast de sucesso.

---

## 2. Desativar notificações ao criar clientes Asaas da galeria

Arquivo:

```text
supabase/functions/asaas-gallery-payment/index.ts
```

Ajustar todos os pontos de criação de cliente Asaas:

```text
POST /v3/customers
```

Para incluir:

```text
notificationDisabled: true
```

quando `centralizarEmailsLunari !== false`.

Pontos a cobrir:

- cliente criado a partir de `clienteId`;
- cliente genérico fallback;
- qualquer criação usada por cobrança PIX/cartão/boleto da galeria.

---

## 3. Atualizar clientes Asaas já existentes quando encontrados

Arquivo:

```text
supabase/functions/asaas-gallery-payment/index.ts
```

Hoje o sistema procura cliente por:

- `externalReference`;
- fallback por e-mail.

Quando encontrar um cliente Asaas existente, atualizar também:

```text
notificationDisabled: true
```

junto com possíveis atualizações de nome ou `externalReference`.

Isso resolve gradualmente clientes já criados anteriormente: na próxima cobrança, o Lunari corrige a configuração no Asaas sem exigir ação manual do fotógrafo.

---

## 4. Desativar notificações nos clientes Asaas dos usuários Lunari

Arquivos:

```text
supabase/functions/asaas-create-customer/index.ts
supabase/functions/asaas-create-payment/index.ts
```

Aplicar a mesma regra nos fluxos em que o próprio usuário/fotógrafo é cliente do Asaas para pagar planos, créditos ou assinaturas do Lunari.

### Em `asaas-create-customer`

Ao criar cliente:

```text
notificationDisabled: true
```

Ao validar cliente existente:

- se existir no Asaas, fazer uma atualização silenciosa para garantir `notificationDisabled: true`;
- se falhar essa atualização, não bloquear o fluxo de pagamento, apenas registrar log.

### Em `asaas-create-payment`

No auto-healing que recria cliente quando o customer antigo está inválido:

```text
notificationDisabled: true
```

---

## 5. Garantir cobranças sem envio por Correios

Arquivos principais:

```text
supabase/functions/asaas-gallery-payment/index.ts
supabase/functions/asaas-create-payment/index.ts
supabase/functions/asaas-create-subscription/index.ts
supabase/functions/asaas-upgrade-subscription/index.ts
```

Adicionar aos payloads de cobrança via `/v3/payments`:

```text
postalService: false
```

Onde houver assinatura via `/v3/subscriptions`, manter foco em `notificationDisabled` no cliente, porque a documentação de assinatura não expõe o mesmo controle de envio por Correios no payload da assinatura.

Cobrir:

- cobrança de galeria;
- compra de créditos Select;
- assinatura anual via pagamento único;
- upgrade proporcional;
- upgrade parcelado;
- pagamentos criados durante auto-healing.

---

## 6. Manter e-mails Lunari como fonte principal

Arquivo já ajustado anteriormente:

```text
supabase/functions/send-email/index.ts
```

Não mudar a arquitetura principal, apenas garantir que ela continua sendo a fonte oficial para:

- e-mail de galeria enviada;
- e-mail de pagamento confirmado;
- `From: contato@mail.lunarihub.com`;
- `Reply-To: e-mail do fotógrafo`, quando existir.

Assim, quando o cliente responder:

```text
cliente responde → fotógrafo recebe
```

---

## 7. Não quebrar pagamentos, webhooks nem InfinitePay

Não alterar a lógica de confirmação em:

```text
supabase/functions/infinitepay-create-link
supabase/functions/infinitepay-webhook
supabase/functions/asaas-webhook
supabase/functions/asaas-gallery-webhook
supabase/functions/check-payment-status
supabase/functions/confirm-payment-manual
```

As funções de webhook Asaas devem continuar processando eventos normalmente. O ajuste é somente no momento de criação/atualização de clientes e cobranças.

A regra do projeto será respeitada: revisar que `infinitepay-create-link` e `infinitepay-webhook` permanecem intactos e não ficam desatualizados.

---

## 8. Tratamento de falhas

Se a tentativa de atualizar `notificationDisabled` falhar:

- não bloquear a criação da cobrança;
- registrar `console.warn`;
- continuar o fluxo de pagamento;
- evitar erro para o cliente final.

Motivo: uma falha pontual ao silenciar notificação não pode impedir uma venda ou assinatura.

---

## 9. Validação final

Após implementar, validar:

1. configurar Asaas com “Centralizar e-mails no Lunari” ativo;
2. criar cobrança de galeria por PIX;
3. confirmar que o cliente Asaas é criado com notificações desativadas;
4. criar cobrança de galeria por cartão;
5. confirmar que cartão continua funcionando;
6. testar cliente Asaas já existente e confirmar que ele é atualizado;
7. testar cobrança fallback sem `clienteId`;
8. criar compra de créditos via Asaas;
9. criar assinatura via Asaas;
10. testar upgrade com cobrança proporcional;
11. confirmar que e-mail de pagamento confirmado continua vindo pelo Lunari;
12. confirmar que e-mail manual de galeria continua vindo pelo Lunari;
13. confirmar que o `Reply-To` continua apontando para o fotógrafo;
14. revisar que webhooks Asaas continuam intactos;
15. revisar que InfinitePay create-link e webhook não foram alterados;
16. rodar build TypeScript;
17. redeploy das Edge Functions Asaas alteradas.

## Resultado esperado

O fluxo fica centralizado e mais profissional:

- menos risco de e-mails duplicados;
- Asaas continua processando pagamentos;
- Lunari controla comunicação com cliente;
- fotógrafo recebe respostas dos clientes;
- cobrança, confirmação e logs continuam funcionando;
- usuários atuais são corrigidos gradualmente quando novos pagamentos forem criados.
