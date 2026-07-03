# Handoff — Redução de Egress do Supabase (projeto Gestão)

**Origem:** projeto Gallery (`lunari-gallery`)
**Destino:** projeto Gestão (`lunari-gestao`)
**Data:** 2026-07-03
**Base de dados:** compartilhada (Supabase `tlnjspsywycbudhewsfv`)

---

## Contexto

O projeto Supabase `tlnjspsywycbudhewsfv` é compartilhado por Gallery e Gestão.
O uso de **Egress** subiu acima dos 5GB do plano gratuito e não caiu mesmo após
uma otimização agressiva no Gallery (denormalização de chaves de foto, remoção
de join `galeria_fotos`, backoff de polling em pagamentos).

Investigação nos logs (`edge_logs` / `metadata.request`) das últimas 24h mostrou
onde o tráfego real está:

| Path                            | Método   | Reqs/24h  | Projeto de origem |
|---------------------------------|----------|-----------|-------------------|
| `/rest/v1/clientes_sessoes`     | GET      | **2.334** | **Gestão**        |
| `/rest/v1/clientes_sessoes`     | OPTIONS  | 1.905     | Preflight CORS    |
| `/rest/v1/appointments`         | GET      | **785**   | **Gestão**        |
| `/rest/v1/appointments`         | OPTIONS  | 606       | Preflight CORS    |
| `/rest/v1/fin_transactions`     | GET      | 52        | Gestão            |
| `/rest/v1/galerias`             | GET      | 2         | Gallery           |
| `/rest/v1/galeria_fotos`        | GET      | 0         | Gallery           |

Conclusão: **>95% do egress atual vem do Gestão**, especificamente da agenda
(`clientes_sessoes` + `appointments`). O Gallery já foi otimizado e contribui
com menos de 1% do tráfego. Sem aplicar as mudanças abaixo no Gestão, a barra
do Supabase continuará subindo no mesmo ritmo.

---

## Padrão de request observado (agenda do Gestão)

```
GET /rest/v1/clientes_sessoes
  ?select=*,clientes(nome,email,telefone,whatsapp)
  &user_id=eq.<uid>
  &data_sessao=gte.<mes-início>
  &data_sessao=lte.<mes-fim>
  &or=(status.is.null,status.neq.historico)
  &order=data_sessao.asc
```

Problemas:

1. **`select=*`** em tabela de 34 colunas — inclui JSONs pesados
   (`regras_congeladas`, `configuracoes`, `produtos_incluidos`, `metadata`,
   `notas_internas`, campos históricos que a agenda não usa).
2. **Embed `clientes(nome,email,telefone,whatsapp)`** em toda listagem, quando
   a maioria das views só mostra `nome`.
3. **Sem `staleTime`** — cada foco de aba dispara refetch do mês inteiro.
4. **Um GET por mês visualizado** + preflight OPTIONS dobrando a contagem.

Um único usuário navegando 3–4 meses gera 300–800KB de payload; multiplicado
por sessões abertas o dia inteiro, chega aos MB/dia observados.

---

## Plano de correção — projeto Gestão

Ordem por retorno vs. risco. Aplicar em ordem: A1 → A2 → A3 → A4 → A5 → A6.

### A1. Projeção estreita em `clientes_sessoes` (maior alavanca)

Trocar `select=*` por lista explícita nas queries da agenda/lista de sessões:

```ts
.select(`
  id, cliente_id, session_id, appointment_id,
  data_sessao, hora_inicio, hora_fim,
  status, titulo, local, cor,
  valor_total, valor_pago
`)
```

**Não** trazer: `regras_congeladas`, `configuracoes`, `produtos_incluidos`,
`metadata`, `notas_internas`, `regras_selecao`, colunas de auditoria. Buscar
esses campos **sob demanda** ao abrir o detalhe da sessão (query separada por
`id`).

**Corte estimado**: 60–75% de bytes por linha.

### A2. Substituir embed de `clientes`

Na listagem, `nome` é o único campo usado no card visual. Trocar:

```ts
// Antes
.select('*, clientes(nome, email, telefone, whatsapp)')

// Depois — listagem
.select('..., clientes(nome)')

// Detalhe (query separada, só quando o usuário abre a sessão)
supabase.from('clientes')
  .select('id, nome, email, telefone, whatsapp, cpf_cnpj')
  .eq('id', clienteId)
  .single();
```

### A3. Cache React Query agressivo

Em todas as queries de agenda/lista:

