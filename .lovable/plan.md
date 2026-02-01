

# Corrigir Precificação Progressiva para Galerias Standalone

## Problema Identificado

Quando o fotógrafo cria uma galeria **sem integração com o Gestão** e configura **"Pacotes com descontos"** (precificação progressiva), as faixas de preço configuradas **não são aplicadas** em nenhum momento:

| Ponto de Falha | Descrição |
|----------------|-----------|
| **Cliente (seleção)** | O preço exibido usa apenas `gallery.extraPhotoPrice` fixo, ignorando as faixas |
| **Confirmação (Edge Function)** | O cálculo no `confirm-selection` também ignora as faixas para galerias sem `session_id` |
| **Fotógrafo (detalhes)** | O resumo financeiro mostra apenas o preço fixo |

### Causa Raiz

O sistema de precificação foi desenhado para usar `regrasCongeladas` (do Gestão), mas:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FLUXO ATUAL - DESCONECTADO                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GalleryCreate.tsx                    ClientGallery.tsx             │
│  ┌─────────────────────┐              ┌─────────────────────┐       │
│  │ discountPackages[] │              │ calcularPreco...    │       │
│  │ (salvo em          │     ✗        │ (só lê              │       │
│  │  configuracoes.    │ ──────────►  │  regrasCongeladas)  │       │
│  │  saleSettings)     │              │                     │       │
│  └─────────────────────┘              └─────────────────────┘       │
│                                                                     │
│  As faixas são SALVAS mas NUNCA LIDAS para precificação!           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Dados Salvos vs Dados Usados

| Campo | Onde é salvo | Onde é usado |
|-------|--------------|--------------|
| `saleSettings.discountPackages[]` | `galerias.configuracoes` | ❌ Nunca lido para cálculo |
| `saleSettings.pricingModel` = 'packages' | `galerias.configuracoes` | ❌ Ignorado |
| `regrasCongeladas.precificacaoFotoExtra.faixas[]` | `galerias.regras_congeladas` | ✅ Usado por `calcularPrecoProgressivoComCredito()` |

---

## Solução Proposta

### Estratégia: Transformar `discountPackages` em `regrasCongeladas`

Em vez de modificar a função `calcularPrecoProgressivoComCredito()` (que é usada em vários lugares e Edge Functions), vamos **gerar automaticamente** um objeto `regrasCongeladas` quando o fotógrafo configura faixas de desconto em modo standalone.

Isso mantém o sistema unificado:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FLUXO PROPOSTO - UNIFICADO                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GalleryCreate.tsx                    ClientGallery.tsx             │
│  ┌─────────────────────┐              ┌─────────────────────┐       │
│  │ discountPackages[] │              │ calcularPreco...    │       │
│  │     ↓               │              │ (lê                 │       │
│  │ buildRegras...()   │     ✓        │  regrasCongeladas)  │       │
│  │     ↓               │ ──────────►  │                     │       │
│  │ regrasCongeladas   │              │ ✓ Funciona!         │       │
│  └─────────────────────┘              └─────────────────────┘       │
│                                                                     │
│  Transforma faixas manuais para o formato padrão                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementação Detalhada

### 1. Criar Função de Transformação

**Arquivo:** `src/lib/pricingUtils.ts`

Adicionar função para converter `discountPackages` (formato standalone) para `RegrasCongeladas`:

```typescript
/**
 * Builds RegrasCongeladas from standalone discount packages
 * Used when photographer configures progressive pricing without Gestão integration
 */
export function buildRegrasFromDiscountPackages(
  discountPackages: DiscountPackage[],
  fixedPrice: number,
  includedPhotos: number,
  packageName?: string
): RegrasCongeladas {
  // If no packages or using fixed pricing, return simple fixed rules
  if (!discountPackages || discountPackages.length === 0) {
    return {
      modelo: 'fixo',
      pacote: {
        nome: packageName || 'Pacote Manual',
        fotosIncluidas: includedPhotos,
        valorFotoExtra: fixedPrice,
      },
      precificacaoFotoExtra: {
        modelo: 'fixo',
        valorFixo: fixedPrice,
      },
    };
  }

  // Transform discountPackages to faixas format
  const faixas: FaixaPreco[] = discountPackages.map(pkg => ({
    min: pkg.minPhotos,
    max: pkg.maxPhotos, // Already null for infinity
    valor: pkg.pricePerPhoto,
  }));

  return {
    modelo: 'global', // Use global model for standalone packages
    dataCongelamento: new Date().toISOString(),
    pacote: {
      nome: packageName || 'Pacote Manual',
      fotosIncluidas: includedPhotos,
      valorFotoExtra: fixedPrice, // Base price for savings calculation
    },
    precificacaoFotoExtra: {
      modelo: 'global',
      tabelaGlobal: {
        faixas,
      },
    },
  };
}
```

### 2. Atualizar GalleryCreate.tsx - Gerar regrasCongeladas ao Salvar

**Arquivo:** `src/pages/GalleryCreate.tsx`

Quando o fotógrafo usa `pricingModel === 'packages'`, gerar `regrasCongeladas` automaticamente:

Modificar a função `createSupabaseGalleryForUploads`:

