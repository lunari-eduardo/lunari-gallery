
# Plano: Sistema de Créditos de Foto para Gallery

## Visão Geral

### Mudança de Paradigma

| Aspecto | Sistema ATUAL | Sistema NOVO |
|---------|--------------|--------------|
| Momento do consumo | Publicação da galeria | Upload de cada foto |
| Unidade de crédito | 1 galeria = 1 crédito | 1 foto = 1 crédito |
| Estorno automático | Não aplicável | NÃO (exclusão não devolve) |
| Rastreabilidade | Apenas saldo | Histórico completo de movimentações |

---

## Arquitetura do Sistema

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     SISTEMA DE CRÉDITOS DE FOTO                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │ COMPRA/BÔNUS    │───▶│ credit_ledger   │───▶│ SALDO ATUAL     │     │
│  │                 │    │ (tipo: entrada) │    │ (calculado)     │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                                       │                 │
│                                                       │                 │
│  ┌─────────────────┐    ┌─────────────────┐          ▼                 │
│  │ UPLOAD FOTO     │───▶│ credit_ledger   │    photographer_accounts   │
│  │ (cada foto)     │    │ (tipo: consumo) │    .photo_credits (cache)  │
│  └─────────────────┘    └─────────────────┘                            │
│                                                                         │
│  REGRA: saldo = SUM(entradas) - SUM(saídas)                            │
│  INVARIANTE: saldo >= 0 (verificado ANTES do upload)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Estrutura do Banco de Dados

### 1. Nova Tabela: `credit_ledger` (Histórico de Movimentações)

```sql
CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo de movimentação
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'purchase',      -- Compra de créditos
    'bonus',         -- Bônus adicionado (admin)
    'upload',        -- Consumo por upload de foto
    'refund',        -- Estorno manual (excepcional)
    'adjustment'     -- Ajuste administrativo
  )),
  
  -- Valores (positivo = entrada, negativo = saída)
  amount INTEGER NOT NULL,  -- Ex: +100 para compra, -1 para upload
  
  -- Referências opcionais
  gallery_id UUID REFERENCES public.galerias(id) ON DELETE SET NULL,
  photo_id UUID REFERENCES public.galeria_fotos(id) ON DELETE SET NULL,
  
  -- Metadados
  description TEXT,                    -- Descrição legível
  metadata JSONB DEFAULT '{}'::jsonb,  -- Dados extras (payment_id, etc)
  
  -- Quem executou (admin ou próprio usuário)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Índices para consultas rápidas
  CONSTRAINT valid_amount CHECK (
    (operation_type IN ('purchase', 'bonus', 'refund', 'adjustment') AND amount > 0) OR
    (operation_type = 'upload' AND amount < 0) OR
    (operation_type = 'adjustment' AND amount != 0)
  )
);

-- Índices
CREATE INDEX idx_credit_ledger_user ON credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_gallery ON credit_ledger(gallery_id) WHERE gallery_id IS NOT NULL;
CREATE INDEX idx_credit_ledger_photo ON credit_ledger(photo_id) WHERE photo_id IS NOT NULL;
```

### 2. Alteração: `photographer_accounts` (Cache de Saldo)

```sql
-- Adicionar coluna para créditos de foto
ALTER TABLE public.photographer_accounts
ADD COLUMN IF NOT EXISTS photo_credits INTEGER NOT NULL DEFAULT 0;

-- Manter gallery_credits para compatibilidade (pode remover depois)
```

### 3. Nova Tabela: `admin_credit_grants` (Créditos Concedidos pelo Admin)

Para responder sua pergunta sobre onde o admin adiciona créditos:

```sql
CREATE TABLE public.admin_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Quem recebe os créditos
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,  -- Snapshot do email no momento
  
  -- Quantos créditos
  amount INTEGER NOT NULL CHECK (amount > 0),
  
  -- Motivo/observação
  reason TEXT,
  
  -- Admin que concedeu
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Referência ao ledger
  ledger_id UUID REFERENCES credit_ledger(id)
);
```

---

## Fluxo de Operações

### Fluxo 1: Compra de Créditos

```text
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Pagamento     │────▶│ credit_ledger │────▶│ photo_credits │
│ Confirmado    │     │ +100, purchase│     │ += 100        │
└───────────────┘     └───────────────┘     └───────────────┘
```

### Fluxo 2: Upload de Foto (Crítico)

