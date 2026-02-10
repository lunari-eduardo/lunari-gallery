

# Rotas Proprias e Tela de Edicao para Deliver

## 1. Reestruturacao de Rotas

Atualmente, `/` (Index) renderiza o Dashboard com as tabs Select/Deliver. Vamos criar rotas dedicadas para que cada modo tenha URL propria.

### Novas rotas

| Rota | Componente | Descricao |
|------|------------|-----------|
| `/galleries` | Dashboard (redirect default para select) | Rota base de galerias |
| `/galleries/select` | Dashboard com tab Select ativa | Sub-aba Select |
| `/galleries/deliver` | Dashboard com tab Deliver ativa | Sub-aba Deliver |
| `/deliver/:id` | DeliverDetail (nova) | Tela administrativa de galeria Deliver |
| `/deliver/:id/edit` | DeliverEdit (nova) | Tela de edicao Deliver (fase futura, opcional) |

A rota `/` continuara renderizando `<Index />` que por enquanto redireciona para `/galleries/select`. Futuramente sera a pagina "Inicio".

### Mudancas em `App.tsx`

- Adicionar rotas `/galleries`, `/galleries/select`, `/galleries/deliver`
- Adicionar rota `/deliver/:id` para `DeliverDetail`
- Manter rotas existentes de selecao intactas

### Mudancas em `Layout.tsx`

- Atualizar o link "Galerias" de `/` para `/galleries/select`
- O link ativo deve reconhecer qualquer rota `/galleries/*`

### Mudancas em `Dashboard.tsx`

- Ler a tab ativa da URL (`/galleries/select` ou `/galleries/deliver`)
- Ao trocar de tab, navegar para a rota correspondente via `useNavigate`
- Aceitar prop ou usar `useParams`/`useLocation` para determinar tab ativa

### Mudancas em `Index.tsx`

- Redirecionar para `/galleries/select` em vez de renderizar Dashboard diretamente

### Mudancas em `DeliverGalleryCard.tsx`

- O `onClick` deve navegar para `/deliver/:id` em vez de `/gallery/:id`

## 2. Nova Pagina: DeliverDetail (`src/pages/DeliverDetail.tsx`)

Tela administrativa propria para galerias de entrega, com abas internas.

### Estrutura

```text
<-- Voltar    Nome da Sessao  [Badge Status]     [Publicar] [Excluir]
              Cliente • Data • N fotos

[ Detalhes ] [ Fotos ] [ Acesso & Download ] [ Compartilhamento ]
```

### Aba "Detalhes"

- Cliente (nome, email, telefone) -- somente leitura, com botao editar inline
- Nome da sessao -- editavel inline
- Observacoes internas -- campo de texto livre (novo campo, salva em `configuracoes.notasInternas`)
- Mensagem de boas-vindas -- campo de texto editavel

### Aba "Fotos Entregues"

- Grid de fotos finais (masonry ou grid simples)
- Botao "Adicionar fotos" (abre PhotoUploader com `skipCredits=true`)
- Hover em cada foto: botao remover (usa `deletePhoto` existente)
- Contador total de fotos

### Aba "Acesso & Download"

- Link publico da galeria (com botao copiar)
- Toggle: Publica / Privada com senha
- Campo de senha (quando privada)
- Status de download (sempre ativo para Deliver)
- Data de expiracao (editavel com calendar picker)

### Aba "Compartilhamento"

- Botao "Copiar link da galeria"
- Botao "Enviar por WhatsApp" (abre link whatsapp com mensagem padrao)
- Botao "Enviar por e-mail" (futuro, placeholder)
- Botao "Visualizar como cliente" (abre `/g/:token` em nova aba)
- Mensagem padrao sugerida: "Suas fotos finais estao prontas para download."
- Botao "Publicar entrega" (se status = rascunho)

### Estados do header

- **Rascunho**: Botao "Publicar entrega" visivel, botao "Compartilhar" desabilitado
- **Publicada**: Botao "Compartilhar" ativo, badge "Publicada"
- **Expirada**: Badge "Expirada" vermelho, opcao de reativar (estender prazo)

## 3. Detalhes Tecnicos

### Arquivos novos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/DeliverDetail.tsx` | Pagina administrativa da galeria Deliver |

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Novas rotas `/galleries/*`, `/deliver/:id` |
| `src/pages/Index.tsx` | Redirect para `/galleries/select` |
| `src/pages/Dashboard.tsx` | Ler tab ativa da URL, navegar ao trocar |
| `src/components/Layout.tsx` | Atualizar href "Galerias" para `/galleries/select` |
| `src/components/DeliverGalleryCard.tsx` | onClick navega para `/deliver/:id` |

### Reutilizacao de componentes

- `PhotoUploader` (com `skipCredits=true`) para adicionar fotos
- `DeleteGalleryDialog` para excluir galeria
- `ClientSelect` / `ClientModal` para associar cliente
- `downloadUtils.ts` para funcoes de download
- `getGalleryUrl` para gerar link do cliente
- Hooks: `useSupabaseGalleries` (getGallery, fetchGalleryPhotos, sendGallery, deleteGallery, deletePhoto, updateGallery)

### Publicacao de galeria Deliver

Reutiliza `sendGallery` do hook existente que:
- Gera `public_token`
- Seta `status = 'enviado'`
- Seta `enviado_em` e `prazo_selecao`

### Observacoes internas

Campo novo salvo em `configuracoes.notasInternas` (dentro do JSON existente). Nao requer migracao SQL.

