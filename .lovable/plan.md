

## Diagnóstico: Histórico de Ações Incompleto nas Galerias

### Problema Principal: RLS bloqueia ações de clientes

A política RLS da tabela `galeria_acoes` é `auth.uid() = user_id`. Ações do cliente (acesso, seleção, pagamento) são inseridas com `user_id: null` pelas edge functions (que usam service_role). Porém, quando o fotógrafo consulta o histórico no frontend, o SELECT com RLS **nunca retorna** essas linhas porque `null != auth.uid()`.

### Ações que já são logadas (mas invisíveis ao fotógrafo)
| Tipo | Onde é inserido | user_id |
|------|----------------|---------|
| `criada` | useSupabaseGalleries | photographer ✅ |
| `enviada` | useSupabaseGalleries | photographer ✅ |
| `cliente_acessou` | gallery-access | null ❌ invisível |
| `cliente_confirmou` | confirm-selection | null ❌ invisível |
| `pagamento_informado` | client-selection | null ❌ invisível |
| `pagamento_confirmado` | webhooks | null ❌ invisível |
| `selecao_reaberta` | useSupabaseGalleries | photographer ✅ |

### Ações que NÃO são logadas (faltam)
- **Galeria expirou** — nenhum lugar insere `tipo: 'expirada'`
- **Seleção iniciada** (primeiro clique em selecionar foto) — `client-selection` loga foto individual mas não loga início da seleção como evento de timeline
- **Cada acesso subsequente** do cliente — só o primeiro acesso é logado

---

### Correções Propostas

#### 1. Corrigir RLS de `galeria_acoes` (SQL migration)
Alterar a política para que o fotógrafo veja ações da própria galeria (via join com `galerias.user_id`):

```sql
DROP POLICY "Users can manage own gallery actions" ON galeria_acoes;

-- Fotógrafo pode ver todas as ações das suas galerias (incluindo user_id null)
CREATE POLICY "Owner can view gallery actions" ON galeria_acoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM galerias g 
      WHERE g.id = galeria_acoes.galeria_id 
      AND g.user_id = auth.uid()
    )
  );

-- Fotógrafo pode inserir ações nas suas galerias
CREATE POLICY "Owner can insert gallery actions" ON galeria_acoes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Edge functions com service_role continuam inserindo com user_id: null (bypass RLS)
```

#### 2. Adicionar novos tipos de ação no `ActionTimeline.tsx`
- Adicionar ícones/cores para: `pagamento_informado`, `pagamento_confirmado`, `expirada`, `selecao_iniciada`
- Atualizar `GalleryAction['type']` em `types/gallery.ts` para incluir: `'payment_informed'`, `'payment_confirmed'`, `'expired'`, `'selection_started'`

#### 3. Adicionar log de expiração
Na edge function `gallery-access`, quando detecta que a galeria expirou, inserir ação `tipo: 'expirada'`.

#### 4. Adicionar log de "seleção iniciada" 
Na edge function `client-selection`, quando a galeria muda de `enviado` para `selecao_iniciada`, inserir ação `tipo: 'selecao_iniciada'`.

#### 5. Atualizar o mapeamento no `GalleryDetail.tsx`
Incluir os novos tipos no `typeMap` e `relevantTypes` para que apareçam na timeline.

---

### Arquivos alterados
- **Migration SQL** — nova política RLS em `galeria_acoes`
- **`src/types/gallery.ts`** — novos tipos de ação
- **`src/components/ActionTimeline.tsx`** — novos ícones/cores para tipos adicionais
- **`src/pages/GalleryDetail.tsx`** — mapear novos tipos na timeline
- **`supabase/functions/gallery-access/index.ts`** — log de expiração
- **`supabase/functions/client-selection/index.ts`** — log de início de seleção

### Impacto
- Edge functions de InfinitePay e create-link **não são alteradas**
- Histórico retroativo: ações já inseridas com `user_id: null` passarão a ser visíveis imediatamente após a correção de RLS

