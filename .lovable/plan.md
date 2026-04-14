

# Melhorias no Modal de Códigos de Fotos

## Problemas identificados

1. **Dois campos quando só há uma pasta**: Quando todas as fotos estão em uma única pasta, o modal mostra o bloco da pasta E o bloco "Todos juntos" — redundante, pois o conteúdo é idêntico.

2. **Botão "Copiar" por pasta com pouco destaque**: O botão `variant="ghost"` é quase invisível, difícil de notar.

3. **"Copiar Todos" inclui cabeçalho da pasta no código**: O `generateAllCode()` adiciona `── Pasta (N) ──` ao código, o que não funciona na busca do Windows/Mac/Lightroom.

## Solução

### `src/components/PhotoCodesModal.tsx`

**1. Pasta única = sem separação por pasta**
- Se `photosByFolder` tem apenas 1 entrada, tratar como se não houvesse pastas (mostrar apenas um bloco único sem cabeçalho de pasta).
- Condição: `const showFolderSections = hasFolders && photosByFolder.length > 1;`

**2. Botão de copiar por pasta com mais destaque**
- Trocar `variant="ghost"` para `variant="outline"` com cores mais visíveis.

**3. "Copiar Todos" gera código limpo sem cabeçalhos**
- O `generateAllCode()` vai gerar apenas os códigos separados por quebra de linha dupla, sem a linha `── Nome (N) ──`.
- Alterar de:
  ```typescript
  return `── ${g.folder.nome} (${g.photos.length}) ──\n${code}`;
  ```
  Para:
  ```typescript
  return code;
  ```
- Os cabeçalhos de pasta continuam visíveis na UI (labels acima de cada textarea), mas não são incluídos no código copiado.

## Resultado
- 1 pasta → 1 campo único, sem redundância
- Múltiplas pastas → campos separados + botão "Copiar Todos" (código limpo)
- Botões de copiar com melhor visibilidade

