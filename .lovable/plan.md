

# Plano: remover Histórico de e-mails e adicionar envio de aviso na reativação

## Objetivo

Duas mudanças:

1. **Remover totalmente** o "Histórico de e-mails" da tela de Configurações > Personalização > E-mails automáticos.
2. **Expandir o modal de reativação** de galeria, transformando-o em uma experiência de 3 ações (igual ao modal de Compartilhar): definir prazo + reativar + opcionalmente notificar o cliente por e-mail / WhatsApp / link.

---

## Parte 1 — Remover histórico de e-mails

### O que será removido

Arquivo: `src/components/settings/EmailAutomationSettings.tsx`

- bloco "Histórico de e-mails" inteiro (lista + estados de loading/empty);
- import e uso do hook `useEmailLogs`;
- imports não utilizados (`formatDistanceToNow`, `ptBR`, `EmailDeliveryStatus`, `CheckCircle2`, `XCircle`, `MinusCircle`).

Arquivo: `src/hooks/useEmailLogs.ts`

- arquivo deletado (não é usado em nenhum outro lugar do projeto).

### O que NÃO muda

- A tabela `email_delivery_logs` no banco continua sendo gravada pela Edge Function `send-email`. Ela serve como auditoria interna e idempotência (`alreadySent` evita reenviar o mesmo e-mail), então não pode ser removida do backend.
- Toggles "Ativar envio de e-mails", "Permitir envio de e-mail de galeria" e "Enviar e-mail ao confirmar pagamento" permanecem.

### Resultado visual

A seção "E-mails automáticos" passa a ter apenas:

```text
[ícone] E-mails automáticos
        Você pode desativar os e-mails a qualquer momento.
        Remetente: contato@mail.lunarihub.com
        Respostas vão para o e-mail cadastrado do fotógrafo quando disponível.

Ativar envio de e-mails                                [switch]
  Permitir envio de e-mail de galeria                  [switch]
  Enviar e-mail ao confirmar pagamento                 [switch]
```

---

## Parte 2 — Modal de Reativação ampliado

### Visão geral da nova UX

O modal `ReactivateGalleryDialog` passa a ter **dois passos**, alinhados com o padrão do `SendGalleryModal`:

```text
Passo 1 — Definir prazo
  - input de dias (mantém regra 1–90)
  - botão "Reativar Galeria"

Passo 2 — Galeria reativada (tela de sucesso ampliada)
  - resumo: "Reaberta com prazo de N dias até DD/MM/AAAA"
  - mensagem pré-pronta para o cliente (preview editável-only display)
  - 3 botões de ação:
      [Copiar mensagem]   [WhatsApp]   [Enviar e-mail]
  - linha com link da galeria + botão de copiar
  - status do envio de e-mail (enviado / erro / desativado / sem e-mail)
  - botão "Fechar"
```

Largura do modal aumenta de `sm:max-w-md` para `sm:max-w-2xl` no passo 2 para acomodar mensagem + ações, igual ao `SendGalleryModal`.

### Novo template de e-mail "Galeria reativada"

Adicionar um novo tipo de template em:

```text
src/types/gallery.ts          → EmailTemplate.type adiciona 'gallery_reactivated'
src/hooks/useGallerySettings.ts → defaultEmailTemplates ganha 1 entrada
src/components/settings/EmailTemplates.tsx → ícone (RotateCcw)
```

Conteúdo padrão sugerido:

```text
Assunto: Sua galeria foi reaberta - {galeria}

Olá {cliente}!

Boas notícias: a galeria "{galeria}" foi reaberta para você concluir
sua seleção de fotos.

Você tem até {prazo} para escolher suas favoritas.

Acesse: {link}

Com carinho,
{estudio}
```

Slugs disponíveis: `{cliente}`, `{galeria}`, `{prazo}`, `{dias_restantes}`, `{link}`, `{estudio}`.

Templates novos serão semeados automaticamente para usuários existentes através de uma migração leve em `useGallerySettings.ts` (mesmo padrão que `defaultEmailTemplates` já usa para inserir o que está faltando).

### Edge Function `send-email`

Adicionar suporte a um novo `eventType`:

```text
eventType: 'gallery_reactivated'
```

Comportamento:

- aceita `galleryId` + `publicToken`;
- usa idempotência `gallery_reactivated:{galleryId}:{prazo_selecao_iso}` (assim cada reativação nova permite reenvio, sem duplicar dentro da mesma reativação);
- respeita `email_sending_enabled` e `email_on_gallery_sent` (reaproveita o mesmo toggle de "envio de galeria", evitando criar mais uma chave de configuração);
- busca template `gallery_reactivated` em `gallery_email_templates`, com fallback hard-coded;
- mantém `From: Lunari <contato@mail.lunarihub.com>` e `reply_to` do fotógrafo;
- grava log em `email_delivery_logs` com `event_type: 'gallery_reactivated'`.

