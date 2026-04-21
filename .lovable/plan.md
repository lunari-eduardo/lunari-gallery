
# Verificação do que aconteceu e plano de correção

## Constatação

O plano de **centralizar e-mails no Lunari e silenciar notificações do Asaas** não foi implementado no código.

Ao verificar o projeto em modo somente leitura, encontrei:

- não existe `centralizarEmailsLunari` no frontend;
- não existe `notificationDisabled` nas chamadas de criação/atualização de clientes Asaas;
- não existe `postalService: false` nos payloads de cobrança Asaas;
- o arquivo `.lovable/plan.md` ainda contém o plano anterior de **toasts nas configurações**, não o plano atual do Asaas;
- a imagem mostra a interface presa em um estado de “Waiting for approval” com um plano incompleto, indicando que a execução foi interrompida/voltou para modo de aprovação antes de aplicar as alterações.

Ou seja: o sistema não chegou a modificar os arquivos necessários. O plano exibido ficou incompleto e não houve implementação parcial relevante para essa demanda.

## Estado atual dos pontos críticos

### `supabase/functions/asaas-gallery-payment/index.ts`

Hoje cria e atualiza clientes Asaas sem:

```text
notificationDisabled: true
```

E cria cobranças sem:

```text
postalService: false
```

Pontos encontrados:

- busca cliente por `externalReference`;
- busca fallback por e-mail;
- atualiza nome/externalReference;
- cria cliente novo;
- cria cliente genérico fallback;
- cria cobrança em `/v3/payments`.

Todos esses pontos precisam receber a blindagem contra notificações do Asaas.

### `supabase/functions/asaas-create-customer/index.ts`

Hoje cria o cliente Asaas do próprio usuário/fotógrafo sem:

```text
notificationDisabled: true
```

E quando valida cliente existente, apenas retorna o ID, sem tentar corrigir notificações para clientes antigos.

### `supabase/functions/asaas-create-payment/index.ts`

Hoje cria cobranças internas via Asaas sem:

```text
postalService: false
```

E no auto-healing que recria cliente Asaas, também não inclui:

```text
notificationDisabled: true
```

### `supabase/functions/asaas-create-subscription/index.ts`

Hoje cria assinatura Asaas sem uma etapa prévia para garantir que o cliente está com notificações desativadas.

### `supabase/functions/asaas-upgrade-subscription/index.ts`

Hoje cria cobranças proporcionais, parcelamentos e novas assinaturas Asaas sem padronizar:

```text
postalService: false
```

E sem garantir que o cliente Asaas existente esteja com notificações desativadas.

### InfinitePay

Não encontrei alteração feita nas funções InfinitePay nessa tentativa. A regra do projeto permanece: não mexer em `infinitepay-create-link` nem `infinitepay-webhook` para essa correção.

---

# Plano revisado: implementar centralização de e-mails no Lunari sem deixar o fluxo incompleto

## Objetivo

Evitar e-mails duplicados enviados diretamente pelo Asaas, mantendo a comunicação principal centralizada no Lunari.

Fluxo desejado:

```text
Lunari cria cliente/cobrança Asaas
Asaas processa pagamento
Lunari envia e-mail de galeria/pagamento confirmado
Cliente responde
Fotógrafo recebe a resposta
```

## 1. Adicionar configuração `centralizarEmailsLunari`

Arquivos:

```text
src/hooks/usePaymentIntegration.ts
src/components/settings/PaymentSettings.tsx
src/components/settings/PaymentConfigDrawer.tsx
src/utils/paymentSettingsContext.ts
```

Adicionar ao tipo `AsaasData`:

```text
centralizarEmailsLunari?: boolean
```

Padrão:

```text
true
```

Atualizar a lista de campos migráveis do Asaas para incluir:

```text
centralizarEmailsLunari
```

Assim a configuração fica isolada por contexto:

```text
gallery_settings.centralizarEmailsLunari
gestao_settings.centralizarEmailsLunari
```

e também sincronizada no root para compatibilidade com Edge Functions.

## 2. Adicionar UI clara no drawer do Asaas

No drawer de configuração Asaas, adicionar um card/toggle:

```text
Centralizar e-mails no Lunari
```

Descrição sugerida:

```text
Recomendado. Quando ativo, o Lunari tenta desativar notificações de cobrança do Asaas para evitar e-mails duplicados. Os e-mails de galeria e pagamento confirmado continuam sendo enviados pelo Lunari.
```

Comportamento:

- ativo por padrão;
- salvamento junto das demais configurações Asaas;
- toast de sucesso já seguindo o padrão recente das configurações;
- explicar que o Asaas ainda pode enviar mensagens obrigatórias do próprio provedor, se houver alguma exigência interna.

## 3. Criar helper seguro nas Edge Functions Asaas

Em cada função Asaas afetada, usar uma lógica simples e explícita:

