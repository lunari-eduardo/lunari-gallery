
# Plano Definitivo: Correção Completa do Fluxo de Download

## Diagnóstico Completo

### PROBLEMA 1: Upload Silencioso Falha - 1 de 4 Fotos Sem Original
**Evidência no banco:**
```
galeria_id: dd26b9a7-0383-47df-97fc-2cd6b4f8709e
4 fotos no total, mas apenas 3 têm original_path:

LIS_7875.jpg → original_path: ✓ (galleries/.../1770610652852-a4978423.jpg)
LIS_7873.jpg → original_path: NULL ❌ ← UPLOAD B2 FALHOU SILENCIOSAMENTE
LIS_7872.jpg → original_path: ✓ (galleries/.../1770610652859-64143ab6.jpg)
LIS_7874.jpg → original_path: ✓ (galleries/.../1770610652844-88fb23cd.jpg)
```

**Causa raiz em `PhotoUploader.tsx` linhas 139-149:**
```typescript
try {
  const { data: b2Data, error: b2Error } = await supabase.functions.invoke('b2-upload', {...});
  if (b2Error) {
    console.error('[PhotoUploader] B2 original upload error:', b2Error);
    // Don't fail the whole upload, just skip original storage  ← ⚠️ PROBLEMA!
  }
} catch (b2Err) {
  console.error('[PhotoUploader] B2 upload exception:', b2Err);
  // Continue with preview upload even if B2 fails  ← ⚠️ PROBLEMA!
}
```

O código **ignora falhas do B2** e continua com o upload do preview. Isso cria estado inconsistente.

---

### PROBLEMA 2: Download Falha com 404
**Fluxo atual:**
1. Frontend chama `downloadAllPhotos()` com `originalPath` das fotos
2. `b2-download-url` busca fotos no banco por `original_path`
3. Filtra apenas fotos onde `storageKeys` (original_path) existe no banco
4. Se nenhuma foto bater, retorna erro "No valid photos found"

**Problema específico:**
- Frontend passa `originalPath` de fotos selecionadas (pode incluir fotos com NULL)
- Edge Function filtra apenas fotos com `original_path IS NOT NULL`
- Se foto selecionada tem `original_path = NULL`, ela é excluída
- Resultado: "No valid photos found for this gallery"

---

### PROBLEMA 3: Fullscreen em Branco
**Código em `Lightbox.tsx` linha 80-82:**
```typescript
const displayUrl = isConfirmedMode && currentPhoto?.storageKey
  ? getOriginalPhotoUrl(currentPhoto.storageKey)  // ← Tenta B2
  : currentPhoto?.previewUrl;
```

**E em `photoUrl.ts` linha 54-64:**
```typescript
export function getOriginalPhotoUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '/placeholder.svg';
  
  if (B2_BUCKET_URL) {
    return `${B2_BUCKET_URL}/${storageKey}`;  // ← Tenta B2 diretamente (CORS blocked)
  }
  
  return `${R2_PUBLIC_URL}/${storageKey}`;  // ← Fallback para R2
}
```

**Problema:**
- Em modo confirmado (`isConfirmedMode=true`), Lightbox tenta usar `getOriginalPhotoUrl(storageKey)` 
- `storageKey` aponta para R2 (preview com watermark), NÃO para B2
- Se `B2_BUCKET_URL` estiver configurado, tenta acessar B2 diretamente (CORS block)
- Se não configurado, usa R2 corretamente

**MAS** - O `FinalizedPreviewScreen` passa fotos com `storageKey` (R2) e `originalPath` (B2), e o Lightbox deveria usar `storageKey` para exibição, não para download.

---

### PROBLEMA 4: Não Há Validação de Integridade
- Galeria pode ser finalizada mesmo com fotos sem `original_path`
- Botão de download aparece mesmo quando download não é possível
- Nenhuma validação antes de permitir finalização

---

## Correções Necessárias

### CORREÇÃO 1: Upload B2 Deve Ser Obrigatório (Quando allowDownload=true)

**Arquivo: `src/components/PhotoUploader.tsx`**

Mudança na lógica do upload (linhas 118-152):

