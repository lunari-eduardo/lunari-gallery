

# Plano: Ajustar o resumo visual para ser uma lista compacta de seleção, não uma exibição gigante das fotos

## Diagnóstico

A implementação atual ficou com comportamento de “preview grande”:

- Cada foto ocupa toda a largura da coluna esquerda (`lg:max-w-[480px]`).
- Fotos verticais ficam enormes e empurram o restante da lista para baixo.
- O resumo visual deixou de parecer um **resumo de seleção** e virou uma galeria ampliada.
- No desktop, o cliente vê praticamente só uma foto grande, quando deveria conseguir revisar várias seleções rapidamente.

Pelo esboço, o ideal é:

```text
┌───────────────────────────────┬───────────────────────────────┐
│ Resumo de seleção             │ Sua seleção                   │
│                               │                               │
│ ┌──────┐  nome                │ Selecionadas              2   │
│ │ foto │  comentário          │ Incluídas no pacote       1   │
│ └──────┘  coração/favorita    │ Extras                    1   │
│                               │ Valor por foto      R$ 25,00  │
│ ┌──────┐  nome                │                               │
│ │ foto │  comentário          │ Total adicional     R$ 25,00  │
│ └──────┘                      │                               │
│                               │ Pagamento online após...      │
│ ┌──────┐  nome                │ Não será possível alterar...  │
│ │ foto │  comentário          │                               │
│ └──────┘                      │                               │
└───────────────────────────────┴───────────────────────────────┘
                         [ Confirmar e Pagar ]
```

Ou seja: uma **lista vertical compacta**, com thumbnail + informações ao lado.

## Mudança principal

Transformar o `SelectedPhotoCard` de uma foto grande em um **item de lista horizontal**.

### Antes

```text
┌──────────────────────────────┐
│                              │
│        FOTO GIGANTE          │
│                              │
└──────────────────────────────┘
nome
comentário
```

### Depois

```text
┌──────────┐  Nome da foto
│          │  Comentário do cliente
│  FOTO    │
│          │  ♥ Favorita    +1 extra
└──────────┘
```

## Ajustes de UI/UX

### Desktop

- A tela continua dividida em duas colunas.
- Coluna esquerda: lista de fotos selecionadas.
- Coluna direita: resumo financeiro/descritivo.
- A lista de fotos terá scroll próprio quando houver muitas imagens.
- O resumo da direita continua sticky.
- O botão de confirmação continua no rodapé, centralizado e sem ocupar largura excessiva.

### Mobile

- O resumo financeiro continua aparecendo primeiro.
- Depois vem a lista compacta de fotos.
- Nada de fotos gigantes: os cards também serão horizontais e compactos no mobile.
- A página usa rolagem natural, com o botão fixo no rodapé.

## Como o card de foto deve funcionar

### Thumbnail

- Usar um contêiner fixo e previsível, por exemplo:
  - Mobile: `w-24`
  - Desktop: `w-28` ou `w-32`
- Altura limitada para evitar cards muito altos.
- A imagem deve aparecer inteira, sem corte:
  - `object-contain`
  - `bg-muted`
- Fotos verticais e horizontais ficam dentro do mesmo espaço visual, mantendo proporção original sem distorcer.

### Informações ao lado

Exibir em coluna:

1. Nome da foto:
   - `photo.displayName || photo.originalFilename || photo.filename`
   - truncado se for muito longo.

2. Comentário:
   - se existir, mostrar o texto diretamente.
   - limitar em 2 linhas.
   - manter tooltip ou title para leitura completa.

3. Favorita:
   - se `photo.isFavorite`, mostrar ícone de coração + texto “Favorita”.
   - Isso fica mais claro do que só um coração flutuante no canto da imagem.

4. Extra:
   - se for foto acima do pacote, mostrar `+1 extra`, `+2 extra`, etc.
   - Usar badge discreto em `primary`.

## Alterações técnicas

### Arquivo

`src/components/SelectionConfirmation.tsx`

### 1. Ajustar `SelectedPhotoCard`

Trocar estrutura atual:

```tsx
<div className="group relative flex flex-col gap-2">
  <div className="relative w-full ..." style={{ aspectRatio }}>
    <img className="h-full w-full object-contain" />
  </div>
  <div>nome/comentário</div>
</div>
```

Por estrutura horizontal:

```tsx
<div className="group flex gap-3 rounded-lg border border-border/20 bg-card/40 p-2">
  <div className="relative shrink-0 w-24 md:w-28 rounded-md bg-muted overflow-hidden">
    <img className="h-full w-full object-contain" />
  </div>

  <div className="min-w-0 flex-1">
    <p>nome</p>
    <p>comentário</p>

    <div>
      favorita
      extra
    </div>
  </div>
</div>
```

### 2. Remover o uso de aspect ratio como altura total do card

O `aspectRatio` atual é o que faz a imagem vertical ficar enorme.

Em vez disso:

- Manter a proporção dentro de uma caixa compacta.
- Não deixar o aspect ratio determinar a altura inteira da tela.
- Usar `object-contain` para respeitar a imagem sem recortar.

### 3. Ajustar a coluna esquerda

Trocar:

```tsx
lg:max-w-[480px] lg:mx-auto
```

Por uma largura mais natural para lista:

```tsx
lg:max-w-[520px]
```

Sem centralizar demais, para ficar alinhado ao título “Suas fotos”.

### 4. Ajustar título da seção

Trocar “Suas fotos” por “Resumo de seleção” para bater com a intenção do fluxo.

Exemplo:

```text
Resumo de seleção (4)
♥ 1 favorita   💬 1 com comentário
```

### 5. Melhorar espaçamento entre colunas

Ajustar o grid desktop para a divisão ficar mais próxima do esboço:

```tsx
lg:grid-cols-[minmax(420px,520px)_minmax(360px,460px)]
lg:justify-center
lg:gap-16
```

Isso evita que a tela fique espalhada demais em monitores largos.

### 6. Manter fluxo e regras existentes

Não alterar:

- cálculo de extras;
- cálculo de valor;
- lógica de pagamento;
- `onConfirm`;
- `onBack`;
- dados vindos de `photos`;
- backend;
- Edge Functions;
- RPCs;
- integrações InfinitePay, Asaas ou Mercado Pago.

## Resultado esperado

- A esquerda vira um resumo visual rápido e escaneável.
- O cliente consegue ver várias fotos selecionadas ao mesmo tempo.
- Nome, comentário, favorito e extra ficam claros.
- Fotos verticais e horizontais não são cortadas, mas também não ficam gigantes.
- A direita continua focada na decisão: quantidade, extras, valor e confirmação.
- A experiência fica mais próxima do esboço: lista de seleção à esquerda, resumo financeiro à direita e botão centralizado no rodapé.

