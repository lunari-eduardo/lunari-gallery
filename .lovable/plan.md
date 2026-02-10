

# Fix Definitivo: Download Deliver e Select

## Causa Raiz

O frontend usa `encodeURIComponent(storagePath)` que transforma `originals/gallery/file.jpg` em `originals%2Fgallery%2Ffile.jpg`. Isso cria problemas porque:

1. `%2F` vs `/` sao tratados diferente por browsers, CDNs e proxies
2. O Worker precisa decodificar, mas a versao deployada pode nao ter esse decode
3. A rota `/image/` funciona porque usa slashes reais: `media.lunarihub.com/galleries/id/file.jpg`

## Solucao: Usar slashes reais (mesmo padrao do `/image/`)

Em vez de encodar o path inteiro, usar slashes reais no URL, encodando apenas os segmentos individuais (nomes de arquivo). Isso elimina a necessidade de decode no Worker.

```text
ANTES (quebrado):
  /deliver-download/originals%2Fd36ba2bf...%2Ffile.jpg

DEPOIS (funciona):
  /deliver-download/originals/d36ba2bf.../file.jpg
```

## Mudancas

### 1. `src/lib/deliverDownloadUtils.ts`

Reescrever `buildDeliverDownloadUrl`:

```text
ANTES:
  encodeURIComponent(storagePath)  →  originals%2Fgallery%2Ffile.jpg

DEPOIS:
  storagePath.split('/').map(encodeURIComponent).join('/')  →  originals/gallery/file.jpg
```

Cada segmento do path e encodado individualmente (para tratar espacos ou caracteres especiais no nome do arquivo), mas as barras permanecem como barras reais.

### 2. `src/lib/downloadUtils.ts`

Mesma correcao em `buildDownloadUrl` para consistencia (Select downloads tambem).

### 3. Worker: `cloudflare/workers/gallery-upload/index.ts`

Remover `decodeURIComponent` das rotas `/download/` e `/deliver-download/` (linhas 628 e 634), pois com slashes reais o path ja chega decodificado via `url.pathname`. Manter apenas encode nos parametros de query do Supabase REST.

Tambem remover `decodeURIComponent` da rota `/image/` (linha 640) que ja funciona sem ele -- confirmar consistencia.

### 4. Nenhuma mudanca de componentes

Os componentes `ClientDeliverGallery.tsx`, `DeliverLightbox.tsx`, `DownloadModal.tsx`, `Lightbox.tsx` nao mudam. Apenas o modulo de utilidades muda internamente.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/deliverDownloadUtils.ts` | Corrigir `buildDeliverDownloadUrl` para usar slashes reais |
| `src/lib/downloadUtils.ts` | Corrigir `buildDownloadUrl` para usar slashes reais |
| `cloudflare/workers/gallery-upload/index.ts` | Remover `decodeURIComponent` desnecessario das rotas de download |

## Resultado

- URLs de download usam o mesmo padrao que `/image/` (que ja funciona)
- Nenhuma dependencia de decode no Worker
- Download individual Deliver: funciona sem "not found"
- Download ZIP Deliver: fetch com URL correta, ZIP com conteudo
- Download Select: mantido funcionando (mesma correcao)
- Deploy do Worker fica mais simples (sem logica de decode)

## Apos implementacao

Voce precisa fazer `wrangler deploy` no terminal para ativar as mudancas no Worker.

