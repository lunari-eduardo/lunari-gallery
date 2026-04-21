

# Plano: aplicar defaults globais do Gallery em galerias vinculadas ao Gestão

## Diagnóstico

Quando uma galeria é criada **a partir de uma sessão do Gestão** (URL com `?session_id=...`), o `GalleryCreate.tsx` ignora ou aplica de forma incompleta os padrões definidos em `Configurações > Geral`. Isso quebra a expectativa do fotógrafo que configurou o padrão "Sim, COM pagamento" e vê a galeria nascer como "Sim, SEM pagamento".

### Causas reais encontradas no código

| Default | Fonte do problema |
|---|---|
| **Modo de Venda** (`defaultSaleMode`) | `useEffect` em `GalleryCreate.tsx:321` tem guard explícito `if (!hasGestaoParams && ...)`. Quando há `session_id` na URL, o default do fotógrafo **nunca** é aplicado. Se o Gestão não mandar `modelo_de_cobranca`, a galeria fica presa no `useState('sale_without_payment')` inicial. |
| **Tipo de Cobrança** (`chargeType`) | Inexistente em `GlobalSettings`. Sempre nasce hardcoded como `'only_extras'`. Não há UI nem coluna no banco. |
| **Modelo de Preços** (`pricingModel`) | Inexistente em `GlobalSettings`. Sempre nasce hardcoded como `'fixed'`. Quando vem do Gestão, é sobrescrito por `regrasCongeladas`; quando não, ignora preferência do fotógrafo. |
| **Método de Pagamento** (`paymentMethod`) | Vem só de `paymentData.defaultIntegration` (do `usePaymentIntegration`), mas isso reflete a integração ativa, não uma preferência configurável de "qual usar por padrão em novas galerias". |
| **Tamanho de Imagem** (`defaultImageResize`) | Existe e é aplicado, mas o `useEffect` roda em paralelo com o de `regrasCongeladas`, e o valor inicial do `useState(1920)` pode "vencer" se o settings carregar tarde — em telas com cache vazio o usuário vê 1920 mesmo tendo configurado 2560 como padrão. |
| **Watermark/Display/Comments/Download/Extras** | `defaultWatermarkDisplay`, `defaultAllowComments`, `defaultAllowDownload`, `defaultAllowExtraPhotos` não existem em `GlobalSettings`. Watermark global existe (`watermarkGlobalSettings`) mas os 4 toggles operacionais sempre nascem com valores hardcoded (`true`, `true`, `false`, `true`). |
| **Mensagem de Boas-vindas** | Já é aplicada corretamente via `defaultWelcomeMessage` + `welcomeMessageEnabled`. **OK**. |
| **Prazo de Seleção** | Já aplicado via `settings.defaultExpirationDays`. **OK**. |
| **Permissão (Pública/Privada)** | Já aplicado via `settings.defaultGalleryPermission`. **OK**. |

### Por que o Gestão não conserta isso sozinho

O Gestão envia apenas: `cliente_*`, `pacote_*`, `fotos_incluidas`, `preco_foto_extra`, `modelo_de_cobranca`, `modelo_de_preco`. Tudo **mais** (chargeType, watermark, image size, allowDownload, etc.) é responsabilidade do Gallery aplicar a partir das configurações do fotógrafo. Hoje o Gallery não faz isso de forma consistente.

## Solução

### Parte 1 — Expandir defaults globais (banco + tipo + UI)

Adicionar 4 colunas em `gallery_settings` e os campos correspondentes em `GlobalSettings`:

- `default_charge_type` text → `'only_extras' | 'all_selected'` (default `'only_extras'`)
- `default_pricing_model` text → `'fixed' | 'packages'` (default `'fixed'`)
- `default_payment_method` text → `'pix_manual' | 'infinitepay' | 'mercadopago' | null` (null = usar o `defaultIntegration`)
- `default_allow_comments` boolean (default `true`)
- `default_allow_download` boolean (default `false`)
- `default_allow_extra_photos` boolean (default `true`)
- `default_watermark_display` text → `'all' | 'fullscreen' | 'none'` (default `'all'`)

