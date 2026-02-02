

# Plano: Ajustes de Logo e Correção de Bug no Painel de Personalização

## Problemas Identificados

### 1. Tamanho do Logo nas Telas do Cliente
O logo atual usa `h-16` (64px) no mobile e `lg:h-[135px]` (135px) no desktop.

**Solicitação:**
- **Desktop**: 50% maior → de 135px para **~200px**
- **Mobile**: 3x maior → de 64px para **~192px**

### 2. Bug: Configurar Logo Apaga Favicon (e vice-versa)
**Causa raiz encontrada no hook `useGallerySettings.ts` (linhas 202-211):**

```typescript
const baseData = {
  studio_logo_url: data.studioLogo || null,  // ❌
  favicon_url: data.faviconUrl || null,      // ❌ Problema aqui!
  // ...
};
```

Quando o usuário atualiza apenas o logo (`{ studioLogo: "..." }`), o campo `data.faviconUrl` é `undefined`. A expressão `undefined || null` resulta em `null`, sobrescrevendo o favicon existente no banco de dados.

### 3. Preview do Logo Muito Pequeno
O container atual no `LogoUploader.tsx` usa `h-24 w-24` (96x96px), cortando logos maiores ou horizontais.

### 4. Falta Recomendação de Tamanho
Não há indicação do tamanho ideal para upload do logo.

---

## Solução Proposta

### Parte 1: Aumentar Tamanho do Logo nas Telas do Cliente

**Cálculo dos novos valores:**

| Breakpoint | Atual | Novo | Fator |
|------------|-------|------|-------|
| Mobile (base) | h-16 (64px) | h-48 (192px) | 3x |
| sm (640px+) | h-20 (80px) | h-48 (192px) | ~2.4x |
| md (768px+) | h-24 (96px) | h-40 (160px) | ~1.7x |
| lg (1024px+) | h-[135px] | h-[200px] | 1.5x |

**Nova classe CSS:**
```css
h-48 sm:h-48 md:h-40 lg:h-[200px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] lg:max-w-[600px] object-contain
```

**Arquivos a modificar:**
- `src/components/ClientGalleryHeader.tsx` (linha 74)
- `src/pages/ClientGallery.tsx` (linha 989)
- `src/components/PasswordScreen.tsx` (linha 58)
- `src/components/FinalizedGalleryScreen.tsx` (linha 38)

---

### Parte 2: Corrigir Bug que Apaga Configurações

**Arquivo:** `src/hooks/useGallerySettings.ts`

**Mudança na função `updateSettings` (linhas 202-217):**

Atualmente, campos não enviados são definidos como `null`. A correção é **não incluir campos `undefined`** no objeto de atualização:

```typescript
// ANTES (problemático):
const baseData = {
  studio_logo_url: data.studioLogo || null,
  favicon_url: data.faviconUrl || null,
  // ...
};

// DEPOIS (corrigido):
const baseData: Record<string, any> = {};

// Só adiciona se o campo foi explicitamente passado
if (data.studioLogo !== undefined) {
  baseData.studio_logo_url = data.studioLogo || null;
}
if (data.faviconUrl !== undefined) {
  baseData.favicon_url = data.faviconUrl || null;
}
// ... mesmo padrão para outros campos
```

Isso garante que atualizar o logo **não afete** o favicon e vice-versa.

---

### Parte 3: Melhorar Preview do Logo no Painel

**Arquivo:** `src/components/settings/LogoUploader.tsx`

**Mudanças:**
1. Aumentar container de preview de `h-24 w-24` para `h-32 w-full max-w-[280px]`
2. Manter proporção do logo visível por completo
3. Adicionar recomendação de tamanho

**Nova UI:**
```tsx
{/* Preview - maior e flexível */}
<div className="relative h-32 w-full max-w-[280px] rounded-xl border-2 ...">
  <img src={logo} alt="Logo" className="h-full w-full object-contain p-3" />
</div>

{/* Recomendação de tamanho */}
<p className="text-xs text-muted-foreground">
  PNG, JPG ou SVG. Máx. 2MB.
  <br />
  <span className="text-primary/70">Recomendado: 600x200px ou maior</span>
</p>
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/hooks/useGallerySettings.ts` | Corrigir lógica de update para não sobrescrever campos não enviados |
| `src/components/settings/LogoUploader.tsx` | Aumentar preview e adicionar recomendação de tamanho |
| `src/components/ClientGalleryHeader.tsx` | Aumentar tamanho do logo |
| `src/pages/ClientGallery.tsx` | Aumentar tamanho do logo na tela de boas-vindas |
| `src/components/PasswordScreen.tsx` | Aumentar tamanho do logo |
| `src/components/FinalizedGalleryScreen.tsx` | Aumentar tamanho do logo |

---

## Detalhes Técnicos

### Nova Classe de Logo (todas as telas cliente):
```css
h-48 sm:h-48 md:h-40 lg:h-[200px] max-w-[280px] sm:max-w-[360px] md:max-w-[450px] lg:max-w-[600px] object-contain
```

### Lógica Corrigida no Hook:
```typescript
const updateSettings = useMutation({
  mutationFn: async (data: Partial<GlobalSettings>) => {
    if (!user?.id) throw new Error('User not authenticated');

    const { data: existing } = await supabase
      .from('gallery_settings')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Build update object only with provided fields
    const updateData: Record<string, unknown> = {};
    
    if (data.studioName !== undefined) updateData.studio_name = data.studioName;
    if (data.studioLogo !== undefined) updateData.studio_logo_url = data.studioLogo || null;
    if (data.faviconUrl !== undefined) updateData.favicon_url = data.faviconUrl || null;
    if (data.defaultGalleryPermission !== undefined) updateData.default_gallery_permission = data.defaultGalleryPermission;
    if (data.clientTheme !== undefined) updateData.client_theme = data.clientTheme;
    if (data.defaultExpirationDays !== undefined) updateData.default_expiration_days = data.defaultExpirationDays;
    if (data.activeThemeId !== undefined) updateData.active_theme_id = data.activeThemeId || null;
    if (data.themeType !== undefined) updateData.theme_type = data.themeType;
    if (data.defaultWatermark !== undefined) updateData.default_watermark = data.defaultWatermark as unknown as Json;

    if (Object.keys(updateData).length === 0) return; // Nothing to update

    if (existing) {
      const { error } = await supabase
        .from('gallery_settings')
        .update(updateData)
        .eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('gallery_settings')
        .insert({ user_id: user.id, ...updateData });
      if (error) throw error;
    }
  },
  // ...
});
```

---

## Resultado Esperado

1. **Logo 50% maior no desktop** (200px) e **3x maior no mobile** (192px)
2. **Configurar logo não apaga favicon** e vice-versa
3. **Preview do logo mostra imagem completa** no painel de personalização
4. **Recomendação clara**: "600x200px ou maior" para upload

