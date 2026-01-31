

# Correção: Unificar Botão de Seleção

## Problema

Atualmente existem dois elementos separados para seleção:

| Elemento | Tipo | Visibilidade | Clicável |
|----------|------|--------------|----------|
| Botão no hover (linhas 85-97) | `<button>` | Apenas no hover | Sim |
| Indicador permanente (linhas 133-138) | `<div>` | Sempre quando selecionado | Não (abre foto) |

Quando o usuário clica no indicador permanente para desmarcar, o clique passa para o container e abre o lightbox.

## Solução

Remover o indicador visual separado e transformar o botão de seleção existente em um elemento **sempre visível**, não apenas no hover.

### Mudanças no `src/components/PhotoCard.tsx`

#### 1. Mover o botão de seleção para FORA do overlay de hover

Atualmente o botão está dentro do overlay (linha 82-131) que só aparece no hover. Precisamos movê-lo para fora, tornando-o sempre visível.

#### 2. Remover o indicador visual duplicado

Remover as linhas 133-138 que criam o `<div>` não-clicável.

#### 3. Ajustar estilos para visibilidade constante

O botão de seleção terá estilos diferentes baseados no estado:
- **Não selecionado**: Aparece apenas no hover (comportamento atual)
- **Selecionado**: Sempre visível como indicador clicável

### Código Final

```tsx
{/* Selection button - always visible when selected, otherwise on hover only */}
<button
  onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(); }}
  disabled={disabled}
  className={cn(
    'absolute top-3 left-3 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-10',
    isSelected 
      ? 'bg-primary border-primary text-primary-foreground' 
      : 'border-white/80 bg-black/20 hover:border-white hover:bg-black/40 opacity-0 group-hover:opacity-100',
    disabled && 'pointer-events-none'
  )}
>
  {isSelected && <Check className="h-4 w-4" />}
</button>

{/* Overlay - appears only on hover (SEM o botão de seleção) */}
<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none">
  {/* Apenas informações e ações no rodapé */}
  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
    ...
  </div>
</div>

{/* REMOVER: o indicador visual separado (linhas 133-138) */}
```

## Resultado Esperado

| Estado | Comportamento |
|--------|---------------|
| Foto não selecionada | Botão aparece no hover, clicável |
| Foto selecionada | Botão sempre visível com check, clicável para desmarcar |

```text
┌──────────────┐      ┌──────────────┐
│              │      │(✓)          │  ← Botão sempre visível e clicável
│   imagem     │  →   │   imagem     │
│              │      │              │
└──────────────┘      └──────────────┘
  Não selecionado       Selecionado
```

## Arquivo a Modificar

- `src/components/PhotoCard.tsx`

