## Objetivo

Permitir que o fotógrafo **edite `fotosIncluidas` e `valorFotoExtra`** em galerias vinculadas ao **Lunari Studio**, sobrescrevendo regras congeladas localmente, sem quebrar pagamentos já realizados nem cobrar fotos extras já pagas em caso de reativação.

---

## Regras de quando a edição é permitida

| Status da galeria | Pode editar valor extra / fotos incluídas? |
|---|---|
| Criada (rascunho) | ✅ Sim |
| Enviada / em seleção | ✅ Sim |
| Seleção concluída / paga / finalizada | ❌ Não — bloqueada |
| Reativada (após conclusão) | ✅ Sim |
| Expirada | ❌ Não (precisa reativar primeiro) |

A flag `isBillingLocked` (atual: `statusSelecao === 'selecao_completa' || finalizedAt != null`) já cobre isso. A reativação limpa `finalized_at`, então liberar = manter a regra atual.

**Validação extra**: bloquear redução de `fotosIncluidas` para um valor **menor** que `total_fotos_extras_vendidas + fotos_incluidas_originais_já_pagas` (ou seja, abaixo do que já foi cobrado). Mostrar erro inline e impedir o save.

---

## Diagnóstico do que precisa mudar

1. **UI (`GalleryEdit.tsx`)** — campos já existem e já respeitam `isBillingLocked`. Falta:
   - Banner contextual quando galeria veio do Lunari Studio (`gallery.sessionId != null`).
   - AlertDialog de confirmação antes de salvar quando o usuário alterar `valorFotoExtra` em galeria com **desconto progressivo ativo** (`regras_congeladas.precificacaoFotoExtra.modelo` ∈ `'global' | 'categoria'`).
   - Validação inline da redução de `fotosIncluidas` abaixo do já vendido.
2. **Mutation `updateGallery` (`useSupabaseGalleries.ts`)** — hoje só atualiza colunas escalares. Precisa também patchar `regras_congeladas` da galeria **e da sessão vinculada** quando houver override.
3. **Trigger DB `sync_gallery_extras_to_session`** — hoje sincroniza apenas `valor_foto_extra`. Estender para sincronizar `fotos_incluidas` em `regras_congeladas.pacote.fotosIncluidas`.
4. **Criação (`GalleryCreate.tsx`)** — quando vem do Lunari Studio, `fotosIncluidas` e `valorFotoExtra` chegam pré-preenchidos a partir de `regrasCongeladas`. Já existe a flag `overridePricing` para preço, mas não é exposta com clareza para o usuário, e não cobre `fotosIncluidas`. Adicionar botão **"Personalizar para esta galeria"** que libera ambos os campos no fluxo de criação.

---

## Plano de implementação

### Etapa 1 — UI de edição (`src/pages/GalleryEdit.tsx`)

- Banner informativo (glassmorphism) acima dos dois campos quando `gallery.sessionId != null`:
  > "Esta galeria está vinculada ao **Lunari Studio**. Editar a quantidade incluída ou o valor da foto extra **sobrescreve** as regras originais apenas para esta galeria. Pagamentos já confirmados são preservados."
- Validação inline em `fotosIncluidas`:
  - Se `novoValor < (total_fotos_extras_vendidas_originalmente_consideradas)`: mostrar mensagem de erro e desabilitar botão Salvar.
  - Para os dados, usar `gallery.totalFotosExtrasVendidas` e a quantidade incluída no momento dos pagamentos. Regra simples e segura: o novo `fotosIncluidas` **não pode ser menor** que `(selectedCount - total_fotos_extras_vendidas)` quando há cobranças pagas — porque essa parcela representa "fotos incluídas que já estão pagas" e reduzir geraria recobrança indevida.
- AlertDialog antes de salvar quando `valorFotoExtra` foi alterado **e** `regras_congeladas.precificacaoFotoExtra.modelo` é progressivo:
  > "Esta galeria usa **desconto progressivo por faixas**. Definir um valor fixo desativa o desconto progressivo apenas nesta galeria. Confirma?"
  - Confirmação envia flag `desativarProgressivo: true` no save.

### Etapa 2 — UI de criação (`src/pages/GalleryCreate.tsx`)

- Quando há `regrasCongeladas` carregadas (Lunari Studio), ao lado dos campos de `fotosIncluidas` e `valorFotoExtra`, mostrar um link sutil **"Personalizar para esta galeria"**.
- Ao clicar: ativa `overridePricing = true` e libera os dois campos para edição. Mostrar banner pequeno explicando que valores serão usados apenas nesta galeria. Mesmo AlertDialog da Etapa 1 se desconto progressivo estiver ativo.

