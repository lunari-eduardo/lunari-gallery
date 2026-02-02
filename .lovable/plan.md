

# Correção: Fonte Personalizada Não Aparece na Galeria do Cliente

## Problema Identificado

A fonte selecionada pelo fotógrafo só aparece na **configuração da galeria** (GalleryCreate), mas **não aparece em nenhuma tela do cliente**:
- Tela de senha
- Tela de boas-vindas
- Header durante seleção
- Tela de confirmação

## Diagnóstico

Existem **3 problemas** que impedem a fonte de aparecer:

### Problema 1: Edge Function não retorna `settings` para tela de senha

Quando a galeria requer senha, o Edge Function retorna apenas:
```json
{
  "requiresPassword": true,
  "sessionName": "...",
  "clientMode": "light"
}
```

O código tenta acessar:
```typescript
getFontFamilyById(galleryResponse?.settings?.sessionFont)
```

Mas `galleryResponse.settings` é `undefined` nesse cenário.

### Problema 2: Fonte padrão não está carregada no Google Fonts

O `index.html` carrega as 10 fontes customizáveis, mas **não inclui Playfair Display** (a fonte padrão). Quando uma galeria não tem fonte customizada, o fallback falha porque a fonte não está disponível:

```typescript
// FontSelect.tsx
return font?.family || GALLERY_FONTS[0].family; // '"Playfair Display", serif'
```

Porém Playfair Display não está no link do Google Fonts.

### Problema 3: Tela finalizada também não recebe dados corretos

Quando a galeria está finalizada, o Edge Function retorna:
```json
{
  "finalized": true,
  "sessionName": "...",
  "theme": {...}
}
```

Mas não inclui `settings.sessionFont` nem `settings.titleCaseMode`.

---

## Solução

### Mudança 1: Adicionar Playfair Display ao Google Fonts

**Arquivo**: `index.html`

Atualizar o link para incluir Playfair Display:

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Imperial+Script&family=League+Script&family=Allura&family=Amatic+SC:wght@400;700&family=Shadows+Into+Light&family=Source+Serif+4:wght@400;600;700&family=Cormorant:wght@400;500;600;700&family=Bodoni+Moda:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Mudança 2: Edge Function deve retornar settings para tela de senha

**Arquivo**: `supabase/functions/gallery-access/index.ts`

Na resposta `requiresPassword`, incluir os campos de configuração visual:

**Antes** (linhas 118-131):
```typescript
if (!password) {
  return new Response(
    JSON.stringify({ 
      requiresPassword: true, 
      galleryId: gallery.id,
      sessionName: gallery.nome_sessao,
      clientMode: clientMode,
    }),
    ...
  );
}
```

**Depois**:
```typescript
if (!password) {
  const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
  
  return new Response(
    JSON.stringify({ 
      requiresPassword: true, 
      galleryId: gallery.id,
      sessionName: gallery.nome_sessao,
      clientMode: clientMode,
      // Include font settings for password screen styling
      settings: {
        sessionFont: galleryConfig?.sessionFont || undefined,
        titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
      },
    }),
    ...
  );
}
```

### Mudança 3: Edge Function deve retornar settings para tela finalizada

**Arquivo**: `supabase/functions/gallery-access/index.ts`

Na resposta `finalized`, incluir os campos de fonte:

**Antes** (linhas 92-103):
```typescript
return new Response(
  JSON.stringify({ 
    finalized: true,
    sessionName: gallery.nome_sessao,
    studioSettings: settings || null,
    theme: themeData,
    clientMode: clientMode,
  }),
  ...
);
```

**Depois**:
```typescript
const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;

return new Response(
  JSON.stringify({ 
    finalized: true,
    sessionName: gallery.nome_sessao,
    studioSettings: settings || null,
    theme: themeData,
    clientMode: clientMode,
    // Include font settings for finalized screen styling
    settings: {
      sessionFont: galleryConfig?.sessionFont || undefined,
      titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
    },
  }),
  ...
);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `index.html` | Adicionar Playfair Display ao link do Google Fonts |
| `supabase/functions/gallery-access/index.ts` | Incluir `settings` na resposta de password e finalized |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ANTES (quebrado)                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tela de senha → galleryResponse.settings = undefined               │
│                → getFontFamilyById(undefined) = Playfair (fallback) │
│                → Playfair não carregada = fonte do sistema          │
│                                                                     │
│  Tela principal → gallery.settings.sessionFont = "imperial"        │
│                 → getFontFamilyById("imperial") = Imperial Script   │
│                 → Imperial Script carregada ✓ (funciona)            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ DEPOIS (corrigido)                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tela de senha → galleryResponse.settings.sessionFont = "imperial" │
│                → getFontFamilyById("imperial") = Imperial Script    │
│                → Imperial Script carregada ✓ (funciona)             │
│                                                                     │
│  Fallback      → getFontFamilyById(undefined) = Playfair Display   │
│                → Playfair Display agora carregada ✓ (funciona)      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a correção, a fonte selecionada pelo fotógrafo será exibida consistentemente em:

1. **Tela de senha** - Nome da sessão com fonte personalizada
2. **Tela de boas-vindas** - Título com fonte personalizada  
3. **Header da galeria** - Nome da sessão com fonte personalizada
4. **Tela de confirmação** - Nome da sessão com fonte personalizada
5. **Tela finalizada** - Nome da sessão com fonte personalizada

