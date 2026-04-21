

# Plano: corrigir modal de reativação + envio de e-mail + granularidade de toggles

## Diagnóstico do estado atual

Após investigação completa do fluxo, encontrei três problemas reais e correlacionados:

### Problema 1 — Modal de sucesso "pisca e some"

O `ReactivateGalleryDialog` hoje tenta fazer dois passos no MESMO `<Dialog>`:

- passo 1: `sm:max-w-md` (input de dias)
- passo 2: `sm:max-w-2xl` (mensagem + WhatsApp/e-mail)

A troca brusca de tamanho + conteúdo em uma única instância de Dialog do Radix gera reposicionamento do Portal e FocusTrap **enquanto** o React Query invalida `['galerias']` (refetch após `reopenSelection`). Isso provoca duas re-renderizações em sequência e a sensação de "abre e fecha rápido". Mesmo com o modal montado fora da condicional `canReactivate`, o pai ainda re-renderiza e o ciclo fica visualmente quebrado.

**Solução**: separar em dois modais independentes, igual ao padrão do `SendGalleryModal` (que funciona bem). O primeiro modal pede o prazo. Após reativar com sucesso, ele fecha e dispara o segundo modal (compartilhamento da reativação) que reaproveita o layout exato do `SendGalleryModal`.

### Problema 2 — E-mail de reativação não chega ao cliente

Edge Function `send-email` já suporta `gallery_reactivated`, enum `email_delivery_event_type` já tem o valor, e o template `gallery_reactivated` é semeado. Mas:

- **`gallery_settings` não tem coluna específica** para o toggle de reativação. Hoje a Edge Function reaproveita `email_on_gallery_sent`, então se o usuário desativar "envio de galeria", reativação também é bloqueada — e vice-versa.
- O cliente do passo 2 chama `supabase.functions.invoke('send-email', ...)`. Possíveis falhas silenciosas: `cliente_email` vazio na linha (recém-criada), `public_token` ausente no momento do envio (race com refetch), ou função `send-email` retornando 500 sem o usuário saber.

**Solução**: criar coluna dedicada `email_on_gallery_reactivated`, atualizar Edge Function para usar ela, e melhorar o feedback de erro no modal (mostrar `data.message` real e `error.message` quando der ruim).

### Problema 3 — Toggles de e-mail genéricos demais

Hoje o usuário só pode ativar/desativar:
- `emailSendingEnabled` (master)
- `emailOnGallerySent` (envio inicial)
- `emailOnPaymentConfirmed` (pagamento)

Faltam toggles para:
- `emailOnGalleryReactivated` (reativação)
- `emailOnSelectionConfirmed` (não há disparo automático ainda — apenas template existe)
- `emailOnSelectionReminder` (não há disparo automático ainda — apenas template existe)

Os dois últimos templates (`selection_reminder`, `selection_confirmed`) **existem como texto editável mas nunca são enviados pelo backend**. Para evitar confusão, precisamos esclarecer isso na UI ou esconder os toggles que ainda não têm fluxo real.

---

## Solução proposta

### Parte 1 — Separar modal de reativação em dois componentes

**Novo arquivo**: `src/components/ReactivateSuccessModal.tsx`

Estrutura visual idêntica ao `SendGalleryModal` (imagem 660), com:

- header: ícone `RotateCcw` + título "Galeria Reativada" + chips "Até DD/MM" + "Senha" (se houver)
- mensagem pré-pronta com substituição de slugs (`{cliente}`, `{galeria}`, `{prazo}`, `{link}`, `{estudio}`, `{dias_restantes}`)
- 3 botões: Copiar Mensagem · WhatsApp · Enviar e-mail
- card de status do e-mail (sucesso/erro/desativado/sem e-mail)
- rodapé sutil com link da galeria + botão "Copiar Link"
- botão "Fechar"

**Refatorar**: `src/components/ReactivateGalleryDialog.tsx`

Volta a ter APENAS o passo 1 (input de prazo). Após sucesso, chama `onSuccess(days)` que o pai usa para abrir o `ReactivateSuccessModal` separadamente.

**Vantagens**:
- elimina troca de tamanho dentro do mesmo Dialog
- dois Portals separados, sem conflito de FocusTrap
- pai controla a transição entre eles em sequência limpa
- cada modal tem ciclo de vida independente de re-renders do React Query

### Parte 2 — Coluna dedicada para toggle de reativação

**Migração SQL**:
```sql
ALTER TABLE public.gallery_settings
ADD COLUMN IF NOT EXISTS email_on_gallery_reactivated boolean DEFAULT true;
```

**Atualizar**:
- `src/types/gallery.ts` → adicionar `emailOnGalleryReactivated?: boolean` em `GlobalSettings`
- `src/data/mockData.ts` → `emailOnGalleryReactivated: true`
- `src/hooks/useGallerySettings.ts` → mapear nova coluna em `mapToGlobalSettings` e em `updateData`
- `supabase/functions/send-email/index.ts` → no branch `gallery_reactivated`, ler e respeitar `email_on_gallery_reactivated` em vez de reaproveitar `email_on_gallery_sent`

