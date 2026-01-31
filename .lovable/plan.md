

# Melhoria do Painel de Seleção do Fotógrafo

## Resumo das Alterações

Vamos transformar a aba "Seleção" do painel do fotógrafo para torná-la mais organizada e funcional, ocultando as fotos por padrão e adicionando filtros e visualização de comentários.

---

## Mudanças Propostas

### 1. Ocultar fotos por padrão + Botão "Ver fotos selecionadas"

**Comportamento atual**: As fotos selecionadas são exibidas imediatamente em um MasonryGrid.

**Novo comportamento**: 
- Mostrar apenas um resumo com contagem de fotos
- Adicionar botão "Ver fotos selecionadas" que expande uma lista vertical
- Ao clicar, mostrar lista com thumbnails 1:1 (quadradas)

### 2. Nova Lista Vertical com Comentários

Quando o fotógrafo clica em "Ver fotos selecionadas":

| Thumbnail (1:1) | Informações |
|-----------------|-------------|
| 80x80px quadrado | Código da foto (DSC_0001.jpg) |
| | 💬 Comentário do cliente (se houver) |
| | ❤️ Ícone se favoritada |

### 3. Badge de Comentários no Resumo

Adicionar badge visível antes de expandir as fotos:
- "3 comentários" (se houver comentários)
- "2 favoritas" (contagem de favoritas)

### 4. Filtro para Copiar Códigos de Favoritas

No modal `PhotoCodesModal`, adicionar opção de filtrar:
- ✅ Todas as selecionadas (comportamento atual)
- ❤️ Apenas favoritas

---

## Arquivo Principal: `src/pages/GalleryDetail.tsx`

### Mudança 1: Adicionar estados para controle

```typescript
// Adicionar após linha 51 (outros estados)
const [showSelectedPhotos, setShowSelectedPhotos] = useState(false);
const [codesFilter, setCodesFilter] = useState<'all' | 'favorites'>('all');
```

### Mudança 2: Calcular estatísticas de fotos

```typescript
// Adicionar após linha 261 (selectedPhotos)
const favoritePhotos = selectedPhotos.filter(p => p.isFavorite);
const photosWithComments = selectedPhotos.filter(p => p.comment);
```

### Mudança 3: Substituir o MasonryGrid por nova interface

**Linhas 589-616** - Substituir conteúdo da aba Selection:

```tsx
<TabsContent value="selection" className="space-y-6">
  <div className="grid gap-6 lg:grid-cols-3">
    <div className="lg:col-span-2 space-y-4">
      {/* Resumo com badges */}
      <div className="lunari-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-medium">
              {selectedPhotos.length} foto{selectedPhotos.length !== 1 ? 's' : ''} selecionada{selectedPhotos.length !== 1 ? 's' : ''}
            </span>
            
            {/* Badges */}
            <div className="flex items-center gap-2">
              {favoritePhotos.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                  <Heart className="h-3 w-3 fill-current" />
                  {favoritePhotos.length} favorita{favoritePhotos.length !== 1 ? 's' : ''}
                </span>
              )}
              
              {photosWithComments.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <MessageSquare className="h-3 w-3" />
                  {photosWithComments.length} comentário{photosWithComments.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          {selectedPhotos.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSelectedPhotos(!showSelectedPhotos)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showSelectedPhotos ? 'Ocultar fotos' : 'Ver fotos selecionadas'}
            </Button>
          )}
        </div>
      </div>
      
      {/* Lista vertical de fotos (expansível) */}
      {showSelectedPhotos && selectedPhotos.length > 0 && (
        <div className="lunari-card divide-y">
          {selectedPhotos.map((photo) => (
            <div 
              key={photo.id} 
              className="flex items-start gap-4 p-3 hover:bg-muted/50 transition-colors"
            >
              {/* Thumbnail 1:1 */}
              <div 
                className="w-16 h-16 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => setLightboxIndex(transformedPhotos.findIndex(p => p.id === photo.id))}
              >
                <img 
                  src={photo.thumbnailUrl} 
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm truncate">
                    {photo.originalFilename || photo.filename}
                  </span>
                  {photo.isFavorite && (
                    <Heart className="h-4 w-4 text-red-500 fill-current flex-shrink-0" />
                  )}
                </div>
                
                {photo.comment && (
                  <div className="mt-1 text-sm text-muted-foreground flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{photo.comment}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Empty state */}
      {selectedPhotos.length === 0 && (
        <div className="text-center py-16 lunari-card">
          <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhuma foto selecionada ainda
          </p>
        </div>
      )}
    </div>

    {/* Sidebar - mantém SelectionSummary + Payment + Botões */}
    <div>
      <SelectionSummary ... />
      
      {/* Payment Status Card ... */}
      
      {/* Botão de códigos com filtro de favoritas */}
      {selectedPhotos.length > 0 && (
        <div className="mt-4 space-y-2">
          <Button 
            variant="terracotta" 
            className="w-full"
            onClick={() => {
              setCodesFilter('all');
              setIsCodesModalOpen(true);
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Códigos para separação das fotos
          </Button>
          
          {favoritePhotos.length > 0 && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setCodesFilter('favorites');
                setIsCodesModalOpen(true);
              }}
            >
              <Heart className="h-4 w-4 mr-2" />
              Códigos só das favoritas ({favoritePhotos.length})
            </Button>
          )}
        </div>
      )}
    </div>
  </div>
</TabsContent>
```

