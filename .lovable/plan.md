

# Correção: Loading State na Exclusão e Verificação de Limpeza R2

## Diagnóstico

### Loading State
O `DeleteGalleryDialog` (componente reutilizável) já possui estado de loading com spinner. Porém, o **Dashboard** (`src/pages/Dashboard.tsx`) usa um `AlertDialog` inline **sem nenhum estado de loading** — ao clicar "Excluir", o modal trava sem feedback visual até completar.

### Limpeza R2
A edge function `delete-photos` já busca e deleta todos os 5 caminhos de cada foto no R2: `storage_key`, `original_path`, `preview_path`, `preview_wm_path`, `thumb_path`. Portanto, os originais já são removidos do R2 **desde que `original_path` esteja preenchido no banco**. Isso está correto para uploads recentes.

## Mudanças

### 1. `src/pages/Dashboard.tsx` — Adicionar loading state ao dialog de exclusão

Adicionar estado `isDeleting` ao componente. Quando `handleDeleteConfirm` é chamado:
- Setar `isDeleting = true`
- Executar `deleteGallery()`
- Setar `isDeleting = false` no finally
- Desabilitar botões durante exclusão
- Mostrar `Loader2 animate-spin` + "Excluindo..." no botão de ação

### 2. `src/components/DeleteGalleryDialog.tsx` — Melhorar feedback visual

O componente já tem loading state funcional. Nenhuma alteração necessária — já exibe spinner e "Excluindo..." durante o processo.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Dashboard.tsx` | Adicionar `isDeleting` state com spinner e desabilitar botões durante exclusão |