### Parte 3 — Granularidade visual em E-mails automáticos

Reformular `src/components/settings/EmailAutomationSettings.tsx`:

```text
[ícone] E-mails automáticos
        Você pode desativar cada tipo de e-mail individualmente.

Ativar envio de e-mails                                [switch master]
  └ Envio inicial da galeria                          [switch]
  └ Reativação de galeria                             [switch]
  └ Confirmação de pagamento                          [switch]
```

Toggles `selection_reminder` e `selection_confirmed` **não entram aqui** porque ainda não há disparo automático no backend. Se quisermos manter os templates editáveis em "Textos de E-mails", tudo bem — mas adicionar toggle sem fluxo real seria enganoso.

### Parte 4 — Melhor feedback de erro no envio

No `ReactivateSuccessModal`, ao chamar `send-email`:

- mostrar `error.message` real do Supabase quando falhar (não só "não foi possível")
- exibir o status da Edge Function (`data?.message`) literalmente quando vier `ignorado` ou `erro`
- log no console com payload completo para diagnóstico

### Parte 5 — Garantir token público antes de mostrar passo 2

No fluxo do pai (GalleryDetail / GalleryEdit / Dashboard / DeliverDetail):

```text
1. usuário clica "Reativar"
2. abre ReactivateGalleryDialog (input prazo)
3. usuário confirma → await reopenSelection({ id, days })
4. await refetch (espera React Query trazer publicToken atualizado)
5. fecha ReactivateGalleryDialog
6. abre ReactivateSuccessModal com gallery atualizada
```

A diferença chave: **aguardar o refetch terminar** antes de abrir o modal de sucesso, garantindo que `clientLink` esteja preenchido. Isso elimina o "Aguardando link..." e qualquer race condition.

---

## Detalhes técnicos

### Frontend

| Arquivo | Mudança |
|---|---|
| `src/components/ReactivateGalleryDialog.tsx` | Volta a ser apenas o passo 1. Chama `onSuccess(days)` após reativar |
| `src/components/ReactivateSuccessModal.tsx` | NOVO — passo 2 isolado, layout do SendGalleryModal |
| `src/components/settings/EmailAutomationSettings.tsx` | Adiciona toggle "Reativação de galeria" |
| `src/hooks/useGallerySettings.ts` | Mapeia `email_on_gallery_reactivated` |
| `src/types/gallery.ts` | Campo `emailOnGalleryReactivated?: boolean` |
| `src/data/mockData.ts` | Default `true` |
| `src/pages/GalleryDetail.tsx` | Orquestra dois modais em sequência + aguarda refetch |
| `src/pages/GalleryEdit.tsx` | Idem |
| `src/pages/DeliverDetail.tsx` | Idem |
| `src/pages/Dashboard.tsx` | Idem (substitui IIFE atual) |

### Backend

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/...` | `ALTER TABLE gallery_settings ADD COLUMN email_on_gallery_reactivated boolean DEFAULT true` |
| `supabase/functions/send-email/index.ts` | Branch `gallery_reactivated` lê `email_on_gallery_reactivated` |
| Redeploy `send-email` | Obrigatório após edição |

### Sem mudanças

- InfinitePay create-link e webhook (intactos)
- Webhooks Asaas e Mercado Pago
- `prepare_gallery_share` RPC
- RLS de `galerias`
- Templates `selection_reminder` e `selection_confirmed` (mantêm-se editáveis, sem toggle por enquanto)

---

## Validação

1. abrir GalleryDetail → clicar "Reativar" → modal compacto com input de prazo
2. confirmar 7 dias → modal de prazo fecha, modal de sucesso abre **e permanece aberto**
3. mensagem com slugs substituídos corretamente
4. Copiar Mensagem / Copiar Link funcionam
5. WhatsApp abre com texto e número corretos
6. Enviar e-mail dispara função e mostra status real (sucesso/erro literal)
7. desativar "Reativação de galeria" em Configurações → próximo envio retorna `ignorado` com mensagem clara
8. master "Ativar envio de e-mails" desligado → bloqueia tudo
9. testar em GalleryEdit, DeliverDetail e Dashboard
10. cliente sem e-mail → botão desabilitado com mensagem clara
11. galeria sem token público → mensagem "Aguardando link" temporária
12. `npm run build` sem erros TS
13. webhooks Asaas / InfinitePay intactos

## Resultado esperado

- modal de reativação **não pisca mais**: dois modais limpos e separados em sequência
- e-mail de reativação chega ao cliente com mensagem clara em caso de falha
- usuário controla cada tipo de e-mail individualmente nas configurações
- nenhum impacto em pagamentos ou integrações externas

