

# Correção: Consistência visual do glassmorphism e opacidade do gradiente

## Problemas identificados

### 1. Cards opacos na página de Créditos (`Credits.tsx`)
- Linhas 233 e 270: cards combo usam `bg-background` (opaco, sem transparência) em vez de `glass`
- Linha 215: seção wrapper usa `bg-muted/30` com opacidade que bloqueia parcialmente o fundo mas sem blur, criando efeito inconsistente

### 2. Cards opacos na página de Referrals (`Referrals.tsx`)
- Usa `<Card>` do shadcn, que aplica `bg-card` — este token tem alpha (`0.38`), então tem transparência parcial
- Porém o `backdrop-blur-xl` no `Card` base pode não ser suficiente em algumas situações; visualmente parece ok mas vale uniformizar

### 3. Barra de filtros na página de Galerias (`Dashboard.tsx`)
- Linha 361: `border border-border rounded-lg` sem fundo definido — fica transparente com o gradiente sangrando, visualmente desconfortável (conforme screenshot)

### 4. InternalBackground muito intenso em light mode
- `InternalBackground.tsx` linha 8: wrapper das esferas tem `opacity-100` em light — as esferas terra-cota ficam muito fortes, criando manchas visíveis através dos cards glass

### 5. Páginas standalone com `bg-background` opaco
- `CreditsCheckout.tsx`, `CreditsPayment.tsx`, `GalleryPreview.tsx`: usam `min-h-screen bg-background` — estas são páginas fora do Layout, então o fundo opaco é correto (não têm InternalBackground)
- `GalleryCreate.tsx` linha 1375: `bg-background` em chips dentro de formulário — aceitável para legibilidade de inputs

## Correções propostas

### A. `InternalBackground.tsx` — Reduzir opacidade em light mode
- Mudar `opacity-100 dark:opacity-25` para `opacity-60 dark:opacity-25` no wrapper das esferas
- Isso suaviza o gradiente em light mode sem eliminá-lo

### B. `Credits.tsx` — Cards combo com glass
- Substituir `bg-background` dos cards combo por classe `glass` para consistência
- Manter a seção wrapper `bg-muted/30` mas adicionar `backdrop-blur-sm` para suavizar o fundo

### C. `Dashboard.tsx` — Barra de filtros com fundo
- Adicionar `bg-background/60 backdrop-blur-sm` na barra de filtros para evitar que o gradiente sangre através dos botões

### D. `Card` component (`ui/card.tsx`)
- Já tem `backdrop-blur-xl` e `bg-card` com alpha — está correto
- Adicionar `border-border/50` para consistência com o design system glass

### E. Varredura de outros componentes
- `PersonalizationSettings.tsx`: usa `lunari-card` (alias de `glass`) — correto
- `Home.tsx` dashboard: usa `glass` — correto
- `Referrals.tsx`: usa `Card` — parcialmente transparente, ok
- `Clients.tsx`, `Settings.tsx`: conteúdo direto sem cards wrapper — ok (texto sobre fundo)

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/InternalBackground.tsx` | `opacity-100` → `opacity-60` |
| `src/pages/Credits.tsx` | `bg-background` → `glass` nos cards combo; adicionar blur na seção |
| `src/pages/Dashboard.tsx` | Adicionar fundo na barra de filtros |
| `src/components/ui/card.tsx` | `border` → `border-border/50` para glass consistency |

