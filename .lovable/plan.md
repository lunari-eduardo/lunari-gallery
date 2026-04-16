

Tornar o botão de seleção (círculo no canto superior esquerdo) **sempre visível** em todos os PhotoCards das galerias de seleção, removendo a dependência de hover.

## Mudança

Em `src/components/PhotoCard.tsx`, linha 97, remover as classes `opacity-0 group-hover:opacity-100` apenas do botão de seleção. Os botões de favoritar e comentar continuam aparecendo só no hover (comportamento atual preservado).

### Antes
```tsx
'border-white/80 bg-black/20 hover:border-white hover:bg-black/40 opacity-0 group-hover:opacity-100'
```

### Depois
```tsx
'border-white/80 bg-black/30 hover:border-white hover:bg-black/50'
```

Pequeno ajuste no `bg-black/20 → bg-black/30` para melhorar contraste do círculo sempre visível sobre fotos claras (visual mais nítido sem hover).

## Resultado

- **Mobile**: usuário vê o círculo de seleção imediatamente, basta tocar — sem precisar "passar o dedo" antes.
- **Desktop**: círculo discreto sempre presente, hover ainda escurece para feedback.
- Favoritar e comentar continuam como hover-only, evitando poluição visual.
- Lightbox (visualização ampliada) não é afetado — já tem botões de seleção visíveis no rodapé.

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/components/PhotoCard.tsx` | Remover `opacity-0 group-hover:opacity-100` do botão de seleção (linha 97) |

