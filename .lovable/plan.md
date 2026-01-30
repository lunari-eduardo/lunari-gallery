
# Plano: Corrigir Incompatibilidade entre confirm-selection e mercadopago-create-link

## Problema Identificado

A Edge Function `confirm-selection` está chamando `mercadopago-create-link` com parâmetros diferentes dos que a função espera:

| Campo Esperado | Campo Enviado | Status |
|----------------|---------------|--------|
| `photographer_id` | `userId` | ❌ Nome diferente |
| `cobranca_id` | Não enviado | ❌ Faltando |
| `valor` | `valor` | ✅ OK |
| `descricao` | `descricao` | ✅ OK |
| `cliente_email` | Não enviado | ❌ Faltando |
| `payment_method` | Não enviado | ❌ Faltando |

Os logs confirmam: `"Criando pagamento MP para fotógrafo: undefined cobrança: undefined"`

---

## Solução

Adaptar a função `mercadopago-create-link` para aceitar **ambos os formatos** de chamada:

1. Formato original do `mercadopago-create-link` (usado por outras partes do sistema)
2. Formato enviado pela `confirm-selection` (Gallery flow)

A função deve detectar qual formato está sendo usado e normalizar os parâmetros internamente.

---

## Detalhes Técnicos

### Mudanças em `supabase/functions/mercadopago-create-link/index.ts`

```text
ANTES (Interface rígida):
┌─────────────────────────────────────────────┐
│ interface CreateLinkRequest {               │
│   cobranca_id: string;                      │
│   photographer_id: string;                  │
│   valor: number;                            │
│   descricao: string;                        │
│   cliente_email: string;                    │
│   payment_method: 'pix' | 'credit_card';    │
│ }                                           │
└─────────────────────────────────────────────┘

DEPOIS (Aceita ambos formatos):
┌─────────────────────────────────────────────┐
│ interface CreateLinkRequest {               │
│   // Formato original                       │
│   cobranca_id?: string;                     │
│   photographer_id?: string;                 │
│   cliente_email?: string;                   │
│   payment_method?: 'pix' | 'credit_card';   │
│                                             │
│   // Formato confirm-selection              │
│   userId?: string;                          │
│   clienteId?: string;                       │
│   galeriaId?: string;                       │
│   galleryToken?: string;                    │
│   qtdFotos?: number;                        │
│   sessionId?: string;                       │
│                                             │
│   // Comum                                  │
│   valor: number;                            │
│   descricao: string;                        │
│ }                                           │
└─────────────────────────────────────────────┘
```

### Lógica de Normalização

1. **Identificar Fotógrafo**: 
   - Usar `photographer_id` se presente
   - Caso contrário, usar `userId`

2. **Email do Cliente**: 
   - Se `cliente_email` não fornecido, buscar via `clienteId` no banco de dados

3. **Cobrança**:
   - Se `cobranca_id` não fornecido, **criar uma nova cobrança** na tabela `cobrancas` usando `galeriaId` e `qtdFotos`

4. **Método de Pagamento**:
   - Se não fornecido, usar PIX por padrão (mais comum no fluxo de galeria)
   - Ou criar preferência de checkout que aceita ambos

---

## Fluxo Atualizado

```text
┌───────────────────────────────┐
│     confirm-selection         │
│  Envia: userId, clienteId,    │
│  galeriaId, valor, descricao  │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│   mercadopago-create-link     │
│                               │
│ 1. Detectar formato de entrada│
│ 2. Normalizar parâmetros      │
│ 3. Buscar email do cliente    │
│ 4. Criar cobrança se preciso  │
│ 5. Criar preferência MP       │
│ 6. Retornar checkout_url      │
└───────────────────────────────┘
```

---

## Arquivos a Modificar

1. **`supabase/functions/mercadopago-create-link/index.ts`**:
   - Expandir interface para aceitar campos do formato `confirm-selection`
   - Adicionar lógica para normalizar `photographer_id` / `userId`
   - Adicionar busca de email do cliente via `clienteId`
   - Adicionar criação de cobrança se `cobranca_id` não for fornecido
   - Usar preferência de checkout (aceita PIX e cartão) como padrão

---

## Benefícios

- **Compatibilidade retroativa**: Chamadas existentes continuarão funcionando
- **Flexibilidade**: A função aceita múltiplos formatos de entrada
- **Menos mudanças**: Não precisa alterar `confirm-selection`, apenas adaptar `mercadopago-create-link`
