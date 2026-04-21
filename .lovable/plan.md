
# Plano: adicionar Reply-To do fotógrafo nos e-mails enviados pelo Resend

## Objetivo

Ajustar o envio de e-mails para que o cliente consiga responder naturalmente ao fotógrafo:

```text
Cliente responde o e-mail → resposta chega no e-mail do fotógrafo
```

Sem criar inbox interno, sem receber e-mails dentro do sistema e sem alterar a automação de pagamentos.

## Comportamento final

### Remetente

O campo `From` passará a ser:

```text
Lunari <contato@mail.lunarihub.com>
```

### Reply-To

Quando o fotógrafo tiver e-mail cadastrado:

```text
reply-to = e-mail do fotógrafo
```

Quando não tiver e-mail cadastrado:

```text
Enviar normalmente sem reply-to
```

Isso vale para:

- e-mail manual de galeria enviada;
- e-mail de pagamento confirmado.

---

## Diagnóstico atual

Hoje a Edge Function central de e-mails está em:

```text
supabase/functions/send-email/index.ts
```

Ela envia para o Resend usando:

```text
from: Lunari <no-reply@mail.lunarihub.com>
```

E não envia nenhum campo de resposta.

A origem mais segura para buscar o e-mail do fotógrafo é a tabela:

```text
profiles
```

Ela já possui:

```text
user_id
email
nome
```

Essa tabela é criada/atualizada no cadastro do usuário e é mais adequada do que usar dados do cliente ou confiar em valor vindo do frontend.

---

## 1. Ajustar remetente padrão

No envio centralizado por Resend, alterar o remetente fixo para:

```text
Lunari <contato@mail.lunarihub.com>
```

Manter o From centralizado em constante para não espalhar esse valor pelo código.

---

## 2. Criar helper seguro para buscar Reply-To

Adicionar uma função interna na Edge Function:

```text
getPhotographerReplyTo(supabase, userId)
```

Ela deve:

1. buscar o perfil do fotógrafo por `profiles.user_id`;
2. selecionar apenas `email`;
3. validar se o e-mail existe;
4. validar formato básico de e-mail;
5. retornar `null` se não houver e-mail válido.

Regra importante:

```text
Nunca aceitar reply-to vindo do cliente/frontend.
```

O sistema sempre resolve o e-mail do fotógrafo no backend usando `gallery.user_id` ou `payment.user_id`.

---

## 3. Atualizar função central de envio

Alterar a assinatura atual de envio:

```text
sendResendEmail(to, subject, html)
```

Para aceitar opções:

```text
sendResendEmail(to, subject, html, { replyTo })
```

No payload enviado ao Resend:

- sempre enviar `from`, `to`, `subject`, `html`;
- incluir `reply_to` somente se houver e-mail válido.

Exemplo conceitual do payload:

```text
{
  from: "Lunari <contato@mail.lunarihub.com>",
  to: ["cliente@email.com"],
  subject,
  html,
  reply_to: "fotografo@email.com"
}
```

Se `replyTo` for `null`, o campo não entra no payload.

---

## 4. Aplicar no evento “Galeria enviada”

No bloco:

```text
eventType = gallery_sent
```

Depois de validar galeria, configurações, e-mail do cliente e token público:

1. buscar o e-mail do fotógrafo usando `gallery.user_id`;
2. passar esse valor para `sendResendEmail`;
3. registrar no log metadados não sensíveis para auditoria.

Sugestão de metadata:

```text
replyToConfigured: true/false
```

Não é necessário salvar o e-mail completo do fotógrafo no log para evitar exposição desnecessária.

---

## 5. Aplicar no evento “Pagamento confirmado”

No bloco:

```text
eventType = payment_confirmed
```

Depois de validar pagamento, configurações e e-mail do cliente:

1. buscar o e-mail do fotógrafo usando `payment.user_id`;
2. passar esse valor para `sendResendEmail`;
3. registrar no log:

```text
replyToConfigured: true/false
```

Isso preserva o fluxo de webhooks: InfinitePay, Asaas, Mercado Pago, polling e confirmação manual continuam chamando a mesma função central, sem precisar alterar cada webhook.

---

## 6. Não mexer nos webhooks de pagamento

Não alterar:

```text
supabase/functions/infinitepay-webhook/index.ts
supabase/functions/infinitepay-create-link/index.ts
supabase/functions/asaas-webhook/index.ts
supabase/functions/asaas-gallery-webhook/index.ts
supabase/functions/asaas-gallery-payment/index.ts
supabase/functions/mercadopago-webhook/index.ts
supabase/functions/check-payment-status/index.ts
supabase/functions/confirm-payment-manual/index.ts
```

Motivo:

- o ponto correto de ajuste é a função central `send-email`;
- todos os fluxos de pagamento já passam por ela;
- isso reduz risco de quebrar automação de cobrança, NSU, auto-healing, fallback por UUID e webhooks.

---

## 7. Atualizar a interface de configurações

Arquivo:

```text
src/components/settings/EmailAutomationSettings.tsx
```

Atualizar o texto exibido hoje como:

```text
Remetente: no-reply@mail.lunarihub.com
```

Para algo mais claro:

```text
Remetente: contato@mail.lunarihub.com
Respostas vão para o e-mail cadastrado do fotógrafo quando disponível.
```

Isso evita confusão para o usuário e comunica o novo comportamento.

---

## 8. Segurança e escalabilidade

Regras que serão preservadas:

- não criar inbox interno;
- não salvar credenciais adicionais;
- não aceitar e-mail de resposta vindo do frontend;
- não quebrar envio caso o fotógrafo não tenha e-mail;
- não quebrar fluxo se a busca do perfil falhar;
- manter CORS em todas as respostas;
- manter idempotência por evento;
- manter logs de enviado, erro e ignorado;
- manter o link público da galeria vindo da RPC `prepare_gallery_share`;
- manter chamadas internas entre Edge Functions via `fetch` com service key.

A solução é escalável porque o reply-to é resolvido no envio, usando `user_id`, sem duplicar essa lógica nos webhooks.

---

## 9. Deploy necessário

Como haverá alteração em Edge Function, será necessário redeploy de:

```text
send-email
```

Nenhuma outra Edge Function precisa ser redeployada para esse ajuste.

---

## 10. Validação final

Após implementar, validar:

1. build TypeScript sem erros;
2. e-mail de galeria enviada com `From = contato@mail.lunarihub.com`;
3. e-mail de galeria enviada com `Reply-To = e-mail do fotógrafo`;
4. cliente sem e-mail continua não enviando;
5. fotógrafo sem e-mail em `profiles` envia sem `reply-to`;
6. pagamento confirmado envia com `Reply-To = e-mail do fotógrafo`;
7. resposta do cliente no provedor de e-mail aponta para o fotógrafo;
8. logs continuam funcionando;
9. duplicidade continua bloqueada;
10. InfinitePay continua intacto:
    - create-link;
    - webhook;
    - NSU;
    - fallback UUID;
    - auto-healing;
    - finalização de pagamento.
