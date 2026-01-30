

# Plano: Corrigir Erro de Conexão do Mercado Pago em Mobile

## Problema Identificado

O problema acontece no fluxo de OAuth callback em dispositivos móveis por dois motivos:

1. **Re-execução múltipla do useEffect**: O `connectMercadoPago` está nas dependências do `useEffect`, mas como é um objeto de mutation, ele muda a cada render. Isso pode causar múltiplas chamadas à Edge Function.

2. **Tab errada após callback**: A página Settings abre na aba "Geral" por padrão, então mesmo quando o callback funciona, o usuário não vê a aba "Pagamentos" automaticamente.

3. **Falta de debounce/flag**: Não há controle para evitar que o mesmo código OAuth seja processado múltiplas vezes.

---

## Solução

### 1. Adicionar flag para evitar processamento duplicado

Usar um `useRef` para garantir que o código OAuth seja processado apenas uma vez, mesmo que o `useEffect` rode múltiplas vezes.

### 2. Remover `connectMercadoPago` das dependências

Usar `useRef` para armazenar a função mutation e evitar que mudanças nela causem re-execuções do useEffect.

### 3. Redirecionar para a aba "Pagamentos" após callback

Detectar o parâmetro `mp_callback` na URL e automaticamente abrir a aba de "Pagamentos" para que o usuário veja o resultado.

### 4. Melhorar feedback durante carregamento

Manter o estado de loading visível durante todo o processo de callback.

---

## Arquivos a Modificar

### `src/components/settings/PaymentSettings.tsx`
- Adicionar `useRef` para controlar se o callback já foi processado
- Remover `connectMercadoPago` das dependências do useEffect
- Usar `connectMercadoPago.mutateAsync` com controle de flag

### `src/pages/Settings.tsx`
- Detectar `mp_callback` na URL
- Definir `defaultValue` dinamicamente para a aba "payment" quando retornando do OAuth

---

## Detalhes Técnicos

```text
ANTES:
┌─────────────────────────────────────────────┐
│ useEffect(... , [connectMercadoPago, ...])  │
│     ↓ (roda múltiplas vezes)                │
│ connectMercadoPago.mutate(...)              │
│     ↓ (chamadas duplicadas)                 │
│ Erro: código OAuth já usado                 │
└─────────────────────────────────────────────┘

DEPOIS:
┌─────────────────────────────────────────────┐
│ isProcessingRef = useRef(false)             │
│ useEffect(... , [location.search])          │
│     ↓                                       │
│ if (isProcessingRef.current) return;        │
│ isProcessingRef.current = true;             │
│ connectMercadoPago.mutate(...)              │
│     ↓ (chamada única)                       │
│ Sucesso!                                    │
└─────────────────────────────────────────────┘
```

---

## Mudanças no Settings.tsx

```typescript
// Detectar se é um callback do Mercado Pago
const location = useLocation();
const params = new URLSearchParams(location.search);
const isMpCallback = params.has('mp_callback');

// Usar a aba de pagamentos como padrão se for callback
<Tabs defaultValue={isMpCallback ? "payment" : "general"}>
```

---

## Mudanças no PaymentSettings.tsx

```typescript
// Ref para controlar processamento único
const hasProcessedCallback = useRef(false);

useEffect(() => {
  const params = new URLSearchParams(location.search);
  const isCallback = params.get('mp_callback');
  const code = params.get('code');
  
  // Evitar processamento duplicado
  if (!isCallback || !code || hasProcessedCallback.current) {
    return;
  }
  
  hasProcessedCallback.current = true;
  
  const redirectUri = 'https://gallery.lunarihub.com/settings?mp_callback=true';
  connectMercadoPago.mutate({ code, redirect_uri: redirectUri }, {
    onSettled: () => {
      navigate('/settings', { replace: true });
    },
  });
}, [location.search]); // Remover connectMercadoPago e navigate
```

