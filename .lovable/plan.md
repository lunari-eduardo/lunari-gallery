

# Correção: Sincronização de expiração com `clientes_sessoes`

## Causa raiz

O `useEffect` de sincronização no Dashboard (adicionado recentemente) atualiza `galerias.status` para `expirado`, mas **nunca atualiza `clientes_sessoes.status_galeria`** para `expirada`. O projeto Gestao lê exclusivamente de `clientes_sessoes`, então nunca vê a mudança de status.

Adicionalmente, a reativação (`reopenSelectionMutation`) também não sincroniza de volta para `clientes_sessoes`, deixando o status como `expirada` mesmo após reativar.

## Correções

### 1. Dashboard sync -- adicionar sync de `clientes_sessoes` (`src/pages/Dashboard.tsx`)

Alterar o `useEffect` de sincronização para:
- Buscar o `sessionId` de cada galeria expirada
- Atualizar tanto `galerias.status` quanto `clientes_sessoes.status_galeria`
- Usar `Promise.all` em vez de `forEach(async)` para tratar erros corretamente
- Invalidar queries após as atualizações

```typescript
useEffect(() => {
  if (!supabaseGalleries.length) return;
  const expiredGalleries = supabaseGalleries.filter(g => {
    const isActive = ['enviado', 'selecao_iniciada'].includes(g.status);
    return isActive && g.prazoSelecao && isPast(g.prazoSelecao);
  });
  if (expiredGalleries.length === 0) return;

  const syncExpired = async () => {
    await Promise.all(expiredGalleries.map(async (g) => {
      await supabase
        .from('galerias')
        .update({ status: 'expirado', updated_at: new Date().toISOString() })
        .eq('id', g.id);

      // Sync to clientes_sessoes so Gestao sees the change
      if (g.sessionId) {
        await supabase
          .from('clientes_sessoes')
          .update({ status_galeria: 'expirada', updated_at: new Date().toISOString() })
          .eq('session_id', g.sessionId);
      }
    }));
    // Refresh data after syncing
    refetchGalleries();
  };
  syncExpired();
}, [supabaseGalleries]);
```

### 2. Reativacao -- sincronizar `clientes_sessoes` de volta (`src/hooks/useSupabaseGalleries.ts`)

No `reopenSelectionMutation`, após atualizar `galerias`, buscar o `session_id` e atualizar `clientes_sessoes.status_galeria` de volta para `em_selecao`:

```typescript
// After updating galerias, sync session status
const { data: gallery } = await supabase
  .from('galerias')
  .select('session_id')
  .eq('id', id)
  .single();

if (gallery?.session_id) {
  await supabase
    .from('clientes_sessoes')
    .update({ status_galeria: 'em_selecao', updated_at: new Date().toISOString() })
    .eq('session_id', gallery.session_id);
}
```

### 3. Corrigir galeria travada no banco

Atualizar manualmente a galeria da sessao especifica que ja expirou:

```sql
UPDATE galerias SET status = 'expirado', updated_at = NOW()
WHERE session_id = 'workflow-1771555514317-0gdkcymsiau' AND status = 'enviado';

UPDATE clientes_sessoes SET status_galeria = 'expirada', updated_at = NOW()
WHERE session_id = 'workflow-1771555514317-0gdkcymsiau';
```

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/Dashboard.tsx` | Adicionar sync de `clientes_sessoes` no useEffect + usar `Promise.all` |
| `src/hooks/useSupabaseGalleries.ts` | Adicionar sync de `clientes_sessoes` na reativacao |
| Migration SQL | Corrigir galeria travada |

## Fluxo corrigido

```text
Dashboard carrega -> detecta prazo vencido
  -> Atualiza galerias.status = 'expirado'
  -> Atualiza clientes_sessoes.status_galeria = 'expirada'  (NOVO)
  -> Gestao ve status atualizado

Fotografo reativa galeria
  -> galerias.status = 'selecao_iniciada'
  -> clientes_sessoes.status_galeria = 'em_selecao'  (NOVO)
  -> Gestao ve status restaurado
```
