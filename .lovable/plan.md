

# Ajuste de Cores do Design System

## Mudancas

Todas as alteracoes serao feitas em `src/index.css`, nas variaveis CSS do `:root` (modo claro) e `.dark` (modo escuro).

### 1. Cor de destaque (accent) -- tom laranja com baixa opacidade

Atualmente o accent usa verde (hue 120). Mudar para laranja suave:

- `--accent`: de `120 20% 90%` para `25 60% 95%` (laranja muito claro, baixa opacidade)
- `--accent-foreground`: de `120 25% 30%` para `25 50% 35%`

### 2. Fundo do modo claro -- branco puro

- `--background`: de `30 25% 97%` para `0 0% 100%`
- `--card`: de `30 20% 99%` para `0 0% 100%`
- `--popover`: de `30 20% 99%` para `0 0% 100%`
- `--sidebar-background`: de `30 20% 98%` para `0 0% 99%`
- Ajustar `--muted` para tom neutro mais frio: `220 10% 95%`
- Ajustar `--border` e `--input`: de `30 15% 88%` para `220 10% 90%`

### 3. Modo escuro -- cinza neutro em vez de marrom

Substituir todos os tons com hue 25 (marrom) por hue 220 (cinza neutro azulado) ou 0 com saturacao 0%:

- `--background`: de `25 15% 10%` para `0 0% 8%`
- `--foreground`: de `30 20% 95%` para `0 0% 95%`
- `--card`: de `25 15% 13%` para `0 0% 11%`
- `--popover`: de `25 15% 13%` para `0 0% 11%`
- `--muted`: de `25 12% 20%` para `0 0% 18%`
- `--muted-foreground`: de `30 15% 60%` para `0 0% 60%`
- `--border`: de `25 12% 22%` para `0 0% 20%`
- `--input`: de `25 12% 22%` para `0 0% 20%`
- `--cream`: de `30 15% 15%` para `0 0% 14%`
- Sidebar dark tokens: mesma neutralizacao
- Gradients dark: atualizar hsl refs para novos valores neutros

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/index.css` | Variaveis CSS light e dark atualizadas |

