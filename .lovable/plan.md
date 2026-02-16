
# Melhorias na Galeria do Cliente: Colunas Mobile, Desconto Progressivo e Menu de Filtros

## 1. Colunas responsivas no mobile

**Problema**: No mobile (smartphones), o masonry grid mostra apenas 1 coluna. Em tablets, mostra 2.

**Correcao no CSS** (`src/index.css`):

Alterar os breakpoints do `.masonry-grid`:

| Breakpoint | Atual | Novo |
|---|---|---|
| Base (< 640px) | 1 coluna | **2 colunas** |
| sm (640px - tablets pequenos) | 2 colunas | **3 colunas** |
| lg (1024px+) | 3 colunas | 3 colunas (sem mudanca) |
| xl (1280px+) | 3 colunas | 3 colunas (sem mudanca) |
| 2xl (1536px+) | 4 colunas | 4 colunas (sem mudanca) |

Isso garante 2 colunas em smartphones e 3 em tablets sem alterar desktop.

---

## 2. Contador de desconto progressivo

Criar um novo componente `DiscountProgressBar` que sera exibido na parte inferior da galeria, acima da barra de selecao (bottom bar).

**Logica**: O componente recebe as `regrasCongeladas` (ou `discountPackages` de galerias standalone) e calcula:
- Faixa de preco atual (baseada no total de extras selecionadas)
- Proxima faixa de preco (se existir)
- Quantas fotos faltam para ativar o proximo desconto
- Porcentagem de desconto atual vs preco base

**Visual**:
- Barra horizontal com indicadores de faixas (segmentos)
- Cada faixa mostra: intervalo de fotos + valor por foto
- Faixa ativa destacada com cor primaria
- Texto "Faltam X fotos para desconto de Y%" abaixo
- Segue tema aplicado (dark/light) e cores customizadas
- Responsivo: compacto no mobile, expandido no desktop
- Estilo neutro e elegante, sem cores saturadas

**Compatibilidade**: Funciona com ambos os tipos de regras:
- Galerias vinculadas ao Gestao (regras congeladas com faixas global/categoria)
- Galerias standalone (discountPackages convertidos para regras)

**Visibilidade**: So aparece quando existem faixas de desconto progressivo (modelo `global` ou `categoria` com mais de 1 faixa). Nao aparece em modo `fixo`.

**Posicionamento**: Fixo na parte inferior, logo acima do `SelectionSummary` bottom-bar. Aparece/desaparece suavemente conforme o cliente seleciona fotos extras.

---

## 3. Menu hamburger com filtros

Substituir o botao de ajuda isolado no header por um menu hamburger (tres risquinhos) que abre um Sheet (painel lateral) com:

**Opcoes do menu**:
1. **Fotos favoritas** - Filtro que mostra apenas fotos marcadas como favoritas
2. **Fotos selecionadas** - Filtro que mostra apenas fotos ja selecionadas
3. **Todas as fotos** - Mostra todas (estado padrao)
4. **Instrucoes de uso** - Abre o modal `HelpInstructionsModal` existente

**Implementacao**:
- Usar componente `Sheet` (side="left") para o menu lateral
- Adicionar estado `filterMode: 'all' | 'favorites' | 'selected'` no `ClientGallery.tsx`
- Filtrar `localPhotos` antes de passar para o `MasonryGrid`
- Icone de menu (Menu/hamburguer) no header, lado esquerdo
- Mostrar contadores ao lado de cada filtro (ex: "Favoritas (5)")
- Seguir tema aplicado (cores, dark/light)

---

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/index.css` | Alterar column-count do masonry para 2 colunas no mobile base |
| `src/components/DiscountProgressBar.tsx` | **Novo** - Componente de progresso de desconto |
| `src/components/ClientGalleryHeader.tsx` | Adicionar menu hamburger com Sheet de filtros |
| `src/pages/ClientGallery.tsx` | Adicionar estado de filtro, integrar DiscountProgressBar |
| `src/components/HelpInstructionsModal.tsx` | Sem mudanca (reutilizado) |

---

## Detalhes tecnicos

### DiscountProgressBar

```text
Props:
- regrasCongeladas: RegrasCongeladas | null
- totalExtras: number (extras acumuladas)
- extraPhotoPrice: number (preco base fallback)
- saleSettings: gallery.saleSettings (para discountPackages standalone)

Logica interna:
1. Extrair faixas de getFaixasFromRegras()
2. Se faixas.length < 2, nao renderizar nada
3. Encontrar faixa atual com encontrarFaixaPreco(totalExtras)
4. Encontrar proxima faixa (a seguinte na lista ordenada)
5. Calcular: faltam = proximaFaixa.min - totalExtras
6. Calcular desconto%: ((precoBase - faixaAtual.valor) / precoBase) * 100
7. Renderizar barra segmentada + texto informativo
```

### Filtro no ClientGallery

```text
Estado: filterMode: 'all' | 'favorites' | 'selected'

Filtragem antes do MasonryGrid:
const displayPhotos = filterMode === 'favorites' 
  ? localPhotos.filter(p => p.isFavorite)
  : filterMode === 'selected'
  ? localPhotos.filter(p => p.isSelected)
  : localPhotos;

O lightbox continua usando localPhotos completo para navegacao.
```

### Menu lateral (Sheet)

```text
Posicao: lado esquerdo (side="left")
Conteudo:
- Header com titulo "Menu"
- Lista de filtros com icones e contadores
- Separador
- Item "Instrucoes de uso" que fecha o Sheet e abre o HelpModal
- Segue tema (bg-background, text-foreground)
```
