

# Diagnóstico: Download de Vídeo em Transfer — "Gallery not finalized"

## Causa Raiz

O erro vem do Cloudflare Worker (`handleDownload`), que verifica `finalized_at` para galerias não-Transfer. A lógica atual no código do repositório inclui um bypass `isDeliver` (linha 415-418), mas existem **dois problemas**:

1. **Worker não redeployado**: O código com o bypass `isDeliver` foi adicionado na última edição (suporte a vídeo), mas o Cloudflare Worker requer `wrangler deploy` manual. O Worker em produção provavelmente ainda roda a versão antiga, que **não tem o bypass** para galerias Transfer.

2. **Rota `/deliver-download/` removida prematuramente**: O `deliverDownloadUtils.ts` tem no comentário "Uses /deliver-download/ route" mas o código real já usa `/download/` (linha 23). A rota dedicada `/deliver-download/` foi removida do Worker na mesma edição, unificando tudo em `/download/`. Isso criou uma dependência frágil: todo download de Transfer agora depende do bypass `tipo === 'entrega'` dentro do `handleDownload`.

3. **Problema de timing**: Mesmo que o Worker seja redeployado, se por qualquer motivo o campo `tipo` não estiver como `'entrega'` no banco, o download falha.

## Plano de Correção

### 1. Restaurar rota dedicada `/deliver-download/` no Worker

Adicionar de volta uma rota `/deliver-download/{path}` que serve arquivos **sem nenhuma verificação** de `finalized_at` ou `allowDownload`. Apenas verifica se a foto pertence à galeria (anti-enumeration). Isso elimina a dependência do campo `tipo`.

### 2. Atualizar `deliverDownloadUtils.ts` para usar `/deliver-download/`

Mudar `buildDeliverDownloadUrl` para usar `/deliver-download/` em vez de `/download/`, alinhando o comentário com o código e garantindo que Transfer nunca passe pela verificação de finalização.

### 3. Manter o bypass `isDeliver` em `handleDownload` como fallback

Se por qualquer razão o frontend usar `/download/`, o bypass `tipo === 'entrega'` continua funcionando.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `cloudflare/workers/gallery-upload/index.ts` | Adicionar rota `/deliver-download/` + handler dedicado |
| `src/lib/deliverDownloadUtils.ts` | Usar `/deliver-download/` na URL, atualizar comentário |

**Nota crítica**: Após a edição, o Worker precisa ser redeployado via `wrangler deploy` para que as mudanças entrem em produção.

