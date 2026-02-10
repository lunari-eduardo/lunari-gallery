

# Correcao: Download em Galerias de Entrega

## Problema

O Cloudflare Worker (`cloudflare/workers/gallery-upload/index.ts`) bloqueia downloads de galerias Deliver porque:

1. **Linha 377**: Exige `finalized_at` preenchido -- galerias Deliver nunca sao "finalizadas" (nao ha fluxo de selecao)
2. **Linha 385**: Exige `configuracoes.allowDownload === true` -- galerias Deliver podem nao ter esse flag

Resultado: o Worker retorna `{"error":"Gallery not finalized"}` com status 403. Como o `triggerBrowserDownload` abre essa URL em `target="_blank"`, o navegador navega para a tela de erro em vez de baixar. No caso do "Baixar Todas", a primeira foto causa essa navegacao e as demais nunca executam.

## Solucao

### 1. `cloudflare/workers/gallery-upload/index.ts` -- Ajustar `handleDownload`

Adicionar `tipo` ao SELECT da galeria e, quando `tipo === 'entrega'`, pular as verificacoes de `finalized_at` e `allowDownload`:

```text
// Busca atual (linha 359):
select=id,finalized_at,configuracoes

// Nova busca:
select=id,finalized_at,configuracoes,tipo
```

Logica ajustada:

```text
const isDeliver = gallery.tipo === 'entrega';

if (!isDeliver) {
  // Selecao: manter verificacoes existentes
  if (!gallery.finalized_at) --> 403 "Gallery not finalized"
  if (config?.allowDownload !== true) --> 403 "Download not allowed"
}
// Deliver: pula ambas as verificacoes, download sempre permitido
```

A verificacao de que o `path` pertence a uma foto da galeria (linhas 393-409) continua ativa para ambos os tipos -- isso garante seguranca sem bloquear Deliver.

### 2. Nenhuma mudanca no frontend

O codigo de `downloadUtils.ts` e `ClientDeliverGallery.tsx` ja esta correto. O problema e exclusivamente no Worker que rejeita a requisicao.

## Arquivo

| Arquivo | Acao |
|---------|------|
| `cloudflare/workers/gallery-upload/index.ts` | Ajustar `handleDownload` para permitir download em galerias `entrega` |

## Observacao

Este arquivo e um Cloudflare Worker (nao e Edge Function do Supabase). Apos a mudanca no codigo, sera necessario fazer deploy manualmente via `wrangler deploy` no ambiente Cloudflare.
