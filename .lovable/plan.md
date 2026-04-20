
# Plano: Enviar e-mail manualmente pelo modal de compartilhamento

## Objetivo

Alterar o comportamento atual para que o e-mail **não seja enviado automaticamente** ao clicar em **Compartilhar** na página/lista da galeria.

O botão **Compartilhar** continuará abrindo o modal e preparando o link público da galeria, mas o envio de e-mail só acontecerá quando o fotógrafo clicar explicitamente em um novo botão dentro do modal:

```text
Enviar e-mail
```

---

## Comportamento atual a corrigir

Hoje, ao abrir o modal `Compartilhar Galeria`, o componente faz duas coisas automaticamente:

1. chama a RPC `prepare_gallery_share`;
2. logo depois chama a Edge Function `send-email`.

Isso faz o e-mail ser enviado apenas por abrir o modal, antes do fotógrafo decidir se quer enviar por e-mail, copiar link ou WhatsApp.

---

## Novo fluxo desejado

### Ao clicar em “Compartilhar” na galeria

O sistema deve:

- abrir o modal;
- preparar/publicar a galeria com segurança;
- resolver o token público pela RPC `prepare_gallery_share`;
- montar o link público correto;
- exibir a mensagem para revisão;
- não enviar e-mail automaticamente.

### Dentro do modal

O fotógrafo terá três ações claras:

```text
Copiar Mensagem
WhatsApp
Enviar e-mail
```

E continuará tendo também:

```text
Copiar Link
```

---

## 1. Ajustar `SendGalleryModal`

Arquivo principal:

```text
src/components/SendGalleryModal.tsx
```

### Remover envio automático ao abrir

No `useEffect` de abertura do modal, manter apenas:

- `setIsPreparing(true)`;
- chamada segura para `prepare_gallery_share`;
- `setResolvedToken(result.token)`;
- tratamento de erro.

Remover dali:

- chamada automática para `supabase.functions.invoke('send-email')`;
- controle `hasEmailAttemptRef`;
- toast automático de e-mail enviado ao abrir.

### Remover envio automático no retry

No botão `Tentar novamente`, manter apenas a nova tentativa de preparar/publicar a galeria.

Não chamar `send-email` automaticamente depois do retry.

---

## 2. Criar ação manual “Enviar e-mail”

Adicionar uma função no modal:

```text
handleSendEmail
```

Responsabilidades:

- bloquear se não houver `clientLink`/token resolvido;
- bloquear se o cliente não tiver e-mail;
- respeitar configuração global de e-mails;
- respeitar configuração de e-mail de galeria;
- chamar `send-email` apenas quando o fotógrafo clicar;
- mostrar loading no botão;
- mostrar feedback amigável;
- não quebrar o fluxo se o envio falhar.

Estados novos/ajustados:

```text
isSendingEmail
emailFeedback
```

Feedback esperado:

- enviado:
  ```text
  E-mail enviado para o cliente.
  ```

- cliente sem e-mail:
  ```text
  Cliente não possui e-mail cadastrado.
  ```

- configuração geral desativada:
  ```text
  E-mails automáticos estão desativados.
  ```

- e-mail de galeria desativado:
  ```text
  Envio de e-mail de galeria está desativado.
  ```

- duplicado:
  ```text
  E-mail já enviado anteriormente.
  ```

- erro:
  ```text
  Não foi possível enviar o e-mail agora.
  ```

---

## 3. Novo botão no layout do modal

No bloco de ações, ajustar para uma grade responsiva com três botões principais:

```text
Copiar Mensagem
WhatsApp
Enviar e-mail
```

Sugestão de UI:

- Desktop: três colunas.
- Mobile: uma coluna.
- `WhatsApp` continua em destaque terracotta.
- `Enviar e-mail` usa ícone de `Mail`.
- Durante envio, mostrar spinner e texto:
  ```text
  Enviando...
  ```

Estados do botão:

### Cliente com e-mail

Botão ativo:

```text
Enviar e-mail
```

### Cliente sem e-mail

Botão desabilitado ou com estado informativo:

```text
Sem e-mail cadastrado
```

E manter orientação:

```text
Use Copiar Link ou WhatsApp para compartilhar com este cliente.
```

### E-mail já enviado

Depois de retorno `ignorado` por duplicidade, mostrar status no card inferior:

```text
E-mail já enviado anteriormente.
```

