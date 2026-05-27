## Diagnóstico definitivo

No teste mobile (PWA tablet/smartphone e navegador mobile), **pacote e categoria preenchem corretamente, mas o cliente fica vazio**. Investigando o fluxo:

- **Pacote / categoria / preço** vêm de `regrasCongeladas`, que é buscado **no banco** via `session_id` na função `fetchSessionData` (`GalleryCreate.tsx` linhas 466–514). Por isso funciona em qualquer dispositivo — não depende da URL.
- **Cliente**, hoje, depende exclusivamente dos query params `cliente_id` / `cliente_nome` / `cliente_email` / `cliente_telefone` que o Studio adiciona à URL com `window.open(..., '_blank')`.

Em mobile, o `window.open` do Studio (especialmente saindo de um PWA instalado) frequentemente:
1. abre em outro app/contexto (Safari/Chrome fora da PWA do Gallery),
2. perde/trunca parte da query string em URLs longas,
3. ou cai no fluxo `/auth?redirect=...` onde a URL é re-encodada — e qualquer falha silenciosa de decode descarta os params do cliente.

O `session_id` sobrevive porque está no início; os `cliente_*` ficam mais ao final e são os primeiros a se perderem.

Confirmação no banco: a tabela `clientes_sessoes` já contém a coluna **`cliente_id`** (chave para `clientes`). Ou seja, **o cliente da sessão é resolvível 100% server-side a partir do `session_id`**, sem depender da URL.

## Plano de correção

Mudar a estratégia de resolução de cliente para "session-first, URL como fallback":

### 1. Estender `fetchSessionData` em `GalleryCreate.tsx`
Adicionar `cliente_id` ao `select` da query em `clientes_sessoes`. Guardar em um novo estado `sessionClienteId`.

### 2. Nova fonte primária de cliente: o `session_id`
Reescrever o `resolveClient` da Stage B para tentar nesta ordem:

1. **`sessionClienteId`** (server-side, do `clientes_sessoes`) → cache → `fetchClientById`.
2. **`gestaoParams.cliente_id`** (URL) → cache → `fetchClientById`.
3. **Auto-criar** a partir de `cliente_nome` + `cliente_email`/`telefone` da URL (mantém comportamento atual).
4. Se ainda assim falhar, abrir automaticamente o `ClientSelect` e mostrar toast claro: "Selecione o cliente da sessão para continuar".

### 3. Aguardar `regrasLoaded` antes de marcar como processado
Hoje `markAsProcessed()` roda imediatamente após disparar `resolveClient()` (sem await). Vamos:
- aguardar `regrasLoaded === true` (para ter `sessionClienteId`),
- **aguardar** o `resolveClient()` (await) antes de `markAsProcessed` + `clearParams`.
- Em caso de falha não-recuperável, NÃO marcar como processado se ainda houver tentativas pendentes (ex: clients ainda carregando após retry).

### 4. Blindagens adicionais

- **Não bloquear pelo plano** para resolver cliente: a Stage B não precisa de `hasGestaoIntegration` (a integração governa o que mostrar, não a hidratação). Mover a checagem só para Stage A (campos de pacote que dependem do Studio).
- **Logs estruturados** com prefixo `[AssistedMode]` para cada etapa (session resolvido / cache hit / DB hit / auto-create / fallback). Facilita diagnóstico remoto via console do dispositivo.
- **Toast de erro acionável**: quando nenhuma fonte resolver, mostrar `toast.error('Não foi possível identificar o cliente da sessão. Selecione manualmente.')` e abrir o popover de seleção.
- **Telemetria leve**: contador em `console.warn` quando a URL chega sem `cliente_id` mas o session tem — sinal de degradação no `window.open` do Studio.

### 5. Nada muda no Studio nem em edge functions

Conforme regra do projeto, **nenhuma alteração no projeto Studio nem em edge functions de pagamento**. A correção é 100% no Gallery, lendo dados que já existem no banco compartilhado.

## Arquivos afetados

- `src/pages/GalleryCreate.tsx` — extender query, novo estado `sessionClienteId`, reescrever Stage B, reordenar gate de `isAssistedMode`.
- (Opcional) `src/hooks/useGestaoParams.ts` — sem mudança estrutural; apenas adicionar comentário sobre nova fonte primária.

## Por que isso resolve definitivamente

| Cenário | Antes | Depois |
|---|---|---|
| Desktop PWA/Browser (URL completa) | ✅ via URL | ✅ via session (mais rápido, sem DB extra se em cache) |
| Mobile PWA, URL trunca cliente_* | ❌ vazio | ✅ resolvido via `clientes_sessoes.cliente_id` |
| Mobile Browser, redirect via /auth | ❌ params perdidos | ✅ session_id basta |
| `cliente_id` órfão (cliente apagado) | toast genérico | toast acionável + popover aberto |
| `cliente_nome` ausente | falha silenciosa | fallback claro com seleção manual |

Como a resolução agora é server-side, o sistema fica imune a qualquer regressão futura no encoding de URL, tamanho de querystring, ou comportamento de `window.open` em PWAs.
