# Adoção do Sistema de Tema do Studio no Gallery

## Objetivo
Trazer o engine de 7 presets (lunari, sage, ocean, lavender, rose, coral, mono) do Lunari Studio para o Gallery, sincronizar a preferência do fotógrafo entre os dois apps via tabela `user_theme_preferences` (mesmo Supabase), e aplicar o preset do fotógrafo nas galerias públicas vistas por clientes.

## Diagnóstico do estado atual

- `src/contexts/ThemeContext.tsx` hoje só alterna light/dark/system (chave `lunari-theme`). Não tem cor de marca configurável pelo usuário.
- `src/index.css` tem **tokens hardcoded** para terracota (`--primary: 19 49% 45%`, escala `--terra-*`, sidebar, `--shadow-glow`, etc.) tanto em `:root` quanto em `.dark`.
- Já existe um conceito separado de "tema da galeria" (`CustomTheme` em `src/types/gallery.ts`, configurado em `ThemeConfig.tsx`) que vive por galeria com `backgroundMode/primaryColor/accentColor/emphasisColor` e é passado via props `themeStyles` para componentes públicos (Asaas, PIX, Finalized, etc.). **Esse sistema permanece** — ele é configurável por galeria pelo fotógrafo e é prioridade sobre o tema global. O tema do Studio entra como **fallback / tema do painel logado e das galerias que não têm CustomTheme configurado**.
- Não existe ainda edge function `get-studio-theme` em nenhum dos dois projetos — será criada no Gallery.
- A tabela `user_theme_preferences` (user_id PK, preset_id, mode) já existe no Supabase compartilhado, com RLS por `user_id`.

## Escopo (apenas frontend + 1 edge function de leitura)
Nada toca em cobranças, webhooks, RPCs financeiras, regras de galeria. Só camada visual + nova edge function pública somente-leitura.

## Mudanças

### 1. Engine de tema portado do Studio
- Criar `src/lib/visualTheme.ts` idêntico ao do Studio: tipos `ThemePresetId`, `VisualThemeMode`, `VisualThemeConfig`, constante `THEME_PRESETS` (7 cores), `resolvePresetTokens()`, `applyTheme()`, `loadTheme()`, `saveTheme()`, `clearTheme()`.
- Mesma chave localStorage `lunari:theme-preference:v2`.
- Migração da chave legacy `lunari-theme` (light/dark/system): se existir, converte para `{ presetId: 'lunari', mode: <valor> }` e remove a antiga.
- Lógica HSL → contraste (mono invertido por modo; brandL clamp 30–55 light / 55–75 dark; primaryForeground branco/preto por luminância).

### 2. Refator do `src/index.css`
- Adicionar camada brand no `:root` e `.dark`:
  ```text
  --brand-h: 19;  --brand-s: 49%;  --brand-l: 45%;
  --brand-hover-l: 38%;  --brand-glow-l: 60%;
  --surface-hue: 30; --surface-sat: 10%;
  ```
- Reescrever tokens existentes para derivar dela:
  - `--primary`, `--primary-hover`, `--primary-glow`, `--ring`, `--accent`, `--sidebar-primary`, `--sidebar-ring`, `--terracotta`, `--shadow-glow`, escala `--terra-400/500/600/700` (mantém 50/100/200/800/900 derivadas via `calc` + brand).
- `--background`, `--card`, `--popover`, `--muted`, `--secondary` ficam neutros com leve tilt em `--surface-hue/--surface-sat` (mesma fórmula do Studio).
- Scrollbar (linhas 329, 333 do CSS) passa de `hsl(24 35% 59% / 0.3)` para `hsl(var(--brand-h) var(--brand-s) var(--brand-glow-l) / 0.3)`.
- Glass tokens mantidos (já usam alpha neutro).

### 3. Novo `VisualThemeContext`
- Substituir `src/contexts/ThemeContext.tsx` por `src/contexts/VisualThemeContext.tsx` (cópia do Studio): expõe `{ theme, presets, setPreset, setMode, reset }`.
- Manter export `useTheme` como **alias** de `useVisualTheme` para não quebrar `ThemeToggle.tsx`, `sonner.tsx` e `App.tsx` (eles consomem só `resolvedTheme`/`theme`). Adicionar shim que devolve `{ theme: theme.mode, setTheme: setMode, resolvedTheme: <derivado> }` para retrocompatibilidade.
- `ThemeProvider` exportado como alias do `VisualThemeProvider` (App.tsx continua importando `ThemeProvider`).

### 4. Sincronização Supabase (`useThemePreference`)
- Criar `src/hooks/useThemePreference.ts` (cópia do Studio): hidrata `user_theme_preferences` no mount + a cada `SIGNED_IN`; upsert debounced 400ms quando o tema muda.
- **Adição vs Studio**: assinatura realtime
  ```text
  supabase.channel('user-theme:' + user.id)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_theme_preferences',
          filter: `user_id=eq.${user.id}` },
        payload => applyRemote({...}))
    .subscribe();
  ```
  Guarda contra eco (compara serialized contra `lastSavedRef`).
- Integrar no `VisualThemeContext` via `useRemoteThemeSync(theme, setThemeState)`.

