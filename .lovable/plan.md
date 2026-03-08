

## Adicionar paginação na página de Clientes

### Mudança em `src/pages/Clients.tsx`

- Adicionar estado `currentPage` (reset ao mudar busca)
- `PAGE_SIZE = 20`, aplicar `.slice()` no `filteredClients`
- Renderizar botões "Anterior" e "Próxima" com setas (`ChevronLeft`/`ChevronRight`) abaixo da tabela
- Esconder paginação quando `totalPages <= 1`
- Mostrar indicador "Página X de Y"

Mesmo padrão já usado no Dashboard.

### Arquivo
- `src/pages/Clients.tsx` (único)

