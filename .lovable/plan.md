
# Plano: Mercado Pago OAuth para Fotógrafos (Contas Conectadas)

## Resumo Executivo

Implementar o Mercado Pago como gateway de pagamento para fotógrafos receberem pagamentos de fotos extras **diretamente em suas contas**, sem que o Lunari receba ou custodie dinheiro.

**Regra de Negócio Obrigatória:**
- Lunari **não recebe** dinheiro
- Pagamentos vão **direto para a conta do fotógrafo**
- Lunari atua apenas como **intermediador técnico**

---

## Arquitetura Atual vs. Proposta

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA ATUAL (Créditos)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Fotógrafo compra créditos → Mercado Pago (conta do Lunari) → Lunari        │
│                                                                             │
│  • Token global MERCADOPAGO_ACCESS_TOKEN                                    │
│  • Dinheiro vai para conta do Lunari                                        │
│  • Usado para: compra de créditos de foto                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      ARQUITETURA PROPOSTA (Fotos Extras)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Cliente paga fotos → Mercado Pago (conta do FOTÓGRAFO) → Fotógrafo         │
│                                                                             │
│  • Token OAuth por fotógrafo (usuarios_integracoes.access_token)            │
│  • Dinheiro vai DIRETO para conta do fotógrafo                              │
│  • Usado para: venda de fotos extras em galerias                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo Completo

### 1. Fotógrafo Conecta Conta (OAuth)

```text
┌────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌────────────┐
│ Fotógrafo  │───▶│ Botão "Conectar │───▶│ auth.mercadopago│───▶│ Autoriza   │
│ em         │    │ Mercado Pago"   │    │ .com.br         │    │ Permissões │
│ Settings   │    └──────────────────┘    └─────────────────┘    └────────────┘
└────────────┘                                                         │
                                                                       ▼
┌────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌────────────┐
│ Salva em   │◀───│ Edge Function   │◀───│ Redirect com    │◀───│ Mercado    │
│ usuarios_  │    │ troca code por  │    │ ?code=ABC123    │    │ Pago       │
│ integracoes│    │ access_token    │    └─────────────────┘    └────────────┘
└────────────┘    └──────────────────┘
```

### 2. Cliente Paga Fotos Extras

```text
┌────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌────────────┐
│ Cliente    │───▶│ Confirma        │───▶│ Edge Function   │───▶│ Cria       │
│ seleciona  │    │ seleção com     │    │ mercadopago-    │    │ pagamento  │
│ fotos      │    │ pagamento       │    │ create-link     │    │ na conta   │
└────────────┘    └──────────────────┘    └─────────────────┘    │ do         │
                                                                 │ FOTÓGRAFO  │
                                                                 └────────────┘
                                                                       │
                                                                       ▼
┌────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌────────────┐
│ Galeria    │◀───│ Edge Function   │◀───│ Webhook MP      │◀───│ Cliente    │
│ liberada   │    │ atualiza status │    │ payment.updated │    │ paga       │
└────────────┘    └──────────────────┘    └─────────────────┘    └────────────┘
```

---

## Banco de Dados

### Tabela `usuarios_integracoes` (já existe)

Os campos necessários já existem na tabela:

| Coluna | Tipo | Uso |
|--------|------|-----|
| `access_token` | text | Token OAuth do fotógrafo |
| `refresh_token` | text | Para renovar o token |
| `mp_user_id` | text | ID do usuário no Mercado Pago |
| `mp_public_key` | text | Chave pública para frontend |
| `expira_em` | timestamptz | Data de expiração do token |
| `dados_extras` | jsonb | Configurações extras (métodos, parcelamento) |

**Estrutura `dados_extras` para Mercado Pago:**
```json
{
  "habilitarPix": true,
  "habilitarCartao": true,
  "maxParcelas": 12,
  "absorverTaxa": false
}
```

---

## Edge Functions

### Novas Funções

