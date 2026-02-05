
# Implementação Final: Sistema de Watermark com Mosaico (Tiling) e Proteção Total

## Visão Geral

Este plano implementa um sistema de proteção de imagens robusto com duas abordagens distintas:

1. **Padrão do Sistema** - Overlay de linhas diagonais cobrindo toda a foto
2. **Minha Marca** - Logo do usuário repetido em mosaico (tiling)

---

## Arquitetura do Fluxo

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Settings)                          │
│  ┌─────────────────────────────────────────────────────────────────│
│  │  WatermarkSettings.tsx                                           │
│  │  ├── Upload PNG → gallery-upload/upload-watermark               │
│  │  └── Salva path: user-assets/{userId}/watermark.png             │
│  └─────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (GalleryCreate)                         │
│  ┌─────────────────────────────────────────────────────────────────│
│  │  Seletor "Proteção da Imagem":                                  │
│  │  ├── Nenhuma (none)                                             │
│  │  ├── Padrão do Sistema (system) ← Linhas diagonais             │
│  │  └── Minha Marca (custom) ← Logo em mosaico                     │
│  └─────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 BACKEND (process-photos Edge Function)              │
│  ┌─────────────────────────────────────────────────────────────────│
│  │  1. Busca watermark_mode de photographer_accounts               │
│  │  2. Busca watermark_mode da galeria (configuracoes.watermark)   │
│  │  3. Envia payload com configuração ao Worker                    │
│  └─────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER (lunari-image-processor)             │
│  ┌─────────────────────────────────────────────────────────────────│
│  │  1. Busca original do B2                                        │
│  │  2. PRIMEIRO: Redimensiona para preview (1200px)                │
│  │  3. SEGUNDO: Aplica proteção:                                   │
│  │     ├── system → Estica default-pattern.png (linhas diagonais) │
│  │     └── custom → Repete logo em mosaico (tiling)               │
│  │  4. Salva no R2: thumb, preview, preview-wm                     │
│  └─────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Preparar Assets do Sistema

### 1.1 Arquivo de Pattern Padrão

Você precisa fazer upload manual do arquivo `default-pattern.png` para o bucket R2 `lunari-previews`:

**Caminho:** `system-assets/default-pattern.png`

**Especificações do pattern:**
- Dimensão recomendada: 2560x2560px (vai ser esticado para cobrir a foto)
- Fundo transparente (PNG)
- Linhas diagonais finas e discretas
- Opacidade já aplicada na imagem (30-40%)

---

## Fase 2: Modificar Frontend

### 2.1 Atualizar WatermarkSettings.tsx

**Objetivo:** Melhorar o texto da interface para refletir a funcionalidade de mosaico.

Mudanças:
- Atualizar descrição para mencionar que o logo será aplicado em mosaico
- Manter o slider de opacidade
- O slider de "Tamanho" agora controla o tamanho de cada tile do mosaico

### 2.2 Atualizar GalleryCreate.tsx

**Objetivo:** Renomear labels e melhorar UX do seletor de watermark.

Mudanças no Step 3 (Configurações):
- Mudar label de "Marca D'água" para "Proteção da Imagem"
- Atualizar textos das opções:
  - "Padrão" → "Padrão do Sistema" (linhas diagonais)
  - "Minha Marca" → "Minha Marca" (logo em mosaico)
  - "Nenhuma" → mantém

Preview visual:
- Para "Padrão do Sistema": Mostrar ícone de linhas diagonais
- Para "Minha Marca": Mostrar preview do logo do usuário (se existir)

---

## Fase 3: Modificar Edge Function (process-photos)

### 3.1 Atualizar Interface WatermarkConfig

Adicionar campo `tiling` para diferenciar os modos de aplicação:

```typescript
interface WatermarkConfig {
  mode: 'system' | 'custom' | 'none';
  path?: string;           // Para custom: user-assets/{userId}/watermark.png
  opacity: number;         // 10-100%
  scale: number;           // 10-50% (tamanho do tile para mosaico)
  tiling: boolean;         // true = mosaico, false = overlay único
}
```

### 3.2 Lógica de Decisão

```typescript
// Determinar configuração de watermark
const watermarkConfig: WatermarkConfig = {
  mode: account.watermark_mode || 'system',
  path: account.watermark_path,
  opacity: account.watermark_opacity || 40,
  scale: account.watermark_scale || 30,
  tiling: account.watermark_mode === 'custom', // Mosaico só para custom
};
```

