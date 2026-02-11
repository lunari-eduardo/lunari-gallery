

# Refino Visual e de Produto -- Galerias (Select e Deliver)

## Resumo

Modernizar a pagina de Galerias com foco em premium, reducao de ruido visual, e separacao clara entre Select (processo) e Deliver (finalizacao). Cada mudanca segue as regras de produto definidas.

---

## 1. Sub-abas minimalistas (Select / Deliver)

**Arquivo:** `src/pages/Dashboard.tsx` + `src/components/ui/tabs.tsx` (ou override via className)

Remover o `TabsList` com background cinza (`bg-muted rounded-md p-1`) e substituir por tabs underline:
- Sem background
- Sem bordas
- Texto neutro no estado inativo, texto foreground + underline fino (2px) no ativo
- Alinhado a esquerda, na mesma linha visual do titulo "Suas Galerias"

Implementacao: passar `className` customizado no `TabsList` e `TabsTrigger` no Dashboard para override do estilo padrao, sem alterar o componente base (evita quebrar outros usos de Tabs no app).

---

## 2. Metricas inline (substituir cards grandes)

**Arquivo:** `src/pages/Dashboard.tsx`

Remover os grids de cards coloridos (`bg-amber-100`, `bg-green-100`, etc.) e substituir por uma unica linha de texto pequeno:

- Select: `6 galerias · 1 em selecao · 2 concluidas · 0 expiradas`
- Deliver: `2 entregas · 1 publicada · 0 expirada`

Texto `text-sm text-muted-foreground`, sem caixas, sem sombras, sem backgrounds.

---

## 3. Filtros como segmented control

**Arquivo:** `src/pages/Dashboard.tsx`

Substituir os `Button variant="outline"` por um grupo de controles segmentados:
- Padding reduzido (`px-3 py-1`)
- Border-radius menor (`rounded-md`)
- Aparencia de segmented control (borda compartilhada, sem gap entre itens)
- Ativo: background sutil (`bg-muted`), sem cor forte
- Remover o toggle grid/list do Select (simplificacao visual)

---

## 4. Menu de acoes (tres pontos) nos cards

**Novos componentes/logica em:** `src/components/GalleryCard.tsx` (Select) e `src/components/DeliverGalleryCard.tsx` (Deliver)

Adicionar um `DropdownMenu` com icone `MoreHorizontal` no canto superior direito de cada card:
- Visivel no hover (desktop): `opacity-0 group-hover:opacity-100`
- Sempre visivel no mobile
- Opcoes: Editar, Compartilhar, Excluir
- Excluir abre o `DeleteGalleryDialog` existente
- Compartilhar abre o `SendGalleryModal` existente
- Editar navega para `/gallery/:id` ou `/deliver/:id`

O menu precisa de `stopPropagation` no click para nao disparar o `onClick` do card.

Props adicionais necessarias nos cards: `onEdit`, `onShare`, `onDelete` (callbacks vindas do Dashboard).

---

## 5. Card Select -- sem imagem, compacto

**Arquivo:** `src/components/GalleryCard.tsx` (rewrite completo)

Remover inteiramente a secao de preview com imagens (`aspect-[4/3]`, grid de fotos, overlays).

Nova estrutura:
```text
+------------------------------------------+
| Nome da Sessao               Status  [⋯] |
| Cliente                                   |
| Progresso: 8/20    Data: 13 de fev        |
+------------------------------------------+
```

- Card sem thumbnail, sem placeholder
- Altura menor (sem aspect-ratio de imagem)
- `StatusBadge` existente para status
- Progresso de selecao: `selectedCount/includedPhotos` + extras se houver
- Data da sessao/prazo
- Menu `⋯` no canto superior direito
- Foco em densidade e leitura rapida

---

## 6. Card Deliver -- com imagem, limpo

**Arquivo:** `src/components/DeliverGalleryCard.tsx` (refactor)

Remover:
- Badge azul "Deliver" (saturado, redundante -- o usuario ja esta na aba Deliver)
- Contagem de fotos duplicada (aparece na imagem E no conteudo)
- Icone de Download no conteudo (nao funcional no card)
- CTA "Ver entrega ->" (redundante, card inteiro e clicavel)

Manter:
- Thumbnail (imagem da primeira foto ou placeholder discreto)
- Nome da sessao
- Nome do cliente
- Status: Rascunho / Publicada / Expirada (badge pequeno, discreto)
- Contagem de fotos (uma unica vez, no conteudo)
- Menu `⋯`

Ajustar:
- Mais respiro interno (padding maior)
- Card mais espaoso que o Select

---

## 7. Ajustes visuais gerais

**Arquivo:** `src/index.css`

- `.lunari-card`: reduzir `rounded-xl` para `rounded-lg`, reduzir shadow
- `.lunari-card:hover`: shadow mais sutil
- `.status-badge`: reduzir padding, tipografia mais discreta
- Reduzir variaveis de sombra (`--shadow-sm`, `--shadow-md`)

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Dashboard.tsx` | Tabs underline, metricas inline, filtros segmented, passar callbacks de acoes para cards, remover toggle grid/list |
| `src/components/GalleryCard.tsx` | Rewrite: card compacto sem imagem, com menu `⋯` |
| `src/components/DeliverGalleryCard.tsx` | Refactor: remover badge Deliver, download, CTA, duplicacoes; adicionar menu `⋯` |
| `src/index.css` | Reduzir sombras, radius, e estilos de `.lunari-card` e `.status-badge` |

## Detalhes tecnicos

### Menu de contexto nos cards

Cada card recebe callbacks:
```text
interface CardMenuProps {
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => Promise<void>;
  galleryName: string;
}
```

O `Dashboard.tsx` cria as funcoes inline:
- `onEdit`: `navigate('/gallery/:id')` ou `navigate('/deliver/:id')`
- `onShare`: abre state para `SendGalleryModal` (requer guardar a galeria selecionada em state)
- `onDelete`: chama `deleteGallery(id)` do hook

O `DeleteGalleryDialog` e reutilizado via composicao dentro do menu.

### Tabs underline (sem alterar componente base)

Override via className no Dashboard:
```text
TabsList: "bg-transparent p-0 h-auto border-b border-border"
TabsTrigger: "bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-muted-foreground data-[state=active]:text-foreground"
```

### Filtros segmented control

Wrapper com `inline-flex border rounded-lg overflow-hidden`, cada botao sem gap, bordas internas via `border-r last:border-r-0`.

