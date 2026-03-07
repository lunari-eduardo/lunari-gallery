
Objetivo: fazer uma varredura completa e corrigir de forma definitiva o fluxo de reinserção de fotos em pastas na edição de galeria.

Diagnóstico (varredura completa já feita):
1) Fluxo frontend (GalleryEdit → FolderManager → PhotoUploader → UploadPipeline):
- O `addFiles()` está sendo chamado (há log de refresh de sessão), mas não há requests para `functions/v1/r2-upload` nas tentativas.
- Isso prova que a falha acontece ANTES da chamada backend.

2) Fluxo de rede/edge:
- Snapshot de rede mostra apenas GET de `galeria_fotos` (sem POST de upload).
- Edge logs de `r2-upload` não mostram execução no momento da falha.
- Portanto não é bloqueio de RLS/permissão no insert para esse caso específico.

3) Banco/permissões:
- `galeria_pastas` e `galeria_fotos` com owner correto.
- FK `galeria_fotos.pasta_id -> galeria_pastas.id` está válida.
- RLS atual não é o gargalo dessa falha (upload nem chega no backend).

Do I know what the issue is?
Sim. O problema principal é um “no-op silencioso” no frontend:
- validação de tipo está rígida demais (`isValidImageType` só aceita alguns MIME estritos);
- quando todos os arquivos são rejeitados, o código continua o fluxo (refresh + pipeline com array vazio), sem erro técnico claro;
- resultado: usuário “envia”, não aparece nada na pasta, e parece que pastas não aceitam reinserção.

Plano de correção (implementação):
1) Fortalecer validação de arquivos (frontend)
- Arquivo: `src/lib/imageCompression.ts`
- Ajustar `isValidImageType` para aceitar:
  - MIME comuns: `image/jpeg`, `image/jpg`, `image/pjpeg`, `image/png`, `image/webp`
  - fallback por extensão (`.jpg`, `.jpeg`, `.png`, `.webp`) quando `file.type` vier vazio/inconsistente.
- Isso elimina rejeição indevida de JPG válidos.

2) Eliminar no-op silencioso no uploader
- Arquivo: `src/components/PhotoUploader.tsx`
- Em `addFiles()`:
  - se `validFiles.length === 0`, retornar imediatamente com toast explícito:
    “Nenhuma imagem válida selecionada. Formatos aceitos: JPG/JPEG, PNG, WEBP”.
  - incluir log de diagnóstico com `name/type/size` dos arquivos rejeitados (temporário, para fechar esse bug).
- Atualizar `accept` do input para incluir extensões também:
  - `accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"`
- Resultado: quando houver rejeição, o usuário verá o motivo claro e não haverá falsa impressão de envio.

3) Blindagem de pasta no backend (consistência e segurança)
- Arquivo: `supabase/functions/r2-upload/index.ts`
- Antes do insert, validar que `folderId` (quando enviado):
  - existe,
  - pertence à mesma `galeria_id`,
  - pertence ao mesmo `user_id`.
- Se inválido, retornar 400 com erro claro (`INVALID_FOLDER_CONTEXT`).
- Evita upload “sucesso” com pasta inconsistente em cenários de corrida/troca rápida de pasta.

4) Observabilidade do fluxo (para encerrar loop de tentativas)
- Arquivo: `src/components/PhotoUploader.tsx`
- Adicionar logs pontuais:
  - quantidade total recebida,
  - quantidade validada,
  - motivo de rejeição por arquivo,
  - `folderId` ativo no momento do envio.
- Mantidos temporariamente até confirmar estabilidade.

5) Revisão do warning de ref em GalleryEdit
- Arquivos: `src/pages/GalleryEdit.tsx` e usos de `PhotoUploader`
- Fazer varredura por passagem de `ref` indireta/spread para `PhotoUploader`.
- Corrigir origem do warning (não é a causa raiz do upload, mas polui debug e mascara sinais reais).

Validação pós-correção (obrigatória):
1) Editar galeria existente → pasta A:
- subir JPG novo,
- confirmar POST para `r2-upload`,
- confirmar linha criada em `galeria_fotos` com `pasta_id = pasta A`.

2) Criar pasta nova na edição → selecionar essa pasta:
- subir 2 imagens,
- confirmar ambas com `pasta_id` da pasta nova.

3) Reenviar arquivo com MIME inconsistente (ou type vazio):
- confirmar fallback por extensão e upload funcionando.

4) Testar erro real:
- enviar arquivo inválido (ex.: PDF),
- confirmar toast explícito e nenhum falso “envio”.

5) Validar cliente:
- pasta/álbum continua mostrando novas fotos corretamente via `folder_id/pasta_id`.

Resultado esperado:
- reinserção volta a funcionar na edição,
- novas fotos entram na pasta selecionada,
- falhas de tipo não ficam silenciosas,
- fluxo fica auditável e previsível.