---

## Fase 4: Modificar Cloudflare Worker (lunari-image-processor)

Esta é a parte mais complexa - implementar dois algoritmos diferentes de aplicação de watermark.

### 4.1 Nova Interface

```typescript
interface WatermarkConfig {
  mode: 'system' | 'custom' | 'none';
  path?: string;
  opacity: number;
  scale: number;
  tiling: boolean;  // NOVO: true para mosaico
}
```

### 4.2 Algoritmo A: Overlay Total (Sistema)

```text
Fluxo para mode = 'system':
1. Buscar system-assets/default-pattern.png do R2
2. Redimensionar pattern para EXATAMENTE o tamanho da foto de preview
3. Aplicar blend na posição (0, 0) - cobre foto inteira
4. Aplicar opacidade configurada
```

Implementação:
```typescript
async function applySystemOverlay(
  baseImage: PhotonImage,
  env: Env,
  opacity: number
): Promise<Uint8Array> {
  // Buscar pattern do R2
  const patternObj = await env.GALLERY_BUCKET.get('system-assets/default-pattern.png');
  if (!patternObj) throw new Error('System pattern not found');
  
  const patternBytes = new Uint8Array(await patternObj.arrayBuffer());
  const patternImage = PhotonImage.new_from_byteslice(patternBytes);
  
  // Redimensionar para tamanho exato da foto
  const baseWidth = baseImage.get_width();
  const baseHeight = baseImage.get_height();
  const scaledPattern = resize(patternImage, baseWidth, baseHeight, SamplingFilter.Lanczos3);
  patternImage.free();
  
  // Aplicar overlay na posição (0, 0) - cobre tudo
  blend(baseImage, scaledPattern, "over", 0, 0);
  scaledPattern.free();
  
  return baseImage.get_bytes_jpeg(85);
}
```

### 4.3 Algoritmo B: Mosaico/Tiling (Custom)

```text
Fluxo para mode = 'custom':
1. Buscar user-assets/{userId}/watermark.png do R2
2. Calcular tamanho do tile (scale% da menor dimensão)
3. Loop: percorrer toda a largura/altura da foto
4. Para cada posição do grid, aplicar blend do logo
5. Aplicar opacidade configurada
```

Implementação:
```typescript
async function applyTiledWatermark(
  baseImage: PhotonImage,
  watermarkBytes: Uint8Array,
  opacity: number,
  scale: number
): Promise<Uint8Array> {
  const wmImage = PhotonImage.new_from_byteslice(watermarkBytes);
  
  const baseWidth = baseImage.get_width();
  const baseHeight = baseImage.get_height();
  const minDim = Math.min(baseWidth, baseHeight);
  
  // Calcular tamanho do tile (ex: 15% da menor dimensão)
  const wmOrigWidth = wmImage.get_width();
  const wmOrigHeight = wmImage.get_height();
  const wmRatio = wmOrigWidth / wmOrigHeight;
  
  const tileWidth = Math.round(minDim * (scale / 100));
  const tileHeight = Math.round(tileWidth / wmRatio);
  
  // Redimensionar watermark para tamanho do tile
  const resizedWm = resize(wmImage, tileWidth, tileHeight, SamplingFilter.Lanczos3);
  wmImage.free();
  
  // Espaçamento entre tiles (pode ser 1.5x o tamanho do tile)
  const spacingX = Math.round(tileWidth * 1.5);
  const spacingY = Math.round(tileHeight * 1.5);
  
  // Loop: aplicar em grid
  // Offset inicial para centralizar o pattern
  const offsetX = Math.round((spacingX - tileWidth) / 2);
  const offsetY = Math.round((spacingY - tileHeight) / 2);
  
  for (let y = offsetY; y < baseHeight; y += spacingY) {
    for (let x = offsetX; x < baseWidth; x += spacingX) {
      // Verificar se tile cabe na imagem (parcialmente ok)
      if (x + tileWidth > 0 && y + tileHeight > 0) {
        blend(baseImage, resizedWm, "over", x, y);
      }
    }
  }
  
  resizedWm.free();
  return baseImage.get_bytes_jpeg(85);
}
```

### 4.4 Função Principal de Aplicação

