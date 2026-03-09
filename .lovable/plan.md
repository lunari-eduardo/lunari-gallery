
Objetivo: corrigir o bug de persistência do toggle de repasse/absorção no Asaas e eliminar a falsa confirmação de salvamento.

1) Diagnóstico confirmado
- `src/pages/Settings.tsx` tem botão fixo “Salvar Configurações” que só dispara `toast.success(...)` e não salva nada.
- Em `src/components/settings/PaymentSettings.tsx`, o toggle `asaasAbsorverTaxa` só persiste quando o usuário clica no botão interno “Salvar Configurações” da seção Asaas.
- Resultado: usuário muda o toggle, clica no botão global (toast de sucesso), recarrega, e o valor volta ao estado anterior no banco.

2) Correção de UX e fluxo de salvamento
- Em `src/pages/Settings.tsx`:
  - Tornar abas controladas por estado (`activeTab`).
  - Ocultar/desabilitar o botão global quando `activeTab === "payment"`.
  - Ajustar mensagem para deixar claro que pagamentos são salvos dentro de cada integração.
- Em `src/components/settings/PaymentSettings.tsx`:
  - Tornar explícito o estado de alteração pendente no Asaas (ex.: “Alterações não salvas”).
  - Renomear botão interno para algo específico: “Salvar configurações do Asaas”.
  - Opcional recomendado: auto-save do toggle de `absorverTaxa` no `onCheckedChange` (com lock de loading e toast de erro/sucesso), para evitar depender de clique extra.

3) Persistência e robustez
- Em `src/hooks/usePaymentIntegration.ts`:
  - Reutilizar `updateAsaasSettings` para persistência do toggle em tempo real (se auto-save for aplicado).
  - Garantir tratamento de erro no update (já existe) e feedback claro quando falhar.
  - Manter invalidação de cache (`payment-integration`) após sucesso.

4) Validação funcional (fim a fim)
- Cenário A: Asaas conectado, abrir “Configurar”, trocar para “Cliente paga juros”, salvar (ou auto-save), recarregar página, confirmar persistência.
- Cenário B: trocar para “Eu absorvo a taxa”, recarregar e validar persistência.
- Cenário C: confirmar no checkout que `absorverTaxa=false` exibe parcelas com acréscimo e `absorverTaxa=true` exibe valor limpo.
- Cenário D: validar que botão global da página não induz sucesso falso na aba “Pagamentos”.

5) Impacto esperado
- Remove confusão de UX.
- Elimina falso positivo de “configurações salvas”.
- Garante que a configuração do toggle sobreviva ao reload e reflita corretamente no checkout.
- Sem alterações em edge functions de InfinitePay (`infinitepay-create-link` e `infinitepay-webhook`), preservando automações atuais.