### 5. UI "Aparência" no menu do perfil
- Criar `src/components/preferences/AppearanceModal.tsx` (cópia da versão do Studio): grid 2x4 de swatches (7 presets), toggle Claro/Escuro/Sistema, preview com botão/badge, "Restaurar padrão".
- Adicionar item "Aparência" no `DropdownMenu` do perfil em `src/components/Layout.tsx` (ícone `Palette` da lucide-react), acima de "Sair". Abre o modal via state local.

### 6. Galerias públicas (visitante)
- **Nova edge function** `supabase/functions/get-studio-theme/index.ts` (verify_jwt = false): recebe `?owner_user_id=<uuid>`, valida UUID, faz `select preset_id, mode from user_theme_preferences where user_id = ?` usando `SUPABASE_SERVICE_ROLE_KEY`. Retorna `{ presetId, mode }` ou `{ presetId: 'lunari', mode: 'system' }` se não encontrado. CORS `*`. Sem rate-limit complexo (apenas leitura de 2 campos).
- Em `ClientGallery.tsx` e `ClientDeliverGallery.tsx`: depois de obter o `owner_user_id` no payload da galeria pública, chamar `get-studio-theme` e `applyTheme({ presetId, mode })`. Se falhar/timeout, manter `applyTheme({ presetId: 'lunari', mode: 'system' })` (default). **Não persistir** — chamar `applyTheme` direto sem `saveTheme`, e ao desmontar a página pública resetar para o default.
- Importante: se a galeria já tem `CustomTheme` (per-gallery) configurado pelo fotógrafo, o `CustomTheme` continua tendo prioridade — os componentes que recebem `themeStyles` continuam funcionando. O `applyTheme(studioPreset)` é o **fallback** que define `--primary`, `--ring`, etc., para os componentes que não têm override.

### 7. Componentes com props `themeStyles` / `backgroundMode`
- Manter as props como **override opcional** (não remover, mantém retrocompat com `CustomTheme` por galeria). Apenas garantir que, quando ausentes, os componentes usem tokens semânticos (`bg-primary`, `text-foreground`, etc.) que agora derivam do preset global aplicado.
- Auditar `AsaasCheckout`, `FinalizedPreviewScreen`, `PixPaymentScreen`, `PaymentPendingScreen`, `PaymentRedirect`, `VisitorIdentificationScreen`, `PasswordScreen`, `SelectionConfirmation`: substituir cores literais residuais por tokens semânticos. (Apenas o que estiver hardcoded; o que já vem de `themeStyles` continua igual.)

## Arquivos novos
- `src/lib/visualTheme.ts`
- `src/contexts/VisualThemeContext.tsx` (com alias `ThemeProvider`/`useTheme`)
- `src/hooks/useThemePreference.ts`
- `src/components/preferences/AppearanceModal.tsx`
- `supabase/functions/get-studio-theme/index.ts`

## Arquivos editados
- `src/index.css` (tokens derivados de `--brand-*`)
- `src/App.tsx` (trocar import do provider, se necessário)
- `src/contexts/ThemeContext.tsx` (deletado e substituído OU reescrito como re-export de VisualThemeContext)
- `src/components/Layout.tsx` (item "Aparência" no menu)
- `src/pages/ClientGallery.tsx` e `src/pages/ClientDeliverGallery.tsx` (fetch + applyTheme do owner)
- Componentes públicos com cores literais residuais (tokens semânticos)

## Migração de banco
**Nenhuma.** A tabela `user_theme_preferences` já existe com RLS por `user_id` (compartilhada com o Studio).

## Segurança
- Edge function `get-studio-theme` é pública mas só retorna `preset_id` e `mode` de um `user_id` informado — informação não sensível (apenas escolha visual). Valida UUID antes da query. Sem service role exposto ao cliente.
- Realtime channel filtra estritamente por `user_id=eq.<auth.uid>`; RLS da tabela impede leitura de outros usuários.
- `localStorage` continua sendo fonte offline; Supabase é fonte autoritativa quando logado.

## Critérios de aceite
1. Fotógrafo loga no Gallery com mesmo e-mail do Studio → tema escolhido no Studio é aplicado automaticamente.
2. Trocar preset/modo no Gallery → reflete no Studio em outra aba via realtime (sem reload).
3. Visitante público da galeria vê o preset do fotógrafo (com fallback `lunari` se função falhar). `CustomTheme` por galeria continua tendo prioridade sobre o preset global.
4. Presets `mono`, `lavender` e `coral` mantêm contraste AA de texto em light e dark.
5. Nenhuma cor literal nova introduzida em componentes — tudo via tokens (`bg-primary`, `text-foreground`, etc.).
6. Cobranças, webhooks, fluxo de seleção e RPCs financeiras intocados.

## QA manual
- Trocar preset 7 vezes, alternar light/dark/system, fazer logout/login: preferência persiste e sincroniza.
- Abrir galeria pública em janela anônima (sem login) com `owner_user_id` válido: tema correto aplicado antes do primeiro paint visível.
- Abrir galeria com `CustomTheme` configurado: continua usando as cores do `CustomTheme`.
- Toggle de tema do `ThemeToggle.tsx` antigo continua funcionando (via alias `useTheme`).
