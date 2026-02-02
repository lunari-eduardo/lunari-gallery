
# Correção: Estado de Seleção Perdido ao Minimizar Página

## Problema Identificado

O React Query está configurado com `staleTime: 0` (padrão) e `refetchOnWindowFocus: true` (padrão). Isso significa que:

1. Quando o usuário minimiza e volta à página, um **refetch automático** é disparado
2. O `useEffect` sobrescreve `localPhotos` com os dados do refetch
3. Se houver qualquer inconsistência de timing ou cache, as alterações visuais são perdidas

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Fluxo atual (com bug)                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Seleciona foto → Mutation salva no banco → localPhotos = ✓     │
│                                                                     │
│  2. Minimiza página                                                 │
│                                                                     │
│  3. Restaura página → React Query refetch → useEffect sobrescreve  │
│                                                                     │
│  4. Se dados do refetch forem "antigos" → Seleção "desaparece"     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Solução

Atualizar o cache do React Query **após cada mutation bem-sucedida** em vez de depender apenas do estado local. Assim, quando o refetch ocorrer, o cache já terá os dados corretos.

### Estratégia: Invalidate + setQueryData

```typescript
// Após mutation bem-sucedida, atualizar o cache do React Query
onSuccess: (data) => {
  // 1. Atualizar estado local (feedback imediato)
  setLocalPhotos(prev => prev.map(p => ...));
  
  // 2. Atualizar cache do React Query (previne sobrescrita no refetch)
  queryClient.setQueryData(['client-gallery-photos', galleryId], (old) => {
    if (!old) return old;
    return old.map((p) => 
      p.id === data.photo.id 
        ? { ...p, is_selected: data.photo.is_selected, ... }
        : p
    );
  });
}
```

---

## Mudanças Técnicas

### Arquivo: `src/pages/ClientGallery.tsx`

#### 1. Atualizar `selectionMutation.onSuccess` (linhas 357-368)

**Antes:**
```typescript
onSuccess: (data) => {
  setLocalPhotos(prev => prev.map(p => 
    p.id === data.photo.id 
      ? { ...p, isSelected: data.photo.is_selected, ... } 
      : p
  ));
},
```

**Depois:**
```typescript
onSuccess: (data) => {
  // 1. Atualizar estado local para feedback visual imediato
  setLocalPhotos(prev => prev.map(p => 
    p.id === data.photo.id 
      ? { 
          ...p, 
          isSelected: data.photo.is_selected, 
          isFavorite: data.photo.is_favorite ?? p.isFavorite,
          comment: data.photo.comment || p.comment 
        } 
      : p
  ));
  
  // 2. Sincronizar cache do React Query para prevenir sobrescrita no refetch
  queryClient.setQueryData(['client-gallery-photos', galleryId], (oldData: any[]) => {
    if (!oldData) return oldData;
    return oldData.map((p) => 
      p.id === data.photo.id 
        ? { 
            ...p, 
            is_selected: data.photo.is_selected,
            is_favorite: data.photo.is_favorite ?? p.is_favorite,
            comment: data.photo.comment ?? p.comment,
          } 
        : p
    );
  });
},
```

#### 2. Adicionar proteção no useEffect (linha 446)

Evitar sobrescrever `localPhotos` se já tiver dados e não houver mudança real:

**Antes:**
```typescript
useEffect(() => {
  if (photos.length > 0) {
    setLocalPhotos(photos);
    // ...
  }
}, [photos, supabaseGallery?.status_selecao, supabaseGallery?.finalized_at]);
```

**Depois:**
```typescript
useEffect(() => {
  if (photos.length > 0) {
    // Só sobrescrever se ainda não tiver fotos locais (primeira carga)
    // ou se for realmente uma mudança estrutural (quantidade diferente)
    setLocalPhotos(prev => {
      if (prev.length === 0 || prev.length !== photos.length) {
        return photos;
      }
      // Atualizar apenas campos não-editáveis (URLs, dimensions)
      // mantendo is_selected, is_favorite, comment do estado local
      return prev.map(localPhoto => {
        const serverPhoto = photos.find(p => p.id === localPhoto.id);
        return serverPhoto ? {
          ...serverPhoto,
          isSelected: localPhoto.isSelected,
          isFavorite: localPhoto.isFavorite,
          comment: localPhoto.comment,
        } : localPhoto;
      });
    });
    
    const isAlreadyConfirmed = supabaseGallery?.status_selecao === 'confirmado' || 
                               supabaseGallery?.finalized_at;
    setIsConfirmed(!!isAlreadyConfirmed);
    if (isAlreadyConfirmed) {
      setCurrentStep('confirmed');
      setShowWelcome(false);
    }
  }
}, [photos, supabaseGallery?.status_selecao, supabaseGallery?.finalized_at]);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ClientGallery.tsx` | Sincronizar cache após mutation + proteger useEffect |

---

## Resultado Esperado

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Fluxo corrigido                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Seleciona foto → Mutation salva no banco                        │
│                    → localPhotos atualizado ✓                       │
│                    → Cache do React Query atualizado ✓              │
│                                                                     │
│  2. Minimiza página                                                 │
│                                                                     │
│  3. Restaura página → React Query refetch → Cache já está correto   │
│                     → useEffect preserva seleções locais            │
│                                                                     │
│  4. Estado permanece consistente ✓                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Benefícios

1. **Consistência**: Estado local e cache do React Query sempre sincronizados
2. **Resiliência**: Refetch automático não sobrescreve alterações do usuário
3. **Performance**: Sem necessidade de desabilitar `refetchOnWindowFocus` globalmente
4. **Offline-friendly**: Estado local é preservado mesmo se o refetch falhar
