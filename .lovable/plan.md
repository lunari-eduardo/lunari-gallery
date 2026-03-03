

## Plano: Proteção contra Duplicação de Assinaturas

### Problema

Os cards de combo e transfer combo na página de planos não verificam se o usuário já possui o plano ativo. O botão "Conhecer plano completo" sempre leva ao checkout, permitindo recompra do mesmo plano e gerando assinaturas duplicadas.

### Alterações

#### 1. `src/pages/CreditsCheckout.tsx` — Detecção de plano ativo em todos os cards

**Transfer cards (linhas 600-754):** Já detectam `isCurrentPlan` para Transfer isolados. OK.

**Combo cards na aba Select (linhas 450-510):** Adicionar lógica de detecção:
- Verificar se `activeSubs` contém uma sub com `plan_type` igual ao combo (`combo_pro_select2k` ou `combo_completo`)
- Se sim → badge "Plano atual" + botão "Gerenciar assinatura" (navega para `/credits/subscription`)
- Se o plano ativo é superior (combo_completo ativo e card é combo_pro_select2k) → mostrar como downgrade

**Transfer combo block (linhas 768-804):** Mesma lógica:
- Se `activeSubs` contém `combo_completo` → badge "Plano atual" + botão "Gerenciar assinatura"
- Se user tem plano superior → ocultar ou desabilitar

**Lógica de hierarquia de planos:** Criar helper `getPlanHierarchyLevel(planType)` que retorna um número representando o nível do plano. Comparar níveis para determinar se é upgrade, downgrade ou plano atual.

```text
Hierarquia (do menor ao maior):
transfer_5gb < transfer_20gb < transfer_50gb < transfer_100gb
combo_pro_select2k < combo_completo
studio_starter < studio_pro
Cross-family: combo_completo > qualquer transfer isolado
```

#### 2. `src/pages/CreditsCheckout.tsx` — `handleSubscribe` guard

No início de `handleSubscribe`, verificar:
- Se `planType` já existe em `activeSubs` com status ACTIVE/PENDING → bloquear com `toast.error('Você já possui este plano ativo.')` e return
- Incluir verificação para subs com `status === 'CANCELLED'` mas `next_due_date` no futuro (período ativo restante)

#### 3. `src/pages/CreditsPayment.tsx` — Guard no checkout

No mount do componente de checkout, se `type === 'subscription'`:
- Buscar subs ativas via `useAsaasSubscription`
- Se `planType` do state já está ativo → mostrar mensagem de erro e redirecionar para `/credits/subscription`
- Isso serve como proteção dupla (caso o usuário acesse a URL diretamente)

#### 4. Comportamento por caso

| Estado | Card mostra | Botão |
|--------|-------------|-------|
| Plano exatamente igual e ativo (recorrente ou parcelado dentro da validade) | Badge "Plano atual" | "Gerenciar assinatura" → `/credits/subscription` |
| Plano inferior ao ativo | Normal | "Agendar downgrade" |
| Plano superior ao ativo | Normal com prorata | "Fazer upgrade" |
| Plano parcelado expirado | Normal | "Assinar" (permite recompra) |
| Sem plano ativo | Normal | "Assinar" |

#### 5. Arquivos modificados

- `src/pages/CreditsCheckout.tsx` — guards nos cards de combo e transfer combo + guard em handleSubscribe
- `src/pages/CreditsPayment.tsx` — guard no mount contra plano duplicado
- `src/lib/transferPlans.ts` — adicionar helper `getPlanHierarchyLevel`

