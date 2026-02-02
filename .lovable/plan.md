

# Plano: Substituir Ícones por Logotipos Reais dos Meios de Pagamento

## Resumo das Alterações

Trocar os ícones genéricos (Smartphone, Zap, CreditCard) pelos logotipos oficiais dos provedores de pagamento em todos os lugares relevantes. Adicionar aviso sobre taxas na InfinitePay e preparar botão "Como configurar".

---

## Arquivos de Logo a Adicionar

Os 3 logotipos serão copiados para `src/assets/payment-logos/`:

| Arquivo | Origem | Uso |
|---------|--------|-----|
| `pix.png` | user-uploads://pix.png | PIX Manual |
| `infinitepay.png` | user-uploads://InfnitiPay.png | InfinitePay |
| `mercadopago.png` | user-uploads://MercadPago.png | Mercado Pago |

---

## Locais de Alteração

### 1. PaymentSettings.tsx (Configurações de Pagamentos)

**Localização dos ícones a substituir:**

| Linha | Contexto | Ícone Atual | Mudança |
|-------|----------|-------------|---------|
| 163-169 | `getProviderIcon()` | Smartphone, Zap, CreditCard | Retornar `<img>` com logotipos |
| 171-177 | `getProviderColor()` | Fundos coloridos | **Remover** (logos já têm cor) |
| 201 | Título "Métodos Ativos" | `<CreditCard>` | Manter (ícone genérico de seção) |
| 218-219 | Item ativo - ícone circular | getProviderIcon() | Será atualizado automaticamente |
| 289-291 | Título card MP | `<CreditCard>` | **Remover** do título |
| 392-393 | MP conectado - ícone circular | `<CreditCard>` | Usar logo MP |
| 489-490 | Título card PIX | `<Smartphone>` | **Remover** do título |
| 564-571 | PIX configurado - ícone | `<Smartphone>` | Usar logo PIX |
| 599-600 | Título card InfinitePay | `<Zap>` | **Remover** do título |
| 668-675 | IP configurado - ícone | `<Zap>` | Usar logo InfinitePay |

**Adicionar aviso InfinitePay (após linha 694):**
```tsx
{/* Aviso sobre taxas InfinitePay */}
{ipIntegration?.status === 'ativo' && (
  <div className="mt-4 space-y-3">
    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-200">
        Quando as taxas da InfinitePay estiverem configuradas para serem absorvidas pelo fotógrafo, 
        o sistema exibirá apenas o valor cobrado do cliente. 
        O valor líquido recebido deve ser consultado diretamente na InfinitePay.
      </p>
    </div>
    <Button variant="outline" size="sm">
      <HelpCircle className="h-4 w-4 mr-2" />
      Como configurar
    </Button>
  </div>
)}
```

### 2. PaymentMethodSelector.tsx (Seletor na criação de galeria)

**Linhas a alterar:**

| Linha | Contexto | Ícone Atual | Mudança |
|-------|----------|-------------|---------|
| 65-66 | PIX container | `<Smartphone>` | Usar logo PIX |
| 79-80 | InfinitePay container | `<Zap>` | Usar logo InfinitePay |
| 93-94 | Mercado Pago container | `<CreditCard>` | Usar logo MP |

---

## Implementação Técnica

### Novo arquivo: src/assets/payment-logos/index.ts

```typescript
import pixLogo from './pix.png';
import infinitepayLogo from './infinitepay.png';
import mercadopagoLogo from './mercadopago.png';

export { pixLogo, infinitepayLogo, mercadopagoLogo };
```

### Componente de Logo Reutilizável

Criar helper para uso consistente:

```tsx
// Em PaymentSettings.tsx (ou extrair para componente)
const PaymentProviderLogo = ({ 
  provider, 
  size = 'md' 
}: { 
  provider: PaymentProvider; 
  size?: 'sm' | 'md' | 'lg' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const logos = {
    pix_manual: pixLogo,
    infinitepay: infinitepayLogo,
    mercadopago: mercadopagoLogo,
  };

  return (
    <img 
      src={logos[provider]} 
      alt={getProviderLabel(provider)}
      className={cn(sizeClasses[size], 'object-contain')}
    />
  );
};
```

### Remoção de Backgrounds Coloridos

Os containers circulares com cores (verde, roxo, azul) serão simplificados para fundo neutro já que os logos já têm identidade visual própria:

```tsx
// ANTES
<div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
  <Smartphone className="h-5 w-5 text-green-600" />
</div>

// DEPOIS
<div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center p-1.5">
  <img src={pixLogo} alt="PIX" className="h-full w-full object-contain" />
</div>
```

---

## Estrutura Final de Arquivos

```text
src/
├── assets/
│   └── payment-logos/
│       ├── index.ts
│       ├── pix.png
│       ├── infinitepay.png
│       └── mercadopago.png
├── components/
│   ├── settings/
│   │   └── PaymentSettings.tsx  (modificado)
│   └── PaymentMethodSelector.tsx (modificado)
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/assets/payment-logos/pix.png` | Copiar de user-uploads |
| `src/assets/payment-logos/infinitepay.png` | Copiar de user-uploads |
| `src/assets/payment-logos/mercadopago.png` | Copiar de user-uploads |
| `src/assets/payment-logos/index.ts` | Criar (exports) |
| `src/components/settings/PaymentSettings.tsx` | Modificar |
| `src/components/PaymentMethodSelector.tsx` | Modificar |

---

## Resultado Visual Esperado

**Antes:**
- Ícones genéricos com fundos coloridos circulares (Smartphone verde, Zap roxo, CreditCard azul)

**Depois:**
- Logotipos oficiais das marcas em containers neutros arredondados
- Ícones removidos dos títulos das seções (apenas texto)
- Aviso amarelo sobre taxas InfinitePay
- Botão "Como configurar" preparado (modal virá depois)

---

## Notas sobre o Botão "Como Configurar"

O botão será adicionado mas inicialmente sem funcionalidade. Quando você enviar as instruções, criaremos um modal dedicado com o conteúdo de ajuda.

