
# Redesign da Pagina de Criacao de Entrega (DeliverCreate)

## Resumo

Alinhar o fluxo de criacao de galerias de entrega com o fluxo de criacao de galerias de selecao, seguindo o mesmo layout, ordem de campos e largura. Restaurar preview de fonte nos dois criadores. Corrigir posicao dos botoes de navegacao e tamanho do campo de mensagem.

## Mudancas

### 1. Arquivo: `src/pages/DeliverCreate.tsx` -- Reestruturar completamente

**Layout geral (seguir GalleryCreate):**
- Container: `max-w-5xl mx-auto pb-24` (igual ao GalleryCreate, em vez do `max-w-2xl`/`max-w-4xl` atual)
- Step content dentro de `lunari-card p-6 md:p-8` (card unico, como GalleryCreate)
- Botoes de navegacao: **fixos no rodape** com `fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t` (igual GalleryCreate), em vez de inline no fluxo

**Ordem dos campos no Step 1 (seguir a imagem de referencia do GalleryCreate):**
1. Permissao da Galeria (Publica/Privada) -- radio cards em 2 colunas, mesmo estilo do GalleryCreate
2. Cliente (opcional) -- mostrar **apenas quando privada** (como no GalleryCreate)
3. Nome da Sessao + Prazo de Expiracao -- grid de 2 colunas (`grid gap-4 md:grid-cols-2`)
4. Fonte do Titulo -- full width, com preview restaurado
5. Aparencia (Claro/Escuro) -- manter toggle existente

**Campo Cliente quando privada:**
- Mesmo layout do GalleryCreate: flex com ClientSelect + botao "+" ao lado
- Label: "Cliente (opcional)" para entrega (nao obrigatorio como em selecao)

**Remover campos que nao se aplicam (marcados com X nas imagens):**
- Pacote (nao existe em entrega)
- Fotos Incluidas no Pacote (nao existe em entrega)

**Step 3 (Mensagem):**
- Textarea: aumentar `rows` de 5 para 8 e adicionar `min-h-[200px]`
- Os botoes ja serao fixos no rodape (resolvendo o problema de posicao)

### 2. Arquivo: `src/components/FontSelect.tsx` -- Restaurar preview de fonte

O preview box esta vazio (linhas 108-139 sao linhas em branco). Restaurar:

- Caixa de preview com fundo `bg-muted/50 rounded-lg p-4`
- Texto de preview renderizado com a fonte selecionada: `style={{ fontFamily: selectedFont.family }}` com `text-xl`
- Botao de toggle de case mode ao lado do preview (como era antes)
- Estrutura: flex row com preview text ocupando espaco e botao de case toggle no canto

### 3. Resumo das mudancas visuais

| Elemento | Antes | Depois |
|---|---|---|
| Container largura | `max-w-2xl` | `max-w-5xl` |
| Botoes navegacao | Inline, sobem com conteudo | Fixos no rodape da tela |
| Ordem campos Step 1 | Nome > Fonte > Cliente > Permissao > Expiracao > Aparencia | Permissao > Cliente (se privada) > Nome + Expiracao (2 cols) > Fonte > Aparencia |
| Cliente visibilidade | Sempre visivel | Apenas quando privada |
| Preview de fonte | Ausente | Restaurado com texto na fonte selecionada |
| Textarea mensagem | `rows=5` | `rows=8 min-h-[200px]` |
| Step content | Cards separados por secao | Card unico (`lunari-card`) envolvendo tudo |

## Detalhes tecnicos

### FontSelect -- Preview restaurado

```text
[Select dropdown]
[Preview box: "Ensaio Gestante" na fonte selecionada] [Botao Aa toggle]
```

O preview box tera:
- Fundo: `bg-muted/30 rounded-lg p-4`
- Texto com `text-xl md:text-2xl` e `fontFamily` da fonte selecionada
- Ao lado: botao icon com TooltipProvider mostrando o modo atual (Normal/MAIUSCULAS/Inicio De Palavras)

### DeliverCreate -- Navegacao fixa

Replicar exatamente o padrao do GalleryCreate:
```text
fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-40
  max-w-5xl mx-auto px-4 py-4 flex justify-between
    [Voltar]                              [Proximo / Publicar Entrega]
```

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/pages/DeliverCreate.tsx` | Reestruturar layout, ordem, largura, botoes fixos |
| `src/components/FontSelect.tsx` | Restaurar preview box com fonte e toggle case |
