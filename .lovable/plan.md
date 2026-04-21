

# Plano: refinar o checkout transparente Asaas para o padrão premium da imagem 1

## Escopo

Reformular **apenas** `src/components/AsaasCheckout.tsx` para entregar a estética e a UX da primeira imagem. Componente é compartilhado entre cliente final e fotógrafo — então cobre os dois fluxos automaticamente. Nenhuma alteração de fluxo de pagamento, edge function ou webhook.

## Mudanças visuais e de UX

### 1. Header (hierarquia premium)

```text
[logo do studio]
🔒 Ambiente seguro e criptografado    ← novo selo de confiança no topo
Pagamento                             ← título menor
R$ 9,00                               ← valor MUITO maior (text-5xl, primary)
🖼️ 3 fotos extras • Dia das Mães      ← descrição com ícone, em cinza
```

- subir o badge "Ambiente seguro e criptografado" para logo abaixo do logo
- valor em `text-5xl font-bold text-primary` (era `text-3xl`)
- descrição com `Image` lucide icon + separador `•`

### 2. Toggle PIX/Cartão mais visual

- container do `TabsList` em card branco com sombra suave
- aba ativa: fundo bege claro (`bg-primary/10`), texto `primary`, borda inferior sutil
- aba inativa: transparente, texto `muted-foreground`
- ícones aumentados (`h-5 w-5`)
- altura maior (`h-14`)

### 3. Inputs (o ponto central)

Criar uma classe utilitária local `checkoutInputClass`:

```text
border: 1px solid #E5E5E5  (em dark: usa border-input)
hover: borda #D4D4D4
focus: borda primary + ring 2px primary/15 (sem outline preto duplo)
altura: h-12 (era h-10)
padding-left: pl-10 quando tem ícone
texto preenchido: text-foreground (quase preto)
placeholder: text-muted-foreground/60 (mais claro)
```

- adicionar **ícones internos** alinhados à esquerda em cada input (User, FileText, Mail, CreditCard, Calendar, Lock, Phone, MapPin) — padrão da imagem 1
- labels menores: `text-xs font-medium text-muted-foreground` (era `text-sm font-medium`)
- "Telefone (opcional)" — adicionar sufixo cinza no label, reduzir peso visual
- ícone de info (`ⓘ`) ao lado do CVV explicando "3 dígitos no verso"

### 4. Agrupamento por seção

Dentro da aba Cartão, dividir em 3 grupos com subtítulo + ícone (sem caixas):

```text
👤 Dados do titular
   Nome no cartão
   CPF / CNPJ
   Email do titular

💳 Dados do cartão
   Número do cartão
   Validade | CVV

📞 Contato
   Telefone (opcional) | CEP
   Parcelas
```

Subtítulo: `text-sm font-semibold` + ícone primary `h-4 w-4`. Espaço de 24px entre seções, 16px entre inputs.

### 5. Botão de pagamento

- altura `h-12` (era `size="lg"`)
- texto: **"Finalizar pagamento • R$ X,XX"** (era "Pagar R$ X,XX")
- ícone `Lock` antes do texto
- `rounded-lg` (era `rounded-md` padrão)
- transição suave `active:scale-[0.98]` para microinteração
- hover já vem do `variant="terracotta"`

### 6. Selo de segurança no rodapé (substituído)

Atual: "Pagamento criptografado e seguro" pequeno e fraco.

Novo (logo abaixo do botão):
```text
🛡️ Seus dados estão protegidos com segurança de ponta a ponta.
```
- `text-xs text-muted-foreground` centralizado, ícone `ShieldCheck` em primary
- selo do topo já cobre o gatilho de confiança principal

### 7. Botão "Voltar" — mantém ghost no rodapé com `←`

### 8. Auto-foco entre campos (micro UX)

- número do cartão completo (16 dígitos) → foca validade
- validade completa (MM/AA) → foca CVV
- CVV com 3 dígitos → foca telefone
- CPF com 11 dígitos → foca email

Implementar com refs e dispatch `.focus()` dentro do `onChange` quando atinge o tamanho máximo.

### 9. Validação inline suave (preview imediato)

- ao sair do campo (onBlur), se inválido → borda vira `destructive/50` + mensagem mínima abaixo (`text-xs text-destructive`)
- não bloqueia digitação, só sinaliza
- desaparece ao voltar a digitar
- aplicar em: CPF/CNPJ, número do cartão, validade, email

### 10. Espaçamento global

- `space-y-6` entre header → card → tabs → footer (já existe)
- dentro do form: `space-y-6` entre seções, `space-y-4` entre inputs da mesma seção
- container central: `max-w-md` mantido

### 11. Tela PIX (alinhar com mesmo padrão)

- valor grande no topo (igual ao cartão)
- QR code com sombra mais suave e cantos `rounded-2xl`
- bloco "PIX Copia e Cola" com mesmo input style
- "Aguardando pagamento" em pílula bege com loader

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `src/components/AsaasCheckout.tsx` | reestruturação completa do JSX de retorno (linhas 487-662): novo header com selo de segurança; toggle visual; agrupamento por seção; inputs com ícones internos; auto-foco entre campos; validação inline `onBlur`; novo botão "Finalizar pagamento"; selo de segurança final reformulado |
| `src/components/AsaasCheckout.tsx` | adicionar refs `cardNumberRef`, `cardExpiryRef`, `cardCvvRef`, `cardPhoneRef`, `cardEmailRef` e estado local `fieldErrors: Record<string, string>` para validação inline |
| Imports adicionais | `User`, `FileText`, `Mail`, `Calendar`, `Phone`, `MapPin`, `Image as ImageIcon`, `Info` do lucide-react |
| Sem mudanças em | toda lógica de fees, polling, geração de PIX, submit do cartão (`handleCardSubmit`), props da interface, integração com `asaas-gallery-payment`, `check-payment-status`, edge functions, webhooks Asaas, InfinitePay, Mercado Pago, fluxo de reativação, `prepare_gallery_share`, `confirm-selection` |

## Compatibilidade

- mantém props `themeStyles` e `backgroundMode` (suporta dark mode dos fotógrafos)
- mantém todos os `autoComplete` para preenchimento automático do navegador
- mantém validações finais no `handleCardSubmit` — a validação inline é apenas UX preventiva
- usa tokens semânticos do Tailwind (`primary`, `muted-foreground`, `destructive`, `border`) — sem cores hardcoded fora do design system

## Validação

1. abrir um pagamento de galeria como cliente → deve replicar imagem 1 (selo no topo, valor grande, agrupamento, ícones nos inputs, botão "Finalizar pagamento • R$ X,XX")
2. abrir como fotógrafo (dark mode) → cores adaptam mantendo a estrutura
3. preencher número do cartão completo → cursor pula para validade automaticamente
4. digitar CPF inválido e sair do campo → borda fica vermelha + mensagem inline
5. trocar de PIX para Cartão → toggle ativo bege visível
6. PIX continua funcionando: gera QR, copia, polling confirma
7. cartão continua funcionando: parcela, calcula taxa, submete, polling confirma
8. mobile (375px): inputs e ícones se mantêm legíveis
9. `npm run build` sem erros TS

## Resultado esperado

Checkout Asaas com a estética premium da imagem 1: selo de confiança no topo, hierarquia clara do valor, agrupamento mental por seção, inputs com ícones e foco suave em primary, botão de finalização decisivo e micro UX (auto-foco, validação inline) que reduz fricção e aumenta conversão. Nenhum impacto em integrações de pagamento.