Atualizar:
- migração SQL com `ADD COLUMN IF NOT EXISTS`
- `src/types/gallery.ts` → novos campos opcionais em `GlobalSettings`
- `src/data/mockData.ts` → defaults
- `src/hooks/useGallerySettings.ts` → mapear leitura/escrita das novas colunas

### Parte 2 — Adicionar UI de configuração

Em `src/components/settings/GeneralSettings.tsx`, adicionar 3 cards adicionais após "Modo de Venda Padrão":

```text
[Tag] Tipo de Cobrança Padrão
  ( ) Cobrar apenas as fotos extras
  ( ) Cobrar todas as fotos selecionadas

[Package] Modelo de Preços Padrão
  ( ) Preço único
  ( ) Pacotes com desconto

[CreditCard] Método de Pagamento Padrão
  ( ) Usar integração ativa  ← seleciona automaticamente
  ( ) PIX Manual
  ( ) InfinitePay
  ( ) Mercado Pago
  ( ) Asaas
```

E em um novo arquivo / novo card em `GeneralSettings.tsx` ou adicionar a `PersonalizationSettings.tsx`:

```text
[Image] Comportamento Padrão de Galerias
  [switch] Permitir comentários
  [switch] Permitir download
  [switch] Permitir fotos extras

[Droplet] Exibição Padrão da Marca d'Água
  ( ) Em todas as fotos (proteção máxima)
  ( ) Apenas em tela cheia (preview limpo)
  ( ) Nunca (sem marca d'água)
```

### Parte 3 — Corrigir o `useEffect` de hidratação em `GalleryCreate.tsx`

Reescrever o bloco de hidratação (linhas 291-336) com **regra única**:

```text
PRIORIDADE (do mais forte para o mais fraco):
1. regrasCongeladas (Gestão)              ← só sobrescreve campos que ele controla
2. URL params (Gestão modelo_de_cobranca) ← se enviado, vence default do fotógrafo
3. settings.* (defaults do fotógrafo)     ← aplicar SEMPRE, inclusive em modo assistido
4. useState inicial hardcoded             ← apenas fallback final
```

Isso significa **remover o guard `!hasGestaoParams`** do `defaultSaleMode`. A lógica nova:

```text
quando settings carrega:
  if (!userTouchedSaleModeRef.current
      && !gestaoParams.modelo_de_cobranca       ← Gestão tem prioridade SE enviado
      && settings.defaultSaleMode) {
    setSaleMode(settings.defaultSaleMode);
  }
  // mesma lógica para chargeType, pricingModel, paymentMethod, etc.
```

Adicionar refs `userTouched...` para cada novo campo: `chargeType`, `pricingModel`, `paymentMethod`, `allowComments`, `allowDownload`, `allowExtraPhotos`, `watermarkDisplay` — cada `setX` no JSX vira `userTouchedXRef.current = true; setX(...)`.

### Parte 4 — Hidratar `paymentMethod` corretamente

Atual (linha 532-536):
```text
if (paymentData.defaultIntegration && !selectedPaymentMethod) {
  setSelectedPaymentMethod(paymentData.defaultIntegration.provedor);
}
```

Novo:
```text
if (!userTouchedPaymentMethodRef.current && !selectedPaymentMethod) {
  // 1. Preferência explícita do fotógrafo
  if (settings.defaultPaymentMethod) {
    setSelectedPaymentMethod(settings.defaultPaymentMethod);
  }
  // 2. Senão, integração ativa
  else if (paymentData?.defaultIntegration) {
    setSelectedPaymentMethod(paymentData.defaultIntegration.provedor);
  }
}
```

### Parte 5 — Garantir aplicação em modo Gestão sem param `modelo_de_cobranca`

