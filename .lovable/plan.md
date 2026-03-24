

# Configurações de Pagamento Independentes por Projeto (Gallery ↔ Gestão)

## O que será feito

Permitir que Gallery e Gestão tenham configurações de pagamento diferentes (parcelas, taxas, antecipação) para o mesmo provedor, com opção de migrar configurações entre projetos a qualquer momento.

## Estrutura

Os dados continuam na mesma coluna `dados_extras` da tabela `usuarios_integracoes`, com sub-objetos `gallery_settings` e `gestao_settings` para isolar configurações por projeto. Campos raiz mantidos como fallback para webhooks.

## Arquivos a criar/editar

### 1. Criar `src/utils/paymentSettingsContext.ts` (novo)

Copiar exatamente o arquivo do projeto Gestão. Contém:
- `getContextSettings()` — lê settings do contexto com fallback para raiz
- `setContextSettings()` — grava no contexto + sincroniza raiz
- `migrateSettings()` — copia de um projeto para outro
- `hasOtherContextSettings()` — verifica se outro projeto tem settings
- `settingsDiverge()` — detecta diferenças entre projetos
- `getDivergenceSummary()` — lista campos que diferem

### 2. Editar `src/hooks/usePaymentIntegration.ts`

- Definir `const CONTEXT = 'gallery'`
- Adicionar `dadosExtrasRaw` ao tipo `PaymentIntegration`
- **Leitura**: usar `getContextSettings()` no mapeamento para resolver settings do contexto Gallery
- **Escrita (saveAsaas, updateAsaasSettings, updateMercadoPagoSettings)**: usar `setContextSettings()` em vez de gravar direto
- **Nova mutation `migrateFromGestao`**: chama `migrateSettings('gestao', 'gallery', provider)` e salva

### 3. Editar `src/components/settings/PaymentConfigDrawer.tsx`

- Receber `dadosExtrasRaw` do Asaas e MP via props
- Receber handler `onMigrateFromGestao`
- Exibir seção de migração no drawer do Asaas e Mercado Pago:
  - Só aparece se `hasOtherContextSettings(raw, 'gestao')` for true
  - Mostra diferenças via `getDivergenceSummary()`
  - Botão "Copiar configurações do Studio" que executa a migração

### 4. Editar `src/components/settings/PaymentSettings.tsx`

- Passar `dadosExtrasRaw` e handler de migração para o drawer
- Badge "Config. independente" na lista de integrações ativas quando `settingsDiverge()` retornar true

## Sem mudanças necessárias em

- Schema do banco
- Edge Functions / Webhooks (continuam lendo campos raiz)
- Fluxo de checkout

