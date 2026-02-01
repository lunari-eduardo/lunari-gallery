
# Corrigir Consistência do Tema (Claro/Escuro) na Galeria do Cliente

## Problema Identificado

Quando o fotógrafo seleciona o modo "Escuro" para a galeria do cliente, a tela de senha aparece corretamente em modo escuro, mas as demais telas (boas-vindas, galeria, confirmação, pagamento) ficam em modo claro.

### Fluxo de Dados Atual (Quebrado)

```text
┌───────────────────────────────────────────────────────────────────────┐
│  CRIAÇÃO DA GALERIA                                                   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  GalleryCreate.tsx                    Banco de Dados                  │
│  ┌─────────────────────┐              ┌─────────────────────┐         │
│  │ clientMode: 'dark'  │    ─────►    │ configuracoes: {    │         │
│  │ themeId: undefined  │              │   clientMode: 'dark'│         │
│  │                     │              │   themeId: null     │         │
│  └─────────────────────┘              └─────────────────────┘         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION (gallery-access)                                       │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Retorno da Edge Function:                                            │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ {                                                               │  │
│  │   success: true,                                                │  │
│  │   gallery: {...},                                               │  │
│  │   theme: null,          ← Só é populado se themeId existe!      │  │
│  │   clientMode: 'dark'    ← Existe, mas é ignorado no frontend    │  │
│  │ }                                                               │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  FRONTEND (ClientGallery.tsx)                                         │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  themeStyles = useMemo(() => {                                        │
│    const theme = galleryResponse?.theme;                              │
│    if (!theme) return {};   ← PROBLEMA: Retorna vazio!               │
│    ...                                                                │
│  });                                                                  │
│                                                                       │
│  effectiveBackgroundMode = galleryResponse?.theme?.backgroundMode     │
│                            ↑ PROBLEMA: Ignora clientMode!             │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Por que a Tela de Senha Funciona?

A tela de senha funciona por acidente: quando `requiresPassword` é `true`, a Edge Function retorna um subset de dados e o componente `PasswordScreen` ainda não tem acesso ao `galleryResponse?.theme` completo. O tema é aplicado corretamente porque usa lógica diferente.

**Porém**, analisando melhor o código atual, a tela de senha também deveria estar falhando - ela recebe `galleryResponse?.theme?.backgroundMode || 'light'`. A inconsistência visual nos prints sugere que o tema está funcionando na senha por algum estado intermediário.

---

## Solução Proposta

### Estratégia: Unificar `clientMode` com `theme` na Edge Function

Quando não há tema personalizado (`themeId`), a Edge Function deve construir um objeto `theme` baseado apenas no `clientMode`. Isso garante que o frontend sempre receba um `theme` consistente.

### Implementação

#### 1. Modificar Edge Function `gallery-access`

**Arquivo:** `supabase/functions/gallery-access/index.ts`

Criar um objeto `theme` mesmo quando não há `themeId`:

```typescript
// 7. Build theme data
const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
const themeId = galleryConfig?.themeId as string | undefined;
const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';

let themeData = null;

if (themeId) {
  // Fetch custom theme from database
  const { data: theme } = await supabase
    .from("gallery_themes")
    .select("*")
    .eq("id", themeId)
    .maybeSingle();
  
  if (theme) {
    themeData = {
      id: theme.id,
      name: theme.name,
      backgroundMode: theme.background_mode || 'light',
      primaryColor: theme.primary_color,
      accentColor: theme.accent_color,
      emphasisColor: theme.emphasis_color,
    };
  }
}

