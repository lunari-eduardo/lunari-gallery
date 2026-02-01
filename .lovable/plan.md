

# Implementar Login com Email e Senha

## Estado Atual

O sistema de autenticação possui as seguintes características:

| Componente | Implementação Atual |
|------------|---------------------|
| **Método de Login** | Apenas Google OAuth |
| **Hooks** | `useAuth.ts` com `signInWithGoogle()` e `signOut()` |
| **Contexto** | `AuthContext.tsx` expõe user, session e métodos |
| **Página de Login** | `Auth.tsx` com botão único de Google |
| **Proteção de Rotas** | `ProtectedRoute.tsx` verifica se há user |
| **Criação de Perfil** | Trigger `handle_new_user_profile` no banco |

### Fluxo Atual

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FLUXO DE LOGIN ATUAL (Google OAuth Only)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Usuário clica "Entrar com Google"                               │
│  2. Redirect para Google OAuth                                      │
│  3. Callback com access_token no hash da URL                        │
│  4. Supabase processa token e cria sessão                          │
│  5. Trigger cria profile + photographer_account + subscription      │
│  6. Frontend verifica acesso e redireciona                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Solução Proposta

### Estratégia: Adicionar Tab de Email/Senha na Página de Login

Implementar um sistema completo com:
1. **Login com email/senha**
2. **Cadastro com confirmação por email**
3. **Recuperação de senha ("Esqueci minha senha")**
4. **Compatibilidade total com o sistema existente**

### Fluxo Novo

```text
┌─────────────────────────────────────────────────────────────────────┐
│  PÁGINA DE LOGIN - DUAS ABAS                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐                          │
│  │    ENTRAR       │  │   CRIAR CONTA   │                          │
│  └─────────────────┘  └─────────────────┘                          │
│                                                                     │
│  Aba ENTRAR:                  Aba CRIAR CONTA:                      │
│  ┌───────────────────┐        ┌───────────────────┐                 │
│  │ Email             │        │ Nome              │                 │
│  │ Senha             │        │ Email             │                 │
│  │                   │        │ Senha             │                 │
│  │ [Entrar]          │        │ Confirmar Senha   │                 │
│  │                   │        │                   │                 │
│  │ Esqueceu a senha? │        │ [Criar Conta]     │                 │
│  └───────────────────┘        └───────────────────┘                 │
│                                                                     │
│  ─────────── ou ───────────                                         │
│                                                                     │
│  [🔵 Continuar com Google]                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementação Detalhada

### 1. Atualizar Hook `useAuth.ts`

Adicionar métodos para email/senha:

```typescript
// Novos métodos a adicionar:

const signInWithEmail = async (email: string, password: string) => {
  console.log('🔐 Starting email sign-in');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('❌ Email sign-in error:', error);
    return { error };
  }
  
  console.log('✅ Email sign-in successful');
  return { error: null };
};

const signUpWithEmail = async (email: string, password: string, nome?: string) => {
  console.log('📝 Starting email sign-up');
  
  const redirectUrl = window.location.origin;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: nome || '',
        name: nome || '',
      },
    },
  });
  
  if (error) {
    console.error('❌ Sign-up error:', error);
    return { error, needsEmailConfirmation: false };
  }
  
  // Se email não está confirmado, Supabase retorna user mas sem sessão
  const needsEmailConfirmation = data.user && !data.session;
  
  console.log('✅ Sign-up successful, needs confirmation:', needsEmailConfirmation);
  return { error: null, needsEmailConfirmation };
};

const resetPassword = async (email: string) => {
  console.log('🔄 Starting password reset for:', email);
  
  const redirectUrl = `${window.location.origin}/auth?reset=true`;
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });
  
  if (error) {
    console.error('❌ Password reset error:', error);
    return { error };
  }
  
  console.log('✅ Password reset email sent');
  return { error: null };
};

