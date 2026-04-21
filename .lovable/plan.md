

# Plano: corrigir o modal de reativação que fecha logo após "Reativar Galeria"

## Diagnóstico

O modal de reativação **abre o passo 2 (sucesso) por uma fração de segundo e fecha** porque o componente `<ReactivateGalleryDialog>` é **desmontado** pelo pai logo após a reativação, antes do usuário conseguir interagir com a tela de mensagem/WhatsApp/e-mail.

Causa raiz por call site:

| Página | Como o modal é renderizado | O que quebra |
|---|---|---|
| `GalleryDetail.tsx` | `{canReactivate && <ReactivateGalleryDialog .../>}` | `canReactivate` exige `status` em `selecao_completa`/`expirado`. Após `reopenSelection`, o status vira `selecao_iniciada`, `canReactivate` vira `false` e o componente **desmonta** no meio do `setShowSuccess(true)`. |
| `GalleryEdit.tsx` | `{canReactivate && <Card>...<ReactivateGalleryDialog/>...</Card>}` | Mesmo problema: `canReactivate` deixa de ser verdadeiro após reativar. |
| `Dashboard.tsx` | `{reactivateGalleryId && <ReactivateGalleryDialog open .../>}` com `gallery={supabaseGalleries.find(...)}` | Após `reopenSelection`, o React Query devolve novo array. O `find` retorna novo objeto, mas se a galeria mudar de aba/filtro, o `gallery` ainda é encontrado. Funciona em geral, mas o componente recebe **gallery atualizada com status diferente**, o que dispara re-render e o `useEffect [open]` não interfere. Esse caso provavelmente já funciona — o relato do usuário é da tela de detalhes. |
| `DeliverDetail.tsx` | `<ReactivateGalleryDialog>` fora da condicional `isExpired` | OK: o modal sobrevive. |

Resumo: o `ReactivateGalleryDialog` precisa **continuar montado** durante toda a vida do modal, independente do `status` da galeria.

## Solução

### 1. Desacoplar a montagem do modal da condicional de elegibilidade

Em vez de montar o modal só quando `canReactivate` é verdadeiro, o pai vai:

- usar **um botão simples** "Reativar" controlado pela condicional `canReactivate`;
- **sempre montar** o `<ReactivateGalleryDialog>` em modo controlado (`open` + `onOpenChange`), sem depender do `canReactivate`;
- só fechar o modal quando o usuário clicar em "Fechar" ou no `X`.

Mesmo padrão que o Dashboard já usa, agora aplicado em `GalleryDetail.tsx` e `GalleryEdit.tsx`.

### 2. Tornar o componente robusto a mudanças de `gallery`

No `ReactivateGalleryDialog.tsx`:

- aceitar que `gallery` mude de status durante a vida do modal — o passo de sucesso (`showSuccess`) **não pode** depender de `canReactivate`;
- garantir que a tela de sucesso continua aberta mesmo se o pai re-renderizar com nova `gallery`;
- recalcular `clientLink` quando o `publicToken` aparecer pela primeira vez (galeria que ainda não tinha token e ganha um após reativar).

### 3. Ajuste fino de UX no passo de sucesso

Aproveitar a refatoração para deixar o passo 2 com a mesma identidade do `SendGalleryModal` (mostrado na imagem 2):

- **header compacto**: "Galeria reativada" + chip "Até DD/MM" + chip "Senha" (se houver);
- **bloco de mensagem** com scroll interno;
- **3 botões em linha**: Copiar Mensagem · WhatsApp · Enviar e-mail;
- **rodapé sutil** com `Copiar Link` e status do envio de e-mail;
- largura `sm:max-w-2xl` no passo 2, `sm:max-w-md` no passo 1.

### 4. Corrigir refetch para garantir `publicToken` atualizado

No fluxo `reopenSelection` (`useSupabaseGalleries.ts`), ao terminar a mutation:

