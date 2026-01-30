
# Plano de Correção: Tema Personalizado em Todas as Telas

## Problemas Identificados

### Problema 1: Caixa de Mensagem de Boas-Vindas com Fundo Escuro
A classe `lunari-card` usa a variavel `--gradient-card`, que nao esta sendo definida no `themeStyles`. Quando o tema personalizado tem `backgroundMode: 'light'`, apenas as variaveis basicas (`--background`, `--card`, etc.) sao definidas, mas `--gradient-card` continua usando o valor padrao do CSS que pode conflitar.

**Localizacao**: `src/pages/ClientGallery.tsx` linhas 536-572

### Problema 2: Telas de Confirmacao e Pagamento sem Tema
As seguintes telas NAO recebem `themeStyles` nem `backgroundMode`:
- `SelectionConfirmation` (linha 880-893)
- `PaymentRedirect` (linha 921-927)
- `PixPaymentScreen` (linha 900-915)
- `PasswordScreen` (linha 631-639)

Resultado: Essas telas usam o tema do sistema (escuro) em vez do tema personalizado.

## Solucao

### Mudanca 1: Adicionar variaveis de gradiente ao themeStyles

**Arquivo: `src/pages/ClientGallery.tsx`**

Atualizar o `themeStyles` useMemo para incluir as variaveis de gradiente:

```typescript
const themeStyles = useMemo(() => {
  const theme = galleryResponse?.theme;
  if (!theme) return {};
  
  const backgroundMode = theme.backgroundMode || 'light';
  
  // Base colors depend on background mode
  const baseColors = backgroundMode === 'dark' ? {
    '--background': '25 15% 10%',
    '--foreground': '30 20% 95%',
    '--card': '25 15% 13%',
    '--card-foreground': '30 20% 95%',
    '--muted': '25 12% 20%',
    '--muted-foreground': '30 15% 60%',
    '--border': '25 12% 22%',
    '--primary-foreground': '25 15% 10%',
    '--popover': '25 15% 13%',
    '--popover-foreground': '30 20% 95%',
    // Gradients for dark mode
    '--gradient-card': 'linear-gradient(180deg, hsl(25 15% 13%) 0%, hsl(25 12% 11%) 100%)',
  } : {
    '--background': '30 25% 97%',
    '--foreground': '25 20% 15%',
    '--card': '30 20% 99%',
    '--card-foreground': '25 20% 15%',
    '--muted': '30 15% 92%',
    '--muted-foreground': '25 10% 45%',
    '--border': '30 15% 88%',
    '--primary-foreground': '30 25% 98%',
    '--popover': '30 20% 99%',
    '--popover-foreground': '25 20% 15%',
    // Gradients for light mode
    '--gradient-card': 'linear-gradient(180deg, hsl(30 20% 99%) 0%, hsl(30 15% 96%) 100%)',
  };
  
  const primaryHsl = hexToHsl(theme.primaryColor);
  const accentHsl = hexToHsl(theme.accentColor);
  
  return {
    ...baseColors,
    '--primary': primaryHsl || '18 55% 55%',
    '--accent': accentHsl || '120 20% 62%',
    '--ring': primaryHsl || '18 55% 55%',
  } as React.CSSProperties;
}, [galleryResponse?.theme]);
```

### Mudanca 2: Passar themeStyles e backgroundMode para SelectionConfirmation

**Arquivo: `src/pages/ClientGallery.tsx` (linha ~880)**

```typescript
return (
  <SelectionConfirmation
    gallery={gallery}
    photos={localPhotos}
    selectedCount={selectedCount}
    extraCount={extraCount}
    extrasACobrar={extrasACobrar}
    extrasPagasAnteriormente={extrasPagasTotal}
    valorJaPago={valorJaPago}
    regrasCongeladas={regrasCongeladas}
    hasPaymentProvider={hasPaymentProvider}
    isConfirming={confirmMutation.isPending}
    onBack={() => setCurrentStep('gallery')}
    onConfirm={handleConfirm}
    // NOVO: Props de tema
    themeStyles={themeStyles}
    backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
  />
);
```

**Arquivo: `src/components/SelectionConfirmation.tsx`**

Adicionar props e aplicar estilos:

```typescript
interface SelectionConfirmationProps {
  // ... props existentes
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function SelectionConfirmation({ 
  // ... props existentes
  themeStyles = {},
  backgroundMode = 'light',
}: SelectionConfirmationProps) {
  // ...
  
  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col",
        backgroundMode === 'dark' ? 'dark' : ''
      )}
      style={themeStyles}
    >
      {/* Container com bg-background */}
      <div className="min-h-screen flex flex-col bg-background">
        {/* ... conteudo existente ... */}
      </div>
    </div>
  );
}
```

### Mudanca 3: Passar themeStyles para PaymentRedirect

**Arquivo: `src/pages/ClientGallery.tsx` (linha ~921)**

```typescript
return (
  <PaymentRedirect
    checkoutUrl={paymentInfo.checkoutUrl}
    provedor={paymentInfo.provedor}
    valorTotal={paymentInfo.valorTotal}
    onCancel={() => setCurrentStep('confirmed')}
    // NOVO: Props de tema
    themeStyles={themeStyles}
    backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
  />
);
```

**Arquivo: `src/components/PaymentRedirect.tsx`**

