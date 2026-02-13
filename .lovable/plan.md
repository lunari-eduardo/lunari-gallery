
# Refinamento do Modal de Compartilhamento

## Resumo

Redesenhar o modal "Compartilhar Galeria" com layout mais compacto e otimizado para desktop. Adicionar preview visual do link (similar a como aparece no WhatsApp) com logo do fotografo, nome da sessao e frase de chamada.

---

## Layout proposto

O modal sera dividido em duas colunas lado a lado:

```text
+----------------------------------------------------------+
|  Compartilhar Galeria                               [X]  |
+---------------------------+------------------------------+
|                           |                              |
|  PREVIEW DO LINK          |  Cliente: Eduardo Valmor     |
|  +---------------------+ |  Tel: (51) 99828-7948        |
|  | [Logo Fotografo]    | |  Prazo: 16 de fev            |
|  | Nome da Sessao      | |                              |
|  | Clique e escolha    | |  Link da Galeria      [copy] |
|  | suas fotos!         | |  gallery.lunarihub.com/g/... |
|  | gallery.lunarihub.. | |                              |
|  +---------------------+ |  Mensagem para o cliente     |
|                           |  +------------------------+  |
|                           |  | Ola Eduardo...         |  |
|                           |  +------------------------+  |
|                           |                              |
|                           |  [Copiar Msg] [WhatsApp]     |
|                           |  [Email - em breve]          |
+---------------------------+------------------------------+
```

---

## Mudancas

### Arquivo: `src/components/SendGalleryModal.tsx`

**Props**: Nenhuma mudanca nas props (settings ja contem `studioLogo`).

**Layout**:
- Reduzir `sm:max-w-2xl` para `sm:max-w-3xl` (mais largo mas com conteudo compacto em 2 colunas)
- Substituir layout vertical `space-y-6` por `grid grid-cols-[280px_1fr] gap-6`
- Coluna esquerda: Preview visual do link compartilhado
- Coluna direita: Info do cliente + link + mensagem + botoes

**Coluna esquerda -- Preview do Link**:
- Card visual simulando como o link aparece no WhatsApp/redes sociais
- Mostrar logo do fotografo (`settings.studioLogo`) centralizado no topo do card
- Se nao houver logo, mostrar icone placeholder (Camera)
- Abaixo: nome da sessao (`gallery.nomeSessao`) em negrito
- Abaixo: frase "Clique e escolha suas fotos!"
- Abaixo: dominio `gallery.lunarihub.com` em texto pequeno/muted
- Estilo: borda, fundo `bg-muted/50`, cantos arredondados -- simulando OG card

**Coluna direita -- compactada**:
- Info do cliente: inline (nome, telefone, prazo em uma linha)
- Link: campo + botao copiar (menor, `h-10`)
- Mensagem: area com `max-h-[150px]`
- Botoes: `Copiar Mensagem` e `WhatsApp` lado a lado em `grid-cols-2`, email abaixo menor

---

## Detalhes tecnicos

### Preview card do link (coluna esquerda)

```text
<div className="flex flex-col items-center justify-center p-6 rounded-xl border bg-muted/30 h-full">
  {settings.studioLogo ? (
    <img src={settings.studioLogo} alt="Logo" className="h-16 max-w-[180px] object-contain mb-4" />
  ) : (
    <Camera className="h-10 w-10 text-muted-foreground mb-4" />
  )}
  <h3 className="font-semibold text-base text-center">
    {gallery.nomeSessao || 'Sessao de Fotos'}
  </h3>
  <p className="text-sm text-muted-foreground mt-1">
    Clique e escolha suas fotos!
  </p>
  <span className="text-xs text-muted-foreground/60 mt-3">
    gallery.lunarihub.com
  </span>
</div>
```

### Botoes lado a lado

```text
<div className="grid grid-cols-2 gap-2">
  <Button Copiar (outline, h-10) />
  <Button WhatsApp (terracotta, h-10) />
</div>
<Button Email disabled (outline, h-9, text-sm) />
```

### Info do cliente compacta

Remover o card grande com avatar. Usar uma linha simples:

```text
<div className="flex items-center gap-3 text-sm">
  <span className="font-medium">{clienteNome}</span>
  <span className="text-muted-foreground">{formattedPhone}</span>
  <span className="text-muted-foreground">Ate {prazo}</span>
</div>
```

---

## Arquivo modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/SendGalleryModal.tsx` | Redesign completo: 2 colunas, preview de link, layout compacto |

Nenhum outro arquivo precisa ser modificado -- as props e dados ja existentes sao suficientes.