- a `invalidateQueries(['galerias'])` já existe;
- garantir que o componente espera o refetch terminar antes de mostrar `showSuccess` para que o `clientLink` esteja preenchido. Hoje o `await onReactivate(days)` já espera a mutation, mas não espera o refetch. Solução: o componente passa a usar a `gallery` recebida via prop como fonte do link, e se ainda estiver vazio, mostra "Aguardando link..." por 1-2 segundos com um pequeno fallback.

## Detalhes técnicos

### `src/components/ReactivateGalleryDialog.tsx`

- nenhuma mudança estrutural grande, mas:
  - remover o `DialogTrigger` interno quando o componente é controlado (já feito);
  - manter `showSuccess` resistente: não resetar enquanto `open === true`;
  - no `useEffect [open]`, só resetar quando `open` for `false` (já feito) — isso garante que o modal não pisque mesmo com props novas;
  - garantir que `lastDaysRef.current` é lido após `setShowSuccess(true)` (sem dependência de re-render).

### `src/pages/GalleryDetail.tsx`

Refatorar o bloco do botão Reativar:

```text
// estado novo
const [reactivateOpen, setReactivateOpen] = useState(false)

// no header de ações
{canReactivate && (
  <Button variant="outline" size="sm" onClick={() => setReactivateOpen(true)}>
    <RotateCcw /> Reativar
  </Button>
)}

// SEMPRE montado (fora da condicional)
<ReactivateGalleryDialog
  open={reactivateOpen}
  onOpenChange={setReactivateOpen}
  galleryName={...}
  clientLink={clientLink}
  onReactivate={handleReopenSelection}
  gallery={supabaseGallery}
  settings={settings}
/>
```

### `src/pages/GalleryEdit.tsx`

Mesmo padrão: card "Reativar Galeria" mostra apenas o botão controlado por `canReactivate`; o `<ReactivateGalleryDialog>` é montado fora da condicional, no final do JSX da página.

### `src/pages/DeliverDetail.tsx`

Já está correto (modal fora da condicional). Sem mudanças.

### `src/pages/Dashboard.tsx`

Já funciona, mas para uniformidade:
- o `(() => { ... })()` IIFE é mantido porque depende do `reactivateGalleryId`;
- nenhuma mudança funcional necessária.

### Sem mudanças

- `useSupabaseGalleries.ts` (mutation já está OK);
- Edge Function `send-email` (já suporta `gallery_reactivated`);
- migrações de banco;
- InfinitePay, webhooks Asaas/MP, `prepare_gallery_share`.

## Validação

1. abrir `GalleryDetail` de uma galeria com status `selecao_completa`;
2. clicar em "Reativar" → modal pequeno abre;
3. confirmar 7 dias → modal **expande para o passo de sucesso e permanece aberto**;
4. mensagem aparece com `{cliente}`, `{galeria}`, `{prazo}`, `{link}` substituídos;
5. Copiar Mensagem, WhatsApp e Enviar e-mail funcionam;
6. fechar com "Fechar" ou `X` → modal some normalmente;
7. repetir o teste em `GalleryEdit` (card de Reativar);
8. repetir em `DeliverDetail` (galeria expirada);
9. repetir no `Dashboard` (botão da `GalleryCard`);
10. confirmar que após fechar o modal, o botão "Reativar" desaparece (porque `canReactivate` agora é `false`) — comportamento esperado;
11. `npm run build` sem erros TS;
12. revisar que webhooks Asaas, InfinitePay create-link e InfinitePay webhook continuam intactos.

## Resultado esperado

- modal de reativação **não fecha mais** após confirmar o prazo;
- usuário vê a mensagem pré-pronta, copia, manda WhatsApp ou aciona e-mail no mesmo fluxo;
- botão "Reativar" some da página assim que o modal é fechado, refletindo o novo estado da galeria;
- nenhum impacto em pagamentos, webhooks ou InfinitePay.

