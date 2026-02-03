
# Plano: Correção de Bugs na Contagem de Fotos e Tela de Download

## Problemas Identificados

Após análise completa do código e banco de dados, encontrei **3 bugs críticos**:

---

## Bug 1: Fallback `|| 10` Converte Zero para Dez

### Localização
`src/pages/ClientGallery.tsx`, linha 272

### Código Atual
```typescript
includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) || 10,
```

### Problema
Em JavaScript, `0 || 10` retorna `10` porque `0` é um valor falsy. Quando o fotógrafo configura "0 fotos incluídas" no pacote, o sistema mostra "10 fotos incluídas" para o cliente.

### Evidência
O banco de dados mostra `fotos_incluidas: 0` corretamente salvo, mas a tela de boas-vindas mostra "10 fotos incluídas".

### Solução
Usar nullish coalescing (`??`) que só aplica o fallback para `null` ou `undefined`:
```typescript
includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) ?? 0,
```

---

## Bug 2: Tela de Finalização Ignora `allowDownload`

### Localização
- `supabase/functions/gallery-access/index.ts`, linhas 44-109
- `src/pages/ClientGallery.tsx`, linhas 728-739

### Fluxo Atual (Problemático)
```text
1. Cliente retorna do pagamento com ?payment=success
2. Edge Function detecta gallery.finalized_at → retorna { finalized: true }
3. Frontend detecta finalized=true → mostra FinalizedGalleryScreen
4. NÃO VERIFICA allowDownload → cliente não consegue baixar fotos
```

### Problema
Quando uma galeria é finalizada, o Edge Function retorna **apenas** dados mínimos (nome da sessão, logo, tema) e **omite**:
- `allowDownload` (se downloads estão liberados)
- Lista de fotos selecionadas (necessária para download)
- Configurações de saleSettings

O frontend então mostra imediatamente a `FinalizedGalleryScreen` genérica, sem verificar se deveria mostrar a tela de download.

### Fluxo Correto (Proposto)
```text
1. Cliente retorna do pagamento com ?payment=success
2. Edge Function detecta gallery.finalized_at
3. SE allowDownload=true:
   → Retorna fotos selecionadas + flag allowDownload
   → Frontend mostra tela COM opções de download
4. SE allowDownload=false:
   → Retorna dados mínimos
   → Frontend mostra FinalizedGalleryScreen padrão
```

### Solução
Modificar o Edge Function `gallery-access` para:
1. Quando `finalized=true` E `allowDownload=true`:
   - Retornar `finalized: true`
   - Retornar `allowDownload: true`
   - Retornar lista de fotos **selecionadas** (com `storage_key` para download)
   - O frontend renderiza a tela de download

2. Quando `finalized=true` E `allowDownload=false`:
   - Comportamento atual (apenas dados mínimos)

---

## Bug 3: Auto-Open do Modal Não Funciona na Primeira Carga

### Localização
`src/pages/ClientGallery.tsx`, linhas 577-600

### Problema
O useEffect que auto-abre o DownloadModal verifica `localPhotos.some(p => p.isSelected)`. No entanto, quando o cliente retorna do pagamento:

1. A galeria já está finalizada (Edge Function retorna `finalized: true`)
2. O frontend mostra `FinalizedGalleryScreen` imediatamente
3. O useEffect nunca roda porque `localPhotos` está vazio (fotos não foram carregadas)

### Solução
Quando `allowDownload=true` e galeria finalizada, o Edge Function deve retornar as fotos, e o frontend deve:
1. NÃO mostrar `FinalizedGalleryScreen`
2. Mostrar uma tela de download dedicada com as fotos selecionadas
3. Auto-abrir o `DownloadModal`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ClientGallery.tsx` | Corrigir fallback `\|\| 10` → `?? 0`; Adicionar lógica para tela de download quando finalizada |
| `supabase/functions/gallery-access/index.ts` | Retornar fotos + allowDownload quando galeria finalizada tem download habilitado |

---

## Implementação Detalhada

### 1. Corrigir Fallback de Fotos Incluídas

```typescript
// Linha 272 - ANTES
includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) || 10,

