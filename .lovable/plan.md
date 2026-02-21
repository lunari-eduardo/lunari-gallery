# Estruturação dos Planos Gallery Select

## Resumo

Atualizar os pacotes de creditos no banco de dados, redesenhar a pagina de creditos e checkout com o novo posicionamento, e simplificar o checkout para apenas PIX por enquanto. Adicionar secao de upgrades (Studio e plano completo) na pagina de creditos.

## 1. Atualizar pacotes no banco de dados

Migration SQL para atualizar os 4 pacotes existentes com novos nomes, precos e descricoes:


| Pacote atual        | Novo nome  | Creditos   | Preco antigo | Novo preco            |
| ------------------- | ---------- | ---------- | ------------ | --------------------- |
| Starter (2.000)     | Select 2k  | 2.000      | R$ 19,00     | R$ 19,90 (1990 cents) |
| Basic (5.000)       | Select 5k  | 5.000      | R$ 39,00     | R$ 39,90 (3990 cents) |
| Pro (10.000)        | Select 10k | 10.000     | R$ 69,00     | R$ 69,90 (6990 cents) |
| Enterprise (20.000) | Select 15k | **15.000** | R$ 99,00     | R$ 94,90 (9490 cents) |


O ultimo pacote muda de 20.000 para 15.000 creditos.

Descricoes atualizadas com o texto estrategico fornecido.

## 2. Redesenhar pagina de Creditos (`src/pages/Credits.tsx`)

- Manter saldo atual no topo
- Adicionar texto de posicionamento: "O Gallery Select organiza e valoriza a seleção das fotos. Mais controle para você, mais clareza para seu cliente."
- Manter historico de compras
- Adicionar secao "Leve seu Gallery para o proximo nivel" no final com:
  - Upgrade 1: Studio Pro + Gallery Select 2k (R$ 44,90/mes) com descricao
  - Upgrade 2: Studio Pro + Select 2k + Transfer 20GB (R$ 64,90/mes) com descricao
  - Botoes discretos: "Conhecer Studio" e "Ver plano completo"
  - Estilo sutil, sem destaque agressivo

## 3. Simplificar Checkout para PIX (`src/pages/CreditsCheckout.tsx`)

- Remover a aba de cartao de credito (Tabs com PIX/Cartao)
- Manter apenas o fluxo de PIX
- Remover import de `CardPaymentForm`
- O checkout fica: selecionar pacote -> informar email -> gerar PIX
- Manter a referencia "Pagamento seguro via Mercado Pago"

## 4. Atualizar cards de pacotes no checkout

Os cards ja leem do banco, entao os novos nomes/precos/descricoes serao refletidos automaticamente apos a migration.

## Detalhes tecnicos

### Migration SQL

```sql
UPDATE gallery_credit_packages
SET name = 'Select 2k',
    credits = 2000,
    price_cents = 1990,
    description = 'Para quem esta comecando a organizar suas selecoes de forma profissional.',
    updated_at = NOW()
WHERE sort_order = 1;

UPDATE gallery_credit_packages
SET name = 'Select 5k',
    credits = 5000,
    price_cents = 3990,
    description = 'Para fotografos em crescimento que ja tem volume recorrente.',
    updated_at = NOW()
WHERE sort_order = 2;

UPDATE gallery_credit_packages
SET name = 'Select 10k',
    credits = 10000,
    price_cents = 6990,
    description = 'Pensado para quem ja opera com constancia.',
    updated_at = NOW()
WHERE sort_order = 3;

UPDATE gallery_credit_packages
SET name = 'Select 15k',
    credits = 15000,
    price_cents = 9490,
    description = 'Para fotógrafos que tratam selecao como parte estrategica da experiencia do cliente.',
    updated_at = NOW()
WHERE sort_order = 4;
```

### `src/pages/Credits.tsx`

- Adicionar texto de posicionamento abaixo do header
- Adicionar secao de upgrades no final da pagina:
  - Dois cards lado a lado (desktop) ou empilhados (mobile)
  - Card 1: "Integracao com Lunari Studio" - R$ 44,90/mes
  - Card 2: "Estrutura Profissional Completa" - R$ 64,90/mes
  - Botoes com `variant="outline"` (discretos)
  - Os botoes nao terao acao funcional agora (apenas `toast.info("Em breve")` ou link externo futuro)

### `src/pages/CreditsCheckout.tsx`

- Remover `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` do checkout
- Remover import de `CardPaymentForm`
- Remover import de `CreditCard` icon
- Manter o fluxo direto: email + botao "Gerar PIX"
- Manter `PixPaymentDisplay` para o QR code

## Arquivos modificados


| Arquivo                         | Mudanca                                            |
| ------------------------------- | -------------------------------------------------- |
| Nova migration SQL              | Atualizar nomes, precos e descricoes dos 4 pacotes |
| `src/pages/Credits.tsx`         | Texto de posicionamento + secao de upgrades        |
| `src/pages/CreditsCheckout.tsx` | Remover aba de cartao, manter apenas PIX           |