| Função | Responsabilidade |
|--------|------------------|
| `mercadopago-oauth` | Troca `code` por `access_token` e salva credenciais |
| `mercadopago-create-link` | Cria pagamento usando token do fotógrafo |
| `mercadopago-refresh-token` | Renova tokens antes de expirar |

### Funções Existentes a Modificar

| Função | Modificação |
|--------|-------------|
| `mercadopago-webhook` | Processar pagamentos de galerias (não só créditos) |
| `confirm-selection` | Já chama `mercadopago-create-link` (OK) |

---

## Secrets Necessários

| Secret | Descrição | Status |
|--------|-----------|--------|
| `MERCADOPAGO_APP_ID` | ID da aplicação OAuth | **Adicionar** |
| `MERCADOPAGO_APP_SECRET` | Secret da aplicação OAuth | **Adicionar** |
| `MERCADOPAGO_ACCESS_TOKEN` | Token global (créditos) | Existe |
| `MERCADOPAGO_PUBLIC_KEY` | Chave pública global | Existe |

---

## Implementação Detalhada

### 1. Edge Function: `mercadopago-oauth`

```typescript
// Recebe code do redirect OAuth
// Troca por access_token, refresh_token, public_key, user_id
// Salva em usuarios_integracoes

POST /functions/v1/mercadopago-oauth
Body: { code: string, redirect_uri: string }

// Chamada à API Mercado Pago
POST https://api.mercadopago.com/oauth/token
{
  "client_id": APP_ID,
  "client_secret": APP_SECRET,
  "grant_type": "authorization_code",
  "code": code,
  "redirect_uri": redirect_uri
}

// Resposta salva em usuarios_integracoes
{
  access_token: "APP_USR-xxx",
  refresh_token: "TG-xxx",
  public_key: "APP_USR-xxx",
  user_id: 123456789
}
```

### 2. Edge Function: `mercadopago-create-link`

```typescript
// DIFERENÇA CRÍTICA do mercadopago-credits-payment:
// Usa o access_token do FOTÓGRAFO, não o global

// 1. Buscar access_token do fotógrafo
const { data: integracao } = await supabase
  .from('usuarios_integracoes')
  .select('access_token, dados_extras')
  .eq('user_id', photographerId)
  .eq('provedor', 'mercadopago')
  .eq('status', 'ativo')
  .single();

// 2. Criar pagamento com token do fotógrafo
fetch('https://api.mercadopago.com/v1/payments', {
  headers: {
    'Authorization': `Bearer ${integracao.access_token}`, // TOKEN DO FOTÓGRAFO
  },
  body: JSON.stringify({
    transaction_amount: valorTotal,
    description: descricao,
    payment_method_id: 'pix', // ou cartão
    payer: { email: clienteEmail },
    external_reference: cobrancaId, // Para webhook
  })
});

// 3. Retornar link de checkout
```

### 3. Edge Function: `mercadopago-refresh-token`

```typescript
// Renovar tokens antes de expirar (180 dias)
// Pode ser chamada por cron job ou antes de cada uso

POST https://api.mercadopago.com/oauth/token
{
  "client_id": APP_ID,
  "client_secret": APP_SECRET,
  "grant_type": "refresh_token",
  "refresh_token": stored_refresh_token
}
```

### 4. Modificar: `mercadopago-webhook`

```typescript
// Já existe, mas precisa:
// 1. Identificar se é pagamento de créditos ou fotos extras
// 2. Para fotos extras: atualizar cobrancas + galerias

// Identificação pelo external_reference:
// - UUID válido em credit_purchases = compra de créditos
// - UUID válido em cobrancas = pagamento de fotos extras
```

---

## UI: Configurações de Pagamento

### Componente: `PaymentSettings.tsx`

