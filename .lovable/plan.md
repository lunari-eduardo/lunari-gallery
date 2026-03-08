

## Aplicar Glassmorphism na página de Edição de Galeria

### Problema
Os cards na página `GalleryEdit.tsx` usam o componente `<Card>` padrão sem a classe `glass`, resultando em blocos opacos que não seguem a identidade visual glassmorphism do sistema.

### Solução
Adicionar a classe `glass` em todos os `<Card>` da página (linhas 368, 546, 626, 739), alinhando com o padrão usado nas demais páginas.

### Alterações
**`src/pages/GalleryEdit.tsx`** — 4 pontos de alteração:

1. **Card "Informações da Galeria"** (linha 368): `<Card>` → `<Card className="glass">`
2. **Card "Prazo de Seleção"** (linha 546): `<Card>` → `<Card className="glass">`
3. **Card "Fotos da Galeria"** (linha 626): `<Card>` → `<Card className="glass">`
4. **Card "Reativar Galeria"** (linha 739): `<Card>` → `<Card className="glass">`

