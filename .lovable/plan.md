## Decisão de arquitetura

**Fonte única de verdade do valor da foto extra = `clientes_sessoes.regras_congeladas`** (sessão).

A galeria deixa de ter valor próprio editável. Para galerias **standalone** (sem sessão), criamos uma `regras_congeladas` mínima na própria galeria — o leitor passa a ler **sempre** de `regras_congeladas`, nunca mais da coluna escalar.

### Ajuste técnico ao texto da especificação

A especificação fala em `regras_congeladas.valor_foto`. Hoje o JSON real (criado pelo Studio e usado por `pricingUtils`, `confirm-selection`, trigger DB e edge function) é:

```json
{
  "pacote": { "valorFotoExtra": 25, "fotosIncluidas": 10, ... },
  "precificacaoFotoExtra": { "modelo": "fixo" | "global" | "categoria", ... }
}
```

Renomear para `valor_foto` quebraria o Studio, todos os contratos compartilhados e migrações antigas. Por isso, manter o caminho canônico **`regras_congeladas.pacote.valorFotoExtra`** como o campo a ser editado/lido. O efeito prático é o mesmo descrito na spec: campo único, sem duplicação.

`gallery.valor_foto_extra` permanece na tabela como **espelho/cache visual** mantido pelo trigger DB (já faz isso) — útil para listagens, filtros e leitura legada — mas **nenhum código de cálculo lê dela** depois desta mudança.

---

## Mudanças

### 1. Edge function `gallery-access` (fonte de verdade na resposta)

- **Remover** o bloco de reconciliação que sobrescreve `regras_congeladas.pacote.valorFotoExtra` com `gallery.valor_foto_extra` (linhas 1011-1047).
- Carregar `regras_congeladas` da sessão quando `session_id` existir (já faz). Para galerias **standalone**, ler de `gallery.regras_congeladas` (criada/atualizada conforme item 4).
- No payload, derivar `extraPhotoPrice` a partir de `regras_congeladas.pacote.valorFotoExtra`. Manter o campo no payload apenas para retrocompatibilidade do frontend; remover sua leitura nos callers num passo seguinte.

### 2. Edge function `confirm-selection`

- Remover o `fallbackPrice = sessao.valor_foto_extra || gallery.valor_foto_extra` (linha 449).
- Passar `valorFotoExtraFixo = regrasCongeladas.pacote?.valorFotoExtra ?? 0` para `calcularPrecoProgressivoComCredito`. Sem fallback escalar.
- Manter o gravar de `cobrancas.valor_foto_extra = valorUnitario` (snapshot histórico da cobrança — não é fonte de verdade, é registro contábil).

### 3. Frontend — leitura

- `ClientGallery.tsx`: passar a usar `regrasCongeladas.pacote.valorFotoExtra` como `extraPhotoPrice` em vez de `supabaseGallery.extraPhotoPrice`. Remover o fallback `|| supabaseGallery.valor_foto_extra` em `saleSettings.fixedPrice`.
- `pricingUtils.ts`: o argumento `valorFotoExtraFixo` deixa de ser usado quando `regrasCongeladas?.pacote?.valorFotoExtra` está presente. Manter assinatura para compatibilidade, mas mudar a precedência: **sempre prefere o do JSON**, fallback escalar só quando JSON ausente (galerias antigas sem `regras_congeladas`).

### 4. Frontend — edição

- `GalleryEdit.tsx`:
  - Campo "Valor da foto extra" continua existindo, com auxiliar **"Este valor é compartilhado com a sessão"** quando `gallery.sessionId != null`.
  - **Remover** o AlertDialog de "desativar progressivo" e a flag `desativarProgressivo`. A edição agora atualiza só `regras_congeladas.pacote.valorFotoExtra` — pacotes, faixas e modelo de precificação ficam intocados.
  - **Remover** edição de `fotosIncluidas` deste fluxo (fora de escopo da spec atual; também é override de regra). Continua somente leitura quando vem do Studio. Para galerias standalone, segue editável (cria/atualiza `regras_congeladas` mínima).
- `GalleryCreate.tsx`: remover botão "Personalizar para esta galeria" e a flag `overridePricing` para preço (mantém a lógica para galerias standalone, que não têm sessão).

### 5. Mutation `useSupabaseGalleries.updateGallery`

Quando `data.valorFotoExtra !== undefined`:

1. Buscar `session_id` + `regras_congeladas` atual da galeria.
2. **Se houver sessão vinculada**:
   - Atualizar **só** `clientes_sessoes.regras_congeladas` via `jsonb_set(regras_congeladas, '{pacote,valorFotoExtra}', to_jsonb(novoValor))` no `session_id`.
   - **Não** tocar em `pacote.valorBase`, `precificacaoFotoExtra`, `tabelaCategoria`, `produtos`, `dataCongelamento`, etc.
   - O trigger DB existente (`sync_gallery_extras_to_session`) já propaga de volta para `gallery.valor_foto_extra` (espelho) — manter.
   - Como agora a sessão é a fonte, também aplicar `jsonb_set` na própria galeria caso haja `regras_congeladas` ali (para galerias standalone que viraram vinculadas). Idempotente.
