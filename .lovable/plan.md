

## Corrigir intensidade dos radiais no modo Dark

### Problema
Ao remover a div dimmer (`bg-background/80`), as esferas ficaram excessivamente claras/amareladas no dark mode porque suas opacidades foram calibradas para funcionar **com** aquela camada de escurecimento. A solução correta não é re-adicionar a camada opaca (que causava o "apagamento"), mas sim **reduzir as opacidades dos gradientes condicionalmente no dark mode** usando CSS.

### Solução: Opacidade condicional via classe `dark`

Em vez de inline styles fixos, envolver as 4 esferas em um container que tenha **opacidade reduzida no dark mode**:

```tsx
<div className="absolute inset-0 opacity-100 dark:opacity-40">
  {/* todas as 4 esferas aqui */}
</div>
```

Isso é à prova de falhas porque:
- **Light mode**: opacidade 100% — esferas ficam como estão
- **Dark mode**: opacidade 40% — esferas ficam sutis sem uma camada sólida cobrindo tudo
- O ruído SVG fica **fora** deste container, mantendo sua intensidade em ambos os modos
- Não há camada opaca bloqueando o glassmorphism

### Arquivo
- `src/components/InternalBackground.tsx` — agrupar as 4 divs de esferas em um wrapper com `opacity-100 dark:opacity-40`, mantendo o SVG de ruído fora do wrapper

