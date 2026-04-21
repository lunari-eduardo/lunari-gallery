
# Plano: adicionar feedback visual de salvamento nas Configurações

## Objetivo

Garantir que toda alteração salva nas telas de configuração mostre feedback claro para o usuário, principalmente em **Configurações > Personalização**, onde hoje o botão fixo “Salvar Configurações” não comunica se algo foi salvo.

Comportamento esperado:

```text
Usuário altera configuração → sistema salva → toast confirma sucesso ou erro
```

---

## Diagnóstico

A tela `Settings.tsx` possui um botão fixo:

```text
Salvar Configurações
```

mas o `handleSave` está vazio. Além disso, muitas configurações são salvas automaticamente no momento da alteração:

- nome do estúdio;
- permissão padrão;
- prazo padrão;
- modo de venda;
- tamanho de imagem;
- logo;
- favicon;
- toggles de e-mail;
- mensagem de boas-vindas;
- tema;
- watermark.

O problema é que várias dessas ações persistem no banco, mas não exibem um toast de sucesso. Isso cria a sensação de que nada aconteceu.

---

## 1. Corrigir feedback no hook central de configurações

Arquivo:

```text
src/hooks/useGallerySettings.ts
```

A mutation central `updateSettings` já tem toast de erro, mas não tem toast de sucesso.

Vou ajustar para suportar feedback controlado, evitando excesso de notificações em campos que disparam muitas alterações.

Estratégia:

- manter `updateSettings` como ponto único de persistência;
- adicionar opção para mostrar toast de sucesso;
- preservar erro com `toast.error`;
- não exibir toast automático em cada tecla digitada, para não poluir a UX.

Exemplo conceitual:

```text
updateSettings(data, { successMessage?: string, showSuccessToast?: boolean })
```

Ou, se for mais simples com o padrão atual:

```text
updateSettings(data)
updateSettingsAsync(data)
```

Assim componentes que precisam aguardar o salvamento poderão mostrar toast só após sucesso real.

---

## 2. Ajustar `useSettings` para expor salvamento assíncrono

Arquivo:

```text
src/hooks/useSettings.ts
```

Hoje `updateSettings` apenas chama a mutation sem retorno assíncrono.

Vou expor uma forma segura para a página aguardar o salvamento, por exemplo:

```text
updateSettingsAsync
isUpdating
```

Isso permitirá que a tela de Configurações:

- desabilite botão enquanto salva;
- mostre “Salvando...”;
- exiba `toast.success`;
- exiba `toast.error` quando falhar.

---

## 3. Tornar o botão “Salvar Configurações” útil

Arquivo:

```text
src/pages/Settings.tsx
```

Hoje o botão fixo chama um `handleSave` vazio.

Vou alterar para que ele tenha um comportamento coerente com o fluxo atual:

### Na aba Geral

Como os campos já salvam ao alterar, o botão será usado como confirmação visual:

- se houver alterações pendentes/localmente controladas, salvar;
- se não houver pendência, mostrar:

```text
Configurações já estão salvas.
```

### Na aba Personalização

O botão continuará visível e poderá confirmar salvamentos globais, mas os componentes específicos também terão feedback próprio.

Estados do botão:

```text
Salvar Configurações
Salvando...
Configurações salvas
```

Visual:

- manter a barra fixa inferior;
- adicionar spinner `Loader2` durante salvamento;
- desabilitar enquanto estiver salvando.

---

## 4. Adicionar toast nos salvamentos automáticos principais

Arquivos:

```text
src/components/settings/GeneralSettings.tsx
src/components/settings/PersonalizationSettings.tsx
src/components/settings/EmailAutomationSettings.tsx
src/components/settings/ThemeConfig.tsx
src/hooks/useWatermarkSettings.ts
```

### Geral

Mostrar toast para ações discretas:

- trocar permissão padrão;
- alterar modo de venda;
- alterar tamanho padrão da imagem;
- corrigir prazo no blur.

