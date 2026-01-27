
# Plano de Correção: Retorno de Pagamento e Modo Visualização

## Diagnóstico

### Problemas Identificados na Captura de Tela

| # | Problema | Causa Raiz | Impacto |
|---|----------|------------|---------|
| 1 | Cliente vê tela de boas-vindas após pagamento | `showWelcome` inicia como `true` e não é alterado imediatamente quando `payment=success` é detectado | UX quebrada |
| 2 | Botão "Começar Seleção" aparece após confirmação | O efeito de detecção de pagamento não atualiza `showWelcome` | Cliente confuso |
| 3 | Lightbox confirmado navega por TODAS as fotos | Passa `localPhotos` em vez de `confirmedSelectedPhotos` | Inconsistência |

### Fluxo Atual (Problemático)

```text
Cliente finaliza pagamento
        │
        ▼
Redirect: /g/{token}?payment=success
        │
        ▼
showWelcome = true (valor padrão) ◄─── PROBLEMA
        │
        ▼
RENDERIZA TELA DE BOAS-VINDAS ◄─── O QUE O USUÁRIO VÊ
        │
        ▼
useEffect detecta payment=success
        │
        ▼
Chama check-payment-status (async)
        │
        ▼
Só depois: setCurrentStep('confirmed')
           setIsConfirmed(true)
           MAS showWelcome continua true!
```

---

## Correções Necessárias

### 1. `ClientGallery.tsx` - Detectar `payment=success` ANTES da renderização

**Problema**: O estado `showWelcome` é `useState(true)` e só é modificado por um `useEffect` que roda DEPOIS da primeira renderização.

**Solução**: Inicializar `showWelcome` considerando o parâmetro da URL e verificar `payment=success` no próprio `useEffect` de detecção.

**Alteração 1 - Estado inicial inteligente (L79)**:
```typescript
// ANTES
const [showWelcome, setShowWelcome] = useState(true);

// DEPOIS
const [showWelcome, setShowWelcome] = useState(() => {
  // Se tem payment=success na URL, NÃO mostrar welcome
  const params = new URLSearchParams(window.location.search);
  return params.get('payment') !== 'success';
});
```

**Alteração 2 - Garantir showWelcome=false no efeito de pagamento (L468-518)**:
```typescript
if (paymentStatus === 'success' && galleryId && !isProcessingPaymentReturn) {
  setIsProcessingPaymentReturn(true);
  setShowWelcome(false); // ◄── ADICIONAR IMEDIATAMENTE
  
  const confirmPaymentReturn = async () => {
    // ... código existente
  };
```

---

### 2. `ClientGallery.tsx` - Lightbox do modo confirmado deve navegar APENAS entre fotos selecionadas

**Problema (L965-977)**: O Lightbox recebe `localPhotos` (todas as fotos), mas o grid só mostra `confirmedSelectedPhotos`.

**Solução**: Passar apenas as fotos selecionadas e ajustar o índice corretamente.

**Alteração (L931-977)**:
```typescript
// Guardar índice local nas fotos selecionadas
<div 
  className="relative group cursor-pointer" 
  onClick={() => setLightboxIndex(index)}  // ◄── Usar index local, não findIndex
>

// Lightbox deve receber apenas as fotos selecionadas
{lightboxIndex !== null && (
  <Lightbox
    photos={confirmedSelectedPhotos}  // ◄── MUDANÇA: só selecionadas
    currentIndex={lightboxIndex}
    watermark={gallery.settings.watermark}  // ◄── ADICIONAR: estava faltando
    watermarkDisplay={gallery.settings.watermarkDisplay}
    allowComments={false}
    allowDownload={gallery.settings.allowDownload}  // ◄── ADICIONAR: permitir download
    disabled={true}
    onClose={() => setLightboxIndex(null)}
    onNavigate={setLightboxIndex}
    onSelect={() => {}}
  />
)}
```

---

### 3. Verificar Botões Desabilitados no Lightbox

O componente `Lightbox.tsx` já recebe `disabled={true}` no modo confirmado, e os botões de seleção/favorito/comentário já respeitam essa prop. Mas verificar se o botão de download funciona no modo read-only.

**Verificação necessária (L35-37 do Lightbox.tsx)**:
- `allowDownload` já está sendo passado corretamente
- O botão de download NÃO depende de `disabled`, então funciona no modo read-only ✓

---

## Arquivos a Modificar

| Arquivo | Alteração | Linhas |
|---------|-----------|--------|
| `src/pages/ClientGallery.tsx` | Inicialização inteligente de `showWelcome` | L79 |
| `src/pages/ClientGallery.tsx` | Adicionar `setShowWelcome(false)` no efeito de pagamento | L468-470 |
| `src/pages/ClientGallery.tsx` | Corrigir Lightbox do modo confirmado | L931-977 |

---

## Fluxo Corrigido

```text
Cliente finaliza pagamento
        │
        ▼
Redirect: /g/{token}?payment=success
        │
        ▼
useState inicializa:
  showWelcome = false (detectou payment=success) ◄─── CORREÇÃO
        │
        ▼
useEffect detecta payment=success
  → setShowWelcome(false) (garantia extra)
  → Chama check-payment-status
        │
        ▼
Resposta API confirma pagamento
  → setCurrentStep('confirmed')
  → setIsConfirmed(true)
        │
        ▼
RENDERIZA TELA DE CONFIRMAÇÃO ◄─── CORRETO
  → Grid apenas com fotos selecionadas
  → Lightbox em modo view-only
  → Download permitido se configurado
```

---

## Comportamento Final Esperado

| Cenário | Comportamento |
|---------|---------------|
| Retorno de pagamento InfinitePay | Vai direto para tela de confirmação |
| Galeria já confirmada (acesso posterior) | Vai direto para tela de confirmação |
| Seleção sem pagamento confirmada | Vai direto para tela de confirmação |
| Lightbox em modo confirmado | Navega apenas entre fotos selecionadas |
| Botões no modo confirmado | Seleção/Favorito/Comentário desabilitados |
| Download no modo confirmado | Funciona se `allowDownload=true` |

---

## Detalhes Técnicos

### Bloco 1: Estado inicial inteligente

```typescript
// Linha 79 - src/pages/ClientGallery.tsx
const [showWelcome, setShowWelcome] = useState(() => {
  // Se retornando de pagamento, pular tela de boas-vindas
  const params = new URLSearchParams(window.location.search);
  return params.get('payment') !== 'success';
});
```

### Bloco 2: Garantia no efeito de pagamento

```typescript
// Linha 468-470 - src/pages/ClientGallery.tsx
if (paymentStatus === 'success' && galleryId && !isProcessingPaymentReturn) {
  setIsProcessingPaymentReturn(true);
  setShowWelcome(false); // Garantir que welcome não apareça
```

### Bloco 3: Lightbox corrigido para modo confirmado

```typescript
// Grid - usar index local
<div 
  className="relative group cursor-pointer" 
  onClick={() => setLightboxIndex(index)}
>

// Lightbox - passar apenas fotos selecionadas
<Lightbox
  photos={confirmedSelectedPhotos}
  currentIndex={lightboxIndex}
  watermark={gallery.settings.watermark}
  watermarkDisplay={gallery.settings.watermarkDisplay}
  allowComments={false}
  allowDownload={gallery.settings.allowDownload}
  disabled={true}
  onClose={() => setLightboxIndex(null)}
  onNavigate={setLightboxIndex}
  onSelect={() => {}}
/>
```