```typescript
// ANTES: Falhas do B2 são ignoradas silenciosamente
// DEPOIS: Falhas do B2 devem falhar todo o upload

if (allowDownload) {
  updateItem(item.id, { status: 'uploading', progress: 5 });
  console.log(`[PhotoUploader] allowDownload=true, uploading original to B2 first: ${item.file.name}`);
  
  const originalFormData = new FormData();
  originalFormData.append('file', item.file, item.file.name);
  originalFormData.append('galleryId', galleryId);
  originalFormData.append('originalFilename', item.file.name);
  originalFormData.append('isOriginalOnly', 'true');

  // ⚠️ MUDANÇA: Falhas do B2 DEVEM falhar o upload inteiro
  const { data: b2Data, error: b2Error } = await supabase.functions.invoke('b2-upload', {
    body: originalFormData,
  });

  if (b2Error || !b2Data?.success || !b2Data?.photo?.storageKey) {
    const errorMsg = b2Error?.message || b2Data?.error || 'Falha ao salvar arquivo original';
    console.error('[PhotoUploader] B2 original upload FAILED:', errorMsg);
    throw new Error(`Erro no B2: ${errorMsg}`);  // ← FALHA OBRIGATÓRIA
  }
  
  originalPath = b2Data.photo.storageKey;
  console.log(`[PhotoUploader] Original saved to B2: ${originalPath}`);
  updateItem(item.id, { progress: 20 });
}
```

---

### CORREÇÃO 2: Lightbox Deve SEMPRE Usar R2 para Exibição

**Arquivo: `src/components/Lightbox.tsx`**

Mudança na lógica de URL de exibição (linha 80-82):

```typescript
// ANTES: Em modo confirmado, tentava usar getOriginalPhotoUrl
// DEPOIS: SEMPRE usa previewUrl (R2) para exibição, download separado

// In confirmed mode: display uses R2 preview (storageKey), download uses B2 (originalPath)
// previewUrl already points to R2 via getPhotoUrl() in ClientGallery/FinalizedPreviewScreen
const displayUrl = currentPhoto?.previewUrl || currentPhoto?.originalUrl;
```

**Nota:** O download via botão já está correto - ele usa `originalPath` via `downloadPhoto()`.

---

### CORREÇÃO 3: FinalizedPreviewScreen Deve Garantir URLs Corretas

**Arquivo: `src/components/FinalizedPreviewScreen.tsx`**

Verificar que a transformação de fotos usa R2 para exibição (linha 59):

```typescript
// Já está correto:
const photoUrl = getOriginalPhotoUrl(storageKey);  // Usa R2 se B2_BUCKET_URL não configurado

// MAS podemos ser mais explícitos:
const photoUrl = `https://media.lunarihub.com/${storageKey}`;  // Sempre R2 para display
```

**Também precisamos passar `galleryId` para o Lightbox:**

```typescript
<Lightbox
  photos={transformedPhotos}
  currentIndex={lightboxIndex}
  allowComments={false}
  allowDownload={allowDownload}
  disabled={true}
  isConfirmedMode={true}
  galleryId={galleryId}  // ← ADICIONAR para download funcionar
  onClose={() => setLightboxIndex(null)}
  onNavigate={setLightboxIndex}
  onSelect={() => {}}
/>
```

---

### CORREÇÃO 4: Validação Antes de Exibir Botão de Download

**Arquivo: `src/components/FinalizedPreviewScreen.tsx`**

Já existe mas podemos melhorar a mensagem:

```typescript
{/* Warning if download is allowed but no originals exist */}
{allowDownload && !hasDownloadablePhotos && photos.length > 0 && (
  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg max-w-md mx-auto">
    <p className="text-sm text-warning flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      Alguns arquivos originais não puderam ser salvos. 
      Download parcial disponível ({downloadablePhotos.length} de {photos.length} fotos).
    </p>
  </div>
)}
```

---

### CORREÇÃO 5: photoUrl.ts - Clarificar Arquitetura

**Arquivo: `src/lib/photoUrl.ts`**

```typescript
/**
 * ARQUITETURA DE STORAGE:
 * 
 * R2 (Cloudflare) - https://media.lunarihub.com
 *   - Previews com watermark burned-in
 *   - Usado para TODA visualização (thumbnails, lightbox, fullscreen)
 *   - Referenciado por: storage_key, thumb_path, preview_path
 * 
 * B2 (Backblaze) - Privado, acesso via signed URL
 *   - Originais sem watermark (alta resolução)
 *   - Usado APENAS para download após confirmação
 *   - Referenciado por: original_path
 *   - Só existe se allowDownload=true durante upload
 */

