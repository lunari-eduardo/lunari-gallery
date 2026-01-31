

# Refinamento Visual: Indicadores de Seleção e Favoritos

## Problema Identificado

No componente `PhotoCard.tsx`, o ícone de seleção (check) só aparece quando o mouse está sobre a foto, enquanto o ícone de favorito (coração) permanece sempre visível. Isso causa inconsistência na experiência do usuário.

## Mudanças Propostas

### Arquivo: `src/components/PhotoCard.tsx`

| Problema | Solução |
|----------|---------|
| Check só aparece no hover | Mover o indicador de seleção para FORA do overlay de hover |
| Borda nas fotos selecionadas | Remover classes `ring-2 ring-primary ring-offset-1` |
| Inconsistência visual | Aplicar mesmo padrão do coração para o check |

### Mudança 1: Remover borda de seleção (linha 45)

```typescript
// ANTES:
className={cn(
  'group relative overflow-hidden bg-muted cursor-pointer transition-all duration-300',
  isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
  disabled && 'opacity-60 cursor-not-allowed'
)}

// DEPOIS:
className={cn(
  'group relative overflow-hidden bg-muted cursor-pointer transition-all duration-300',
  disabled && 'opacity-60 cursor-not-allowed'
)}
```

### Mudança 2: Adicionar indicador de seleção sempre visível (após linha 146)

Adicionar novo indicador de seleção no canto superior esquerdo, similar ao coração no canto direito:

```tsx
{/* Selection indicator - always visible when selected */}
{isSelected && (
  <div className="absolute top-3 left-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
    <Check className="h-3 w-3 text-primary-foreground" />
  </div>
)}
```

### Mudança 3: Ajustar posição do coração e comentário (evitar sobreposição)

Manter os indicadores no canto superior direito:
- **Favorito**: `top-3 right-3` (posição atual)
- **Comentário**: `top-3 right-3` quando não há favorito, ou `top-3 right-11` quando há favorito

```tsx
{/* Favorite indicator - always visible when favorited */}
{photo.isFavorite && (
  <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
    <Heart className="h-3 w-3 text-white fill-current" />
  </div>
)}

{/* Comment indicator - positioned based on favorite presence */}
{photo.comment && (
  <div className={cn(
    "absolute top-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center",
    photo.isFavorite ? "right-11" : "right-3"
  )}>
    <MessageSquare className="h-3 w-3 text-primary-foreground" />
  </div>
)}
```

## Resultado Visual Esperado

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Foto NÃO selecionada:     Foto SELECIONADA + FAVORITA:     │
│  ┌──────────────┐          ┌──────────────┐                 │
│  │              │          │✓           ❤️│                 │
│  │              │          │              │                 │
│  │    imagem    │          │    imagem    │                 │
│  │              │          │              │                 │
│  │              │          │              │                 │
│  └──────────────┘          └──────────────┘                 │
│     (sem borda)               (sem borda)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Layout dos Indicadores

| Canto | Indicador | Condição |
|-------|-----------|----------|
| Superior esquerdo | ✓ Check (primary) | `isSelected` |
| Superior direito | ❤️ Coração (red-500) | `photo.isFavorite` |
| Superior direito (deslocado) | 💬 Comentário (primary) | `photo.comment` |

## Hover Behavior

Os controles de hover (overlay) continuam funcionando normalmente para:
- Botão de seleção clicável (canto esquerdo)
- Botão de favorito clicável (canto direito inferior)
- Botão de comentário clicável (canto direito inferior)
- Nome do arquivo (rodapé)

Os indicadores permanentes são apenas visuais e não interativos - servem para mostrar o estado atual da foto sem precisar passar o mouse.

## Arquivo a Modificar

- `src/components/PhotoCard.tsx`

