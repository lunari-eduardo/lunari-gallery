
# Refinamento Visual -- Planos e Creditos (Premium)

## Problemas identificados

1. **Desktop**: Os dois blocos (Select e Transfer) nao tem separacao visual clara -- parecem flutuar sem estrutura. O historico de compras fica "solto" com valores distantes.
2. **Mobile**: Sem separador entre Select e Transfer, tudo parece um unico produto empilhado.
3. **Combo plans**: Cards com bordas pesadas, botoes largos demais para a estetica premium.

## Solucao

**Arquivo: `src/pages/Credits.tsx`** -- ajustes visuais

### Desktop (md+)

- Adicionar um `Separator` vertical (via CSS `md:border-l border-border/40`) no bloco Transfer, com `md:pl-12` para criar respiro visual claro entre os dois produtos
- Manter grid `md:grid-cols-2` mas com alinhamento mais controlado

### Mobile

- Adicionar `Separator` horizontal entre os blocos Select e Transfer (componente `<Separator />` ou `<div className="border-t border-border/30">`)
- Adicionar `pt-6` no bloco Transfer mobile para espaco apos o separador

### Historico de compras

- Reduzir gap lateral entre valores e data -- usar `gap-2` em vez de `gap-3`
- Adicionar `tabular-nums` nos valores monetarios para alinhamento numerico

### Combo plans (bloco inferior)

- Colocar os 2 cards lado a lado no desktop: `md:grid-cols-2`
- Reduzir padding dos cards combo
- Botoes menores: ja sao `size="sm"` mas reduzir `px` para `px-4`

### Detalhes tecnicos

Mudancas concentradas em `Credits.tsx`:

1. **Grid wrapper**: manter `grid-cols-1 md:grid-cols-2` mas adicionar classe no bloco Transfer: `md:border-l md:border-border/30 md:pl-12`
2. **Separador mobile**: inserir `<Separator className="md:hidden" />` entre os dois blocos (requer reestruturar o grid para usar flex no mobile ou inserir o separador como terceiro elemento do grid com `col-span-full md:hidden`)
3. **Combo grid**: mudar de `grid-cols-1` para `grid-cols-1 md:grid-cols-2`
4. **Botoes combo**: `px-4` em vez de `px-5`
5. **Historico valores**: `gap-2` e `font-variant-numeric: tabular-nums`

| Arquivo | Mudanca |
|---|---|
| `src/pages/Credits.tsx` | Separador vertical desktop, separador horizontal mobile, combo cards lado a lado, refinamentos tipograficos |