```ts
useQuery({
  queryKey: ['sessoes', userId, mes],
  queryFn: ...,
  staleTime: 5 * 60_000,       // 5 min
  refetchOnWindowFocus: false, // crítico — hoje refaz a cada foco
  refetchOnReconnect: false,
  refetchOnMount: false,       // usa cache se existir
});
```

Invalidar explicitamente com `queryClient.invalidateQueries({ queryKey: ['sessoes', userId, mesEspecífico] })` **apenas** no mês afetado após mutação — nunca a lista inteira.

### A4. Paginação/janela

- Nunca carregar mais de 1 mês por request.
- Ao navegar 3 meses, manter cache dos anteriores; não refazer.
- Queries com filtro de intervalo devem casar 1:1 com a queryKey do React
  Query (`['sessoes', userId, YYYY-MM]`).

### A5. Realtime seletivo (elimina refetch "por garantia")

Assinar `postgres_changes` em `clientes_sessoes` e `appointments` filtrado por
`user_id`, e atualizar apenas o cache do mês afetado:

```ts
useEffect(() => {
  const ch = supabase
    .channel(`sessoes-${userId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'clientes_sessoes', filter: `user_id=eq.${userId}` },
      (payload) => {
        const dt = (payload.new as any)?.data_sessao ?? (payload.old as any)?.data_sessao;
        if (!dt) return;
        const mes = dt.slice(0, 7); // YYYY-MM
        queryClient.invalidateQueries({ queryKey: ['sessoes', userId, mes] });
      })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [userId]);
```

Sem isso, hoje o Gestão refaz o fetch "por garantia" após qualquer criação/
edição, gastando egress.

### A6. `HEAD` para contagens

Onde a UI só precisa saber "quantas sessões existem", trocar:

```ts
// Antes
.select('id', { count: 'exact' })

// Depois
.select('*', { count: 'exact', head: true })
```

`head: true` faz PostgREST responder apenas com o header `Content-Range`, com
body vazio. Zero bytes de dados.

---

## Auditoria complementar — outros hot-paths do Gestão

Rodar no repo Gestão:

```
rg "\.select\('\*'" src/
rg "clientes_sessoes" src/
rg "appointments" src/
rg "fin_transactions" src/
```

Aplicar o mesmo padrão de projeção estreita em:

- `fin_transactions` (52 reqs/dia hoje, mas cresce com movimentação).
- `fin_items_master`.
- `tasks` + `task_attachments`.
- `contratos`.
- `leads`.
- `clientes` (nunca trazer todos os campos numa lista — nome + telefone + email
  bastam).

**Regra geral**: `select('*')` só em tela de **detalhe/edição** de 1 registro.
Em lista, sempre lista explícita de colunas.

---

## Instrumentação recomendada

Adicionar um utilitário simples que loga em dev o tamanho de cada resposta
REST, para caçar telas que sozinhas geram MBs:

```ts
// src/lib/egressLogger.ts (só dev)
if (import.meta.env.DEV) {
  const orig = window.fetch;
  window.fetch = async (...args) => {
    const res = await orig(...args);
    const clone = res.clone();
    const body = await clone.text();
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    if (url.includes('/rest/v1/') && body.length > 20_000) {
      console.warn(`[egress] ${body.length}b ${url}`);
    }
    return res;
  };
}
```

---

## Verificação após deploy

Consultar logs Supabase 24h depois com:

```sql
select r.path, r.method, count(*) as reqs
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as r
where timestamp > timestamp_sub(current_timestamp(), interval 24 hour)
group by r.path, r.method
order by reqs desc
limit 30;
```

Metas realistas:

- `/rest/v1/clientes_sessoes` GET: de ~2.300 → ~500 (queda ~78%).
- Bytes por linha em `clientes_sessoes`: −60% via projeção.
- Egress total do projeto: **queda esperada de 70–85%**.

---

## Arquivos de referência no Gallery (para consulta)

| Arquivo                                     | O que ver                                                |
|---------------------------------------------|----------------------------------------------------------|
| `src/hooks/useSupabaseGalleries.ts`         | Padrão de `staleTime` + `refetchOnWindowFocus: false`    |
| `.lovable/handoff-gestao-checkout-completo.md` | Handoffs anteriores (checkout / fiscal / prefill)      |

---

## Notas finais

- Toda mudança em queries que envolvem `user_id` deve continuar respeitando
  RLS — não usar `service_role` no frontend.
- Não remover embeds que a UI realmente consome (ex.: telefone visível no
  card da agenda). O ponto é remover o que **não é lido** hoje.
- Após aplicar, medir e documentar o antes/depois nos logs. Sem métrica não
  há convicção de ganho.
