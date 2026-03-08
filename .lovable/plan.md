

## Corrigir Dropdowns Transparentes

### Problema
O `SelectContent` usa `bg-popover` que tem opacidade 0.42 no modo claro, mas **não tem `backdrop-blur`** — diferente do `DropdownMenuContent` e `PopoverContent` que já têm `backdrop-blur-xl`. Isso faz o dropdown do Select ficar transparente e ilegível.

### Solução
Adicionar `backdrop-blur-xl` e `border-border/50` ao `SelectContent` em `src/components/ui/select.tsx`, alinhando com o padrão já usado nos outros componentes de overlay (Dropdown, Popover).

### Alteração

**`src/components/ui/select.tsx`** — linha 69, adicionar `backdrop-blur-xl border-border/50` à className do `SelectPrimitive.Content`:

Antes:
```
"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md ..."
```

Depois:
```
"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border/50 bg-popover text-popover-foreground shadow-md backdrop-blur-xl ..."
```

Apenas 1 arquivo, 1 linha alterada.