### Etapa 3 — Mutation `updateGallery` (`src/hooks/useSupabaseGalleries.ts`)

Estender `CreateGaleriaData` com flag opcional `desativarProgressivo?: boolean`. No mutation, **após** o `UPDATE galerias` atual:

1. Buscar `regras_congeladas` atualizadas da galeria + `session_id`.
2. Se houve mudança em `fotosIncluidas` → patch via `jsonb_set` em `regras_congeladas.pacote.fotosIncluidas` (galeria **e** sessão `clientes_sessoes` por `session_id`).
3. Se houve mudança em `valorFotoExtra` → o trigger DB já cuida do `valorFotoExtra` base; nada a fazer aqui para esse campo isoladamente.
4. Se `desativarProgressivo === true` → reescrever `regras_congeladas.precificacaoFotoExtra` para `{ modelo: 'fixo', valorFixo: <novoValor> }` na galeria e na sessão. **Manter o histórico** das faixas em `regras_congeladas.pacote.precificacaoFotoExtraOriginal` para auditoria/reversão futura, se necessário (ou apenas trocar o `modelo` — decidido: trocar apenas o `modelo`, sem preservar faixas, conforme resposta do usuário).
5. Inserir registro em `audit_log` com `action='gallery_pricing_override'` e `metadata={ before, after }`.
6. **Nunca** tocar em `total_fotos_extras_vendidas` nem `valor_total_vendido` — esses contadores garantem o crédito de pagamentos já realizados.

### Etapa 4 — Trigger `sync_gallery_extras_to_session` (migration)

Estender o trigger atual para também propagar mudanças em `fotos_incluidas`:
- Quando `NEW.fotos_incluidas IS DISTINCT FROM OLD.fotos_incluidas`, atualizar `clientes_sessoes.regras_congeladas` patcheando `pacote.fotosIncluidas` (mantém auditoria, sem zerar contadores).

### Etapa 5 — Pricing engine

Não precisa alterar `confirm-selection` nem `pricingUtils.ts`. Após as etapas acima:
- Próximo `confirm-selection` lê as regras já atualizadas;
- Cálculo `extrasACobrar = max(0, extrasNecessarias - extrasPagasTotal)` continua válido;
- Se faixas progressivas foram desativadas → cai no caminho fixo naturalmente.

### Etapa 6 — Renomear textos visíveis

Auditar `GalleryEdit.tsx`, `GalleryCreate.tsx` e componentes auxiliares para que **toda menção visível ao usuário** ao projeto vinculado use **"Lunari Studio"** (e não "Gestão"). Comentários e nomes técnicos podem permanecer como estão para evitar refactor amplo.

---

## Casos de borda cobertos

- **Reativação após pagamento parcial**: `extrasPagasTotal` permanece intacto. Mesmo se valor extra for editado, fotos pagas não são recobradas. Apenas a diferença entre `(novoValor × totalExtras)` e `valorJaPago` é cobrada (ou zero, se já cobre).
- **Redução de `valorFotoExtra` para abaixo do já pago**: o cliente não recebe estorno automático (intencional — `valorJaPago` cobre o ideal recalculado, `valorACobrar = 0`).
- **Aumento de `valorFotoExtra` após reativação**: cobra apenas a diferença proporcional, nunca recobra fotos antigas individualmente.
- **Override em galeria standalone (sem `sessionId`)**: funciona da mesma forma — o trigger e o mutation atualizam apenas `regras_congeladas` da galeria.

---

## Arquivos afetados

- `src/pages/GalleryEdit.tsx` — banner + AlertDialog + validação inline.
- `src/pages/GalleryCreate.tsx` — botão "Personalizar para esta galeria" + AlertDialog.
- `src/hooks/useSupabaseGalleries.ts` — mutation estendida com patch JSONB e auditoria.
- **Migration nova** — atualizar `sync_gallery_extras_to_session` para cobrir `fotos_incluidas`.

## Fora de escopo

- Não alterar `confirm-selection`, `pricingUtils.ts`, webhooks (Asaas/MP/InfinitePay) ou RPC `finalize_gallery_payment`.
- Não retroagir mudanças para outras galerias nem para o Lunari Studio (override é estritamente local à galeria editada e à sessão dela 1:1).
- Não alterar nomes técnicos no código (variáveis, queries, comentários) — só strings visíveis ao usuário.
