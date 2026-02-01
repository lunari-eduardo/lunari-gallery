
# Corrigir Modo Escuro na Tela de Senha

## Problema Identificado

Quando a galeria requer senha, a Edge Function `gallery-access` retorna apenas um subset mínimo de dados:

```typescript
// Resposta atual quando precisa de senha:
{
  requiresPassword: true,
  galleryId: gallery.id,
  sessionName: gallery.nome_sessao,
  // ❌ NÃO inclui theme
  // ❌ NÃO inclui clientMode
}
```

Como resultado, no frontend:
- `galleryResponse?.theme?.backgroundMode` = `undefined`
- `galleryResponse?.clientMode` = `undefined`
- Fallback: `'light'` ← Sempre claro!

## Solução

Incluir as informações de tema na resposta de "requer senha" para que o frontend possa aplicar o modo correto desde a primeira tela.

### Modificação na Edge Function

**Arquivo:** `supabase/functions/gallery-access/index.ts`

Alterar a resposta quando `requiresPassword: true` para incluir o `clientMode` das configurações da galeria:

```typescript
// Antes (linha 55-64)
if (!password) {
  return new Response(
    JSON.stringify({ 
      requiresPassword: true, 
      galleryId: gallery.id,
      sessionName: gallery.nome_sessao,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Depois
if (!password) {
  // Extract clientMode from gallery config for password screen theming
  const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
  const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
  
  return new Response(
    JSON.stringify({ 
      requiresPassword: true, 
      galleryId: gallery.id,
      sessionName: gallery.nome_sessao,
      clientMode: clientMode,  // ← NOVO: Permite tela de senha respeitar o modo
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Isso garante que mesmo antes de validar a senha, o frontend sabe qual modo (claro/escuro) aplicar.

## Fluxo Corrigido

```text
┌───────────────────────────────────────────────────────────────────────┐
│  RESPOSTA QUANDO REQUER SENHA - CORRIGIDA                            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Edge Function retorna:                                               │
│  {                                                                    │
│    requiresPassword: true,                                            │
│    galleryId: "...",                                                  │
│    sessionName: "Ensaio Maria",                                       │
│    clientMode: "dark"          ← NOVO: Agora incluído!               │
│  }                                                                    │
│                                                                       │
│  Frontend calcula:                                                    │
│    effectiveBackgroundMode = theme?.backgroundMode                    │
│                            || clientMode     ← Pega "dark"!          │
│                            || 'light'                                 │
│                                                                       │
│  Resultado: Tela de senha em modo escuro ✓                           │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/gallery-access/index.ts` | Incluir `clientMode` na resposta de "requer senha" |

## Testes a Realizar

1. **Galeria privada com modo escuro**
   - Acessar galeria que requer senha com modo escuro configurado
   - Verificar que a tela de senha aparece em modo escuro

2. **Galeria privada com modo claro**
   - Acessar galeria que requer senha com modo claro configurado
   - Verificar que a tela de senha aparece em modo claro

3. **Galeria pública (sem senha)**
   - Verificar que continua funcionando normalmente