```typescript
async function applyWatermarkProtection(
  originalBytes: Uint8Array,
  config: WatermarkConfig,
  userId: string,
  env: Env
): Promise<Uint8Array> {
  // 1. PRIMEIRO: Redimensionar para preview (1200px)
  const { image: previewImage } = resizeImage(originalBytes, 1200);
  
  // 2. Se nenhuma proteção, retornar preview sem watermark
  if (config.mode === 'none') {
    const result = previewImage.get_bytes_jpeg(85);
    previewImage.free();
    return result;
  }
  
  // 3. SEGUNDO: Aplicar proteção baseada no modo
  if (config.mode === 'system') {
    // Overlay total com linhas diagonais
    return await applySystemOverlay(previewImage, env, config.opacity);
  }
  
  if (config.mode === 'custom' && config.path) {
    // Buscar watermark customizada do R2
    const wmPath = config.path; // user-assets/{userId}/watermark.png
    const wmObj = await env.GALLERY_BUCKET.get(wmPath);
    
    if (!wmObj) {
      console.warn(`Custom watermark not found: ${wmPath}, falling back to system`);
      return await applySystemOverlay(previewImage, env, config.opacity);
    }
    
    const wmBytes = new Uint8Array(await wmObj.arrayBuffer());
    
    // Aplicar em mosaico
    return await applyTiledWatermark(
      previewImage,
      wmBytes,
      config.opacity,
      config.scale
    );
  }
  
  // Fallback: retornar sem watermark
  const result = previewImage.get_bytes_jpeg(85);
  previewImage.free();
  return result;
}
```

---

## Fase 5: Atualizar Banco de Dados (Opcional)

Para suportar configuração por galeria (não apenas global), pode ser útil adicionar campos à tabela `galerias`:

```sql
-- Opcional: se quiser override por galeria
ALTER TABLE galerias ADD COLUMN IF NOT EXISTS watermark_mode text;
ALTER TABLE galerias ADD COLUMN IF NOT EXISTS watermark_opacity integer;
```

Por enquanto, usamos as configurações do `photographer_accounts` (global).

---

## Resumo de Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/components/settings/WatermarkSettings.tsx` | Atualizar textos para refletir funcionalidade de mosaico |
| `src/pages/GalleryCreate.tsx` | Renomear labels, melhorar preview das opções |
| `supabase/functions/process-photos/index.ts` | Adicionar campo `tiling` ao WatermarkConfig |
| `cloudflare/workers/image-processor/index.ts` | **Principal:** Implementar `applySystemOverlay` e `applyTiledWatermark` |

---

## Checklist de Implementação

### Pré-requisitos (Manual)
- [ ] Upload de `default-pattern.png` para R2 em `system-assets/default-pattern.png`

### Código
- [ ] Atualizar textos em WatermarkSettings.tsx
- [ ] Atualizar labels em GalleryCreate.tsx
- [ ] Adicionar `tiling: boolean` ao WatermarkConfig no process-photos
- [ ] Implementar `applySystemOverlay()` no image-processor Worker
- [ ] Implementar `applyTiledWatermark()` no image-processor Worker
- [ ] Atualizar função principal `processPhoto()` para usar nova lógica
- [ ] Testar com imagens pequenas primeiro

### Deploy
- [ ] Redeploy do Worker `lunari-image-processor` via CLI:
  ```bash
  cd cloudflare/workers/image-processor
  npm install
  wrangler deploy
  ```

### Testes
- [ ] Testar mode = 'none' (sem watermark)
- [ ] Testar mode = 'system' (overlay de linhas)
- [ ] Testar mode = 'custom' (mosaico do logo)
- [ ] Verificar que proteção cobre foto inteira
- [ ] Verificar opacidade funciona corretamente

---

## Notas Técnicas Importantes

1. **Ordem de operações:** SEMPRE redimensionar a foto PRIMEIRO, depois aplicar watermark. Isso garante que a watermark tenha tamanho proporcional ao resultado final.

2. **Memory management:** O Photon WASM requer que você chame `.free()` em todas as imagens após uso para evitar memory leaks.

3. **Fallback:** Se a watermark customizada não existir, o sistema deve fazer fallback para o pattern padrão.

4. **R2 paths:**
   - Pattern do sistema: `system-assets/default-pattern.png`
   - Watermark customizada: `user-assets/{userId}/watermark.png`

5. **Blend mode:** Usamos `"over"` que respeita a transparência do PNG.
