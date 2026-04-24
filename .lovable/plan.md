
# Plano — corrigir propagação do "Valor Foto Extra" editado na galeria

## 1. Diagnóstico (já confirmado em produção)

A consulta no banco mostrou exatamente o quadro descrito:

```
gallery_vfe | gallery_regras_vfe | sessao_vfe | sessao_regras_vfe
   25,00    |        25          |    25      |     250,05    ← cliente vê R$ 250,05
   25,00    |        25          |    25      |     250,05
   25,00    |        25          |    25      |     250,05
   25,00    |        25          |    25      |     250,05
   25,00    |        25          |    25      |     250,05
   25,00    |       2550         |    25      |      25       ← caso antigo (centavos)
```

Cinco galerias do "Dia das Mães" estão com **`galerias.valor_foto_extra = 25`** (campo simples corrigido), porém **`clientes_sessoes.regras_congeladas.pacote.valorFotoExtra = 250.05`**. Ainda existe um caso antigo (Huimi Loreto) com **`galerias.regras_congeladas.pacote.valorFotoExtra = 2550`** (valor em centavos não normalizado).

### Por que o cliente continua vendo o preço errado

1. **`gallery-access` (linha 1006)** sobrescreve as regras da galeria pelas regras da sessão sempre que `session_id` existir:
   ```ts
   regrasCongeladas = sessao.regras_congeladas;   // ← traz o 250,05 antigo
   ```
2. **`pricingUtils.calcularPrecoProgressivoComCredito` (linha 164)** decide o preço unitário pelo modelo `fixo` lendo `regrasCongeladas.pacote.valorFotoExtra`, **ignorando** o `valorFotoExtraFixo` (que é justamente o `gallery.valor_foto_extra` corrigido).
3. **`useSupabaseGalleries.updateGallery`** só faz `UPDATE galerias SET valor_foto_extra = …`. Não toca em `galerias.regras_congeladas` nem em `clientes_sessoes.regras_congeladas`.
4. Existe o trigger **`sync_gallery_extras_to_session`**, que copia `valor_foto_extra` da galeria para `clientes_sessoes.valor_foto_extra` — mas **não mexe** nos campos JSONB `regras_congeladas->pacote->valorFotoExtra` (galeria nem sessão). É exatamente o JSONB que vence na precificação do cliente.

Resultado: a edição parece funcionar (Editar/Detalhes mostram 25), mas o cliente vê o preço antigo porque a fonte de verdade do cálculo é o JSONB que ninguém atualiza.

## 2. Estratégia da correção

Três frentes complementares:

1. **Banco (idempotente, agora)**: subir o trigger `sync_gallery_extras_to_session` para também patchear o JSONB `regras_congeladas->pacote->valorFotoExtra` na sessão (e na própria galeria, por segurança), aplicando `sanitizeExtraPrice` (clamp 0–999,99). Isso resolve **automaticamente** todas as edições futuras — sem depender do front-end.
2. **Backfill único (data fix)**: rodar uma migration que sincroniza, em todas as galerias com session_id, o JSONB da sessão e da galeria com o `galerias.valor_foto_extra` saneado. Corrige imediatamente as 5 galerias do Dia das Mães e o caso "Huimi Loreto".
3. **App (defesa em profundidade)**: no `updateGallery` (front), além do `UPDATE galerias`, fazer um `UPDATE clientes_sessoes` complementar para garantir consistência mesmo se o trigger for desabilitado/futuramente migrado, e, no `pricingUtils`, deixar de ignorar o `valorFotoExtraFixo` quando ele divergir do JSONB (o JSONB vira um teto/sugestão, e o fixo da galeria — agora sempre saneado — é a fonte de verdade do "modelo fixo").

A combinação fecha a porta tanto no caminho de leitura (`pricingUtils`) quanto nos caminhos de escrita (trigger + backfill + UI).

## 3. O que muda — arquivos e responsabilidades

### 3.1 Migração de banco (nova)

`supabase/migrations/<timestamp>_sync_extra_price_to_frozen_rules.sql`

a) Reescrever a função `public.sync_gallery_extras_to_session()` para também atualizar o JSONB:
- `clientes_sessoes.regras_congeladas = jsonb_set(regras_congeladas, '{pacote,valorFotoExtra}', to_jsonb(NEW.valor_foto_extra))` quando o caminho existir;
- mesma lógica em `galerias.regras_congeladas` da própria linha (com `BEFORE` ou via `UPDATE` separado dentro do `AFTER`, evitando recursão usando `pg_trigger_depth()`);
- aplicar `LEAST(GREATEST(NEW.valor_foto_extra, 0), 999.99)` (espelho de `sanitizeExtraPrice`) antes de gravar;
- preservar todo o restante do JSONB.

b) Backfill one-shot dentro da mesma migration:
- para todas as `galerias` com `session_id IS NOT NULL` onde `(s.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric` diverge de `g.valor_foto_extra`, atualizar o JSONB da sessão para o valor da galeria (clampado);
- para galerias com `(g.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric` divergente do `g.valor_foto_extra` (ex: caso "Huimi Loreto" com 2550), atualizar o JSONB da galeria para o valor saneado.

c) Não tocar em `cobrancas` históricas — preço cobrado já registrado é imutável. O fix é apenas para precificação **futura/visual**.

### 3.2 `src/hooks/useSupabaseGalleries.ts`

Em `updateGalleryMutation`, quando `data.valorFotoExtra !== undefined`:

1. Sanitizar o valor com `sanitizeExtraPrice` antes de mandar para o banco (defesa contra qualquer caminho que ainda chegasse com 250,05 vindos da UI).
2. Após o `UPDATE galerias`, ler `session_id` da galeria. Se existir:
   - `UPDATE galerias SET regras_congeladas = jsonb_set(...)` para corrigir o próprio JSONB da galeria (cobre o caso em que o trigger seja desabilitado em ambientes futuros);
   - chamar uma RPC simples (`sync_session_extra_price(p_session_id text, p_valor numeric)`) ou um `UPDATE clientes_sessoes` direto (RLS já permite — `auth.uid() = user_id`) atualizando `valor_foto_extra` e `regras_congeladas.pacote.valorFotoExtra`.
3. Manter `onSuccess` invalidando `['galerias']` e adicionar `['client-gallery-session-rules', sessionId]` para evitar cache stale na própria sessão de gestor.

A escrita continua atômica do ponto de vista do usuário porque cada UPDATE é independente; mesmo se a etapa 2 falhasse, o trigger garantirá a sincronização.

### 3.3 `src/lib/pricingUtils.ts`

Evoluir `calcularPrecoProgressivo` e `calcularPrecoProgressivoComCredito` para o seguinte critério no modelo **fixo**:

- `precoBase = sanitizeExtraPrice(valorFotoExtraFixo || regras.pacote.valorFotoExtra)`
- Se `valorFotoExtraFixo > 0` e divergir de `regras.pacote.valorFotoExtra`, **vence o `valorFotoExtraFixo`** (vem de `galerias.valor_foto_extra`, que é o que o fotógrafo edita). Logar `console.warn` apontando o desencontro para diagnóstico.
- Nos modelos `global` e `categoria`, manter as faixas como hoje, mas aplicar `sanitizeExtraPrice` em cada `faixa.valor` antes do cálculo (cobre regras antigas com valores em centavos, ex: 2550).

Esse ajuste é a **última linha de defesa**: mesmo que algum cache antigo do JSONB ainda traga 250,05, o cliente verá o preço correto se `gallery.extraPhotoPrice` estiver certo.

### 3.4 `supabase/functions/gallery-access/index.ts`

Adição cirúrgica entre as linhas 1006 e 1144:

- Antes de retornar, **patchar em memória** `regrasCongeladas.pacote.valorFotoExtra` com `sanitizeExtraPrice(gallery.valor_foto_extra)` se houver divergência. Não grava no banco (a migration + trigger já cuidam disso); apenas garante que o payload entregue ao cliente seja coerente, mesmo em galerias que ainda não passaram pelo trigger novo (defesa para o intervalo entre deploy e backfill, e para galerias antigas que não recebam UPDATE).
- Logar 1 linha quando aplicar o patch (`⚠️ Frozen rule price (X) diverged from gallery price (Y) — using gallery price`).

### 3.5 `src/components/DiscountProgressBar.tsx`

Trocar a leitura `regras?.pacote?.valorFotoExtra || extraPhotoPrice` por `sanitizeExtraPrice(extraPhotoPrice || regras?.pacote?.valorFotoExtra)`. Mesma lógica de "preço da galeria vence" que está em `pricingUtils`.

## 4. Sequência de execução

1. **Migration** (trigger + função + backfill). Já elimina o problema visual em **todas** as 5 galerias do Dia das Mães + Huimi Loreto.
2. Atualizar `pricingUtils.ts` (mudança trivial, segura).
3. Atualizar `gallery-access/index.ts` (patch in-memory + log).
4. Atualizar `useSupabaseGalleries.ts` para também patchar a sessão no save.
5. Atualizar `DiscountProgressBar.tsx`.
6. Build TS + smoke test em uma das galerias afetadas (recarregar a galeria do cliente, conferir "+1 R$ 25,00" e barra de progresso).

## 5. O que NÃO muda

- **Nenhuma cobrança histórica é tocada.** `cobrancas`, `transactions` e `galeria_acoes` permanecem intactas — preço pago já é imutável.
- **Webhooks** (Asaas, InfinitePay, Mercado Pago) não dependem do JSONB de regras na hora de receber pagamento; usam o registro `cobrancas`. Sem risco para automações.
- **Modo Assistido / Studio**: o caminho oposto (Gestão → Galeria) continua funcionando normalmente; a edição manual no Galeria agora também flui de volta para a sessão, fechando o ciclo.
- **RLS / segurança**: nada muda. RPC nova, se criada, será `SECURITY DEFINER` com `WHERE user_id = auth.uid()`.

## 6. Critérios de aceite

1. Editar `valor_foto_extra` em qualquer galeria com `session_id` deve, **dentro da mesma transação**, atualizar:
   - `galerias.valor_foto_extra` ✅
   - `galerias.regras_congeladas->pacote->valorFotoExtra` ✅
   - `clientes_sessoes.valor_foto_extra` ✅
   - `clientes_sessoes.regras_congeladas->pacote->valorFotoExtra` ✅
2. A galeria do cliente (após hard reload) deve exibir o novo preço unitário em: badge "+N extras", rodapé total, barra de desconto, lightbox e tela de confirmação.
3. Para as 5 galerias do Dia das Mães + Huimi Loreto, abrir a galeria sem editar nada e confirmar que o preço já está coerente (efeito do backfill).
4. Editar valor para algo absurdo (ex.: digitar "9999") deve ser **clampado em 999,99** em todas as 4 escritas acima.
5. `npm run build` sem erros TS.
