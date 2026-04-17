

# Plano: Reorganizar Identidade Visual + Refinar Aparência

## 1. Identidade Visual: Logo + Favicon lado a lado

**Arquivo:** `src/components/settings/PersonalizationSettings.tsx`

Substituir o layout vertical (logo em cima, divisor, favicon embaixo) por um grid 2 colunas no desktop e 1 coluna no mobile:

```tsx
<div className="lunari-card p-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
    <LogoUploader ... />
    <div className="md:border-l md:border-border md:pl-8 pt-6 md:pt-0 border-t md:border-t-0">
      <FaviconUploader ... />
    </div>
  </div>
</div>
```

- Mobile (<768px): empilhado, divisor horizontal entre eles
- Desktop (≥768px): lado a lado com divisor vertical

## 2. Aparência da Galeria: mais clean e intuitivo

**Arquivo:** `src/components/settings/ThemeConfig.tsx`

### Mudanças:

**a) Tipo de Tema → Switch ao invés de 2 cards grandes**

Substituir o `RadioGroup` com 2 botões enormes por um Switch simples:
```
[Switch: Personalizar tema] (off = Sistema, on = Personalizado)
```
Mais limpo, ocupa 1 linha em vez de 2 cards de ~80px.

**b) Fundo Claro/Escuro → Toggle compacto com ícones**

Substituir os 2 botões `flex-1` grandes por um toggle inline tipo segmented control compacto (~40px altura), usando `ToggleGroup` do shadcn:
```
[ ☀ Claro ] [ 🌙 Escuro ]
```
Largura `w-fit` em vez de ocupar toda a linha.

**c) Reorganização visual:**
- Mover Preview para o topo (logo após o switch), fixo e sempre visível, mostrando "Sistema" ou "Custom"
- Color pickers em grid responsivo: `grid-cols-1 sm:grid-cols-3` (mobile empilha)
- Reduzir padding/gaps gerais (`space-y-6` → `space-y-5`)
- Remover `h-10 w-10` ícone Palette do header (ou reduzir para `h-8 w-8`) — header mais discreto

**d) Botões de ação mais limpos:**
- "Salvar Alterações" só aparece quando `hasChanges = true` (em vez de sempre disabled)
- "Usar Sistema" vira um link discreto `text-sm text-muted-foreground` em vez de botão outline

## Resultado esperado

- **Logo + Favicon**: lado a lado no desktop, empilhado no mobile, dentro de um único card
- **Aparência**: switch para ativar custom, toggle compacto claro/escuro, layout vertical mais respirado e menos poluído
- Mantém toda a lógica de salvamento e estado existente
- Totalmente responsivo

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/settings/PersonalizationSettings.tsx` | Grid 2 colunas para Logo + Favicon |
| `src/components/settings/ThemeConfig.tsx` | Switch p/ tipo, ToggleGroup p/ fundo, layout mais clean |

