
Objetivo: corrigir definitivamente o fluxo de upload na edição de galeria (sem reload aparente e sem sumir foto), cobrindo frontend + ciclo de sessão + permissões.

Diagnóstico consolidado (com evidências):
1) O upload não chega no backend
- Edge logs de `r2-upload`: sem execuções no momento da falha.
- Tabela `galeria_fotos` da galeria testada não recebe novos registros após a tentativa.
- Conclusão: quebra ocorre antes da chamada da function.

2) O que acontece ao clicar “Abrir”
- Session replay mostra:
  - `input[type=file]` recebe `C:\fakepath\...jpg`;
  - logo após, a tela entra em `Carregando galeria...`;
  - depois ocorre navegação/reload da mesma URL.
- Isso confirma perda de estado de tela durante o início do upload.

3) Causa raiz mais provável (fluxo atual)
- `PhotoUploader.addFiles()` chama `supabase.auth.refreshSession()` antes de iniciar o pipeline.
- Durante esse refresh, hooks de auth/clientes reexecutam e `GalleryEdit` cai no loading global (`isSupabaseLoading || isClientsLoading`), desmontando o uploader no momento crítico.
- Como o uploader desmonta, o pipeline não chega a disparar envio real.

4) Permissões/RLS
- Policies de `galeria_fotos` e `galeria_pastas` estão coerentes para owner (`auth.uid() = user_id`).
- Não há sinal de bloqueio por RLS no caso reportado (não há tentativa de insert chegando ao banco).

Plano de correção (implementação):
1) Remover o gatilho de instabilidade no início do upload
- Arquivo: `src/components/PhotoUploader.tsx`
- Remover `await supabase.auth.refreshSession()` do `addFiles`.
- O pipeline já busca sessão no momento necessário; evitar refresh forçado antes do enqueue.

2) Impedir desmontagem do uploader por loading transitório
- Arquivo: `src/pages/GalleryEdit.tsx`
- Ajustar gate de loading para não bloquear a página inteira em refetch:
  - carregar tela cheia apenas quando não há dados iniciais ainda;
  - em refetch, manter conteúdo renderizado.
- Exemplo de regra:
  - `isInitialLoading = (isSupabaseLoading && !gallery) || (isClientsLoading && clients.length === 0)`

3) Estabilizar hook de clientes para não “piscar loading” a cada refresh de sessão
- Arquivo: `src/hooks/useGalleryClients.ts`
- Trocar dependência de `user` por `user?.id` (evita refetch por mudança de referência do objeto user).
- Não forçar `setIsLoading(true)` quando já há lista carregada (usar loading inicial vs refetch silencioso).
- Opcional recomendado: migrar para `useAuthContext` (evitar listeners duplicados de auth).

4) Hardening de UX e diagnóstico (curto prazo)
- Manter logs temporários no `PhotoUploader`:
  - arquivos recebidos/validados;
  - início efetivo do `pipeline.add`.
- Mostrar toast explícito se `addFiles` falhar por exceção inesperada.

5) Revisão final do fluxo de permissões
- Confirmar que `folderId` enviado pertence à `galleryId` e ao usuário (já validado no backend).
- Confirmar que nenhum fallback de pasta nula está escondendo foto em outra aba/pasta.

Validação pós-correção (obrigatória):
1) Editar galeria existente com pasta selecionada:
- selecionar JPG → deve aparecer item na fila imediatamente;
- deve ocorrer request para `functions/v1/r2-upload`;
- deve criar linha em `galeria_fotos` com `pasta_id` correto.

2) Repetir envio em sequência (2-3 vezes):
- não pode entrar em “Carregando galeria...” de forma bloqueante;
- uploader não pode desmontar.

3) Criar nova pasta e enviar nela:
- novas fotos devem entrar diretamente na pasta nova.

4) Verificação de regressão:
- exclusão de fotos continua funcionando;
- créditos e contagem total continuam corretos.

Resultado esperado:
- clicar “Abrir” não dispara reset/reload do fluxo;
- upload inicia imediatamente e persiste;
- fotos reaparecem na pasta correta após envio.
