
# Sub-abas Select / Deliver na pagina Galerias

## Visao Geral

Transformar a pagina Dashboard (Galerias) em uma interface multi-modo com duas sub-abas no topo: **Select** (padrao) e **Deliver**. Cada aba possui stats, filtros, cards e empty state proprios.

## Mudancas

### 1. `src/pages/Dashboard.tsx` -- Adicionar sub-abas

Usar o componente `Tabs` do Radix UI (ja disponivel em `@/components/ui/tabs`) para criar duas abas fixas logo abaixo do titulo:

```text
Suas Galerias
Gerencie suas galerias

[ Select ]  [ Deliver ]         [+ Nova Galeria]
```

**Comportamento:**
- "Select" ativo por padrao
- Troca de aba altera: dados filtrados, cards de resumo, filtros de status, visual dos cards, CTA

**Aba Select (existente):**
- Filtra galerias com `tipo !== 'entrega'`
- Stats: Total, Em selecao, Concluidas, Expiradas
- Filtros: Todas, Criadas, Enviadas, Em selecao, Concluidas, Expiradas
- Cards: `GalleryCard` existente com contagem X/Y, badge de status de selecao

**Aba Deliver (nova):**
- Filtra galerias com `tipo === 'entrega'` (usando campo da `Galeria` do hook)
- Stats: Total, Publicadas, Expiradas
- Filtros: Todas, Publicadas, Expiradas
- Cards: novo componente `DeliverGalleryCard`
- Empty state proprio

### 2. `src/hooks/useSupabaseGalleries.ts` -- Expor campo `tipo`

O campo `tipo` ja existe no banco e no `CreateGaleriaData`, mas nao e mapeado no `transformGaleria`. Adicionar `tipo: row.tipo || 'selecao'` ao transform e a interface `Galeria`.

### 3. `src/components/DeliverGalleryCard.tsx` -- Novo componente

Card visual proprio para galerias Deliver:

- Badge azul "Deliver" no topo
- Sem contagem X/Y (selecao)
- Sem icones de selecao
- Exibe: quantidade total de fotos (ex: "32 fotos")
- Status: Publicada ou Expirada
- Icone de download discreto
- CTA: "Ver entrega"
- Thumbnail da primeira foto como preview (usando dados ja disponiveis)

### 4. `src/pages/Dashboard.tsx` -- Empty state Deliver

Quando nao houver galerias Deliver:

- Texto: "Voce ainda nao criou nenhuma galeria de entrega. Use esse modo para entregar as fotos finais aos seus clientes."
- Botao: "Criar galeria de entrega" (navega para `/deliver/new`)

### 5. Subtitulo dinamico

O subtitulo muda conforme a aba:
- Select: "Gerencie as galerias de selecao dos seus clientes"
- Deliver: "Gerencie as entregas finais de fotos"

## Detalhes Tecnicos

### Estrutura do Dashboard refatorado

```text
Dashboard
  |-- Header (titulo + subtitulo dinamico + botao Nova Galeria)
  |-- Tabs (Select | Deliver)
  |    |-- TabsContent "select"
  |    |    |-- Stats (Total, Em selecao, Concluidas, Expiradas)
  |    |    |-- Search + Filtros de selecao + View toggle
  |    |    |-- Grid de GalleryCard
  |    |    |-- Empty state (selecao)
  |    |-- TabsContent "deliver"
  |         |-- Stats (Total, Publicadas, Expiradas)
  |         |-- Search + Filtros de entrega
  |         |-- Grid de DeliverGalleryCard
  |         |-- Empty state (entrega)
```

### Filtragem por tipo

No Dashboard, separar as galerias por tipo antes de aplicar filtros de status:

```typescript
const selectGalleries = allGalleries.filter(g => g.tipo !== 'entrega');
const deliverGalleries = allGalleries.filter(g => g.tipo === 'entrega');
```

### Mapeamento de status Deliver

Para galerias de entrega, os status relevantes sao:
- `publicada` / `enviado` --> "Publicada"
- `expirada` / `expirado` --> "Expirada"
- `rascunho` / `criado` --> "Rascunho" (nao publicada ainda)

### DeliverGalleryCard -- Props

Reutiliza a interface `Gallery` existente (mesma transformacao), mas renderiza informacoes diferentes:
- Ignora `selectedCount`, `includedPhotos`, `extraCount`, `extraTotal`
- Mostra `photos.length` como "N fotos"
- Badge "Deliver" azul
- Status simplificado (Publicada/Expirada)

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/Dashboard.tsx` | Refatorar com Tabs, stats/filtros por aba |
| `src/components/DeliverGalleryCard.tsx` | Criar card proprio para Deliver |
| `src/hooks/useSupabaseGalleries.ts` | Adicionar `tipo` ao transform e interface |
