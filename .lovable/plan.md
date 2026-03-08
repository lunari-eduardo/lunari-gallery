

## Corrigir camada escura sobreposta no modo Dark

### Causa raiz
Linha 107 de `InternalBackground.tsx`:
```tsx
<div className="absolute inset-0 bg-background/80 dark:block hidden" />
```
Essa div cobre toda a tela com 80% de opacidade do background no dark mode, apagando as esferas e criando a sensação de "tudo escurecido/sobreposto".

### Solução
**Remover completamente** essa camada dimmer. As esferas já possuem opacidades adequadas e o fundo escuro do `--background` no dark mode já fornece contraste suficiente. Não há necessidade de uma camada extra de escurecimento.

### Arquivo
- `src/components/InternalBackground.tsx` — remover a div "Dark mode dimmer" (linha 107)

