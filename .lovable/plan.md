
# Plano: Perfil do Cliente com Histórico de Galerias e Pagamentos

## Situação Atual

Após análise do banco de dados e código existente, identifiquei a seguinte situação:

### O que já existe (estrutura de dados)

| Tabela | Relacionamento | Status |
|--------|---------------|--------|
| `clientes` | Tabela principal de clientes | Campos `total_galerias` e `gallery_status` existem mas **não são atualizados automaticamente** |
| `galerias` | `cliente_id` → FK para `clientes` | Funcionando, mas join não usado na listagem |
| `cobrancas` | `cliente_id` → FK para `clientes` | Funcionando, pagamentos registrados corretamente |
| `galeria_acoes` | Histórico de ações da galeria | Funcionando |

### Problemas Identificados

1. **Contadores desatualizados**: Os campos `total_galerias` e `gallery_status` na tabela `clientes` são inicializados com valores estáticos (`0` e `sem_galeria`) mas **nunca são atualizados** quando galerias são criadas/excluídas
2. **Menu "Ver galerias" não funciona**: Atualmente só exibe um toast informativo, não abre nenhuma tela
3. **Não há tela de perfil do cliente**: Falta uma página dedicada para visualizar histórico completo
4. **Dados de pagamento não agregados por cliente**: Os pagamentos estão salvos mas não há view consolidada

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PERFIL DO CLIENTE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /clients/:clientId                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  HEADER: Avatar + Nome + Email + Telefone + Status                  │   │
│  │  Botões: Editar | Nova Galeria                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────┐   │
│  │  RESUMO FINANCEIRO      │  │  ESTATÍSTICAS                          │   │
│  │  ─────────────────────  │  │  ─────────────────────                  │   │
│  │  Total pago: R$ 150,00  │  │  Galerias: 3                           │   │
│  │  Fotos extras: 12       │  │  Fotos selecionadas: 45                │   │
│  │  Pagamentos: 5          │  │  Favoritas: 8                          │   │
│  └─────────────────────────┘  └─────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TABS: Galerias | Pagamentos                                        │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  [Tab: Galerias]                                                    │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │ Ensaio Casamento    │ Enviado  │ 25 fotos │ R$ 50,00 │  >    │ │   │
│  │  │ Book 15 Anos        │ Concluído│ 30 fotos │ R$ 75,00 │  >    │ │   │
│  │  │ Ensaio Família      │ Rascunho │ 0 fotos  │ —        │  >    │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  [Tab: Pagamentos]                                                  │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │ 27/01/2026 │ InfinitePay │ R$ 20,00 │ Ensaio Casamento      │ │   │
│  │  │ 26/01/2026 │ InfinitePay │ R$ 5,00  │ —                     │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Etapas de Implementação

### Fase 1: Trigger de Atualização Automática (Banco de Dados)

Criar trigger para manter `total_galerias` e `gallery_status` sincronizados:

```sql
-- Função para atualizar contadores do cliente
CREATE OR REPLACE FUNCTION update_client_gallery_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar cliente quando galeria é criada/atualizada/excluída
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE clientes SET
      total_galerias = (
        SELECT COUNT(*) FROM galerias 
        WHERE cliente_id = NEW.cliente_id
      ),
      gallery_status = CASE 
        WHEN EXISTS (
          SELECT 1 FROM galerias 
          WHERE cliente_id = NEW.cliente_id 
          AND status NOT IN ('excluido', 'cancelado')
        ) THEN 'ativo' 
        ELSE 'sem_galeria' 
      END,
      updated_at = NOW()
    WHERE id = NEW.cliente_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE clientes SET
      total_galerias = (
        SELECT COUNT(*) FROM galerias 
        WHERE cliente_id = OLD.cliente_id
      ),
      gallery_status = CASE 
        WHEN EXISTS (
          SELECT 1 FROM galerias 
          WHERE cliente_id = OLD.cliente_id 
          AND status NOT IN ('excluido', 'cancelado')
        ) THEN 'ativo' 
        ELSE 'sem_galeria' 
      END,
      updated_at = NOW()
    WHERE id = OLD.cliente_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger na tabela galerias
CREATE TRIGGER trigger_update_client_stats
AFTER INSERT OR UPDATE OF cliente_id, status OR DELETE
ON galerias
FOR EACH ROW
EXECUTE FUNCTION update_client_gallery_stats();
```

### Fase 2: Hook para Dados do Cliente

