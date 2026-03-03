
Objetivo: eliminar falhas de UX no upload, aumentar robustez para lotes grandes (centenas) e bloquear avanço da criação da galeria quando houver arquivos com erro não resolvidos.

Diagnóstico (com base no código atual):
1) Mensagem de erro
- Origem: `src/lib/retryFetch.ts` (`getUploadErrorMessage`).
- Fallback atual retorna: “Erro ao enviar. Verifique sua conexão.” (igual ao problema reportado).

2) Botão “Tentar novamente” escondido
- Origem: `src/components/PhotoUploader.tsx`.
- O card tem overlays concorrentes (status + faixa de nome/tamanho no rodapé). A faixa de nome fica por cima do botão em alguns estados, bloqueando clique.

3) Falhas não são reprocessadas automaticamente ao fim do lote
- Hoje existe retry interno por request (3 tentativas no pipeline), mas quando o pipeline termina com itens em `error`, não há rodada automática de reenvio no cliente.

4) Usuário consegue prosseguir no wizard com erro pendente
- `src/pages/GalleryCreate.tsx` não recebe estado de erro/upload do `PhotoUploader` e `handleNext` não bloqueia passo 4 com erro.
- Resultado: pode avançar sem resolver uploads falhos.

5) Escalabilidade para centenas de arquivos
- Gargalos no front:
  - atualização de item via `setItems(prev => prev.map(...))` em toda mudança de progresso (custo alto com muitos itens),
  - ingestão de muitos arquivos de uma vez (criação massiva de object URLs e renderizações),
  - ausência de ajuste explícito de concorrência por capacidade do dispositivo na camada de UI.

Plano de implementação (completo e funcional):

A) UX de erro e clique no retry (PhotoUploader + retryFetch)
1. `src/lib/retryFetch.ts`
- Alterar fallback final para: `Erro ao enviar`.
- Ajustar também o branch de network para mesma mensagem curta (evitar voltar ao texto antigo em cenários comuns).

2. `src/components/PhotoUploader.tsx`
- Corrigir stacking/click:
  - definir z-index da camada de erro/retry acima da faixa do nome,
  - aplicar `pointer-events-none` na faixa de nome/tamanho e `pointer-events-auto` no botão de retry,
  - opcionalmente ocultar faixa inferior enquanto status = `error` para evitar colisão visual.
- Resultado: “Tentar novamente” sempre clicável.

B) Reenvio automático pós-lote (PhotoUploader)
1. Adicionar retry automático em rodadas após `onPipelineComplete`:
- Regra:
  - Se terminou e existem itens `error` com `retryCount < 3`, iniciar rodada automática.
  - 2 rodadas automáticas no máximo (ex.: +5s e +10s).
  - Em cada rodada, chamar `pipeline.retry(id)` para todos erros retryáveis.
- Evitar loop infinito com contador em `useRef`.
- Exibir toast informativo: “X arquivo(s) com erro. Tentando novamente automaticamente...”.

2. Finalização:
- Só considerar “estado final com erro” após esgotar rodadas automáticas.
- Manter retry manual por item disponível.

C) Bloqueio de avanço com notificação (GalleryCreate)
1. `src/components/PhotoUploader.tsx`
- Expor callback novo para estado do lote (ex.: `onQueueStateChange`):
  - `isUploading`
  - `errorCount`
  - `retryableErrorCount`
  - `totalCount`
  - `doneCount`

2. `src/pages/GalleryCreate.tsx`
- Armazenar estado vindo do uploader (ex.: `isUploadingPhotos`, `uploadErrorCount`).
- Passar `onUploadingChange` e `onQueueStateChange` ao `PhotoUploader`.
- No `handleNext`, quando `currentStep === 4`:
  - se `isUploadingPhotos`: bloquear e notificar “Aguarde finalizar os uploads.”
  - se `uploadErrorCount > 0`: bloquear e notificar “Existem arquivos com erro. Reenvie ou remova antes de prosseguir.”
- Opcional recomendado: banner fixo no passo 4 com contagem de erros pendentes.

D) Melhoria de velocidade para centenas (sem quebrar robustez)
1. `src/components/PhotoUploader.tsx`
- Trocar atualização por `map` global para atualização pontual por índice/id (reduz rerender massivo).
- Ingerir arquivos em chunks ao adicionar (ex.: 50 por ciclo com pequeno yield `setTimeout(0)`), para evitar travamento ao selecionar centenas.

2. `src/lib/uploadPipeline.ts` + `PhotoUploader`
- Ajustar concorrência de compressão dinamicamente por `navigator.hardwareConcurrency` (ex.: 2 padrão, 3 em máquinas mais fortes).
- Manter upload concorrente controlado (não agressivo para evitar aumento de erro).

3. Preservar segurança de crédito/idempotência
- Sem alterar fluxo de débito pós-sucesso nem `upload_key`.

Arquivos-alvo:
- `src/lib/retryFetch.ts`
- `src/components/PhotoUploader.tsx`
- `src/pages/GalleryCreate.tsx`
- `src/lib/uploadPipeline.ts` (ajustes leves de throughput)

Critérios de aceite:
1) Erro visível por item como “Erro ao enviar” (sem “verifique sua conexão”).
2) Botão “Tentar novamente” sempre clicável nos cards com erro.
3) Ao terminar lote com erros, sistema dispara tentativas automáticas adicionais.
4) No passo 4, com erro pendente, “Próximo” não avança e exibe aviso claro.
5) Com 300+ arquivos, UI permanece responsiva e throughput melhora perceptivelmente (sem regressão de crédito/idempotência).

Risco e mitigação:
- Risco: auto-retry disparar múltiplas finalizações.
- Mitigação: controle por `retryRoundRef`, guarda de estado ativo e reset explícito no fim.
- Risco: regressão em Deliver (usa mesmo uploader).
- Mitigação: callbacks novos opcionais; comportamento default mantido para telas que não usam bloqueio de passo.
