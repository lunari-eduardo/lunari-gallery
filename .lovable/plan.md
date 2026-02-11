

# Fix Definitivo: Download Deliver sem depender de deploy do Worker

## Diagnostico Final

O codigo no repositorio esta correto (`tipo === 'entrega'` bypass na linha 373). Mas o Worker **deployado** na Cloudflare ainda roda a versao antiga que sempre exige `finalized_at`. Cada mudanca no Worker exige `wrangler deploy` manual, criando uma dependencia fragil.

## Solucao: Fazer Deliver passar nas verificacoes existentes do Worker

Em vez de depender de logica especial no Worker, vamos garantir que galerias Deliver **sempre tenham `finalized_at` preenchido** ao serem publicadas. Assim o Worker deployado (que verifica `finalized_at`) aceita o download.

Isso e mais robusto porque:
- Funciona com QUALQUER versao do Worker (atual e futura)
- Nao exige deploy manual
- Deliver e Select usam a mesma rota `/download/` sem conflito
- O campo `finalized_at` em Deliver significa "pronta para acesso" (publicada)

## Mudancas

### 1. `src/hooks/useSupabaseGalleries.ts` - sendGalleryMutation

Ao publicar uma galeria Deliver, adicionar `finalized_at` e garantir `allowDownload: true` nas configuracoes:

```text
ANTES (linha 504-512):
  update({
    status: 'enviado',
    enviado_em: new Date().toISOString(),
    prazo_selecao: prazoSelecao.toISOString(),
    public_token: publicToken,
  })

DEPOIS:
  // Detectar se e Deliver
  const isDeliver = gallery.tipo === 'entrega';
  
  update({
    status: 'enviado',
    enviado_em: new Date().toISOString(),
    prazo_selecao: prazoSelecao.toISOString(),
    public_token: publicToken,
    // Deliver: marcar como finalizada para permitir download via Worker
    ...(isDeliver && {
      finalized_at: new Date().toISOString(),
      configuracoes: {
        ...gallery.configuracoes,
        allowDownload: true,
      },
    }),
  })
```

### 2. Correcao de dados existentes (SQL one-time)

Atualizar galerias Deliver existentes no banco para que tambem funcionem:

```sql
UPDATE galerias
SET finalized_at = enviado_em,
    configuracoes = COALESCE(configuracoes, '{}'::jsonb) || '{"allowDownload": true}'::jsonb
WHERE tipo = 'entrega'
  AND finalized_at IS NULL
  AND status = 'enviado';
```

### 3. Worker: manter o codigo como esta

O codigo do Worker no repositorio ja tem o bypass `isDeliver` (defensivo). Quando/se o Worker for deployado futuramente, ambas as protecoes estarao ativas (campo preenchido + bypass no codigo). Nenhum conflito.

### 4. `src/lib/deliverDownloadUtils.ts` - sem mudanca

Ja usa `/download/` (correto). Nenhuma alteracao necessaria.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/hooks/useSupabaseGalleries.ts` | sendGalleryMutation: adicionar `finalized_at` e `allowDownload` para Deliver |
| Migration SQL | One-time fix para galerias Deliver existentes |

## Resultado

- Download individual Deliver: funciona imediatamente (sem deploy do Worker)
- Download ZIP Deliver: funciona imediatamente
- Select: nenhuma mudanca, continua exigindo finalizacao real
- Worker futuro: compativel com ambas as estrategias
- Zero dependencia de deploy manual

