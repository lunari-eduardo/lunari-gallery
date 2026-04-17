

# Plano: Marca d'água personalizada em padrão repetido (tile)

## Mudanças no algoritmo (`src/lib/imageCompression.ts`)

**Função `applyWatermark`** — quando `mode === 'custom'`, substituir o desenho centralizado por padrão tile rotacionado:

1. Carregar a imagem da marca (mesma lógica atual, mas usar **um único path** — sem distinção horizontal/vertical, já que o tile cobre tudo)
2. Calcular tamanho do tile baseado em `scale`:
   - `pequeno` → 12% da menor dimensão da foto
   - `medio` → 18% (padrão)
   - `grande` → 26%
3. Renderizar tile com:
   - `ctx.save()` + `ctx.translate(centerX, centerY)` + `ctx.rotate(-45°)` + `ctx.translate(-centerX, -centerY)`
   - Loop duplo desenhando a marca em grade
   - Espaçamento automático = `tileWidth * 1.6` (gap horizontal) e `tileHeight * 2.0` (gap vertical) — densidade que evita áreas limpas grandes
   - Offset diagonal para cobrir cantos após rotação (estender bounds em ~40% além das dimensões)
   - `ctx.restore()` ao final
4. `mode === 'system'` permanece inalterado (centralizado, padrão original)

## Tipos e estado

**`WatermarkConfig` em `imageCompression.ts`:**
- Adicionar `tileScale?: 'small' | 'medium' | 'large'` (default `medium`)
- Manter `customPathHorizontal/Vertical` para retrocompat, mas usar apenas o primeiro disponível

**`useWatermarkSettings.ts`:**
- Reaproveitar coluna existente `watermark_scale` (integer) mapeando: 15 → small, 25 → medium, 40 → large
- Não precisa migração de banco

**`GalleryCreate.tsx`:**
- Passar `tileScale` derivado de `watermarkSettings.scale` no `watermarkConfig`

## UI (`src/components/settings/WatermarkSettings.tsx`)

Quando `mode === 'custom'`:

1. **Texto informativo** — substituir:
   > "A marca será aplicada em padrão repetido cobrindo toda a imagem."
2. **Novo controle "Tamanho da marca"** logo abaixo do uploader, antes do slider de opacidade:
   - `ToggleGroup` compacto com 3 opções: Pequeno · Médio · Grande
   - Default Médio
   - Salva via `saveSettings({ scale: 15|25|40 })`
3. **Opacidade** — slider permanece igual

## Preview (`WatermarkUploader.tsx`)

Substituir o `<img>` único por um preview tile real:

- Container fixo (~120px altura) com fundo neutro (foto placeholder cinza claro)
- `<div>` com `backgroundImage: url(watermark)`, `backgroundRepeat: 'repeat'`, `backgroundSize` baseado em `scale`, `transform: rotate(-45deg) scale(1.4)` (scale extra para cobrir cantos), `opacity: opacity/100`
- Receber `opacity` e `scale` como novas props vindas do `WatermarkSettings`
- Mostra fielmente como ficará nas fotos

## Detalhes técnicos invisíveis

- Rotação fixa **-45°**
- Espaçamento horizontal: `tileWidth * 1.6`
- Espaçamento vertical: `tileHeight * 2.0`
- Bounds estendidos em ~40% para garantir cobertura de cantos pós-rotação
- Densidade calibrada para resoluções 1024/1920/2560 (já que `maxLongEdge` varia)

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/imageCompression.ts` | Algoritmo tile rotacionado para `mode === 'custom'`; novo campo `tileScale` no `WatermarkConfig` |
| `src/components/settings/WatermarkSettings.tsx` | Remover texto antigo; adicionar `ToggleGroup` Tamanho; passar opacity+scale ao uploader |
| `src/components/settings/WatermarkUploader.tsx` | Preview tile real (CSS `repeat` + rotação) refletindo opacity e scale |
| `src/pages/GalleryCreate.tsx` | Repassar `tileScale` derivado de `watermarkSettings.scale` |

## Resultado

- "Minha Marca" → sempre tile rotacionado cobrindo a foto inteira
- Usuário escolhe apenas opacidade e tamanho (3 opções)
- Preview mostra exatamente como ficará
- Modo `system` (centralizado) inalterado
- Nenhuma migração de banco necessária

