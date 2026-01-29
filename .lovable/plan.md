
# Plano: Correção da Rolagem de Fotos e Remoção da Confirmação

## Problemas Identificados

### Problema 1: Rolagem Não Funciona
O `ScrollArea` na linha 538 usa `max-h-[450px]`, mas o componente Radix UI ScrollArea precisa de uma altura fixa (`h-[450px]`) em vez de altura máxima para que a rolagem funcione corretamente.

### Problema 2: Confirmação do Navegador
Na linha 250, o `handleDeletePhoto` usa `confirm()` do navegador que interrompe a experiência e reinicia a posição de rolagem quando o diálogo é fechado.

---

## Solução

### Arquivo: `src/pages/GalleryEdit.tsx`

#### Modificação 1: Corrigir ScrollArea (linha 538)

**De:**
```tsx
<ScrollArea className="max-h-[450px] rounded-md border">
```

**Para:**
```tsx
<ScrollArea className="h-[450px] rounded-md border">
```

Usar altura fixa permite que o ScrollArea calcule corretamente o overflow e habilite a rolagem.

#### Modificação 2: Remover confirmação (linhas 249-254)

**De:**
```typescript
const handleDeletePhoto = async (photoId: string) => {
  if (!confirm('Excluir esta foto permanentemente?')) return;
  
  await deletePhoto({ galleryId: gallery.id, photoId });
  setLocalPhotoCount(prev => Math.max(0, (prev || 1) - 1));
};
```

**Para:**
```typescript
const handleDeletePhoto = async (photoId: string) => {
  await deletePhoto({ galleryId: gallery.id, photoId });
  setLocalPhotoCount(prev => Math.max(0, (prev || 1) - 1));
};
```

Isso remove a confirmação do navegador, permitindo exclusão direta ao clicar no ícone de lixeira. A posição de rolagem será mantida pois não há mais diálogo modal interrompendo o fluxo.

---

## Resumo de Alterações

| Linha | Alteração |
|-------|-----------|
| 250 | Remover linha com `if (!confirm(...)) return;` |
| 538 | Mudar `max-h-[450px]` para `h-[450px]` |

---

## Resultado Esperado

1. ✅ Todas as 14 fotos serão visíveis com rolagem
2. ✅ Exclusão direta sem popup de confirmação
3. ✅ Posição de rolagem mantida após exclusão
