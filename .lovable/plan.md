

## Plano: Completar implementação de pastas — gaps identificados

### Problemas encontrados

**1. `GaleriaPhoto` não tem `pastaId`** (`src/hooks/useSupabaseGalleries.ts`)
- O tipo `GaleriaPhoto` (linha 11-28) não inclui `pastaId`
- A função `transformPhoto` (linha 204-222) não mapeia `pasta_id` → `pastaId`
- Consequência: na tela de edição (`GalleryEdit`) e detalhes (`GalleryDetail`), as fotos não carregam `pastaId`, impossibilitando filtragem

**2. GalleryEdit não filtra fotos por pasta** (`src/pages/GalleryEdit.tsx`)
- Linha 549: o loop `photos.map(...)` renderiza TODAS as fotos sem filtrar por `activeFolderId`
- Precisa filtrar `photos` pelo `activeFolderId` quando pastas existem

**3. GalleryDetail não passa `folders` ao `PhotoCodesModal`** (`src/pages/GalleryDetail.tsx`)
- Linha 927-933: `PhotoCodesModal` é renderizado sem a prop `folders`
- Precisa buscar pastas da galeria e passá-las
- As fotos (`transformedPhotos`) já mapeiam `folderId` (linha 250), porém dependem de `(photo as any).pastaId` que é `undefined` porque `GaleriaPhoto` não tem esse campo

**4. GalleryDetail tabs "Fotos" não filtra por pasta**
- Linhas 593-617: O grid de todas as fotos não tem navegação por pastas

**5. Lightbox no ClientGallery mostra TODAS as fotos** (linha 1619-1631)
- `photos={localPhotos}` deveria ser filtrado por pasta ativa quando `activeFolderId` está definido, senão a navegação no lightbox pula entre pastas

---

### Arquivos e alterações

#### 1. `src/hooks/useSupabaseGalleries.ts`
- Adicionar `pastaId: string | null` ao tipo `GaleriaPhoto`
- Na `transformPhoto`: mapear `pastaId: row.pasta_id || null`

#### 2. `src/pages/GalleryEdit.tsx`
- Filtrar lista de fotos pelo `activeFolderId` quando pastas existem
- Criar variável `filteredPhotos` que filtra `photos` por `(photo as any).pastaId === activeFolderId`
- Usar `filteredPhotos` no grid (linhas 549-577) e no contador (linha 529)

#### 3. `src/pages/GalleryDetail.tsx`
- Buscar pastas via query: `supabase.from('galeria_pastas').select('*').eq('galeria_id', id).order('ordem')`
- Passar `folders={folders}` ao `PhotoCodesModal` (linha 927)
- Corrigir mapeamento de `folderId` (remover cast `as any`, usar `photo.pastaId`)
- Adicionar navegação por pastas na tab "Fotos" (tabs de pasta + filtro)

#### 4. `src/pages/ClientGallery.tsx` — Lightbox
- Linha 1619: trocar `photos={localPhotos}` por `photos={displayPhotos}` quando pastas ativas, para que navegação do lightbox fique dentro da pasta
- Ajustar `currentIndex` e `onNavigate` para trabalhar com array filtrado

#### 5. `src/pages/ClientDeliverGallery.tsx`
- Verificar se lightbox também usa fotos filtradas por pasta (já parece correto com `photos={photos}` que é filtrado)

---

### Ordem de implementação

1. Corrigir `GaleriaPhoto` type + `transformPhoto` (base para tudo)
2. Corrigir `GalleryEdit` — filtrar fotos por pasta
3. Corrigir `GalleryDetail` — buscar pastas, passar ao modal, filtrar tab Fotos
4. Corrigir `ClientGallery` — lightbox usar fotos filtradas por pasta

