<final-text>Do I know what the issue is? Sim.

Problema exato:
- A tela de “seleção finalizada” já existe no frontend.
- Ela não aparece nesse link porque o app nem chega ao estado `finalized`: o `gallery-access` está devolvendo `NOT_FOUND` para o token `vd2zupjtbENx`.
- O erro mais provável e consistente no código é um bug de troca de token no compartilhamento:
  1. `SendGalleryModal.tsx` chama `prepare_gallery_share` e recebe um token.
  2. Ao copiar/enviar, `markAsSent()` chama `onSendGallery()`.
  3. `sendGalleryMutation` em `useSupabaseGalleries.ts` usa a galeria do cache local.
  4. Se esse cache ainda está sem `publicToken`, ele gera outro token e sobrescreve `galerias.public_token`.
  5. Resultado: o cliente recebe um token antigo, mas o banco passa a aceitar outro. O link vira 404 e a tela finalizada nunca renderiza.

Arquivos críticos:
- `src/components/SendGalleryModal.tsx`
- `src/hooks/useSupabaseGalleries.ts`
- `src/pages/GalleryDetail.tsx`
- `src/pages/Dashboard.tsx`
- `supabase/functions/gallery-access/index.ts`

Plano de correção segura:
1. Unificar a publicação em uma única fonte de verdade
- Fazer `sendGalleryMutation` parar de gerar token no cliente.
- Usar apenas a RPC `prepare_gallery_share` para token + status de envio.
- Remover a segunda “publicação” disparada pelo modal.

2. Blindar o modal de compartilhamento
- O link exibido/copiado no `SendGalleryModal` deve ser exatamente o token retornado pela RPC.
- Após preparar a galeria, invalidar/refetchar as queries para sincronizar painel e detalhe.
- Em `GalleryDetail.tsx`, adicionar refresh pós-compartilhamento, como já existe no `Dashboard`.

3. Reparar links já quebrados
- Criar uma migração com tabela de aliases de token público para aceitar tokens antigos e atuais.
- Atualizar `gallery-access` para resolver primeiro por alias e depois por `galerias.public_token`.
- Inserir `vd2zupjtbENx` como alias da galeria afetada, para esse link voltar a funcionar.

4. Manter a regra imutável da galeria finalizada
- Com o token resolvendo corretamente, o fluxo volta ao comportamento certo:
  - `allowDownload = false` → mensagem “Seleção finalizada com sucesso, para acessá-la novamente, entre em contato com o(a) fotógrafo(a)”
  - `allowDownload = true` → preview final com fotos para download
- Revisar `gallery-access` para garantir `finalized: true` + `allowDownload` consistente.

5. QA ponta a ponta
- Testar primeira publicação de galeria sem token prévio.
- Testar cópia de link, WhatsApp e reabertura do modal.
- Testar galeria finalizada sem download: nunca pode cair em “Galeria não encontrada”.
- Testar galeria finalizada com download.
- Testar o link histórico `vd2zupjtbENx` após o reparo.

Implementação prevista:
- `src/components/SendGalleryModal.tsx`
- `src/hooks/useSupabaseGalleries.ts`
- `src/pages/GalleryDetail.tsx`
- `supabase/functions/gallery-access/index.ts`
- `supabase/migrations/...sql`

Resultado esperado:
- o token não muda mais depois de ser compartilhado,
- links antigos podem continuar válidos,
- e a tela finalizada correta passa a aparecer em todos os cenários.</final-text>