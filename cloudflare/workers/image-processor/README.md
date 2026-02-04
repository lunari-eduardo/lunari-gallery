# Image Processor Worker - Instruções de Deploy

## Opção 1: Deploy Completo (Recomendado - WASM)

Requer ambiente local com Node.js instalado.

```bash
cd cloudflare/workers/image-processor
npm install
wrangler login
wrangler secret put SUPABASE_URL
# Digite: https://tlnjspsywycbudhewsfv.supabase.co

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Digite sua service role key

wrangler secret put WORKER_AUTH_SECRET
# Digite uma string aleatória forte (ex: use `openssl rand -hex 32`)

wrangler deploy
```

Após o deploy, anote a URL do Worker (ex: `https://lunari-image-processor.SEU-ACCOUNT.workers.dev`)

---

## Opção 2: Quick Edit (Sem ambiente local)

Se você não tem ambiente local configurado:

1. **Acesse o Cloudflare Dashboard** → Workers & Pages → Create Application → Create Worker

2. **Nome do Worker**: `lunari-image-processor`

3. **Cole o código** do arquivo `index.simple.js` no editor

4. **Configure Variáveis** (Settings → Variables → Environment Variables):
   - `SUPABASE_URL`: `https://tlnjspsywycbudhewsfv.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: (sua chave - marque como Secret)
   - `B2_PUBLIC_URL`: `https://f005.backblazeb2.com/file/lunari-gallery`
   - `CDN_URL`: `https://cdn.lunarihub.com`
   - `WORKER_AUTH_SECRET`: (gere uma string forte - marque como Secret)

5. **Vincule o R2 Bucket** (Settings → Variables → R2 Bucket Bindings):
   - Variable name: `GALLERY_BUCKET`
   - R2 bucket: `lunari-gallery`

6. **Deploy** e anote a URL

---

## Configurar o Supabase

Após o deploy do Worker, adicione os secrets na Edge Function:

1. Acesse: https://supabase.com/dashboard/project/tlnjspsywycbudhewsfv/settings/functions

2. Adicione:
   - `IMAGE_PROCESSOR_URL`: URL do seu Worker (ex: `https://lunari-image-processor.SEU-ACCOUNT.workers.dev`)
   - `IMAGE_PROCESSOR_SECRET`: Mesmo valor do `WORKER_AUTH_SECRET`

---

## Testar

```bash
# Health check
curl https://lunari-image-processor.SEU-ACCOUNT.workers.dev/health

# Deve retornar: {"status":"ok","version":"1.0.0"}
```

---

## Diferenças entre as versões

| Aspecto | index.ts (WASM) | index.simple.js |
|---------|-----------------|-----------------|
| Resize real | ✅ Sim | ❌ Não* |
| Watermark real | ✅ Sim | ❌ Não* |
| Deploy | Via wrangler | Quick Edit |
| Performance | Máxima | Adequada |

*A versão simple armazena o original e depende de resize on-the-fly no serve ou no frontend.

---

## Próximos Passos

Se você optar pela versão Simple inicialmente, pode migrar para WASM depois quando tiver ambiente local configurado.
