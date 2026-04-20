
# Plano: Ajustar lista de fotos selecionadas com thumbnails maiores e indicadores mais limpos

## Objetivo

Refinar o resumo visual da etapa **Confirmar Seleção** para ficar mais próximo do esboço desejado:

- Fotos um pouco maiores.
- Favoritas indicadas apenas por um coração.
- Comentário exibido como texto, sem badge.
- Extras não aparecem como badge na lista de fotos.
- O resumo financeiro da direita continua mostrando extras e valores normalmente.

## Mudanças em `src/components/SelectionConfirmation.tsx`

### 1. Aumentar o tamanho das fotos

Hoje o thumbnail está em:

```tsx
h-24 w-24 md:h-28 md:w-28
```

Será ajustado para algo mais confortável, sem virar preview gigante:

```tsx
h-28 w-28 md:h-32 md:w-32
```

Resultado:

- A foto fica mais legível.
- O card continua compacto.
- Fotos verticais e horizontais continuam dentro de uma caixa previsível com `object-contain`.

### 2. Remover badges dentro do card

Remover do card:

- Badge “Favorita”.
- Badge “Comentário”.
- Badge “+N extra”.

O card passará a ter uma leitura mais limpa:

```text
┌────────────┐  Nome da foto                         ♥
│            │  "Comentário do cliente, se existir"
│    foto    │
│            │
└────────────┘
```

### 3. Mostrar favorita apenas com coração

Quando `photo.isFavorite` for verdadeiro:

- Mostrar somente o ícone `Heart`.
- Sem fundo de badge.
- Sem texto “Favorita”.
- O coração ficará ao lado do nome ou no canto superior direito da área textual.
- Usar preenchimento vermelho/terracotta para ficar claro visualmente.

Exemplo técnico:

```tsx
<div className="flex items-start justify-between gap-2">
  <p className="truncate text-sm font-medium">{displayName}</p>

  {photo.isFavorite && (
    <Heart className="h-4 w-4 shrink-0 fill-destructive text-destructive" />
  )}
</div>
```

### 4. Manter comentário como texto

O comentário continua aparecendo abaixo do nome, mas sem badge:

```tsx
{photo.comment && (
  <p className="line-clamp-2 text-xs italic text-muted-foreground">
    "{photo.comment}"
  </p>
)}
```

Isso preserva a informação importante sem poluir o card.

### 5. Remover lógica visual de extras da lista

Como o usuário não quer badge de extra no card:

- Remover `extraIndex` de `SelectedPhotoCardProps`.
- Remover o cálculo `extraIndex` no map da lista.
- Remover qualquer renderização de `+1 extra`, `+2 extra`, etc. dentro da lista visual.

A contagem de extras permanece no resumo “Sua seleção” à direita, onde faz sentido financeiro.

### 6. Limpar imports

Como não haverá mais badges no card:

- Remover import de `Badge` se não for usado em outro ponto do arquivo.
- Manter `Heart`, `MessageSquare` e `ImageOff` se ainda forem usados no contador superior e fallback visual.
- Se o contador de comentários continuar usando `MessageSquare`, manter o import.

## Comportamento esperado

### Desktop

- Lista visual à esquerda com fotos maiores e mais fáceis de revisar.
- Coração aparece de forma discreta nas favoritas.
- Comentários continuam visíveis como texto.
- Sem badges de comentário e sem badges de extra.
- Resumo financeiro à direita continua com selecionadas, incluídas, extras, valor por foto e total.

### Mobile

- Layout continua empilhado.
- Cards continuam horizontais e compactos.
- Fotos ficam um pouco maiores, mas sem prejudicar a rolagem.
- Botão fixo no rodapé permanece igual.

## Não alterar

- Cálculo de extras.
- Cálculo de valor.
- Lógica de pagamento.
- Confirmação da seleção.
- Backend, Edge Functions, RPCs ou banco de dados.
- Integrações InfinitePay, Asaas ou Mercado Pago.

## Resultado final

A tela fica mais limpa e focada na revisão:

- Foto maior.
- Nome claro.
- Comentário legível.
- Favorita marcada só com coração.
- Sem poluição visual por badges de comentário ou extra.
