
# Diagnóstico: Por que o "Indique e Ganhe" não funcionou

## Problema encontrado

A usuária `evelisess96@gmail.com` fez cadastro via **Google OAuth**, não pelo formulário de email. O fluxo do Google OAuth **não captura o parâmetro `?ref=`** da URL.

### Dados confirmados no banco:
- `evelisess96` → `referred_by = NULL`, `referral_code = NULL`, nenhum registro em `referrals`
- `eduardo22diehl` → `referral_code = b96eaf49` (correto)
- `evelisess96` → `raw_user_meta_data` **não contém `referral_code`** (veio do Google)
- Compra de créditos aprovada (`2000 créditos`) → webhook chamou `grant_referral_select_bonus` mas retornou `FALSE` porque não existe registro em `referrals`

### Fluxo que falhou:
1. Usuário acessou `gallery.lunarihub.com/auth?ref=b96eaf49`
2. Clicou em "Entrar com Google" (em vez de usar signup por email)
3. Google OAuth redireciona para o Google, perde o `?ref=` da URL
4. Ao retornar, `user_metadata` não contém `referral_code`
5. `AuthContext.useEffect` verifica `user.user_metadata.referral_code` → `undefined` → não chama `register_referral`
6. Compra aprovada → `grant_referral_select_bonus` → não encontra referral → retorna `FALSE`

---

## Correção necessária

### 1. Salvar `ref` no `localStorage` antes do OAuth (frontend)

**`src/pages/Auth.tsx`** ou **`src/hooks/useAuth.ts`**:
- Antes de redirecionar para Google, salvar `localStorage.setItem('pending_referral_code', ref)`

**`src/hooks/useAuth.ts` → `signInWithGoogle`**:
- Antes do redirect, ler `?ref=` da URL e salvar no localStorage

### 2. Processar referral code após callback OAuth

**`src/contexts/AuthContext.tsx`**:
- No `useEffect` que processa referrals, além de verificar `user_metadata.referral_code`, verificar também `localStorage.getItem('pending_referral_code')`
- Após `register_referral` bem-sucedido, remover do localStorage

### 3. Corrigir manualmente os dados do teste

Executar SQL para registrar a indicação entre os dois usuários de teste, para que o bônus funcione na próxima compra (ou conceder retroativamente).

---

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAuth.ts` | `signInWithGoogle`: salvar `ref` da URL no localStorage antes do redirect |
| `src/contexts/AuthContext.tsx` | Verificar localStorage além de user_metadata para referral code |
| Migration SQL | Registrar manualmente a indicação de teste (opcional) |

Mudança pequena e cirúrgica — apenas ~10 linhas de código no total.
