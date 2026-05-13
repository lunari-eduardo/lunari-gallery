# Investigação: uso alto de Database Size

## Diagnóstico

DB total: **0.6 GB**. Distribuição real:

| Objeto | Tamanho | % | Observação |
|---|---|---|---|
| `cron.job_run_details` | 340 MB | 55.6% | 301.827 linhas desde 04/fev/2026, **nunca foi limpo** |
| `net._http_response` | 193 MB | 31.5% | Apenas 792 linhas (6h) — `n_live_tup=0`, **bloat severo, autovacuum nunca rodou** |
| `public.galeria_fotos` | 16 MB | 2.5% | Normal |
| Demais tabelas `public.*` | ~25 MB | ~4% | Normal |

**87% do banco é overhead operacional de cron + net.http**, não dados de negócio.

## Causas-raiz identificadas

### 1. Jobs duplicados rodando `process-photos` a cada minuto
- **jobid 7** — `body: {batchSize: 10}`, **service_role_key hardcoded no SQL** (risco de segurança).
- **jobid 8** — `body: {batchSize: 1}`, usa `current_setting('app.settings.service_role_key')`.
- Ambos ativos, schedule `* * * * *`. Geram **2 execuções/min × 90 dias ≈ 280k linhas** em `cron.job_run_details` (93% do total dessa tabela).

### 2. `cron.job_run_details` sem retention
pg_cron não limpa histórico automaticamente. Cresce ~3.300 linhas/dia (com os 4 jobs ativos).

### 3. `net._http_response` com bloat de tabela
Heap de 188 MB com `n_live_tup=0` e `last_autovacuum=NULL`. A pg_net faz expurgo lógico mas o espaço físico nunca foi recuperado. Precisa `VACUUM FULL`.

### 4. Outros jobs ativos (saudáveis)
- jobid 9 — `autentique-cron-sync`, a cada 5 min (3.634 runs).
- jobid 10 — `google-calendar-sync-worker`, a cada 1 min (15.762 runs).

### Itens verificados — sem problema
- Webhooks chamando a si mesmos: não encontrado.
- Edge functions com retry agressivo: `webhook_logs` tem só 640 KB.
- Triggers em UPDATE desnecessários: tabelas `public.*` totalizam <30 MB, não há sinal de write-amplification.
- Logs aplicacionais (`audit_log`, `galeria_acoes`): <1 MB cada.

## Plano de correção

### Etapa 1 — Unificar process-photos (elimina 50% do crescimento futuro)
- `cron.unschedule(7)` — remove o job duplicado com service_role_key hardcoded.
- Manter **apenas jobid 8** (que usa `current_setting`, mais seguro).
- Ajustar `batchSize` do jobid 8 para `10` (valor original do job 7) para não regredir throughput.

### Etapa 2 — Limpeza imediata (libera ~530 MB)
```sql
-- Apaga histórico de cron com mais de 7 dias
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';
VACUUM FULL cron.job_run_details;

-- Recupera espaço físico do net._http_response (já está logicamente vazio)
VACUUM FULL net._http_response;
```
Resultado esperado: DB cai de **0.6 GB → ~0.07 GB**.

### Etapa 3 — Retention recorrente (impede recorrência)
Novo cron diário (03:00 UTC):
```sql
SELECT cron.schedule('cleanup-cron-history','0 3 * * *', $$
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';
$$);
```
A pg_net já faz expurgo próprio de `_http_response` (TTL ~6h confirmado pelas métricas).

### Etapa 4 — Hardening
- Conferir e remover qualquer outro lugar onde `service_role_key` esteja em texto puro em comandos de cron.
- Documentar política: novos cron jobs devem usar `current_setting('app.settings.service_role_key')` ou Vault.

## Arquivos
- 1 migration nova em `supabase/migrations/` contendo: `unschedule(7)`, ajuste do jobid 8 (batchSize=10), DELETE + VACUUM FULL nas duas tabelas, e o `cron.schedule` de retention.

## Impacto
- **-87% no tamanho do DB** imediatamente.
- **-50% na taxa de crescimento de cron history** ao remover o job duplicado.
- Crescimento estabilizado em ~7 dias × 4.300 runs/dia ≈ 30k linhas máx (~30 MB), com poda diária automática.
- Bônus de segurança: remove service_role_key em texto puro do catálogo do banco.
