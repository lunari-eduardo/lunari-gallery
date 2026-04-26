# Melhorias na lista de fotos da página Editar Galeria

## Objetivo

Tornar a seção "Fotos da Galeria" em `GalleryEdit` realmente útil:
1. Aumentar as miniaturas para reconhecimento visual real (sem depender só do nome do arquivo).
2. Permitir seleção múltipla com checkbox para excluir várias fotos de uma vez.

## Mudanças de UI/UX

### Layout das fotos
- Substituir a `Table` atual (linhas com thumb 40x40 + nome) por um **grid responsivo de miniaturas**:
  - 3 colunas no mobile, 4 em sm, 5 em md/lg dentro do `ScrollArea` (altura mantida em ~450px).
  - Cada item: card quadrado (`aspect-square`), imagem `object-cover` ocupando todo o espaço, cantos arredondados, borda sutil.
  - Nome do arquivo exibido abaixo da miniatura em texto pequeno truncado (1 linha) — mantém identificação textual sem competir com a imagem.
  - Indicador de vídeo (ícone Play) no canto, reaproveitando padrão já usado em `DeliverPhotoManager`.

### Seleção múltipla
- **Checkbox no canto superior esquerdo** de cada miniatura, visível em hover e sempre visível quando há ao menos 1 item selecionado.
- Clique na miniatura (fora do checkbox) **não** abre lightbox — alterna seleção quando o "modo seleção" está ativo. Quando nenhum item está selecionado, clique simples também marca/desmarca (comportamento natural de seleção em grid).
- **Barra de ações fixa no topo da lista** quando `selectedIds.length > 0`:
  - Texto: "X foto(s) selecionada(s)".
  - Botão "Selecionar todas" / "Limpar seleção" (toggle conforme estado).
  - Botão destrutivo "Excluir selecionadas" (variant destructive) com ícone Trash2.
- Botão de lixeira individual continua disponível em hover de cada card (atalho rápido para 1 foto), mas o fluxo principal vira a seleção múltipla.

### Confirmação e feedback
- Antes de excluir em massa, abrir `AlertDialog` de confirmação:
  - Título: "Excluir X fotos?"
  - Descrição: "Esta ação não pode ser desfeita. As fotos serão removidas permanentemente da galeria e do armazenamento."
  - Botões: "Cancelar" / "Excluir" (destructive).
- Durante a exclusão: estado `isBulkDeleting` desativa botões, mostra `Loader2` no botão de excluir.
- Após sucesso: toast "X foto(s) excluída(s)", limpar `selectedIds`, invalidar queries (`galeria-fotos`, `galerias`), atualizar `localPhotoCount`.
- Em caso de erro: toast de erro, manter seleção para o usuário tentar novamente.

### Preservação de comportamentos atuais
- Filtro por pasta ativa (`activeFolderId`) continua funcionando — seleção fica restrita às fotos da pasta visível e é resetada ao trocar de pasta.
- Botão "Adicionar Fotos" e `PhotoUploader` permanecem inalterados abaixo da grid.
- `FolderManager` acima permanece inalterado.

## Mudanças técnicas

### `src/pages/GalleryEdit.tsx`
- Adicionar estado: `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())`, `const [isBulkDeleting, setIsBulkDeleting] = useState(false)`, `const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false)`.
- Resetar `selectedIds` em `useEffect` quando `activeFolderId` muda.
- Substituir o bloco `Table` (linhas 758–790) por:
  - Barra de ações condicional (selecionadas > 0).
  - `ScrollArea` envolvendo um `<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-2">`.
  - Componente de card de foto inline com checkbox (`@/components/ui/checkbox`), imagem (thumbnail via `getPhotoUrl`), badge de vídeo se `mimeType?.startsWith('video/')`, botão de delete individual em hover.
- Novo handler `handleBulkDelete`:
  - Chama nova mutation `deletePhotos({ galleryId, photoIds: Array.from(selectedIds) })`.
  - Atualiza `localPhotoCount` subtraindo o tamanho.
  - Limpa seleção e fecha o dialog.
- Handler `toggleSelectAll`: marca/desmarca todas as `filteredPhotos`.
- Handler `toggleSelect(id)`: adiciona/remove do Set.

### `src/hooks/useSupabaseGalleries.ts`
- Adicionar nova mutation `deletePhotosMutation` (plural) que reaproveita a Edge Function `delete-photos` enviando `photoIds: string[]` completo (a função já aceita arrays — apenas chamamos uma única vez em vez de N).
- Exportar `deletePhotos: deletePhotosMutation.mutateAsync` e `isDeletingPhotos`.
- Manter `deletePhoto` (singular) para o botão individual e demais usos.
- `onSuccess` invalida as mesmas queries que a versão singular.

### Sem mudanças em
- Edge Functions (a `delete-photos` já suporta exclusão em lote).
- Banco de dados / migrações.
- Pipeline de upload, fluxo de pagamento, sessões `clientes_sessoes`, integração Gestão.
- Outras telas (galeria do cliente, deliver, etc.).

## Riscos e mitigações
- **Performance com 100+ fotos no grid**: as imagens já usam `loading="lazy"` e `getPhotoUrl(..., 'thumbnail')` (variante 256px). O `ScrollArea` limita a altura visível. Sem impacto além do atual.
- **Exclusão acidental em massa**: mitigada pelo `AlertDialog` de confirmação obrigatório e mensagem destacando irreversibilidade.
- **Race condition entre delete individual e bulk**: ambos os botões ficam desabilitados enquanto qualquer mutation de delete está pendente.
