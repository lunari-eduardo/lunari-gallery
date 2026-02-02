
# Galeria Premium: Cabeçalho que Rola com o Conteúdo

## Problema Atual

O cabeçalho da galeria do cliente usa `sticky top-0 z-40`, fazendo com que ele fique **fixo** no topo da tela enquanto o usuário rola as fotos. Isso:
- Reduz a área útil de visualização das imagens
- Cria uma experiência menos imersiva
- Não é ideal para galerias de fotografia profissional

A imagem mostra como o cabeçalho ocupa espaço valioso que poderia ser usado para exibir mais fotos.

## Solução: Cabeçalho Normal (Não-Fixo)

Transformar o cabeçalho em um elemento normal que rola junto com o conteúdo, liberando toda a tela para visualização das fotos.

### Comportamento Esperado

| Ação | Resultado |
|------|-----------|
| Ao entrar na galeria | Cabeçalho visível com logo, nome e contagem |
| Ao rolar para baixo | Cabeçalho sai da tela, fotos ocupam 100% |
| Ao rolar para cima | Cabeçalho reaparece naturalmente |

## Mudanças Técnicas

### Arquivo: `src/components/ClientGalleryHeader.tsx`

Remover o comportamento sticky do cabeçalho:

**Antes:**
```tsx
<header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
```

**Depois:**
```tsx
<header className="bg-background border-b border-border/50">
```

Mudanças:
- Remove `sticky top-0 z-40` (não fica mais fixo)
- Remove `backdrop-blur` (não precisa mais de blur)
- Remove transparência do bg (`bg-background/95` → `bg-background`)

### Arquivo: `src/pages/ClientGallery.tsx`

Atualizar a barra de seleção inferior e outros cabeçalhos fixos para garantir consistência visual. O `SelectionSummary` na parte inferior permanece fixo para permitir ação rápida do usuário.

## Resultado Visual

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ANTES (sticky)                     DEPOIS (normal scroll)         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐               ┌─────────────────┐              │
│  │ HEADER FIXO     │               │ (fotos ocupam   │              │
│  │ Logo + Nome     │               │  100% da tela)  │              │
│  │ Contagem        │               │                 │              │
│  ├─────────────────┤               │  ┌───┐ ┌───┐    │              │
│  │                 │               │  │   │ │   │    │              │
│  │ ┌───┐ ┌───┐     │               │  │Foto│ │Foto│   │              │
│  │ │   │ │   │     │               │  │   │ │   │    │              │
│  │ │Foto│ │Foto│    │               │  └───┘ └───┘    │              │
│  │ │   │ │   │     │               │                 │              │
│  │ └───┘ └───┘     │               │  ┌───┐ ┌───┐    │              │
│  │                 │               │  │   │ │   │    │              │
│  └─────────────────┘               │  │Foto│ │Foto│   │              │
│                                     └─────────────────┘              │
│                                                                     │
│  Menos espaço para fotos           Visualização imersiva           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/ClientGalleryHeader.tsx` | Remover `sticky top-0 z-40 backdrop-blur` do header principal |

## Considerações de UX

- A barra inferior com botão "Confirmar" permanece **fixa** para acesso rápido
- O usuário pode rolar para cima a qualquer momento para ver o cabeçalho
- As fotos ganham mais destaque e espaço visual
- Experiência mais próxima de galerias fotográficas profissionais
