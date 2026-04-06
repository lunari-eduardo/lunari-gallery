

# Fix: Histórico duplica "Galeria enviada" ao compartilhar

## Causa raiz

Duas inserções independentes de ação `enviada` em `galeria_acoes`:

| Momento | Código | Idempotente? |
|---|---|---|
| Modal abre | `prepare_gallery_share` RPC (linha 65) | Sim (`WHERE NOT EXISTS`) |
| Usuário clica Copiar/WhatsApp | `sendGalleryMutation` no `useSupabaseGalleries.ts` (linha 623) | **Não** |

Resultado: sempre 2 registros.

## Solução

### 1. Remover insert de ação do `sendGalleryMutation`

Em `src/hooks/useSupabaseGalleries.ts` (linhas 620-629), remover o bloco que insere `galeria_acoes` com tipo `enviada`. A RPC `prepare_gallery_share` já faz isso de forma idempotente.

O `sendGalleryMutation` continuará atualizando status da galeria e sessão — apenas deixa de duplicar o log.

### 2. Adicionar unique partial index para segurança futura

Nova migração SQL:

```sql
-- Remove duplicatas existentes
DELETE FROM galeria_acoes a
USING galeria_acoes b
WHERE a.tipo = 'enviada'
  AND b.tipo = 'enviada'
  AND a.galeria_id = b.galeria_id
  AND a.created_at > b.created_at;

-- Índice único parcial para evitar duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS idx_galeria_acoes_enviada_unique
ON galeria_acoes (galeria_id, tipo)
WHERE tipo = 'enviada';
```

**Nota**: este índice impediria logar um novo envio após reativação. Para suportar isso no futuro, a RPC de reativação precisaria deletar o registro antigo de `enviada` antes de reenviar. Mas hoje o comportamento desejado é exatamente 1 registro por galeria.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useSupabaseGalleries.ts` | Remover linhas 620-629 (insert em `galeria_acoes`) |
| Nova migração SQL | Limpar duplicatas + criar unique partial index |

