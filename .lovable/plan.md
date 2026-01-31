
# Correção: Comentário não aceita espaço e botões com cor branca

## Problemas Identificados

### Problema 1: Espaço dispara seleção em vez de digitar
No arquivo `Lightbox.tsx` (linhas 125-133), o handler de teclado captura a tecla de espaço globalmente:

```typescript
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  // ...
  if (e.key === ' ' && !disabled) {
    e.preventDefault();  // ← Bloqueia o espaço
    onSelect(currentPhoto.id);  // ← Seleciona a foto
  }
}, [...]);
```

Este listener é adicionado ao `document` (linha 137), então intercepta TODOS os eventos de teclado, incluindo quando o usuário está digitando no textarea de comentário.

**Solução**: Verificar se o foco está em um elemento de input/textarea antes de processar o atalho de espaço.

### Problema 2: Botões com texto branco em fundo branco
Nas linhas 405-408 e 420-424, os botões não selecionados usam classes forçando cor branca:

```typescript
className={cn(
  !isMobile && 'gap-2',
  !currentPhoto.isSelected && 'text-white border-white/40 hover:bg-white/10'  // ← Força branco
)}
```

Isso não considera o tema da galeria do cliente, que pode ter fundo claro.

**Solução**: Usar cores que respeitam o tema (como `text-foreground`) ou aplicar estilos específicos apenas no contexto do lightbox escuro (que tem `bg-black/95`).

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/Lightbox.tsx` | 1. Ignorar atalho de espaço quando foco está em input/textarea<br>2. Corrigir cores dos botões para contexto lightbox |

---

## Mudanças Detalhadas

### 1. Corrigir handler de teclado (linhas 125-133)

Adicionar verificação para não processar espaço quando o usuário está digitando:

```typescript
// ANTES:
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === 'Escape') onClose();
  if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
  if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
  if (e.key === ' ' && !disabled) {
    e.preventDefault();
    onSelect(currentPhoto.id);
  }
}, [currentIndex, photos.length, currentPhoto?.id, disabled, onClose, onNavigate, onSelect]);

// DEPOIS:
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  // Ignore keyboard shortcuts when user is typing in an input or textarea
  const activeElement = document.activeElement;
  const isTyping = activeElement?.tagName === 'INPUT' || 
                   activeElement?.tagName === 'TEXTAREA' ||
                   activeElement?.getAttribute('contenteditable') === 'true';
  
  if (e.key === 'Escape') onClose();
  
  // Only process navigation and selection shortcuts when not typing
  if (!isTyping) {
    if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
    if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
    if (e.key === ' ' && !disabled) {
      e.preventDefault();
      onSelect(currentPhoto.id);
    }
  }
}, [currentIndex, photos.length, currentPhoto?.id, disabled, onClose, onNavigate, onSelect]);
```

### 2. Corrigir cores dos botões (linhas 399-461)

Como o lightbox SEMPRE tem fundo escuro (`bg-black/95`), as cores brancas são corretas neste contexto. Porém, o problema é que a variante `outline` do Button inclui `bg-background`, que herda a cor de fundo do tema do cliente.

Solução: Garantir que os botões do lightbox tenham fundo transparente/escuro explícito:

```typescript
// Botão Selecionar (linha 400-412)
<Button
  onClick={() => !disabled && onSelect(currentPhoto.id)}
  disabled={disabled}
  variant={currentPhoto.isSelected ? 'terracotta' : 'outline'}
  size={isMobile ? 'icon' : 'default'}
  className={cn(
    !isMobile && 'gap-2',
    !currentPhoto.isSelected && 'bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white'
  )}
>

// Botão Favoritar (linha 414-430)
<Button
  onClick={() => !disabled && onFavorite(currentPhoto.id)}
  disabled={disabled}
  variant="outline"
  size={isMobile ? 'icon' : 'default'}
  className={cn(
    !isMobile && 'gap-2',
    'bg-transparent',
    currentPhoto.isFavorite 
      ? 'text-red-500 border-red-500/40 hover:bg-red-500/10' 
      : 'text-white border-white/40 hover:bg-white/10 hover:text-white'
  )}
>

// Botão Comentar (linha 432-446)
<Button
  onClick={() => setShowComment(!showComment)}
  variant="outline"
  size={isMobile ? 'icon' : 'default'}
  className={cn(
    !isMobile && 'gap-2',
    'bg-transparent',
    currentPhoto.comment 
      ? 'text-primary border-primary hover:bg-primary/10' 
      : 'text-white border-white/40 hover:bg-white/10 hover:text-white'
  )}
>

// Botão Baixar (linha 448-461)
<Button
  onClick={handleDownload}
  variant="outline"
  size={isMobile ? 'icon' : 'default'}
  className={cn(
    !isMobile && 'gap-2',
    'bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white'
  )}
>
```

---

## Resultado Esperado

| Problema | Antes | Depois |
|----------|-------|--------|
| Digitar espaço no comentário | Seleciona/deseleciona foto | Adiciona espaço no texto |
| Setas enquanto digita | Navega entre fotos | Não interfere na digitação |
| Botões não selecionados | Texto branco invisível em fundo branco | Texto branco visível em fundo escuro do lightbox |

---

## Fluxo de Teste

1. Abrir lightbox de uma foto
2. Clicar em "Comentar" para abrir o painel
3. Digitar texto com espaços → espaços devem aparecer normalmente
4. Usar setas do teclado dentro do textarea → não deve navegar entre fotos
5. Verificar que os botões "Selecionar", "Favoritar", "Comentar" são visíveis e legíveis
