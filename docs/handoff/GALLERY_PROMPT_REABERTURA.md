# Handoff — Reabertura de seleção pelo Gallery

Contrato que o app **Gallery** deve seguir quando um cliente reabre uma galeria já
finalizada e submete a seleção de novo. O objetivo é preservar o histórico
financeiro (o que foi cobrado) e ao mesmo tempo refletir a nova seleção do
cliente sem quebrar os agregados do Gestão.

---

## 1. Status da galeria

Ao receber uma nova submissão sobre uma galeria já `selecao_completa`, o
Gallery pode adotar **qualquer um dos dois fluxos** — ambos são suportados pelo
trigger atual:

- **Fluxo A (recomendado, mais observável):**
  1. No primeiro toggle após a reabertura → `status = 'selecao_iniciada'`.
  2. No submit final → `status = 'selecao_completa'` novamente.
- **Fluxo B (mais simples):**
  Manter `status = 'selecao_completa'` durante toda a edição e apenas atualizar
  as fotos. O trigger reconcilia os agregados igual.

Não existe caminho válido em que a galeria volte para `enviado`, `rascunho` ou
qualquer estado anterior à finalização original.

## 2. `fotos_selecionadas`

**Sempre** refletir a **nova quantidade total** de fotos marcadas como
`is_selected = true` após o submit.

- Se o cliente adicionou 3 fotos → o contador sobe.
- Se o cliente removeu fotos → o contador desce (mas ver §4 abaixo: o que já foi
  pago continua pago).

O Gallery pode usar diretamente `COUNT(*) FROM galeria_fotos WHERE galeria_id=… AND is_selected=true`
ou emitir a soma no payload de submit — o trigger em `galeria_fotos` já
recalcula quando as flags mudam, mas o Gallery **deve** garantir consistência
no submit (em galerias grandes, o snapshot vale mais do que confiar em N
triggers).

## 3. `total_fotos_extras_vendidas` — NUNCA zerar

Esse campo é **histórico financeiro**: representa a quantidade de fotos extras
que já foi **cobrada e paga** ao longo da vida da galeria. É a base para:

- Cálculo do saldo devedor em reaberturas (`selecionadas_atuais − incluidas − vendidas_ja_pagas`).
- Relatórios do fotógrafo.
- Auditoria de cobranças parciais/parceladas.

Regras rígidas:

- O Gallery **não pode** sobrescrever esse campo com a contagem de seleção
  atual.
- O Gallery **não pode** decrementá-lo se o cliente desmarcar fotos já pagas
  (o dinheiro já entrou; a foto continua "vendida" até que exista uma rotina
  explícita de estorno no Gestão).
- O único caminho que atualiza esse campo é o pipeline de cobrança
  (`gallery-create-payment` → webhook do provedor → RPC de finalização).
  Nenhum outro fluxo.

## 4. `gallery-update-session-photos` (opcional, mas recomendado)

Após o submit, chamar `gallery-update-session-photos` com:

```
qtdFotosExtra = fotos_selecionadas − fotos_incluidas
```

- Não é obrigatório: o trigger novo já sincroniza `clientes_sessoes.qtd_fotos_extras`
  a partir de `galerias`.
- É recomendado porque cria um evento observável de "cliente resubmeteu com N
  extras" na trilha do Gestão, útil para debug de dessincronizações e para o
  timeline visível ao fotógrafo.
- Se a chamada falhar (rede/timeout), **não bloquear** a finalização: o trigger
  garante o estado correto no banco. Registrar `console.warn` e seguir.

## 5. Fonte de verdade — leia com atenção

| Pergunta                                          | Fonte de verdade                                 |
| ------------------------------------------------- | ------------------------------------------------ |
| Quantas fotos extras o cliente selecionou (total)? | `fotos_selecionadas − fotos_incluidas`           |
| Quantas fotos extras já foram pagas?              | `total_fotos_extras_vendidas`                    |
| Quantas fotos extras ainda estão em aberto?       | `(fotos_selecionadas − fotos_incluidas) − total_fotos_extras_vendidas`, com piso em 0 |
| Valor a cobrar em uma reabertura?                 | Recalcular usando **regras_congeladas** da galeria sobre o delta acima |

Regras derivadas:

- **Nunca** sobrescrever `total_fotos_extras_vendidas` com base na seleção
  atual. Seleção ≠ pagamento.
- **Nunca** sobrescrever `fotos_selecionadas` com base em
  `total_fotos_extras_vendidas`. Pagamento ≠ seleção.
- Se `fotos_selecionadas − fotos_incluidas < total_fotos_extras_vendidas`
  (cliente desmarcou fotos que já pagou), o saldo devedor é **0**, não
  negativo. Esse cenário é normal e não gera estorno automático — fica visível
  no Gestão para o fotógrafo decidir.

## 6. Checklist de submit (Gallery)

Ao processar o submit de reabertura, o Gallery deve, nesta ordem:

1. Persistir as flags `is_selected` das fotos alteradas.
2. Recalcular `fotos_selecionadas` (ou confiar no trigger, mas validar no
   response).
3. Manter `total_fotos_extras_vendidas` **intacto**.
4. Definir `status` conforme §1.
5. (Opcional) Chamar `gallery-update-session-photos` para observabilidade.
6. Retornar ao cliente o novo saldo devedor calculado com a fórmula da §5 — ou
   `0` se não houver delta a cobrar.

## 7. Anti-regressão

Antes de mergear qualquer alteração no fluxo de reabertura, rodar a query
abaixo em uma galeria de teste que já teve pagamento parcial:

```sql
SELECT
  id,
  fotos_incluidas,
  fotos_selecionadas,
  total_fotos_extras_vendidas,
  GREATEST(fotos_selecionadas - fotos_incluidas - total_fotos_extras_vendidas, 0) AS extras_em_aberto,
  status,
  status_selecao
FROM galerias
WHERE id = '<galeria_teste>';
```

Resultado esperado após reabrir + adicionar 2 fotos + submeter:

- `fotos_selecionadas` subiu em 2.
- `total_fotos_extras_vendidas` **não mudou**.
- `extras_em_aberto` é exatamente 2.
- `status` volta a `selecao_completa` (Fluxo A) ou permanece nele (Fluxo B).
