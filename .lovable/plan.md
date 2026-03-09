

## Plano: Buscar taxas Asaas em tempo real no checkout

### Problema
As taxas são armazenadas estaticamente na configuração do fotógrafo. Se o Asaas alterar as taxas da conta, o cálculo de parcelamento ficará desatualizado e o cliente verá valores incorretos.

### Solução
Buscar as taxas diretamente da API Asaas (`GET /v3/myAccount/fees/`) **no momento do checkout**, antes de exibir as opções de parcelamento.

### Arquitetura

```text
Cliente abre checkout
  → AsaasCheckout monta (valorTotal, userId, etc.)
  → Chama Edge Function asaas-fetch-fees (userId)
  → Edge Function busca API key da integração do fotógrafo
  → Chama GET /v3/myAccount/fees/ na API Asaas
  → Retorna taxas reais (processamento por faixa + antecipação + valor fixo)
  → Frontend calcula parcelas com taxas reais
  → Exibe opções corretas ao cliente
```

### Mudanças

#### 1. Nova Edge Function: `supabase/functions/asaas-fetch-fees/index.ts`
- Recebe `userId` (fotógrafo dono da galeria)
- Busca `access_token` e `dados_extras.environment` da tabela `usuarios_integracoes`
- Chama `GET /v3/myAccount/fees/` com o token do fotógrafo
- Retorna estrutura normalizada:
```json
{
  "creditCard": {
    "operationValue": 0.49,
    "detachedMonthlyFeeValue": 1.25,
    "installmentMonthlyFeeValue": 1.70,
    "oneInstallmentPercentage": 2.99,
    "rangedInstallmentPercentages": [
      { "min": 2, "max": 6, "percentage": 3.49 },
      { "min": 7, "max": 12, "percentage": 3.99 },
      { "min": 13, "max": 21, "percentage": 4.29 }
    ]
  },
  "pix": { "fixedFeeValue": 0.99 }
}
```
- Nenhum segredo novo necessário — usa a API key já armazenada na integração do fotógrafo.

#### 2. Frontend: `src/components/AsaasCheckout.tsx`
- Ao montar o componente, chamar `asaas-fetch-fees` com `data.userId`
- Mostrar skeleton/loading nas opções de parcelamento enquanto carrega
- Quando taxas chegarem, calcular parcelas combinando:
  - **Taxa de processamento** (por faixa: à vista, 2-6x, 7-12x, 13-21x) + R$ 0.49 fixo
  - **Taxa de antecipação** (1.25%/mês à vista, 1.7%/mês parcelado) via `calcularAntecipacao()`
- Quando `absorverTaxa === true`, nenhuma taxa é adicionada ao valor do cliente
- Remover dependência dos campos estáticos `taxaAntecipacaoPercentual`, `taxaAntecipacaoCreditoAvista`, `taxaAntecipacaoCreditoParcelado` da interface `AsaasCheckoutData`

#### 3. Backend: `supabase/functions/asaas-gallery-payment/index.ts`
- No momento de criar o pagamento, também chamar `GET /v3/myAccount/fees/` para recalcular o `valorFinal` server-side
- Isso garante que mesmo se o frontend enviar valor manipulado, o backend valida com taxas reais
- Substituir o cálculo atual de antecipação (linhas ~160-175) pelo cálculo combinado

#### 4. Configurações: `src/components/settings/PaymentSettings.tsx`
- Remover campos manuais de taxa de antecipação (à vista / parcelado)
- Manter apenas o switch `absorverTaxa` (fotógrafo absorve ou cliente paga)
- Adicionar botão "Ver taxas da conta" que chama `asaas-fetch-fees` e exibe tabela read-only com as taxas atuais

#### 5. Config: `supabase/config.toml`
- Adicionar entry para nova função:
```toml
[functions.asaas-fetch-fees]
verify_jwt = false
```

### Cálculo de parcelas (exemplo R$ 100, 3x, cliente paga taxas)
```text
Faixa 2-6x: processamento = 3.49%
Valor fixo por transação = R$ 0.49
Antecipação parcelado = 1.7%/mês

Processamento: R$ 100 × 3.49% + R$ 0.49 = R$ 3.98
Antecipação: calcularAntecipacao(100, 3, 1.7) = R$ 3.40 (parcela1×1.7% + parcela2×3.4% + parcela3×5.1%)
Total: R$ 100 + R$ 3.98 + R$ 3.40 = R$ 107.38
3x de R$ 35.79
```

### Arquivos envolvidos
1. **Novo:** `supabase/functions/asaas-fetch-fees/index.ts`
2. `supabase/config.toml` — registro da nova função
3. `src/components/AsaasCheckout.tsx` — fetch de taxas + cálculo combinado
4. `supabase/functions/asaas-gallery-payment/index.ts` — validação server-side
5. `src/components/settings/PaymentSettings.tsx` — remover campos manuais, exibir taxas reais

