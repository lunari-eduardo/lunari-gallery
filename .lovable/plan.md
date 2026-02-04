# Plano: Migração de Cloudinary para Cloudflare R2

## Status: ✅ IMPLEMENTADO (com Watermark)

## Arquitetura Final

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA DE IMAGENS                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐               │
│   │   Frontend  │───>│  b2-upload       │───>│  Backblaze B2       │               │
│   │   (Upload)  │    │  (Edge Function) │    │  (Originais)        │               │
│   └─────────────┘    └──────────────────┘    └─────────────────────┘               │
│         │                     │                                                     │
│         │                     │ processing_status='uploaded'                        │
│         │                     ▼                                                     │
│         │            ┌──────────────────┐                                          │
│         │            │   galeria_fotos  │                                          │
│         │            │   (Supabase)     │                                          │
│         │            └──────────────────┘                                          │
│         │                     │                                                     │
│         │                     │ pg_cron (cada 1 min)                               │
│         │                     ▼                                                     │
│         │            ┌──────────────────┐    ┌─────────────────────┐               │
│         │            │  process-photos  │───>│  Cloudflare R2      │               │
│         │            │  (Edge Function) │    │  cdn.lunarihub.com  │               │
│         │            └──────────────────┘    └─────────────────────┘               │
│         │                     │                                                     │
│         │                     │ processing_status='ready'                           │
│         │                     │ thumb_path, preview_path, preview_wm_path          │
│         │                     ▼                                                     │
│   ┌─────────────┐    ┌──────────────────┐                                          │
│   │   Frontend  │<───│  R2 Public URLs  │                                          │
│   │(Visualizar) │    │  (CDN Global)    │                                          │
│   └─────────────┘    └──────────────────┘                                          │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes Implementados

### 1. Database
- ✅ Coluna `processing_status` adicionada à `galeria_fotos`
- ✅ Índice otimizado para busca de fotos pendentes

### 2. Edge Functions
- ✅ `b2-upload`: Atualizado para definir `processing_status = 'uploaded'`
- ✅ `process-photos`: Processamento com resize (thumbnail 400px) e preparação para watermark

### 3. Frontend
- ✅ `src/lib/photoUrl.ts`: Novo módulo de URLs (substitui cloudinaryUrl.ts)
- ✅ `public/placeholder-processing.svg`: Placeholder animado para fotos em processamento
- ✅ Componentes atualizados para usar `getPhotoUrlWithFallback`

### 4. Secrets Configurados
- ✅ R2_ACCESS_KEY_ID
- ✅ R2_SECRET_ACCESS_KEY  
- ✅ R2_ACCOUNT_ID
- ✅ R2_BUCKET_NAME
- ✅ R2_PUBLIC_URL

### 5. Variáveis de Ambiente
- ✅ `VITE_R2_PUBLIC_URL`: https://cdn.lunarihub.com
- ❌ `VITE_CLOUDINARY_CLOUD_NAME`: Removido

---

## Configuração de Watermark

### Tipo `WatermarkType`
- `'none'`: Sem marca d'água
- `'standard'`: Usa as marcas d'água padrão do sistema
- `'custom'`: (Futuro) Marcas d'água personalizadas do fotógrafo

### Arquivos de Watermark
Localizados em `public/watermarks/`:
- `horizontal.png` - Para fotos paisagem (width >= height)
- `vertical.png` - Para fotos retrato (height > width)

### Configuração por Galeria
A configuração de watermark é armazenada em `galerias.configuracoes.watermark`:
```json
{
  "type": "standard",
  "opacity": 40,
  "position": "center"
}
```

### Opacidade
- Range: 10-100%
- Default: 40%
- Configurável pelo fotógrafo em **Configurações > Personalização > Marca D'água Padrão**

---

## Passo a Passo: Configurar Watermark

### 1. Criar/Substituir Arquivos de Watermark

Substitua os arquivos em `public/watermarks/`:

```
public/
└── watermarks/
    ├── horizontal.png  ← Para fotos paisagem (recomendado: 800x200px, fundo transparente)
    └── vertical.png    ← Para fotos retrato (recomendado: 200x600px, fundo transparente)
```

