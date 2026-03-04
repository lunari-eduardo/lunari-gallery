

## Plano: Unificar PLANS nas Edge Functions compartilhadas

### Problema

As 4 Edge Functions de assinatura têm mapas de planos divergentes:

| Função | `studio_starter/pro` | `combo_pro_select2k` | Preços corretos | `monthlyPrice` |
|---|---|---|---|---|
| `asaas-create-subscription` | Ausentes | OK | Parcialmente | OK |
| `asaas-upgrade-subscription` | OK | Usa `combo_studio_pro` (nome errado) | Preços diferentes | Sem `monthlyPrice` |
| `asaas-create-payment` | Ausentes | Usa `combo_studio_pro` | Preços diferentes | Sem campo mensal |
| `asaas-downgrade-subscription` | OK | OK | OK | OK (campo `monthly`) |
| `asaas-webhook` | OK | OK | OK | OK |

Consequência: deploy do Gallery sobrescreve funções e remove planos Studio, causando erro 400 no Gestão.

### Correções (3 arquivos)

**1. `asaas-create-subscription/index.ts` (linhas 13-21)**
- Adicionar `studio_starter` e `studio_pro` ao mapa PLANS
- Corrigir nome do `combo_completo` para "Combo Completo"
- Adicionar comentário de sincronização

**2. `asaas-upgrade-subscription/index.ts` (linhas 13-22)**
- Trocar tipo do PLANS para incluir `monthlyPrice` (necessário para upgrades mensais)
- Adicionar `studio_starter`, `studio_pro`
- Corrigir `combo_studio_pro` para `combo_pro_select2k`
- Alinhar preços com os valores canônicos

**3. `asaas-create-payment/index.ts` (linhas 14-21)**
- Adicionar `monthlyPrice` ao tipo
- Adicionar `studio_starter`, `studio_pro`
- Corrigir `combo_studio_pro` para `combo_pro_select2k`
- Alinhar preços

**Mapa canônico (fonte da verdade):**
```
studio_starter:    monthly 1490, yearly 15198
studio_pro:        monthly 3590, yearly 36618
transfer_5gb:      monthly 1290, yearly 12384
transfer_20gb:     monthly 2490, yearly 23904
transfer_50gb:     monthly 3490, yearly 33504
transfer_100gb:    monthly 5990, yearly 57504
combo_pro_select2k: monthly 4490, yearly 45259
combo_completo:    monthly 6490, yearly 66198
```

`asaas-downgrade-subscription` e `asaas-webhook` ja estao corretos -- nenhuma alteracao necessaria.

### Redeploy

Apos editar, fazer deploy das 3 funcoes alteradas.

