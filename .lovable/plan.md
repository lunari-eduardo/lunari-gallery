
Objetivo: eliminar o 400 no checkout cartão (Select) com diagnóstico determinístico, correção robusta e checklist de paridade com o projeto Gestão.

1) Diagnóstico já confirmado (baseado nos logs)
- O fluxo atual está: `asaas-create-customer (200)` → `asaas-create-payment (400)`.
- O erro visível no front é genérico porque `supabase.functions.invoke()` está propagando só `"Edge Function returned a non-2xx status code"`.
- O usuário já tem `photographer_accounts.asaas_customer_id` salvo, então o create-customer pode estar apenas retornando ID existente.
- No projeto atual, o caso com erro é `productType: "select"`; no Gestão, o fluxo “funcionando” é majoritariamente `subscription_yearly` (não é o mesmo ramo).

2) Plano de correção (implementação)
- Front (`src/hooks/useAsaasSubscription.ts`)
  - Criar parser de erro para `FunctionsHttpError`, lendo o body JSON (`error.context`) e retornando `data.error` real da edge function.
  - Aplicar parser em `createCustomer`, `createPayment`, `createSubscription`, `upgrade`.
- Front (`src/pages/CreditsPayment.tsx`)
  - Manter UI atual, mas exibir mensagem real de erro do backend (não só mensagem genérica).
  - Adicionar validação matemática de CPF/CNPJ (não só length), bloqueando envio inválido antes da edge.
- Edge (`supabase/functions/asaas-create-payment/index.ts`)
  - Adicionar logs estruturados em etapas: entrada validada, presença de customer, payload sanitizado (sem dados sensíveis), resposta Asaas.
  - Incluir `requestId` na resposta de erro para rastreio.
  - Auto-healing para migração de ambiente: se Asaas retornar erro compatível com “customer inexistente/invalid customer”, limpar `asaas_customer_id`, recriar cliente com `creditCardHolderInfo`, e tentar pagamento 1x novamente.
- Edge (`supabase/functions/asaas-create-customer/index.ts`)
  - Quando já existir `asaas_customer_id`, validar opcionalmente em sandbox (ou no mínimo permitir `forceRecreate` quando checkout detectar mismatch).
- Observabilidade
  - Garantir que todos os `400` retornem `{ error, code?, requestId }` para depuração rápida.
  - Manter `console.error` com payload de erro Asaas sanitizado.

3) O que analisar no projeto Gestão (checklist objetivo)
- Confirmar se o “funciona” foi em `subscription_yearly`; se sim, não compara 1:1 com Select.
- Comparar secrets:
  - `ASAAS_ENV` igual (`sandbox`) nos dois projetos.
  - Chave API pertencente ao mesmo ambiente.
- Verificar se os `asaas_customer_id` do Gestão foram criados já no sandbox (sem legado de produção).
- Comparar tratamento de erro no hook:
  - Se lá já mostra erro real de edge, portar para cá.
- Comparar logs de edge:
  - Presença de logs detalhados de resposta Asaas no Gestão; replicar padrão.

4) Critério de aceite da correção
- Ao falhar pagamento, UI mostra motivo real (ex.: CPF inválido, cartão recusado, customer inválido), nunca mensagem genérica.
- Em caso de customer legado inválido, fluxo se autorrepara sem intervenção manual (recria customer e reprocessa 1 tentativa).
- Checkout Select (cartão) conclui com sucesso com dados válidos em sandbox.
- Logs permitem identificar causa em <2 minutos (por `requestId` + mensagem Asaas).

5) Sequência de validação após implementar
- Teste A: CPF/CNPJ inválido → bloqueio no front com mensagem clara.
- Teste B: CPF válido + cartão de teste sandbox válido → pagamento aprovado.
- Teste C: Forçar customer inválido em banco → fluxo recria customer e segue.
- Teste D: Erro intencional no Asaas → front exibe erro retornado da edge.
- Teste E (paridade): repetir no Gestão para confirmar mesmo padrão de erro/observabilidade.

Seção técnica (resumo)
- Arquivos-alvo:
  - `src/hooks/useAsaasSubscription.ts`
  - `src/pages/CreditsPayment.tsx`
  - `supabase/functions/asaas-create-payment/index.ts`
  - `supabase/functions/asaas-create-customer/index.ts`
- Hipótese principal de causa:
  - erro real do Asaas mascarado no front + possível `asaas_customer_id` legado de ambiente diferente após padronização para sandbox.
- Evidência forte:
  - analytics mostra `create-customer 200` seguido de `create-payment 400` no mesmo fluxo.
