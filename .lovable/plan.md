

# Plano: Botão Salvar flutuante + remover toasts + redirect pós-salvamento

## Diagnóstico

Em `src/pages/DeliverDetail.tsx` e `src/pages/GalleryEdit.tsx`:

- O botão **Salvar** vive no header. Ao rolar para baixo (galerias com muitas fotos), ele desaparece — usuário precisa rolar até o topo.
- Após salvar, há `toast.success('Alterações salvas')` / `toast.success('Galeria atualizada!')` e o usuário **fica na mesma página**.
- Para confirmar mudanças, é preciso voltar manualmente.

## Mudanças

### 1. Botão Salvar fixo flutuante (bottom-right)

Em **ambas** as páginas (`DeliverDetail.tsx` e `GalleryEdit.tsx`):

- **Remover** o botão "Salvar" / "Salvar Alterações" do header.
- **Adicionar** um botão flutuante fixo no canto inferior direito, sempre visível:

```tsx
<div className="fixed bottom-6 right-6 z-50">
  <Button
    onClick={handleSave}
    disabled={saving}
    variant="terracotta"
    size="lg"
    className="shadow-2xl gap-2 rounded-full px-6 h-12 backdrop-blur-xl"
  >
    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
    {saving ? 'Salvando...' : 'Salvar Alterações'}
  </Button>
</div>
```

Detalhes UX:
- Posição: `fixed bottom-6 right-6`, `z-50` para ficar acima de tudo.
- Estilo arredondado (`rounded-full`), `shadow-2xl` para destaque visual sutil.
- Mantém o estado `disabled` durante a operação (`saving`/`isUpdating`).
- Em mobile, mantém a mesma posição (canto inferior direito) — não vira full-width para não atrapalhar o conteúdo.
- Padding inferior do container principal (`pb-24`) para evitar que o botão tampe os últimos elementos da página.

### 2. Remover toasts de notificação após salvar

Em `DeliverDetail.tsx` (`handleSave`):
- Remover `toast.success('Alterações salvas')` e `toast.error('Erro ao salvar')`.
- Erros silenciosos via `console.error` apenas (mantém log mas sem UI).

Em `GalleryEdit.tsx` (`handleSave`):
- Remover `toast.success('Galeria atualizada!')`.
- Manter apenas `console.error` no catch.

**Observação**: outros toasts no sistema (link copiado, capa atualizada, publicação, etc.) **permanecem** — só removemos os toasts pós-salvamento de edição. Confirmaremos isso na pergunta abaixo se necessário, mas o pedido é claramente sobre o "Alterações salvas".

### 3. Redirect automático após salvar

Em `DeliverDetail.tsx`:
- Após `await updateGallery(...)` ter sucesso → `navigate('/galleries/deliver')`.

Em `GalleryEdit.tsx`:
- Após `await updateGallery(...)` ter sucesso → `navigate(\`/gallery/\${gallery.id}\`)` (volta para a página de detalhe da galeria select, não para a lista).

### 4. Tratamento de erro

Se o salvamento falhar:
- **Não** redirecionar.
- Manter o usuário na página para corrigir.
- Como removemos o toast, o feedback de erro fica via `console.error` apenas — o que é razoável dado que o caso de erro é raro e o estado `disabled` do botão já indica progresso.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/DeliverDetail.tsx` | Mover botão Salvar do header para flutuante; remover toasts pós-save; redirect para `/galleries/deliver` |
| `src/pages/GalleryEdit.tsx` | Mover botão Salvar do header para flutuante; remover toast pós-save; redirect para `/gallery/${id}` |

## Resultado

- Botão **Salvar** sempre visível em qualquer ponto da rolagem (canto inferior direito).
- Sem toast "Alterações salvas" / "Galeria atualizada!" poluindo a tela.
- Após salvar, usuário é levado automaticamente:
  - Galeria **Transfer** → lista de Transfers (`/galleries/deliver`).
  - Galeria **Select** → página de detalhe da galeria (`/gallery/{id}`).
- Salvamentos com erro mantêm o usuário na página de edição (sem redirect).