Criar `useClientProfile.ts` para buscar dados consolidados:

```typescript
// src/hooks/useClientProfile.ts

interface ClientProfile {
  client: Client;
  galleries: ClientGallery[];
  payments: ClientPayment[];
  stats: {
    totalGalleries: number;
    totalPhotosSelected: number;
    totalFavorites: number;
    totalPaid: number;
    totalExtrasPhotos: number;
  };
}

export function useClientProfile(clientId: string) {
  // Buscar cliente
  // Buscar galerias do cliente
  // Buscar cobranças pagas do cliente
  // Calcular estatísticas agregadas
}
```

### Fase 3: Página de Perfil do Cliente

Criar `src/pages/ClientProfile.tsx`:

| Seção | Dados | Origem |
|-------|-------|--------|
| Header | Nome, email, telefone, status | `clientes` |
| Cards de Resumo | Total pago, fotos extras, galerias | Agregado de `galerias` + `cobrancas` |
| Lista de Galerias | Nome sessão, status, fotos selecionadas, valor | `galerias WHERE cliente_id = X` |
| Histórico de Pagamentos | Data, provedor, valor, galeria | `cobrancas WHERE cliente_id = X AND status = 'pago'` |

### Fase 4: Atualizar Navegação

| Arquivo | Alteração |
|---------|-----------|
| `App.tsx` | Adicionar rota `/clients/:clientId` |
| `Clients.tsx` | "Ver galerias" navega para `/clients/:clientId` |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migration SQL | Criar | Trigger para sincronizar contadores |
| `src/hooks/useClientProfile.ts` | Criar | Hook para buscar perfil completo |
| `src/pages/ClientProfile.tsx` | Criar | Página de perfil do cliente |
| `src/App.tsx` | Modificar | Adicionar nova rota |
| `src/pages/Clients.tsx` | Modificar | Atualizar handler "Ver galerias" |
| `src/components/ClientModal.tsx` | Modificar | Adicionar opção de criar galeria direto |

---

## Seção Técnica

### Queries Necessárias

**Galerias do cliente:**
```sql
SELECT 
  g.id, g.nome_sessao, g.nome_pacote, g.status, g.status_selecao,
  g.fotos_selecionadas, g.valor_total_vendido, g.total_fotos_extras_vendidas,
  g.created_at, g.enviado_em, g.finalized_at
FROM galerias g
WHERE g.cliente_id = $1 AND g.user_id = $2
ORDER BY g.created_at DESC
```

**Pagamentos do cliente:**
```sql
SELECT 
  c.id, c.valor, c.provedor, c.status, c.qtd_fotos,
  c.data_pagamento, c.ip_receipt_url, c.galeria_id,
  g.nome_sessao
FROM cobrancas c
LEFT JOIN galerias g ON g.id = c.galeria_id
WHERE c.cliente_id = $1 AND c.user_id = $2 AND c.status = 'pago'
ORDER BY c.data_pagamento DESC
```

**Estatísticas agregadas:**
```sql
SELECT 
  COUNT(DISTINCT g.id) as total_galleries,
  COALESCE(SUM(g.fotos_selecionadas), 0) as total_photos,
  COALESCE(SUM(c.valor), 0) as total_paid,
  COALESCE(SUM(c.qtd_fotos), 0) as total_extras
FROM clientes cl
LEFT JOIN galerias g ON g.cliente_id = cl.id
LEFT JOIN cobrancas c ON c.cliente_id = cl.id AND c.status = 'pago'
WHERE cl.id = $1 AND cl.user_id = $2
GROUP BY cl.id
```

### Componentes Reutilizados

- `StatusBadge` - Para mostrar status da galeria
- `PaymentHistoryCard` - Adaptado para contexto de cliente
- `Table` components do shadcn/ui
- `Tabs` para separar galerias/pagamentos

---

## Resultado Esperado

1. **Status dinâmico na listagem**: Badge "Ativo" ou "Sem galeria" sempre atualizado via trigger
2. **Contador preciso**: `total_galerias` sempre reflete quantidade real
3. **Perfil completo do cliente**: Uma página dedicada com todo histórico
4. **Navegação fluida**: "Ver galerias" leva direto para o perfil
5. **Histórico de pagamentos**: Todos os pagamentos do cliente em um lugar
6. **Ação rápida**: Botão "Nova Galeria" no perfil do cliente já pré-preenchendo dados
