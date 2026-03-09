

## Reestruturar seções "Aguardando ação" e "Atividades recentes" no Dashboard

### Mudanças

**1. "Aguardando ação" — Mostrar apenas expiradas e concluídas**

Alterar o filtro `attentionGalleries` (linha 274-287) para incluir apenas:
- `status === 'expirado'` — galerias com prazo vencido
- `status === 'selecao_completa'` — seleções concluídas aguardando ação do fotógrafo

Remover a coluna "Prazo" da tabela (não faz sentido para concluídas/expiradas). Ajustar a coluna de status para exibir badges adequados.

**2. "Atividades recentes" — Adicionar galerias enviadas/em seleção + acessos**

Transformar a seção em duas partes:

- **Galerias ativas** (enviadas + em seleção): Lista de cards compactos mostrando cliente, sessão, status badge, progresso de seleção (X/Y) e dias restantes do prazo
- **Histórico de atividades**: Manter o feed atual de `galeria_acoes` com os eventos recentes

A seção de galerias ativas virá de um `useMemo` filtrando `galleries` com `status === 'enviado' || status === 'selecao_iniciada'`, ordenadas por prazo mais próximo.

### Arquivos alterados

Apenas `src/pages/Home.tsx`:
- Filtro `attentionGalleries`: trocar para `expirado` e `selecao_completa`
- Tabela "Aguardando ação": remover coluna Prazo, ajustar colunas para contexto de expiradas/concluídas
- Seção "Atividades recentes": adicionar sub-seção com galerias enviadas/em seleção antes do feed de ações
- Novo `useMemo` para `activeGalleries` (enviadas + em seleção)

