

# Plano: Padronização da Tela Pós-Finalização da Galeria

## Visão Geral

Refatorar o comportamento de galerias finalizadas para um padrão único e simples:
- Cliente SEMPRE vê a **preview das fotos selecionadas** (miniaturas + fullscreen)
- **NUNCA** há mensagem de bloqueio ou tela estática
- Se **download ativado**: botão "Baixar Todas" no header + botão de download individual no Lightbox
- Se **download desativado**: apenas visualização (sem botões de download)

---

## Comportamento Atual (Problemático)

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO ATUAL (CONFUSO)                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Galeria Finalizada + allowDownload=false                                     │
│    → FinalizedGalleryScreen (tela estática com mensagem de bloqueio)          │
│    → Nenhuma preview das fotos                                                │
│                                                                               │
│  Galeria Finalizada + allowDownload=true                                      │
│    → FinalizedGalleryScreen + DownloadModal sobre ela                         │
│    → Modal não pode ser fechado (onClose vazio)                               │
│    → Experiência confusa e não intuitiva                                      │
│                                                                               │
│  Galeria Confirmada internamente (isConfirmed=true via state)                 │
│    → Tela de preview com fotos selecionadas (correto!)                        │
│    → Mas só funciona se o cliente NÃO recarregar a página                     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Comportamento Novo (Padronizado)

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                     FLUXO NOVO (ÚNICO E SIMPLES)                              │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  QUALQUER galeria finalizada (pública, privada, Gestão):                      │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  Header: Logo do estúdio                                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │  │
│  │  │  "Seleção Confirmada" + {X} fotos                               │    │  │
│  │  │  [Baixar Todas] ← Apenas se allowDownload=true                  │    │  │
│  │  └─────────────────────────────────────────────────────────────────┘    │  │
│  │                                                                         │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                                   │  │
│  │  │ Foto │ │ Foto │ │ Foto │ │ Foto │  ← Clicável para fullscreen       │  │
│  │  │  1   │ │  2   │ │  3   │ │  4   │     SEM watermark                 │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘                                   │  │
│  │                                                                         │  │
│  │  Lightbox:                                                              │  │
│  │    - Foto original SEM watermark                                        │  │
│  │    - Botão [⬇️] apenas se allowDownload=true                           │  │
│  │    - Navegação com setas                                                │  │
│  │    - SEM botões de seleção/favorito/comentário                         │  │
│  │                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/FinalizedGalleryScreen.tsx` | **Deletar** | Tela de bloqueio não mais usada |
| `src/components/FinalizedPreviewScreen.tsx` | **Criar** | Nova tela de preview padronizada |
| `src/pages/ClientGallery.tsx` | **Modificar** | Usar nova tela para TODAS galerias finalizadas |
| `supabase/functions/gallery-access/index.ts` | **Modificar** | SEMPRE retornar fotos quando finalized=true |

---

## Implementação Detalhada

### 1. Deletar `FinalizedGalleryScreen.tsx`

Este componente mostra apenas uma mensagem de bloqueio sem fotos. Será substituído pelo novo componente.

### 2. Criar `FinalizedPreviewScreen.tsx`

Novo componente que mostra:
- Header com logo do estúdio
- Banner informativo "Seleção Confirmada - X fotos"
- Botão "Baixar Todas (ZIP)" se `allowDownload=true`
- Grid de miniaturas clicáveis (MasonryGrid)
- Lightbox integrado para fullscreen
- Download individual no Lightbox se `allowDownload=true`

```typescript
interface FinalizedPreviewScreenProps {
  photos: Array<{
    id: string;
    storageKey: string;
    filename: string;
    originalFilename: string;
  }>;
  sessionName: string;
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;
  studioLogoUrl?: string;
  studioName?: string;
  allowDownload: boolean;
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}
```

### 3. Modificar Edge Function `gallery-access`

Atualmente, a Edge Function só retorna fotos quando `allowDownload=true`. 
Precisamos **SEMPRE** retornar as fotos selecionadas para galerias finalizadas:

```typescript
// ANTES: só retorna fotos se allowDownload
if (allowDownload) {
  const { data: selectedPhotos } = await supabase.from("galeria_fotos")...
  return { finalized: true, allowDownload: true, photos: selectedPhotos };
}
return { finalized: true, allowDownload: false }; // SEM FOTOS

// DEPOIS: sempre retorna fotos
const { data: selectedPhotos } = await supabase.from("galeria_fotos")...
return { 
  finalized: true, 
  allowDownload: allowDownload, // true ou false
  photos: selectedPhotos || []   // SEMPRE inclui fotos
};
```

### 4. Modificar `ClientGallery.tsx`

Substituir a lógica atual de `galleryResponse?.finalized`:

```typescript
// ANTES (linhas 728-765)
if (galleryResponse?.finalized) {
  // Lógica complexa com FinalizedGalleryScreen + DownloadModal
}

