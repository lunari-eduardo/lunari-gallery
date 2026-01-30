
# Plano de Correção: Textos Invisíveis e Modo Escuro Inconsistente

## Problemas Identificados

### Problema 1: Textos Claros Invisíveis nas Telas de Confirmação/Pagamento

Na tela `SelectionConfirmation`, os valores como "Galeria Pública", "Teste", "Pacote" estão com cor bege clara (quase invisível) sobre fundo claro.

**Causa Raiz:**
O CSS inline via `themeStyles` define as variáveis corretamente, mas a estrutura do wrapper não está propagando corretamente. O problema está na forma como as variáveis CSS são aplicadas:

```tsx
// Estrutura atual (problemática)
<div className={cn(backgroundMode === 'dark' ? 'dark' : '')} style={themeStyles}>
  <div className="min-h-screen flex flex-col bg-background">
```

O `themeStyles` define `--foreground: '25 20% 15%'` para modo claro, mas o `font-medium` que usa `text-foreground` não está herdando corretamente porque a classe `.dark` do CSS global pode estar conflitando.

### Problema 2: Modo Escuro Só Funciona no Login

A tela de senha (`PasswordScreen`) usa `backgroundMode` corretamente, mas as outras telas usam `activeClientMode`:

| Tela | Variável Usada | Fonte |
|------|---------------|-------|
| PasswordScreen | `backgroundMode` | `galleryResponse.theme.backgroundMode` ✓ |
| Welcome | `activeClientMode` | Estado local inicializado de `clientMode` ✗ |
| Main Gallery | `activeClientMode` | Estado local ✗ |
| Confirmed | `activeClientMode` | Estado local ✗ |

O `clientMode` (modo do cliente/navegador) é diferente de `backgroundMode` (tema configurado pelo fotógrafo).

## Solução

### Parte 1: Unificar Fonte de Verdade para Modo de Fundo

Em `ClientGallery.tsx`, derivar o modo de fundo diretamente do tema quando houver tema personalizado:

```typescript
// Lógica corrigida
const effectiveBackgroundMode = galleryResponse?.theme?.backgroundMode 
  || galleryResponse?.clientMode 
  || 'light';
```

Usar `effectiveBackgroundMode` em TODAS as telas em vez de `activeClientMode`.

### Parte 2: Corrigir Estrutura de Aplicação do Tema

O problema é que a classe `.dark` do CSS global pode estar sobrepondo as variáveis inline. Precisamos garantir que:

1. O wrapper externo aplique tanto a classe `.dark` quanto as variáveis inline
2. O container interno use `bg-background` que herda as variáveis

```tsx
// Estrutura corrigida
<div 
  className={cn("min-h-screen flex flex-col bg-background", backgroundMode === 'dark' && 'dark')}
  style={themeStyles}
>
  {/* Conteúdo */}
</div>
```

Fundir os dois divs em um só resolve o problema de escopo das variáveis CSS.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ClientGallery.tsx` | 1. Criar `effectiveBackgroundMode` unificado<br>2. Usar em todas as renderizações (welcome, main, confirmed)<br>3. Passar corretamente para componentes filhos |
| `src/components/SelectionConfirmation.tsx` | Fundir wrapper externo com container interno |
| `src/components/PaymentRedirect.tsx` | Fundir wrapper externo com container interno |
| `src/components/PixPaymentScreen.tsx` | Fundir wrapper externo com container interno |
| `src/components/PasswordScreen.tsx` | Fundir wrapper externo com container interno (consistência) |

## Mudanças Detalhadas

### ClientGallery.tsx

**Linha ~526-530 - Calcular modo efetivo:**
```typescript
// Usar backgroundMode do tema como fonte primária
const effectiveBackgroundMode = useMemo(() => {
  return galleryResponse?.theme?.backgroundMode || 'light';
}, [galleryResponse?.theme?.backgroundMode]);
```

**Linhas ~796-803 (Welcome), ~952-958 (Confirmed), ~1052-1058 (Main):**
Substituir `activeClientMode` por `effectiveBackgroundMode`:
```typescript
className={cn(
  "min-h-screen flex flex-col bg-background text-foreground",
  effectiveBackgroundMode === 'dark' && 'dark'
)}
style={themeStyles}
```

**Remover** o toggle de modo (linhas 527-530 e o handler `onToggleMode` no ClientGalleryHeader) pois o modo agora vem do tema configurado.

### SelectionConfirmation.tsx

**Linhas 68-73 - Fundir wrappers:**
```tsx
// ANTES
<div className={cn(backgroundMode === 'dark' ? 'dark' : '')} style={themeStyles}>
  <div className="min-h-screen flex flex-col bg-background">

// DEPOIS
<div 
  className={cn(
    "min-h-screen flex flex-col bg-background text-foreground",
    backgroundMode === 'dark' && 'dark'
  )}
  style={themeStyles}
>
```

Também remover o `</div>` extra no final.

### PaymentRedirect.tsx

**Linhas 60-65 - Fundir wrappers:**
```tsx
// DEPOIS
<div 
  className={cn(
    "min-h-screen flex flex-col items-center justify-center bg-background p-4",
    backgroundMode === 'dark' && 'dark'
  )}
  style={themeStyles}
>
```

### PixPaymentScreen.tsx

Aplicar mesma correção de fundir wrappers.

### PasswordScreen.tsx

**Linhas 38-43 - Fundir wrappers:**
```tsx
// DEPOIS
<div 
  className={cn(
    "min-h-screen flex flex-col bg-background",
    backgroundMode === 'dark' && 'dark'
  )}
  style={themeStyles}
>
```

## Fluxo Corrigido

```text
1. Fotógrafo configura galeria com tema: backgroundMode = 'dark'
          |
2. gallery-access retorna: theme.backgroundMode = 'dark'
          |
3. ClientGallery calcula: effectiveBackgroundMode = 'dark'
          |
4. themeStyles inclui variáveis para modo escuro:
   '--background': '25 15% 10%',
   '--foreground': '30 20% 95%',
   ...
          |
5. TODAS as telas aplicam:
   - className="... bg-background text-foreground dark"
   - style={themeStyles}
          |
6. Resultado: Textos legíveis em todas as telas
```

## Benefícios

1. **Textos visíveis** - Cores de texto corretas para cada modo de fundo
2. **Consistência** - Mesmo tema em TODAS as telas (senha → galeria → confirmação → pagamento)
3. **Fonte única** - `theme.backgroundMode` é a fonte de verdade, não `clientMode`
4. **Estrutura limpa** - Um único wrapper com classe + style em vez de dois divs
