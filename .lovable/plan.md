
# Centralizar Grid de Fotos com Largura Máxima Premium

## Problema Atual

As imagens mostram claramente dois cenários problemáticos:

1. **10 fotos**: O grid preenche 5 colunas mas sobra espaço no lado direito
2. **3 fotos**: O grid fica totalmente alinhado à esquerda com muito espaço vazio

Isso acontece porque o container não tem largura máxima e não é centralizado.

## Solução

Adicionar um wrapper centralizado com largura máxima apropriada para experiência premium em desktop, mantendo comportamento fluido em mobile.

### Abordagem Visual

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ANTES                              DEPOIS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───┬───┬───┬───┬───┐             │     ┌───┬───┬───┬───┬───┐     │
│  │   │   │   │   │   │      →      │     │   │   │   │   │   │     │
│  └───┴───┴───┴───┴───┘             │     └───┴───┴───┴───┴───┘     │
│  ┌───┬───┐                         │     ┌───┬───┬───┬───┬───┐     │
│  │   │   │      espaço vazio       │     │   │   │   │   │   │     │
│  └───┴───┘                         │     └───┴───┴───┴───┴───┘     │
│                                                                     │
│  Alinhado à esquerda               Centralizado com max-width      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementação Técnica

### 1. Atualizar CSS do Masonry Grid

No `src/index.css`, adicionar centralização ao container:

**Adicionar:**
```css
.masonry-container {
  width: 100%;
  max-width: 1800px;
  margin: 0 auto;
  padding: 0 0.5rem;
}

@media (min-width: 640px) {
  .masonry-container {
    padding: 0 1rem;
  }
}

@media (min-width: 1024px) {
  .masonry-container {
    padding: 0 1.5rem;
  }
}
```

### 2. Atualizar Componente MasonryGrid

No `src/components/MasonryGrid.tsx`, envolver a grid em um container centralizado:

```tsx
export function MasonryGrid({ children, className }: MasonryGridProps) {
  return (
    <div className="masonry-container">
      <div className={cn('masonry-grid', className)}>
        {children}
      </div>
    </div>
  );
}
```

### 3. Ajustar Páginas que Usam a Grid

Simplificar o wrapper em `ClientGallery.tsx` e `GalleryPreview.tsx`:

**Antes:**
```tsx
<main className="flex-1 px-1 sm:px-2 py-2 pb-20">
```

**Depois:**
```tsx
<main className="flex-1 py-2 pb-20">
```

(O padding horizontal agora é gerenciado pelo `.masonry-container`)

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/index.css` | Adicionar classe `.masonry-container` com max-width e centralização |
| `src/components/MasonryGrid.tsx` | Envolver grid em container centralizado |
| `src/pages/ClientGallery.tsx` | Remover padding horizontal do `<main>` |
| `src/pages/GalleryPreview.tsx` | Remover padding horizontal do `<main>` |

## Resultado Esperado

- **Desktop ultrawide**: Grid centralizada com máx 1800px, margem elegante nas laterais
- **Desktop normal**: Grid usa toda a largura disponível até 1800px
- **Mobile**: Comportamento atual mantido (full width)

A experiência fica mais próxima de galerias fotográficas profissionais como Pixieset, Pic-Time e PASS.
