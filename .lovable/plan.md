

# Galerias Públicas Multiusuário — Plano por Etapas

## Contexto atual

Hoje, galerias públicas compartilham `is_selected`, `is_favorite` e `comment` diretamente na tabela `galeria_fotos`. Qualquer visitante vê e modifica a mesma seleção. Não existe conceito de "visitante" — apenas fotos com flags globais. Existem 10 galerias públicas no banco (vs 124 privadas).

Galerias **privadas** continuam funcionando como hoje: 1 cliente = 1 seleção direta em `galeria_fotos`. A mudança afeta **apenas** galerias com `permissao = 'public'`.

## Visão geral da solução

```text
┌──────────────────────────────────────────────┐
│                  galeria_fotos                │
│  (fotos da galeria — sem seleção p/ públicas) │
└──────────────┬───────────────────────────────┘
               │ 1:N
┌──────────────▼───────────────────────────────┐
│            galeria_visitantes                 │
│  id, galeria_id, nome, contato, contato_tipo, │
│  device_hash, status, created_at              │
└──────────────┬───────────────────────────────┘
               │ 1:N
┌──────────────▼───────────────────────────────┐
│         visitante_selecoes                    │
│  id, visitante_id, foto_id, is_selected,      │
│  is_favorite, comment, updated_at             │
└──────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│            cobrancas                          │
│  + visitor_id (UUID nullable, FK)             │
└──────────────────────────────────────────────┘
```

---

## ETAPA 1 — Banco de dados (migração SQL)

### Novas tabelas

**`galeria_visitantes`**
- `id` UUID PK
- `galeria_id` UUID FK → galerias
- `nome` TEXT NOT NULL
- `contato` TEXT NOT NULL (email ou whatsapp)
- `contato_tipo` TEXT NOT NULL ('email' | 'whatsapp')
- `device_hash` TEXT — hash do dispositivo para sessão persistente
- `status` TEXT DEFAULT 'em_andamento' ('em_andamento' | 'finalizado')
- `status_selecao` TEXT DEFAULT 'selecao_iniciada'
- `fotos_selecionadas` INTEGER DEFAULT 0
- `finalized_at` TIMESTAMPTZ
- `created_at` / `updated_at`
- UNIQUE(galeria_id, contato) — um visitante por contato por galeria

**`visitante_selecoes`**
- `id` UUID PK
- `visitante_id` UUID FK → galeria_visitantes
- `foto_id` UUID FK → galeria_fotos
- `is_selected` BOOLEAN DEFAULT false
- `is_favorite` BOOLEAN DEFAULT false
- `comment` TEXT
- `updated_at`
- UNIQUE(visitante_id, foto_id)

### Alteração em tabela existente

**`cobrancas`** — adicionar coluna:
- `visitor_id` UUID nullable FK → galeria_visitantes

### RLS

- `galeria_visitantes`: fotógrafo (user_id via galerias) pode SELECT; anon pode INSERT (registro) e SELECT próprio via device_hash
- `visitante_selecoes`: acesso apenas via Edge Functions (service role)
- `cobrancas.visitor_id`: RLS existente já cobre (user_id based)

---

## ETAPA 2 — Tela de Identificação do Visitante (Frontend)

### Novo componente: `VisitorIdentificationScreen`

Exibido **antes** de mostrar as fotos, apenas para galerias públicas (`permissao = 'public'`). Mesma estética do `PasswordScreen`.

- Campos: Nome (obrigatório), WhatsApp ou E-mail (obrigatório, com toggle)
- Botão: "Entrar na galeria"
- Ao submeter: chama Edge Function que cria/recupera visitante
- Gera `device_hash` (fingerprint simples: contato + user-agent hash)
- Salva `visitor_id` em `localStorage` keyed por token da galeria
- Se visitante já existir (mesmo contato na galeria): recupera sessão e seleção

### Persistência de sessão

- `localStorage.getItem(`gallery_visitor_${token}`)` → se existir, pula tela de identificação
- Edge Function valida que o visitor_id existe e pertence àquela galeria

---

## ETAPA 3 — Edge Functions (client-selection + confirm-selection + gallery-access)

### `client-selection` — adaptar para visitantes

- Novo campo opcional no body: `visitorId`
- Se galeria é pública:
  - `visitorId` obrigatório
  - Operações de select/deselect/favorite/comment atuam em `visitante_selecoes` (INSERT ON CONFLICT UPDATE) em vez de `galeria_fotos`
  - `galeria_fotos.is_selected` **não é tocado** para galerias públicas
- Se galeria é privada: comportamento atual inalterado

### `confirm-selection` — adaptar para visitantes

- Novo campo opcional: `visitorId`
- Se galeria pública + visitorId:
  - Conta `selectedCount` de `visitante_selecoes WHERE visitante_id = X AND is_selected = true`
  - Cria cobrança com `visitor_id` preenchido
  - Atualiza `galeria_visitantes.status = 'finalizado'`
  - **NÃO** atualiza `galerias.status_selecao` (cada visitante tem ciclo independente)
