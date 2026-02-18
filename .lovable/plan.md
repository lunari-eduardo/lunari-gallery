

# Expiração de Galerias de Seleção

## Situação atual

- O prazo de seleção (`prazo_selecao`) é salvo na galeria, mas **não é verificado no backend** para galerias de seleção
- O cliente-side calcula `isExpired` localmente mas ainda permite visualizar e selecionar fotos
- Não existe mecanismo para atualizar o status da galeria para `expirado` no banco quando o prazo vence
- A reativação já funciona (`reopenSelectionMutation`) -- define status de volta para `selecao_iniciada`

## Plano de implementação

### 1. Edge Function `gallery-access` -- Bloquear acesso a galerias expiradas

Adicionar verificação de expiração **antes** de retornar dados da galeria (logo após o check de status válido na linha 322). Quando `prazo_selecao` existir e estiver no passado:

- Atualizar o status da galeria no banco para `expirado` (se ainda não estiver)
- Atualizar `clientes_sessoes.status_galeria` para `expirada`
- Retornar resposta com `code: "EXPIRED"` contendo dados mínimos para a tela de expiração (nome da sessão, tema, logo do estúdio)

### 2. Edge Function `client-selection` -- Rejeitar ações em galerias expiradas

Adicionar verificação: se o status da galeria for `expirado` OU se `prazo_selecao` está no passado, rejeitar qualquer toggle/seleção com erro.

### 3. Frontend `ClientGallery.tsx` -- Tela de expiração

Tratar o novo response `code: "EXPIRED"` da edge function com uma tela dedicada (similar à imagem de referência):

- Mostrar mensagem: "O prazo de acesso à galeria expirou."
- Sub-mensagem: "Para visualizar novamente, entre em contato com o fotógrafo e solicite a liberação."
- Usar o tema/logo do estúdio para manter identidade visual
- Sem botões de ação (cliente não pode fazer nada)

### 4. Reativação (já funciona)

A funcionalidade de reativar galeria já existe em `useSupabaseGalleries.ts` (`reopenSelectionMutation`). Quando o fotógrafo reativa:
- Status volta para `selecao_iniciada`
- `status_selecao` volta para `em_andamento`
- Novo prazo é definido
- Seleções anteriores do cliente ficam preservadas (fotos com `is_selected = true` não são alteradas)

Nenhuma mudança necessária na reativação.

---

## Detalhes técnicos

### Edge Function `gallery-access/index.ts`

Inserir bloco de verificação de expiração após a linha 328 (check de status válido), antes do check de senha:

```typescript
// Check expiration for selection galleries
if (gallery.prazo_selecao && new Date(gallery.prazo_selecao) < new Date()) {
  // Update gallery status to expired if not already
  if (gallery.status !== 'expirado') {
    await supabase.from('galerias').update({ 
      status: 'expirado',
      updated_at: new Date().toISOString()
    }).eq('id', gallery.id);

    // Sync to clientes_sessoes
    if (gallery.session_id) {
      await supabase.from('clientes_sessoes').update({ 
        status_galeria: 'expirada' 
      }).eq('session_id', gallery.session_id);
    }
  }

  // Return expired response with minimal data for the screen
  const galleryConfig = gallery.configuracoes;
  const clientMode = galleryConfig?.clientMode || 'light';
  // (fetch theme + studio settings for branding)
  
  return Response({ 
    expired: true, 
    sessionName, studioSettings, theme, clientMode, settings 
  });
}
```

Tambem ajustar os `validStatuses` para incluir galeria que voltou de `expirado` via reativação (já coberto pois reativação muda para `selecao_iniciada`).

### Edge Function `client-selection/index.ts`

Adicionar verificação no início:

```typescript
if (gallery.status === 'expirado' || 
    (gallery.prazo_selecao && new Date(gallery.prazo_selecao) < new Date())) {
  return error 403 "Galeria expirada"
}
```

### Frontend `ClientGallery.tsx`

Adicionar handler para `galleryResponse?.expired` logo após o check de `finalized` (linha 761):

```tsx
if (galleryResponse?.expired) {
  return (
    <div style={themeStyles}>
      {/* Tela de expiração com logo, nome da sessão e mensagem */}
      <Clock icon />
      <h1>Galeria Expirada</h1>
      <p>O prazo de acesso à galeria expirou.</p>
      <p>Para visualizar novamente, entre em contato com o fotógrafo...</p>
    </div>
  );
}
```

### Constraint de status `galerias`

O status `expirado` já existe no sistema (é usado no `StatusBadge`, `GalleryCard`, `GalleryEdit`). Verificar se o constraint de `galerias.status` o inclui -- o constraint atual permite: `rascunho`, `enviado`, `selecao_iniciada`, `selecao_completa`. **Precisa adicionar `expirado`** via migration.

### Migration SQL

```sql
-- Adicionar 'expirado' ao constraint de status da galeria
ALTER TABLE galerias DROP CONSTRAINT IF EXISTS galerias_status_check;
ALTER TABLE galerias ADD CONSTRAINT galerias_status_check 
  CHECK (status = ANY (ARRAY[
    'rascunho', 'enviado', 'selecao_iniciada', 'selecao_completa', 'expirado'
  ]));
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gallery-access/index.ts` | Verificação de expiração + atualização de status + resposta `expired` |
| `supabase/functions/client-selection/index.ts` | Rejeitar ações em galerias expiradas |
| `src/pages/ClientGallery.tsx` | Tela de expiração quando `galleryResponse?.expired` |
| Nova migration SQL | Adicionar `expirado` ao constraint de status |
| Deploy | Redeployar `gallery-access` e `client-selection` |

## Fluxo resumido

```text
Prazo vence → Cliente acessa → gallery-access detecta expiração
  → Atualiza DB (status = 'expirado')
  → Retorna { expired: true, ... }
  → Frontend mostra tela de expiração

Fotógrafo reativa → status volta para 'selecao_iniciada'
  → Cliente acessa normalmente
  → Seleções anteriores preservadas
```
