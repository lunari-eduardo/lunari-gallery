

## Plano: 3 Correções (UX pagamento, Asaas rebill interno, bug nome cliente)

### Problema 1: Tela intermediária de verificação desnecessária

O fluxo atual mostra uma tela "Confirmando seu pagamento..." que bloqueia a galeria. Se o cliente fechar a aba do InfinitePay sem clicar "continuar", o `?payment=success` nunca chega e a verificação nunca executa — depende apenas do webhook.

**Correção em `ClientGallery.tsx`**:
- Remover o render condicional da tela de verificação (linhas 968-1059)
- No useEffect (linha 591), ao detectar `?payment=success`, chamar `check-payment-status` silenciosamente em background
- Não mostrar UI bloqueante — apenas limpar params da URL e fazer `refetchGallery()` ao completar
- O estado natural da galeria (pago/pendente) será exibido automaticamente pelo fluxo existente

### Problema 2: "Cobrar novamente" com Asaas gera link externo

Atualmente o `PaymentStatusCard` recebe `checkoutUrl` (URL externa do Asaas) e exibe como link para copiar/abrir. O usuário quer que, para Asaas, o "Cobrar novamente" gere os dados necessários para o checkout transparente interno (AsaasCheckout), igual ao fluxo normal da galeria.

**Correção em `PaymentStatusCard.tsx`**:
- Quando a resposta do `gallery-create-payment` vier com `provedor: 'asaas'`, em vez de mostrar link externo, montar o objeto `AsaasCheckoutData` com os dados retornados e abrir o `AsaasCheckout` inline dentro do modal
- O `gallery-create-payment` para Asaas já chama `asaas-gallery-payment` que cria a cobrança. Mas para checkout transparente, precisamos dos dados do Asaas (settings, métodos habilitados, etc.)

**Correção no fluxo**: O `gallery-create-payment` quando `provider=asaas` deve retornar também os dados necessários para montar o `AsaasCheckoutData` (enabledMethods, maxParcelas, absorverTaxa, etc). Alternativamente, o `PaymentStatusCard` pode buscar esses dados via `gallery-access` ou montar diretamente.

Na verdade, a abordagem mais simples: o `PaymentStatusCard` já tem acesso ao `galleryId` e `valor`. Para Asaas, em vez de chamar `gallery-create-payment` (que cria cobrança imediatamente), pode simplesmente montar o `AsaasCheckoutData` e renderizar o `AsaasCheckout` inline — o AsaasCheckout já chama `asaas-gallery-payment` internamente quando o cliente submete o pagamento.

**Implementação**:
- No `PaymentStatusCard`, para provider Asaas, buscar as configurações Asaas do fotógrafo (via query na tabela `usuarios_integracoes`)
- Montar `AsaasCheckoutData` com os dados da galeria
- Renderizar `AsaasCheckout` dentro do dialog em vez de mostrar link externo
- O `AsaasCheckout` lida com toda a criação de cobrança e checkout transparente

Porém, o `PaymentStatusCard` é do painel do **fotógrafo**, não do cliente. O checkout transparente é para o cliente pagar. O fotógrafo precisa gerar um link para enviar ao cliente. Nesse caso, o link correto é o da galeria: `https://gallery.lunarihub.com/g/{token}` — quando o cliente acessar, o `gallery-access` detecta o pagamento pendente e mostra o AsaasCheckout automaticamente.

**Correção final para Asaas no rebill**:
- Chamar `gallery-create-payment` normalmente (cria a cobrança pendente no DB)
- Em vez de exibir o `invoiceUrl` externo, exibir o link da galeria (`/g/{token}`) como o link para copiar/enviar ao cliente
- O cliente ao acessar a galeria verá o checkout transparente Asaas automaticamente

**Alterações**:
1. `gallery-create-payment`: Retornar `galleryUrl` (link da galeria) junto com `checkoutUrl`
2. `PaymentStatusCard`: Para Asaas, preferir `galleryUrl` sobre `checkoutUrl` externo

### Problema 3: Nome "Evelise" em vez de "Eduardo"

**Bug encontrado**: Na `asaas-gallery-payment` linhas 126-136, a busca de customer no Asaas é feita por **email**:
```typescript
const searchResp = await fetch(`${asaasBaseUrl}/v3/customers?email=${encodeURIComponent(cliente.email)}`, ...);
if (searchData.data && searchData.data.length > 0) {
  asaasCustomerId = searchData.data[0].id; // Pega o PRIMEIRO resultado
}
```

Se o email do cliente "Eduardo" já foi usado anteriormente para criar um customer "Evelise" no Asaas (ou vice-versa), o sistema reutiliza o customer antigo com o nome errado. Não há verificação de nome ou de `externalReference`.

**Correção em `asaas-gallery-payment`**:
- Após encontrar um customer por email, verificar se o nome bate. Se não bater, atualizar o nome do customer no Asaas via `PUT /v3/customers/{id}`
- Ou melhor: buscar primeiro por `externalReference` (que é o `clienteId`), e só depois por email. Isso garante que cada cliente Lunari tem seu próprio customer Asaas

### Arquivos modificados

1. **`src/pages/ClientGallery.tsx`**: Remover tela intermediária de verificação, fazer check silencioso em background
2. **`supabase/functions/gallery-create-payment/index.ts`**: Retornar `galleryUrl` na resposta
3. **`src/components/PaymentStatusCard.tsx`**: Para Asaas, usar `galleryUrl` (link da galeria) em vez de `checkoutUrl` externo
4. **`supabase/functions/asaas-gallery-payment/index.ts`**: Corrigir busca de customer — priorizar `externalReference` sobre email, e atualizar nome se divergente

