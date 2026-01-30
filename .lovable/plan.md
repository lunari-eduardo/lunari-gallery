
# Plano de Correção: Erro 500 ao Gerar Pagamento + Sistema Robusto

## Problema Principal Identificado

O erro 500 ocorre porque **a galeria foi criada sem cliente vinculado** (Galeria Pública), mas a tabela `cobrancas` exige `cliente_id` como campo obrigatório (NOT NULL).

### Evidências do Log:
```
null value in column "cliente_id" of relation "cobrancas" violates not-null constraint
Failing row contains (..., cliente_id: null, ...)
```

### Galeria Afetada:
```sql
SELECT cliente_id FROM galerias WHERE id = '5e66eb25-e723-497a-be25-5c4dfda4687f';
-- Resultado: cliente_id = NULL (Galeria Pública)
```

## Análise de Impacto em Todos os Provedores

| Provedor | Arquivo | Problema | Status |
|----------|---------|----------|--------|
| Mercado Pago | `mercadopago-create-link/index.ts` | Insere `cliente_id: null` sem validação (linha 83) | **QUEBRADO** |
| InfinitePay | `infinitepay-create-link/index.ts` | Valida `clienteId` obrigatório, retorna 400 (linha 62) | **QUEBRADO** |
| gallery-create-payment | `gallery-create-payment/index.ts` | Passa `cliente_id` sem validação (linha 132) | **QUEBRADO** |

## Causa Raiz

1. **Inconsistência de schema**: A tabela `galerias` permite `cliente_id = NULL` (para galerias públicas), mas `cobrancas` requer `cliente_id NOT NULL`
2. **Falta de validação**: As Edge Functions não validam se `cliente_id` existe antes de criar cobrança
3. **Tratamento de erro genérico**: Erros de constraint retornam 500 em vez de mensagem clara

## Solução Proposta (3 Etapas)

### Etapa 1: Corrigir Schema (Banco de Dados)

Alterar a tabela `cobrancas` para permitir `cliente_id = NULL`, igual à tabela `galerias`:

```sql
ALTER TABLE cobrancas ALTER COLUMN cliente_id DROP NOT NULL;
```

**Justificativa**: Se uma galeria pode existir sem cliente, a cobrança dessa galeria também deve poder existir sem cliente. O vínculo é feito pelo `galeria_id`.

### Etapa 2: Adicionar Validação Robusta nas Edge Functions

Mesmo após permitir NULL, devemos adicionar validações claras para:
- Alertar quando cliente está ausente
- Garantir que `galeria_id` OU `cliente_id` esteja presente
- Retornar erros amigáveis em vez de 500

**Arquivo: `mercadopago-create-link/index.ts`**

Adicionar antes de criar cobrança (linha ~77):

```typescript
// Validar que temos pelo menos uma referência (cliente ou galeria)
if (!body.clienteId && !body.galeriaId) {
  console.error('Cobrança requer cliente_id ou galeria_id');
  return new Response(
    JSON.stringify({ 
      success: false,
      error: 'É necessário um cliente ou galeria vinculada para criar cobrança' 
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Log de aviso para galerias públicas (não bloqueante)
if (!body.clienteId && body.galeriaId) {
  console.log('⚠️ Criando cobrança para galeria pública (sem cliente)');
}
```

**Arquivo: `infinitepay-create-link/index.ts`**

Alterar validação (linhas 61-68):

```typescript
// ANTES: if (!clienteId || !valor || !userId)
// DEPOIS: Permitir cliente null se tiver galeria
if (!valor || !userId) {
  console.error('Missing required fields:', { valor, userId });
  return new Response(
    JSON.stringify({ error: 'valor e userId são obrigatórios' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Validar referência (cliente ou galeria)
if (!clienteId && !galeriaId) {
  console.error('Cobrança requer cliente_id ou galeria_id');
  return new Response(
    JSON.stringify({ error: 'É necessário um cliente ou galeria vinculada' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Etapa 3: Aplicar Métodos de Pagamento Conforme Configuração

Atualmente, quando `habilitarCartao: false`, o sistema ainda cria um checkout genérico que mostra opção de cartão. Devemos respeitar as configurações:

**Arquivo: `mercadopago-create-link/index.ts`**

Alterar a lógica de exclusão de métodos (linhas 286-294):

```typescript
// Construir lista de exclusões baseada nas configurações do fotógrafo
const excludedTypes: { id: string }[] = [{ id: 'ticket' }]; // Sempre excluir boleto

// Excluir cartão se desabilitado nas configurações
if (settings?.habilitarCartao === false) {
  excludedTypes.push({ id: 'credit_card' });
  excludedTypes.push({ id: 'debit_card' });
  console.log('💳 Cartão desabilitado pelo fotógrafo - excluindo do checkout');
}

// Se só PIX está habilitado, criar pagamento PIX direto em vez de preference
if (settings?.habilitarCartao === false && settings?.habilitarPix !== false) {
  // Redirecionar para o fluxo de PIX direto
  console.log('📱 Apenas PIX habilitado - criando pagamento PIX direto');
  // ... usar o bloco de criação de PIX (linhas 210-280)
}
```

## Fluxo Corrigido

```text
1. Cliente confirma seleção em galeria pública
          ↓
2. confirm-selection passa cliente_id=null, galeria_id=uuid
          ↓
3. mercadopago-create-link:
   - Valida: galeria_id existe ✓
   - Loga: "Criando cobrança para galeria pública"
   - Verifica settings: habilitarCartao=false, habilitarPix=true
   - Cria pagamento PIX direto (não preference)
          ↓
4. cobrancas.insert({ cliente_id: null, galeria_id: uuid }) ✓
          ↓
5. Retorna checkoutUrl ou QR Code PIX
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migration SQL** | `ALTER TABLE cobrancas ALTER COLUMN cliente_id DROP NOT NULL;` |
| `supabase/functions/mercadopago-create-link/index.ts` | 1. Validação cliente/galeria<br>2. Respeitar config de métodos<br>3. Redirecionar para PIX quando só PIX habilitado |
| `supabase/functions/infinitepay-create-link/index.ts` | 1. Permitir cliente null<br>2. Validar referência (cliente OU galeria) |

## Benefícios

1. **Correção imediata**: Galerias públicas poderão gerar pagamentos
2. **Configurações respeitadas**: Desabilitar cartão realmente impedirá opção de cartão
3. **Erros claros**: Mensagens específicas em vez de 500 genérico
4. **Sistema robusto**: Modificações pontuais não causarão erros em cascata
5. **Consistência**: Mesmo comportamento entre Mercado Pago e InfinitePay

## Testes Recomendados

Após implementação, testar cenários:
- [ ] Galeria pública + Mercado Pago (só PIX)
- [ ] Galeria pública + Mercado Pago (PIX + Cartão)
- [ ] Galeria pública + InfinitePay
- [ ] Galeria com cliente + Mercado Pago
- [ ] Galeria com cliente + PIX Manual
