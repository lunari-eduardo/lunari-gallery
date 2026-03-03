

## Plano: Ajustes visuais nos cards Transfer

### Alterações nos cards Transfer (linhas 668-697)

**Mensal — remover valor anual e "(proporcional)":**
- Linha 675-685: Remover o bloco que mostra "Ou R$ X por ano (20% off)" quando `billingPeriod === 'monthly'`
- Linha 695: Remover `(proporcional)` do texto "Pagar agora"

**Anual — reorganizar hierarquia:**
- Remover "Equivale a R$ X/mês" da posição atual (linha 681-683)
- Adicionar badge "Até 12x sem juros" junto ao preço principal anual
- Abaixo do preço, adicionar "apenas R$ X/mês" (valor mensal equivalente)

**Alinhar botões:**
- Usar `mt-auto` no botão para empurrar todos ao fundo do card, garantindo alinhamento entre cards com diferentes quantidades de texto (crédito/prorata)

### Resumo das mudanças no bloco de preço (linhas 668-697):

```
Preço principal (R$ X /mês ou /ano)
  → Se anual: Badge "Até 12x sem juros"
  → Se anual: "apenas R$ X/mês" abaixo
  → Se mensal: nada abaixo do preço
Se upgrade com crédito: "Crédito de planos ativos: R$ X"
Se upgrade com prorata: "Pagar agora: R$ X" (sem "proporcional")
```

### Arquivo: `src/pages/CreditsCheckout.tsx`
- Linhas 668-697: Reescrever bloco de preço + info
- Linhas 700-730: Adicionar `mt-auto` ao wrapper do botão

### Também aplicar ao combo Transfer (linhas 764-795):
- Remover "Equivale a R$ X/mês" e trocar por "apenas R$ X/mês" abaixo do preço anual

