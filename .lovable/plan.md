
# Transfer Gallery: Fotos Persistentes, Capa, Fonte e Temas

## Resumo

Tres areas de mudanca na criacao de galerias Transfer:

1. **Fotos persistentes apos upload** com grid grande, hover para excluir e selecionar como capa
2. **Selecao de fonte** para titulo da galeria (mesma logica do Gallery Select)
3. **Suporte a temas personalizados** (sistema/custom, claro/escuro) na criacao e nas telas do cliente

---

## 1. Fotos persistentes com grid e acoes

### Problema atual

O `PhotoUploader` limpa fotos concluidas apos 2 segundos (linha 382-384). Na pagina `DeliverCreate`, apenas um contador e exibido.

### Solucao

Criar componente `DeliverPhotoManager` que:
- Recebe `galleryId` e busca fotos do Supabase (`galeria_fotos`) em tempo real
- Exibe grid responsivo largo (3-5 colunas), com container expandido para `max-w-4xl`
- Cada foto tem hover com:
  - Botao excluir (X canto superior direito)
  - Botao "Definir como capa" (icone estrela/imagem canto superior esquerdo)
  - Foto de capa recebe borda visual dourada/primaria + badge
- Capa salva em `configuracoes.coverPhotoId` via `updateGallery`
- `PhotoUploader` fica acima do grid para novos uploads
- Apos upload completar, grid re-busca fotos automaticamente (via `refreshKey`)
- Exclusao chama `delete-photos` edge function + remove do banco

### Arquivo novo
- `src/components/deliver/DeliverPhotoManager.tsx`

### Arquivos modificados
- `src/pages/DeliverCreate.tsx` -- Integrar no Step 2, expandir container de `max-w-2xl` para `max-w-4xl` apenas no step 2
- `src/pages/ClientDeliverGallery.tsx` -- Usar `coverPhotoId` para selecionar foto de capa do Hero

### Detalhes tecnicos

**DeliverPhotoManager -- busca de fotos:**
```text
supabase.from('galeria_fotos')
  .select('id, storage_key, original_filename, width, height, preview_path, thumb_path')
  .eq('galeria_id', galleryId)
  .order('created_at')
```

**Grid layout:**
```text
grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3
```

Cada item: `aspect-square` com `object-cover`, overlay escuro no hover com botoes.

**Cover photo no ClientDeliverGallery (linha 85):**
```text
// Antes: sempre photos[0]
// Depois:
const coverPhotoId = gallery.settings?.coverPhotoId;
const coverPhoto = coverPhotoId
  ? photos.find(p => p.id === coverPhotoId) || photos[0]
  : photos[0];
```

---

## 2. Selecao de fonte para titulo

Adicionar `FontSelect` na etapa 1 (Dados) do `DeliverCreate`, replicando a logica do `GalleryCreate`:

### Arquivo modificado
- `src/pages/DeliverCreate.tsx`

### Detalhes

- Novos estados: `sessionFont` (default de `settings.lastSessionFont` ou `'playfair'`) e `titleCaseMode` (default `'normal'`)
- Componente `FontSelect` abaixo do campo "Nome da sessao" com `previewText={sessionName}`
- Na criacao da galeria, incluir no `configuracoes`: `sessionFont` e `titleCaseMode`
- Na publicacao, salvar `lastSessionFont` no settings

---

## 3. Suporte a temas personalizados

### Na criacao (DeliverCreate)

Replicar a UI de tema do `GalleryCreate` (linhas 1519-1562):
- Novos estados: `selectedThemeId` e `clientMode` ('light' | 'dark')
- Inicializacao de `settings.activeThemeId` e `settings.clientTheme`
- Se fotografo tem tema custom (`settings.themeType === 'custom'`), exibir preview das cores + toggle claro/escuro
- Salvar `themeId` e `clientMode` no `configuracoes` da galeria

### Nas telas do cliente (ClientDeliverGallery + sub-componentes)

O backend (`gallery-access`) ja retorna `theme` e `clientMode` para galerias de entrega. Porem `ClientDeliverGallery` e seus componentes usam cores fixas (`bg-black text-white`).

Mudancas:
- `ClientDeliverGallery`: calcular `isDark`, `bgColor`, `textColor`, `primaryColor` a partir de `data.theme` e `data.clientMode`. Aplicar como style inline no container raiz e passar como props.
- `DeliverHero`: receber `isDark` e ajustar overlay (mais claro em modo light)
- `DeliverHeader`: substituir `bg-black/80` por cor dinamica baseada no tema
- `DeliverPhotoGrid`: substituir `bg-black` por fundo dinamico

### Arquivos modificados
- `src/pages/DeliverCreate.tsx` -- estados de tema, UI de selecao, salvar no configuracoes
- `src/pages/ClientDeliverGallery.tsx` -- calcular e aplicar cores do tema
- `src/components/deliver/DeliverHero.tsx` -- receber props de tema
- `src/components/deliver/DeliverHeader.tsx` -- cores dinamicas
- `src/components/deliver/DeliverPhotoGrid.tsx` -- fundo dinamico

### Logica de cores

```text
const isDark = data.clientMode === 'dark' ||
  (data.theme?.backgroundMode === 'dark' && data.clientMode !== 'light');

const bgColor = isDark ? '#1C1917' : '#FAF9F7';
const textColor = isDark ? '#F5F5F4' : '#2D2A26';
const primaryColor = data.theme?.primaryColor || (isDark ? '#FFFFFF' : '#1C1917');
```

---

## Arquivos modificados (resumo)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/deliver/DeliverPhotoManager.tsx` | **Novo** -- Grid de fotos com delete e selecao de capa |
| `src/pages/DeliverCreate.tsx` | FontSelect, tema, container expandido, photo manager |
| `src/pages/ClientDeliverGallery.tsx` | Cover photo por ID, aplicar tema dinamico |
| `src/components/deliver/DeliverHero.tsx` | Props de tema (isDark, cores) |
| `src/components/deliver/DeliverHeader.tsx` | Cores dinamicas do tema |
| `src/components/deliver/DeliverPhotoGrid.tsx` | Fundo dinamico baseado no tema |

---

## Sequencia de implementacao

1. Criar `DeliverPhotoManager` (grid + delete + capa)
2. Integrar no `DeliverCreate` step 2 com container expandido
3. Adicionar FontSelect no step 1
4. Adicionar selecao de tema no step 1
5. Salvar font + theme + coverPhotoId no configuracoes
6. Atualizar `ClientDeliverGallery` para usar coverPhotoId
7. Aplicar tema dinamico nos componentes do cliente Transfer