```typescript
// Determine if we should generate regrasCongeladas from manual packages
const shouldBuildRegras = !regrasCongeladas && !isAssistedMode && 
                          saleMode !== 'no_sale' && 
                          pricingModel === 'packages' && 
                          discountPackages.length > 0;

const finalRegrasCongeladas = shouldBuildRegras 
  ? buildRegrasFromDiscountPackages(discountPackages, fixedPrice, includedPhotos, packageName)
  : (hasRegras ? regrasCongeladas : null);

const result = await createSupabaseGallery({
  // ... other fields
  regrasCongeladas: finalRegrasCongeladas,
});
```

Aplicar a mesma lógica em:
- `handleNext()` (step 5 - final update)
- `handleSaveDraft()`

### 3. Atualizar a Edge Function confirm-selection

**Arquivo:** `supabase/functions/confirm-selection/index.ts`

Quando não há `session_id`, verificar se existe `regrasCongeladas` na própria galeria:

```typescript
// 3. Calculate progressive pricing using CREDIT SYSTEM
let valorUnitario = 0;
let valorTotal = 0;

// Try to get regrasCongeladas: session first, then gallery itself
let regrasCongeladas: RegrasCongeladas | null = null;

if (gallery.session_id) {
  // Fetch from session (Gestão flow)
  const { data: sessao } = await supabase
    .from('clientes_sessoes')
    .select('regras_congeladas, valor_foto_extra')
    .eq('session_id', gallery.session_id)
    .single();
  
  if (sessao?.regras_congeladas) {
    regrasCongeladas = sessao.regras_congeladas as RegrasCongeladas;
  }
} 

// Fallback: check gallery's own regrasCongeladas (standalone mode)
if (!regrasCongeladas && gallery.regras_congeladas) {
  regrasCongeladas = gallery.regras_congeladas as RegrasCongeladas;
  console.log('📊 Using gallery regrasCongeladas (standalone mode)');
}

// Use the unified credit system formula
const resultado = calcularPrecoProgressivoComCredito(
  extrasACobrar,
  extrasPagasTotal,
  valorJaPago,
  regrasCongeladas, // Now includes standalone packages
  gallery.valor_foto_extra || 0
);
```

### 4. Atualizar gallery-access Edge Function

**Arquivo:** `supabase/functions/gallery-access/index.ts`

Garantir que `regrasCongeladas` da galeria é retornado mesmo sem session:

```typescript
// 4. Fetch pricing rules: session first, then gallery itself
let regrasCongeladas = gallery.regras_congeladas;

if (gallery.session_id) {
  const { data: sessao } = await supabase
    .from('clientes_sessoes')
    .select('regras_congeladas')
    .eq('session_id', gallery.session_id)
    .single();
  
  if (sessao?.regras_congeladas) {
    regrasCongeladas = sessao.regras_congeladas;
    console.log('📊 Loaded pricing rules from session:', gallery.session_id);
  }
}

// If still no regrasCongeladas, gallery's own is used (standalone mode)
if (!regrasCongeladas && gallery.regras_congeladas) {
  console.log('📊 Using gallery regrasCongeladas (standalone mode)');
  regrasCongeladas = gallery.regras_congeladas;
}
```

### 5. Importar Tipos Necessários

**Arquivo:** `src/pages/GalleryCreate.tsx`

Adicionar import da nova função:

```typescript
import { 
  RegrasCongeladas, 
  getModeloDisplayName, 
  getFaixasFromRegras, 
  formatFaixaDisplay,
  buildRegrasFromDiscountPackages 
} from '@/lib/pricingUtils';
```

**Arquivo:** `src/lib/pricingUtils.ts`

Adicionar import do tipo DiscountPackage:

```typescript
import { DiscountPackage } from '@/types/gallery';
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/lib/pricingUtils.ts` | Adicionar `buildRegrasFromDiscountPackages()` |
| `src/pages/GalleryCreate.tsx` | Chamar a nova função ao criar/atualizar galeria standalone |
| `supabase/functions/confirm-selection/index.ts` | Fallback para `gallery.regras_congeladas` |
| `supabase/functions/gallery-access/index.ts` | Garantir que retorna `regras_congeladas` da galeria |

---

## Fluxo Resultante

### Criação (Standalone)

```text
1. Fotógrafo configura faixas: [1-2: R$20], [3-5: R$15], [6+: R$10]
2. GalleryCreate chama buildRegrasFromDiscountPackages()
3. Gera regrasCongeladas = {
     modelo: 'global',
     pacote: { valorFotoExtra: 25, fotosIncluidas: 30 },
     precificacaoFotoExtra: {
       modelo: 'global',
       tabelaGlobal: { faixas: [...] }
     }
   }
4. Salva em galerias.regras_congeladas
```

### Seleção do Cliente

```text
1. gallery-access retorna regrasCongeladas (da galeria)
2. ClientGallery usa calcularPrecoProgressivoComCredito()
3. Cliente vê preços progressivos corretos
```

### Confirmação

```text
1. confirm-selection busca regrasCongeladas da galeria
2. Aplica precificação progressiva no valor final
3. Cria cobrança com valor correto
```

---

## Testes a Realizar

1. **Criar galeria standalone com faixas de desconto**
   - Configurar 3 faixas: [1-2: R$20], [3-5: R$15], [6+: R$10]
   - Verificar se `regras_congeladas` é salvo no banco

2. **Acessar como cliente**
   - Selecionar 4 fotos extras
   - Verificar se preço exibido é R$15/foto (não R$25)

3. **Confirmar seleção**
   - Verificar se o valor cobrado respeita a faixa

4. **Testar modo Gestão (não quebrar)**
   - Criar galeria via Gestão com regras congeladas
   - Verificar se continua funcionando normalmente

