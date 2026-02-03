
# Plano: Funcionalidade de Download Premium (Fotos Originais sem Watermark)

## Visão Geral

Implementar a liberação de download de fotos originais (SEM watermark) após pagamento ou confirmação de seleção, com experiência premium que inclui modal informativo e opções de download individual ou em lote.

---

## Arquitetura Proposta

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE DOWNLOAD PÓS-CONFIRMAÇÃO                             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────────────────┐ │
│  │    TELA CONFIRMAÇÃO     │    │              MODAL DE DOWNLOAD                  │ │
│  │    (isConfirmed=true)   │    │                                                 │ │
│  │                         │    │  ┌───────────────────────────────────────────┐  │ │
│  │  [Ver Fotos Selecionadas]│───►│  │ 🎉 Suas fotos estão prontas!             │  │ │
│  │                         │    │  │                                           │  │ │
│  │  [Botão: Baixar Fotos]──┼───►│  │ ⚠️ Importante: Esta é a única vez que    │  │ │
│  │                         │    │  │ você poderá acessar suas fotos originais  │  │ │
│  └─────────────────────────┘    │  │ em alta resolução sem marca d'água.       │  │ │
│                                 │  │                                           │  │ │
│                                 │  │ 📁 12 fotos selecionadas                  │  │ │
│                                 │  │                                           │  │ │
│                                 │  │ ┌───────────────────────────────────────┐ │  │ │
│                                 │  │ │ [Baixar Todas] [ZIP] (Recomendado)    │ │  │ │
│                                 │  │ └───────────────────────────────────────┘ │  │ │
│                                 │  │                                           │  │ │
│                                 │  │ Ou baixe individualmente no Lightbox      │  │ │
│                                 │  └───────────────────────────────────────────┘  │ │
│                                 └─────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │                       LIGHTBOX (Modo Confirmado)                                ││
│  │                                                                                 ││
│  │   [Foto sem watermark - originalUrl direto do B2]                               ││
│  │                                                                                 ││
│  │   Botões: [⬇️ Baixar] - faz download da foto original                          ││
│  │                                                                                 ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Lógica de URL de Download (SEM Watermark)

### Atual (COM Watermark)
```typescript
// src/lib/cloudinaryUrl.ts
getCloudinaryPhotoUrl(storagePath, 'full', watermarkSettings)
// → Cloudinary transforma + adiciona watermark
```

### Nova Função (SEM Watermark)
```typescript
// Adicionar em cloudinaryUrl.ts
export function getOriginalPhotoUrl(storagePath: string): string {
  if (!storagePath) return '/placeholder.svg';
  
  // Retorna URL direta do B2 (sem Cloudinary = sem watermark)
  return `${B2_BUCKET_URL}/${storagePath}`;
}
```