Evitar toast em toda digitação do nome do estúdio. Para esse campo, a melhor UX é:

- salvar no blur; ou
- manter digitação local e salvar no botão.

Recomendação: ajustar `Nome do Estúdio` para salvar no blur ou no botão, não a cada tecla.

### Personalização

Adicionar feedback para:

- upload/troca de logo;
- remoção de logo;
- upload/troca de favicon;
- remoção de favicon;
- ativar/desativar mensagem de boas-vindas;
- salvar mensagem de boas-vindas no blur;
- ativar/desativar e-mails;
- permitir/desativar e-mail de galeria;
- permitir/desativar e-mail de pagamento.

### Tema

Adicionar toast para:

- alternar entre tema padrão e personalizado;
- salvar tema personalizado;
- voltar para tema do sistema.

### Watermark

O hook `useWatermarkSettings` já mostra toast de erro, mas não sucesso. Vou adicionar sucesso para:

- alterar tipo de proteção;
- alterar opacidade;
- alterar tamanho da marca;
- enviar marca d’água;
- remover marca d’água.

Com cuidado para não disparar vários toasts enquanto o usuário arrasta o slider: o toast deve aparecer apenas no commit final.

---

## 5. Padronizar mensagens de toast

Usar `sonner`, que já está configurado no app.

Mensagens sugeridas:

```text
Configurações salvas.
Tema salvo com sucesso.
Logo atualizado.
Favicon atualizado.
Mensagem padrão salva.
Preferência de e-mail salva.
Marca d’água atualizada.
Não foi possível salvar as configurações.
```

Para não ficar repetitivo, usar mensagens específicas só nas ações mais importantes e uma mensagem genérica nos demais casos.

---

## 6. Melhorar UX sem excesso de notificações

Regras de UX:

- não mostrar toast a cada caractere digitado;
- não mostrar múltiplos toasts em sequência para a mesma ação;
- usar `toast.success` apenas após confirmação real do Supabase;
- usar `toast.error` quando a mutation falhar;
- manter botões com loading quando o salvamento for manual;
- manter feedback discreto e no canto inferior direito, seguindo o padrão atual do Sonner.

---

## 7. Não alterar pagamentos nem webhooks

Este ajuste é apenas de UI/UX e feedback de configurações.

Não mexer em:

```text
supabase/functions/infinitepay-create-link
supabase/functions/infinitepay-webhook
supabase/functions/asaas-webhook
supabase/functions/asaas-gallery-webhook
supabase/functions/mercadopago-webhook
supabase/functions/check-payment-status
supabase/functions/confirm-payment-manual
```

Também vou revisar para garantir que nenhuma alteração afete a automação de cobrança InfinitePay.

---

## 8. Validação final

Após implementar, validar:

1. alterar nome do estúdio e confirmar toast no salvamento;
2. trocar permissão padrão e confirmar toast;
3. alterar prazo padrão e confirmar toast no momento correto;
4. alterar modo de venda e confirmar toast;
5. alterar tamanho padrão das imagens e confirmar toast;
6. trocar logo e confirmar toast;
7. remover logo e confirmar toast;
8. trocar favicon e confirmar toast;
9. alterar tema e confirmar toast;
10. salvar tema personalizado e confirmar toast;
11. alterar watermark e confirmar toast apenas no commit final;
12. alterar toggles de e-mail e confirmar toast;
13. editar template de e-mail e confirmar que o toast existente continua funcionando;
14. clicar em “Salvar Configurações” e confirmar feedback visual;
15. testar estados de erro;
16. rodar build TypeScript;
17. verificar layout desktop e mobile da barra inferior.

## Resultado esperado

As telas de configuração passam a transmitir confiança:

- o usuário sabe quando algo foi salvo;
- erros ficam visíveis;
- o botão fixo deixa de parecer quebrado;
- alterações automáticas têm confirmação discreta;
- não há spam de notificações;
- pagamentos e webhooks permanecem intactos.
