

# Plano: Corrigir Race Condition de Autenticacao

## Problema Identificado

Ao acessar o sistema, multiplos erros 401 (Unauthorized) ocorrem em requisicoes para `user_roles`, `subscriptions` e `galerias`. O usuario precisa fazer logout e login novamente para que as galerias sejam carregadas.

```text
SEQUENCIA ATUAL (COM BUG)
────────────────────────────────────────────────────────────────────────

  T0: Pagina carrega
      │
      ▼
  T1: useAuth configura onAuthStateChange
      │
      ▼
  T2: INITIAL_SESSION dispara
      user = {email: "...", id: "..."}
      session = {..., access_token: "..."}
      loading = false
      │
      ▼
  T3: useGalleryAccess(user) recebe user != null
      │
      ├── Dispara: supabase.from('user_roles').select()  ──────▶ 401
      ├── Dispara: supabase.from('subscriptions').select() ────▶ 401
      │
      ▼
  T4: useSupabaseGalleries.checkAuth()
      getSession() retorna session
      isReady = true
      │
      ├── Dispara: supabase.from('galerias').select() ─────────▶ 401
      │
      ▼
  T5: Supabase client FINALMENTE configura token internamente
      (Tarde demais - queries ja falharam)
```

O problema e que o evento `INITIAL_SESSION` e emitido **antes** do cliente Supabase estar completamente pronto para anexar o token nas requisicoes HTTP.

## Solucao

Usar **session** como gate em vez de apenas **user**, e adicionar um pequeno delay ou verificar o token explicitamente.

```text
SEQUENCIA CORRIGIDA
────────────────────────────────────────────────────────────────────────

  T0: Pagina carrega
      │
      ▼
  T1: useAuth configura onAuthStateChange
      │
      ▼
  T2: INITIAL_SESSION dispara
      user = {email: "...", id: "..."}
      session = {..., access_token: "..."}
      loading = false
      │
      ▼
  T3: AuthContext passa session para useGalleryAccess
      │
      ▼
  T4: useGalleryAccess verifica session.access_token
      Se nao tiver token valido, aguarda
      │
      ▼
  T5: useSupabaseGalleries verifica session do AuthContext
      │
      ▼
  T6: Queries disparam APENAS quando session.access_token existe
```

## Mudancas no Codigo

### 1. Modificar useGalleryAccess para usar Session

**Arquivo:** `src/hooks/useGalleryAccess.ts`

Alterar para receber `session` em vez de apenas `user`:

```typescript
export function useGalleryAccess(user: User | null, session: Session | null): GalleryAccessResult {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('free');
  const [planName, setPlanName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: Only proceed if we have BOTH user AND valid session with token
    if (!user || !session?.access_token) {
      setAccessLevel('free');
      setPlanName(null);
      setIsLoading(false);
      return;
    }

    const checkAccessLevel = async () => {
      // ... resto do codigo
    };
    // ...
  }, [user, session]);
```

### 2. Atualizar AuthContext para passar session

**Arquivo:** `src/contexts/AuthContext.tsx`

```typescript
const { 
  hasAccess, 
  accessLevel, 
  planName, 
  isLoading: accessLoading,
  hasGestaoIntegration,
  isAdmin,
} = useGalleryAccess(user, session); // Passar session tambem
```

### 3. Simplificar useSupabaseGalleries

**Arquivo:** `src/hooks/useSupabaseGalleries.ts`

Remover o listener duplicado e usar o session do contexto via prop ou verificar de forma mais robusta:

```typescript
export function useSupabaseGalleries() {
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);

  // Wait for auth to be ready before querying
  useEffect(() => {
    let mounted = true;
    
    // Use onAuthStateChange as single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        // Only set ready when we have a valid session WITH access_token
        const hasValidSession = !!(session?.access_token);
        console.log('🔐 Auth state for galleries:', event, hasValidSession);
        setIsReady(hasValidSession);
      }
    });

    // Also check current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.access_token) {
        console.log('📋 Initial session ready for galleries');
        setIsReady(true);
      }
    });
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ... resto do codigo
}
```

### 4. Adicionar verificacao de retry para queries

Como medida de seguranca adicional, configurar o React Query para retry em caso de 401:

**Arquivo:** `src/App.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Retry once for 401 errors (auth race condition)
        if ((error as any)?.code === '401' || (error as any)?.status === 401) {
          return failureCount < 1;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});
```

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/hooks/useGalleryAccess.ts` | Receber session, verificar access_token |
| `src/contexts/AuthContext.tsx` | Passar session para useGalleryAccess |
| `src/hooks/useSupabaseGalleries.ts` | Verificar session.access_token antes de setIsReady |
| `src/App.tsx` | Adicionar retry config no QueryClient |

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Multiplos 401 no carregamento inicial | Queries aguardam token valido |
| Precisa logout/login para ver galerias | Galerias carregam na primeira vez |
| Race condition entre auth e queries | Sequenciamento correto |

## Testes

Apos a implementacao:
1. Limpar cookies/localStorage
2. Fazer login
3. Verificar que nenhum erro 401 aparece no console
4. Galerias devem carregar imediatamente sem refresh