- Se galeria privada: fluxo atual inalterado

### `gallery-access` — adaptar resposta

- Se galeria pública e `visitorId` informado no body:
  - Retorna fotos com seleção do visitante (JOIN com `visitante_selecoes`)
  - Retorna `visitorId` e `visitorName` na resposta
- Novo endpoint/action: `register-visitor` (ou embutido no gallery-access)
  - Recebe nome + contato → cria/recupera visitante → retorna `visitorId`

### Nova Edge Function: `gallery-visitors`

- Endpoint autenticado (fotógrafo) para listar visitantes de uma galeria
- Retorna: nome, contato, fotos selecionadas (count), status, status pagamento
- Retorna seleção detalhada de um visitante específico (com query param)

---

## ETAPA 4 — Frontend: Galeria Pública com Seleção por Visitante

### `ClientGallery.tsx` — mudanças

1. Após carregar galeria, verificar se `permissao === 'public'`
2. Se pública: verificar `localStorage` para `visitor_id`
   - Sem visitor: mostrar `VisitorIdentificationScreen`
   - Com visitor: carregar fotos com seleção do visitante
3. `selectionMutation` passa `visitorId` no body
4. `confirmMutation` passa `visitorId` no body
5. Banner sutil no topo: "Olá, {nome} — você está selecionando suas fotos"
6. Pricing/contagem usa `visitante_selecoes` em vez de `galeria_fotos`

---

## ETAPA 5 — Painel do Fotógrafo: Visualização de Visitantes

### `GalleryDetail.tsx` — nova aba "Visitantes"

Visível apenas para galerias públicas. Exibe:

| Nome | Contato | Fotos selecionadas | Status | Pagamento |
|---|---|---|---|---|
| João | (11) 99999 | 15 | Finalizado | Pago |
| Maria | maria@... | 8 | Em andamento | — |

**Ao clicar em um visitante**: expande ou navega para detalhe mostrando:
- Grid das fotos selecionadas por aquele visitante
- Resumo financeiro (extras, valor, pagamento)
- Ações: marcar como finalizado, reenviar link

---

## ETAPA 6 — Pagamentos por Visitante

- `cobrancas` passa a ter `visitor_id` para galerias públicas
- Webhooks (InfinitePay, MercadoPago, Asaas) não mudam — já identificam por `cobranca_id`
- `finalize_gallery_payment` RPC: se cobrança tem `visitor_id`, atualiza `galeria_visitantes.status` em vez de `galerias.status_selecao`
- `PaymentPendingScreen` e `PaymentRedirect` passam `visitorId` nas requisições

---

## Arquivos a criar/editar

| Arquivo | Ação | Etapa |
|---|---|---|
| Nova migração SQL | Criar tabelas + coluna visitor_id | 1 |
| `src/components/VisitorIdentificationScreen.tsx` | Criar | 2 |
| `supabase/functions/client-selection/index.ts` | Editar — branch público/privado | 3 |
| `supabase/functions/confirm-selection/index.ts` | Editar — branch público/privado | 3 |
| `supabase/functions/gallery-access/index.ts` | Editar — aceitar visitorId, retornar seleção do visitante | 3 |
| `supabase/functions/gallery-visitors/index.ts` | Criar | 3 |
| `src/pages/ClientGallery.tsx` | Editar — tela de identificação + visitorId em mutations | 4 |
| `src/pages/GalleryDetail.tsx` | Editar — nova aba "Visitantes" | 5 |
| `supabase/functions/finalize-gallery-payment` (RPC SQL) | Editar — branch visitor_id | 6 |
| `supabase/functions/asaas-gallery-payment/index.ts` | Editar — passar visitor_id | 6 |
| `supabase/functions/gallery-create-payment/index.ts` | Editar — passar visitor_id | 6 |

## Ordem de implementação recomendada

1. **Etapa 1** — Migração SQL (tabelas + coluna) — base segura sem impacto
2. **Etapa 2** — Tela de identificação (componente isolado)
3. **Etapa 3** — Edge Functions (branch condicional — galerias privadas não são afetadas)
4. **Etapa 4** — Integração no ClientGallery
5. **Etapa 5** — Painel do fotógrafo
6. **Etapa 6** — Pagamentos por visitante

Cada etapa pode ser implementada e testada independentemente sem quebrar o fluxo existente de galerias privadas.

## Riscos e mitigações

- **Galerias públicas existentes com seleção global**: as 10 galerias públicas atuais terão suas seleções em `galeria_fotos` preservadas. Após a migração, novas seleções usarão `visitante_selecoes`. Não há migração retroativa necessária.
- **InfinitePay/MercadoPago webhooks**: não são afetados — continuam usando `cobranca_id` para resolver pagamento. O `visitor_id` é apenas metadata adicional.
- **Performance**: `visitante_selecoes` terá índice em `(visitante_id, foto_id)` UNIQUE + índice em `foto_id` para JOINs.