const updatePassword = async (newPassword: string) => {
  console.log('🔒 Updating password');
  
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) {
    console.error('❌ Password update error:', error);
    return { error };
  }
  
  console.log('✅ Password updated successfully');
  return { error: null };
};
```

### 2. Atualizar Interface do `AuthContext`

Adicionar novos métodos ao contexto:

```typescript
interface AuthContextType {
  // ... existentes
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, nome?: string) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}
```

### 3. Redesenhar Página `Auth.tsx`

Nova estrutura com tabs:

```typescript
export default function Auth() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  
  // Formulários
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  
  // Estados
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  // Detectar callback de reset de senha
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') {
      setShowUpdatePassword(true);
    }
  }, []);
  
  // ... handlers para cada ação
}
```

### 4. Componentes de Formulário

Criar formulários separados para organização:

| Componente | Campos | Ação |
|------------|--------|------|
| `LoginForm` | email, senha | `signInWithEmail()` |
| `SignupForm` | nome, email, senha, confirmar | `signUpWithEmail()` |
| `ResetPasswordForm` | email | `resetPassword()` |
| `UpdatePasswordForm` | nova senha, confirmar | `updatePassword()` |

### 5. Validação com Zod

```typescript
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const signupSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});
```

---

## Configuração do Supabase

### Verificar/Habilitar Email Provider

O provedor de email do Supabase precisa estar habilitado:

**Supabase Dashboard > Authentication > Providers > Email**

| Configuração | Valor Recomendado |
|--------------|-------------------|
| Enable Email Signup | ✅ Habilitado |
| Confirm Email | ✅ Habilitado (recomendado) |
| Secure Email Change | ✅ Habilitado |
| Double Confirm Changes | ❌ Opcional |

### Templates de Email

Os templates padrão do Supabase funcionam, mas podem ser customizados:

- **Confirmation**: Email de confirmação de cadastro
- **Recovery**: Email de recuperação de senha
- **Magic Link**: (não usado nesta implementação)

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAuth.ts` | Adicionar métodos `signInWithEmail`, `signUpWithEmail`, `resetPassword`, `updatePassword` |
| `src/contexts/AuthContext.tsx` | Atualizar interface e expor novos métodos |
| `src/pages/Auth.tsx` | Redesenhar com tabs e formulários |
| `src/components/auth/LoginForm.tsx` | **NOVO** - Formulário de login |
| `src/components/auth/SignupForm.tsx` | **NOVO** - Formulário de cadastro |
| `src/components/auth/ResetPasswordForm.tsx` | **NOVO** - Formulário de reset |
| `src/components/auth/UpdatePasswordForm.tsx` | **NOVO** - Formulário de nova senha |

---

## Considerações de Segurança

### Compatibilidade com Sistema Existente

O trigger `handle_new_user_profile` já é compatível:
- Extrai `full_name` de `raw_user_meta_data` (funciona para OAuth e email)
- Funciona para qualquer método de autenticação

### Proteção Contra Abusos

| Risco | Mitigação |
|-------|-----------|
| Spam de cadastros | Confirmação de email obrigatória |
| Brute force | Rate limiting do Supabase |
| Senhas fracas | Validação mínimo 6 caracteres |
| Emails falsos | Verificação por email |

### Confirmação de Email

Quando o usuário se cadastra:
1. Supabase envia email de confirmação
2. Usuário clica no link
3. Supabase confirma e cria sessão
4. Trigger `handle_new_user_profile` é disparado
5. Profile e conta são criados

---

## Layout Visual Proposto

```text
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                          [LOGO LUNARI]                              │
│                                                                     │
│                          Bem-vindo                                  │
│               Acesse sua conta para gerenciar suas galerias         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │    ┌──────────┐ ┌──────────────┐                           │    │
│  │    │  Entrar  │ │ Criar Conta  │                           │    │
│  │    └──────────┘ └──────────────┘                           │    │
│  │                                                             │    │
│  │    Email                                                    │    │
│  │    ┌─────────────────────────────────────────────────────┐  │    │
│  │    │ seu@email.com                                       │  │    │
│  │    └─────────────────────────────────────────────────────┘  │    │
│  │                                                             │    │
│  │    Senha                                                    │    │
│  │    ┌─────────────────────────────────────────────────────┐  │    │
│  │    │ ••••••••                                            │  │    │
│  │    └─────────────────────────────────────────────────────┘  │    │
│  │                                                             │    │
│  │    ┌─────────────────────────────────────────────────────┐  │    │
│  │    │                    ENTRAR                           │  │    │
│  │    └─────────────────────────────────────────────────────┘  │    │
│  │                                                             │    │
│  │    Esqueceu sua senha?                                      │    │
│  │                                                             │    │
│  │    ─────────────────── ou ───────────────────              │    │
│  │                                                             │    │
│  │    ┌─────────────────────────────────────────────────────┐  │    │
│  │    │  [G]  Continuar com Google                          │  │    │
│  │    └─────────────────────────────────────────────────────┘  │    │
│  │                                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│              Termos de Uso | Política de Privacidade                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Testes a Realizar

1. **Login com email existente**
   - Criar conta via Google
   - Tentar fazer login com email (deve dar erro de senha inválida)

2. **Cadastro novo usuário**
   - Preencher formulário de cadastro
   - Verificar recebimento do email de confirmação
   - Clicar no link e verificar login automático

3. **Recuperação de senha**
   - Solicitar reset
   - Verificar email recebido
   - Clicar no link e definir nova senha
   - Login com nova senha

4. **Validações de formulário**
   - Email inválido
   - Senha curta
   - Senhas não coincidem
   - Campos obrigatórios

5. **Compatibilidade com Google**
   - Login com Google ainda funciona
   - Usuário que fez login com Google pode usar email (se definir senha)