// NOVO: Se não há tema personalizado, criar tema do sistema baseado no clientMode
if (!themeData) {
  themeData = {
    id: 'system',
    name: 'Sistema',
    backgroundMode: clientMode, // Usa o modo escolhido pelo fotógrafo
    primaryColor: null,         // Usa cores padrão do sistema
    accentColor: null,
    emphasisColor: null,
  };
}
```

#### 2. Atualizar `themeStyles` no Frontend

**Arquivo:** `src/pages/ClientGallery.tsx`

Modificar o `useMemo` para tratar o caso de tema do sistema:

```typescript
const themeStyles = useMemo(() => {
  const theme = galleryResponse?.theme;
  
  // Use backgroundMode from theme, fallback to clientMode, then 'light'
  const backgroundMode = theme?.backgroundMode || galleryResponse?.clientMode || 'light';
  
  // Base colors depend on background mode (always apply, even for system theme)
  const baseColors = backgroundMode === 'dark' ? {
    '--background': '25 15% 10%',
    '--foreground': '30 20% 95%',
    '--card': '25 15% 13%',
    '--card-foreground': '30 20% 95%',
    '--muted': '25 12% 20%',
    '--muted-foreground': '30 15% 60%',
    '--border': '25 12% 22%',
    '--primary-foreground': '25 15% 10%',
    '--popover': '25 15% 13%',
    '--popover-foreground': '30 20% 95%',
    '--gradient-card': 'linear-gradient(180deg, hsl(25 15% 13%) 0%, hsl(25 12% 11%) 100%)',
  } : {
    // Light mode values (existing)
    '--background': '30 25% 97%',
    '--foreground': '25 20% 15%',
    '--card': '30 20% 99%',
    '--card-foreground': '25 20% 15%',
    '--muted': '30 15% 92%',
    '--muted-foreground': '25 10% 45%',
    '--border': '30 15% 88%',
    '--primary-foreground': '30 25% 98%',
    '--popover': '30 20% 99%',
    '--popover-foreground': '25 20% 15%',
    '--gradient-card': 'linear-gradient(180deg, hsl(30 20% 99%) 0%, hsl(30 15% 96%) 100%)',
  };
  
  // Only add custom colors if theme has them (not system theme)
  if (theme?.primaryColor) {
    const primaryHsl = hexToHsl(theme.primaryColor);
    const accentHsl = hexToHsl(theme.accentColor);
    
    return {
      ...baseColors,
      '--primary': primaryHsl || '18 55% 55%',
      '--accent': accentHsl || '120 20% 62%',
      '--ring': primaryHsl || '18 55% 55%',
    } as React.CSSProperties;
  }
  
  return baseColors as React.CSSProperties;
}, [galleryResponse?.theme, galleryResponse?.clientMode]);
```

#### 3. Atualizar `effectiveBackgroundMode`

**Arquivo:** `src/pages/ClientGallery.tsx`

Incluir fallback para `clientMode`:

```typescript
const effectiveBackgroundMode = useMemo(() => {
  // Priority: theme.backgroundMode > clientMode > 'light'
  return galleryResponse?.theme?.backgroundMode || galleryResponse?.clientMode || 'light';
}, [galleryResponse?.theme?.backgroundMode, galleryResponse?.clientMode]);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/gallery-access/index.ts` | Criar objeto `theme` do sistema quando não há tema personalizado |
| `src/pages/ClientGallery.tsx` | Atualizar `themeStyles` e `effectiveBackgroundMode` para usar fallback de `clientMode` |

---

## Fluxo Corrigido

```text
┌───────────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION (gallery-access) - CORRIGIDO                          │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Se themeId existe:                                                   │
│    theme = { id, name, backgroundMode, primaryColor, ... }           │
│                                                                       │
│  Se NÃO existe themeId:                                               │
│    theme = { id: 'system', backgroundMode: clientMode, ... }         │
│                                                                       │
│  Resultado: theme SEMPRE existe com backgroundMode correto            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  FRONTEND (ClientGallery.tsx) - CORRIGIDO                            │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  themeStyles:                                                         │
│    - SEMPRE aplica baseColors baseado em backgroundMode              │
│    - Adiciona cores personalizadas só se existirem                   │
│                                                                       │
│  effectiveBackgroundMode:                                             │
│    theme?.backgroundMode || clientMode || 'light'                    │
│                                                                       │
│  Resultado: Todas as telas respeitam o modo escolhido                │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Telas Afetadas (Todas Consistentes)

| Tela | Componente | Modo Escuro Aplicado |
|------|-----------|---------------------|
| Senha | `PasswordScreen` | Sim (via `backgroundMode` e `themeStyles`) |
| Boas-vindas | `ClientGallery` (showWelcome) | Sim (via `effectiveBackgroundMode`) |
| Galeria | `ClientGallery` (main) | Sim (via `effectiveBackgroundMode`) |
| Confirmação | `SelectionConfirmation` | Sim (via props `backgroundMode`) |
| PIX Manual | `PixPaymentScreen` | Sim (via props `backgroundMode`) |
| Redirect | `PaymentRedirect` | Sim (via props `backgroundMode`) |
| Confirmada | `ClientGallery` (isConfirmed) | Sim (via `effectiveBackgroundMode`) |

---

## Testes a Realizar

1. **Galeria com tema do sistema + modo escuro**
   - Criar galeria sem tema personalizado
   - Selecionar "Escuro" no "Modo para esta galeria"
   - Verificar que TODAS as telas ficam em modo escuro

2. **Galeria com tema do sistema + modo claro**
   - Criar galeria sem tema personalizado
   - Selecionar "Claro" no "Modo para esta galeria"
   - Verificar que TODAS as telas ficam em modo claro

3. **Galeria com tema personalizado**
   - Criar galeria com tema personalizado (cores customizadas)
   - Verificar que cores e modo funcionam corretamente

4. **Galeria já existente**
   - Acessar galeria criada antes da correção
   - Verificar que ainda funciona (modo padrão light)
