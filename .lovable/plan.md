

## Ajustar tom dos cards no Dark Mode

### Problema
No dark mode, `--glass-bg` está em `0 0% 100% / 0.06` (branco 6% de opacidade), o que gera um tom acinzentado nos cards. Além disso, `--card` é `20 12% 10%` (sólido escuro) que também contribui para o visual opaco.

### Solução
Reduzir a opacidade do `--glass-bg` no dark de `0.06` para `0.03` e do `--glass-border` de `0.08` para `0.05`, tornando os cards mais transparentes e integrados ao fundo escuro. Também ajustar `--card` para incluir transparência (`20 12% 10% / 0.4`).

### Alterações
**`src/index.css`** (bloco `.dark`):
- `--glass-bg: 0 0% 100% / 0.03` (era `0.06`)
- `--glass-border: 0 0% 100% / 0.05` (era `0.08`)
- `--card: 20 12% 10% / 0.4` (era sólido)