```typescript
interface PaymentRedirectProps {
  // ... props existentes
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function PaymentRedirect({ 
  // ... props existentes
  themeStyles = {},
  backgroundMode = 'light',
}: PaymentRedirectProps) {
  // ...
  
  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col items-center justify-center p-4",
        backgroundMode === 'dark' ? 'dark' : ''
      )}
      style={themeStyles}
    >
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        {/* ... conteudo existente ... */}
      </div>
    </div>
  );
}
```

### Mudanca 4: Passar themeStyles para PixPaymentScreen

**Arquivo: `src/pages/ClientGallery.tsx` (linha ~900)**

```typescript
return (
  <PixPaymentScreen
    chavePix={pixPaymentData.chavePix}
    nomeTitular={pixPaymentData.nomeTitular}
    tipoChave={pixPaymentData.tipoChave}
    valorTotal={pixPaymentData.valorTotal}
    studioName={galleryResponse?.studioSettings?.studio_name}
    studioLogoUrl={galleryResponse?.studioSettings?.studio_logo_url}
    onPaymentConfirmed={() => {
      setCurrentStep('confirmed');
      toast.success('Obrigado!', {
        description: 'Aguarde a confirmacao do pagamento pelo fotografo.',
      });
    }}
    // NOVO: Props de tema
    themeStyles={themeStyles}
    backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
  />
);
```

**Arquivo: `src/components/PixPaymentScreen.tsx`**

```typescript
interface PixPaymentScreenProps {
  // ... props existentes
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function PixPaymentScreen({
  // ... props existentes
  themeStyles = {},
  backgroundMode = 'light',
}: PixPaymentScreenProps) {
  // ...
  
  return (
    <div 
      className={cn(backgroundMode === 'dark' ? 'dark' : '')}
      style={themeStyles}
    >
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        {/* ... conteudo existente ... */}
      </div>
    </div>
  );
}
```

### Mudanca 5: Passar themeStyles para PasswordScreen

**Arquivo: `src/pages/ClientGallery.tsx` (linha ~631)**

```typescript
return (
  <PasswordScreen
    sessionName={galleryResponse?.sessionName}
    studioName={galleryResponse?.studioSettings?.studio_name}
    studioLogo={galleryResponse?.studioSettings?.studio_logo_url}
    onSubmit={handlePasswordSubmit}
    error={passwordError}
    isLoading={isCheckingPassword}
    // NOVO: Props de tema
    themeStyles={themeStyles}
    backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
  />
);
```

**Arquivo: `src/components/PasswordScreen.tsx`**

```typescript
interface PasswordScreenProps {
  // ... props existentes
  themeStyles?: React.CSSProperties;
  backgroundMode?: 'light' | 'dark';
}

export function PasswordScreen({
  // ... props existentes
  themeStyles = {},
  backgroundMode = 'light',
}: PasswordScreenProps) {
  // ...
  
  return (
    <div 
      className={cn(backgroundMode === 'dark' ? 'dark' : '')}
      style={themeStyles}
    >
      <div className="min-h-screen flex flex-col bg-background">
        {/* ... conteudo existente ... */}
      </div>
    </div>
  );
}
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/ClientGallery.tsx` | 1. Adicionar `--gradient-card` ao themeStyles<br>2. Passar themeStyles/backgroundMode para 4 componentes |
| `src/components/SelectionConfirmation.tsx` | Receber e aplicar themeStyles/backgroundMode |
| `src/components/PaymentRedirect.tsx` | Receber e aplicar themeStyles/backgroundMode |
| `src/components/PixPaymentScreen.tsx` | Receber e aplicar themeStyles/backgroundMode |
| `src/components/PasswordScreen.tsx` | Receber e aplicar themeStyles/backgroundMode |

## Estrutura do Wrapper de Tema

Padrao para todos os componentes que recebem tema:

```tsx
<div 
  className={cn(backgroundMode === 'dark' ? 'dark' : '')}
  style={themeStyles}
>
  <div className="min-h-screen ... bg-background ...">
    {/* Conteudo do componente */}
  </div>
</div>
```

O wrapper externo:
- Aplica a classe `dark` se necessario (ativa variaveis CSS do modo escuro)
- Aplica as `themeStyles` inline (override das variaveis CSS)

O container interno:
- Usa `bg-background` que agora le da variavel customizada

## Fluxo Corrigido

```text
1. Cliente acessa galeria com tema personalizado (light, cores customizadas)
           |
2. gallery-access retorna theme: { backgroundMode: 'light', primaryColor: '#B87333', ... }
           |
3. ClientGallery calcula themeStyles com todas as variaveis CSS
           |
4. Cada tela recebe themeStyles + backgroundMode
           |
5. Cada tela aplica:
   - Wrapper: style={themeStyles} + classe 'dark' se backgroundMode === 'dark'
   - Container: bg-background (usa variavel customizada)
           |
6. Resultado: TODAS as telas (senha, galeria, confirmacao, pagamento) 
   usam as mesmas cores consistentes
```

## Beneficios

1. Consistencia visual em todas as telas do cliente
2. Caixa de mensagem de boas-vindas com fundo correto
3. Telas de confirmacao e pagamento com tema personalizado
4. Suporte completo para modo claro e escuro
5. Cores de marca (primaria, destaque, enfase) aplicadas globalmente
