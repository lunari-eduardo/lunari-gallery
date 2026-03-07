

## Melhoria do Layout de Pastas (Visualização do Cliente)

### Estado Atual (linhas 1594-1661 de ClientGallery.tsx)
- Header com logo pequeno em `h-12` dentro de um `header` com `border-b`
- Titulo da galeria em `text-3xl/4xl` seguido de contagem de fotos
- Grid de cards em `grid-cols-2 sm:grid-cols-3` com `aspect-[3/4]`, `rounded-xl`, gradiente e texto sobreposto
- Sem texto explicativo ("Escolha um album")
- Hover: `scale-105` na imagem, `shadow-lg` no container

### Alteracoes Propostas

**1. Header**
- Reduzir padding vertical (`p-4` para `py-3`)
- Remover `border-b` para visual mais limpo
- Manter logo centralizado, aumentar levemente para `h-14`

**2. Secao de titulo**
- Adicionar mais espaco entre logo e titulo (`mb-2` para `mb-1`)
- Manter tipografia forte para nome da sessao
- Adicionar texto explicativo abaixo da contagem: "Escolha um album para visualizar" em `text-muted-foreground text-sm`
- Aumentar `mb-8` para `mb-10` para mais respiro

**3. Cards das pastas (mudanca principal)**
- Mudar proporcion de `aspect-[3/4]` para `aspect-[4/5]` (mais fotografico)
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` com `gap-5` (maior)
- Container: `max-w-4xl` (mais largo)
- Remover `rounded-xl` e `border` → usar `rounded-lg` sutil e sem borda visivel
- Hover: reduzir scale de `1.05` para `1.03`, adicionar `duration-700` para transicao mais suave
- Gradiente: mais sutil, `from-black/60 via-black/10 to-transparent`
- Tipografia interna: nome da pasta em `text-base font-semibold` com `tracking-wide`, contagem em `text-white/60 text-xs`
- Mais padding interno (`p-4` em vez de `p-3`)
- Adicionar `cursor-pointer` explicito
- Sombra no hover: `shadow-xl` com transicao suave

**4. Responsividade**
- Mobile (< sm): 1 coluna, cards maiores
- Tablet (sm): 2 colunas
- Desktop (lg): 3 colunas

### Arquivo modificado
- `src/pages/ClientGallery.tsx` — bloco entre linhas 1596-1661

### Resumo visual esperado

```text
┌─────────────────────────────┐
│         [ LOGO ]            │  ← header limpo, sem borda
│                             │
│          TESTE              │  ← titulo grande, fonte da sessao
│         9 fotos             │
│  Escolha um álbum para      │
│       visualizar            │
│                             │
│  ┌──────────┐ ┌──────────┐  │
│  │          │ │          │  │
│  │  (foto)  │ │  (foto)  │  │  ← aspect 4:5
│  │          │ │          │  │
│  │ Externas │ │ Estúdio  │  │  ← texto sobre gradiente
│  │ 5 fotos  │ │ 4 fotos  │  │
│  └──────────┘ └──────────┘  │
│                             │
└─────────────────────────────┘
```