// DEPOIS
if (galleryResponse?.finalized) {
  return (
    <FinalizedPreviewScreen
      photos={galleryResponse.photos || []}
      sessionName={galleryResponse.sessionName}
      sessionFont={getFontFamilyById(galleryResponse?.settings?.sessionFont)}
      titleCaseMode={galleryResponse?.settings?.titleCaseMode || 'normal'}
      studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
      studioName={galleryResponse.studioSettings?.studio_name}
      allowDownload={galleryResponse.allowDownload}
      themeStyles={themeStyles}
      backgroundMode={effectiveBackgroundMode}
    />
  );
}
```

### 5. Limpar código desnecessário

- Remover `FinalizedGalleryScreen` de imports
- Remover lógica duplicada de "confirmed mode" após confirmação interna
- Simplificar fluxo unificando visualização pós-confirmação com visualização de galeria finalizada

---

## Estrutura do Novo Componente

```typescript
// src/components/FinalizedPreviewScreen.tsx

export function FinalizedPreviewScreen({
  photos,
  sessionName,
  sessionFont,
  titleCaseMode = 'normal',
  studioLogoUrl,
  studioName,
  allowDownload,
  themeStyles,
  backgroundMode = 'light',
}: FinalizedPreviewScreenProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  // Transform photos for display
  const transformedPhotos = photos.map(p => ({
    id: p.id,
    storageKey: p.storageKey || p.storage_key,
    filename: p.filename,
    originalFilename: p.originalFilename || p.original_filename,
    // Use original URL (no watermark) for thumbnails
    thumbnailUrl: getOriginalPhotoUrl(p.storageKey || p.storage_key),
    previewUrl: getOriginalPhotoUrl(p.storageKey || p.storage_key),
  }));

  const handleDownloadAll = async () => {
    // Lógica de download em lote (similar ao DownloadModal)
  };

  return (
    <div className={cn("min-h-screen bg-background", backgroundMode === 'dark' && 'dark')} style={themeStyles}>
      {/* Header com logo */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-center px-4 py-4">
          {studioLogoUrl ? <img src={studioLogoUrl} ... /> : <Logo />}
        </div>
      </header>

      {/* Banner informativo */}
      <div className="bg-primary/10 border-b p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Check className="h-5 w-5 text-primary" />
          <h2 className="font-medium">Seleção Confirmada</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {photos.length} fotos selecionadas
        </p>
        
        {/* Botão de download - apenas se permitido */}
        {allowDownload && photos.length > 0 && (
          <Button onClick={handleDownloadAll} disabled={isDownloading}>
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? `Baixando... ${progressPercent}%` : 'Baixar Todas (ZIP)'}
          </Button>
        )}
      </div>

      {/* Grid de fotos */}
      <main className="p-4">
        <MasonryGrid>
          {transformedPhotos.map((photo, index) => (
            <MasonryItem key={photo.id}>
              <div 
                className="cursor-pointer rounded-lg overflow-hidden"
                onClick={() => setLightboxIndex(index)}
              >
                <img src={photo.thumbnailUrl} alt="" className="w-full" />
              </div>
            </MasonryItem>
          ))}
        </MasonryGrid>
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={transformedPhotos}
          currentIndex={lightboxIndex}
          allowComments={false}
          allowDownload={allowDownload}
          disabled={true}
          isConfirmedMode={true}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={() => {}}
        />
      )}
    </div>
  );
}
```

---

## Fluxo Simplificado Final

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO ÚNICO PÓS-FINALIZAÇÃO                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Cliente finaliza seleção (com ou sem pagamento)                         │
│     └─> status_selecao = 'confirmado'                                       │
│     └─> finalized_at = now()                                                │
│                                                                             │
│  2. Cliente retorna à galeria (qualquer momento)                            │
│     └─> Edge Function detecta finalized=true                                │
│     └─> Retorna fotos selecionadas + allowDownload flag                     │
│                                                                             │
│  3. Frontend renderiza FinalizedPreviewScreen                               │
│     └─> Grid de miniaturas SEM watermark                                    │
│     └─> Lightbox SEM watermark                                              │
│     └─> SE allowDownload=true:                                              │
│         ├─> Botão "Baixar Todas" no banner                                  │
│         └─> Botão download no Lightbox                                      │
│                                                                             │
│  4. Cliente pode visualizar e baixar (se permitido)                         │
│     └─> Sem mensagens de bloqueio                                           │
│     └─> Sem modais obrigatórios                                             │
│     └─> Experiência limpa e intuitiva                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Códigos a Remover

1. **FinalizedGalleryScreen.tsx** - Arquivo inteiro (tela de bloqueio)
2. **DownloadModal** na renderização de galeria finalizada - O download agora é integrado na tela
3. **Lógica duplicada** em ClientGallery.tsx para "confirmed mode" interno vs "finalized" do backend

---

## Resultado Esperado

1. **Comportamento único** para todas galerias finalizadas
2. **Preview sempre disponível** - cliente vê suas fotos selecionadas
3. **Download condicional** - botão aparece apenas se configurado
4. **Sem bloqueios** - experiência fluida e profissional
5. **Fotos sem watermark** - visualização premium após confirmação

