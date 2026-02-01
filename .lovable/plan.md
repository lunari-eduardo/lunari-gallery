

# Corrigir Fluxo de Troca de Email

## Problema Identificado

Existem dois problemas no fluxo atual:

### 1. Configuração "Secure Email Change" do Supabase
O Supabase está configurado com **Secure Email Change** habilitado, o que significa:
- Envia confirmação para o email **antigo** E para o email **novo**
- Ambos os links precisam ser clicados para a troca ser concluída
- Isso causa confusão para o usuário

### 2. Processamento do Token de Email Change
Quando o usuário clica no link de confirmação, o Supabase redireciona com parâmetros especiais na URL, mas o aplicativo não está processando esses tokens corretamente.

## Soluções

### Solução 1: Desabilitar "Secure Email Change" (Recomendado - Ação Manual)

No **Supabase Dashboard**, ir em:
- **Authentication** → **Email Templates** → **Email Settings**
- Desabilitar **"Secure email change"**

Com isso, apenas o novo email receberá o link de confirmação, e ao clicar nele, a troca é concluída automaticamente.

### Solução 2: Melhorar o Processamento de Tokens no Frontend

Atualizar o código para processar corretamente os tokens de `email_change`:

#### Arquivo: `src/hooks/useAuth.ts`

Adicionar verificação no useEffect para detectar quando a URL contém tokens de confirmação de email:

```typescript
useEffect(() => {
  // Detectar e processar tokens de confirmação na URL (email change, signup, etc)
  const processAuthTokens = async () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'email_change' || type === 'signup' || type === 'recovery') {
      console.log('🔄 Processing auth token of type:', type);
      // O Supabase client processa automaticamente via onAuthStateChange
      // Limpar o hash após processamento
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };
  
  processAuthTokens();
}, []);
```

#### Arquivo: `src/pages/Auth.tsx`

Melhorar o handling de callbacks de email change:

```typescript
useEffect(() => {
  const hash = window.location.hash;
  
  if (hash) {
    const params = new URLSearchParams(hash.substring(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    
    if (type === 'email_change' && accessToken) {
      console.log('📧 Email change confirmation detected');
      toast.success('Email alterado com sucesso!');
      // Limpar hash e redirecionar
      window.history.replaceState(null, '', '/');
    }
  }
}, []);
```

### Solução 3: Melhorar Feedback ao Usuário

No `ChangeEmailForm.tsx`, informar claramente o que vai acontecer:

```typescript
<Alert>
  <Info className="h-4 w-4" />
  <AlertDescription>
    Um email de confirmação será enviado para o novo endereço.
    Clique no link no email recebido para confirmar a alteração.
    Você será deslogado e precisará fazer login com o novo email.
  </AlertDescription>
</Alert>
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FLUXO DE TROCA DE EMAIL - CORRIGIDO                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Usuário digita novo email no formulário                         │
│  2. Sistema chama supabase.auth.updateUser({ email: novoEmail })    │
│  3. Supabase envia email de confirmação para o NOVO endereço        │
│     (com Secure Email Change DESABILITADO)                         │
│  4. Usuário clica no link                                          │
│  5. Supabase processa o token e atualiza o email                   │
│  6. Usuário é autenticado automaticamente com novo email           │
│  7. onAuthStateChange dispara evento USER_UPDATED                  │
│  8. Aplicativo detecta e redireciona para a página inicial         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Ações Necessárias

| Tipo | Ação | Responsável |
|------|------|-------------|
| **Manual** | Desabilitar "Secure email change" no Supabase Dashboard | Usuário |
| **Código** | Melhorar processamento de tokens em `useAuth.ts` | Sistema |
| **Código** | Adicionar feedback de sucesso em `Auth.tsx` | Sistema |
| **Código** | Melhorar mensagem explicativa em `ChangeEmailForm.tsx` | Sistema |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useAuth.ts` | Adicionar log de eventos `USER_UPDATED` |
| `src/pages/Auth.tsx` | Processar callback de `email_change` |
| `src/components/account/ChangeEmailForm.tsx` | Melhorar mensagem de feedback |

## Configuração do Supabase (Manual)

Acesse o [Supabase Dashboard - Authentication Settings](https://supabase.com/dashboard/project/tlnjspsywycbudhewsfv/auth/providers) e:

1. Vá em **Authentication** → **Email Templates**
2. Role até **Email Settings**
3. **Desabilite** a opção "Secure email change"
4. Salve as alterações

Isso fará com que apenas o novo email receba o link de confirmação, simplificando o fluxo.

