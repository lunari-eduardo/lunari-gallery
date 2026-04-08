
# Adicionar "Excluir todas as fotos" na criação de galeria

## Problema

Após o upload ser concluído, o fotógrafo só pode excluir fotos uma a uma. Se enviou as fotos erradas, precisa refazer a galeria inteira — não existe opção de limpar tudo de uma vez.

## Solução

Adicionar um botão "Excluir todas" ao lado do botão "Ver fotos" / "Ocultar" na seção de fotos enviadas. Ao clicar, abre um `AlertDialog` de confirmação. Após confirmar, a exclusão acontece em background (batch via Edge Function `delete-photos`) com feedback visual de progresso.

### Fluxo do usuário

1. Fotos enviadas → seção mostra "5 fotos enviadas" com botões "Ver fotos" e **"Excluir todas"**
2. Clica em "Excluir todas" → AlertDialog: "Tem certeza que deseja excluir todas as {N} fotos? Os créditos serão devolvidos."
3. Confirma → botão muda para spinner "Excluindo..." → chama `delete-photos` com todos os IDs de uma vez
4. Sucesso → toast "X fotos excluídas e créditos devolvidos" → lista limpa, contador zerado

### Detalhes técnicos

**`src/pages/GalleryCreate.tsx`**:
- Novo state: `isDeletingAll` (boolean)
- Nova função `handleDeleteAllPhotos`:
  - Coleta todos os IDs de `uploadedPhotos`
  - Chama `deletePhoto` da Edge Function com todos os photoIds de uma vez (já suporta array)
  - Chama `refund_photo_credit` N vezes via RPC (ou um novo batch — mas para simplicidade, N chamadas sequenciais)
  - Limpa `uploadedPhotos` e `uploadedCount`
- Botão `Trash2` + "Excluir todas" ao lado do CollapsibleTrigger, com `AlertDialog` de confirmação
- Durante exclusão, botão mostra `Loader2` + "Excluindo..."

**Observação sobre créditos**: A Edge Function `delete-photos` já deleta múltiplas fotos em batch. Para o estorno de créditos, usaremos N chamadas ao `refund_photo_credit` RPC (já existe e funciona). Alternativa seria criar um `refund_photo_credits_batch`, mas para manter simplicidade e não criar migração desnecessária, N chamadas sequenciais são suficientes (máximo ~200 fotos por galeria na criação).

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/GalleryCreate.tsx` | Adicionar state `isDeletingAll`, função `handleDeleteAllPhotos`, botão + AlertDialog na seção de fotos enviadas |

Nenhuma Edge Function ou migração necessária — reutiliza infraestrutura existente.
