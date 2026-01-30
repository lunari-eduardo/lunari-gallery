
# Plano: Simplificar Sistema de Temas para Galeria do Cliente

## Resumo da Proposta

Migrar de um sistema complexo com "até 3 temas customizáveis" para um modelo mais simples e robusto com apenas **2 tipos de tema**: Sistema (padrão) ou Personalizado (único).

## Arquitetura Atual vs Nova

| Aspecto | Sistema Atual | Sistema Novo |
|---------|---------------|--------------|
| Quantidade de temas | Até 3 por fotógrafo | 0 ou 1 (Personalizado) |
| Cores customizáveis | 4 (primária, fundo, texto, destaque) | 3 (primária, destaque, texto ênfase) |
| Fundo | Cor livre (color picker) | Apenas Light ou Dark |
| Texto geral | Customizável | Automático baseado no fundo |
| Escopo | Apenas galeria principal | Todas as telas do cliente |

## Nova Interface de Configuração

```text
┌─────────────────────────────────────────────────────────────┐
│  APARÊNCIA DA GALERIA DO CLIENTE                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tipo de Tema:                                              │
│  ┌───────────────┐  ┌──────────────────┐                    │
│  │ ○ Sistema     │  │ ● Personalizado  │                    │
│  │   (Padrão)    │  │   (Sua marca)    │                    │
│  └───────────────┘  └──────────────────┘                    │
│                                                             │
│  ─────────── Se Personalizado ───────────                   │
│                                                             │
│  Fundo:                                                     │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ ○ Claro ☀️  │  │ ● Escuro 🌙 │                          │
│  └─────────────┘  └─────────────┘                          │
│                                                             │
│  Cores da Marca:                                            │
│  ┌────────────────────────────────────────┐                 │
│  │ 🎨 Cor Primária        [#B87333] [■]   │ → Botões, CTAs │
│  │ 🎯 Cor de Destaque     [#8B9A7D] [■]   │ → Seleções     │
│  │ 📝 Cor de Ênfase       [#2D2A26] [■]   │ → Títulos      │
│  └────────────────────────────────────────┘                 │
│                                                             │
│  Preview:                                                   │
│  ┌────────────────────────────────────────┐                 │
│  │ (Simulação do tema em tempo real)      │                 │
│  └────────────────────────────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Regras de Cores por Fundo

### Fundo Claro
- Background: `--background: 30 25% 97%` (creme claro do Lunari)
- Texto padrão: `--foreground: 25 20% 15%` (cinza escuro)
- Card: `--card: 30 20% 99%`
- Border: `--border: 30 15% 88%`
- Muted: `--muted: 30 15% 92%`

### Fundo Escuro
- Background: `--background: 25 15% 10%` (cinza escuro do Lunari)
- Texto padrão: `--foreground: 30 20% 95%` (cinza claro)
- Card: `--card: 25 15% 13%`
- Border: `--border: 25 12% 22%`
- Muted: `--muted: 25 12% 20%`

### Cores Personalizadas (aplicadas sobre qualquer fundo)
- **Primária** → `--primary`, `--ring`, `--terracotta`
- **Destaque** → `--accent`, `--sage`
- **Ênfase** → Títulos (`font-display`), valores destacados

---

## Mudanças Técnicas

### Etapa 1: Atualizar Tipos TypeScript

**Arquivo: `src/types/gallery.ts`**

```typescript
// ANTES
export interface CustomTheme {
  id: string;
  name: string;
  primaryColor: string;
  backgroundColor: string;  // REMOVER
  textColor: string;        // RENOMEAR para emphasisColor
  accentColor: string;
  isDefault?: boolean;      // REMOVER (só 1 tema)
}

// DEPOIS
export interface CustomTheme {
  id: string;
  name: string;
  backgroundMode: 'light' | 'dark';  // NOVO: apenas escolha binária
  primaryColor: string;              // Botões, CTAs
  accentColor: string;               // Seleções, bordas ativas
  emphasisColor: string;             // Títulos, valores (renomeado de textColor)
}

// NOVO: Configuração de tema no nível do fotógrafo
export interface ThemeConfig {
  type: 'system' | 'custom';
  customTheme?: CustomTheme;
}
```

### Etapa 2: Atualizar Schema do Banco de Dados

**Migração SQL:**

```sql
-- 1. Adicionar coluna para modo de fundo
ALTER TABLE gallery_themes 
ADD COLUMN background_mode text NOT NULL DEFAULT 'light' 
CHECK (background_mode IN ('light', 'dark'));

-- 2. Renomear text_color para emphasis_color (clareza semântica)
ALTER TABLE gallery_themes 
RENAME COLUMN text_color TO emphasis_color;

