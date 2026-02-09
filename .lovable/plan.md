
# Plano: Correção do Fluxo de Download - Query Incompleta na Edge Function

## Diagnóstico Resumido

### Problema Principal
A Edge Function `gallery-access/index.ts` **não inclui a coluna `original_path`** na query de fotos finalizadas (linha 96-97):

```typescript
// ATUAL - Faltando original_path!
.select("id, storage_key, original_filename, filename")
```

Isso faz com que o frontend receba `original_path = null` para todas as fotos, mesmo que o valor exista no banco de dados.

### Evidências

1. **Banco de dados tem os dados corretos:**
   - `original_path`: `galleries/97c7b4ad.../1770603336113-54f4eb6f.jpg` ✓
   - `storage_key`: `galleries/97c7b4ad.../1770603338793-794de11b.jpg` ✓

2. **Edge Function `gallery-access` retorna dados incompletos:**
   ```typescript
   .select("id, storage_key, original_filename, filename")
   // Falta: original_path
   ```

3. **Frontend tenta baixar com `original_path = null`:**
   - `FinalizedPreviewScreen.tsx` filtra: `downloadablePhotos = photos.filter(p => p.originalPath)`
   - Resultado: array vazio → "No valid photos found"

4. **Mensagem de erro confirma:**
   > "No valid photos found for this gallery. Photos may not have originals stored (allowDownload was disabled during upload)."

### Fluxo Visual do Bug

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  FLUXO ATUAL (COM BUG)                                                    │
└───────────────────────────────────────────────────────────────────────────┘

  1. Cliente acessa galeria finalizada
      │
      ▼
  2. gallery-access Edge Function:
      │
      SELECT id, storage_key, original_filename, filename
      FROM galeria_fotos
      WHERE galeria_id = X AND is_selected = true
      │
      ▼
  3. Resposta da Edge Function:
      {
        photos: [
          { id, storage_key, original_filename, filename }
          // ❌ FALTA: original_path
        ]
      }
      │
      ▼
  4. FinalizedPreviewScreen.tsx:
      │
      const originalPath = p.originalPath || p.original_path || null;
      //                                        ↑ undefined → null
      │
      ▼
  5. downloadablePhotos = photos.filter(p => p.originalPath)
      //                                        ↑ null → excluída
      │
      ▼
  6. Resultado: array vazio → Download indisponível
```

---

## Correção Necessária

### Arquivo: `supabase/functions/gallery-access/index.ts`

**Linha 96-97 - Adicionar `original_path` à query:**

```typescript
// ANTES
const { data: selectedPhotos } = await supabase
  .from("galeria_fotos")
  .select("id, storage_key, original_filename, filename")
  .eq("galeria_id", gallery.id)
  .eq("is_selected", true)

// DEPOIS
const { data: selectedPhotos } = await supabase
  .from("galeria_fotos")
  .select("id, storage_key, original_path, original_filename, filename")
  .eq("galeria_id", gallery.id)
  .eq("is_selected", true)
```

---

## Resumo das Mudanças

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `supabase/functions/gallery-access/index.ts` | 97 | Adicionar `original_path` à query SELECT |

---

## Resultado Esperado

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  FLUXO CORRIGIDO                                                          │
└───────────────────────────────────────────────────────────────────────────┘

  1. Cliente acessa galeria finalizada
      │
      ▼
  2. gallery-access Edge Function:
      │
      SELECT id, storage_key, original_path, original_filename, filename
      FROM galeria_fotos ...
      │
      ▼
  3. Resposta da Edge Function:
      {
        photos: [
          {
            id,
            storage_key,
            original_path: "galleries/xxx/1770603336113-54f4eb6f.jpg", ✓
            original_filename,
            filename
          }
        ]
      }
      │
      ▼
  4. FinalizedPreviewScreen.tsx:
      │
      const originalPath = p.original_path  // ✓ tem valor!
      │
      ▼
  5. downloadablePhotos = photos.filter(p => p.originalPath)
      //                                        ↑ tem valor → incluída
      │
      ▼
  6. Download funciona via signed URL do B2 ✓
```

---

## Verificação Pós-Correção

Após implementar a correção:

1. Deploy da Edge Function `gallery-access`
2. Acessar galeria finalizada com `allowDownload = true`
3. Verificar que:
   - Miniaturas aparecem (do R2 - storage_key)
   - Botão "Baixar Todas" aparece
   - Download funciona sem erros 404
