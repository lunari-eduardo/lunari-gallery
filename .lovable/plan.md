

# Unificar Botões de Favorito e Comentário

## Problema Identificado

Assim como acontecia com o botão de seleção, existem elementos duplicados para favoritos e comentários:

| Elemento | Posição | Visibilidade | Clicável |
|----------|---------|--------------|----------|
| Botão de comentário (linha 105-114) | Inferior direito | Apenas hover | Sim |
| Indicador de comentário (linha 140-148) | Superior direito | Sempre quando tem comentário | Não |
| Botão de favorito (linha 116-128) | Inferior direito | Apenas hover | Sim |
| Indicador de favorito (linha 133-138) | Superior direito | Sempre quando favoritado | Não |

Isso confunde o cliente que vê dois ícones para a mesma função.

## Solução

Aplicar o mesmo padrão usado no botão de seleção:
- **Mover os botões de favorito e comentário para o canto superior direito**
- **Torná-los sempre visíveis quando ativos, ou apenas no hover quando inativos**
- **Remover os indicadores visuais duplicados**

## Mudanças no `src/components/PhotoCard.tsx`

### 1. Adicionar botões de Favorito e Comentário fora do overlay (após o botão de seleção)

```tsx
{/* Selection button - always visible when selected, otherwise on hover only */}
<button ... >
  {isSelected && <Check className="h-4 w-4" />}
</button>

{/* Favorite button - always visible when favorited, otherwise on hover only */}
{onFavorite && (
  <button
    onClick={(e) => { e.stopPropagation(); onFavorite(); }}
    className={cn(
      'absolute top-3 right-3 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10',
      photo.isFavorite 
        ? 'bg-red-500 border-red-500 text-white' 
        : 'border-white/80 bg-black/20 hover:border-white hover:bg-black/40 text-white/80 hover:text-white opacity-0 group-hover:opacity-100'
    )}
  >
    <Heart className={cn("h-4 w-4", photo.isFavorite && "fill-current")} />
  </button>
)}

{/* Comment button - always visible when has comment, otherwise on hover only */}
{allowComments && (
  <button
    onClick={(e) => { e.stopPropagation(); onComment?.(); }}
    className={cn(
      'absolute top-3 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10',
      photo.comment 
        ? 'bg-primary border-primary text-primary-foreground' 
        : 'border-white/80 bg-black/20 hover:border-white hover:bg-black/40 text-white/80 hover:text-white opacity-0 group-hover:opacity-100',
      onFavorite ? 'right-11' : 'right-3'
    )}
  >
    <MessageSquare className="h-4 w-4" />
  </button>
)}
```

### 2. Remover botões duplicados do overlay (linhas 104-129)

O overlay ficará apenas com o nome do arquivo:

```tsx
{/* Overlay - appears only on hover */}
<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none">
  <div className="absolute bottom-3 left-3 right-3 pointer-events-auto">
    <span className="text-white/90 text-xs font-medium truncate max-w-[60%]">
      {photo.originalFilename || photo.filename}
    </span>
  </div>
</div>
```

### 3. Remover indicadores visuais duplicados (linhas 133-148)

Remover completamente:
- Indicador de favorito (linhas 133-138)
- Indicador de comentário (linhas 140-148)

## Resultado Visual Esperado

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Sem hover:                    Com hover:                        │
│  ┌──────────────┐              ┌──────────────┐                  │
│  │(✓)       💬❤️│              │(✓)       💬❤️│  ← Botões        │
│  │              │              │              │    clicáveis     │
│  │    imagem    │              │    imagem    │                  │
│  │              │              │              │                  │
│  │              │              │ DSC_001.jpg  │  ← Nome aparece  │
│  └──────────────┘              └──────────────┘    no hover      │
│   (botões ativos                                                 │
│    sempre visíveis)                                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Layout dos Botões (Canto Superior)

| Posição | Botão | Visibilidade |
|---------|-------|--------------|
| Esquerda (left-3) | ✓ Seleção | Sempre se selecionado, hover se não |
| Direita (right-3) | ❤️ Favorito | Sempre se favoritado, hover se não |
| Direita deslocado (right-11) | 💬 Comentário | Sempre se tem comentário, hover se não |

## Comportamento por Estado

| Estado | Visibilidade do botão |
|--------|----------------------|
| Ativo (selecionado/favoritado/com comentário) | Sempre visível, estilo preenchido |
| Inativo | Aparece apenas no hover, estilo outline/transparente |

## Arquivo a Modificar

- `src/components/PhotoCard.tsx`

