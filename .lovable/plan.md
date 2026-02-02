

# Ordenação Alfabética das Fotos da Galeria

## Solução Simplificada

Ao invés de rastrear ordem de seleção no upload, ordenar sempre por `original_filename`. Isso funciona porque:

- Câmeras nomeiam fotos sequencialmente (DSC_0001, DSC_0002, LISE2752, LISE2754...)
- Não requer mudanças no upload
- Fotos antigas automaticamente ficam ordenadas corretamente
- Lógica simples e previsível

## Mudanças Necessárias

Substituir `.order("order_index")` por `.order("original_filename")` em **3 arquivos**:

### 1. Hook Principal - `src/hooks/useSupabaseGalleries.ts`

```typescript
// Linha 233: Mudar de
.order('order_index', { ascending: true });

// Para
.order('original_filename', { ascending: true });
```

### 2. Edge Function - `supabase/functions/gallery-access/index.ts`

```typescript
// Linha 102: Mudar de
.order("order_index", { ascending: true });

// Para
.order("original_filename", { ascending: true });
```

### 3. Fallback no Client - `src/pages/ClientGallery.tsx`

```typescript
// Linha 228: Mudar de
.order('order_index');

// Para
.order('original_filename', { ascending: true });
```

## Resultado

| Antes | Depois |
|-------|--------|
| LISE2755.JPG (upload rápido) | LISE2752.JPG |
| LISE2752.JPG (upload lento) | LISE2754.JPG |
| LISE2754.JPG | LISE2755.JPG |

Fotos sempre aparecem na ordem correta, independente da velocidade de upload.

