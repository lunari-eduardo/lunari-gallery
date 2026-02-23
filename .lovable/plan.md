
# Planos e Creditos -- Pagina Unificada

## Resumo

Renomear o menu "Creditos" para "Planos e Creditos" e redesenhar a pagina `/credits` como um hub unificado com dois blocos lado a lado (desktop) ou empilhados (mobile): Gallery Select (creditos) e Gallery Transfer (armazenamento). Design limpo sem cards pesados, bordas sutis, botoes compactos. Planos combo permanecem no final.

---

## 1. Menu -- Renomear item

**Arquivo: `src/components/Layout.tsx`**
- Linha 181: trocar texto "Creditos" por "Planos e Creditos"
- Icone pode trocar de `Camera` para `CreditCard` ou manter (decisao estetica -- vou usar `CreditCard` do lucide para diferenciar de "fotos")

---

## 2. Redesign da pagina `/credits` (Credits.tsx)

**Arquivo: `src/pages/Credits.tsx`** -- reescrever

### Estrutura da pagina

```text
Titulo: "Planos e Creditos"
Subtitulo: "Gerencie seus creditos e armazenamento"

[Grid 2 colunas desktop / 1 coluna mobile]

  BLOCO ESQUERDO                     BLOCO DIREITO
  ┌─────────────────────┐            ┌─────────────────────┐
  │ Logo Gallery Select │            │ Logo Gallery Transfer│
  │                     │            │                     │
  │ Saldo: 1.980        │            │ Armazenamento       │
  │ creditos disponiveis │            │ 0 / 20 GB usados    │
  │                     │            │                     │
  │ [Comprar Creditos]  │            │ Plano: Nenhum       │
  │  (link, nao botao   │            │ [Contratar]         │
  │   largo)            │            │  (link compacto)    │
  │                     │            │                     │
  │ Historico (ultimas  │            │ (futuro: historico  │
  │  3 compras, inline) │            │  de uso)            │
  └─────────────────────┘            └─────────────────────┘

[Bloco Combos -- full width]
  Cresca com uma estrutura completa
  (cards de plano combo, mantidos como estao)
```

### Detalhes visuais

- Sem bordas pesadas: usar `border-b` sutil ou separadores leves entre secoes
- Blocos sem `rounded-lg border` card wrapper. Usar espacamento e tipografia para separar
- Logos Gallery Select e Gallery Transfer no topo de cada bloco (imagens ja existem em `src/assets/`)
- Saldo em texto grande (text-3xl) e cor primary
- Botao "Comprar Creditos" compacto (`size="sm"`, nao full width), navega para `/credits/checkout`
- Botao "Contratar armazenamento" compacto, por enquanto `toast.info('Em breve!')`
- Historico de compras: apenas ultimas 3, sem card wrapper por item, usar lista simples com separadores
- Admin: mostra "Ilimitado" em ambos os blocos

### Bloco Transfer (lado direito)

Por enquanto, dados estaticos:
- Armazenamento: "Sem plano ativo" (texto muted)
- CTA: "Contratar" (botao compacto, toast "Em breve!")
- Futuramente conectara com dados reais de armazenamento

---

## 3. Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/components/Layout.tsx` | Renomear "Creditos" para "Planos e Creditos", trocar icone para CreditCard |
| `src/pages/Credits.tsx` | Reescrever com layout 2 colunas, logos, blocos Select e Transfer, design limpo |

Nenhum arquivo novo. Nenhuma rota nova. A pagina continua em `/credits`.
