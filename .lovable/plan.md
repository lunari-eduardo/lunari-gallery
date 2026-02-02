

# Corrigir Fluxo de Atualização de Senha Após Troca de Email

## Problema Identificado

Os logs de autenticação revelam a causa exata do erro:

| Horário | Ação | Resultado |
|---------|------|-----------|
| 00:37:30 | Login com `cartbeem8@gmail.com` | ✅ OK |
| 00:38:14 | Solicitar troca para `valmordeick@gmail.com` | ✅ Email enviado |
| 00:39:35 | Confirmar troca de email | ✅ Email alterado |
| 00:41:09 | Usar link de recovery | ✅ Nova sessão criada |
| 00:41:23+ | Tentar `updateUser({ password })` | ❌ **Session not found** |

**Causa Raiz:** A troca de email invalida a sessão antiga, mas o frontend não está detectando que o usuário tem uma sessão válida após clicar no link de recovery. O formulário de atualização de senha (`UpdatePasswordForm`) tenta usar uma sessão que não existe mais.

## Análise Técnica

Quando o usuário clica no link de **recovery** (recuperação de senha), o Supabase:
1. Processa o token de recovery
2. Cria uma sessão temporária
3. Redireciona para `/auth?reset=true#access_token=...`

O problema é que:
- O `useAuth` processa o hash e **limpa ele** antes do Supabase terminar de processar
- O formulário `UpdatePasswordForm` é exibido, mas **sem sessão válida**
- A chamada `updatePassword()` falha com "Session not found"

## Solução

### 1. Aguardar Processamento da Sessão de Recovery

No `Auth.tsx`, precisamos garantir que a sessão de recovery seja processada **antes** de mostrar o formulário de atualização de senha.

**Fluxo Corrigido:**

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FLUXO DE RECUPERAÇÃO DE SENHA - CORRIGIDO                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Usuário clica no link de recovery no email                      │
│  2. URL: /auth?reset=true#access_token=XXX&type=recovery            │
│  3. Supabase processa token e dispara onAuthStateChange             │
│  4. Frontend aguarda user !== null                                  │
│  5. ENTÃO exibe formulário de nova senha                            │
│  6. updatePassword() funciona porque há sessão válida               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Auth.tsx` | Aguardar sessão válida antes de exibir `UpdatePasswordForm` |
| `src/hooks/useAuth.ts` | Processar token de `recovery` corretamente |

### 3. Implementação

#### Modificar `src/pages/Auth.tsx`

Detectar o callback de recovery e aguardar a sessão:

```typescript
// Check for password reset callback
useEffect(() => {
  const hash = window.location.hash;
  const resetParam = searchParams.get('reset');
  
  // Detectar se é um callback de recovery (link do email)
  if (hash && hash.includes('type=recovery')) {
    console.log('🔄 Recovery callback detected, waiting for session...');
    // Não mostrar formulário ainda - aguardar sessão
    return;
  }
  
  // Se já tem sessão e está na página de reset, mostrar formulário
  if (resetParam === 'true' && user) {
    setShowUpdatePassword(true);
  }
}, [searchParams, user]);
```

#### Modificar `src/hooks/useAuth.ts`

Garantir que tokens de recovery sejam processados antes de limpar o hash:

```typescript
const processAuthTokens = () => {
  const hash = window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash.substring(1));
    const type = hashParams.get('type');
    
    // Para recovery, NÃO limpar o hash imediatamente
    // Deixar o Supabase processar primeiro
    if (type === 'recovery') {
      console.log('🔄 Recovery token detected - letting Supabase process');
      // O Supabase vai processar automaticamente via onAuthStateChange
      // Limpar apenas os parâmetros de busca após o processamento
      return;
    }
    
    if (type === 'email_change' || type === 'signup') {
      console.log('🔄 Processing auth token of type:', type);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
};
```

### 4. Exibir Formulário Apenas Quando Há Sessão

No `Auth.tsx`, a condição para mostrar `UpdatePasswordForm` deve verificar se há usuário autenticado:

```typescript
// Render update password form if user is authenticated and reset param is present
if (showUpdatePassword && user) {
  return (
    <div className="min-h-screen flex items-center justify-center ...">
      <Card>
        <UpdatePasswordForm />
      </Card>
    </div>
  );
}

// Se reset=true mas ainda não tem user, mostrar loading
if (searchParams.get('reset') === 'true' && !user && !loading) {
  // Pode significar que o link expirou ou foi usado
  return (
    <div className="min-h-screen flex items-center justify-center ...">
      <Card>
        <div className="text-center p-6">
          <p>Link expirado ou inválido. Solicite um novo link de recuperação.</p>
          <Button onClick={() => setShowResetPassword(true)}>
            Solicitar novo link
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

### 5. Diagrama do Fluxo Corrigido

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Email     │     │  Clique no  │     │  Supabase   │     │  Formulário │
│  Recovery   │ ──▶ │   Link      │ ──▶ │  Processa   │ ──▶ │  Aparece    │
│   Enviado   │     │             │     │  Token      │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Sessão     │
                                        │  Criada     │
                                        └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  user !== null │
                                        │  (useAuth)  │
                                        └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │ showUpdate  │
                                        │ Password    │
                                        │ Form = true │
                                        └─────────────┘
```

## Resumo das Mudanças

| Componente | Antes | Depois |
|------------|-------|--------|
| `Auth.tsx` | Mostra formulário baseado em `?reset=true` | Mostra formulário se `reset=true` **E** `user` existe |
| `useAuth.ts` | Limpa hash imediatamente | Não limpa hash de `recovery` - deixa Supabase processar |
| `UpdatePasswordForm` | Assume que há sessão | Funciona normalmente (sessão garantida pelo parent) |

## Consideração de Edge Case

Se o link de recovery **expirou**, o usuário verá uma mensagem clara:
- "Link expirado ou inválido"
- Botão para solicitar novo link

Isso evita confusão e o loop de erro atual.

