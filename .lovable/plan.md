

# Controle de Armazenamento para Gallery Transfer

## Objetivo

Implementar monitoramento de armazenamento utilizado por galerias Transfer, impondo limites baseados no plano ativo do usuario (5GB, 20GB, 50GB, 100GB). Bloquear criacao de novas galerias quando o limite for atingido e sugerir upgrade ou exclusao.

## Arquitetura

### Fonte de dados para armazenamento

O `file_size` ja e registrado em cada foto na tabela `galeria_fotos`. Para calcular o armazenamento total de Transfer, basta somar os `file_size` de todas as fotos de galerias do tipo `'entrega'` do usuario. Isso sera feito via uma funcao SQL no banco (RPC), garantindo precisao e evitando logica complexa no frontend.

### Mapeamento de limites por plano

Os limites de armazenamento serao derivados do `plan_type` na tabela `subscriptions_asaas`:

```text
plan_type              | Limite
-----------------------|--------
transfer_5gb           | 5 GB
transfer_20gb          | 20 GB
transfer_50gb          | 50 GB
transfer_100gb         | 100 GB
combo_completo         | 20 GB (inclui Transfer 20GB)
combo_studio_pro       | 0 GB (nao inclui Transfer)
admin                  | Ilimitado
sem plano ativo        | 0 GB
```

Este mapeamento ficara centralizado em um unico arquivo de configuracao (`src/lib/transferPlans.ts`) para facilitar alteracoes futuras.

### Diagrama de fluxo

```text
Usuario clica "Nova Galeria Transfer"
        |
        v
  [Hook useTransferStorage]
  Busca: plano ativo + bytes usados (RPC)
        |
        v
  storageUsed >= storageLimit?
    SIM --> Bloqueia criacao
            Mostra alert com opcoes:
            - "Fazer upgrade" -> /credits/checkout (tab transfer)
            - "Excluir galerias" -> /dashboard (tab transfer)
    NAO --> Permite criacao normal
```

## Mudancas Tecnicas

### 1. Migration SQL

Nova funcao RPC `get_transfer_storage_bytes` que retorna o total de bytes usados em galerias Transfer do usuario:

```sql
CREATE OR REPLACE FUNCTION public.get_transfer_storage_bytes(_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(gf.file_size), 0)::BIGINT
  FROM public.galeria_fotos gf
  INNER JOIN public.galerias g ON g.id = gf.galeria_id
  WHERE g.user_id = _user_id
    AND g.tipo = 'entrega'
    AND g.status NOT IN ('excluida');
$$;
```

### 2. Novo arquivo `src/lib/transferPlans.ts`

Centralizacao de toda a logica de limites:

```text
- TRANSFER_STORAGE_LIMITS: mapa plan_type -> bytes
- getStorageLimitBytes(planType): retorna limite em bytes
- formatStorageSize(bytes): formata para exibicao (ex: "12.4 GB de 20 GB")
- isComboWithTransfer(planType): verifica se combo inclui Transfer
```

### 3. Novo hook `src/hooks/useTransferStorage.ts`

Hook que combina:
- Plano ativo do usuario (via `subscriptions_asaas`)
- Armazenamento usado (via RPC `get_transfer_storage_bytes`)
- Limite calculado (via `transferPlans.ts`)

Retorna:
```text
{
  storageUsedBytes: number
  storageLimitBytes: number
  storageUsedPercent: number
  hasTransferPlan: boolean
  planName: string | null
  canCreateTransfer: boolean  // limit > used
  isAdmin: boolean
  isLoading: boolean
}
```

### 4. Modificar `src/pages/DeliverCreate.tsx`

No inicio do componente, chamar `useTransferStorage()`. Se `canCreateTransfer === false`:
- Renderizar tela de bloqueio em vez do formulario
- Exibir barra de progresso mostrando uso atual vs limite
- Botao "Fazer upgrade" -> navega para `/credits/checkout` com tab Transfer
- Botao "Gerenciar galerias" -> navega para dashboard aba Transfer
- Admins nunca sao bloqueados

### 5. Atualizar `src/pages/Credits.tsx`

No bloco do Gallery Transfer, substituir "Sem plano ativo" por informacoes reais:
- Se tem plano: barra de progresso com uso/limite + nome do plano
- Se nao tem plano: manter visual atual

### 6. Atualizar `src/pages/Dashboard.tsx`

Adicionar indicador de armazenamento na aba Transfer do dashboard:
- Texto discreto mostrando "X GB de Y GB usados" 

## Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/migrations/XXXX_transfer_storage.sql` | **Nova** - RPC `get_transfer_storage_bytes` |
| `src/lib/transferPlans.ts` | **Novo** - mapeamento de limites e helpers |
| `src/hooks/useTransferStorage.ts` | **Novo** - hook de armazenamento |
| `src/pages/DeliverCreate.tsx` | Gate de verificacao antes de permitir criacao |
| `src/pages/Credits.tsx` | Exibir uso de armazenamento real no bloco Transfer |
| `src/pages/Dashboard.tsx` | Indicador de armazenamento na aba Transfer |

## Regras de Negocio

| Cenario | Comportamento |
|---|---|
| Sem plano Transfer | Bloqueado (0 GB) |
| Plano 5GB, usando 4.8GB | Permitido |
| Plano 5GB, usando 5.1GB | Bloqueado + sugerir upgrade |
| Combo completo (inclui 20GB) | 20 GB de limite |
| Combo Studio Pro (sem Transfer) | Bloqueado (0 GB) |
| Admin | Sempre permitido, sem limite |
| Upgrade de 5GB para 20GB | Efeito imediato (novo limite lido do plano ativo) |
| Downgrade | Nao bloqueia galerias existentes, mas impede novas se acima do limite |

## Flexibilidade para mudancas futuras

- Adicionar novo plano: basta incluir uma entrada no mapa `TRANSFER_STORAGE_LIMITS`
- Alterar limite de combo: basta alterar o valor no mapa
- Adicionar novo tipo de combo: adicionar ao mapa + `isComboWithTransfer`
- Migrar para coluna dedicada no banco: substituir a logica do mapa por leitura direta