-- 3. Remover colunas obsoletas (background_color migrada para background_mode)
ALTER TABLE gallery_themes 
DROP COLUMN IF EXISTS background_color;

-- 4. Remover coluna is_default (só 1 tema permitido agora)
ALTER TABLE gallery_themes 
DROP COLUMN IF EXISTS is_default;

-- 5. Adicionar unique constraint: 1 tema por usuário
-- Primeiro, deletar temas extras de usuários que têm mais de 1
DELETE FROM gallery_themes 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM gallery_themes 
  ORDER BY user_id, created_at DESC
);

-- Depois, adicionar constraint
ALTER TABLE gallery_themes 
ADD CONSTRAINT one_theme_per_user UNIQUE (user_id);

-- 6. Atualizar gallery_settings para novo formato
ALTER TABLE gallery_settings 
ADD COLUMN theme_type text NOT NULL DEFAULT 'system' 
CHECK (theme_type IN ('system', 'custom'));

-- Migrar active_theme_id existente para theme_type
UPDATE gallery_settings 
SET theme_type = 'custom' 
WHERE active_theme_id IS NOT NULL;
```

### Etapa 3: Simplificar ThemeManager → ThemeConfig

**Arquivo: `src/components/settings/ThemeManager.tsx` → SUBSTITUIR POR `ThemeConfig.tsx`**

Nova UI com:
1. Toggle Sistema vs Personalizado
2. Se Personalizado:
   - Seletor Light/Dark para fundo
   - 3 color pickers (Primária, Destaque, Ênfase)
   - Preview em tempo real

### Etapa 4: Atualizar ThemeEditorModal

**Arquivo: `src/components/settings/ThemeEditorModal.tsx`**

Remover:
- Campo "Nome do Tema" (não necessário com tema único)
- Color picker de backgroundColor
- Color picker de textColor genérico

Adicionar:
- Toggle Light/Dark para backgroundMode
- Renomear "Cor do Texto" → "Cor de Ênfase" (títulos/valores)

### Etapa 5: Refatorar ClientGallery para Novo Tema

**Arquivo: `src/pages/ClientGallery.tsx`**

Atualizar `themeStyles` useMemo:

```typescript
const themeStyles = useMemo(() => {
  const theme = galleryResponse?.theme;
  const clientMode = galleryResponse?.clientMode || 'light';
  
  // Se não há tema personalizado, usar cores do sistema
  if (!theme) return {};
  
  // Determinar fundo baseado no backgroundMode (não mais backgroundColor livre)
  const backgroundMode = theme.backgroundMode || clientMode;
  
  // Cores fixas baseadas no modo de fundo (do index.css)
  const baseColors = backgroundMode === 'dark' ? {
    '--background': '25 15% 10%',
    '--foreground': '30 20% 95%',
    '--card': '25 15% 13%',
    '--muted': '25 12% 20%',
    '--muted-foreground': '30 15% 60%',
    '--border': '25 12% 22%',
  } : {
    '--background': '30 25% 97%',
    '--foreground': '25 20% 15%',
    '--card': '30 20% 99%',
    '--muted': '30 15% 92%',
    '--muted-foreground': '25 10% 45%',
    '--border': '30 15% 88%',
  };
  
  // Cores personalizadas do tema
  const primaryHsl = hexToHsl(theme.primaryColor);
  const accentHsl = hexToHsl(theme.accentColor);
  // emphasisColor usado apenas em classes específicas, não como variável global
  
  return {
    ...baseColors,
    '--primary': primaryHsl || '18 55% 55%',
    '--primary-foreground': backgroundMode === 'dark' ? '25 15% 10%' : '30 25% 98%',
    '--accent': accentHsl || '120 20% 62%',
    '--ring': primaryHsl || '18 55% 55%',
  } as React.CSSProperties;
}, [galleryResponse?.theme, galleryResponse?.clientMode]);
```

### Etapa 6: Aplicar Tema em TODAS as Telas do Cliente

Atualmente o tema só é aplicado na galeria principal. Precisa aplicar em:

1. **PasswordScreen.tsx** - Receber `themeStyles` como prop e aplicar no container
2. **PaymentRedirect.tsx** - Receber `themeStyles` como prop
3. **PixPaymentScreen.tsx** - Receber `themeStyles` como prop
4. **SelectionConfirmation.tsx** - Receber `themeStyles` como prop
5. **Welcome screen** (dentro de ClientGallery) - Já usa `themeStyles`

**Padrão de implementação:**

```tsx
// Em ClientGallery.tsx, passar themeStyles para componentes filhos:
<PasswordScreen
  // ... outras props
  themeStyles={themeStyles}
  backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
/>

