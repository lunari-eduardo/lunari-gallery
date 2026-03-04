

## Plano: Correção de Vulnerabilidades de Segurança

### Análise dos 4 Findings

**1. `profiles` — Falso positivo (risco baixo)**
As policies existentes são RESTRICTIVE e exigem `auth.uid() = user_id` para SELECT/INSERT/UPDATE, mais admin para SELECT all. Usuários anônimos NÃO conseguem ler a tabela. O scanner alertou sobre a ausência de uma policy explícita de deny para `anon`, mas como todas as policies são RESTRICTIVE e exigem `auth.uid()`, o acesso anônimo já é bloqueado implicitamente. Nenhuma ação necessária — marcar como ignorado.

**2. `clientes_transacoes` — Falso positivo (risco baixo)**
A policy `auth.uid() = user_id` para ALL já isola transações por fotógrafo. Dados financeiros são do próprio usuário, não de terceiros. Nenhuma ação necessária — marcar como ignorado.

**3. `galerias` — Risco real, mas intencional (risco médio)**
A policy `Public access via token for clients` permite SELECT anônimo quando `public_token IS NOT NULL`. Isso é necessário para o fluxo de cliente acessar a galeria sem login. Porém, expõe campos como `nome_cliente`, `email_cliente`, `telefone_cliente`, `preco_por_foto`.

**Solução**: Criar uma VIEW `galerias_public` que expõe APENAS os campos necessários para o cliente (id, nome_sessao, public_token, status, tipo, configurações visuais). Alterar a policy pública para usar a view. Campos PII e pricing ficam ocultos para acesso anônimo.

**Problema**: Alterar a policy de SELECT pública na tabela `galerias` quebraria o fluxo existente do cliente (Edge Functions `gallery-access` e `client-selection` usam service role, não são afetadas). O acesso anônimo via SDK no frontend para carregar a galeria do cliente SIM seria afetado. Preciso verificar exatamente quais campos o `ClientGallery.tsx` precisa do acesso anônimo.

**Decisão recomendada**: Restringir os campos visíveis na policy pública usando uma view com `security_invoker=on`, mantendo apenas os campos necessários para renderização do cliente (sem PII financeiro). Campos como `email_cliente`, `telefone_cliente`, `preco_por_foto` seriam excluídos da view pública.

**4. `system_cache` — Risco CRÍTICO**
A policy `Service role can manage cache` tem `USING (true)` para ALL. Isso significa que QUALQUER usuário autenticado pode ler as credenciais B2 (accountId, authorization token). Um atacante logado pode listar/deletar todos os arquivos do storage.

**Solução**: Remover a policy atual e criar uma que bloqueie todo acesso exceto service role. Como o service role bypassa RLS por padrão, a policy correta é simplesmente `USING (false)` para todos — as Edge Functions usam service role e não são afetadas.

### Plano de Implementação

**Migração SQL única:**

1. **system_cache**: Dropar policy `Service role can manage cache` e criar nova com `USING (false)` — bloqueia acesso de qualquer role exceto service role (que bypassa RLS).

2. **galerias**: Criar VIEW `galerias_public` com apenas os campos necessários para o cliente. Dropar policy `Public access via token for clients` da tabela base. Criar policy equivalente na view (ou manter acesso via Edge Functions que já usam service role).

3. **Marcar findings resolvidos/ignorados** via manage_security_finding.

### Arquivos-alvo

- Nova migração SQL (system_cache + galerias view)
- Possível ajuste em `src/pages/ClientGallery.tsx` se usar acesso anônimo direto à tabela `galerias`

### Risco

- **system_cache**: Zero risco de regressão — Edge Functions usam service role.
- **galerias view**: Preciso verificar se o frontend faz query anônima direta à tabela `galerias` ou se tudo passa pela Edge Function `gallery-access`. Se passar pela EF, a view não é necessária e basta restringir a policy.
