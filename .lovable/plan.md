

# Plano: Empilhar fotos selecionadas em coluna única respeitando proporção original

## Diagnóstico

Hoje o `SelectedPhotoCard` em `SelectionConfirmation.tsx` força `aspect-square object-cover`, recortando as imagens e exibindo-as em grade de 2/3 colunas. O cliente perde a noção real do enquadramento das fotos verticais e horizontais, que é justamente o que ele precisa revisar antes de confirmar.

## Solução

Trocar a grade por **coluna única empilhada**, com cada foto ocupando 100% da largura da coluna e altura proporcional ao aspect ratio original.

### Mudanças em `src/components/SelectionConfirmation.tsx`

1. **Remover grid de fotos**:
   - Hoje: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 lg:gap-3`.
   - Novo: `flex flex-col gap-3` (uma foto por linha, empilhadas).

2. **Substituir `aspect-square object-cover` por aspect ratio dinâmico**:
   - No `<img>` da `SelectedPhotoCard`: usar `w-full h-auto object-contain` (sem recorte).
   - Wrapper recebe `style={{ aspectRatio: photo.width && photo.height ? \`\${photo.width} / \${photo.height}\` : '4 / 3' }}` como **fallback visual** enquanto carrega, evitando salto de layout.
   - Fundo `bg-muted` permanece para preencher enquanto a imagem baixa.

3. **Largura da coluna esquerda (desktop)**:
   - Manter `lg:grid-cols-[1.1fr_1fr]` mas limitar a coluna de fotos com `max-w-[480px]` (ou similar) para não exibir verticais gigantes em telas largas. Centralizar com `mx-auto`.
   - Mobile: largura cheia (já é, sem ajuste).

4. **Posicionamento dos badges (favorito, comentário, pílula `+N`)**:
   - Continuam absolutos sobre o `<img>`, mas agora o container é a foto inteira na proporção real — badges ficam visíveis nos cantos como hoje.
   - Garantir `pointer-events-none` no wrapper de overlays para não bloquear scroll em mobile.

5. **Nome + comentário abaixo da foto**:
   - Permanecem como estão (texto truncado, ícone de comentário com tooltip).
   - Espaçamento `mt-2` entre foto e legenda; `gap-3` entre cards já dá respiro suficiente.

6. **Scroll**:
   - Desktop: coluna esquerda mantém `lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-2` para permitir rolar várias fotos sem afetar o resumo à direita (sticky).
   - Mobile: scroll natural da página.

### Tipos / dados

- `Photo` já expõe `width` e `height` (usados no `MasonryGrid`). Reaproveitar.
- Quando ausentes: usar fallback `aspectRatio: '4 / 3'` para o placeholder, e deixar a imagem assumir altura natural ao carregar (`onLoad` sem necessidade de medição manual graças a `w-full h-auto`).

## Resultado esperado

- Cliente vê cada foto **inteira** (sem corte), na largura da coluna, empilhada verticalmente.
- Verticais aparecem altas e estreitas; horizontais aparecem largas e baixas — todas alinhadas à mesma largura, respeitando proporção real.
- Favorito, comentário e pílula `+N` continuam visíveis nos cantos.
- Resumo descritivo fica fixo à direita (desktop) ou no topo (mobile); botão "Confirmar e Pagar" continua sticky no rodapé.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/SelectionConfirmation.tsx` | Trocar grid por coluna única; usar `aspectRatio` dinâmico baseado em `width`/`height`; ajustar `max-w` da coluna de fotos no desktop |

