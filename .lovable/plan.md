

# Melhorias em Galerias Transfer: Reativação Rápida + Calendário

## Problema 1: Sem botão de reativar em Transfer

Galerias Select possuem o componente `ReactivateGalleryDialog` no card e na página de detalhe. Galerias Transfer não têm nenhum atalho — o usuário precisa navegar até Detalhes > Data de expiração e selecionar manualmente uma nova data.

## Problema 2: Calendário confuso

O `day_today` usa `bg-accent` e o `day_selected` usa `bg-primary`. Como ambas as cores são variações de marrom (`--accent: 19 49% 45%`, `--primary: 19 49% 45%`), o dia atual e o dia selecionado ficam praticamente iguais.

## Solução

### 1. Botão de reativar no `DeliverGalleryCard` (card na listagem)

- Adicionar prop `onReactivate` ao componente
- Quando a galeria está expirada, mostrar opção "Reativar" no dropdown menu (mesmo padrão do `GalleryCard` de Select)

### 2. Botão de reativar no `DeliverDetail` (página de detalhe)

- Quando a galeria está expirada, exibir um banner/botão proeminente no header (ao lado de "Salvar" e "Excluir") com ícone `RotateCcw` e texto "Reativar"
- Ao clicar, abre o `ReactivateGalleryDialog` existente, que define novo prazo em dias
- O `onReactivate` calcula a nova data de expiração e salva via `updateGallery`

### 3. Calendário — diferenciar "hoje" de "selecionado"

- No `calendar.tsx`, alterar `day_today` de `bg-accent text-accent-foreground` para um estilo com apenas borda/outline, sem preenchimento:
  ```
  day_today: "border border-primary text-foreground"
  ```
- Assim o dia atual fica com anel/borda e o selecionado com fundo sólido — visualmente distintos

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/ui/calendar.tsx` | `day_today` → borda em vez de fundo preenchido |
| `src/components/DeliverGalleryCard.tsx` | Adicionar `onReactivate` prop + item no dropdown |
| `src/pages/DeliverDetail.tsx` | Botão "Reativar" no header para galerias expiradas usando `ReactivateGalleryDialog` |
| `src/pages/Dashboard.tsx` (ou onde os cards Transfer são renderizados) | Passar `onReactivate` para `DeliverGalleryCard` |

## Detalhes técnicos

- A reativação em Transfer = atualizar `prazo_selecao` para `now() + N dias` via `updateGallery`, mesmo mecanismo que alterar a data de expiração manualmente
- O `ReactivateGalleryDialog` já existente será reutilizado com as props corretas
- O status da galeria pode precisar ser atualizado de `expirado` para `publicada` ao reativar — verificar se o `updateGallery` já faz isso ou se precisa incluir `status: 'enviado'`