// APENAS para exibição - sempre R2
export function getDisplayUrl(storageKey: string | null): string {
  if (!storageKey) return '/placeholder.svg';
  return `${R2_PUBLIC_URL}/${storageKey}`;
}

// Para download - NUNCA usar diretamente, usar b2-download-url Edge Function
export function getOriginalPhotoUrl(storageKey: string | null | undefined): string {
  if (!storageKey) return '/placeholder.svg';
  // Fallback seguro para R2 (visualização)
  return `${R2_PUBLIC_URL}/${storageKey}`;
}
```

---

## Resumo das Mudanças

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/components/PhotoUploader.tsx` | Falhas B2 devem interromper upload | Evita estado inconsistente |
| `src/components/Lightbox.tsx` | Sempre usar R2 para exibição | Fullscreen funciona |
| `src/components/FinalizedPreviewScreen.tsx` | Passar galleryId ao Lightbox, melhorar mensagens | Download individual funciona |
| `src/lib/photoUrl.ts` | Remover tentativa de B2 direto | Fallback seguro para R2 |

---

## Fluxo Corrigido

```text
UPLOAD (allowDownload=true)
────────────────────────────────────────────────────────────────────

  Usuário seleciona foto
      │
      ▼
  PhotoUploader.tsx
      │
  ┌───┴───────────────────────────────────────────────────────────┐
  │ 1. ORIGINAL → B2 (OBRIGATÓRIO)                                │
  │    ├── b2-upload edge function                                │
  │    ├── Se FALHAR → throw Error → foto marcada como erro      │
  │    └── Se SUCESSO → originalPath = B2 key                    │
  │                                                               │
  │ 2. PREVIEW → R2 (só se B2 sucedeu)                           │
  │    ├── compressImage() com watermark                         │
  │    ├── r2-upload edge function                               │
  │    └── Salva ambos os paths no banco                         │
  └───────────────────────────────────────────────────────────────┘
      │
      ▼
  Banco de dados:
  ├── storage_key = path R2 (preview com watermark)
  └── original_path = path B2 (original sem watermark)


VISUALIZAÇÃO (galeria finalizada)
────────────────────────────────────────────────────────────────────

  Thumbnails → R2 (storage_key) → preview com watermark ✓
  Fullscreen → R2 (storage_key) → preview com watermark ✓
  Download   → B2 (original_path) via signed URL → sem watermark ✓


REGRAS DE OURO
────────────────────────────────────────────────────────────────────

  ❌ NUNCA: acessar B2 diretamente do browser (CORS)
  ❌ NUNCA: usar original_path para exibição
  ❌ NUNCA: ignorar falhas de upload silenciosamente
  
  ✓ SEMPRE: exibição via R2 (storage_key)
  ✓ SEMPRE: download via signed URL (b2-download-url)
  ✓ SEMPRE: falhar upload se B2 falhar (quando allowDownload=true)
```

---

## Verificações Pós-Implementação

1. **Upload com allowDownload=true:**
   - Todas as fotos devem ter `original_path` no banco
   - Se B2 falhar, foto deve ficar com status "error"

2. **Visualização na tela final:**
   - Thumbnails aparecem (R2)
   - Fullscreen abre corretamente (R2)

3. **Download:**
   - Botão só aparece se há fotos com original_path
   - Signed URLs funcionam
   - Arquivo baixado não tem watermark

4. **Integridade:**
   - `COUNT(fotos selecionadas)` === `COUNT(original_path IS NOT NULL)` para download completo
   - Mensagem clara se download parcial
