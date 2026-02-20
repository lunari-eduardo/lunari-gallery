

# Correção: Status de expiração no banco + badge duplicado

## Problema 1: Status não atualiza para "expirado" no banco

A expiração só é gravada no banco quando o **cliente** acessa a galeria (via `gallery-access` edge function). Se o cliente nunca acessa, o status permanece como `enviado` ou `selecao_iniciada` no banco, mesmo com o prazo vencido.

O Dashboard do fotógrafo faz apenas um check local (`isPast(prazoSelecao)`) na linha 82-84 de `Dashboard.tsx` e mostra como "expired" na UI, mas **nunca escreve essa mudança no banco**.

### Correção

No `Dashboard.tsx`, após detectar que uma galeria está expirada via `isPast()`, fazer um `supabase.update()` para gravar `status: 'expirado'` no banco. Isso garante que o status persista e esteja correto para todas as consultas.

Implementação: adicionar um `useEffect` no Dashboard que, ao carregar as galerias, identifica quais têm prazo vencido mas status ainda ativo no banco (`enviado` ou `selecao_iniciada`) e faz um batch update para `expirado`. Alternativa mais simples: atualizar dentro da própria função `transformSupabaseToLocal` usando uma chamada assíncrona separada.

A abordagem escolhida: criar um `useEffect` no Dashboard que verifica galerias com prazo vencido e atualiza o banco em lote. Isso evita chamadas redundantes e mantém a lógica centralizada.

```typescript
// No Dashboard.tsx, após carregar galleries
useEffect(() => {
  const expiredGalleries = galleries.filter(g => {
    const isActive = ['enviado', 'selecao_iniciada'].includes(g.status);
    const hasExpired = g.prazoSelecao && isPast(g.prazoSelecao);
    return isActive && hasExpired;
  });

  if (expiredGalleries.length > 0) {
    // Update each expired gallery in the database
    expiredGalleries.forEach(async (g) => {
      await supabase
        .from('galerias')
        .update({ status: 'expirado', updated_at: new Date().toISOString() })
        .eq('id', g.id);
    });
  }
}, [galleries]);
```

Note: usamos `galleries` (dados crus do Supabase, ou seja, o array de `Galeria`) e não o array transformado.

## Problema 2: Badge duplicado "Expirada"

No `GalleryCard.tsx`, quando `status === 'expired'`, existem **dois indicadores**:

1. **Linha 60**: `<StatusBadge status={gallery.status} />` -- mostra badge "Expirada" no canto superior direito
2. **Linhas 121-126**: Texto inline "Expirada" com ícone de Clock no canto inferior esquerdo (ao lado do contador de fotos)

O badge inferior esquerdo (apontado pela seta na imagem) deve ser removido, mantendo apenas o `StatusBadge` superior direito.

### Correção

Remover o bloco de linhas 121-126 do `GalleryCard.tsx`:

```tsx
// REMOVER este bloco:
{isExpired && (
  <span className="inline-flex items-center gap-1 text-destructive">
    <Clock className="h-3 w-3" />
    Expirada
  </span>
)}
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/Dashboard.tsx` | Adicionar useEffect para gravar status `expirado` no banco quando prazo vence |
| `src/components/GalleryCard.tsx` | Remover indicador duplicado de "Expirada" (linhas 121-126) |
