

# Reestruturacao Completa -- Pagina Gallery Deliver

## Resumo

Reduzir de 4 abas para 3, eliminar duplicidades, reduzir cards largos, e reorganizar o conteudo para um fluxo logico e moderno.

---

## Mudancas estruturais

### Abas: de 4 para 3

```text
ANTES: Detalhes | Fotos | Acesso & Download | Compartilhamento
DEPOIS: Compartilhamento | Fotos | Detalhes
```

A aba "Acesso & Download" e removida. Seu conteudo (privacidade, expiracao) migra para "Detalhes".

### Aba padrao: Compartilhamento (primeira)

---

## Aba 1 -- Compartilhamento

Conteudo:

1. **Linha de acoes horizontais** (botoes inline, sem cards grandes):
   - Copiar link
   - WhatsApp
   - E-mail (em breve)
   - Ver como cliente

2. **Campo de mensagem** (sem card wrapper pesado):
   - Label: "Mensagem de compartilhamento"
   - Textarea
   - Texto de apoio: "Essa mensagem sera usada ao compartilhar."

**Removido:**
- Card "Link da galeria" com URL crua e botao copiar (redundante com "Copiar link")

---

## Aba 2 -- Fotos

Sem mudancas estruturais grandes. Ajustes:

- Titulo: "3 fotos entregues" (ja existe)
- Botao "Adicionar fotos" a direita (ja existe)
- No hover de cada foto: icones de **Download** e **Excluir** (hoje so tem Excluir -- adicionar Download)

---

## Aba 3 -- Detalhes

Reorganizado em 2 blocos visuais apenas:

**Bloco 1 -- Informacoes da sessao**
- Nome da sessao (input editavel)
- Cliente (info read-only: nome, email, telefone)
- Observacoes internas (textarea)

**Bloco 2 -- Configuracoes**
- Privacidade: Publica / Privada (switch + campo senha se privada)
- Data de expiracao (date picker)
- Permitir download ZIP (toggle) -- informativo, Deliver sempre permite download individual

**Removido de Detalhes:**
- Campo "Mensagem de boas-vindas" (movido para Compartilhamento como "Mensagem de compartilhamento")

---

## Header (pequeno refino)

- Nome da sessao: `font-semibold` com peso maior
- Badge de status: discreto (ja esta ok)
- Meta info: linha menor, `text-sm text-muted-foreground`
- Botoes: Salvar (outline) + Excluir (danger) -- hierarquia correta, ja existe

---

## Hierarquia visual

- Remover `rounded-xl` dos containers internos, usar `rounded-lg`
- Reduzir uso de `border bg-card` wrapper (usar divisores sutis onde possivel)
- Mais espaco vertical entre secoes
- Maximo 2 blocos visuais por aba

---

## Arquivo modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/DeliverDetail.tsx` | Reescrever estrutura de abas, mover conteudo, remover duplicidades, adicionar download por foto |

## Detalhes tecnicos

### Tabs

```text
<Tabs defaultValue="share">
  <TabsTrigger value="share">Compartilhamento</TabsTrigger>
  <TabsTrigger value="photos">Fotos</TabsTrigger>
  <TabsTrigger value="details">Detalhes</TabsTrigger>
</Tabs>
```

### Compartilhamento -- remocao do card de link

Remover o bloco inteiro das linhas 437-448 (card com Input readonly + Copy button). Manter apenas os 4 botoes de acao (ja inclui "Copiar link").

### Compartilhamento -- mensagem sem card wrapper

Substituir o `div.p-4.rounded-xl.border.bg-card` por um bloco simples:
```text
<div className="space-y-2">
  <Label>Mensagem de compartilhamento</Label>
  <Textarea ... />
  <p className="text-xs text-muted-foreground">...</p>
</div>
```

### Detalhes -- novo layout com 2 blocos

Bloco 1 (informacoes):
```text
<div className="space-y-6 p-5 rounded-lg border">
  // Nome da sessao (input)
  // Separador sutil
  // Cliente (read-only info)
  // Separador sutil
  // Observacoes internas (textarea)
</div>
```

Bloco 2 (configuracoes):
```text
<div className="space-y-6 p-5 rounded-lg border">
  // Privacidade switch + senha condicional
  // Separador sutil
  // Data de expiracao
  // Separador sutil
  // Download ZIP toggle
</div>
```

### Fotos -- download individual

Adicionar botao de download ao lado do botao de excluir no hover overlay:
```text
<a href={getPhotoUrl({ storageKey: photo.storageKey }, 'original')} download>
  <Button variant="secondary" size="icon"><Download /></Button>
</a>
<Button variant="destructive" size="icon" onClick={...}>
  <Trash2 />
</Button>
```

### Estado do campo welcomeMessage

O campo `welcomeMessage` continua sendo salvo no banco como `mensagemBoasVindas`. Apenas muda de aba (de Detalhes para Compartilhamento) e de label (de "Mensagem de boas-vindas" para "Mensagem de compartilhamento"). O `handleSave` continua enviando `mensagemBoasVindas: welcomeMessage` -- sem mudanca na logica de persistencia.

