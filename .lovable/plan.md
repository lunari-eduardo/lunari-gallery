
# Plano: Corrigir salvamento e uso real dos templates de e-mail

## Diagnóstico

O problema principal está na tela de **Configurações > Personalização > Textos de E-mails**.

Hoje o modal permite editar assunto e corpo, mas a alteração não é persistida porque o componente está assim:

```text
onTemplatesChange={(templates) => {
  // For now, email templates still use the old pattern
}}
```

Ou seja:

- o botão “Salvar Template” fecha o modal;
- a lista até monta um array atualizado localmente;
- mas nada é enviado para o Supabase;
- ao recarregar ou reabrir, volta o conteúdo antigo.

Também há um segundo ponto importante:

- a Edge Function `send-email` ainda usa um template hardcoded para o e-mail automático de galeria enviada;
- então mesmo depois de salvar no banco, o e-mail automático pode continuar ignorando o texto editado pelo fotógrafo.

## Objetivo

Fazer com que as edições feitas nos templates sejam:

1. salvas corretamente no banco;
2. refletidas na interface imediatamente;
3. usadas no texto de compartilhamento da galeria;
4. usadas também no envio automático via Resend, principalmente no evento **Galeria Enviada**.

---

## 1. Corrigir salvamento no frontend

### Arquivo principal

```text
src/components/settings/PersonalizationSettings.tsx
```

Hoje `EmailTemplates` recebe um `onTemplatesChange` vazio.

Vou alterar para usar a mutation já existente em:

```text
src/hooks/useGallerySettings.ts
```

A mutation existente:

```text
updateEmailTemplate
```

já atualiza a tabela:

```text
gallery_email_templates
```

Então a correção será ligar o componente visual a essa mutation.

### Resultado

Ao clicar em “Salvar Template”:

- o template será atualizado no Supabase;
- a query `gallery-settings` será invalidada;
- a lista será recarregada com os dados salvos;
- ao fechar e abrir novamente, o texto editado continuará lá.

---

## 2. Melhorar feedback de salvamento

### Arquivos

```text
src/hooks/useGallerySettings.ts
src/components/settings/EmailTemplates.tsx
src/components/settings/EmailTemplateModal.tsx
```

Adicionar feedback claro:

- salvando;
- salvo com sucesso;
- erro ao salvar.

Comportamento esperado:

```text
Salvar Template → desabilita botão enquanto salva → mostra sucesso → fecha modal
```

Se falhar:

```text
Não foi possível salvar o template.
```

E o modal não deve simplesmente fechar como se tivesse dado certo.

---

## 3. Ajustar contrato do componente `EmailTemplates`

Hoje ele trabalha com:

```text
onTemplatesChange(templates)
```

Isso força o componente a enviar a lista inteira.

Como o caso real é editar um template por vez, vou simplificar para:

```text
onTemplateSave(template)
```

Benefícios:

- menos chance de sobrescrever templates errados;
- aproveita a mutation já pronta;
- fica mais claro que o salvamento é individual;
- reduz risco de conflito entre templates.

---

## 4. Garantir atualização visual imediata

Após salvar:

- invalidar `gallery-settings`;
- manter a lista refletindo o novo assunto;
- fechar o modal somente depois do sucesso;
- manter o texto editado caso aconteça erro.

Opcionalmente, aplicar atualização otimista simples para a lista parecer instantânea, mas sem esconder erro real.

---

## 5. Fazer o e-mail automático usar o template salvo

### Arquivo

```text
supabase/functions/send-email/index.ts
```

No evento:

```text
gallery_sent
```

a função hoje monta assunto e corpo fixos.

Vou ajustar para:

1. buscar o template do fotógrafo em `gallery_email_templates`;
2. usar o template com `type = gallery_sent`;
3. substituir variáveis suportadas;
4. gerar o HTML final com o layout padrão responsivo;
5. manter o botão “Acessar minha galeria” usando o link público correto.

### Variáveis suportadas

Manter as variáveis que já aparecem no modal:

```text
{cliente}
{galeria}
{prazo}
{link}
{estudio}
{dias_restantes}
{total_fotos}
{fotos_extras}
{valor_extra}
```

Para o evento de galeria enviada, as principais serão:

```text
{cliente}
{galeria}
{prazo}
{link}
{estudio}
```

As demais podem ficar com fallback seguro quando não houver dado disponível.

---

## 6. Preservar regra crítica do link público

Mesmo usando o template editado, o link enviado no e-mail continuará seguindo a regra segura:

- usar o token retornado pela RPC `prepare_gallery_share`;
- nunca usar UUID interno da galeria;
- nunca gerar token no cliente;
- se o token não existir, não enviar;
- registrar como ignorado/erro sem quebrar o fluxo.

O botão do HTML continuará usando o link público resolvido.

---

## 7. Compatibilidade com WhatsApp e copiar mensagem

O `SendGalleryModal` já monta a mensagem de WhatsApp/cópia a partir de:

```text
settings.emailTemplates.find(type === 'gallery_sent')
```

Depois que o salvamento for corrigido, esse fluxo também passa a refletir o texto editado.

Vou revisar esse ponto para garantir que:

- o texto copiado usa o template salvo;
- `{link}` é substituído corretamente;
- senha da galeria privada continua sendo anexada;
- prazo continua formatado corretamente.

---

## 8. Não alterar fluxos de pagamento agora

Este ajuste é focado em templates.

Não vou mexer em:

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

- o problema reportado está no salvamento/uso dos templates;
- evitar risco desnecessário nos webhooks e automação de cobrança;
- manter intactas as regras críticas da InfinitePay.

Se for necessário mexer em e-mail de pagamento depois, será em uma etapa separada e com revisão completa dos webhooks.

---

## 9. Validação final

Depois da implementação, validar:

1. abrir template “Galeria Enviada”;
2. alterar assunto;
3. alterar corpo;
4. clicar em “Salvar Template”;
5. confirmar toast de sucesso;
6. reabrir o modal e confirmar que o texto continua salvo;
7. recarregar a página e confirmar persistência;
8. abrir modal de envio de galeria e confirmar que a mensagem usa o template editado;
9. enviar galeria para cliente com e-mail e confirmar que o e-mail automático usa o conteúdo salvo;
10. confirmar que o link do e-mail abre a galeria pública correta;
11. testar erro de salvamento e garantir que o modal não fecha como sucesso;
12. rodar build TypeScript.

## Resultado esperado

O fotógrafo poderá editar os textos de e-mail com confiança:

- o botão “Salvar Template” realmente salva;
- a interface mostra feedback;
- o texto permanece após recarregar;
- o WhatsApp/cópia usa o template salvo;
- o e-mail automático de galeria enviada usa o template personalizado;
- o link público da galeria continua seguro e funcional.
