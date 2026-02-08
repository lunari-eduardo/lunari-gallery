

# Plano: Sistema de Watermark com Modos System/Custom

## Resumo

Implementar dois comportamentos distintos para o `WatermarkOverlay`:

1. **System**: Imagem única que cobre a foto inteira (sem repetição)
2. **Custom**: Logo do fotógrafo em tile/mosaico (com repetição)

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     MODOS DE WATERMARK                                  │
└─────────────────────────────────────────────────────────────────────────┘

  SYSTEM (Padrão do Sistema)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Arquivos no R2:                                                    │
  │  - system-assets/default-watermark-h.png (2560x1440 - horizontal)   │
  │  - system-assets/default-watermark-v.png (1440x2560 - vertical)     │
  │                                                                     │
  │  Comportamento CSS:                                                 │
  │  - background-size: contain                                         │
  │  - background-position: center                                      │
  │  - background-repeat: no-repeat                                     │
  │  - Imagem se encaixa na foto sem cortar ou distorcer               │
  └─────────────────────────────────────────────────────────────────────┘

  CUSTOM (Minha Marca)
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Arquivo no R2:                                                     │
  │  - user-assets/{user_id}/watermark.png (tile pequeno ~200x200)     │
  │                                                                     │
  │  Comportamento CSS:                                                 │
  │  - background-size: {scale}% (configurável 10-50%)                 │
  │  - background-position: center                                      │
  │  - background-repeat: repeat                                        │
  │  - Logo repetido em mosaico cobrindo toda a foto                   │
  └─────────────────────────────────────────────────────────────────────┘

  NONE
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Sem overlay, foto exibida sem proteção                            │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## Mudanças no Código

### 1. Atualizar WatermarkOverlay.tsx

Nova interface com props para modo e orientação:

```typescript
interface WatermarkOverlayProps {
  /** Watermark mode: system, custom, or none */
  mode?: 'system' | 'custom' | 'none';
  /** Photo orientation for system mode */
  orientation?: 'horizontal' | 'vertical';
  /** Custom watermark path (for custom mode) */
  customPath?: string | null;
  /** Opacity from 0 to 100 */
  opacity?: number;
  /** Scale for custom mode tile (10-50%) */
  scale?: number;
  /** Additional CSS classes */
  className?: string;
}
```

Lógica do componente:

```typescript
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://media.lunarihub.com';

export function WatermarkOverlay({ 
  mode = 'system',
  orientation = 'horizontal',
  customPath,
  opacity = 40,
  scale = 30,
  className 
}: WatermarkOverlayProps) {
  if (mode === 'none') return null;

  const getBackgroundStyle = () => {
    if (mode === 'system') {
      // System: full-size watermark that fits the photo
      const suffix = orientation === 'horizontal' ? 'h' : 'v';
      const url = `${R2_PUBLIC_URL}/system-assets/default-watermark-${suffix}.png`;
      
      return {
        backgroundImage: `url("${url}")`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    
    if (mode === 'custom' && customPath) {
      // Custom: tiled logo pattern
      const url = `${R2_PUBLIC_URL}/${customPath}`;
      
      return {
        backgroundImage: `url("${url}")`,
        backgroundSize: `${scale}%`,
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
      };
    }
    
    // Fallback: inline SVG diagonal pattern
    return {
      backgroundImage: fallbackPattern,
      backgroundRepeat: 'repeat',
    };
  };

  return (
    <div
      className={cn(
        'absolute inset-0 z-10',
        'pointer-events-none select-none',
        className
      )}
      style={{
        ...getBackgroundStyle(),
        opacity: opacity / 100,
      }}
      aria-hidden="true"
      draggable={false}
    />
  );
}
```

### 2. Atualizar PhotoCard.tsx

Passar orientação da foto e configurações de watermark:

```typescript
interface PhotoCardProps {
  photo: GalleryPhoto;
  watermarkMode?: 'system' | 'custom' | 'none';
  watermarkCustomPath?: string | null;
  watermarkOpacity?: number;
  watermarkScale?: number;
  watermarkDisplay?: WatermarkDisplay;
  // ... resto das props
}

// No render:
{shouldShowWatermark && isLoaded && !hasError && (
  <WatermarkOverlay 
    mode={watermarkMode}
    orientation={photo.width > photo.height ? 'horizontal' : 'vertical'}
    customPath={watermarkCustomPath}
    opacity={watermarkOpacity}
    scale={watermarkScale}
  />
)}
```