### Mudança 4: Adicionar imports necessários

```typescript
// Linha 14 - adicionar MessageSquare e Heart aos imports de lucide-react
import { 
  ArrowLeft, Send, Eye, FileText, User, Calendar, Image, 
  AlertCircle, Loader2, Pencil, Check, Clock, RefreshCw,
  MessageSquare, Heart  // ← Adicionar
} from 'lucide-react';
```

---

## Arquivo: `src/components/PhotoCodesModal.tsx`

### Mudança: Adicionar prop de filtro

```typescript
// Adicionar à interface (linha 24-29)
interface PhotoCodesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: GalleryPhoto[];
  clientName: string;
  filter?: 'all' | 'favorites';  // ← Novo
}

// Linha 47 - usar o filtro
const selectedPhotos = photos.filter(p => {
  if (!p.isSelected) return false;
  if (filter === 'favorites') return p.isFavorite;
  return true;
});
```

---

## Resultado Visual Esperado

```text
┌─────────────────────────────────────────────────────────────────┐
│  Aba: Seleção (4)                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  4 fotos selecionadas   ❤️ 2 favoritas  💬 3 comentários   │ │
│  │                                    [Ver fotos selecionadas]│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  (Quando expandido)                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ┌─────┐  DSC_0001.jpg  ❤️                                 │ │
│  │ │ 1:1 │  💬 "Amei essa foto do beijo!"                     │ │
│  │ └─────┘                                                    │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ ┌─────┐  DSC_0015.jpg                                      │ │
│  │ │ 1:1 │                                                    │ │
│  │ └─────┘                                                    │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ ┌─────┐  DSC_0032.jpg  ❤️                                 │ │
│  │ │ 1:1 │  💬 "Essa para o quadro da sala"                   │ │
│  │ └─────┘                                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                              ┌──────────────────────┐           │
│                              │   Resumo da Seleção  │           │
│                              │   ...                │           │
│                              ├──────────────────────┤           │
│                              │[Códigos - Todas]     │           │
│                              │[Códigos - Favoritas] │           │
│                              └──────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/GalleryDetail.tsx` | 1. Adicionar imports (Heart, MessageSquare)<br>2. Adicionar estados (showSelectedPhotos, codesFilter)<br>3. Calcular favoritePhotos e photosWithComments<br>4. Substituir MasonryGrid por nova interface com lista vertical<br>5. Adicionar botão de filtro de favoritas para códigos |
| `src/components/PhotoCodesModal.tsx` | 1. Adicionar prop `filter`<br>2. Filtrar fotos baseado no tipo selecionado |

---

## Benefícios

1. **Interface mais limpa**: Fotos ocultas por padrão, focando no resumo
2. **Visibilidade de comentários**: Fotógrafo vê todos os comentários do cliente de uma vez
3. **Filtro de favoritas**: Facilita separar fotos que o cliente marcou como preferidas
4. **Badges informativos**: Contagem rápida de favoritas e comentários antes de expandir
5. **Lista vertical**: Mais adequada para visualizar informações detalhadas (código + comentário)

