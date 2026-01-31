
# Correção: Valores Zerados no GalleryDetail e "0" Solto

## Problemas Identificados

### Problema 1: "0" Misterioso no Resumo da Seleção
Na linha 174 de `SelectionSummary.tsx`:
```typescript
{economia && economia > 0 && (...)}
```
Quando `economia = 0`, o operador `&&` em JavaScript retorna `0` (falsy value), e React renderiza esse `0` como texto na tela. Este é um bug clássico de React.

### Problema 2: "Valor adicional: R$ 0.00" na Mensagem
Na linha 190, a mensagem sempre mostra `displayTotal`:
```typescript
`Cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}. Valor adicional: R$ ${displayTotal.toFixed(2)}`
```
Quando todas as extras já foram pagas (`extrasACobrar = 0`), `displayTotal = 0`. A mensagem deveria mostrar o valor total já pago, não o valor a pagar.

### Problema 3: "Valor foto extra: R$ 0.00" na Aba Detalhes
Na linha 692 de `GalleryDetail.tsx`:
```typescript
R$ {supabaseGallery.valorFotoExtra.toFixed(2)}
```
O campo `valor_foto_extra` no banco está zerado porque a galeria usa precificação progressiva (modelo categoria). Deveria usar o `valorUnitario` calculado.

### Dados do Banco (Galeria "Teste"):
- `valor_foto_extra: 0` (campo DB, incorreto para exibição)
- `valor_total_vendido: 12` (R$ 12,00 já pagos)
- `total_fotos_extras_vendidas: 4` (4 fotos extras pagas)
- Tabela de preços: [1-2: R$5, 3-4: R$3, 5+: R$2]
- Preço médio pago: 12 / 4 = R$ 3,00

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/SelectionSummary.tsx` | 1. Corrigir condição de `economia` para não renderizar "0"<br>2. Mostrar valor já pago na mensagem quando `displayTotal = 0` |
| `src/pages/GalleryDetail.tsx` | Usar `valorUnitario` calculado em vez do valor zerado do banco |

## Mudanças Detalhadas

### 1. SelectionSummary.tsx - Linha 174

Corrigir a condição para usar comparação explícita:

```typescript
// ANTES:
{economia && economia > 0 && (

// DEPOIS:
{economia !== undefined && economia > 0 && (
```

### 2. SelectionSummary.tsx - Linhas 184-193

Ajustar a mensagem para mostrar o valor correto baseado no contexto:

```typescript
// ANTES:
{isOverLimit && gallery.settings.allowExtraPhotos && (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
    <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
    <p className="text-primary">
      {isClient 
        ? `Você selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} além do pacote. O valor adicional será cobrado posteriormente.`
        : `Cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}. Valor adicional: R$ ${displayTotal.toFixed(2)}`
      }
    </p>
  </div>
)}

// DEPOIS:
{isOverLimit && gallery.settings.allowExtraPhotos && (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
    <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
    <p className="text-primary">
      {isClient 
        ? `Você selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} além do pacote. O valor adicional será cobrado posteriormente.`
        : displayTotal > 0
          ? `Cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}. Valor adicional: R$ ${displayTotal.toFixed(2)}`
          : `Cliente selecionou ${extraCount} foto${extraCount > 1 ? 's' : ''} extra${extraCount > 1 ? 's' : ''}. Valor já pago: R$ ${valorJaPago.toFixed(2)}`
      }
    </p>
  </div>
)}
```

### 3. GalleryDetail.tsx - Linhas 690-693

Substituir o valor zerado do banco pelo valor calculado:

```typescript
// ANTES:
<div className="flex justify-between">
  <span className="text-muted-foreground">Valor foto extra</span>
  <span className="font-medium">R$ {supabaseGallery.valorFotoExtra.toFixed(2)}</span>
</div>

// DEPOIS:
<div className="flex justify-between">
  <span className="text-muted-foreground">Valor foto extra</span>
  <span className="font-medium">R$ {valorUnitario.toFixed(2)}</span>
</div>
```

Nota: O `valorUnitario` já é calculado na linha 351 usando `calcularPrecoProgressivoComCredito` e está disponível no escopo.

## Resultado Esperado

| Local | Antes | Depois |
|-------|-------|--------|
| Resumo - abaixo de "Valor a pagar" | "0" solto | Nada (removido) |
| Resumo - mensagem amarela | "Valor adicional: R$ 0.00" | "Valor já pago: R$ 12.00" |
| Detalhes - "Valor foto extra" | R$ 0.00 | R$ 3.00 (média paga) |

## Fluxo de Valores Corrigido

```text
Galeria "Teste":
├── valor_foto_extra (banco) = 0 (ignorado para exibição)
├── valorTotalVendido (banco) = 12
├── totalFotosExtrasVendidas (banco) = 4
│
└── calcularPrecoProgressivoComCredito():
    ├── extrasNovas = 0 (nada novo a cobrar)
    ├── extrasPagasTotal = 4
    ├── valorJaPago = 12
    │
    └── Retorna:
        ├── valorUnitario = 12 / 4 = R$ 3.00 ← Exibido em Detalhes
        ├── valorACobrar = 0 ← "Valor a pagar"
        ├── valorTotalIdeal = 12
        └── economia = 0 ← NÃO renderiza o "0"
```