**Requisitos:**
- Formato: PNG com fundo transparente
- Cor: Branco ou claro (para contraste em fotos)
- Tamanho: A watermark será escalada para ~30% da menor dimensão da foto

### 2. Configurar Opacidade Padrão

1. Acesse **Configurações** no painel do fotógrafo
2. Vá para **Personalização**
3. Em **Marca D'água Padrão**, ajuste:
   - Tipo: `Padrão` ou `Nenhuma`
   - Opacidade: Use o slider (10-100%)
4. Clique em **Salvar**

### 3. Verificar Processamento

Após upload de novas fotos:
1. As fotos ficarão com status `uploaded`
2. O job `process-photos` executa a cada minuto
3. Três versões são geradas:
   - `thumb/` - 400px (para grid)
   - `preview/` - Tamanho original (sem watermark)
   - `preview-wm/` - Tamanho original (para exibição com watermark)
4. Status muda para `ready`

### 4. Testar Manualmente (Opcional)

Você pode chamar o endpoint manualmente:
```bash
curl -X POST https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 5}'
```

---

## Configurar pg_cron (Execução Automática)

### 1. Habilitar Extensões

No Supabase Dashboard:
1. Vá para **Database > Extensions**
2. Habilite `pg_cron`
3. Habilite `pg_net`

### 2. Criar o Job

Execute no SQL Editor:

```sql
SELECT cron.schedule(
  'process-photos-job',
  '* * * * *',  -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/process-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"batchSize": 10}'::jsonb
  ) AS request_id;
  $$
);
```

### 3. Verificar Jobs Ativos

```sql
SELECT * FROM cron.job;
```

### 4. Ver Histórico de Execuções

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

---

## Fluxo Visual: Watermark por Orientação

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SELEÇÃO AUTOMÁTICA DE WATERMARK                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Foto HORIZONTAL (width >= height):                                         │
│  ┌─────────────────────────────────┐                                        │
│  │                                 │                                        │
│  │      ┌─────────────────┐        │                                        │
│  │      │  WATERMARK      │        │ ← /watermarks/horizontal.png           │
│  │      └─────────────────┘        │                                        │
│  │                                 │                                        │
│  └─────────────────────────────────┘                                        │
│                                                                             │
│  Foto VERTICAL (height > width):                                            │
│  ┌─────────────────┐                                                        │
│  │                 │                                                        │
│  │    ┌───────┐    │                                                        │
│  │    │       │    │ ← /watermarks/vertical.png                             │
│  │    │WMARK  │    │                                                        │
│  │    └───────┘    │                                                        │
│  │                 │                                                        │
│  │                 │                                                        │
│  └─────────────────┘                                                        │
│                                                                             │
│  Tamanho: 30% da menor dimensão da foto                                     │
│  Posição: Sempre centralizada                                               │
│  Opacidade: Configurável (10-100%, default 40%)                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Limitação Atual (MVP)

A composição real da watermark sobre a imagem requer bibliotecas WASM pesadas que não funcionam bem em Edge Functions Deno. 

**Solução atual:**
- O sistema cria 3 paths separados (thumb, preview, preview-wm)
- O frontend exibe a versão correta baseado no contexto
- Para watermark real, considerar no futuro:
  - Cloudflare Worker dedicado com `@cf-wasm/photon`
  - Cloudflare Image Resizing com overlay
  - Serviço externo de processamento

---

## Fallback para Fotos Legadas

O sistema usa `getPhotoUrlWithFallback` que:
1. Se `processing_status === 'ready'` → Usa URLs do R2
2. Caso contrário → Usa URL direta do B2 (sem transformações)

Isso garante que fotos existentes continuem funcionando durante a transição.

---

## Preparação para Watermarks Customizadas (Futuro)

Os types já incluem campos opcionais:
```typescript
export interface WatermarkSettings {
  type: 'none' | 'standard' | 'custom';
  opacity: number;
  position: 'center';
  customHorizontalUrl?: string;  // Futuro
  customVerticalUrl?: string;    // Futuro
}
```

Para implementar watermarks customizadas:
1. Adicionar UI de upload em `WatermarkDefaults.tsx`
2. Salvar URLs no storage (R2 ou Supabase Storage)
3. A Edge Function já suporta buscar de URLs customizadas
