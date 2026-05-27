# Replicar tela de Auth do Studio no Gallery

Objetivo: deixar `/auth` (e telas relacionadas) com paridade visual ao Lunari Studio, seguindo `auth-login-design-spec.md`. Mantém toda a lógica de autenticação atual do Gallery (Google OAuth, signup com referral/fingerprint, recovery, gallery access guard) — só troca a apresentação.

## 1. Assets

Copiar para `src/assets/auth/`:
- `login-background.jpg` — usar o `background.jpg` que o usuário anexou agora
- `lunari-gallery-logo.png` — usar o logo "K + GALLERY" anexado (substituindo o `lunari-studio-logo.png` da spec, já que o usuário pediu o logo Gallery)

## 2. Componentes novos (em `src/components/auth/`)

Copiados/adaptados do Studio, seguindo a spec:
- `AuthInput.tsx` — input h-12, `rounded-xl`, `bg-white/[0.04]`, `border-white/10`, focus `#C97A4A/60`, ícone à esquerda (lucide), toggle Eye/EyeOff para password
- `AuthButton.tsx` — primary (gradient `#C97A4A → #A8633A`, shadow cobre) e outline; suporta `loading`
- `AuthGoogleButton.tsx` — botão Google com SVG colorido, bg white/4%

Esses 3 componentes substituem o uso dos `Input`/`Button` shadcn nos forms de auth.

## 3. Refatorar forms existentes

Reescrever (mantendo handlers, validações zod e chamadas a `useAuthContext`):
- `src/components/auth/LoginForm.tsx` — usar `AuthInput` (Mail/Lock icons) + `AuthButton` primary; link "Esqueceu sua senha?" em `text-white/60`
- `src/components/auth/SignupForm.tsx` — `AuthInput` (User/Mail/Lock); `AuthButton` primary "Criar conta"
- `src/components/auth/ResetPasswordForm.tsx` e `UpdatePasswordForm.tsx` — mesmo tratamento

Nenhuma lógica de negócio muda.

## 4. Reescrever `src/pages/Auth.tsx`

- Container fixo dark: `<div className="dark min-h-[100dvh] ...">` com `background-image` apontando para `login-background.jpg` + overlay gradient `from-black/30 via-black/20 to-black/60`
- Bloco central `max-w-[400px]`, `px-6 py-10`, centralizado
- Header: logo (w-[200px] md:w-[220px], mb-6) + título `text-xl font-light text-white` + subtítulo `text-sm text-white/60`
- **Remover** as Tabs Login/Cadastro do shadcn; substituir por estado `mode: 'login' | 'signup' | 'forgot'` + link no rodapé ("Ainda não tem conta? **Criar conta**" / "Já tem uma conta? **Entrar**")
- Divider `my-6` com texto "ou continue com" em `text-white/40`
- `AuthGoogleButton` abaixo do divider
- Footer legal `text-white/40 mt-6` (Termos / Privacidade)
- Manter integralmente: callback OAuth, recovery hash handling, redirect para `/access-denied` quando sem acesso, fluxo `showUpdatePassword`/`showResetPassword`

## 5. Tokens / tema

- Tela ignora o tema global: usar classes literais (`bg-[#0a0a0a]`, `text-white`, etc.) conforme a spec — **não** usar `useVisualTheme` nem tokens semânticos aqui
- Envolver em `className="dark"` para ativar variantes `dark:` localmente
- O ESLint/design rule de "no literal colors" não se aplica a esta tela (exceção documentada na spec)

## 6. Não muda

- `src/hooks/useAuth.ts`, `AuthContext`, `useGalleryAccess`
- Rotas, redirects, lógica de referral/fingerprint
- Outras telas (Dashboard, etc.) continuam usando tema dinâmico

## 7. QA

- 375px (mobile) e 1440px (desktop)
- Login, Signup, Forgot, Reset password, Update password
- OAuth Google ainda funciona (botão dispara `signInWithGoogle`)
- Recovery link (`?reset=true`) ainda mostra `UpdatePasswordForm`
- Forçar tema light no app → tela de auth continua dark

## Arquivos

**Criados**: `src/assets/auth/login-background.jpg`, `src/assets/auth/lunari-gallery-logo.png`, `src/components/auth/AuthInput.tsx`, `src/components/auth/AuthButton.tsx`, `src/components/auth/AuthGoogleButton.tsx`

**Editados**: `src/pages/Auth.tsx`, `src/components/auth/LoginForm.tsx`, `src/components/auth/SignupForm.tsx`, `src/components/auth/ResetPasswordForm.tsx`, `src/components/auth/UpdatePasswordForm.tsx`
