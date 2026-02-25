

# Equilibrio Visual e Navegacao Direta na Pagina de Creditos

## Problema

A pagina `/credits` tem desequilibrio visual entre Select (forte) e Transfer (fraco). A pagina `/credits/checkout` tem hero muito alta, toggle desnecessario entre produtos e falta micro-labels de contexto.

## Mudancas

### 1. Credits.tsx - Equilibrar peso visual Select vs Transfer

**Gallery Select - adicionar micro-label:**
- Abaixo do logo: texto pequeno "Creditos pre-pagos para galerias de selecao"

**Gallery Transfer - aumentar presenca visual (sem plano ativo):**
- Remover icone HardDrive + label "Armazenamento" (redundante com o logo)
- Texto principal: "Ative um plano e entregue galerias que geram valor."
- Micro-label abaixo do logo: "Plano mensal de armazenamento"
- Botao maior (mesmo `size` do "Comprar Creditos"), texto: "Ver planos de armazenamento"

**Gallery Transfer - com plano ativo:**
- Manter barra de progresso e dados atuais (ja tem bom peso)
- Adicionar micro-label "Plano mensal de armazenamento"

**Secao Combos - melhorar transicao:**
- Antes do titulo "Cresca com uma estrutura completa", adicionar frase de transicao:
  "Quer ter o sistema de gestao mais completo integrado as suas galerias?"

**Botoes de navegacao:**
- "Comprar Creditos" navega para `/credits/checkout?tab=select`
- "Ver planos de armazenamento" navega para `/credits/checkout?tab=transfer`

### 2. CreditsCheckout.tsx - Remover toggle, reduzir hero, fixar contexto

**Remover toggle Gallery Select / Gallery Transfer:**
- A pagina abre diretamente no modo correto baseado em `?tab=select` ou `?tab=transfer` (lido via `useSearchParams`)
- Sem possibilidade de trocar entre produtos na mesma pagina
- O `activeTab` e derivado da URL, sem `useState`

**Reduzir hero drasticamente:**
- Remover pill de "Creditos disponiveis" / "Plano ativo" (informacao ja esta em `/credits`)
- Reduzir padding: `pt-10 pb-24` em vez de `pt-16 pb-40`
- Manter apenas: badge contextual + titulo + subtitulo (3 linhas)
- Cards sobem mais, ficam mais proximo do topo

**Resultado visual da hero:**

```text
  [CREDITOS]
  Organize e profissionalize o processo de selecao de fotos
  Creditos flexiveis, sem validade e sem mensalidade.

  --- cards logo abaixo ---
```

### 3. Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/Credits.tsx` | Micro-labels, equilibrio Transfer, frase de transicao nos combos, botoes com navegacao correta |
| `src/pages/CreditsCheckout.tsx` | Remover toggle, ler tab da URL, reduzir hero, remover pill de saldo |

### 4. Detalhes tecnicos

- `CreditsCheckout` usara `useSearchParams` para ler `tab` da URL
- Fallback: se `tab` nao fornecido, default para `'select'`
- `activeTab` passa de `useState` para `const activeTab = searchParams.get('tab') === 'transfer' ? 'transfer' : 'select'`
- Botao "Comprar Creditos" em Credits.tsx: `navigate('/credits/checkout?tab=select')`
- Botao "Ver planos de armazenamento" em Credits.tsx: `navigate('/credits/checkout?tab=transfer')`

