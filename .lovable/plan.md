

# Fix: Botão "Compartilhar" dos três pontinhos não ativa galeria como enviada

## Problema Confirmado

Na `SendGalleryModal`, quando a galeria já possui `publicToken` e status diferente de `rascunho`, o RPC `prepare_gallery_share` é **pulado** (linha 62-66). Isso significa que em cenários de borda (galeria com token mas em estado inconsistente, ou dados stale no cache do React Query), o modal mostra o link sem garantir que a galeria está em status `enviado` no banco.

O RPC `prepare_gallery_share` é **idempotente** — se a galeria já está `enviado`, ele apenas retorna o token existente sem alterar nada. Portanto, sempre chamá-lo é seguro e resolve a race condition.

## Plano

### 1. Sempre chamar `prepare_gallery_share` ao abrir o modal

**Arquivo**: `src/components/SendGalleryModal.tsx`

Remover o early return que pula o RPC quando `publicToken` já existe. O useEffect sempre chamará o RPC, que é idempotente e garante que:
- Token existe
- Status é `enviado` (se era `rascunho`)
- `published_at` e `enviado_em` estão preenchidos
- Ação `enviada` é registrada no log

A única otimização mantida: se já temos o token resolvido de uma chamada anterior **na mesma sessão do modal** (ou seja, `resolvedToken` já foi setado), não re-chamar.

```tsx
// Antes (linhas 62-66):
if (gallery.publicToken && gallery.status !== 'rascunho') {
  setResolvedToken(gallery.publicToken);
  return;
}

// Depois: removido — sempre chama prepareShare()
```

### 2. Usar token do RPC como fonte da verdade

Após o RPC, usar o token retornado pelo RPC (não o `gallery.publicToken` do cache), garantindo consistência.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/SendGalleryModal.tsx` | Remover early-return que pula RPC; sempre chamar `prepare_gallery_share` |

