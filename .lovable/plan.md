

# Plano: Sistema de Pastas Completo para Galerias

## Diagnóstico

Após análise completa do código, identifiquei as seguintes lacunas:

### O que JÁ funciona:
- `galeria_pastas` tabela existe com RLS correto
- `galeria_fotos.pasta_id` (FK) existe e é preenchido no upload
- `FolderManager` permite criar/editar/excluir pastas
- `PhotoUploader` e `uploadPipeline` passam `folderId` ao R2/DB
- `gallery-access` Edge Function retorna `folders[]` junto com `photos[]`
- `ClientGallery` tem lógica de álbuns (tela de álbuns, filtro por folder, navbar de pastas)

### O que está QUEBRADO:
1. **Sem pasta padrão automática**: Quando fotógrafo não cria pastas manualmente, fotos ficam com `pasta_id = null`. O sistema deveria criar automaticamente uma pasta com o nome da sessão.
2. **Upload sem pasta permitido**: `PhotoUploader` aceita `folderId = null` e envia sem pasta. Deveria ser obrigatório.
3. **GalleryEdit não mostra fotos por pasta corretamente**: A filtragem funciona, mas se nenhuma pasta existir as fotos aparecem. Quando pastas existem, fotos sem `pasta_id` ficam "invisíveis".
4. **GalleryCreate step 4**: Não auto-cria pasta com nome da sessão ao entrar no step. Pastas são opcionais.
5. **Capa da pasta**: Não existe conceito de `cover_photo_id` na tabela `galeria_pastas`.
6. **GalleryDetail**: Não filtra fotos por pasta na visualização do fotógrafo — mostra todas as fotos em lista plana.

---

## Mudanças

### 1. Migração DB: adicionar `cover_photo_id` em `galeria_pastas`

```sql
ALTER TABLE galeria_pastas ADD COLUMN cover_photo_id uuid REFERENCES galeria_fotos(id) ON DELETE SET NULL;
```

### 2. Auto-criação de pasta padrão (`GalleryCreate.tsx`)

Quando a galeria é criada no step 3→4, imediatamente após `setSupabaseGalleryId`, criar automaticamente uma pasta com `nome = sessionName || 'Todas as fotos'` e selecionar como ativa. Isso garante que **toda foto terá `pasta_id`**.

Na função `createSupabaseGalleryForUploads`, após receber `result.id`:
- Chamar `supabase.from('galeria_pastas').insert(...)` com nome da sessão
- Setar `activeFolderId` com o ID da pasta criada

### 3. Bloquear upload sem pasta

No `PhotoUploader`, quando `folderId` é null/undefined e a galeria já tem pastas, exibir mensagem "Selecione uma pasta" ao invés do dropzone. Isso já é parcialmente feito no `FolderManager` com o aviso, mas o uploader em si não bloqueia.

### 4. `FolderManager` — melhorias de UX

- Remover auto-select complexo; a pasta default já será selecionada
- Adicionar campo de capa: ao clicar numa pasta, mostrar opção para definir `cover_photo_id`
- Exibir thumbnail da capa ao lado do nome da pasta (se definida)
- Layout mais compacto e desktop-friendly: tabs horizontais ao invés de wrap

### 5. `GalleryEdit.tsx` — filtro de fotos por pasta

- Adicionar navegação por abas de pastas (já existe parcialmente)
- Garantir que fotos sem `pasta_id` apareçam numa pasta "Sem pasta" virtual (migração retroativa) ou sejam migradas para a pasta default
- Permitir ao fotógrafo definir a capa da pasta a partir das fotos já enviadas

### 6. `GalleryDetail.tsx` — exibir fotos organizadas por pasta

- Adicionar tabs/abas de pastas no grid de fotos
- Filtrar fotos pela pasta selecionada
- Exibir capa da pasta se definida

### 7. `ClientGallery.tsx` — capa da pasta nos álbuns

- Atualmente usa `folderPhotos[0]` como thumbnail do álbum
- Alterar para usar `folder.cover_photo_id` (buscar a foto correspondente) se definido, senão fallback para primeira foto
- `gallery-access` Edge Function já retorna folders; adicionar `cover_photo_id` ao select

### 8. `gallery-access` Edge Function — incluir `cover_photo_id`

Alterar a query de folders para incluir o campo `cover_photo_id`:
```sql
.select("id, nome, ordem, cover_photo_id")
```

### 9. Migrar fotos órfãs (sem pasta) em galerias existentes

Criar uma função/lógica no `GalleryEdit` que detecta fotos com `pasta_id = null` e as atribui à primeira pasta da galeria, ou cria uma pasta "Todas as fotos" automaticamente.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| Migração SQL | Adicionar `cover_photo_id` em `galeria_pastas` |
| `src/pages/GalleryCreate.tsx` | Auto-criar pasta com nome da sessão ao criar galeria |
| `src/components/FolderManager.tsx` | UX melhorada, suporte a capa, layout desktop |
| `src/components/PhotoUploader.tsx` | Bloquear upload sem `folderId` |
| `src/pages/GalleryEdit.tsx` | Migração de fotos órfãs, melhorar filtro por pasta |
| `src/pages/GalleryDetail.tsx` | Tabs de pastas na visualização de fotos |
| `src/pages/ClientGallery.tsx` | Usar `cover_photo_id` para thumbnail do álbum |
| `supabase/functions/gallery-access/index.ts` | Incluir `cover_photo_id` na query de folders |

