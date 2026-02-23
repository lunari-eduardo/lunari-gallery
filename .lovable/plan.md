

# Escala Global do Sistema para 90%

## O que sera feito

Adicionar uma regra CSS no `html` para reduzir o tamanho base de fonte para 90%, o que efetivamente escala todo o sistema (ja que Tailwind e rem-based) para o equivalente de zoom 90% do navegador.

## Mudanca

**Arquivo:** `src/index.css`

Na segunda camada `@layer base`, adicionar ao seletor existente ou criar regra para `html`:

```css
html {
  font-size: 90%;
}
```

Isso escala automaticamente todos os elementos que usam `rem` (tipografia, padding, margins, gaps, alturas) -- que e praticamente tudo no Tailwind CSS.

## Por que funciona

- Tailwind usa `rem` como unidade base (1rem = font-size do html)
- Ao reduzir o font-size do html de 16px (padrao) para 14.4px (90%), todo o layout encolhe proporcionalmente
- Equivale exatamente ao efeito de zoom 90% do navegador
- Nao afeta valores em `px` absolutos (poucos no sistema)

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/index.css` | Adicionar `html { font-size: 90%; }` na camada base |