// Nos componentes, aplicar:
<div 
  className={cn(
    "min-h-screen flex flex-col",
    backgroundMode === 'dark' ? 'dark' : ''
  )}
  style={themeStyles}
>
```

### Etapa 7: Atualizar Edge Function gallery-access

**Arquivo: `supabase/functions/gallery-access/index.ts`**

```typescript
// Buscar tema com novo schema
if (themeId) {
  const { data: theme } = await supabase
    .from("gallery_themes")
    .select("*")
    .eq("id", themeId)
    .maybeSingle();
  
  if (theme) {
    themeData = {
      id: theme.id,
      backgroundMode: theme.background_mode,  // NOVO
      primaryColor: theme.primary_color,
      accentColor: theme.accent_color,
      emphasisColor: theme.emphasis_color,    // RENOMEADO
    };
  }
}
```

### Etapa 8: Atualizar Criação de Galeria

**Arquivo: `src/pages/GalleryCreate.tsx`**

Simplificar a seção de seleção de tema:
- Remover grid de múltiplos temas
- Mostrar apenas preview do tema único (se existir)
- Manter toggle Light/Dark para override por galeria

### Etapa 9: Atualizar Hook useGallerySettings

**Arquivo: `src/hooks/useGallerySettings.ts`**

- Remover lógica de múltiplos temas
- Simplificar para "tem ou não tem tema personalizado"
- Remover `setDefaultTheme` mutation

---

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/types/gallery.ts` | Editar | Novo formato de CustomTheme |
| `supabase/migrations/...sql` | Criar | Migração do schema |
| `src/components/settings/ThemeManager.tsx` | Reescrever | → ThemeConfig.tsx |
| `src/components/settings/ThemeEditorModal.tsx` | Simplificar | Remover campos extras |
| `src/components/settings/ThemeCard.tsx` | Deletar | Não mais necessário |
| `src/components/ThemePreviewCard.tsx` | Simplificar | Preview único |
| `src/pages/ClientGallery.tsx` | Editar | Nova lógica de themeStyles |
| `src/components/PasswordScreen.tsx` | Editar | Receber themeStyles prop |
| `src/components/PaymentRedirect.tsx` | Editar | Receber themeStyles prop |
| `src/components/PixPaymentScreen.tsx` | Editar | Receber themeStyles prop |
| `src/components/SelectionConfirmation.tsx` | Editar | Receber themeStyles prop |
| `supabase/functions/gallery-access/index.ts` | Editar | Novo formato de resposta |
| `src/hooks/useGallerySettings.ts` | Simplificar | Menos mutations |
| `src/pages/GalleryCreate.tsx` | Simplificar | Seção de tema |
| `src/components/settings/PersonalizationSettings.tsx` | Editar | Usar novo ThemeConfig |

---

## Benefícios

1. **Simplicidade** - Apenas 2 opções: Sistema ou Personalizado
2. **Acessibilidade** - Fundo fixo garante contraste adequado
3. **Consistência** - Tema aplicado em TODAS as telas (login → pagamento)
4. **Manutenibilidade** - Menos código, menos bugs
5. **UX para fotógrafo** - Interface mais intuitiva
6. **Performance** - Menos dados para buscar/processar

---

## Migração de Dados Existentes

Para usuários com temas já criados:
1. Manter o tema mais recente como "tema personalizado"
2. Converter `background_color` claro para `background_mode: 'light'`
3. Converter `background_color` escuro para `background_mode: 'dark'`
4. Renomear `text_color` → `emphasis_color`
5. Deletar temas extras (manter apenas 1)

```sql
-- Detectar se background era claro ou escuro baseado na luminância
UPDATE gallery_themes 
SET background_mode = CASE 
  WHEN (
    -- Calcular luminância aproximada do hex color
    CAST(('x' || SUBSTR(background_color, 2, 2))::bit(8)::int AS FLOAT) * 0.299 +
    CAST(('x' || SUBSTR(background_color, 4, 2))::bit(8)::int AS FLOAT) * 0.587 +
    CAST(('x' || SUBSTR(background_color, 6, 2))::bit(8)::int AS FLOAT) * 0.114
  ) > 127 THEN 'light'
  ELSE 'dark'
END;
```

---

## Ordem de Implementação Sugerida

1. ✅ Criar tipos TypeScript novos
2. ✅ Criar migração SQL
3. ✅ Atualizar Edge Function gallery-access
4. ✅ Criar novo ThemeConfig component
5. ✅ Atualizar ClientGallery com nova lógica
6. ✅ Propagar themeStyles para componentes filhos
7. ✅ Atualizar GalleryCreate
8. ✅ Atualizar useGallerySettings hook
9. ✅ Deletar componentes não utilizados (ThemeCard, etc.)
10. ✅ Testar fluxo completo
