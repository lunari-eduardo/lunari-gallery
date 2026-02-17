
# Correção: `infinitepay-create-link` com deploy desatualizado

## Causa raiz

Os logs mostram claramente o erro:

```
[infinitepay-create-link] Error: Usuário não autenticado (line 28)
```

A versão **deployada** da edge function `infinitepay-create-link` contém validação de autenticação de usuário que **não existe no código atual do repositório**. Isso significa que a função está rodando uma versão antiga que exige JWT/auth, mas quando `confirm-selection` a invoca via `supabase.functions.invoke()`, não envia token de usuário (usa service role internamente).

O código no repositório está correto -- ele aceita `userId` no body e busca o handle diretamente. O problema é que a função nunca foi re-deployada após a última atualização.

## Correção

**Redeployar** a edge function `infinitepay-create-link` a partir do código atual do repositório. Nenhuma mudança de código é necessária.

## Outros modos afetados

| Provedor | Afetado? | Motivo |
|---|---|---|
| InfinitePay | Sim | Deploy desatualizado com auth antiga |
| Mercado Pago | Não | Código já está correto e sem auth bloqueante |
| PIX Manual | Não | Não invoca edge function externa |

## Como prevenir no futuro

O problema ocorreu porque as edge functions foram editadas no código mas não foram re-deployadas. Para prevenir:

1. **Sempre redeployar** edge functions após qualquer alteração no código
2. **Testar após deploy** chamando a função com curl/invoke para validar
3. **Monitorar logs** após mudanças para detectar erros de versão desatualizada

## Ação

| Passo | Descrição |
|---|---|
| 1 | Redeployar `infinitepay-create-link` |
| 2 | Testar o fluxo de pagamento InfinitePay novamente |
