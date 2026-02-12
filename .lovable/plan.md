

# Remover Fonte Serif -- Usar Sans Moderna em Todo o Sistema

## Resumo

Substituir Playfair Display (serif) por Inter (sans-serif) em todo o sistema, desde login ate telas do cliente. Adicionar peso maior (font-semibold/font-bold) nos titulos para compensar a perda de personalidade da serif.

---

## Mudancas

### 1. Configuracao global

**`src/index.css`**
- Remover import do Google Fonts para Playfair Display (manter apenas Inter)
- Alterar regra CSS de `h1-h6` de `font-family: 'Playfair Display', serif` para `font-family: 'Inter', system-ui, sans-serif` com `font-weight: 600`

**`tailwind.config.ts`**
- Alterar `fontFamily.display` de `['"Playfair Display"', 'serif']` para `['Inter', 'system-ui', 'sans-serif']`

### 2. Classes nos componentes (~23 arquivos)

Substituicao global em todos os arquivos:
- `font-display` -> `font-sans` (ou remover, ja que body usa Inter)
- `font-serif` -> remover
- Garantir que titulos com `font-display` recebam `font-semibold` ou `font-bold` para peso adequado

**Arquivos afetados:**
- `src/pages/GalleryCreate.tsx` (7 ocorrencias de font-serif, 1 font-display)
- `src/pages/Dashboard.tsx` (4 font-display)
- `src/pages/DeliverCreate.tsx`
- `src/pages/DeliverDetail.tsx` (3 font-display)
- `src/pages/GalleryDetail.tsx`
- `src/pages/GalleryEdit.tsx`
- `src/pages/GalleryPreview.tsx`
- `src/pages/Clients.tsx`
- `src/pages/Credits.tsx`
- `src/pages/CreditsCheckout.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Account.tsx`
- `src/pages/Auth.tsx`
- `src/pages/AccessDenied.tsx`
- `src/pages/ClientGallery.tsx`
- `src/pages/ClientProfile.tsx`
- `src/components/Logo.tsx`
- `src/components/FinalizedPreviewScreen.tsx`
- `src/components/SelectionConfirmation.tsx`
- `src/components/SelectionSummary.tsx`
- `src/components/ClientGalleryHeader.tsx`
- `src/components/PasswordScreen.tsx`
- `src/components/settings/ThemeConfig.tsx`
- `src/components/GalleryCard.tsx`
- `src/components/DeliverGalleryCard.tsx`

### 3. Fallback em estilos inline

Onde houver `fontFamily: '"Playfair Display", serif'` como fallback em codigo (ex: `FinalizedPreviewScreen.tsx`), substituir por `'Inter', sans-serif`.

---

## Detalhes tecnicos

### index.css -- antes/depois

Antes:
```text
@import url('...Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600...');

h1, h2, h3, h4, h5, h6 {
  font-family: 'Playfair Display', serif;
  font-medium tracking-tight;
}
```

Depois:
```text
@import url('...Inter:wght@300;400;500;600;700...');

h1, h2, h3, h4, h5, h6 {
  font-family: 'Inter', system-ui, sans-serif;
  font-semibold tracking-tight;
}
```

### tailwind.config.ts

```text
fontFamily: {
  display: ['Inter', 'system-ui', 'sans-serif'],
  sans: ['Inter', 'system-ui', 'sans-serif'],
}
```

### Padrao de substituicao nos componentes

| Classe antiga | Classe nova |
|---------------|-------------|
| `font-display text-2xl font-semibold` | `text-2xl font-bold` |
| `font-display text-xl font-semibold` | `text-xl font-semibold` |
| `font-display font-semibold` | `font-semibold` |
| `font-serif` | (remover) |
| `font-display text-lg font-medium` | `text-lg font-semibold` |

Titulos grandes (h1, text-2xl+) usarao `font-bold`. Titulos menores (text-lg, text-xl) usarao `font-semibold`.

