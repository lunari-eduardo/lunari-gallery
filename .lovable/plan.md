

## Padronizar Design da aba Pagamentos

### Problema
A aba **Pagamentos** usa o componente `<Card>` (com `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`) que gera um visual diferente das abas **Geral** e **Personalização**, que usam `lunari-card` (alias para `.glass`) com headings simples e ícones.

### Solução
Substituir todos os `<Card>` em `PaymentSettings.tsx` pelo padrão `lunari-card` usado nas demais abas, com header usando ícone + título + descrição em `div`, sem os sub-componentes do Card.

### Alterações

**`src/components/settings/PaymentSettings.tsx`** — Refatorar 4 blocos de Card:

1. **Card "Métodos de Pagamento Ativos"** (linhas 198-284): Trocar `<Card>/<CardHeader>/<CardTitle>/<CardDescription>/<CardContent>` por `<div className="lunari-card p-6 space-y-4">` com header ícone+texto como nas outras abas.

2. **Card "Mercado Pago"** (linhas 287-479): Mesmo padrão — `lunari-card p-6 space-y-4` com heading simples.

3. **Card "PIX Manual"** (linhas 484-590): Mesmo padrão.

4. **Card "InfinitePay"** (linhas 595-715): Mesmo padrão.

Também remover os `<Separator />` (linhas 481, 592) pois o espaçamento entre `lunari-card` já cria separação visual natural, assim como nas outras abas.

Remover imports não utilizados: `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Separator`.

### Padrão visual alvo (mesmo das outras abas)
```text
<div className="lunari-card p-6 space-y-4">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div>
      <h2 className="font-medium">Título</h2>
      <p className="text-sm text-muted-foreground">Descrição</p>
    </div>
  </div>
  {/* conteúdo */}
</div>
```

### Segurança
- Nenhuma alteração em lógica, mutations, edge functions ou fluxo OAuth
- Edge functions de InfinitePay e Mercado Pago permanecem intactas

