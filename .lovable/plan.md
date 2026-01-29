
# Plano: Melhorias no Card de Fotos e Reorganização da Exclusão

## Resumo

Este plano cobre três modificações na página de edição de galeria:
1. **Rolagem completa no card de fotos** para ver todas as fotos
2. **Ícone de lixeira** em cada foto para exclusão individual
3. **Mover "Excluir galeria"** para cima e remover o card antigo

---

## Modificação 1: Rolagem no Card de Fotos

### Situação Atual
O card de fotos já usa `ScrollArea` com `max-h-[300px]`, limitando a visualização.

### Solução
Aumentar a altura máxima para `max-h-[400px]` ou `max-h-[450px]` permitindo ver mais fotos de uma vez, mantendo a rolagem para galerias muito grandes.

---

## Modificação 2: Ícone de Lixeira para Excluir Foto

### Situação Atual
Não existe funcionalidade para excluir fotos individuais - apenas exclusão em massa quando a galeria é deletada.

### Solução

**1. Adicionar mutation no hook `useSupabaseGalleries.ts`:**

```typescript
const deletePhotoMutation = useMutation({
  mutationFn: async ({ galleryId, photoId }: { galleryId: string; photoId: string }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Call delete-photos edge function for single photo
    const response = await fetch(
      `https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/delete-photos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          galleryId,
          photoIds: [photoId],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete photo');
    }

    return response.json();
  },
  onSuccess: (_, { galleryId }) => {
    queryClient.invalidateQueries({ queryKey: ['galeria-fotos', galleryId] });
    queryClient.invalidateQueries({ queryKey: ['galerias'] });
    toast.success('Foto excluída');
  },
  onError: (error) => {
    console.error('Error deleting photo:', error);
    toast.error('Erro ao excluir foto');
  },
});
```

**2. Expor a função no hook:**

```typescript
return {
  // ... existing exports
  deletePhoto: deletePhotoMutation.mutateAsync,
  isDeletingPhoto: deletePhotoMutation.isPending,
};
```

**3. Atualizar GalleryEdit.tsx - Adicionar lixeira na tabela:**

```tsx
import { Trash2 } from 'lucide-react';

// Dentro do TableRow de cada foto:
<TableRow key={photo.id}>
  <TableCell className="w-14 p-2">
    <img ... />
  </TableCell>
  <TableCell className="p-2">
    <span className="text-sm truncate block max-w-[200px]">
      {photo.originalFilename}
    </span>
  </TableCell>
  <TableCell className="w-10 p-2">
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={() => handleDeletePhoto(photo.id)}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </TableCell>
</TableRow>
```

**4. Handler para exclusão:**

```typescript
const handleDeletePhoto = async (photoId: string) => {
  if (!confirm('Excluir esta foto permanentemente?')) return;
  
  await deletePhoto({ galleryId: gallery.id, photoId });
  setLocalPhotoCount(prev => Math.max(0, (prev || 1) - 1));
};
```

---

## Modificação 3: Mover "Excluir Galeria" e Remover Card

### Situação Atual (linhas 573-612)
Existe um card "Ações da Galeria" com:
- Opção de reativar (condicional)
- Link de texto "Excluir galeria permanentemente"

### Solução
1. Mover o link "Excluir galeria" para logo abaixo do card de Prazo de Seleção (coluna esquerda)
2. Manter apenas o card de "Reativar Galeria" se `canReactivate` for true
3. Se não houver ações de reativação, não mostrar card algum

### Nova estrutura da coluna esquerda:

```tsx
{/* Left Column - Info & Deadline */}
<div className="space-y-6">
  {/* Basic Info Card */}
  <Card>...</Card>

  {/* Deadline Card */}
  <Card>...</Card>

  {/* Delete Gallery - Text link only, no card */}
  <DeleteGalleryDialog
    galleryName={gallery.nomeSessao || 'Esta galeria'}
    onDelete={handleDelete}
    trigger={
      <button className="text-sm text-destructive hover:underline">
        Excluir galeria
      </button>
    }
  />
</div>
```

### Coluna direita - Simplificar:

```tsx
{/* Right Column - Photos & Reactivate */}
<div className="space-y-6">
  {/* Photos Card */}
  <Card>...</Card>

  {/* Reactivate Card - Only if applicable */}
  {canReactivate && (
    <Card>
      <CardHeader>
        <CardTitle>Reativar Galeria</CardTitle>
        <CardDescription>
          Permite que o cliente faça novas seleções
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReactivateGalleryDialog ... />
      </CardContent>
    </Card>
  )}
</div>
```

---

## Resumo de Arquivos

| Arquivo | Modificações |
|---------|--------------|
| `src/hooks/useSupabaseGalleries.ts` | Adicionar `deletePhotoMutation` e exportar `deletePhoto` |
| `src/pages/GalleryEdit.tsx` | Adicionar lixeira nas fotos, mover "Excluir galeria", remover card de ações |

---

## Visualização Final

```text
┌─────────────────────────────────────────────────────────────────┐
│  ← Editar Galeria                        [Salvar Alterações]   │
│    Teste                                                        │
├────────────────────────────────┬────────────────────────────────┤
│  📷 Informações da Galeria     │  📷 Fotos da Galeria           │
│  Nome, Cliente, Senha, etc.    │  14 fotos nesta galeria        │
│                                │  ┌────────────────────────────┐│
│                                │  │ [img] LISE2739.JPG    🗑  ││
│                                │  │ [img] LISE2740.JPG    🗑  ││
│                                │  │ [img] LISE2736.JPG    🗑  ││
├────────────────────────────────┤  │ [img] LISE2759.JPG    🗑  ││
│  📅 Prazo de Seleção           │  │ ... (scrollable)       🗑  ││
│  Data limite  [+7] [+14] [+30] │  └────────────────────────────┘│
│                                │  [Adicionar Fotos]             │
├────────────────────────────────┼────────────────────────────────┤
│  Excluir galeria               │  (Card Reativar - se aplicável)│
│  ↑ texto vermelho, sem card    │                                │
└────────────────────────────────┴────────────────────────────────┘
```

---

## Ordem de Implementação

1. **useSupabaseGalleries.ts** - Adicionar mutation `deletePhoto`
2. **GalleryEdit.tsx** - Implementar todas as mudanças de UI:
   - Adicionar import do `Trash2`
   - Obter `deletePhoto` do hook
   - Adicionar handler `handleDeletePhoto`
   - Atualizar tabela de fotos com lixeira
   - Mover "Excluir galeria" para coluna esquerda
   - Remover/simplificar card de ações