```text
centralizarEmailsLunari !== false
```

Isso mantém compatibilidade com usuários antigos, porque ausência do campo significa “ativo”.

Criar helper conceitual onde fizer sentido:

```text
shouldCentralizeAsaasEmails(settings)
```

Resultado:

- se `centralizarEmailsLunari` for `false`, manter comportamento antigo;
- se for `true` ou inexistente, aplicar silenciamento Asaas.

## 4. Silenciar notificações em clientes Asaas de galeria

Arquivo:

```text
supabase/functions/asaas-gallery-payment/index.ts
```

Alterações:

### Ao criar cliente Asaas com `clienteId`

Adicionar:

```text
notificationDisabled: true
```

quando a centralização estiver ativa.

### Ao criar cliente fallback

Adicionar:

```text
notificationDisabled: true
```

quando a centralização estiver ativa.

### Ao encontrar cliente existente por `externalReference`

Fazer atualização silenciosa:

```text
PUT /v3/customers/{id}
{
  name,
  notificationDisabled: true
}
```

quando a centralização estiver ativa.

### Ao encontrar cliente por e-mail

Atualizar:

```text
externalReference
name
notificationDisabled: true
```

quando necessário.

Se a atualização falhar:

- registrar `console.warn`;
- não bloquear a cobrança.

## 5. Silenciar notificações em clientes Asaas internos

Arquivo:

```text
supabase/functions/asaas-create-customer/index.ts
```

Alterações:

### Ao validar cliente existente

Se o cliente existir no Asaas, tentar atualizar:

```text
notificationDisabled: true
```

Antes de retornar o ID.

Falha nessa atualização não deve bloquear o checkout.

### Ao criar cliente novo

Adicionar:

```text
notificationDisabled: true
```

## 6. Ajustar auto-healing de clientes internos

Arquivo:

```text
supabase/functions/asaas-create-payment/index.ts
```

No trecho que recria customer inválido, adicionar:

```text
notificationDisabled: true
```

Também adicionar nas cobranças criadas por `/v3/payments`:

```text
postalService: false
```

## 7. Ajustar cobranças de galeria

Arquivo:

```text
supabase/functions/asaas-gallery-payment/index.ts
```

No payload de `/v3/payments`, adicionar:

```text
postalService: false
```

Isso deve valer para:

- PIX;
- cartão;
- boleto.

## 8. Ajustar assinaturas e upgrades internos

Arquivos:

```text
supabase/functions/asaas-create-subscription/index.ts
supabase/functions/asaas-upgrade-subscription/index.ts
```

Aplicar:

- garantir `notificationDisabled: true` no customer existente antes de criar assinatura/cobrança;
- adicionar `postalService: false` nos payloads que usam `/v3/payments`.

Para `/v3/subscriptions`, manter o foco em silenciar o customer, porque o controle documentado e mais confiável para notificações é no cliente Asaas.

## 9. Não alterar webhooks e InfinitePay

Não modificar:

```text
supabase/functions/infinitepay-create-link/index.ts
supabase/functions/infinitepay-webhook/index.ts
supabase/functions/asaas-webhook/index.ts
supabase/functions/asaas-gallery-webhook/index.ts
supabase/functions/check-payment-status/index.ts
supabase/functions/confirm-payment-manual/index.ts
```

Motivo:

- o problema está na criação/atualização de clientes e cobranças;
- webhooks devem continuar apenas confirmando pagamento;
- InfinitePay precisa permanecer intacto para não quebrar automação de cobrança e auto-healing.

## 10. Validação após implementação

Validar:

1. o projeto compila sem erro TypeScript;
2. a configuração Asaas exibe o novo toggle;
3. salvar Asaas preserva configurações antigas e adiciona `centralizarEmailsLunari`;
4. nova cobrança de galeria cria/atualiza customer com `notificationDisabled: true`;
5. cobrança de galeria envia `/v3/payments` com `postalService: false`;
6. cliente Asaas antigo é corrigido na próxima cobrança;
7. compra de créditos via Asaas usa customer silenciado;
8. assinatura Asaas usa customer silenciado;
9. upgrade Asaas usa customer silenciado;
10. e-mails do Lunari continuam funcionando via `send-email`;
11. `Reply-To` continua apontando para o fotógrafo quando houver e-mail cadastrado;
12. webhooks Asaas continuam sem alteração;
13. `infinitepay-create-link` e `infinitepay-webhook` continuam sem alteração.

## Resultado esperado

Depois da implementação real:

- o Asaas deixa de enviar notificações de cobrança sempre que a API permitir;
- o Lunari permanece como canal principal de comunicação;
- clientes recebem menos e-mails duplicados;
- fotógrafos recebem respostas diretamente;
- usuários antigos são corrigidos gradualmente quando novos pagamentos forem criados;
- cobranças, confirmações, webhooks e InfinitePay permanecem estáveis.
