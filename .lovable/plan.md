
# Plano — `preco_da_foto_extra` da URL como override autoritativo na criação assistida

## 1. Diagnóstico (confirmado em produção)

O Gestão **já corrigiu** o nome do query param em `src/utils/galleryRedirect.ts` para `preco_da_foto_extra` (com alias legado `preco_extra`). A URL agora chega corretamente para o Gallery.

O trigger `trg_sync_session_extra_price_to_frozen` em `clientes_sessoes` (BEFORE INSERT/UPDATE) **já patcha** `regras_congeladas.pacote.valorFotoExtra` quando o usuário edita `valor_foto_extra`. Verificado no banco: as sessões com `valor_foto_extra > 0` e divergência crítica (250,05) **já estão sincronizadas**.

**Mas o problema residual continua existindo no Gallery:** em `src/pages/GalleryCreate.tsx` há dois caminhos onde o JSONB da sessão **vence** o `preco_da_foto_extra` da URL, mesmo quando a URL traz um valor válido e divergente:

1. **Linha 480-484** — `useEffect` que sincroniza `regrasCongeladas`: se `pacote.valorFotoExtra > 0`, faz `setFixedPrice(valorSanitizado)` **sobrescrevendo** o valor da URL que tinha sido aplicado em `setFixedPrice(gestaoParams.preco_da_foto_extra)` (linha 557).
2. **Linha 650-654** — montagem do payload de criação: `if (hasSessionRegras) { valorFotoExtraFinal = regrasCongeladas.pacote.valorFotoExtra ... }` ignora completamente o `fixedPrice` (que reflete a URL) quando há regras congeladas.

Resultado: se por qualquer motivo (race entre edição no Gestão e clique em "Criar Galeria", trigger desabilitado, sessão antiga não migrada) o JSONB estiver stale, o Gallery vai criar a galeria com o valor errado **mesmo recebendo o valor certo na URL**.

## 2. O que muda

### 2.1 `src/pages/GalleryCreate.tsx` — URL vence o JSONB

**A. `useEffect` de sync do `regrasCongeladas` (linhas 454-485)**

Não sobrescrever `fixedPrice` se o valor da URL (`gestaoParams.preco_da_foto_extra`) for válido e divergente do JSONB. Logar `console.warn` quando houver divergência para telemetria.

```ts
if (pacote?.valorFotoExtra !== undefined && pacote.valorFotoExtra > 0) {
  const valorJsonb = sanitizeExtraPrice(pacote.valorFotoExtra);
  const valorUrl = gestaoParams?.preco_da_foto_extra;

  if (valorUrl !== undefined && valorUrl > 0 && Math.abs(valorUrl - valorJsonb) > 0.001) {
    console.warn('[GalleryCreate] Divergência preco_da_foto_extra: URL=', valorUrl, 'JSONB=', valorJsonb, '— usando URL (mais recente)');
    setFixedPrice(valorUrl);
  } else {
    setFixedPrice(valorJsonb);
  }
}
```

**B. Montagem do payload (linhas 644-664)**

Quando há `regrasCongeladas` E o usuário veio em modo assistido com `preco_da_foto_extra` válido na URL:

- `valorFotoExtraFinal` passa a vir de `sanitizeExtraPrice(gestaoParams.preco_da_foto_extra ?? regras.pacote.valorFotoExtra)`.
- Se houver divergência > 0.01, **patchar `finalRegrasCongeladas` em memória** com o novo `valorFotoExtra` antes de salvar (mantém auditoria coerente, evita criar galeria com JSONB já desatualizado).
- Logar warning de divergência.

```ts
if (hasSessionRegras) {
  const valorJsonbRaw = regrasCongeladas.pacote?.valorFotoExtra || 0;
  const valorJsonb = valorJsonbRaw > 1000 ? valorJsonbRaw / 100 : valorJsonbRaw;
  const valorUrl = gestaoParams?.preco_da_foto_extra;

  if (valorUrl !== undefined && valorUrl > 0 && Math.abs(valorUrl - valorJsonb) > 0.01) {
    console.warn('[GalleryCreate] Override JSONB com URL na criação:', { url: valorUrl, jsonb: valorJsonb });
    valorFotoExtraFinal = sanitizeExtraPrice(valorUrl);
    finalRegrasCongeladas = {
      ...regrasCongeladas,
      pacote: { ...regrasCongeladas.pacote, valorFotoExtra: valorFotoExtraFinal },
    };
  } else {
    valorFotoExtraFinal = sanitizeExtraPrice(valorJsonb);
    finalRegrasCongeladas = regrasCongeladas;
  }
}
```

Replicar o mesmo padrão nos 3 outros pontos de criação/atualização de galeria do mesmo arquivo (linhas ~775, ~875, ~927) — todos fazem o mesmo padrão `getInitialExtraPrice(regrasCongeladas)` e devem aceitar override da URL pela mesma lógica.

**C. Aplicar `sanitizeExtraPrice` no setFixedPrice da URL (linha 557)**

Hoje: `setFixedPrice(gestaoParams.preco_da_foto_extra)`. Trocar por `setFixedPrice(sanitizeExtraPrice(gestaoParams.preco_da_foto_extra))`. Defesa redundante; o `useGestaoParams` já clampa, mas garantir aqui também é barato.

### 2.2 `supabase/functions/gallery-access/index.ts` — não muda

A patch in-memory já existe (memória `billing/session-extra-photo-sync-logic`). Confirmar comportamento sem alterar código.

### 2.3 Banco — nenhuma mudança

O trigger `trg_sync_session_extra_price_to_frozen` já está correto. O backfill já foi rodado nas migrations anteriores. Sem nova migration.

## 3. Por que essa abordagem é segura

- **Não quebra o fluxo padrão**: quando URL e JSONB concordam (caso comum), nada muda.
- **URL ganha apenas quando explicitamente divergente**: a URL do Gestão é gerada **no momento do clique** em "Criar galeria", então é a fonte mais fresca possível. O JSONB pode estar atrasado por race ou trigger desativado.
- **Não toca em galerias existentes**: o override só age na **criação**, não em galerias já criadas. Cobranças, pagamentos, webhooks intactos.
- **Telemetria**: os `console.warn` permitem detectar futuras divergências sem impacto funcional.
- **Patch do JSONB em memória antes de salvar**: a galeria nasce já consistente entre `valor_foto_extra` e `regras_congeladas.pacote.valorFotoExtra`, evitando depender 100% do trigger pós-criação.

## 4. Critérios de aceite

1. Editar `valor_foto_extra` no Gestão para R$ 25,00 (a partir de um JSONB stale com R$ 250,05) → clicar em "Criar galeria" no Gestão → galeria nasce com `valor_foto_extra = 25` **e** `regras_congeladas.pacote.valorFotoExtra = 25`.
2. Quando URL e JSONB concordam (fluxo normal), comportamento idêntico ao atual.
3. Console mostra `[GalleryCreate] Divergência preco_da_foto_extra: URL=X JSONB=Y — usando URL` quando aplicável.
4. Galerias standalone (sem `session_id`) continuam usando `fixedPrice` da UI normalmente.
5. `npm run build` sem erros TS.

## 5. O que NÃO muda

- Trigger de banco, migrations, edge functions de pagamento (Asaas, InfinitePay, Mercado Pago).
- Cobranças/galerias existentes.
- Comportamento das galerias após criadas (a edição via `useSupabaseGalleries.updateGallery` já estava blindada na rodada anterior).
- Contrato do `useGestaoParams` (já está correto).
