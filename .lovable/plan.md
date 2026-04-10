

# Fix: Dashboard mostrando 0 créditos

## Problema

O Dashboard usa o hook `useGalleryCredits` que lê a coluna `gallery_credits` da tabela `photographer_accounts`. Já a página de Planos e Créditos usa o hook `usePhotoCredits` que lê `photo_credits + credits_subscription` — que é o saldo real (5.430 no caso).

São colunas diferentes: `gallery_credits` está zerada/desatualizada, enquanto `photo_credits` e `credits_subscription` contêm os valores corretos.

## Solução

Substituir `useGalleryCredits` por `usePhotoCredits` no Dashboard (`src/pages/Home.tsx`), garantindo que o valor exibido seja `photoCredits` (soma de avulsos + assinatura), igual à página de créditos.

## Mudança

| Arquivo | O que muda |
|---|---|
| `src/pages/Home.tsx` | Trocar `useGalleryCredits` por `usePhotoCredits`; usar `photoCredits` no lugar de `credits` |

Alteração de ~3 linhas. Nenhuma migração ou Edge Function necessária.

