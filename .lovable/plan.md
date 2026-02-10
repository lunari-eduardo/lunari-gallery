

# Fix Definitivo: Download Deliver

## Causa Raiz REAL

O erro `"Not found"` (texto puro, nao JSON) vem da **linha 651** do Worker -- o catch-all para rotas desconhecidas. Isso prova que a rota `/deliver-download/` **nao existe no Worker deployado**. O codigo esta no repositorio mas **nunca foi deployado via `wrangler deploy`**.

Criar uma rota separada criou um problema: dependencia de deploy manual que nao aconteceu.

## Solucao: Eliminar a rota separada

Em vez de manter duas rotas que exigem deploy sincronizado, vamos usar a **mesma rota `/download/`** que ja funciona para Select -- e apenas ajustar a logica no Worker para detectar `tipo=entrega` e pular as verificacoes de finalizacao.

Isso e mais robusto porque:
- Usa infraestrutura ja deployada e testada
- Nao exige novo deploy do Worker (apenas uma mudanca na logica)
- Reduz complexidade de manutencao

### 1. Worker: `cloudflare/workers/gallery-upload/index.ts`

Modificar `handleDownload` para:

```text
1. Buscar galeria com id + select id,tipo,finalized_at,configuracoes
2. Se tipo = 'entrega':
   - Pular verificacao de finalized_at
   - Pular verificacao de allowDownload
   - Ir direto para serveFileAsDownload
3. Se tipo != 'entrega' (Select):
   - Manter verificacao de finalized_at
   - Manter verificacao de allowDownload
```

Remover `handleDeliverDownload` e a rota `/deliver-download/` (codigo morto).

### 2. Frontend: `src/lib/deliverDownloadUtils.ts`

Mudar para usar a rota `/download/` (mesma do Select):

```text
ANTES:  /deliver-download/{path}
DEPOIS: /download/{path}
```

Manter o modulo separado para clareza organizacional, mas apontar para a mesma rota.

### 3. Nenhuma mudanca nos componentes

`ClientDeliverGallery.tsx` e `DeliverLightbox.tsx` continuam importando de `deliverDownloadUtils.ts`. Apenas a URL interna muda.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `cloudflare/workers/gallery-upload/index.ts` | Ajustar `handleDownload` para detectar tipo=entrega e pular checks. Remover `handleDeliverDownload` e rota `/deliver-download/` |
| `src/lib/deliverDownloadUtils.ts` | Mudar rota de `/deliver-download/` para `/download/` |

## Apos implementacao

Voce precisa fazer `wrangler deploy` no terminal. Dessa vez a mudanca e APENAS na funcao `handleDownload` que ja existe na rota `/download/` ja deployada -- entao mesmo que o deploy demore, a rota ja existe.

---

## Sobre tabela separada para Deliver

NAO e recomendado criar uma tabela separada agora. Razoes:

- A tabela `galerias` ja tem a coluna `tipo` que diferencia perfeitamente
- Duplicar tabela criaria necessidade de manter migrations, RLS, triggers e queries em dobro
- A separacao deve ser no **codigo** (rotas, modulos, componentes), nao no **schema**
- Se no futuro Deliver crescer muito em funcionalidades exclusivas, ai sim pode-se avaliar. Mas hoje seria over-engineering

A separacao ja esta bem feita:
- Frontend: componentes Deliver separados (`DeliverHero`, `DeliverGrid`, etc.)
- Frontend: modulo de download separado (`deliverDownloadUtils.ts`)
- Backend: filtro `tipo=entrega` nas queries
