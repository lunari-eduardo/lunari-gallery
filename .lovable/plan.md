# Planos Combo na pagina de compra + Layout mobile-friendly

## Resumo

Adicionar os planos combo (Studio e Completo) como produtos compraveis no banco de dados e na pagina de checkout, redesenhar o layout das paginas de creditos e checkout para um visual mais simples e mobile-friendly (menos cards, mais lista), e adicionar descricao sobre creditos nao vencerem.

## 1. Banco de dados -- novos pacotes combo

Inserir 2 novos registros na tabela `gallery_credit_packages` para os combos. Eles serao diferenciados dos pacotes avulsos por uma convencao no nome e por um campo de metadados que pode ser adicionado via description ou um novo campo. Como a tabela nao tem campo de "tipo", usaremos a convencao de nome + description para diferenciar.

Novos pacotes:


| Nome                                   | Creditos | Preco                 | sort_order | Descricao                                                                            |
| -------------------------------------- | -------- | --------------------- | ---------- | ------------------------------------------------------------------------------------ |
| Studio Pro + Select 2k                 | 2000     | R$ 44,90 (4490 cents) | 10         | Integracao com Lunari Studio. Gestao completa + selecao profissional. Mensal.        |
| Studio Pro + Select 2k + Transfer 20GB | 2000     | R$ 64,90 (6490 cents) | 11         | Estrutura profissional completa. Gestao, selecao e armazenamento integrados. Mensal. |


**Nota**: Estes sao planos mensais. Por enquanto, a compra via PIX funcionara como pagamento avulso do primeiro mes. A recorrencia sera implementada futuramente.

## 2. Pagina de Creditos (`src/pages/Credits.tsx`) -- layout simplificado

Mudancas:

- Remover o wrapper `Card` do saldo -- exibir saldo de forma mais direta e limpa
- Manter texto de posicionamento
- Adicionar frase "Os seus creditos nao vencem e podem ser usados a qualquer momento" junto ao saldo
- Historico de compras: manter como lista simples sem card wrapper pesado
- Secao de upgrades: tornar menos "card-like", mais lista/texto simples
- Reduzir padding e espacamento geral para visual mais compacto/mobile

## 3. Pagina de Checkout (`src/pages/CreditsCheckout.tsx`) -- layout single-column + combos

Mudancas principais:

- Mudar layout de 2 colunas (lg:grid-cols-5) para **single column** -- mais mobile-friendly
- Pacotes avulsos: exibir em lista vertical simples (1 coluna) em vez de grid 2x2
- Adicionar separador visual e secao "Planos mensais" abaixo dos pacotes avulsos, listando os combos
- Checkout (email + PIX) aparece abaixo do pacote selecionado, inline, sem sidebar
- Remover info box "Como funcionam os creditos" e mover texto para subtitulo simples
- Adicionar texto "Os seus créditos não expiram e podem ser usados a qualquer momento" na descricao

Fluxo:

1. Usuario ve lista de pacotes avulsos (Select 2k, 5k, 10k, 15k)
2. Abaixo, ve secao "Planos mensais" com os 2 combos
3. Seleciona qualquer um
4. Formulario de email + botao PIX aparece abaixo
5. Gera PIX, mostra QR code

## 4. Separacao visual avulsos vs combos

Na pagina de checkout, os pacotes serao separados em 2 grupos:

- **Pacotes avulsos** (sort_order 1-9): "Creditos avulsos"
- **Planos mensais** (sort_order >= 10): "Planos mensais"

Isso sera feito com um simples filter no array de packages retornado pelo hook.

## Detalhes tecnicos

### Migration SQL

```sql
INSERT INTO gallery_credit_packages (name, credits, price_cents, description, sort_order, active)
VALUES 
  ('Studio Pro + Select 2k', 2000, 4490, 'Integre selecao com gestao completa. Controle clientes, orcamentos, agenda e fluxo de trabalho em um unico sistema. Plano mensal.', 10, true),
  ('Studio Pro + Select 2k + Transfer 20GB', 2000, 6490, 'Gestao, selecao e armazenamento integrados. Mais controle, mais seguranca e uma operacao profissional do inicio ao fim. Plano mensal.', 11, true);
```

### `src/pages/Credits.tsx`

- Remover Card wrapper do saldo -- usar div simples com border
- Adicionar "Seus creditos nao vencem e podem ser usados a qualquer momento" como subtexto
- Simplificar secao de upgrades para texto + botao, sem Card com border-dashed
- Layout mais compacto, menos spacing

### `src/pages/CreditsCheckout.tsx`

- Mudar de `lg:grid-cols-5` para layout single-column (`max-w-lg mx-auto`)
- Pacotes em lista vertical: cada pacote como linha horizontal (nome | creditos | preco) em vez de card grande
- Separar com heading: "Creditos avulsos" e "Planos mensais"
- Seção de checkout (email + PIX) renderiza inline abaixo quando pacote selecionado
- Mover texto de creditos nao expirarem para subtitulo da pagina

### `src/hooks/useCreditPackages.ts`

Sem mudancas -- o hook ja retorna todos os pacotes ativos ordenados por sort_order.

## Arquivos modificados


| Arquivo                         | Mudanca                                                             |
| ------------------------------- | ------------------------------------------------------------------- |
| Nova migration SQL              | Inserir 2 pacotes combo                                             |
| `src/pages/Credits.tsx`         | Layout simplificado, menos cards, texto sobre nao vencer            |
| `src/pages/CreditsCheckout.tsx` | Single-column, lista vertical, secao combos, texto sobre nao vencer |
