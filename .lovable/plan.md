
Objetivo: eliminar falhas de compartilhamento/publicação sem abrir brecha de acesso indevido a rascunhos.

Diagnóstico da investigação (causas prováveis)
1) Modal de compartilhamento bloqueia envio quando não há token  
- `src/components/SendGalleryModal.tsx`: se `gallery.publicToken` for nulo, mostra “Aguardando Publicação” e não oferece ação para publicar/enviar.
2) Compartilhamento no Dashboard não marca galeria como enviada  
- `src/pages/Dashboard.tsx`: `SendGalleryModal` é aberto sem `onSendGallery`; logo copiar link/WhatsApp não muda status para `enviado`.
3) Race condition no envio  
- No modal, o link é copiado/aberto primeiro e só depois chama `markAsSent()`. Se cliente abrir rápido, `gallery-access` ainda vê status `rascunho` e bloqueia.
4) Erro de acesso mascarado como “não encontrada”  
- `supabase/functions/gallery-access/index.ts` retorna `NOT_AVAILABLE` para status fora de `enviado|selecao_iniciada|expirado`.  
- `src/pages/ClientGallery.tsx` trata quase tudo como “Galeria não encontrada”, sem retry para estado transitório.

Plano de correção seguro
Fase 1 — Tornar publicação/envio atômicos no backend
- Criar RPC transacional (ex.: `prepare_gallery_share(gallery_id)`):
  - valida dono (`auth.uid()`),
  - `SELECT ... FOR UPDATE`,
  - `public_token = COALESCE(public_token, generate_public_token())`,
  - `published_at = COALESCE(published_at, now())`,
  - se `status='rascunho'` => `status='enviado'`, `enviado_em=COALESCE(enviado_em, now())`,
  - log idempotente de ação `enviada`,
  - retorna `token`, `status`, `ready=true`.
- Importante: manter bloqueio de rascunho no `gallery-access` (não liberar draft publicamente).

Fase 2 — Corrigir fluxo de UI de compartilhamento
- `SendGalleryModal`:
  - ao abrir, executar “ensure share ready” (RPC) antes de exibir botão de copiar/WhatsApp.
  - exibir estado “Publicando galeria...” com loading e retry.
  - remover dependência do token já existir localmente.
- `Dashboard.tsx`:
  - passar `onSendGallery` para o modal (mesmo comportamento de `GalleryDetail`).
- `useSupabaseGalleries.ts`:
  - `sendGallery/publishGallery` não devem depender de `getGallery()` do cache para funcionar.
  - sempre buscar/confirmar estado no backend (RPC) e atualizar cache com retorno.

Fase 3 — Melhorar robustez de acesso do cliente
- `ClientGallery.tsx`:
  - diferenciar `NOT_FOUND` vs `NOT_AVAILABLE`.
  - para `NOT_AVAILABLE`, aplicar retry curto automático (ex.: 3 tentativas com backoff) antes da tela final.
  - mostrar mensagem correta: “Galeria em publicação, tente novamente em instantes.”
- `gallery-access`:
  - padronizar payload de erro com `code`, `status`, `retryable`.
  - logs estruturados para `token`, `status`, `motivo_bloqueio`.

Fase 4 — Saneamento e prevenção de regressão
- Auditoria SQL de galerias “presas”:
  - listar `status='rascunho'` com `public_token`/`published_at` preenchidos e ação de envio ausente.
  - corrigir apenas casos comprovados (script controlado; sem publicar rascunhos legítimos).
- Criar checklist de release:
  - compartilhar via Detail e Dashboard,
  - abrir link imediatamente (sem refresh),
  - fluxo com senha,
  - token inválido (erro correto),
  - galeria realmente em rascunho continua bloqueada para cliente.

Detalhes técnicos (arquivos-alvo)
- `src/components/SendGalleryModal.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/GalleryDetail.tsx` (ajuste de integração, se necessário)
- `src/hooks/useSupabaseGalleries.ts`
- `src/pages/ClientGallery.tsx`
- `supabase/functions/gallery-access/index.ts`
- nova migration SQL com RPC transacional de compartilhamento

Critérios de sucesso
- Não existe mais cenário “Enviei para cliente” com status permanecendo “Criada” por falha de fluxo.
- Cliente não depende de refresh para entrar após envio.
- Rascunho continua inacessível publicamente até publicação/envio explícitos.
- Erros de acesso passam a refletir causa real (não encontrado vs não publicado).