// DEPOIS
includedPhotos: (isEdgeFunctionFormat ? supabaseGallery.includedPhotos : supabaseGallery.fotos_incluidas) ?? 0,
```

Também revisar linha 273 para `extraPhotoPrice`:
```typescript
// Linha 273 - ANTES
extraPhotoPrice: (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra) || 25,

// DEPOIS (usar ?? para permitir 0 como valor válido)
extraPhotoPrice: (isEdgeFunctionFormat ? supabaseGallery.extraPhotoPrice : supabaseGallery.valor_foto_extra) ?? 0,
```

### 2. Edge Function: Retornar Fotos para Download

```typescript
// Quando galeria finalizada E allowDownload=true
if (isFinalized) {
  const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
  const allowDownload = galleryConfig?.allowDownload === true;
  
  // Se download está habilitado, retornar fotos selecionadas
  if (allowDownload) {
    const { data: selectedPhotos } = await supabase
      .from("galeria_fotos")
      .select("id, storage_key, original_filename, filename")
      .eq("galeria_id", gallery.id)
      .eq("is_selected", true);
    
    return new Response(JSON.stringify({
      finalized: true,
      allowDownload: true,
      sessionName: gallery.nome_sessao,
      photos: selectedPhotos || [],
      studioSettings: settings || null,
      theme: themeData,
      clientMode: clientMode,
      settings: {
        sessionFont: galleryConfig?.sessionFont,
        titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
      },
    }));
  }
  
  // Se download não está habilitado, retornar dados mínimos
  return new Response(JSON.stringify({
    finalized: true,
    allowDownload: false,
    // ... dados mínimos atuais
  }));
}
```

### 3. Frontend: Tela de Download para Galerias Finalizadas

```typescript
// Linha ~728 - Substituir verificação simples
if (galleryResponse?.finalized) {
  // SE allowDownload=true, mostrar tela de download
  if (galleryResponse.allowDownload) {
    return (
      <FinalizedDownloadScreen
        sessionName={galleryResponse.sessionName}
        photos={galleryResponse.photos}
        studioLogoUrl={galleryResponse.studioSettings?.studio_logo_url}
        // ... props
      />
    );
  }
  
  // SENÃO, mostrar tela padrão
  return (
    <FinalizedGalleryScreen ... />
  );
}
```

Alternativa (mais simples): Reutilizar o componente `DownloadModal` e mostrar automaticamente:

```typescript
if (galleryResponse?.finalized) {
  // Se tem download, mostrar modal automaticamente sobre tela de sucesso
  const showDownloadOnFinalized = galleryResponse.allowDownload && 
                                  galleryResponse.photos?.length > 0;
  
  return (
    <div>
      <FinalizedGalleryScreen ... />
      {showDownloadOnFinalized && (
        <DownloadModal
          isOpen={true}
          photos={transformedPhotos}
          sessionName={galleryResponse.sessionName}
          onClose={() => {}}
          // Não permitir fechar para garantir download
        />
      )}
    </div>
  );
}
```

---

## Resultado Esperado

1. **Galeria com 0 fotos incluídas** mostra "0 fotos incluídas" (não "10")
2. **Contador de extras** funciona corretamente quando `chargeType: all_selected`
3. **Tela de download** aparece após pagamento quando `allowDownload=true`
4. **Modal de download** abre automaticamente com fotos selecionadas
5. **Cliente pode baixar** fotos originais sem watermark

---

## Nota de Segurança

As URLs de download (B2 direto) só são expostas quando:
1. Galeria está finalizada (`status_selecao = 'confirmado'`)
2. Pagamento foi confirmado (se aplicável)
3. `allowDownload = true` está configurado

O Edge Function garante que o `storage_key` só é retornado nestas condições, prevenindo acesso não autorizado às fotos originais.