```text
┌───────────────────────────────────────────────────────────────────┐
│ UPLOAD DE FOTO                                                    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Requisição chega no b2-upload edge function                   │
│                                                                   │
│  2. VERIFICAR SALDO:                                              │
│     ├── É admin? → Bypass (saldo infinito)                        │
│     └── Não admin → photo_credits >= quantidade_fotos?            │
│         ├── SIM → Continuar                                       │
│         └── NÃO → Retornar erro "Créditos insuficientes"          │
│                                                                   │
│  3. RESERVAR CRÉDITOS (antes do upload real):                     │
│     └── UPDATE photographer_accounts                              │
│         SET photo_credits = photo_credits - N                     │
│         WHERE user_id = ? AND photo_credits >= N                  │
│         (verificação atômica)                                     │
│                                                                   │
│  4. Fazer upload para B2                                          │
│                                                                   │
│  5. Salvar foto no banco                                          │
│                                                                   │
│  6. Registrar no ledger:                                          │
│     └── INSERT INTO credit_ledger                                 │
│         (user_id, operation_type, amount, gallery_id, photo_id)   │
│         VALUES (?, 'upload', -1, ?, ?)                            │
│                                                                   │
│  NOTA: Se upload falhar APÓS dedução, crédito NÃO é devolvido     │
│  (conforme regra de negócio)                                      │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Fluxo 3: Admin Adiciona Créditos

```text
┌───────────────┐     ┌───────────────────┐     ┌───────────────┐
│ Admin clica   │────▶│ admin_credit_     │────▶│ credit_ledger │
│ "Adicionar"   │     │ grants (registro) │     │ +N, bonus     │
│               │     └───────────────────┘     └───────────────┘
│               │                                      │
│               │                                      ▼
│               │                               ┌───────────────┐
│               │                               │ photo_credits │
│               │                               │ += N          │
└───────────────┘                               └───────────────┘
```

---

## Arquivos a Criar/Modificar

### Banco de Dados (Migração)

| Item | Descrição |
|------|-----------|
| `credit_ledger` | Nova tabela para histórico de movimentações |
| `admin_credit_grants` | Tabela para registrar bônus do admin |
| `photo_credits` | Nova coluna em `photographer_accounts` |
| `consume_photo_credit()` | Função RPC para consumo atômico |
| `add_photo_credits()` | Função RPC para adicionar créditos |
| `get_photo_credit_balance()` | Função para calcular saldo real |

### Edge Function

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/b2-upload/index.ts` | Verificar e consumir crédito ANTES do upload |

### Frontend - Hooks

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/usePhotoCredits.ts` | Novo hook para créditos de foto |

### Frontend - Componentes

| Arquivo | Modificação |
|---------|-------------|
| `src/components/PhotoUploader.tsx` | Verificar saldo antes de upload |
| `src/pages/Account.tsx` | Exibir créditos de foto |

### Admin Panel (Novo)

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Admin.tsx` | Página de administração |
| `src/components/admin/UserCreditsManager.tsx` | Componente para gerenciar créditos |

---

## Funções RPC do Banco

### 1. `consume_photo_credits()`

```sql
CREATE OR REPLACE FUNCTION public.consume_photo_credits(
  _user_id UUID,
  _gallery_id UUID,
  _photo_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_current_credits INTEGER;
BEGIN
  -- Admins bypass credit check
  SELECT public.has_role(_user_id, 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Atomic check and deduct
  UPDATE photographer_accounts
  SET photo_credits = photo_credits - _photo_count,
      updated_at = now()
  WHERE user_id = _user_id
    AND photo_credits >= _photo_count
  RETURNING photo_credits INTO v_current_credits;
  
  IF NOT FOUND THEN
    RETURN FALSE;  -- Insufficient credits
  END IF;
  
  RETURN TRUE;
END;
$$;
```

### 2. `record_photo_credit_usage()`

```sql
CREATE OR REPLACE FUNCTION public.record_photo_credit_usage(
  _user_id UUID,
  _gallery_id UUID,
  _photo_id UUID,
  _description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_id UUID;
BEGIN
  INSERT INTO credit_ledger (
    user_id,
    operation_type,
    amount,
    gallery_id,
    photo_id,
    description,
    created_by
  )
  VALUES (
    _user_id,
    'upload',
    -1,
    _gallery_id,
    _photo_id,
    COALESCE(_description, 'Upload de foto'),
    _user_id
  )
  RETURNING id INTO v_ledger_id;
  
  RETURN v_ledger_id;
END;
$$;
```

### 3. `admin_grant_credits()`

```sql
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  _admin_id UUID,
  _target_user_id UUID,
  _amount INTEGER,
  _reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_target_email TEXT;
  v_ledger_id UUID;
  v_grant_id UUID;
BEGIN
  -- Verify caller is admin
  SELECT public.has_role(_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can grant credits';
  END IF;
  
  -- Get target email
  SELECT email INTO v_target_email FROM auth.users WHERE id = _target_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  
  -- Create ledger entry
  INSERT INTO credit_ledger (
    user_id,
    operation_type,
    amount,
    description,
    created_by
  )
  VALUES (
    _target_user_id,
    'bonus',
    _amount,
    COALESCE(_reason, 'Créditos adicionados pelo administrador'),
    _admin_id
  )
  RETURNING id INTO v_ledger_id;
  
  -- Update balance
  UPDATE photographer_accounts
  SET photo_credits = photo_credits + _amount,
      updated_at = now()
  WHERE user_id = _target_user_id;
  
  -- Record grant
  INSERT INTO admin_credit_grants (
    target_user_id,
    target_email,
    amount,
    reason,
    granted_by,
    ledger_id
  )
  VALUES (
    _target_user_id,
    v_target_email,
    _amount,
    _reason,
    _admin_id,
    v_ledger_id
  )
  RETURNING id INTO v_grant_id;
  
  RETURN v_grant_id;
END;
$$;
```

