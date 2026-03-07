

## Dashboard Page for Lunari Gallery Select

### Overview
Create a new `src/pages/Home.tsx` page that serves as the main dashboard, replacing the current `Index.tsx` redirect. The page will display account resources, monthly metrics, gallery status distribution, galleries requiring attention, and recent activity.

### Data Sources (existing hooks/queries)
- **Credits**: `useGalleryCredits()` — returns `credits`, `galleriesPublished`, `canPublish`, `isAdmin`
- **Storage**: `useTransferStorage()` — returns `storageUsedBytes`, `storageLimitBytes`, `storageUsedPercent`, `planName`, `hasTransferPlan`
- **Galleries**: `useSupabaseGalleries()` — returns all galleries with status, dates, client info
- **Recent activity**: query `galeria_acoes` table directly

### Routing Changes
- `src/App.tsx`: Add route `/dashboard` pointing to `Home` with Layout
- `src/pages/Index.tsx`: Change redirect from `/galleries/select` to `/dashboard`
- `src/components/Layout.tsx`: Add "Dashboard" as first nav item pointing to `/dashboard`

### Page Structure

**Background**: `bg-[#F6F7F9]` applied via the page wrapper (cards remain white).

**Section 1 — Account Resources** (2-column grid)
- **Card 1: Gallery Credits** — Large credit number from `useGalleryCredits()`, "créditos disponíveis" label, "Seus créditos não expiram" note, CTA button "Comprar créditos" → navigates to `/credits`
- **Card 2: Storage** — Plan name from `useTransferStorage()`, progress bar showing `storageUsedPercent`, formatted sizes, buttons "Ver planos" → `/subscription`, "Gerenciar assinatura" link

**Section 2 — Monthly Metrics** (4-column grid)
- Computed from `useSupabaseGalleries()` filtering by `createdAt` in current month:
  - Galerias criadas (count where tipo='selecao' created this month)
  - Galerias enviadas (status 'enviado' or later, sent this month)
  - Seleções concluídas (status 'selecao_completa' this month)
  - Vendas extras (sum of `valorExtras` from galleries finalized this month)

**Section 3 — Gallery Status Overview** (donut chart)
- Use `recharts` PieChart (already installed) with status distribution from all galleries
- Color-coded: Criadas (gray), Enviadas (blue), Em seleção (amber), Concluídas (green), Expiradas (red)

**Section 4 — Galleries Requiring Attention** (table)
- Filter galleries where: status is 'sent' (client hasn't started), status is 'selection_started' with deadline approaching (< 3 days), or selection is incomplete
- Show: Cliente, Sessão, Status badge, Seleção progress, Prazo
- "Abrir galeria" button per row

**Section 5 — Recent Activity** (vertical timeline)
- Query `galeria_acoes` table (last 10 actions), joined with gallery name
- Display as simple list with icon, description, timestamp

### Visual Style
- Cards: `bg-white rounded-2xl shadow-sm border border-border/30 p-6`
- Large numbers: `text-4xl font-bold`
- Secondary text: `text-sm text-muted-foreground`
- Gap between cards: `gap-5`
- Page max-width: `max-w-[1100px] mx-auto`
- CTA buttons: `variant="terracotta"` (existing)

### Files
- **Create**: `src/pages/Home.tsx`
- **Edit**: `src/pages/Index.tsx` (redirect to `/dashboard`)
- **Edit**: `src/App.tsx` (add `/dashboard` route)
- **Edit**: `src/components/Layout.tsx` (add Dashboard nav item)