### 3. Atualizar Lightbox.tsx

Mesmo padrão - passar configurações de watermark:

```typescript
interface LightboxProps {
  // ... props existentes
  watermarkMode?: 'system' | 'custom' | 'none';
  watermarkCustomPath?: string | null;
  watermarkOpacity?: number;
  watermarkScale?: number;
}

// No render:
{shouldShowWatermark && (
  <WatermarkOverlay 
    mode={watermarkMode}
    orientation={currentPhoto.width > currentPhoto.height ? 'horizontal' : 'vertical'}
    customPath={watermarkCustomPath}
    opacity={watermarkOpacity}
    scale={watermarkScale}
  />
)}
```

### 4. Atualizar ClientGallery.tsx

Buscar configurações de watermark do fotógrafo e passar para os componentes:

```typescript
// Na query de gallery-access, já deve vir watermark_mode, watermark_path, watermark_opacity, watermark_scale

const watermarkConfig = {
  mode: galleryData.watermark_mode || 'system',
  customPath: galleryData.watermark_path,
  opacity: galleryData.watermark_opacity || 40,
  scale: galleryData.watermark_scale || 30,
};

// Passar para PhotoCard e Lightbox
<PhotoCard
  photo={photo}
  watermarkMode={watermarkConfig.mode}
  watermarkCustomPath={watermarkConfig.customPath}
  watermarkOpacity={watermarkConfig.opacity}
  watermarkScale={watermarkConfig.scale}
  // ...
/>
```

---

## Arquivos para Upload no R2

Você precisa subir estes arquivos para o bucket:

| Caminho no R2 | Dimensões | Descrição |
|---------------|-----------|-----------|
| `system-assets/default-watermark-h.png` | 2560x1440 | Watermark para fotos horizontais |
| `system-assets/default-watermark-v.png` | 1440x2560 | Watermark para fotos verticais |

Especificações:
- Formato: PNG com transparência
- Resolução: Alta (2560px no lado maior)
- Conteúdo: Sua marca d'água padrão que será exibida sobre as fotos

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/WatermarkOverlay.tsx` | Refatorar para suportar modos system/custom |
| `src/components/PhotoCard.tsx` | Passar configurações de watermark |
| `src/components/Lightbox.tsx` | Passar configurações de watermark |
| `src/pages/ClientGallery.tsx` | Buscar e distribuir configurações de watermark |
| `supabase/functions/gallery-access/index.ts` | Retornar watermark settings na resposta |

---

## Fluxo de Dados

```text
photographer_accounts (DB)
    │
    │  watermark_mode
    │  watermark_path
    │  watermark_opacity
    │  watermark_scale
    │
    ▼
gallery-access (Edge Function)
    │
    │  Inclui watermark settings na resposta
    │
    ▼
ClientGallery.tsx
    │
    │  Extrai watermarkConfig do galleryData
    │
    ├──────────────────────┐
    │                      │
    ▼                      ▼
PhotoCard.tsx         Lightbox.tsx
    │                      │
    │                      │
    ▼                      ▼
WatermarkOverlay      WatermarkOverlay
(system ou custom)    (system ou custom)
```

---

## Resultado Final

| Cenário | Comportamento |
|---------|---------------|
| Fotógrafo escolhe "Padrão do Sistema" | Watermark única que se encaixa na foto (h ou v) |
| Fotógrafo escolhe "Minha Marca" | Logo em mosaico/tile sobre a foto |
| Fotógrafo escolhe "Nenhuma" | Sem overlay |
| Foto horizontal | Usa `default-watermark-h.png` |
| Foto vertical | Usa `default-watermark-v.png` |

---

## Próximos Passos

1. Você sobe os arquivos `default-watermark-h.png` e `default-watermark-v.png` para o R2
2. Eu implemento as mudanças no código
3. Testamos com ambos os modos

