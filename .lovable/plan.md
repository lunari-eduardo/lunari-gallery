

# Logo como Imagem + Thumbnail nos Cards + Acoes do Menu

## Resumo

Tres mudancas principais:
1. Usar as imagens de logo "Gallery Select" e "Gallery Transfer" no lugar do texto
2. Adicionar thumbnail da primeira foto nos cards de Select
3. Corrigir as acoes do menu de tres pontos (editar, compartilhar, excluir)

---

## 1. Logos como imagem

Copiar os arquivos enviados para `src/assets/`:
- `Gallery_Select.png` -> `src/assets/gallery-select-logo.png`
- `Gallery_Transfer.png` -> `src/assets/gallery-transfer-logo.png`

**Arquivo:** `src/pages/Dashboard.tsx`

Substituir o `<h1>` com texto "Gallery Select" / "Gallery Transfer" por uma tag `<img>` importada como modulo ES6. A imagem tera altura fixa (~40px) com `object-contain` para manter proporcao.

---

## 2. Thumbnail da primeira foto no card Select

### 2.1 Buscar primeira foto na query

**Arquivo:** `src/hooks/useSupabaseGalleries.ts`

Alterar a query de listagem para incluir a primeira foto de cada galeria:

```text
.select('*, galeria_fotos(storage_key)')
```

Com parametro para limitar a 1 foto por galeria. Como o Supabase JS suporta nested selects com limit, usaremos:

```text
.select('*, galeria_fotos!galeria_fotos_galeria_id_fkey(storage_key)')
```

Na funcao `transformGaleria`, extrair o `storage_key` da primeira foto e expor como campo `firstPhotoKey` na interface `Galeria`.

### 2.2 Passar para o Dashboard

**Arquivo:** `src/pages/Dashboard.tsx`

No `transformSupabaseToLocal`, mapear `galeria.firstPhotoKey` para o objeto da galeria para que o `GalleryCard` tenha acesso.

### 2.3 Renderizar thumbnail no card

**Arquivo:** `src/components/GalleryCard.tsx`

Adicionar uma prop `thumbnailUrl?: string` ao card. Se presente, renderizar uma imagem quadrada (~56px) no lado esquerdo do card, sem bordas nem margem extra. O texto e informacoes ficam a direita da thumbnail.

Layout:

```text
+--+-----------------------------------------------+
|  | Nome da Sessao              Status   [...]     |
|  | Cliente                                        |
|  | 8/20 +2                     13 de fev           |
+--+-----------------------------------------------+
```

Se nao houver thumbnail, o card continua sem imagem (apenas texto).

---

## 3. Acoes do menu de tres pontos

### 3.1 Select cards

**Arquivo:** `src/pages/Dashboard.tsx`

Atualizar os callbacks passados ao `GalleryCard`:

- **Editar**: `navigate(\`/gallery/\${gallery.id}/edit\`)` -- leva para edicao direta
- **Compartilhar**: abrir `SendGalleryModal` com os dados da galeria
- **Excluir**: abrir `DeleteGalleryDialog` para confirmar e excluir

Para isso, o Dashboard precisara:
- Importar `SendGalleryModal` e `DeleteGalleryDialog`
- Estado para controlar qual galeria esta selecionada para compartilhar/excluir
- Buscar `useSettings()` para passar ao `SendGalleryModal`
- Usar `deleteGallery` do `useSupabaseGalleries` para a exclusao
- Buscar os dados completos da `Galeria` (do Supabase) para o modal de compartilhamento

### 3.2 Transfer cards

**Arquivo:** `src/pages/Dashboard.tsx`

Mesma logica:
- **Editar**: `navigate(\`/deliver/\${gallery.id}\`)` -- pagina de gerenciamento
- **Compartilhar**: abrir `SendGalleryModal`
- **Excluir**: abrir `DeleteGalleryDialog`

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/assets/gallery-select-logo.png` | Novo -- logo Select |
| `src/assets/gallery-transfer-logo.png` | Novo -- logo Transfer |
| `src/pages/Dashboard.tsx` | Logos como imagem, acoes do menu (share modal, delete dialog), passar thumbnailUrl |
| `src/components/GalleryCard.tsx` | Adicionar thumbnail a esquerda do card |
| `src/hooks/useSupabaseGalleries.ts` | Incluir primeira foto na query de listagem |

---

## Detalhes tecnicos

### Query com primeira foto

```text
const { data, error } = await supabase
  .from('galerias')
  .select('*, galeria_fotos(storage_key)')
  .order('created_at', { ascending: false });
```

Na transformacao, pegar `row.galeria_fotos?.[0]?.storage_key` como `firstPhotoKey`.

Nota: o Supabase retorna TODAS as fotos no nested select sem um `.limit()` no nested. Para evitar trazer todas, usaremos uma abordagem pragmatica: buscar apenas o `storage_key` (campo leve) e usar apenas o primeiro resultado no frontend. Alternativa: usar uma view ou RPC no banco.

### Thumbnail URL no card

```text
const thumbnailUrl = gallery.firstPhotoKey
  ? `${R2_PUBLIC_URL}/${gallery.firstPhotoKey}`
  : undefined;
```

Usando `getDisplayUrl()` de `src/lib/photoUrl.ts`.

### Estado de share/delete no Dashboard

```text
const [shareGalleryId, setShareGalleryId] = useState<string | null>(null);
const [deleteGalleryId, setDeleteGalleryId] = useState<string | null>(null);

// Para o SendGalleryModal, precisamos da Galeria original do Supabase
const shareGaleria = supabaseGalleries.find(g => g.id === shareGalleryId);
const deleteGallery = allGalleries.find(g => g.id === deleteGalleryId);
```

### GalleryCard com thumbnail

Nova prop e layout horizontal com `flex`:

```text
<div className="flex gap-3">
  {thumbnailUrl && (
    <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
      <img src={thumbnailUrl} className="w-full h-full object-cover" />
    </div>
  )}
  <div className="flex-1 min-w-0">
    {/* conteudo existente */}
  </div>
</div>
```

