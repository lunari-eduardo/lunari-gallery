

# Fix: Galerias públicas multiusuário — Problemas de concorrência, contabilização e tela finalizada

## Problemas identificados

### 1. Race condition no lock da galeria (causa raiz principal)
A RPC `try_lock_gallery_selection` usa um lock **na galeria inteira** (`status_selecao = processando_selecao`). Quando dois visitantes confirmam simultaneamente, o segundo é **bloqueado** porque a galeria já está em `processando_selecao`. Porém, como o segundo conseguiu confirmar (ambas cobranças existem com status `pago`), significa que o lock foi burlado por timing.

**Pior**: após o primeiro visitante finalizar, o status da galeria muda para `selecao_completa`, e o lock impede qualquer outro visitante de confirmar (`already_finalized`).

**Causa**: para galerias públicas, o lock deveria ser **por visitante**, não por galeria. Cada visitante tem ciclo de vida independente.

### 2. `visitor_id` não é passado nas cobranças
Na tabela `cobrancas`, ambas cobranças têm `visitor_id = NULL`. O `confirm-selection` não popula `visitor_id` ao criar cobranças (nem no body para asaas-gallery-payment, nem nos dados para infinitepay/mercadopago).

### 3. `galeria_visitantes` não é atualizado
- `fotos_selecionadas = 0` para ambos visitantes
- `status = 'em_andamento'` para ambos (deveria ser `finalizado` após confirmar)
- `status_selecao = 'selecao_iniciada'` (deveria ser `selecao_completa`)

O `confirm-selection` atualiza apenas `galerias.fotos_selecionadas` e `galerias.status_selecao`, mas **nunca** atualiza `galeria_visitantes`.

### 4. Tela finalizada mostra "0 fotos selecionadas"
A rota `isFinalized` em `gallery-access` (linha 576-581) busca fotos com `galeria_fotos.is_selected = true`. Para galerias públicas, as seleções estão em `visitante_selecoes`, não em `galeria_fotos`. Resultado: retorna array vazio.

### 5. `galerias.total_fotos_extras_vendidas = 0` e `valor_total_vendido = 0`
O `confirm-selection` não atualiza esses campos para galerias públicas — a lógica de galeria única sobrescreveu os contadores.

### 6. Aba Seleção no painel do fotógrafo mostra dados globais
A aba "Seleção (0)" em `GalleryDetail` usa `galeria_fotos.is_selected` — que para galerias públicas está sempre `false`. Para galerias públicas, deveria mostrar um resumo agregado dos visitantes.

---

## Plano de correção (por etapas)

### Etapa 1 — Migração SQL: Lock por visitante + trigger de sync

1. **Nova RPC `try_lock_visitor_selection`**: Lock advisory por `visitante_id` em vez de `galeria_id`. Verifica `galeria_visitantes.status_selecao` em vez de `galerias.status_selecao`.

2. **Trigger na `galeria_visitantes`**: Ao atualizar `status` para `finalizado`, recalcular `galerias.total_fotos_extras_vendidas` e `valor_total_vendido` como soma de todos os visitantes.

### Etapa 2 — Edge Function `confirm-selection`: Branch visitante

Quando `visitorId` está presente:

| Aspecto | Antes | Depois |
|---|---|---|
| Lock | `try_lock_gallery_selection(galleryId)` | `try_lock_visitor_selection(visitorId)` |
| Update galeria | `galerias.status_selecao = selecao_completa` | **Não altera** status da galeria |
| Update visitante | Nada | `galeria_visitantes.status = 'finalizado'`, `status_selecao`, `fotos_selecionadas` |
| Cobrança `visitor_id` | NULL | `visitorId` passado no insert/body |
| Asaas checkout data | Sem `visitorId` | `visitorId` incluído no `asaasCheckoutData` |

### Etapa 3 — Edge Function `gallery-access`: Tela finalizada por visitante

Para galerias públicas com `isFinalized` (ou visitante com `status = 'finalizado'`):

- Se `visitorId` presente → buscar fotos de `visitante_selecoes WHERE visitante_id = X AND is_selected = true`
- Retornar `finalized: true` apenas quando o **visitante** finalizou, não quando a galeria finalizou
- Para visitantes que ainda não finalizaram, continuar mostrando a galeria normalmente

### Etapa 4 — Edge Function `asaas-gallery-payment`: Aceitar `visitor_id`

- Receber `visitorId` no body
- Popular `visitor_id` na cobrança criada

### Etapa 5 — Frontend `GalleryDetail.tsx`: Aba Seleção para públicas

Para galerias públicas, a aba "Seleção" não faz sentido como seleção global. Duas opções:
- Redirecionar para aba "Visitantes" como padrão
- Mostrar resumo agregado (total selecionadas por todos os visitantes)

### Etapa 6 — Correção retroativa dos dados de teste

```sql
-- Atualizar visitantes com contagem real
UPDATE galeria_visitantes SET fotos_selecionadas = 6, status = 'finalizado', status_selecao = 'selecao_completa' WHERE id = '4f7ee6bf-3641-4d8e-93ea-7b9f5d20291a';
UPDATE galeria_visitantes SET fotos_selecionadas = 3, status = 'finalizado', status_selecao = 'selecao_completa' WHERE id = 'ae688254-7c1d-4787-8698-0f75d733c538';

-- Associar cobranças aos visitantes corretos
UPDATE cobrancas SET visitor_id = '4f7ee6bf-3641-4d8e-93ea-7b9f5d20291a' WHERE id = '594ea992-8a89-4fae-b5fa-73126256835d';
UPDATE cobrancas SET visitor_id = 'ae688254-7c1d-4787-8698-0f75d733c538' WHERE id = '0fe53d0f-45b0-4db5-80b0-7647701d5201';

-- Atualizar galeria com totais corretos (9 extras, R$ 90)
UPDATE galerias SET total_fotos_extras_vendidas = 9, valor_total_vendido = 90 WHERE id = '151b6963-952b-4fea-9ffa-3a12377851fa';
```

---

## Arquivos a criar/editar

| Arquivo | Ação | Etapa |
|---|---|---|
| Nova migração SQL | RPC `try_lock_visitor_selection` + correção retroativa | 1, 6 |
| `supabase/functions/confirm-selection/index.ts` | Branch completo para visitantes (lock, update, cobrança) | 2 |
| `supabase/functions/gallery-access/index.ts` | Tela finalizada busca de `visitante_selecoes` para públicas | 3 |
| `supabase/functions/asaas-gallery-payment/index.ts` | Aceitar e popular `visitor_id` | 4 |
| `src/pages/GalleryDetail.tsx` | Aba Seleção adaptada para galerias públicas | 5 |

### Impacto em galerias privadas
Zero. Todas as mudanças são condicionais: `if (visitorId) { ... }`. O fluxo privado permanece inalterado.

