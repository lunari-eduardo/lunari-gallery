

# Redesign: PaymentSettings → Central de Recebimento

## Visao Geral

Transformar a tela de 4 cards pesados e redundantes em uma interface limpa com 2 blocos + drawer lateral para configuração.

## Estrutura Nova

```text
Pagamentos
─────────────────────────────────────────

Recebimento ativo
  ✔ Asaas (Padrão)          PIX • Cartão 12x        ⚙ ⋯
  ✔ PIX Manual               Manual                  ⚙ ⋯

Outras formas de pagamento
  + Mercado Pago             Checkout automático
  + InfinitePay              Checkout automático
```

Clicar em ⚙ ou "+" abre um **Sheet (drawer lateral)** com a configuração completa do gateway — sem expandir na página.

## Mudanças Técnicas

### 1. Refatorar `PaymentSettings.tsx`

**Bloco "Recebimento ativo"** (~50 linhas):
- Lista compacta das integrações ativas (`data.allActiveIntegrations`)
- Cada linha: logo (24px) + nome + badge "Padrão" + resumo inline (ex: "PIX • Cartão 12x") + botão ⚙ (abre drawer) + menu ⋯ (definir padrão / desativar)
- Sem cards, sem bordas grossas — apenas linhas separadas por `divide-y`
- Aviso PIX Manual como texto inline discreto (sem card amarelo)

**Bloco "Outras formas de pagamento"** (~30 linhas):
- Lista dos gateways **não ativos** com botão `+` que abre o drawer de configuração inicial
- Estilo minimalista: logo + nome + descrição curta + botão `+`

### 2. Criar `PaymentConfigDrawer.tsx` (novo componente)

Um `Sheet` (do radix, já existe em `ui/sheet.tsx`) que recebe o `provider` e renderiza o formulário de configuração:

- **PIX Manual**: tipo chave, chave, nome titular
- **InfinitePay**: handle
- **Mercado Pago**: se não conectado → botão OAuth; se conectado → toggles PIX/Cartão, parcelas, absorver taxa
- **Asaas**: API key (só na primeira vez), ambiente, métodos, parcelamento, antecipação, taxas

Todo o conteúdo de configuração que hoje está inline nos cards será movido para este drawer. A lógica de estado e handlers permanece no `PaymentSettings.tsx` e é passada via props.

### 3. Estados visuais claros

Cada gateway na lista terá um indicador:
- `✔` verde = conectado e ativo
- `⚠` amber = precisa reconfigurar (ex: MP com `erro_autenticacao`)
- `○` cinza = não configurado (aparece em "Outras formas")

### 4. Remover

- Cards `lunari-card` com fundo e borda
- Blocos informativos redundantes ("Confirmação automática", "Checkout transparente")
- Botões grandes "Configurar PIX", "Configurar InfinitePay"
- Ícones genéricos (CreditCard, QrCode, Zap) — usar apenas os logos reais

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/settings/PaymentSettings.tsx` | Reescrever: 2 blocos compactos + abrir drawer ao invés de expandir inline |
| `src/components/settings/PaymentConfigDrawer.tsx` | **Novo**: Sheet lateral com formulários de cada gateway |

## Preservação

- Toda a lógica de negócio (handlers, estados, hooks) permanece intacta
- `usePaymentIntegration` não muda
- Formulários internos são os mesmos, apenas movidos para dentro do drawer