O botão pode continuar clicável para retornar o mesmo feedback, ou ficar desabilitado após a resposta. A opção mais limpa para UX é desabilitar após retorno de enviado/duplicado nesta abertura do modal.

---

## 4. Ajustar texto de status inferior

O card inferior hoje diz:

```text
Envio automático de e-mail preparado.
```

Isso fica incoerente com o novo fluxo.

Trocar para algo como:

Antes de enviar:

```text
Envie por e-mail quando quiser notificar o cliente diretamente.
```

Se não tiver e-mail:

```text
Cliente não possui e-mail cadastrado. Use Copiar Link ou WhatsApp.
```

Depois do envio:

```text
E-mail enviado para o cliente.
```

Se erro:

```text
Não foi possível enviar o e-mail agora.
```

---

## 5. Preservar segurança do token público

Não alterar a regra crítica já definida:

- o token público continua vindo da RPC `prepare_gallery_share`;
- não gerar token no frontend;
- não usar UUID interno da galeria no link do e-mail;
- enviar para `send-email` usando:
  ```text
  galleryId
  publicToken
  ```
- o link final continua sendo montado de forma segura pela Edge Function.

---

## 6. Preservar logs e idempotência

A Edge Function `send-email` já possui:

- validação de cliente;
- validação de configurações;
- logs em `email_delivery_logs`;
- idempotência por:
  ```text
  gallery_sent:{gallery_id}
  ```

Não é necessário mudar essa estrutura.

O botão manual continuará usando a mesma função, então:

- não haverá duplicidade real;
- reabrir o modal não envia automaticamente;
- clicar mais de uma vez não deve gerar envios duplicados;
- logs continuam exibindo `enviado`, `erro` e `ignorado`.

---

## 7. Ajustar configurações para refletir o novo comportamento

Arquivo:

```text
src/components/settings/EmailAutomationSettings.tsx
```

Hoje a opção aparece como:

```text
Enviar e-mail ao enviar galeria
```

Como o envio deixará de ser automático na abertura do modal, a nomenclatura pode gerar confusão.

Ajustar para algo mais claro:

```text
Permitir envio de e-mail de galeria
```

Ou:

```text
Habilitar botão de e-mail na galeria
```

Recomendação de UX:

```text
Permitir envio de e-mail de galeria
```

O toggle continua controlando a mesma configuração `emailOnGallerySent`.

Quando desativado:

- o botão de e-mail no modal pode aparecer desabilitado;
- o card inferior explica:
  ```text
  O envio de e-mail de galeria está desativado nas configurações.
  ```

---

## 8. Não alterar pagamentos nem webhooks

Este ajuste é apenas no envio manual do e-mail de galeria.

Não mexer em:

```text
infinitepay-create-link
infinitepay-webhook
asaas-webhook
asaas-gallery-webhook
mercadopago-webhook
check-payment-status
confirm-payment-manual
```

Motivo:

- a solicitação é específica do modal de compartilhamento;
- o fluxo de confirmação de pagamento deve continuar intacto;
- manter a regra do projeto de não arriscar a automação de cobrança e webhooks da InfinitePay.

---

## 9. Validação final

Após implementar, validar:

1. clicar em `Compartilhar` na galeria;
2. confirmar que o modal abre normalmente;
3. confirmar que nenhum e-mail é enviado automaticamente;
4. confirmar que o link público é gerado e exibido na mensagem;
5. clicar em `Enviar e-mail`;
6. confirmar feedback `E-mail enviado para o cliente`;
7. confirmar registro no histórico de e-mails;
8. reabrir o modal da mesma galeria e confirmar que não reenvia sozinho;
9. clicar novamente em `Enviar e-mail` e confirmar tratamento de duplicidade;
10. testar cliente sem e-mail e confirmar fallback para `Copiar Link` e `WhatsApp`;
11. testar toggle geral desativado;
12. testar toggle de e-mail de galeria desativado;
13. confirmar que `Copiar Mensagem`, `Copiar Link` e `WhatsApp` continuam funcionando;
14. rodar build TypeScript;
15. revisar visual no desktop e mobile.

## Resultado esperado

O compartilhamento fica mais controlado e previsível:

- abrir o modal não dispara e-mail;
- o fotógrafo revisa a mensagem antes;
- o e-mail só é enviado por ação explícita;
- os botões de link e WhatsApp continuam como fallback;
- logs e idempotência continuam protegendo contra duplicidade;
- pagamentos e webhooks permanecem intactos.
