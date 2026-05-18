# Investigação: erros no upload de imagens em galerias

## Causa raiz identificada

Olhando o console do print, há **três sintomas** acontecendo ao mesmo tempo:

### 1. ❌ CORS bloqueando watermark do sistema (CAUSA PRIMÁRIA das falhas)
```
Access to image at 'https://media.lunarihub.com/system-assets/default-watermark-h.png'
from origin 'https://gallery.lunarihub.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

No `src/lib/imageCompression.ts` (linha 69) o watermark é carregado com `img.crossOrigin = 'anonymous'` — obrigatório porque depois o Canvas precisa exportar `toBlob`. Se o asset não vier com header `Access-Control-Allow-Origin: *`, o navegador rejeita.

E em `processItem` (linha 358-361):
```ts
if (this.opts.watermarkConfig && this.opts.watermarkConfig.mode !== 'none') {
  throw err; // Watermark is mandatory – do not fallback
}
```
→ Quando o watermark falha, **a foto inteira falha**.

**Por que algumas falham e outras não, no mesmo computador?**
Race com o cache do navegador: o primeiro request da watermark é feito quase em paralelo para várias fotos. O navegador faz uma busca de rede sem CORS válido, armazena em cache como "não-CORS", e os requests subsequentes com `crossOrigin='anonymous'` falham. Já em sessões anteriores o asset pode estar em cache válido — por isso "só uma falhou" no seu PC e **todas falham no outro PC** (cache limpo / regras de cache diferentes).

A pista definitiva está no próprio console:
```
GET https://media.lunarihub.com/system-assets/default-watermark-h.png
net::ERR_FAILED 200 (OK)
```
HTTP 200, mas falhou no canvas pela ausência do header CORS.

### 2. ❌ Worker desatualizado em produção — `POST /upload-cover` 404
```
POST https://cdn.lunarihub.com/upload-cover 404 (Not Found)
```
O código fonte do worker (`cloudflare/workers/gallery-upload/index.ts` linha 707) tem a rota, mas o worker em produção retorna 404 → **deploy desatualizado**. Esse upload é "best effort" (não quebra a foto), mas polui o console e impede que galerias usem covers sem watermark.

### 3. ⚠️ Botão "Tentar novamente" parece inerte
A lógica em `retry()` está correta (reseta status, chama `tick()`). O motivo dele "não fazer nada" visualmente é que a falha é instantânea: o watermark já está marcado como erro no cache do navegador, então o retry falha em milissegundos e o item volta ao estado de erro. **Não é bug do botão — é o mesmo problema #1 se repetindo.**

---

## Plano de correção

### Etapa 1 — Configurar CORS no bucket R2 `lunari-previews` (correção crítica)
Esta correção é fora do código (painel Cloudflare R2 → bucket `lunari-previews` → Settings → CORS Policy). Adicionar:

```json
[
  {
    "AllowedOrigins": [
      "https://gallery.lunarihub.com",
      "https://lunari-gallery.lovable.app",
      "https://*.lovable.app",
      "http://localhost:*"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Vou te passar o passo-a-passo exato após aprovação do plano. **Sem isto, qualquer ajuste em código continuará falhando para navegadores sem cache.**

### Etapa 2 — Redeploy do Cloudflare Worker `gallery-upload`
A rota `/upload-cover` existe no fonte mas não em produção. Solução: rodar `wrangler deploy` no diretório `cloudflare/workers/gallery-upload/`. Vou te passar o comando exato.

### Etapa 3 — Hardening no `imageCompression.ts` (defesa em profundidade)
Mudanças mínimas para tornar o upload resiliente mesmo se o CORS voltar a falhar no futuro:

1. **Fetch + Blob URL para watermark do sistema**: em vez de carregar a imagem direto pela URL com `crossOrigin`, fazer `fetch(url)` → `URL.createObjectURL(blob)` → carregar no `<img>`. Isso isola o problema de CORS de imagem (o `fetch` de assets públicos via mesma origem que aceita `*` funciona melhor com Workers/R2).
2. **Retry com cache-buster** dentro do `loadImageFromUrl`: se o primeiro `onerror` disparar, tentar novamente com `?cb=<timestamp>` para forçar bypass do cache "envenenado".
3. **Mensagem de erro mais clara**: em vez de "Erro ao enviar", mostrar "Falha ao carregar marca d'água — recarregue a página" para o usuário entender que F5 resolve.

### Etapa 4 — Robustecer botão "Tentar novamente" no `uploadPipeline.ts`
- Ao chamar `retry()`, **invalidar o cache local** do watermark loader (ver Etapa 3) para que a próxima tentativa busque a watermark do zero.
- Após 3 retries com a mesma causa (watermark CORS), exibir mensagem específica em vez de simplesmente desabilitar o botão.

### Etapa 5 — Verificação
1. Limpar cache do navegador no PC problemático.
2. Subir 5+ fotos numa galeria de teste com watermark sistema.
3. Confirmar zero erros 4xx/CORS no console.
4. Testar botão "Tentar novamente" forçando falha (offline momentâneo).

---

## Arquivos a alterar (código)

```text
src/lib/imageCompression.ts        ← loadImageFromUrl via fetch+blob, retry com cache-buster
src/lib/uploadPipeline.ts          ← reset de cache do watermark no retry()
src/components/PhotoUploader.tsx   ← mensagem específica para falha de watermark
```

**Fora do código (ações suas no Cloudflare):**
- Aplicar política CORS no bucket R2 `lunari-previews`
- Redeploy do Worker `gallery-upload`

---

## Resumo executivo

| Problema | Causa | Correção |
|---|---|---|
| Fotos falham (1 ou todas) | CORS ausente em `media.lunarihub.com` para asset de watermark | Configurar CORS no R2 + fetch+blob no client |
| `POST /upload-cover` 404 | Worker em produção desatualizado | `wrangler deploy` |
| "Tentar novamente" inerte | Cache do navegador envenenado pelo erro CORS | Cache-buster + reset no retry |

Aprovando, eu já implemento as Etapas 3, 4 e 5 (código) e te passo os comandos exatos das Etapas 1 e 2 (Cloudflare).
