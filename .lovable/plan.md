
# Plano: Correção do Loading Infinito no Dashboard

## Diagnóstico

A tela mostra um spinner infinito que corresponde ao `ProtectedRoute`, indicando que o estado `loading` do `useAuth` nunca se resolve para `false`.

### Análise do Fluxo

```text
App.tsx
  └─► AuthProvider
       └─► ProtectedRoute (loading = true → spinner infinito)
            └─► Layout
                 └─► Dashboard (nunca renderiza)
```

### Possíveis Causas

| Causa | Probabilidade | Impacto |
|-------|--------------|---------|
| `useAuth` não resolvendo loading | Alta | Bloqueia toda a aplicação |
| Erro silencioso no Supabase client | Média | Chamadas auth penduradas |
| Race condition entre hooks | Baixa | Estado inconsistente |

---

## Problemas Identificados

### 1. Falta de Tratamento de Erro em `useAuth`

O hook `useAuth` não tem tratamento para quando as chamadas do Supabase falham silenciosamente:

```typescript
// useAuth.ts atual - sem try/catch
supabase.auth.getSession().then(({ data: { session } }) => {
  // Se houver erro de rede, isso não executa
  setLoading(false); // Nunca é chamado
});
```

### 2. Ausência de Timeout de Segurança

Não há mecanismo de timeout para garantir que o loading sempre resolva, mesmo em caso de falhas.

### 3. Log Insuficiente para Debug

O código atual não tem logs suficientes para identificar onde o fluxo está travando.

---

## Solução

### Correção 1: Adicionar Tratamento de Erro Robusto em `useAuth`

```typescript
// src/hooks/useAuth.ts
useEffect(() => {
  console.log('🔄 useAuth: Setting up auth listener...');
  
  let isSubscribed = true;
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log('🔔 Auth state changed:', event, session?.user?.email);
      if (isSubscribed) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    }
  );

  // Verificação inicial com tratamento de erro
  supabase.auth.getSession()
    .then(({ data: { session }, error }) => {
      console.log('📋 Initial session check:', session?.user?.email, error);
      if (isSubscribed) {
        if (error) {
          console.error('❌ Session error:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    })
    .catch((error) => {
      console.error('❌ Session fetch failed:', error);
      if (isSubscribed) {
        setLoading(false); // IMPORTANTE: Resolver loading mesmo com erro
      }
    });

  // Timeout de segurança - 5 segundos máximo
  const timeout = setTimeout(() => {
    if (isSubscribed) {
      console.warn('⚠️ Auth timeout - resolving loading state');
      setLoading(false);
    }
  }, 5000);

  return () => {
    isSubscribed = false;
    clearTimeout(timeout);
    subscription.unsubscribe();
  };
}, []);
```

### Correção 2: Adicionar Log Detalhado no AuthContext

```typescript
// src/contexts/AuthContext.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, session, loading, signInWithGoogle, signOut } = useAuth();
  const { /* ... */ } = useGalleryAccess(user);

  // Log para debug
  useEffect(() => {
    console.log('📊 AuthContext state:', {
      user: user?.email,
      loading,
      accessLoading,
      accessLevel,
    });
  }, [user, loading, accessLoading, accessLevel]);

  // ... resto do código
}
```

### Correção 3: Verificar Variáveis de Ambiente do Supabase

Garantir que o cliente Supabase está inicializado corretamente:

```typescript
// src/integrations/supabase/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Adicionar verificação
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ Supabase environment variables not set!');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✓ set' : '✗ missing');
  console.error('SUPABASE_KEY:', SUPABASE_PUBLISHABLE_KEY ? '✓ set' : '✗ missing');
}

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://tlnjspsywycbudhewsfv.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  // ... options
);
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/hooks/useAuth.ts` | Adicionar tratamento de erro e timeout |
| 2 | `src/contexts/AuthContext.tsx` | Adicionar logs de debug |
| 3 | `src/integrations/supabase/client.ts` | Verificar variáveis de ambiente |

---

## Isolamento de Galerias por Usuário

A pergunta sobre cada usuário ter acesso apenas às suas galerias já está corretamente implementada via RLS:

```sql
-- Política existente na tabela galerias
CREATE POLICY "Photographers manage own galleries"
ON public.galerias
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

Isso garante que:
- Cada usuário só vê suas próprias galerias (`SELECT`)
- Cada usuário só pode criar galerias vinculadas ao seu ID (`INSERT`)
- Cada usuário só pode editar/excluir suas próprias galerias (`UPDATE/DELETE`)

---

## Resultado Esperado

Após as correções:

1. O loading sempre resolverá em no máximo 5 segundos
2. Erros serão capturados e logados no console
3. O usuário verá mensagens de erro apropriadas em vez de spinner infinito
4. Cada usuário continuará vendo apenas suas próprias galerias

---

## Testes de Verificação

Após implementar:
1. Recarregar a página e verificar se o dashboard carrega
2. Verificar console para logs de debug
3. Testar login com diferentes usuários para confirmar isolamento de galerias