### Nova lógica no `ReactivateGalleryDialog`

Props adicionadas:

```text
gallery: Galeria              // para extrair clienteNome, clienteEmail, telefone, nomeSessao
settings: GlobalSettings      // para template + toggles + studioName
```

Comportamentos:

- após `onReactivate(days)` retornar com sucesso, refetch da galeria garante `prazo_selecao` e `public_token` atualizados;
- mensagem pré-pronta usa o template `gallery_reactivated` com substituição dos slugs;
- "Copiar mensagem" copia texto completo;
- "WhatsApp" abre `wa.me/55{telefone}?text={msg}`;
- "Enviar e-mail" chama `supabase.functions.invoke('send-email', { body: { eventType: 'gallery_reactivated', galleryId, publicToken } })`;
- estado `emailFeedback` (mesma estrutura do `SendGalleryModal`) controla mensagem visual abaixo dos botões;
- desabilita botão de e-mail se: cliente sem e-mail, envio global desativado, envio de galeria desativado, ou já enviado nessa sessão do modal;
- copiar link mantém botão dedicado.

### Integração nos call sites

Os 4 lugares que usam o componente passam os novos props:

```text
src/pages/GalleryDetail.tsx        → já tem supabaseGallery + settings
src/pages/GalleryEdit.tsx          → já tem gallery + settings
src/pages/DeliverDetail.tsx        → já tem gallery + settings
src/pages/Dashboard.tsx            → já tem galeria + settings
```

Após `onReactivate`, todos garantem refetch (já fazem via React Query invalidation) para o modal abrir o passo 2 com `publicToken` e `prazo_selecao` atualizados.

---

## Detalhes técnicos

### Frontend

| Arquivo | Mudança |
|---|---|
| `src/components/settings/EmailAutomationSettings.tsx` | remove bloco Histórico + imports |
| `src/hooks/useEmailLogs.ts` | deletado |
| `src/types/gallery.ts` | `EmailTemplate.type` ganha `'gallery_reactivated'` |
| `src/hooks/useGallerySettings.ts` | `defaultEmailTemplates` ganha entrada de reativação; init garante semeadura |
| `src/components/settings/EmailTemplates.tsx` | ícone `RotateCcw` para o novo tipo |
| `src/components/ReactivateGalleryDialog.tsx` | reescrito com 2 passos, mensagem, 3 ações |
| `src/pages/GalleryDetail.tsx` | passa `gallery` e `settings` |
| `src/pages/GalleryEdit.tsx` | idem |
| `src/pages/DeliverDetail.tsx` | idem |
| `src/pages/Dashboard.tsx` | idem |

### Backend

| Arquivo | Mudança |
|---|---|
| `supabase/functions/send-email/index.ts` | adiciona branch `gallery_reactivated` reaproveitando o pipeline atual; idempotência inclui `prazo_selecao` |

Sem migração de banco. Sem mexer em InfinitePay, webhooks Asaas/MP, `prepare_gallery_share`, RLS de `galerias`, nem em `email_delivery_logs`.

### Segurança e idempotência

- mesma autenticação do `send-email` atual (`getAuthenticatedUserId` + checagem `gallery.user_id`);
- `Reply-To` continua resolvido server-side via `profiles.email`;
- chave de idempotência inclui `prazo_selecao` para permitir um e-mail por reativação, bloquear duplo clique;
- toggles existentes de envio são respeitados (não cria nova chave de configuração).

### Validação

1. tela Configurações > Personalização sem o bloco Histórico;
2. clicar em "Reativar" abre o modal compacto;
3. confirmar prazo: galeria reativa, modal expande para passo 2;
4. mensagem aparece com slugs substituídos;
5. Copiar mensagem / Copiar link funcionam;
6. WhatsApp abre com texto correto e número quando houver;
7. Enviar e-mail dispara `send-email` com `gallery_reactivated`, mostra status no card abaixo;
8. cliente sem e-mail desabilita botão com mensagem clara;
9. envio global desativado também desabilita;
10. clicar duas vezes em Enviar e-mail mostra "já enviado" via idempotência;
11. nova reativação posterior gera nova chave de idempotência → permite novo e-mail;
12. `npm run build` sem erros TS;
13. webhooks e InfinitePay intactos.

