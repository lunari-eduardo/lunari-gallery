
Diagnóstico (já confirmado)
- O frontend de Deliver ainda gera URL com `/deliver-download/...` em `src/lib/deliverDownloadUtils.ts`.
- O endpoint publicado `https://cdn.lunarihub.com/deliver-download/...` responde `Not found`.
- O endpoint `https://cdn.lunarihub.com/download/...` está ativo.
- No caso real enviado, o banco está consistente:
  - `galerias.id=95fdf...` com `tipo='entrega'`, `status='enviado'`, `finalized_at` preenchido.
  - `galeria_fotos.original_path='originals/95fdf.../1773519609464-13083988.mp4'` (path correto).
=> Causa principal atual: mismatch de rota (frontend antigo vs worker publicado).

Plano de correção (seguro e direto)
1) Normalizar rota de download Deliver para `/download/`
- Alterar `buildDeliverDownloadUrl()` em `src/lib/deliverDownloadUtils.ts` para:
  `/download/{storagePath}?filename=...`
- Atualizar comentários/documentação no próprio arquivo para evitar regressão.

2) Auditoria completa de referências
- Rodar busca global por `deliver-download` no projeto e eliminar qualquer geração residual de link.
- Validar também chamadas indiretas (share/download helpers, modais, ações de lightbox).

3) Endurecer validação do Worker (`/download`)
- Manter/garantir suporte para arquivos de Deliver via `tipo='entrega'` sem bloqueio indevido.
- Adicionar logs estruturados no Worker para debug:
  - `route`, `rawPath`, `decodedPath`, `galleryId`, `status`, `tipo`, motivo do 403/404.
- Melhorar erro para diferenciar:
  - `PHOTO_NOT_FOUND_IN_GALLERY`
  - `FILE_NOT_FOUND_IN_STORAGE`
  - `GALLERY_NOT_FINALIZED` (somente quando realmente aplicável).

4) Verificações de dados (preventivo)
- Auditoria SQL para vídeos Deliver:
  - `original_path` nulo/inválido
  - `original_path` fora do padrão `originals/{galleryId}/{filename}`
  - divergência entre `galeria_fotos.galeria_id` e path.
- Corrigir apenas registros inconsistentes.

5) Validação fim a fim (obrigatória)
- Abrir galeria Deliver com vídeo e confirmar:
  - player carrega preview via `media.lunarihub.com/galleries/...`
  - download individual chama `cdn.lunarihub.com/download/originals/{galleryId}/{filename}`
  - download em lote (ZIP) inclui vídeo corretamente
  - sem requests para `/deliver-download/`.
- Conferir logs do Worker para o path real recebido e status de cada etapa.

Critério de aceite
- 0 requisições para `/deliver-download/` em fluxo Deliver.
- Download de vídeo funciona sem “Not found” e sem “Gallery not finalized” indevido.
- Path final sempre no formato esperado: `/download/originals/{galleryId}/{filename}`.
