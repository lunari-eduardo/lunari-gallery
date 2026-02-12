

# Refino Premium -- Gallery Select e Gallery Transfer

## Resumo

Renomear "Deliver" para "Transfer" em todo o frontend, reestruturar o layout da pagina de galerias com titulo dinamico, container centralizado, cards de Select em lista vertical, e cards de Transfer em grid visual. Manter backend inalterado.

---

## 1. Renomeacao: Deliver para Transfer

Todas as referencias visuais (labels, textos, placeholders) mudam de "Deliver" / "Entrega" para "Transfer".

URLs de rota permanecem como estao (`/galleries/deliver`, `/deliver/:id`, `/deliver/new`) -- apenas o texto visivel muda.

Arquivos afetados:
- `src/pages/Dashboard.tsx` -- labels de abas, textos, popover
- `src/components/Layout.tsx` -- item "Entrega" no popover de navegacao
- `src/components/DeliverGalleryCard.tsx` -- nenhum texto "Deliver" visivel (ja foi removido)

---

## 2. Titulo Dinamico + Subtitulo

**Arquivo:** `src/pages/Dashboard.tsx`

Substituir o titulo fixo "Suas Galerias" por conteudo dinamico baseado na aba ativa:

- Aba Select: titulo "Gallery Select" (usando componente Logo com variante customizada ou texto estilizado) + subtitulo "Gerencie as escolhas dos seus clientes."
- Aba Transfer: titulo "Gallery Transfer" + subtitulo "Gerencie suas entregas finais."

O titulo usa `font-display` com peso 600-700 e tamanho grande. O subtitulo e `text-sm text-muted-foreground`.

---

## 3. Container Centralizado

**Arquivo:** `src/pages/Dashboard.tsx`

Envolver todo o conteudo em:

```text
<div className="max-w-[1100px] mx-auto">
  ...
</div>
```

Isso cria foco visual central e evita layout espalhado em telas grandes.

---

## 4. Abas Minimalistas (ja implementadas, pequeno ajuste)

As abas ja usam underline style. Ajustes:
- Renomear "Deliver" para "Transfer" no TabsTrigger
- Manter estilo underline fino existente

---

## 5. Card Select -- Layout Lista Vertical

**Arquivo:** `src/components/GalleryCard.tsx` (refactor) + `src/pages/Dashboard.tsx`

### Dashboard: trocar grid por lista

```text
ANTES: grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
DEPOIS: flex flex-col gap-3
```

### GalleryCard: layout horizontal compacto

Nova estrutura do card:

```text
+-------------------------------------------------------+
| [Nome da Sessao]              Status   [⋯]            |
| [Cliente]                                              |
| 8/20 +2  ⚠ 12h              13 de fev                 |
| Valor adicional               R$ 50.00                 |
+-------------------------------------------------------+
```

Mudancas no card:
- Nome da galeria: `text-base font-semibold` (aumentar de `text-sm`)
- Hover: `hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`
- Manter menu contextual existente
- Sem thumbnail (query de listagem nao traz fotos, e para Select o foco e processo/dados)

---

## 6. Card Transfer -- Ajustes Finais

**Arquivo:** `src/components/DeliverGalleryCard.tsx`

### Dashboard: manter grid mas ajustar

```text
grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```

Reduzir de 4 colunas max para 3 (cards maiores, mais respiro).

### DeliverGalleryCard:
- Nome: `text-base font-semibold` (aumentar de `text-sm`)
- Hover do card inteiro: `hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`
- Manter thumbnail, status badge, contagem de fotos, menu contextual
- Tudo ja limpo nas iteracoes anteriores

---

## 7. Popover "Nova Galeria" -- Renomear

**Arquivo:** `src/pages/Dashboard.tsx`

No popover de criacao:
- "Entrega" muda para "Transfer"
- Subtitulo "Download direto" muda para "Entrega final de fotos"

**Arquivo:** `src/components/Layout.tsx`

No menu lateral/mobile:
- "Entrega" muda para "Transfer"
- Subtitulo muda para "Entrega final"

---

## 8. Estados Vazios -- Atualizar Textos

**Arquivo:** `src/pages/Dashboard.tsx`

- Empty state Transfer: "Nenhuma galeria de transfer" + "Use esse modo para entregar as fotos finais aos seus clientes."
- Botao: "Criar galeria de transfer"
- Metricas inline: "{N} transfers" em vez de "{N} entregas"

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Dashboard.tsx` | Titulo dinamico, container centralizado, lista vertical para Select, grid 3 colunas para Transfer, renomear Deliver para Transfer |
| `src/components/GalleryCard.tsx` | Aumentar tipografia do nome, adicionar hover elevation |
| `src/components/DeliverGalleryCard.tsx` | Aumentar tipografia do nome, adicionar hover elevation |
| `src/components/Layout.tsx` | Renomear "Entrega" para "Transfer" no menu de navegacao |

---

## Detalhes tecnicos

### Titulo dinamico

```text
const title = activeTab === 'select' ? 'Gallery Select' : 'Gallery Transfer';
const subtitle = activeTab === 'select'
  ? 'Gerencie as escolhas dos seus clientes.'
  : 'Gerencie suas entregas finais.';
```

Renderizado com `font-display text-3xl md:text-4xl font-semibold` para o titulo e `text-sm text-muted-foreground mt-1` para o subtitulo.

### Container centralizado

Wrapper no return do Dashboard:
```text
<div className="max-w-[1100px] mx-auto space-y-6 animate-fade-in">
```

### Select grid para lista

Linha 278 do Dashboard:
```text
ANTES: <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
DEPOIS: <div className="flex flex-col gap-3">
```

### Transfer grid ajustado

Linha 357 do Dashboard:
```text
ANTES: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
DEPOIS: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```

### GalleryCard hover

Adicionar ao container do card:
```text
className="... hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
```

E aumentar nome de `text-sm` para `text-base`.

### DeliverGalleryCard hover

Mesma logica: adicionar hover elevation e aumentar tipografia do nome.

### Sobre thumbnails no Select

A query de listagem (`select('*')` em `galerias`) nao traz fotos. Adicionar uma sub-query para buscar a primeira foto de cada galeria seria custoso e mudaria a arquitetura do hook. Como o brief marca thumbnails como "Opcional, mas recomendado", o card Select permanece sem thumbnail nesta iteracao, priorizando densidade textual conforme o principio de produto (Select = processo, foco em dados).

