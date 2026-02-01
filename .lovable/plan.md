
# Implementar Histórico Completo de Ações da Galeria

## Análise do Problema

### Situação Atual

O sistema **já possui** a tabela `galeria_acoes` e o componente `ActionTimeline` para exibir ações, porém há dois problemas principais:

| Problema | Descrição |
|----------|-----------|
| **Histórico não é buscado do banco** | O `GalleryDetail.tsx` constrói o array `actions` manualmente usando apenas `createdAt` e `enviadoEm` da galeria, ignorando completamente os registros da tabela `galeria_acoes` |
| **Ações importantes não são registradas** | Alguns eventos cruciais não estão sendo salvos na tabela |

### Mapeamento de Eventos

| Evento | Salvo atualmente? | Onde deveria ser salvo |
|--------|-------------------|------------------------|
| Galeria criada | Sim - `useSupabaseGalleries.ts` | OK |
| Galeria enviada | Sim - `useSupabaseGalleries.ts` | OK |
| Cliente acessou pela primeira vez | **NÃO** | `gallery-access` Edge Function |
| Cliente confirmou seleção | Sim - `confirm-selection` Edge Function | OK |
| Seleção reaberta | Sim - `useSupabaseGalleries.ts` | OK |
| Pagamento confirmado | Sim - `mercadopago-webhook` | OK |

### Fluxo Visual do Problema

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     FLUXO ATUAL (QUEBRADO)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  galeria_acoes (BD)          GalleryDetail.tsx (UI)                │
│  ┌─────────────────┐         ┌─────────────────┐                   │
│  │ criada          │    ✗    │ actions = []    │                   │
│  │ enviada         │ ──────► │   + createdAt   │  ← Construído     │
│  │ cliente_acessou │    ✗    │   + enviadoEm   │    manualmente    │
│  │ confirmada      │    ✗    │                 │                   │
│  └─────────────────┘         └─────────────────┘                   │
│                                                                     │
│  Resultado: Histórico incompleto e desatualizado                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     FLUXO PROPOSTO (CORRETO)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  galeria_acoes (BD)          GalleryDetail.tsx (UI)                │
│  ┌─────────────────┐         ┌─────────────────┐                   │
│  │ criada          │    ✓    │ useQuery(...)   │                   │
│  │ enviada         │ ──────► │   actions =     │  ← Busca do       │
│  │ cliente_acessou │    ✓    │   galeria_acoes │    banco          │
│  │ confirmada      │    ✓    │                 │                   │
│  │ reaberta        │    ✓    │                 │                   │
│  └─────────────────┘         └─────────────────┘                   │
│                                                                     │
│  Resultado: Histórico completo e em tempo real                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Plano de Implementação

### 1. Registrar "Cliente Acessou Pela Primeira Vez" na Edge Function

**Arquivo:** `supabase/functions/gallery-access/index.ts`

Após validar o acesso com sucesso, verificar se já existe uma ação do tipo `cliente_acessou` para esta galeria. Se não existir, criar:

```typescript
// Verificar se é o primeiro acesso
const { data: existingAccess } = await supabase
  .from('galeria_acoes')
  .select('id')
  .eq('galeria_id', gallery.id)
  .eq('tipo', 'cliente_acessou')
  .maybeSingle();

// Se primeiro acesso, registrar ação
if (!existingAccess) {
  await supabase.from('galeria_acoes').insert({
    galeria_id: gallery.id,
    tipo: 'cliente_acessou',
    descricao: 'Cliente acessou a galeria pela primeira vez',
    user_id: null, // Ação anônima do cliente
  });
  console.log('📊 First access logged for gallery:', gallery.id);
}
```

### 2. Buscar Ações do Banco no GalleryDetail

**Arquivo:** `src/pages/GalleryDetail.tsx`

Adicionar uma query para buscar as ações da tabela `galeria_acoes`:

```typescript
// Fetch gallery actions from database
const { data: galleryActions = [] } = useQuery({
  queryKey: ['galeria-acoes', id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('galeria_acoes')
      .select('id, tipo, descricao, created_at')
      .eq('galeria_id', id)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching gallery actions:', error);
      return [];
    }
    return data;
  },
  enabled: !!id,
});
```

### 3. Transformar Ações do Banco para o Formato do Timeline

**Arquivo:** `src/pages/GalleryDetail.tsx`

Substituir a construção manual do array `actions` por uma transformação dos dados do banco:

```typescript
// Transform database actions to GalleryAction format
const actions: GalleryAction[] = useMemo(() => {
  // Mapeamento de tipos do banco para tipos do componente
  const typeMap: Record<string, GalleryAction['type']> = {
    'criada': 'created',
    'enviada': 'sent',
    'cliente_acessou': 'client_started',
    'cliente_confirmou': 'client_confirmed',
    'selecao_reaberta': 'selection_reopened',
    'pagamento_confirmado': 'client_confirmed', // Agrupa com confirmação
  };
  
  // Filtra apenas ações importantes para o timeline principal
  const relevantTypes = ['criada', 'enviada', 'cliente_acessou', 'cliente_confirmou', 'selecao_reaberta', 'pagamento_confirmado'];
  
  return galleryActions
    .filter(action => relevantTypes.includes(action.tipo))
    .map(action => ({
      id: action.id,
      type: typeMap[action.tipo] || 'created',
      timestamp: new Date(action.created_at),
      description: action.descricao || action.tipo,
    }));
}, [galleryActions]);
```

### 4. Atualizar o Componente ActionTimeline

**Arquivo:** `src/components/ActionTimeline.tsx`

Adicionar configuração para o tipo `pagamento_confirmado`:

```typescript
import { CreditCard } from 'lucide-react';

const actionConfig: Record<GalleryAction['type'], { icon: React.ElementType; color: string }> = {
  created: { icon: Circle, color: 'text-muted-foreground' },
  sent: { icon: Send, color: 'text-blue-500' },
  client_started: { icon: MousePointer, color: 'text-amber-500' },
  client_confirmed: { icon: CheckCircle, color: 'text-green-500' },
  selection_reopened: { icon: RotateCcw, color: 'text-primary' },
  expired: { icon: Clock, color: 'text-destructive' },
};
```

### 5. Atualizar Tipos

**Arquivo:** `src/types/gallery.ts`

Garantir que o tipo `GalleryAction['type']` inclui todos os tipos necessários (já está correto).

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/gallery-access/index.ts` | Adicionar registro de primeiro acesso do cliente |
| `src/pages/GalleryDetail.tsx` | Buscar ações do banco via `useQuery` + transformar para formato do timeline |
| `src/components/ActionTimeline.tsx` | Nenhuma mudança necessária (já suporta os tipos) |

## Resultado Esperado

Após implementação, o histórico mostrará:

| Evento | Ícone | Cor |
|--------|-------|-----|
| Galeria criada | ○ | Cinza |
| Galeria enviada para o cliente | → | Azul |
| Cliente acessou a galeria pela primeira vez | 👆 | Âmbar |
| Cliente confirmou a seleção | ✓ | Verde |
| Seleção reaberta pelo fotógrafo | ↺ | Primária |
| (em caso de reativação, todos os eventos subsequentes aparecem na ordem) | | |

O histórico será **dinâmico** e refletirá exatamente o que está salvo no banco de dados, incluindo múltiplos ciclos de reativação.