Alternativamente, para otimização (qualidade + CDN):
```typescript
export function getOriginalPhotoUrl(storagePath: string): string {
  if (!storagePath) return '/placeholder.svg';
  
  // Cloudinary fetch SEM overlay de watermark (qualidade original)
  const sourceUrl = `${B2_BUCKET_URL}/${storagePath}`;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/f_auto,q_100/${sourceUrl}`;
}
```

---

## Componentes a Criar/Modificar

### 1. NOVO: `src/components/DownloadModal.tsx`

Modal premium que aparece após confirmação/pagamento informando que as fotos estão disponíveis para download:

| Elemento | Descrição |
|----------|-----------|
| Título | "Suas fotos estão prontas!" com ícone celebratório |
| Aviso | Mensagem alertando que esta é a única oportunidade de acessar as fotos |
| Contagem | Número de fotos selecionadas disponíveis |
| Botão Principal | "Baixar Todas" - download em lote (ZIP) |
| Botão Secundário | Link para visualizar no grid e baixar individualmente |

```typescript
interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: GalleryPhoto[];  // Apenas fotos selecionadas
  sessionName: string;
  onDownloadAll: () => void;
  onDownloadIndividual: () => void;
}
```

### 2. NOVO: `src/lib/downloadUtils.ts`

Utilitários para download de fotos:

```typescript
// Download individual (direto do B2 sem watermark)
export async function downloadPhoto(
  storageKey: string, 
  filename: string
): Promise<void> {
  const url = getOriginalPhotoUrl(storageKey);
  const response = await fetch(url);
  const blob = await response.blob();
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Download em lote (cria ZIP no cliente)
export async function downloadAllPhotos(
  photos: Array<{ storageKey: string; filename: string }>,
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // Usar JSZip ou similar para criar ZIP no cliente
  // Ou chamar Edge Function para gerar ZIP no servidor
}
```

### 3. MODIFICAR: `src/components/Lightbox.tsx`

Quando em modo confirmado + allowDownload:
- Exibir foto **SEM watermark** (usar `originalUrl` do B2 direto)
- Botão de download baixa a foto original

```typescript
// Prop adicional
isConfirmedMode?: boolean;  // true = fotos pagas/confirmadas

// Lógica de URL
const displayUrl = isConfirmedMode && allowDownload 
  ? getOriginalPhotoUrl(currentPhoto.storageKey)  // Sem watermark
  : currentPhoto.previewUrl;                       // Com watermark

// Download handler atualizado
const handleDownload = async () => {
  if (!currentPhoto || !allowDownload) return;
  
  // Download da original SEM watermark
  await downloadPhoto(
    currentPhoto.storageKey,
    currentPhoto.originalFilename
  );
};
```

### 4. MODIFICAR: `src/pages/ClientGallery.tsx`

Na seção de galeria confirmada (linha ~856-972):

```typescript
// Estado do modal
const [showDownloadModal, setShowDownloadModal] = useState(false);

// Exibir modal automaticamente após confirmação quando allowDownload=true
useEffect(() => {
  if (isConfirmed && gallery?.settings.allowDownload && currentStep === 'confirmed') {
    // Delay curto para dar tempo da animação de confirmação
    const timer = setTimeout(() => setShowDownloadModal(true), 1000);
    return () => clearTimeout(timer);
  }
}, [isConfirmed, gallery?.settings.allowDownload, currentStep]);

// Botão "Baixar Fotos" no header da tela de confirmação
{gallery.settings.allowDownload && (
  <Button 
    variant="terracotta" 
    onClick={() => setShowDownloadModal(true)}
    className="gap-2"
  >
    <Download className="h-4 w-4" />
    Baixar Fotos
  </Button>
)}

// Modal
<DownloadModal 
  isOpen={showDownloadModal}
  onClose={() => setShowDownloadModal(false)}
  photos={confirmedSelectedPhotos}
  sessionName={gallery.sessionName}
  onDownloadAll={handleDownloadAll}
  onDownloadIndividual={() => {
    setShowDownloadModal(false);
    // Abre lightbox na primeira foto
    setLightboxIndex(0);
  }}
/>
```

### 5. MODIFICAR: `src/types/gallery.ts`

Adicionar `storageKey` ao tipo `GalleryPhoto` para acesso direto ao B2:

```typescript
export interface GalleryPhoto {
  // ... existentes
  storageKey?: string;  // storage_key do B2 para download original
}
```

### 6. MODIFICAR: Transformação de fotos em `ClientGallery.tsx`

Incluir `storageKey` na transformação:

```typescript
return {
  id: photo.id,
  filename: photo.original_filename || photo.filename,
  // ... existentes
  storageKey: photo.storage_key,  // ADICIONAR
};
```

---

## Experiência de Usuário Premium

### Fluxo Completo

1. **Cliente confirma seleção** → Pagamento (se aplicável)
2. **Pagamento aprovado** → Tela de confirmação aparece
3. **Modal de Download surge** automaticamente (se `allowDownload=true`)
   - Mensagem celebratória
   - Aviso sobre acesso único
   - Opções de download
4. **Download em lote** → Cria ZIP com todas as fotos originais
5. **Download individual** → Lightbox mostra fotos SEM watermark, botão baixa cada uma

### Design do Modal

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│            🎉                                                           │
│                                                                         │
│            Suas fotos estão prontas!                                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│     ⚠️  Importante                                                     │
│     Este é o momento para baixar suas fotos em alta resolução          │
│     sem marca d'água. Guarde-as com carinho!                           │
│                                                                         │
│     Após sair desta página, você não terá mais acesso ao               │
│     download das fotos originais.                                      │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│     📸  12 fotos selecionadas                                          │
│                                                                         │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │                                                               │  │
│     │   ⬇️  Baixar Todas (ZIP)                                      │  │
│     │      Recomendado - Todas as fotos em um único arquivo         │  │
│     │                                                               │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│     OU                                                                  │
│                                                                         │
│     [Ver fotos e baixar individualmente →]                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Dependências

Para download em lote (ZIP):

```bash
npm install jszip file-saver
npm install -D @types/file-saver
```

Ou implementar via Edge Function para gerar ZIP no servidor.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/DownloadModal.tsx` | **Criar** | Modal de download premium |
| `src/lib/downloadUtils.ts` | **Criar** | Funções de download individual e lote |
| `src/lib/cloudinaryUrl.ts` | **Modificar** | Adicionar `getOriginalPhotoUrl()` |
| `src/components/Lightbox.tsx` | **Modificar** | Suporte a modo confirmado (sem watermark) |
| `src/pages/ClientGallery.tsx` | **Modificar** | Integrar modal e lógica de download |
| `src/types/gallery.ts` | **Modificar** | Adicionar `storageKey` ao GalleryPhoto |

---

## Segurança

1. **Download condicionado a confirmação**: Fotos originais SEM watermark só são acessíveis quando:
   - `allowDownload = true` (configuração da galeria)
   - `isConfirmed = true` (seleção confirmada)
   - Pagamento aprovado (se `sale_with_payment`)

2. **URLs diretas do B2**: Tecnicamente acessíveis se souber o path, mas:
   - Paths são UUIDs aleatórios
   - Bucket pode ter política de referer
   - Opcional: Criar Edge Function para gerar URLs assinadas temporárias

---

## Resultado Esperado

1. **Modal informativo premium** aparece após confirmação/pagamento
2. **Download em lote** com ZIP de todas as fotos originais
3. **Download individual** foto a foto no Lightbox (sem watermark)
4. **Experiência clara**: Cliente entende que é o momento de baixar
5. **Fotos originais**: Alta resolução, sem marca d'água, como configurado pelo fotógrafo
