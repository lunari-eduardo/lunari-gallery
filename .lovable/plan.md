
# Plano: corrigir galerias afetadas e blindar o Gallery contra valores absurdos

## Diagnóstico (resumido)

5 galerias do usuário `db0ca3d8-…` ficaram com `valor_foto_extra = 250,05` ao serem criadas via Gestão. A causa real está no Gestão (pacote "Mães 26 5 fotos" foi salvo com `250,05` por um bug do `useCurrencyInput` que escala valores quando o select-all do focus falha). **O Gallery apenas copiou o que o Gestão enviou** — ele não tem nenhuma validação de sanidade que rejeitasse esse valor.

Nesta fase, **não mexemos no Gestão**. Apenas corrigimos as galerias afetadas e plantamos as defesas no Gallery para que esse tipo de erro pare de propagar daqui pra frente.

## Parte 1 — Corrigir as galerias afetadas (one-shot)

5 galerias identificadas, todas do mesmo pacote/categoria:

| id | nome_pacote | valor_foto_extra hoje | regras_congeladas.valorFotoExtra hoje |
|---|---|---|---|
| `4e4f061d-c0da-494b-beb7-f47b1ce58391` | Mães 26 5 fotos | 250,05 | 250,05 |
| `622a5169-e4fe-486a-8fcf-e76dd353e551` | Mães 26 5 fotos | 250,05 | 250,05 |
| `4336dc90-0af8-40c0-9962-39a1f51a8a2d` | Mães 26 5 fotos | 250,05 | 250,05 |
| `6a4df771-27fc-4ab1-a433-13de03966e24` | Mães 26 5 fotos | 25,00 (já ok) | 250,05 (precisa sanear) |
| `b99f2efc-80c9-47c5-9036-414555e3e3d4` | Mães 26 5 fotos | 25,00 (já ok) | 250,05 (precisa sanear) |

Operação SQL (executada via tool de inserção, não migração — são updates de dados):

```sql
-- 1. Corrigir o valor_foto_extra das 3 galerias com valor errado
UPDATE galerias
SET valor_foto_extra = 25.00,
    updated_at = now()
WHERE id IN (
  '4e4f061d-c0da-494b-beb7-f47b1ce58391',
  '622a5169-e4fe-486a-8fcf-e76dd353e551',
  '4336dc90-0af8-40c0-9962-39a1f51a8a2d'
);

-- 2. Sanear o valorFotoExtra dentro do JSONB regras_congeladas das 5 galerias
UPDATE galerias
SET regras_congeladas = jsonb_set(
      regras_congeladas,
      '{pacote,valorFotoExtra}',
      '25'::jsonb,
      false
    ),
    updated_at = now()
WHERE id IN (
  '4e4f061d-c0da-494b-beb7-f47b1ce58391',
  '622a5169-e4fe-486a-8fcf-e76dd353e551',
  '4336dc90-0af8-40c0-9962-39a1f51a8a2d',
  '6a4df771-27fc-4ab1-a433-13de03966e24',
  'b99f2efc-80c9-47c5-9036-414555e3e3d4'
);
```

> Antes de executar, vou rodar um SELECT de confirmação mostrando os 5 registros e pedindo seu OK final. Se alguma dessas galerias já tem cobranças geradas (verificarei em `cobrancas` e `clientes_sessoes`), aviso antes de tocar para você decidir se reprocessa também.

## Parte 2 — Blindar o Gallery (prevenção)

### 2.1 — Validar `preco_da_foto_extra` na entrada via URL

Arquivo: `src/hooks/useGestaoParams.ts` (linhas 67–69).

Hoje qualquer número >= 0 é aceito. Adicionar teto de R$ 999,99 (cobre 100% dos pacotes premium reais; o p99 do banco hoje é R$ 140) e logar valores suspeitos:

```ts
preco_da_foto_extra: (() => {
  if (!precoFotoExtra) return undefined;
  const v = parseFloat(precoFotoExtra);
  if (isNaN(v) || v < 0) return undefined;
  if (v > 999.99) {
    console.warn('[useGestaoParams] preco_da_foto_extra fora do range esperado, descartado:', v);
    return undefined; // força o usuário a digitar manualmente
  }
  return v;
})(),
```

### 2.2 — Substituir a "normalização heurística" por sanitização explícita

Arquivos:
- `src/lib/pricingUtils.ts` (função `normalizarValor`).
- `src/pages/GalleryCreate.tsx` (linhas 437 e 481, onde tem `valor > 1000 ? valor/100 : valor`).
- `src/pages/ClientGallery.tsx` (verificar uso indireto via `pricingUtils`).

Hoje:
```ts
if (valor > 1000) return valor / 100; // assume centavos
```

