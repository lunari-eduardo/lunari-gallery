

## Plano: Sistema de Pastas (Álbuns) dentro de Galerias Select e Transfer

### Escopo da mudança

Adicionar suporte a múltiplas pastas dentro de uma galeria, permitindo que o fotógrafo organize fotos em categorias (ex: "Cerimônia", "Festa", "Making Of") tanto em galerias Select quanto Transfer.

---

### 1. Banco de Dados

**Nova tabela `galeria_pastas`:**

```text
galeria_pastas
├── id           (uuid, PK)
├── galeria_id   (uuid, FK → galerias.id ON DELETE CASCADE)
├── user_id      (uuid, NOT NULL)
├── nome         (text, NOT NULL)
├── ordem        (integer, DEFAULT 0)
├── created_at   (timestamptz)
└── updated_at   (timestamptz)
```

**Nova coluna em `galeria_fotos`:**
- `pasta_id` (uuid, nullable, FK → galeria_pastas.id ON SET NULL)

**RLS:**
- Fotógrafo: ALL onde `auth.uid() = user_id`
- Cliente (SELECT): via join com `galerias` onde `public_token IS NOT NULL` e status válido (mesma lógica das fotos)
- Cliente (UPDATE em galeria_fotos): política existente já cobre, pois o `pasta_id` não é alterado pelo cliente

---

### 2. Arquivos impactados

#### Backend (Edge Functions)
- **`supabase/functions/gallery-access/index.ts`** — Buscar pastas da galeria e incluir no response (`galeria_pastas`). Ordenar fotos agrupadas por pasta.
- **`supabase/functions/client-selection/index.ts`** — Sem alteração (seleção é por foto, não por pasta).

#### Hooks & Types
- **`src/types/gallery.ts`** — Novo tipo `GalleryFolder { id, name, order }`.
- **`src/hooks/useSupabaseGalleries.ts`** — Funções `createFolder`, `updateFolder`, `deleteFolder`, `reorderFolders`. Incluir pastas no fetch de galeria.

#### Criação de Galeria (Select)
- **`src/pages/GalleryCreate.tsx`** — No Step 4 (Fotos):
  - Adicionar UI para criar/renomear/reordenar pastas (tabs ou lista)
  - Cada pasta tem seu próprio `PhotoUploader` ou um seletor de "pasta ativa"
  - Pasta padrão "Geral" criada automaticamente se nenhuma for definida
  - PhotoUploader recebe `pastaId` como prop

#### Criação de Galeria (Transfer)
- **`src/pages/DeliverCreate.tsx`** — No Step 2 (Fotos):
  - Mesmo sistema de pastas com tabs para organizar uploads
  - `DeliverPhotoManager` recebe `pastaId` para filtrar/exibir

#### Edição de Galeria
- **`src/pages/GalleryEdit.tsx`** — Seção de fotos:
  - Listar pastas existentes com opção de renomear/reordenar
  - Upload de novas fotos em pasta específica
  - Mover fotos entre pastas (drag ou select)

#### Upload Pipeline
- **`src/components/PhotoUploader.tsx`** — Nova prop `folderId?: string`, passado ao `UploadPipeline`.
- **`src/lib/uploadPipeline.ts`** — Aceitar `folderId`, incluir no INSERT da `galeria_fotos`.

#### Visualização do Cliente (Select)
- **`src/pages/ClientGallery.tsx`** — 
  - Buscar pastas do response da Edge Function
  - Renderizar tabs/botões para filtrar por pasta
  - Manter opção "Todas" como padrão
  - Contadores de seleção por pasta

#### Visualização do Cliente (Transfer)
- **`src/pages/ClientDeliverGallery.tsx`** —
  - Renderizar seções separadas por pasta ou tabs de navegação
  - Download por pasta (ZIP)

#### Componentes auxiliares (novo)
- **`src/components/FolderManager.tsx`** — Componente reutilizável para criar/renomear/reordenar pastas (usado em GalleryCreate, DeliverCreate e GalleryEdit)

#### Componentes existentes
- **`src/components/deliver/DeliverPhotoManager.tsx`** — Filtrar fotos por pasta
- **`src/components/deliver/DeliverPhotoGrid.tsx`** — Aceitar agrupamento por pasta
- **`src/components/deliver/DeliverHeader.tsx`** — Navegação entre pastas

---

### 3. UX do Fotógrafo (Criação/Edição)

```text
┌─────────────────────────────────────┐
│  Pastas                    [+ Nova] │
│  ┌──────┐ ┌──────┐ ┌────────────┐  │
│  │Geral │ │Cerim.│ │ Making Of  │  │
│  └──────┘ └──────┘ └────────────┘  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   PhotoUploader             │    │
│  │   (uploads vão para a       │    │
│  │    pasta selecionada)       │    │
│  └─────────────────────────────┘    │
│                                     │
│  [12 fotos nesta pasta]            │
└─────────────────────────────────────┘
```

- Criar pastas antes ou durante o upload
- Pasta ativa define onde os uploads serão salvos
- Renomear pastas inline (clique no nome)
- Reordenar por drag ou botões ↑↓
- Excluir pasta move fotos para "Geral" (ou exclui se vazia)

---

### 4. UX do Cliente

**Select:** Tabs horizontais no topo do grid (abaixo do header). Tab "Todas" + uma tab por pasta. Contadores de seleção em cada tab.

**Transfer:** Seções separadas por pasta com título e divider, ou tabs se preferir navegação compacta. Botão "Baixar pasta" por seção.

---

### 5. Ordem de implementação

1. Migração de banco (tabela `galeria_pastas` + coluna `pasta_id` em `galeria_fotos`)
2. Tipo `GalleryFolder` + hook de CRUD de pastas
3. Componente `FolderManager`
4. Integrar `folderId` no `PhotoUploader` e `uploadPipeline`
5. Atualizar `GalleryCreate` Step 4 com gerenciamento de pastas
6. Atualizar `DeliverCreate` Step 2 com gerenciamento de pastas
7. Atualizar `GalleryEdit` com gerenciamento de pastas
8. Atualizar Edge Function `gallery-access` para retornar pastas
9. Atualizar `ClientGallery` com tabs de pasta
10. Atualizar `ClientDeliverGallery` com seções/tabs de pasta

---

### 6. Detalhes técnicos

- Pastas são opcionais: galerias sem pastas continuam funcionando normalmente (fotos com `pasta_id = null` aparecem como antes)
- A pasta "Geral" não é criada no banco — fotos sem `pasta_id` são exibidas como "Geral"
- Ao excluir uma pasta, `ON SET NULL` mantém as fotos na galeria (voltam para "Geral")
- O pipeline de upload insere `pasta_id` junto com os demais campos no INSERT da `galeria_fotos`