---

## Modificação do b2-upload Edge Function

```typescript
// Após validar usuário e galeria, ANTES de fazer upload:

// 1. Check if admin (bypass)
const { data: isAdmin } = await supabase.rpc('has_role', {
  _user_id: user.id,
  _role: 'admin'
});

if (!isAdmin) {
  // 2. Try to consume credit atomically
  const { data: creditConsumed, error: creditError } = await supabase.rpc(
    'consume_photo_credits',
    {
      _user_id: user.id,
      _gallery_id: galleryId,
      _photo_count: 1
    }
  );

  if (creditError || !creditConsumed) {
    return new Response(
      JSON.stringify({ 
        error: 'Créditos insuficientes',
        code: 'INSUFFICIENT_CREDITS'
      }),
      { status: 402, headers: corsHeaders }
    );
  }
}

// 3. Continue with upload...

// 4. After successful save, record in ledger
await supabase.rpc('record_photo_credit_usage', {
  _user_id: user.id,
  _gallery_id: galleryId,
  _photo_id: photo.id
});
```

---

## Interface do Usuário

### Exibição de Saldo (Account.tsx)

```text
┌─────────────────────────────────────────────┐
│ ⚡ Créditos de Foto                          │
│                                             │
│         ┌─────────────────┐                 │
│         │      247        │                 │
│         │    créditos     │                 │
│         └─────────────────┘                 │
│                                             │
│  📸 Fotos enviadas total:          1,823    │
│                                             │
│  [  💳 Comprar Créditos  ]                  │
│  [  📜 Ver Histórico     ]                  │
└─────────────────────────────────────────────┘
```

### Bloqueio de Upload (PhotoUploader.tsx)

```text
┌─────────────────────────────────────────────┐
│ ⚠️ Créditos Insuficientes                    │
│                                             │
│ Você tem 5 créditos e está tentando         │
│ enviar 10 fotos.                            │
│                                             │
│ [  💳 Comprar Créditos  ]                   │
│ [  Enviar apenas 5      ]                   │
└─────────────────────────────────────────────┘
```

### Painel Admin - Adicionar Créditos

```text
┌─────────────────────────────────────────────┐
│ 👑 Administração - Créditos                  │
│                                             │
│ Buscar usuário:                             │
│ [ email@example.com            ] [Buscar]   │
│                                             │
│ ─────────────────────────────────────────── │
│ Usuário: João Silva                         │
│ Email: joao@foto.com                        │
│ Saldo atual: 47 créditos                    │
│                                             │
│ Adicionar créditos:                         │
│ [ 100 ]                                     │
│                                             │
│ Motivo (opcional):                          │
│ [ Bônus de boas-vindas            ]         │
│                                             │
│ [  ✅ Adicionar Créditos  ]                 │
│                                             │
│ ─────────────────────────────────────────── │
│ Histórico recente:                          │
│ • +50 créditos (12/01) - Promoção           │
│ • +100 créditos (05/01) - Compra            │
└─────────────────────────────────────────────┘
```

---

## Resposta à Sua Pergunta

**Onde o admin adiciona créditos:**

| Tabela | Coluna | Descrição |
|--------|--------|-----------|
| `admin_credit_grants` | `amount` | Quantidade de créditos adicionados |
| `admin_credit_grants` | `target_user_id` | UUID do usuário que recebe |
| `admin_credit_grants` | `reason` | Motivo/observação do admin |
| `admin_credit_grants` | `granted_by` | UUID do admin que concedeu |

A função `admin_grant_credits()` é chamada pelo admin e:
1. Insere registro em `credit_ledger` (auditoria)
2. Atualiza saldo em `photographer_accounts.photo_credits`
3. Registra em `admin_credit_grants` (para relatórios)

---

## Resumo das Alterações

### Banco de Dados
1. Criar tabela `credit_ledger` (histórico imutável)
2. Criar tabela `admin_credit_grants` (bônus do admin)
3. Adicionar coluna `photo_credits` em `photographer_accounts`
4. Criar funções RPC: `consume_photo_credits`, `record_photo_credit_usage`, `admin_grant_credits`
5. Configurar RLS para todas as tabelas

### Edge Function
1. Modificar `b2-upload` para verificar e consumir crédito antes do upload

### Frontend
1. Criar hook `usePhotoCredits`
2. Modificar `PhotoUploader` para verificar saldo
3. Atualizar `Account.tsx` para exibir créditos de foto
4. Criar rota `/admin` com gerenciador de créditos

### Compatibilidade
- Manter `gallery_credits` existente durante transição
- Admins continuam com acesso ilimitado
- Usuários em `allowed_emails` compram normalmente
