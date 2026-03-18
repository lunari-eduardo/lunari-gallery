

# Redesign do GalleryCard + Reativar no Menu + Badge de Pagamento

## Mudanças

### 1. Redesign do GalleryCard (visual como imagem 3)

**Arquivo**: `src/components/GalleryCard.tsx`

- Thumbnail: mudar de `w-[72px]` colado na borda para formato **1:1 com margem** (padding interno no card, thumbnail com `aspect-square rounded-lg` ~80px)
- Remover a seção "Valor adicional" (`extraTotal`) e substituir por um **badge de status de pagamento** quando aplicável
- Badge de pagamento: mostrar status como `Pendente`, `Pago`, `Aguardando` com cores distintas (amarelo, verde, etc.)

### 2. Adicionar `statusPagamento` ao GalleryCard

**Arquivo**: `src/types/gallery.ts`  
- Não precisa alterar o tipo `Gallery` — vamos passar `statusPagamento` como prop direta

**Arquivo**: `src/components/GalleryCard.tsx`  
- Adicionar prop `paymentStatus?: string | null` na interface
- Renderizar badge de pagamento no lugar do "Valor adicional"

**Arquivo**: `src/pages/Dashboard.tsx`  
- Na chamada `<GalleryCard>`, passar `paymentStatus` a partir do `Galeria.statusPagamento` (acessível via `supabaseGalleries`)

### 3. Opção "Reativar" no menu de três pontinhos

**Arquivo**: `src/components/GalleryCard.tsx`  
- Adicionar prop `onReactivate?: () => void`
- Adicionar item `<DropdownMenuItem>` com ícone `RotateCcw` e texto "Reativar" (visível apenas quando `onReactivate` é fornecido)

**Arquivo**: `src/pages/Dashboard.tsx`  
- Importar `ReactivateGalleryDialog` e gerenciar estado `reactivateGalleryId`
- Passar `onReactivate` para `GalleryCard` quando galeria for `selection_completed` ou `expired`
- Renderizar `ReactivateGalleryDialog` como modal externo (fora do card), controlado pelo estado
- Usar `reopenSelection` do hook `useSupabaseGalleries`

### 4. Mapeamento do badge de pagamento

| `status_pagamento` | Label | Cor |
|---|---|---|
| `pago` | Pago | Verde |
| `pendente` / `aguardando_pagamento` / `aguardando_confirmacao` | Pendente | Amarelo |
| `sem_vendas` / `null` | (não mostra) | — |

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/GalleryCard.tsx` | Redesign visual (thumb 1:1 com margem, badge pagamento, menu reativar) |
| `src/pages/Dashboard.tsx` | Passar `paymentStatus` e `onReactivate`, renderizar `ReactivateGalleryDialog` |

