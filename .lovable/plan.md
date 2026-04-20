
# Plano ajustado: E-mails automáticos com Resend + melhor UX de envio

## Direção confirmada

Usaremos **Resend** com o domínio já configurado:

```text
mail.lunarihub.com
```

Remetente padrão:

```text
no-reply@mail.lunarihub.com
```

Não vamos configurar domínio de e-mail pelo sistema interno do Lovable, porque o envio será feito via Resend usando o domínio que você já configurou no Cloudflare e no Resend.

---

## 1. Configuração padrão crítica

### Ajuste no banco

Adicionar as configurações de e-mail em `gallery_settings` com padrão ativo:

```text
email_sending_enabled default true
email_on_gallery_sent default true
email_on_payment_confirmed default true
```

Também aplicar para usuários existentes:

- se a coluna ainda não existir, criar com `default true`;
- popular registros existentes com `true`;
- manter `not null` para evitar comportamento ambíguo.

### Comportamento esperado

Por padrão, o produto já funciona assim que o fotógrafo envia uma galeria.

O fotógrafo não precisa descobrir que precisa ligar algo escondido para o e-mail funcionar.

---

## 2. UI de configurações

Criar uma seção em:

```text
Configurações > Personalização > Comunicação
```

Nova área:

```text
E-mails automáticos
```

Controles:

1. Toggle geral:
   - “Ativar envio de e-mails”

2. Toggles específicos:
   - “Enviar e-mail ao enviar galeria”
   - “Enviar e-mail ao confirmar pagamento”

3. Aviso obrigatório na UI:

```text
Você pode desativar os e-mails a qualquer momento.
```

4. Informação do remetente:

```text
Remetente: no-reply@mail.lunarihub.com
```

Quando o toggle geral estiver desativado:

- os toggles específicos ficam visualmente dependentes/desabilitados ou com menor destaque;
- nenhum e-mail automático será enviado;
- o usuário entende claramente que desligou todos os envios.

---

## 3. Função central de envio com Resend

Criar uma função central reutilizável para envio de e-mails via Resend.

Responsabilidades:

- validar evento;
- buscar dados reais no banco;
- respeitar configurações do fotógrafo;
- validar se o cliente tem e-mail;
- garantir idempotência para evitar duplicidade;
- montar HTML;
- enviar via Resend;
- registrar log;
- retornar um resultado simples para a UI.

Eventos suportados inicialmente:

```text
gallery_sent
payment_confirmed
```

A chave do Resend ficará somente em segredo seguro do backend, nunca no frontend.

Segredos esperados:

```text
RESEND_API_KEY
```

Se a chave estiver ausente ou inválida:

- não quebrar o fluxo;
- registrar log como erro;
- mostrar mensagem amigável quando o envio for acionado pela UI.

---

## 4. Logs essenciais de envio

Criar tabela de logs própria para os e-mails do produto.

Campos principais:

```text
id
user_id
cliente_id
cliente_nome
cliente_email
event_type
status
gallery_id
payment_id
idempotency_key
resend_message_id
subject
friendly_message
error_message
metadata
created_at
updated_at
```

### Status

```text
enviado
erro
ignorado
```

### Visual na UI

Na área de logs recentes:

- `enviado` → verde
- `erro` → vermelho
- `ignorado` → cinza

### Mensagens amigáveis

Não mostrar erro técnico bruto para o usuário.

Exemplos:

```text
Cliente sem e-mail cadastrado
Envio automático desativado
E-mail já enviado anteriormente
Falha ao enviar pelo provedor
Configuração do Resend ausente
```

O erro técnico completo pode ficar no campo interno `error_message`/`metadata`, mas a interface mostra apenas o motivo simples.

---

## 5. Prevenção de envios duplicados

Usar chave única por evento lógico:

```text
gallery_sent:{gallery_id}
payment_confirmed:{payment_id}
```

Regras:

- se já existe envio `enviado` com a mesma chave, não reenviar;
- registrar/retornar como `ignorado` com motivo amigável;
- webhooks repetidos, polling e auto-healing não disparam e-mail duplicado;
- abrir a modal novamente não reenviará a mesma galeria.

---

## 6. Evento 1: envio de galeria

### Quando disparar

Depois que a galeria for preparada/publicada com sucesso pela RPC atual:

```text
prepare_gallery_share
```

A função só poderá enviar e-mail quando existir:

- token público válido retornado pela RPC;
- link público gerado a partir desse token;
- cliente com e-mail;
- envio global ativado;
- opção “Enviar e-mail ao enviar galeria” ativada;
- evento ainda não enviado.

### Link da galeria: regra crítica

O e-mail deve usar apenas o link público correto:

```text
https://gallery.lunarihub.com/g/{publicToken}
```

Regras:

- nunca gerar token no cliente;
- nunca usar UUID interno da galeria;
- sempre usar o token retornado por `prepare_gallery_share`;
- se não houver token válido, não enviar;
- registrar como erro/ignorado sem quebrar o compartilhamento.

Isso garante que o botão do e-mail abre direto a galeria correta.

### Feedback imediato na modal

Na `SendGalleryModal`, após preparar a galeria:

Se enviou:

```text
E-mail enviado para o cliente.
```

Se não tem e-mail:

```text
Cliente não possui e-mail cadastrado.
```

Se envio global está desativado:

```text
E-mails automáticos estão desativados.
```

Se já foi enviado antes:

```text
E-mail já enviado anteriormente.
```

Se falhou:

```text
Não foi possível enviar o e-mail agora.
```

O fluxo de compartilhar continua funcionando em todos os casos.

### Fallback quando não houver e-mail

Se o cliente não tiver e-mail cadastrado, destacar ações alternativas:

- `Copiar link`
- `Enviar via WhatsApp`

Essas ações já existem na modal, mas serão reposicionadas/realçadas para deixar claro que este é o caminho recomendado quando não há e-mail.

O botão “Enviar por Email — Em breve” deixa de existir nesse formato e vira um status real do envio automático.

---

## 7. Template de e-mail: galeria enviada

### Objetivo

Aumentar abertura, clique e conversão para seleção/compra de fotos extras.

### Novo tom do template

Trocar mensagem fraca como:

```text
Sua galeria está pronta
```

Por:

```text
Suas fotos já estão prontas ✨
```

Texto principal:

```text
Olá, {cliente}

Suas fotos já estão prontas ✨

Você já pode visualizar, escolher suas favoritas e garantir suas fotos.

Clique no botão abaixo para acessar sua galeria.
```

CTA:

```text
Acessar minha galeria
```

Rodapé:

```text
Com carinho,
{nome_do_estudio}
```

Se a galeria for privada e houver senha:

```text
Senha de acesso: {senha}
```

### Layout

- HTML responsivo;
- fundo branco;
- card central limpo;
- tipografia simples;
- botão destacado;
- boa leitura no celular;
- sem excesso visual;
- identidade neutra, com possibilidade futura de usar logo/nome do estúdio.

---

## 8. Evento 2: confirmação de pagamento

### Quando disparar

Após confirmação real do pagamento.

Pontos a revisar:

```text
supabase/functions/check-payment-status/index.ts
supabase/functions/infinitepay-webhook/index.ts
supabase/functions/infinitepay-create-link/index.ts
supabase/functions/asaas-webhook/index.ts
supabase/functions/asaas-gallery-payment/index.ts
supabase/functions/mercadopago-webhook/index.ts
supabase/functions/confirm-payment-manual/index.ts
```

Regra principal:

- o e-mail deve ser chamado apenas depois que o pagamento for finalizado/sincronizado com sucesso;
- a chamada de e-mail sempre fica protegida por `try/catch`;
- falha de e-mail nunca desfaz pagamento;
- falha de e-mail nunca faz webhook retornar erro quando o pagamento já foi processado.

### Cuidado obrigatório com InfinitePay

Ao tocar nos fluxos de pagamento, revisar especialmente:

```text
supabase/functions/infinitepay-create-link/index.ts
supabase/functions/infinitepay-webhook/index.ts
```

Preservar as regras existentes:

- não adicionar validação JWT no webhook;
- não quebrar `verify_jwt = false`;
- manter busca por `ip_order_nsu` primeiro;
- manter fallback por UUID;
- manter chamada para `finalize_gallery_payment`;
- manter auto-healing;
- não alterar automação de cobrança de clientes.

A integração de e-mail entra como efeito colateral seguro, nunca como parte crítica da confirmação financeira.

### Conteúdo do e-mail de pagamento

Assunto sugerido:

```text
Pagamento confirmado
```

Conteúdo:

```text
Olá, {cliente}

Recebemos a confirmação do seu pagamento.

Valor pago: R$ {valor}
Forma de pagamento: {forma}
Data: {data}
Descrição: {descricao}
Status: Confirmado
```

CTA opcional:

```text
Acessar galeria
```

Se houver galeria vinculada e token público disponível, incluir botão para voltar à galeria.

---

## 9. Logs recentes no frontend

Criar componente para logs recentes dentro de Comunicação:

```text
Histórico de e-mails
```

Exibir:

```text
Tipo
Cliente
E-mail
Status
Data
Motivo
```

Exemplo:

```text
Galeria enviada        Maria        enviado    Hoje, 14:32
Pagamento confirmado  João         erro       Falha ao enviar pelo provedor
Galeria enviada        Ana          ignorado   Cliente sem e-mail cadastrado
```

UX:

- visual compacto;
- cores claras por status;
- mostrar no máximo os últimos registros;
- permitir expandir erro simples se necessário;
- sem expor stack trace ou detalhes técnicos.

---

## 10. Tipos, hooks e settings

Atualizar:

```text
src/types/gallery.ts
src/hooks/useGallerySettings.ts
src/hooks/useSettings.ts
```

Adicionar ao `GlobalSettings`:

```text
emailSendingEnabled
emailOnGallerySent
emailOnPaymentConfirmed
```

Criar hook para logs:

```text
src/hooks/useEmailLogs.ts
```

Criar componente:

```text
src/components/settings/EmailAutomationSettings.tsx
```

Integrar em:

```text
src/components/settings/PersonalizationSettings.tsx
```

---

## 11. Segurança e regras de não envio

Nunca enviar quando:

- cliente não possui e-mail;
- envio global está desativado;
- opção específica está desativada;
- evento já foi enviado;
- link público da galeria não está pronto;
- token público não existe ou não é válido;
- pagamento ainda não foi confirmado;
- Resend falha.

Em todos esses casos:

- não quebrar o fluxo principal;
- registrar log;
- mostrar feedback amigável quando o usuário estiver na modal.

---

## 12. Estrutura preparada para futuro

A função central e os logs ficarão preparados para novos eventos:

```text
selection_reminder
selection_abandoned
payment_reminder
gallery_expiring
```

Mas estes não serão implementados agora.

---

## 13. Arquivos previstos

### Banco

```text
supabase/migrations/*
```

Adicionar:

- colunas de configuração em `gallery_settings`;
- tabela de logs;
- índices;
- chave única de idempotência;
- RLS para leitura dos logs pelo fotógrafo autenticado.

### Nova função backend

```text
supabase/functions/send-email/index.ts
```

Função central de envio via Resend.

### Frontend

```text
src/types/gallery.ts
src/hooks/useGallerySettings.ts
src/hooks/useSettings.ts
src/hooks/useEmailLogs.ts
src/components/settings/EmailAutomationSettings.tsx
src/components/settings/PersonalizationSettings.tsx
src/components/SendGalleryModal.tsx
```

### Pagamentos

Revisar e ajustar com segurança:

```text
supabase/functions/check-payment-status/index.ts
supabase/functions/infinitepay-webhook/index.ts
supabase/functions/infinitepay-create-link/index.ts
supabase/functions/asaas-webhook/index.ts
supabase/functions/asaas-gallery-payment/index.ts
supabase/functions/mercadopago-webhook/index.ts
supabase/functions/confirm-payment-manual/index.ts
```

---

## 14. Validação final

Testes esperados:

1. Cliente com e-mail + configurações padrão ativas → envia e-mail ao compartilhar galeria.
2. Modal mostra “E-mail enviado para o cliente”.
3. Cliente sem e-mail → não envia e mostra “Cliente não possui e-mail cadastrado”.
4. Cliente sem e-mail mantém “Copiar link” e “Enviar via WhatsApp” como fallback claro.
5. Toggle geral desligado → nenhum e-mail é enviado.
6. Toggle de galeria desligado → não envia ao compartilhar galeria.
7. Toggle de pagamento desligado → não envia confirmação de pagamento.
8. Reabrir modal da mesma galeria → não duplica envio.
9. Webhook/polling duplicado de pagamento → não duplica envio.
10. Link recebido no e-mail abre diretamente a galeria pública correta.
11. Falha no Resend → fluxo não quebra e log fica como erro.
12. Logs exibem:
    - enviado em verde;
    - erro em vermelho;
    - ignorado em cinza.
13. InfinitePay continua funcionando:
    - create-link;
    - webhook;
    - busca por NSU;
    - fallback por UUID;
    - auto-healing;
    - finalização de pagamento.
14. Build TypeScript sem erros.
