# Plano: Salvamento de Rascunho de Galeria e Melhorias na Tela de Edição

## ✅ Status: Implementado

---

## Problema 1: Rascunho de Galeria ✅

### Solução Implementada
- Adicionado botão "Salvar Rascunho" no footer fixo da página de criação
- Função `handleSaveDraft()` cria ou atualiza galeria com `status: 'rascunho'`
- Cliente e fotos são opcionais - permite salvar em qualquer etapa

### Arquivos Modificados
- `src/pages/GalleryCreate.tsx` - Adicionado `handleSaveDraft()` e botão no footer

---

## Problema 2: Layout da Tela de Edição ✅

### Solução Implementada
1. **Botão "Salvar Alterações"** movido para o header (canto superior direito)
2. **Botão "Excluir Galeria"** movido para card de "Ações da Galeria"
3. **Estilo do excluir** agora é texto vermelho simples (sem botão vermelho chamativo)

### Arquivos Modificados
- `src/pages/GalleryEdit.tsx` - Reorganização do layout

---

## Problema 3: Prazo de Seleção Não Salva ✅

### Causa Raiz
O `handleSave` não incluía o campo `prazoSelecao` na chamada de `updateGallery`.

### Solução Implementada
1. Adicionado campo `prazoSelecao?: Date` à interface `CreateGaleriaData`
2. Atualizado `updateGalleryMutation` para processar `prazo_selecao` como timestamp
3. `handleSave` agora inclui `prazoSelecao` nos dados salvos
4. Removido toast enganoso de `handleExtendDeadline` (usuário precisa salvar para persistir)

### Arquivos Modificados
- `src/hooks/useSupabaseGalleries.ts` - Interface e mutation atualizados
- `src/pages/GalleryEdit.tsx` - handleSave e handleExtendDeadline corrigidos

---

## Resumo Final

| Arquivo | Modificações |
|---------|--------------|
| `src/pages/GalleryCreate.tsx` | Adicionado `handleSaveDraft` e botão no footer |
| `src/pages/GalleryEdit.tsx` | Reorganizado layout, corrigido bug do prazo |
| `src/hooks/useSupabaseGalleries.ts` | Adicionado suporte a `prazoSelecao` |
