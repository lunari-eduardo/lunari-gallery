

# Fix: "Usuário não autenticado" — infinitepay-create-link quebrado pelo projeto Gestão

## Problema Confirmado (logs)

```text
💳 Calling infinitepay-create-link via fetch()...
💳 Payment response (status 400): {"success":false,"error":"Usuário não autenticado"}
🔓 Rollback: Gallery dfbffda8 status_selecao reset to selecao_iniciada
```

O projeto Gestão fez deploy de uma versão de `infinitepay-create-link` que adicionou verificação de JWT (`supabase.auth.getUser()`). Isso quebra a chamada interna de `confirm-selection`, que usa `SUPABASE_SERVICE_ROLE_KEY` — não um JWT de usuário — como Authorization Bearer.

O código **neste projeto** está correto (aceita `userId` no body, sem auth check). O problema é que o Gestão sobrescreveu a função deployada.

## Plano

### 1. Redeployar `infinitepay-create-link` (automático)

Fazer um "touch" na Edge Function para forçar o redeploy da versão correta deste projeto, que:
- Aceita `userId` no body (sem JWT)
- Usa `verify_jwt = false` no config.toml
- Valida apenas `valor` e `userId` como campos obrigatórios

Basta adicionar um comentário de versão no topo do arquivo para triggerar o redeploy automático do Lovable.

### 2. Adicionar header de contrato nos 3 arquivos de payment

Adicionar um bloco de documentação no topo de cada Edge Function compartilhada (`infinitepay-create-link`, `asaas-gallery-payment`, `mercadopago-create-link`) que define o contrato imutável:

```typescript
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONTRATO COMPARTILHADO — NÃO MODIFICAR SEM COORDENAÇÃO    ║
 * ║                                                              ║
 * ║  Esta função é chamada internamente por confirm-selection    ║
 * ║  usando SUPABASE_SERVICE_ROLE_KEY (não JWT de usuário).      ║
 * ║                                                              ║
 * ║  REGRAS IMUTÁVEIS:                                           ║
 * ║  1. NÃO adicionar verificação de JWT (auth.getUser)          ║
 * ║  2. userId DEVE ser aceito no body da request                ║
 * ║  3. verify_jwt DEVE ser false no config.toml                 ║
 * ║  4. Autenticação do fotógrafo é via userId no body           ║
 * ║                                                              ║
 * ║  Projetos: Gallery (Select) + Gestão                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
```

### 3. Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/infinitepay-create-link/index.ts` | Adicionar header de contrato + version bump para forçar redeploy |
| `supabase/functions/asaas-gallery-payment/index.ts` | Adicionar header de contrato |
| `supabase/functions/mercadopago-create-link/index.ts` | Adicionar header de contrato |

Isso resolve o erro imediatamente (redeploy) e previne que o Gestão quebre o fluxo novamente (contrato documentado no código).

