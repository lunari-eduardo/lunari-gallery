
# Plano: Unificação das Tabelas de Clientes + Correções de Segurança

## Diagnóstico Completo

### Problemas Identificados

| # | Problema | Causa | Impacto |
|---|----------|-------|---------|
| 1 | Galerias visíveis para todos usuários | RLS "Public access via token" aplica a `anon,authenticated` | Vazamento de dados |
| 2 | Erro FK ao criar galeria | `galerias.cliente_id` aponta para `clientes`, mas Solo users usam `gallery_clientes` | Falha na criação |
| 3 | Duas tabelas de clientes | Complexidade desnecessária, dificulta upgrades | Manutenção difícil |

### Estado Atual das Tabelas

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ANTES DA UNIFICAÇÃO                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐ │
│  │       clientes              │   │    gallery_clientes         │ │
│  │  (Gestão/Pro+Gallery)       │   │    (Gallery Solo)           │ │
│  ├─────────────────────────────┤   ├─────────────────────────────┤ │
│  │ • id (UUID)                 │   │ • id (UUID)                 │ │
│  │ • user_id                   │   │ • user_id                   │ │
│  │ • nome                      │   │ • nome                      │ │
│  │ • email (nullable)          │   │ • email (NOT NULL)          │ │
│  │ • telefone                  │   │ • telefone                  │ │
│  │ • whatsapp                  │   │ • gallery_password          │ │
│  │ • endereco                  │   │ • status                    │ │
│  │ • observacoes               │   │ • total_galerias            │ │
│  │ • origem                    │   │ • created_at                │ │
│  │ • data_nascimento           │   │ • updated_at                │ │
│  │ • gallery_password          │   └─────────────────────────────┘ │
│  │ • gallery_status            │                                   │
│  │ • total_galerias            │   Records: 1 (Eduardo teste)      │
│  └─────────────────────────────┘                                   │
│           │                              │                         │
│           │ FK constraint ✓              │ NO FK - rejected!       │
│           ▼                              ▼                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        galerias                              │   │
│  │  cliente_id → FK para clientes.id                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Políticas RLS Atuais em `galerias`

| Política | Comando | Roles | Condição |
|----------|---------|-------|----------|
| Photographers manage own galleries | ALL | authenticated | `auth.uid() = user_id` |
| Public access via token | SELECT | **anon, authenticated** ❌ | `public_token IS NOT NULL AND status IN (...)` |

**O Problema**: A política "Public access via token" inclui `authenticated`, permitindo que QUALQUER usuário logado veja galerias com token público, não apenas o dono!

---

## Solução: Arquitetura Unificada

```text
┌─────────────────────────────────────────────────────────────────────┐
│ APÓS UNIFICAÇÃO                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      clientes                                │   │
│  │           (ÚNICA tabela para TODOS os usuários)              │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ • id (UUID)                                                  │   │
│  │ • user_id                                                    │   │
│  │ • nome                                                       │   │
│  │ • email (nullable - preenchido para Gallery)                 │   │
│  │ • telefone                                                   │   │
│  │ • whatsapp (nullable - só Gestão)                            │   │
│  │ • endereco (nullable - só Gestão)                            │   │
│  │ • observacoes (nullable - só Gestão)                         │   │
│  │ • origem (nullable - só Gestão)                              │   │
│  │ • data_nascimento (nullable - só Gestão)                     │   │
│  │ • gallery_password (para galerias protegidas)                │   │
│  │ • gallery_status (ativo/sem_galeria)                         │   │
│  │ • total_galerias                                             │   │
│  │ • created_at, updated_at                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           │ FK constraint ✓ (funciona para todos!)                  │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        galerias                              │   │
│  │  cliente_id → FK para clientes.id                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  gallery_clientes → REMOVIDA                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Etapa 1: Migração SQL (Banco de Dados)

```sql
-- 1. Migrar dados de gallery_clientes para clientes
INSERT INTO public.clientes (
  id, user_id, nome, email, telefone, 
  gallery_password, gallery_status, total_galerias,
  created_at, updated_at
)
SELECT 
  id, user_id, nome, email, telefone,
  gallery_password, status, total_galerias,
  created_at, updated_at
FROM public.gallery_clientes
ON CONFLICT (id) DO NOTHING;

-- 2. Corrigir política RLS em galerias (remover authenticated)
DROP POLICY IF EXISTS "Public access via token" ON public.galerias;