Essa heurística:
- não pegou o caso `250,05` (250 não é > 1000);
- é perigosa para pacotes legítimos: um pacote de R$ 1.500 viraria R$ 15.

Trocar por uma função clara que **não converte centavos** (Gestão hoje já grava em reais; quando algum dia houver migração de centavos, será explícita) e apenas faz clamp de segurança:

```ts
export function sanitizeExtraPrice(value: unknown): number {
  const v = typeof value === 'number' ? value : parseFloat(String(value));
  if (!isFinite(v) || v < 0) return 0;
  if (v > 999.99) {
    console.warn('[sanitizeExtraPrice] valor acima do limite esperado:', v);
    return 999.99;
  }
  return Math.round(v * 100) / 100; // 2 casas decimais
}
```

`normalizarValor` é mantido como alias deprecated por 1 ciclo para não quebrar imports, mas internamente delega para `sanitizeExtraPrice`. Removo as conversões inline em `GalleryCreate.tsx`.

### 2.3 — Aviso visual no Passo 6 (Revisão) do GalleryCreate

Arquivo: `src/pages/GalleryCreate.tsx` (perto da linha 2008, onde aparece "R$ {fixedPrice.toFixed(2)}").

Quando `fixedPrice > 100`, adicionar um banner amarelo discreto:

> ⚠️ **Confira: R$ XXX,XX por foto extra.** Valores acima de R$ 100 são incomuns. Se estiver errado, volte ao Passo 2.

Isso dá uma última chance ao fotógrafo de pegar o erro antes de criar a galeria.

### 2.4 — Máscara consistente no input manual do Passo 2

Arquivo: `src/pages/GalleryCreate.tsx` (linha 1451).

Hoje é `<Input type="number" step={0.01}>` cru. Adicionar `min={0}` e `max={999.99}` no atributo nativo + `onBlur` que aplica `sanitizeExtraPrice`. Não vou criar um hook de máscara monetária aqui (manteria simples para esta fase) — o `type="number"` nativo já evita digitar dígitos extras como aconteceu no Gestão.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| **DB (5 galerias)** | UPDATEs corrigindo `valor_foto_extra` e `regras_congeladas.pacote.valorFotoExtra` para 25.00 |
| `src/hooks/useGestaoParams.ts` | validar `preco_da_foto_extra` (≤ 999.99), descartar valores fora do range |
| `src/lib/pricingUtils.ts` | criar `sanitizeExtraPrice`, marcar `normalizarValor` como deprecated alias |
| `src/pages/GalleryCreate.tsx` | usar `sanitizeExtraPrice` (remover `/100 if >1000`); banner amarelo no Passo 6 se >R$ 100; clamp no input do Passo 2 |
| `src/pages/ClientGallery.tsx` | usar `sanitizeExtraPrice` onde aplicável |

**Não mexemos** em: webhooks, edge functions de pagamento (Asaas/InfinitePay/MP), RLS, integração Studio, fluxo de upload, hooks de créditos.

## Validação

1. Rodar SELECT pré-update mostrando os 5 registros antes de aplicar (você confirma);
2. Após UPDATE: SELECT mostrando os 5 registros já corrigidos com valor 25,00;
3. Reabrir as 5 galerias afetadas como cliente final → preço da foto extra aparece R$ 25,00;
4. Criar nova galeria via Gestão usando outro pacote → fluxo normal funciona;
5. Simular URL maliciosa `?preco_da_foto_extra=99999` → param descartado, log no console;
6. Criar galeria manual com `fixedPrice = 200` → banner amarelo aparece no Passo 6;
7. Reabrir uma galeria antiga com pacote legítimo (ex: R$ 35 por foto) → continua funcionando, sem alteração;
8. `npm run build` sem erros TS.

## O que fica para depois

O bug raiz no `useCurrencyInput` do **Lunari_gestão** (que escala valores quando o select-all falha no focus) **continuará reproduzível no Gestão** até ser corrigido lá. Recomendo abrir uma tarefa separada para isso quando você quiser. As defesas plantadas aqui no Gallery garantem que, mesmo se acontecer de novo, **o valor errado não chega a virar uma galeria** — o teto de R$ 999,99 e o banner de aviso pegariam.

## Resultado esperado

- As 5 galerias afetadas voltam a cobrar R$ 25,00 por foto extra;
- Galerias futuras vindas do Gestão são protegidas por validação de range;
- A heurística "/100 if >1000" é eliminada (deixa de ser fonte silenciosa de bugs em pacotes premium);
- Fotógrafo recebe aviso visual quando o valor é incomum, antes de a galeria ser publicada;
- Nenhum impacto em pagamentos, integração Studio, ou em galerias com pacotes de preços legítimos.
