## Problema

Após a refatoração SSoT (1 sessão = 1 galeria), o campo **"Fotos Incluídas"** em `GalleryEdit` ficou **bloqueado** para galerias vinculadas ao Lunari Studio (`isLunariLinked`). Isso quebrou um fluxo legítimo: o fotógrafo precisa poder ajustar quantas fotos estão incluídas (ex.: deu uma foto de cortesia, esqueceu de contar, cliente negociou +1) — sem isso, o cliente é cobrado indevidamente como "extra".

## Decisão de arquitetura

Aplicar exatamente a **mesma lógica que já vale para `valor_foto_extra`**:

- A sessão continua sendo SSoT.
- Editar "Fotos Incluídas" na galeria é permitido e **propaga para a sessão** (`regras_congeladas.pacote.fotosIncluidas` em `clientes_sessoes`).
- Edição bloqueada **apenas** quando `isBillingLocked` (galeria finalizada / seleção concluída) — comportamento já existente.
- Mantém a trava de segurança: não pode reduzir abaixo de `(fotos_selecionadas − total_fotos_extras_vendidas)`.

## Mudanças

### 1. UI — `src/pages/GalleryEdit.tsx`
- Remover `isLunariLinked` do `disabled` do input "Fotos Incluídas". Manter apenas `isBillingLocked`.
- Substituir o helper text "Definido na sessão do Lunari Studio." por:
  > "Compartilhado com a sessão do Lunari Studio. Alterações refletem na sessão."
- Manter a mensagem de erro do mínimo permitido.

### 2. Hook — `src/hooks/useSupabaseGalleries.ts` (`updateGalleryMutation`)

Quando `data.fotosIncluidas !== undefined` **e** existe `sessionId`:
- Ler `regras_congeladas` atual da `clientes_sessoes` (não da galeria — sessão é SSoT).
- Fazer patch idempotente em `regras_congeladas.pacote.fotosIncluidas` com o novo valor (clamp 0–9999).
- Atualizar `clientes_sessoes.regras_congeladas` + `updated_at`.
- O espelho em `galerias.fotos_incluidas` continua sendo escrito (já existe).
- Audit log já cobre o `before/after` de `fotos_incluidas`.

### 3. Banco — Migration (trigger de simetria)

Criar trigger `sync_session_included_photos_to_frozen` em `clientes_sessoes` (espelho do já existente `sync_session_extra_price_to_frozen`), para o caso de edição vinda do Studio:
- Quando algum campo "fotos incluídas no pacote" da sessão mudar, faz `jsonb_set` em `regras_congeladas.pacote.fotosIncluidas`.
- Garante que ambos os lados (Studio ↔ Gallery) mantenham o JSON consistente.

> Observação: a sessão **não** tem coluna escalar `fotos_incluidas` própria — o valor canônico mora em `regras_congeladas.pacote.fotosIncluidas`. Por isso a propagação Gallery→Studio é feita via patch direto no JSONB pelo hook, sem necessidade de coluna nova.

### 4. Edge Functions — sem alteração

`gallery-access` e `confirm-selection` já leem `fotos_incluidas` da galeria como espelho operacional, e `regras_congeladas.pacote.fotosIncluidas` da sessão como SSoT na hora de renovar/recongelar. Como o hook escreve nos dois lugares, nada quebra.

## Validação pós-implementação

1. Galeria vinculada ao Studio, não finalizada → input editável, salva 8 (era 10).
2. Conferir `clientes_sessoes.regras_congeladas->'pacote'->>'fotosIncluidas'` = `8`.
3. Cliente seleciona 9 fotos → cobrança gera 1 extra (não 0, não 2).
4. Tentar reduzir abaixo de extras já vendidas → toast de erro, salvamento bloqueado.
5. Galeria finalizada → input continua bloqueado.