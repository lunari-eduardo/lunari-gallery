
# Plano: Correção da Multiplicação de Templates de E-mail

## Diagnóstico

### Problema Identificado

A tabela `gallery_email_templates` contém **1.217 registros duplicados** quando deveria ter apenas ~3 por usuário.

| Usuário | Templates "Galeria Enviada" | Templates Esperados |
|---------|---------------------------|---------------------|
| eduardo22diehl | **454** | 1 |
| 7b41aa6d... | **279** | 1 |
| admin (db0ca3d8) | 2 | 1 |

### Causa Raiz: Race Condition no useEffect

```typescript
// src/hooks/useSettings.ts - BUG
useEffect(() => {
  if (!isLoading && dbSettings && 
      dbSettings.customThemes.length === 0 && 
      dbSettings.emailTemplates.length === 0) {
    initializeSettings.mutate();  // Chamado múltiplas vezes!
  }
}, [isLoading, dbSettings, initializeSettings]);  // ← initializeSettings muda a cada render!
```

O objeto `initializeSettings` retornado por `useMutation` é recriado a cada render, fazendo o `useEffect` disparar repetidamente.

### Problema Secundário: Falta de Constraint

A tabela não possui constraint `UNIQUE(user_id, type)`, permitindo inserções duplicadas.

---

## Solução

### Etapa 1: Corrigir useSettings.ts

Usar `useRef` para evitar chamadas múltiplas de inicialização:

```typescript
// src/hooks/useSettings.ts - CORRIGIDO
import { useEffect, useRef } from 'react';

export function useSettings(): UseSettingsReturn {
  const { settings: dbSettings, isLoading, initializeSettings, ... } = useGallerySettings();
  
  // Ref para evitar múltiplas inicializações
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Só inicializa uma vez, quando dados estão prontos e vazios
    if (!isLoading && dbSettings && !hasInitialized.current &&
        dbSettings.customThemes.length === 0 && 
        dbSettings.emailTemplates.length === 0) {
      hasInitialized.current = true;  // Marca como inicializado
      initializeSettings.mutate();
    }
  }, [isLoading, dbSettings]);  // Remover initializeSettings da dependência
  
  // ...
}
```

### Etapa 2: Migração SQL

1. **Limpar duplicatas** - Manter apenas 1 template por (user_id, type)
2. **Adicionar constraint** - `UNIQUE(user_id, type)`

```sql
-- 1. Criar tabela temporária com registros únicos
CREATE TEMP TABLE unique_templates AS
SELECT DISTINCT ON (user_id, type) *
FROM gallery_email_templates
ORDER BY user_id, type, created_at;

-- 2. Limpar tabela original
DELETE FROM gallery_email_templates;

-- 3. Re-inserir registros únicos
INSERT INTO gallery_email_templates 
SELECT * FROM unique_templates;

-- 4. Adicionar constraint para prevenir futuros duplicados
ALTER TABLE gallery_email_templates 
ADD CONSTRAINT unique_user_template_type UNIQUE (user_id, type);

-- 5. Limpar tabela temporária
DROP TABLE unique_templates;
```

---

## Arquivos a Modificar

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/hooks/useSettings.ts` | Adicionar `useRef` para controle de inicialização |
| 2 | Migração SQL | Limpar duplicatas + adicionar constraint UNIQUE |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Total de templates | 1.217 | ~15 (3 por usuário) |
| Duplicatas possíveis | Ilimitadas | 0 (constraint) |
| Chamadas de init | Múltiplas | 1 vez |

---

## Impacto

- **Usuários**: Verão apenas 3 templates conforme esperado
- **Performance**: Queries mais rápidas (menos dados)
- **Segurança**: Constraint previne futuros duplicados
