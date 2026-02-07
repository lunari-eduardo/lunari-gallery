# Plano de Implementação - Galeria de Fotos para Fotógrafos

## Arquitetura de Watermark (ATUALIZADO: Cloudflare Image Resizing)

### Decisão Técnica Final

**Problema:** Cloudflare Workers têm limite fixo de 128MB de memória, causando OOM inevitável com processamento WASM de imagens.

**Solução:** Migração para Cloudflare Image Resizing (aplicação de watermark via URL, sem processamento server-side).

### Nova Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (V1)                             │
└─────────────────────────────────────────────────────────────────┘

UPLOAD:
  Browser → Compress (client-side, 1920px) → B2 → Done
  - Fotos são marcadas como 'ready' imediatamente
  - Sem fila, sem cron, sem WASM

VISUALIZAÇÃO:
  watermark_mode === 'none'
    → URL direta: cdn.lunarihub.com/{storage_key}
  
  watermark_mode !== 'none'
    → URL transformada: lunarihub.com/cdn-cgi/image/draw=[overlay]/{base_url}

DOWNLOAD (após confirmação):
  → URL direta B2 (original sem watermark)
```

### Componentes Removidos

- ❌ `cloudflare/workers/image-processor/` - Deletado (WASM OOM)
- ❌ `supabase/functions/process-photos/` - Deletado
- ❌ pg_cron para processamento - Não mais necessário

### Fluxo de URL

```typescript
// photoUrl.ts - Nova implementação

// Sem watermark → URL direta do R2
getPhotoUrl(photo, 'preview', { mode: 'none' })
// Resultado: https://cdn.lunarihub.com/{storage_key}

// Com watermark → Cloudflare Image Resizing
getPhotoUrl(photo, 'preview', { mode: 'system' })
// Resultado: https://lunarihub.com/cdn-cgi/image/draw=[{"url":"...pattern.png","repeat":true}]/{base_url}
```

---

## Requisitos de Infraestrutura

| Componente | Requisito | Status |
|------------|-----------|--------|
| Cloudflare Pro | $20/mês para Image Resizing | ⏳ Verificar |
| Domínio `lunarihub.com` | Proxied pelo Cloudflare | ✅ |
| R2 Bucket `lunari-previews` | Para previews | ✅ |
| System pattern | `system-assets/default-pattern.png` | ⏳ Upload necessário |

---

## Ações Manuais Necessárias

### 1. Upload do Pattern Padrão

O sistema espera encontrar um pattern de linhas diagonais em:
```
R2: lunari-previews/system-assets/default-pattern.png
```

**Especificações do Pattern (V1):**
- Formato: PNG com transparência
- Tamanho: ~500x500px (tile que se repete)
- Conteúdo: Linhas diagonais ou logo
- Opacidade já embutida no PNG (30-40%)

**Via CLI:**
```bash
wrangler r2 object put lunari-previews/system-assets/default-pattern.png --file=./default-pattern.png
```

**Via Dashboard:**
1. Cloudflare Dashboard → R2 → `lunari-previews`
2. Criar pasta `system-assets/`
3. Upload do arquivo `default-pattern.png`

### 2. Verificar Cloudflare Image Resizing

Image Resizing requer **Cloudflare Pro** ($20/mês).

**Testar se está ativo:**
```bash
curl -I "https://lunarihub.com/cdn-cgi/image/width=100/https://cdn.lunarihub.com/test.jpg"
```

Se retornar HTTP 200, está funcionando. Se 404/403, o plano não suporta.

### 3. Deploy do Worker gallery-upload (se ainda não fez)

```bash
cd lunari-upload
npm install
wrangler deploy
```

---

## Validação Visual

Testar os três cenários de watermark:

| Cenário | Configuração | Resultado Esperado |
|---------|-------------|-------------------|
| none | `watermark_mode: 'none'` | Foto limpa, sem proteção |
| system | `watermark_mode: 'system'` | Pattern de linhas diagonais em mosaico |
| custom | `watermark_mode: 'custom'` | Logo do fotógrafo em mosaico |

---

## Schema Simplificado

```sql
-- Colunas na galeria_fotos
storage_key    -- Path no B2 (original)
thumb_path     -- Path no R2 (thumbnail) - atualmente = storage_key
preview_path   -- Path no R2 (preview) - atualmente = storage_key
processing_status -- Sempre 'ready' (sem processamento async)

-- Colunas deprecadas (mantidas para backward compatibility)
preview_wm_path   -- Não mais usado (watermark via URL)
has_watermark     -- Determinado em runtime
```

---

## Histórico de Decisões

| Data | Decisão | Motivo |
|------|---------|--------|
| 2025-02 | Migração para CF Image Resizing | Workers WASM OOM (128MB limite fixo em TODOS os planos) |
| 2025-02 | Remoção de fila de processamento | Watermark on-the-fly elimina necessidade |
| 2025-02 | Fotos 'ready' imediato | Sem processamento assíncrono |
| 2025-02 | Tamanho do tile via PNG | V1 simplificação - sem controle dinâmico de scale |
