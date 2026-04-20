

# Plano: Resumo visual de seleção na tela de confirmação

## Objetivo

Adicionar uma grade com as fotos selecionadas (thumbnail + nome + favorito + comentário) ao lado do resumo descritivo na etapa **Confirmar Seleção**, para o cliente revisar visualmente antes de fechar.

## Layout

### Desktop (≥1024px) — duas colunas
```text
┌──────────────────────────────────────────────────────────┐
│  Header: ← Voltar    Confirmar Seleção                   │
├───────────────────────────────┬──────────────────────────┤
│                               │                          │
│  RESUMO DA SELEÇÃO            │  SUA SELEÇÃO (descritivo)│
│  (grid 2 col de fotos         │  • Selecionadas: 12      │
│   com scroll interno)         │  • Incluídas: 10         │
│  ┌─────┐ ┌─────┐              │  • Extras: 2             │
│  │ ♥   │ │     │              │  • Valor: R$ 50,00       │
│  │ IMG │ │ IMG │              │                          │
│  │nome │ │nome │              │  Total adicional R$ 50   │
│  │💬…  │ │     │              │                          │
│  └─────┘ └─────┘              │  Pagamento online…       │
│  ┌─────┐ ┌─────┐              │  Não será possível…      │
│  │ ... │ │ ... │              │                          │
│                               │                          │
├───────────────────────────────┴──────────────────────────┤
│         [ ✓ Confirmar e Pagar ]   (centralizado)         │
└──────────────────────────────────────────────────────────┘
```
Proporção `lg:grid-cols-[1.1fr_1fr]` — fotos com leve prioridade de espaço. Cada coluna tem scroll independente (`overflow-y-auto`), header e footer ficam fixos.

### Mobile (<1024px) — empilhado
```text
┌──────────────────────────┐
│ Header                   │
├──────────────────────────┤
│ SUA SELEÇÃO (descritivo) │  ← primeiro o resumo (decisão)
│ • valores e total        │
├──────────────────────────┤
│ RESUMO DA SELEÇÃO        │  ← depois a grade visual
│ ┌────┐ ┌────┐            │
│ │IMG │ │IMG │ ...        │
│ └────┘ └────┘            │
├──────────────────────────┤
│ [ ✓ Confirmar e Pagar ]  │  (sticky bottom)
└──────────────────────────┘
```
Página rolável de cima para baixo (uma coluna, sem scroll aninhado). Botão fixo no rodapé como hoje.

## Cartão de foto (componente novo, inline em `SelectionConfirmation.tsx`)

Cada foto selecionada vira um mini-card:

- Miniatura quadrada `aspect-square object-cover` usando `photo.previewUrl`.
- **Nome de exibição**: `photo.displayName || photo.originalFilename || photo.filename` (truncado com `line-clamp-1`).
- **Badge favorito**: ícone `Heart` preenchido vermelho/rosa no canto superior direito quando `photo.isFavorite`.
- **Comentário**: ícone `MessageSquare` + texto truncado em 2 linhas (`line-clamp-2`) quando `photo.comment`. Hover/tap mostra tooltip com o texto completo.
- **Indicador "extra"**: pequena pílula no canto inferior esquerdo (`+1`, `+2`…) nas fotos que excedem `includedPhotos`. Usa `photo.order` ou ordem da lista de selecionadas para numerar a partir de `includedPhotos + 1`.

Grid:
- Desktop: `grid-cols-2 gap-3`.
- Mobile: `grid-cols-3 gap-2` (mais compacto, foco em "passar o olho").

Cabeçalho da seção: `"Suas fotos (N)"` com contadores secundários: `N favoritas`, `N com comentário` (quando > 0).

## Tratamento de casos

| Caso | Comportamento |
|---|---|
| Nenhuma foto selecionada | Não entra nessa tela (botão de confirmar já é bloqueado antes). |
| Lista grande (50+) | Scroll interno na coluna desktop; mobile usa scroll natural da página. |
| Carregamento de imagem falha | Fallback `bg-muted` + ícone `ImageOff` (mesmo padrão do `PhotoCard`). |
| Sem comentário e sem favorito | Card mostra só thumb + nome — visual limpo. |

## Ajustes técnicos

### `src/components/SelectionConfirmation.tsx`
- Filtrar `photos.filter(p => p.isSelected)` e ordenar por `order`.
- Adicionar grid responsivo: `lg:grid-cols-[1.1fr_1fr] lg:gap-8` no `<main>`, com `max-w-6xl` em vez de `max-w-lg`.
- Em mobile (`<lg`) manter empilhado em coluna única, resumo descritivo primeiro, grade depois.
- Criar helper local `SelectedPhotoCard` (componente interno do arquivo) — evita novo arquivo para algo específico desta tela.
- Ícones reaproveitados de `lucide-react`: `Heart`, `MessageSquare`, `ImageOff` (já no projeto).
- Aplicar `useImageProtection` hook? **Não** — esta tela é pós-seleção interna; manter consistência com o `PhotoCard` da galeria não é necessário aqui (já está protegido na grid principal). Apenas `select-none` + `draggable={false}` no `<img>`.

### Bottom action bar
- Centralizar conteúdo: `max-w-6xl mx-auto` no wrapper interno; o botão continua `w-full` em mobile e `lg:max-w-md lg:mx-auto` em desktop para não ocupar largura excessiva.

### Sem mudanças em
- `ClientGallery.tsx` (já passa `photos={localPhotos}` — só precisamos usar).
- Tipos, hooks, ou backend.

## Resultado esperado

- Cliente vê na mesma tela **o que está confirmando** (grade visual com favoritas e comentários) e **quanto vai pagar** (resumo numérico).
- Desktop aproveita o espaço horizontal sem rolagem dupla incômoda; mobile mantém leitura vertical natural com botão sticky.
- Reduz risco de confirmação por engano (usuário identifica fotos erradas/comentários esquecidos antes de fechar).
- Zero impacto em backend, fluxo de pagamento ou contagem de extras.