CREATE POLICY "Public access via token for clients"
ON public.galerias
FOR SELECT
TO anon  -- SOMENTE anon!
USING (
  (public_token IS NOT NULL) 
  AND (status = ANY (ARRAY['enviado'::text, 'selecao_iniciada'::text, 'selecao_completa'::text]))
);

-- 3. Remover tabela gallery_clientes (após confirmar migração)
DROP TABLE IF EXISTS public.gallery_clientes;
```

### Etapa 2: Simplificação do Hook `useGalleryClients`

**Antes**: Lógica condicional complexa baseada em `hasGestaoIntegration`
**Depois**: Sempre usa tabela `clientes`, código mais simples

```typescript
// src/hooks/useGalleryClients.ts - SIMPLIFICADO
export function useGalleryClients(): UseGalleryClientsReturn {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // SEMPRE usa 'clientes' - sem mais condicionais!
  const fetchClients = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, telefone, whatsapp, gallery_password, gallery_status, total_galerias, created_at, updated_at')
        .eq('user_id', user.id)
        .order('nome', { ascending: true });

      if (error) throw error;
      setClients((data || []).map(mapRowToClient));
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ... CRUD operations simplificadas (sem condicionais)
}
```

---

## Arquivos a Modificar

### Banco de Dados (Migração)

| # | Ação | Descrição |
|---|------|-----------|
| 1 | Migrar dados | Copiar 1 registro de `gallery_clientes` para `clientes` |
| 2 | Corrigir RLS | Remover `authenticated` da política de acesso público |
| 3 | Dropar tabela | Remover `gallery_clientes` |

### Frontend

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/hooks/useGalleryClients.ts` | Remover lógica condicional, usar sempre `clientes` |
| 2 | `src/hooks/useGalleryAccess.ts` | Manter (fornece `hasGestaoIntegration` para outros usos) |
| 3 | `src/types/gallery.ts` | Sem alteração necessária |
| 4 | `src/pages/Clients.tsx` | Remover exibição de badge "Integrado" (opcional) |

---

## Benefícios da Unificação

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Tabelas de clientes | 2 | 1 |
| Complexidade do hook | Alta (condicionais) | Baixa (direto) |
| Upgrade de plano | Requer migração de dados | Automático |
| Downgrade de plano | Perda potencial de dados | Mantém tudo |
| FK constraint | Quebrada para Solo users | Funciona para todos |
| Manutenção | Duplicada | Única |

---

## Dados a Migrar

| Tabela | Registros | Ação |
|--------|-----------|------|
| `gallery_clientes` | 1 | Migrar para `clientes` |

**Registro a migrar:**
- ID: `b0a9a99f-c770-44e7-a884-8b872a78d3bc`
- User: `6471b07e-3103-4839-9ee9-836335d6374a` (eduardo22diehl)
- Nome: "Teste Conta Eduardo22"
- Email: teste@gmail.com

---

## Resultado Final

### Políticas RLS em `galerias` (Corrigidas)

| Política | Comando | Roles | Condição |
|----------|---------|-------|----------|
| Photographers manage own galleries | ALL | authenticated | `auth.uid() = user_id` |
| Public access via token for clients | SELECT | **anon** ✅ | `public_token IS NOT NULL AND status IN (...)` |

### Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Eduardo faz login (Gallery Solo)                                 │
│    └── authenticated = true                                         │
│                                                                     │
│ 2. Query: SELECT * FROM galerias                                    │
│    └── Política "Photographers manage own galleries" APENAS         │
│    └── WHERE auth.uid() = user_id                                   │
│    └── Eduardo tem 0 galerias → vê 0 galerias ✅                    │
│                                                                     │
│ 3. Eduardo cria cliente em 'clientes'                               │
│    └── INSERT funciona (RLS permite own user_id)                    │
│                                                                     │
│ 4. Eduardo cria galeria com cliente_id                              │
│    └── FK constraint OK (cliente está em 'clientes') ✅             │
│                                                                     │
│ 5. Cliente acessa galeria via link público                          │
│    └── Não autenticado (anon)                                       │
│    └── Política "Public access via token for clients"               │
│    └── Pode ver galeria com token correto ✅                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resumo das Alterações

1. **Migração SQL**: Migrar dados, corrigir RLS, dropar tabela antiga
2. **useGalleryClients.ts**: Simplificar para usar sempre `clientes`
3. **Opcional**: Remover referências a `gallery_clientes` de tipos e componentes

### Compatibilidade

- **Gestão Integration**: Continua funcionando (usa `clientes`)
- **Gallery Solo**: Agora usa `clientes` (mesmo fluxo simplificado)
- **Upgrades/Downgrades**: Automáticos, sem migração de dados necessária
