

## Adicionar paginação de 20 galerias por página

### Problema
Todas as galerias são listadas de uma vez, sem limite. Precisamos mostrar apenas 20 por página com paginação.

### Mudanças

**1. `src/pages/Dashboard.tsx`**

- Adicionar estado `currentPage` (resetado ao mudar filtro/busca/tab)
- Aplicar `.slice()` nas listas filtradas: `(page-1)*20` até `page*20`
- Renderizar componente de paginação abaixo da lista (tanto na tab Select quanto Transfer)
- Usar os componentes `Pagination` já existentes em `src/components/ui/pagination.tsx`
- Stats continuam baseados no total (sem paginação)

**2. Lógica de paginação**

```
const PAGE_SIZE = 20;
const [selectPage, setSelectPage] = useState(1);
const [deliverPage, setDeliverPage] = useState(1);

// Reset page on filter/search change
useEffect(() => { setSelectPage(1); }, [search, selectStatusFilter]);
useEffect(() => { setDeliverPage(1); }, [search, deliverStatusFilter]);

const paginatedSelect = filteredSelectGalleries.slice((selectPage-1)*PAGE_SIZE, selectPage*PAGE_SIZE);
const totalSelectPages = Math.ceil(filteredSelectGalleries.length / PAGE_SIZE);
```

- Renderizar `Pagination` com Previous/Next e números de página (máx 5 visíveis com ellipsis)
- Esconder paginação quando totalPages <= 1

### Arquivos
- `src/pages/Dashboard.tsx` (único arquivo alterado)