Adicionar seção Mercado Pago:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  💳 Mercado Pago                                                            │
│  Receba pagamentos com PIX e Cartão de Crédito                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ✅ Confirmação automática                                            │  │
│  │  O sistema libera a galeria automaticamente após o pagamento.         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [🔗 Conectar Mercado Pago]                                                 │
│                                                                             │
│  Ao conectar, você autoriza o Lunari a criar cobranças em seu nome.         │
│  O dinheiro vai diretamente para sua conta Mercado Pago.                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Após conectar:**

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  💳 Mercado Pago                                                            │
│  Conta conectada                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────┐  @usuario_mp                                                      │
│  │  MP  │  Conectado em 29/01/2026                                          │
│  └──────┘                                                       [Editar]    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Métodos de Pagamento                                                       │
│  ┌─────────────────┐ ┌─────────────────┐                                    │
│  │ [✓] PIX         │ │ [✓] Cartão      │                                    │
│  │ Instantâneo     │ │ Até 12x         │                                    │
│  └─────────────────┘ └─────────────────┘                                    │
│                                                                             │
│  Parcelamento                                                               │
│  [▼ Até 12x  ]   [✓] Cliente paga juros                                     │
│                  [ ] Eu absorvo a taxa                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/mercadopago-oauth/index.ts` | **Criar** | Troca code por tokens OAuth |
| `supabase/functions/mercadopago-create-link/index.ts` | **Criar** | Cria pagamento com token do fotógrafo |
| `supabase/functions/mercadopago-refresh-token/index.ts` | **Criar** | Renova tokens expirados |
| `supabase/functions/mercadopago-webhook/index.ts` | Modificar | Processar pagamentos de galerias |
| `supabase/config.toml` | Modificar | Adicionar novas funções |
| `src/hooks/usePaymentIntegration.ts` | Modificar | Adicionar saveMercadoPago e interface |
| `src/components/settings/PaymentSettings.tsx` | Modificar | UI de conexão OAuth e configurações |

---

## Fluxo OAuth no Frontend

```typescript
// 1. Usuário clica "Conectar Mercado Pago"
const handleConnectMercadoPago = () => {
  const appId = 'YOUR_APP_ID';
  const redirectUri = `${window.location.origin}/settings?mp_callback=true`;
  
  // Redireciona para Mercado Pago
  window.location.href = `https://auth.mercadopago.com.br/authorization?` +
    `client_id=${appId}&` +
    `response_type=code&` +
    `platform_id=mp&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}`;
};

// 2. Após autorização, MP redireciona com ?code=ABC123
// 3. Settings.tsx detecta mp_callback=true e chama Edge Function
useEffect(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('mp_callback') && params.get('code')) {
    handleOAuthCallback(params.get('code')!);
  }
}, []);

// 4. Edge Function troca code por tokens e salva
const handleOAuthCallback = async (code: string) => {
  const response = await fetch('/functions/v1/mercadopago-oauth', {
    method: 'POST',
    body: JSON.stringify({ code, redirect_uri: window.location.origin + '/settings' })
  });
  // Atualizar UI
};
```

---

## Considerações de Segurança

1. **Tokens criptografados**: O `access_token` do fotógrafo é sensível e deve ser armazenado de forma segura (já está na coluna com RLS)

2. **Refresh automático**: Tokens expiram em ~180 dias. Implementar renovação proativa

3. **Webhook único**: O webhook do Lunari recebe notificações de TODAS as contas conectadas

4. **Sem custódia**: Lunari nunca toca no dinheiro - vai direto do cliente para o fotógrafo

---

## Ordem de Implementação

1. **Adicionar Secrets** - `MERCADOPAGO_APP_ID` e `MERCADOPAGO_APP_SECRET`
2. **Edge Function OAuth** - `mercadopago-oauth` para troca de tokens
3. **Edge Function Create Link** - `mercadopago-create-link` para pagamentos
4. **Modificar Webhook** - Processar pagamentos de galerias
5. **Hook usePaymentIntegration** - Adicionar funções para Mercado Pago
6. **UI PaymentSettings** - Botão conectar + configurações

---

## Próximos Passos (Fora do Escopo)

- Job para renovar tokens antes de expirar
- Dashboard de transações do fotógrafo
- Suporte a parcelamento configurável
- Comissões futuras (application_fee) se necessário
