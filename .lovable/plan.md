

# Plano: Correção Completa do Fluxo de Download

## Problemas Identificados

### 1. Bug Crítico no `b2-upload/index.ts`
A Edge Function `b2-upload` possui **dois bugs de referência não definida** que causam falha silenciosa:

```typescript
// Linha 304 - isAdmin NUNCA é definida no código
if (!isAdmin && !isOriginalOnly) {
  // ... código de verificação de créditos
}

// Linhas 393 e 461 - uploadDuration NUNCA é definida
console.log(`[${requestId}] ✓ Complete in ${totalDuration}ms (upload: ${uploadDuration}ms)`);
```

**Resultado**: A função falha com `ReferenceError` antes de fazer qualquer upload, mas o erro é capturado silenciosamente.

### 2. Evidência no Banco de Dados
Todas as fotos de galerias com `allowDownload = true` têm:
- `storage_key`: Preenchido (R2 preview funciona)
- `original_path`: **NULL** (B2 original nunca foi salvo)

### 3. Consequências na Tela Final
1. **Miniaturas com watermark**: Correto - estão vindo do R2 (preview com watermark burn-in)
2. **Fullscreen não abre**: Bug separado a investigar
3. **Download retorna 404**: Correto - `b2-download-url` valida que `original_path` deve existir, mas está NULL

---

## Correções Necessárias

### Correção 1: Edge Function `b2-upload/index.ts`

Adicionar as variáveis que faltam:

```typescript
// ADICIONAR após linha 301 (depois de verificar gallery):

// Check if user is admin (para bypass de créditos)
const { data: isAdmin } = await supabase.rpc('has_role', {
  _user_id: user.id,
  _role: 'admin'
});
```

```typescript
// ADICIONAR antes do upload (linha ~375):
const uploadStart = Date.now();

// E depois do upload:
const uploadDuration = Date.now() - uploadStart;
```

### Correção 2: Exibição na Tela Finalizada

A tela finalizada (`FinalizedPreviewScreen.tsx`) deve:

| Elemento | Fonte | URL |
|----------|-------|-----|
| Miniaturas | R2 | `https://media.lunarihub.com/{storage_key}` |
| Fullscreen | R2 | `https://media.lunarihub.com/{storage_key}` |
| Download | B2 via Signed URL | `b2-download-url` edge function |

Atualmente está correto, mas **o download falha porque `original_path` é NULL**.

### Correção 3: Decisão sobre Exibição sem Watermark

Conforme solicitado:
> "O fluxo quando download estiver ativado, deve mostrar fotos diretamente do B2, sem watermark (isto é possível?)"

**Análise**: Tecnicamente possível, MAS:
1. B2 requer signed URLs (não URLs públicas)
2. Gerar signed URLs para cada visualização adiciona latência
3. Signed URLs expiram (1 hora)

**Recomendação**: Manter arquitetura atual onde:
- **Visualização**: Sempre do R2 (com watermark) - rápido, público, CDN
- **Download**: Do B2 (sem watermark) - via signed URL

Se o requisito for mostrar SEM watermark na tela final, precisamos:
1. Gerar signed URLs para todas as fotos na visualização
2. Ou criar um segundo preview (sem watermark) no R2 apenas para galerias finalizadas

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/b2-upload/index.ts` | CORRIGIR | Adicionar `isAdmin` e `uploadDuration` |
| `src/components/FinalizedPreviewScreen.tsx` | VERIFICAR | Garantir que exibição usa R2, não B2 |
| `src/components/Lightbox.tsx` | VERIFICAR | Debug do fullscreen que não abre |

---

## Fluxo Corrigido

```text
UPLOAD (quando allowDownload = true)
─────────────────────────────────────────────────────────────────────────

  1. PhotoUploader detecta allowDownload = true
      │
      ▼
  2. Chama b2-upload com isOriginalOnly = true
      │
      ├── Edge function valida usuário
      ├── Verifica isAdmin (via RPC) ← NOVA verificação
      ├── Upload para B2
      ├── Retorna { storageKey: "galleries/{id}/original-{filename}" }
      │
      ▼
  3. Comprime imagem localmente (com watermark)
      │
      ▼
  4. Chama r2-upload com originalPath = B2 path
      │
      ├── Upload para R2
      ├── Salva no banco: storage_key (R2) + original_path (B2)
      │
      ▼
  5. Banco atualizado corretamente:
      ├── storage_key = "galleries/{id}/1234-abc.jpg" (R2 preview)
      └── original_path = "galleries/{id}/original-1234-abc.jpg" (B2 original)


VISUALIZAÇÃO FINALIZADA
─────────────────────────────────────────────────────────────────────────

  Thumbnails → R2 (storage_key) → Com watermark
  Fullscreen → R2 (storage_key) → Com watermark
  Download   → B2 (original_path) via signed URL → SEM watermark
```

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Upload com allowDownload=true | Falha silenciosa no B2 | Upload duplo funciona |
| `original_path` no banco | NULL | Path real do B2 |
| Miniaturas na tela final | Mostra preview com watermark | Mantém (correto) |
| Download | Erro 404 | Funciona via signed URL |

