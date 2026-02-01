

# Adicionar Função de Trocar Email na Minha Conta

## Objetivo

Permitir que usuários cadastrados com email/senha possam alterar seu email através do painel "Minha Conta".

## Fluxo de Alteração de Email (Supabase)

O Supabase lida com alteração de email de forma segura:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FLUXO DE ALTERAÇÃO DE EMAIL                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Usuário digita novo email no formulário                         │
│  2. Sistema chama supabase.auth.updateUser({ email: novoEmail })    │
│  3. Supabase envia email de confirmação para o NOVO endereço        │
│  4. Usuário clica no link de confirmação                            │
│  5. Email é atualizado na conta                                     │
│                                                                     │
│  Obs: O email antigo permanece até a confirmação do novo            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementação

### 1. Adicionar método `updateEmail` no hook `useAuth.ts`

```typescript
const updateEmail = async (newEmail: string) => {
  console.log('📧 Updating email to:', newEmail);
  
  const { error } = await supabase.auth.updateUser({
    email: newEmail,
  });
  
  if (error) {
    console.error('❌ Email update error:', error);
    return { error };
  }
  
  console.log('✅ Confirmation email sent to new address');
  return { error: null };
};
```

### 2. Expor no `AuthContext.tsx`

Adicionar à interface e ao value:

```typescript
interface AuthContextType {
  // ... existentes
  updateEmail: (newEmail: string) => Promise<{ error: AuthError | null }>;
}
```

### 3. Criar componente `ChangeEmailForm.tsx`

Formulário com:
- Campo de novo email (com validação Zod)
- Botão de salvar
- Feedback de sucesso/erro
- Mensagem explicando que um email de confirmação será enviado

### 4. Atualizar página `Account.tsx`

Adicionar novo card "Alterar Email" com:
- Exibição do email atual
- Formulário para alterar
- Explicação do processo de confirmação

## Layout Proposto

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Minha Conta                                                        │
│  Gerencie suas informações                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  👤 Perfil                                                  │     │
│  │  Suas informações pessoais                                  │     │
│  │                                                             │     │
│  │  [Avatar]  Eduardo teste                                    │     │
│  │            ✉ testando@email.com                             │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  ✉ Alterar Email                                           │     │
│  │  Atualize seu endereço de email                            │     │
│  │                                                             │     │
│  │  Email atual: testando@email.com                           │     │
│  │                                                             │     │
│  │  Novo email                                                 │     │
│  │  ┌─────────────────────────────────────────────────────┐   │     │
│  │  │ novo@email.com                                      │   │     │
│  │  └─────────────────────────────────────────────────────┘   │     │
│  │                                                             │     │
│  │  ┌─────────────────────────────────────────────────────┐   │     │
│  │  │              Alterar Email                          │   │     │
│  │  └─────────────────────────────────────────────────────┘   │     │
│  │                                                             │     │
│  │  ⓘ Um email de confirmação será enviado para o novo        │     │
│  │    endereço. O email atual permanece até a confirmação.    │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAuth.ts` | Adicionar método `updateEmail` |
| `src/contexts/AuthContext.tsx` | Expor `updateEmail` na interface e value |
| `src/components/account/ChangeEmailForm.tsx` | **NOVO** - Formulário de alteração de email |
| `src/pages/Account.tsx` | Adicionar card de alteração de email |

## Considerações

### Usuários OAuth (Google)
- Usuários que fizeram login apenas com Google **não devem** ver a opção de alterar email
- O email do Google é gerenciado pela conta Google
- Podemos detectar isso verificando o provider do usuário

### Validação
- Email válido (formato)
- Email diferente do atual
- Campo obrigatório

### Feedback ao Usuário
- Mensagem clara de que precisa confirmar via email
- Toast de sucesso/erro
- Estado de loading durante requisição

### Segurança
- Supabase exige confirmação do novo email
- O email antigo permanece ativo até confirmação
- Não é necessário digitar senha para alterar (sessão já autenticada)

## Detecção de Usuário OAuth

Para esconder a opção de usuários Google:

```typescript
// Verificar se é usuário de email/senha
const isEmailUser = user?.app_metadata?.provider === 'email' || 
                    user?.app_metadata?.providers?.includes('email');
```

Se o usuário fez login com Google, não mostramos o card de alteração de email.