3. **Se for standalone**:
   - `jsonb_set` em `gallery.regras_congeladas`. Criar a estrutura `{ pacote: { valorFotoExtra, fotosIncluidas } }` se ainda não existir.
4. **Remover** todo o bloco `desativarProgressivo` (linhas 442-474) e o snapshot/audit relacionado a override (manter audit simples: "valor_foto_extra alterado de X para Y").
5. **Nunca** tocar em `total_fotos_extras_vendidas` / `valor_total_vendido` (créditos de pagamentos pretéritos).

### 6. Trigger DB `sync_gallery_extras_to_session`

Inverter a direção primária mas manter o trigger:

- **Manter** o caminho atual (galeria → sessão) para galerias antigas/standalone que ainda escrevem direto em `valor_foto_extra` via SQL/admin.
- Adicionar trigger inverso na sessão: quando `clientes_sessoes.regras_congeladas->'pacote'->>'valorFotoExtra'` muda, atualizar `gallery.valor_foto_extra` (espelho) **sem** entrar em loop (já há guard `pg_trigger_depth() < 2`).
- Remover do trigger atual o patch de `pacote.valorFotoExtra` na própria galeria — agora isso vem da sessão.

Migration nova; não destrutiva.

### 7. Limpeza de overrides residuais

- Audit log: o tipo `gallery_pricing_override` deixa de existir após esta mudança. Renomear futuras inserções para `gallery_extra_price_changed` (apenas log).
- Remover `overridePricing` em `GalleryCreate.tsx`.
- Remover `desativarProgressivo` de `CreateGaleriaData`.

### 8. Cura de dados (one-shot na migration)

Reconciliar galerias com divergência atual:

```sql
-- Para galerias com sessão: sessão sobrescreve
UPDATE clientes_sessoes s
SET regras_congeladas = jsonb_set(
  COALESCE(s.regras_congeladas, '{}'::jsonb),
  '{pacote,valorFotoExtra}',
  to_jsonb(g.valor_foto_extra),
  true
)
FROM galerias g
WHERE g.session_id = s.session_id
  AND g.finalized_at IS NULL              -- só galerias não finalizadas
  AND g.valor_foto_extra > 0
  AND COALESCE((s.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, -1)
      <> g.valor_foto_extra;
```

Critério: a galeria foi explicitamente editada pelo fotógrafo (escala = 8), enquanto a sessão ainda tem o valor antigo (5). Adotar o valor da galeria como verdade do momento da cura. Galerias finalizadas ficam intocadas (preservam histórico).

---

## Restrição arquitetural

Esta arquitetura assume **1 sessão = 1 galeria**. Se no futuro voltar a existir N galerias por sessão, o valor único na sessão deixa de fazer sentido para galerias com regras locais — precisaria reintroduzir `regras_congeladas` por galeria. Documentar essa restrição em comentário no trigger e no hook.

---

## UX final no editor de galeria

```
Valor da foto extra
[ R$ 25,00 ]
Este valor é compartilhado com a sessão.
Alterações refletem imediatamente no Lunari Studio.
```

(Para galerias standalone, o auxiliar muda para: "Este valor vale apenas para esta galeria.")

---

## Arquivos afetados

- `supabase/functions/gallery-access/index.ts` — remover reconciliação, ler valor da sessão.
- `supabase/functions/confirm-selection/index.ts` — remover fallback escalar.
- `src/hooks/useSupabaseGalleries.ts` — mutation passa a fazer `jsonb_set` na sessão.
- `src/pages/GalleryEdit.tsx` — remover AlertDialog de progressivo, edição só do valor extra, auxiliar de texto.
- `src/pages/GalleryCreate.tsx` — remover override de preço.
- `src/pages/ClientGallery.tsx` — derivar `extraPhotoPrice` de `regrasCongeladas.pacote.valorFotoExtra`.
- `src/lib/pricingUtils.ts` — inverter precedência (JSON > escalar).
- **Migration nova** — trigger inverso (sessão → galeria) + cura de dados das galerias divergentes.

## Fora de escopo

- Não alterar Studio nem RPCs do workflow de criação (já gravam no formato correto).
- Não alterar webhooks de pagamento.
- Não alterar `prepare_gallery_share` nem `finalize_gallery_payment`.
- Não migrar `fotos_incluidas` para o mesmo modelo agora (decisão da spec foi só sobre valor extra).