Quando o Gestão enviar uma sessão **sem** `modelo_de_cobranca` (caso comum, pois o fotógrafo configurou no Gallery, não no Gestão), o sistema agora vai:

1. carregar `settings.defaultSaleMode = 'sale_with_payment'`
2. aplicar via `setSaleMode` porque não há valor do Gestão e usuário não tocou
3. mostrar a galeria pré-configurada no padrão do fotógrafo

Resultado: a tela do passo 2 nasce com **"Sim, COM pagamento"** marcado, exatamente como configurado em Configurações.

### Parte 6 — Não impactar `GalleryEdit.tsx`

`GalleryEdit` carrega valores **da galeria existente**, não dos defaults. Nenhuma mudança ali. O escopo é apenas criação.

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<novo>.sql` | `ADD COLUMN` para 7 novos defaults em `gallery_settings` |
| `src/types/gallery.ts` | Adicionar 7 campos opcionais em `GlobalSettings` |
| `src/data/mockData.ts` | Defaults dos 7 novos campos |
| `src/hooks/useGallerySettings.ts` | Mapear leitura (`rowsToSettings`) e escrita (`updateData`) das 7 colunas |
| `src/components/settings/GeneralSettings.tsx` | Adicionar 3 novos cards (Tipo Cobrança, Modelo Preços, Método Pagamento) |
| `src/components/settings/PersonalizationSettings.tsx` | Adicionar 2 novos cards (Comportamento Padrão de Galerias, Exibição Padrão da Marca d'Água) |
| `src/pages/GalleryCreate.tsx` | (a) remover guard `!hasGestaoParams` do `defaultSaleMode`; (b) hidratar 6 novos campos respeitando prioridade Gestão > userTouched > settings; (c) novos refs `userTouchedXRef`; (d) marcar refs nos handlers JSX |
| Nenhuma mudança em | webhooks Asaas/InfinitePay/MP, `infinitepay-create-link`, `asaas-gallery-payment`, `prepare_gallery_share`, `confirm-selection`, `GalleryEdit`, fluxo de reativação |

### Compatibilidade

- Galerias antigas: nenhuma alteração; defaults só impactam **novas** galerias.
- Sessões Gestão que enviam `modelo_de_cobranca` na URL: comportamento idêntico (Gestão vence).
- Sessões Gestão **sem** `modelo_de_cobranca`: agora respeitam o default do fotógrafo (era o bug).
- Galerias standalone (sem Gestão): respeitam todos os 7 novos defaults.

## Validação

1. configurar em `Configurações > Geral`: Modo "Sim, COM pagamento", Tipo "Cobrar todas selecionadas", Modelo "Pacotes com desconto", Pagamento "InfinitePay";
2. configurar em `Personalização`: comentários OFF, download ON, marca d'água "Apenas em tela cheia";
3. criar uma galeria **standalone** → passo 2 nasce com tudo aplicado;
4. criar uma galeria **vinculada ao Gestão** sem `modelo_de_cobranca` na URL → passo 2 nasce com "Sim, COM pagamento" e demais padrões;
5. criar uma galeria **vinculada ao Gestão** com `modelo_de_cobranca=no_sale` na URL → respeita Gestão (não vira "Sim, COM pagamento");
6. tocar manualmente em qualquer campo → next render não reverte para o default;
7. editar galeria existente → nenhum default sobrescreve valores salvos;
8. `npm run build` sem erros TS;
9. webhooks Asaas, InfinitePay e MP intactos;
10. fluxo de reativação intacto.

## Resultado esperado

- galerias **vinculadas ao Gestão** herdam os defaults do Gallery quando o Gestão não envia o campo;
- 7 novos defaults disponíveis em `Configurações`, cobrindo modo de venda, cobrança, preços, pagamento, comentários, download, extras e marca d'água;
- nenhum impacto em galerias existentes ou no fluxo de pagamentos.

