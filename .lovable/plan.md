

# Redesign: Telas de Senha e Boas-vindas do Cliente

## Problemas identificados

1. **Tela de senha**: Linguagem fria ("Galeria Protegida"), ícone de cadeado grande, microcopy juridiquês
2. **Tela de boas-vindas**: Fallback genérico hardcoded na linha 344 (`'Olá {cliente}! Bem-vindo...'`) — mesmo quando o fotógrafo desativa a mensagem, o cliente vê texto genérico
3. **Visual**: Cards com sombras, ícones em círculos coloridos, botões gigantes — não condiz com a proposta minimalista

## Alterações

### 1. `PasswordScreen.tsx` — Redesign completo

**Mudanças visuais e de copy:**
- Título: `"Galeria Protegida"` → `"Sua galeria está pronta"`
- Subtítulo emocional: `"Conteúdo exclusivo da sua sessão fotográfica."`
- Microcopy: `"A senha foi enviada pelo fotógrafo junto com o link."` → `"Digite a senha enviada para acessar sua sessão."`
- Remover círculo colorido com ícone de cadeado (substituir por um ícone pequeno e discreto inline, ou remover completamente)
- Input com bordas retas, sem rounded excessivo
- Botão com estilo limpo, sem `size="lg"` gigante
- Sem `lunari-card`, sem sombras, sem `bg-primary/10`

### 2. `ClientGallery.tsx` — Tela de boas-vindas (linhas 1420–1515)

**Lógica da mensagem:**
- Linha 344: remover fallback genérico — se `mensagem_boas_vindas` é null/empty, manter como string vazia
- Se `welcomeMessage` está vazio após parse: **não mostrar card de mensagem**; exibir apenas nome da sessão + contagem + botão
- Se `welcomeMessage` tem conteúdo: mostrar em bloco discreto (não card com sombra)

**Mudanças visuais:**
- Remover círculo com ícone `<Image>` (w-20 h-20 bg-primary/10)
- Nome da sessão grande no topo (já existe, manter)
- Contagem de fotos em texto pequeno e discreto abaixo
- Card de mensagem: trocar `lunari-card` por bloco com borda fina superior (`border-t`) — sem sombra, sem rounded
- Info de fotos incluídas e prazo: manter mas com estilo mais fino, sem ícones em círculos
- Botão "Começar Seleção": manter funcional mas com estilo mais contido (sem `size="xl"`)

### 3. Estilo geral aplicado

- Bordas retas (`rounded-none` ou `rounded-sm` máximo)
- Separadores com linhas finas (`border-t border-border/30`)
- Sem blocos com sombras (`shadow-*`)
- Sem círculos coloridos de ícone
- Espaçamento mais arejado
- Tipografia hierárquica (nome grande, detalhes pequenos)

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/PasswordScreen.tsx` | Redesign completo: copy, visual minimalista |
| `src/pages/ClientGallery.tsx` | Remover fallback genérico da welcomeMessage (L344); redesign da tela de boas-vindas (L1420–1515) |

