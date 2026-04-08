

# Fix: Validação de seleção mínima + limpeza de código morto

## Problema 1 — Sem validação de fotos mínimas

Atualmente, o cliente pode confirmar a seleção com 0 fotos ou menos fotos do que o pacote incluído (ex: pacote de 30, seleciona 5). Não existe nenhum bloqueio ou aviso — nem no frontend nem no backend.

**Comportamento desejado**: ao clicar em "Confirmar Seleção" com menos fotos do que `includedPhotos`, exibir um dialog elegante informando que o pacote inclui X fotos mas apenas Y foram selecionadas, perguntando se deseja prosseguir mesmo assim. Se o cliente confirmar, a seleção prossegue normalmente.

## Problema 2 — Código morto

Encontrei os seguintes itens obsoletos:

| Item | Localização | Status |
|---|---|---|
| `calculatePhotoPrice()` | `src/hooks/useGalleries.ts` | Nunca importada — 100% dead code |
| `useGalleries.ts` inteiro | `src/hooks/useGalleries.ts` | Arquivo inteiro é dead code (sem imports) |

## Solução

### 1. Dialog de confirmação de seleção mínima (frontend)

Em `src/pages/ClientGallery.tsx`, na função `handleStartConfirmation`:

```
Se selectedCount < gallery.includedPhotos E selectedCount > 0:
  → Abre AlertDialog com mensagem:
    "Seu pacote inclui {includedPhotos} fotos, mas você selecionou apenas {selectedCount}."
    "As fotos não selecionadas não poderão ser recuperadas depois."
    "Deseja confirmar mesmo assim?"
  → Botão "Sim, confirmar" → prossegue para step 'confirmation'
  → Botão "Voltar e selecionar mais" → fecha dialog

Se selectedCount === 0:
  → Toast de erro: "Selecione pelo menos uma foto para confirmar"
  → Não avança
```

O dialog usará `AlertDialog` do shadcn/ui (já existe no projeto), com estilo consistente ao sistema.

### 2. Validação no backend (segurança)

Em `supabase/functions/confirm-selection/index.ts`, após contar `selectedCount` no servidor (linha ~236):

```
Se selectedCount === 0:
  → rollback + retorna erro 400: "Nenhuma foto selecionada"
```

Não bloqueia seleção menor que `includedPhotos` no backend (apenas aviso no frontend), porque o fotógrafo pode ter combinado isso com o cliente.

### 3. Remoção de código morto

Deletar `src/hooks/useGalleries.ts` — arquivo inteiro não é importado em lugar nenhum.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientGallery.tsx` | Adicionar state + AlertDialog para seleção mínima, e check de 0 fotos |
| `supabase/functions/confirm-selection/index.ts` | Rejeitar `selectedCount === 0` com erro 400 |
| `src/hooks/useGalleries.ts` | Deletar arquivo |

