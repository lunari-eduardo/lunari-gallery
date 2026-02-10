
# Plano: Galeria de Entrega -- Experiencia do Cliente

## Principio

A Galeria de Entrega e um produto diferente com layout, fluxo e componentes proprios. Nenhum componente da galeria de selecao sera reutilizado para a visualizacao do cliente.

## Experiencia do Cliente

```text
Cliente clica no link --> /g/:token

gallery-access Edge Function identifica tipo='entrega'
  --> retorna { deliver: true, ... }

Frontend detecta flag 'deliver'
  --> renderiza <ClientDeliverGallery /> em vez de <ClientGallery />
```

### Tela: Capa (Hero)

- Primeira foto da galeria como imagem de fundo em tela cheia
- Nome do fotografo/estudio no topo (discreto, sobre a imagem)
- Nome da sessao centralizado com fonte escolhida pelo fotografo
- Botao "Ver Galeria" com scroll suave para a area de fotos
- Barra inferior fixa: nome da sessao + nome do estudio + botao "Entrar"

### Tela: Galeria de Fotos

- Header limpo: logo do estudio + nome da sessao + contagem de fotos + data de expiracao (discreto)
- Botao "Baixar Todas" no topo
- Grid masonry de fotos grandes, sem overlays, sem icones de selecao
- Hover em cada foto: icone de download discreto no canto inferior
- Lightbox simplificado: apenas navegacao + botao de download (sem selecao, favoritos, comentarios)

### Modal de Boas-Vindas

- Exibido automaticamente na primeira visita
- Mostra a mensagem configurada pelo fotografo na Etapa 3 da criacao
- Botao "Continuar" para fechar

## Arquitetura de Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/ClientDeliverGallery.tsx` | Pagina principal (roteamento, fetch, estado) |
| `src/components/deliver/DeliverHero.tsx` | Capa hero com foto de fundo |
| `src/components/deliver/DeliverHeader.tsx` | Header limpo da galeria |
| `src/components/deliver/DeliverPhotoGrid.tsx` | Grid masonry com hover de download |
| `src/components/deliver/DeliverLightbox.tsx` | Lightbox simplificado (sem selecao) |
| `src/components/deliver/DeliverWelcomeModal.tsx` | Modal de boas-vindas |

## Detalhes Tecnicos

### 1. Edge Function `gallery-access/index.ts` -- Suporte ao tipo `entrega`

Quando `gallery.tipo === 'entrega'`, retornar um payload diferente:

```text
{
  deliver: true,
  gallery: {
    id, sessionName, clientName,
    welcomeMessage, expirationDate,
    coverPhoto (primeira foto),
    settings: { sessionFont, titleCaseMode }
  },
  photos: [ { id, storage_key, original_path, original_filename, width, height } ],
  studioSettings: { studio_name, studio_logo_url },
  theme: { backgroundMode, ... }
}
```

A logica de galeria de entrega NAO passa por verificacao de `status_selecao`, pois nao ha fluxo de selecao. Apenas verifica:
- Galeria existe (pelo token)
- Senha (se privada)
- Prazo nao expirado

### 2. Roteamento em `ClientGallery.tsx`

O componente `ClientGallery.tsx` existente continuara como ponto de entrada para `/g/:token`. Apos o fetch da Edge Function, se `response.deliver === true`, renderiza `<ClientDeliverGallery />` passando os dados. Nenhuma logica de selecao e carregada.

### 3. `ClientDeliverGallery.tsx` -- Pagina Principal

- Recebe dados ja carregados (nao faz fetch proprio)
- Gerencia estado: `showWelcome`, `lightboxIndex`, download progress
- Renderiza: Hero --> Header --> Grid --> Lightbox --> WelcomeModal
- Tematizacao: aplica CSS variables do tema do fotografo (mesmo sistema existente `hexToHsl`)

### 4. `DeliverHero.tsx` -- Capa

- Foto de capa: primeira foto da galeria (`photos[0]`) como `background-image` cobrindo viewport
- Overlay escuro gradiente para legibilidade do texto
- Nome do estudio no topo
- Titulo da sessao centralizado com fonte personalizada
- Botao "Ver Galeria" com animacao de scroll
- Chevron animado apontando para baixo

### 5. `DeliverPhotoGrid.tsx` -- Grid

- Masonry layout via CSS Columns (reutiliza classes `.masonry-grid` ja existentes)
- Cada foto: `img` com `loading="lazy"`, sem bordas de selecao
- Hover: overlay sutil + icone de download no canto inferior
- Click: abre lightbox
- Botao de download individual por foto (click no icone)

### 6. `DeliverLightbox.tsx` -- Lightbox Simplificado

- Navegacao por setas e swipe
- Zoom (pinch-to-zoom mobile, scroll desktop)
- Botao de download (unica acao disponivel)
- Sem: botao de selecao, favoritar, comentar
- Usa `downloadPhoto()` do `downloadUtils.ts` existente

### 7. `DeliverWelcomeModal.tsx` -- Modal de Boas-Vindas

- Dialog modal com mensagem do fotografo
- Exibido uma vez por sessao (controle via `sessionStorage`)
- Botao "Continuar" fecha o modal

### 8. `DeliverHeader.tsx` -- Header

- Logo do estudio centralizado
- Nome da sessao com fonte customizada
- Contagem de fotos
- Data de expiracao (se definida)
- Botao "Baixar Todas" (usa `downloadAllPhotos()` existente)

### 9. Tela de Senha (reutilizacao parcial)

Para galerias privadas, o `PasswordScreen.tsx` existente pode ser reutilizado pois e generico o suficiente (logo + campo de senha). Apenas o texto "Galeria Protegida" permanece.

## Ordem de Implementacao

1. Atualizar Edge Function `gallery-access` para detectar `tipo='entrega'`
2. Criar componentes em `src/components/deliver/`
3. Criar `ClientDeliverGallery.tsx`
4. Integrar no `ClientGallery.tsx` existente (branch por tipo)
5. Testes visuais

## O Que NAO Muda

- Nenhum componente de selecao e modificado
- `PhotoCard.tsx`, `SelectionSummary.tsx`, `SelectionConfirmation.tsx` nao sao tocados
- A rota `/g/:token` permanece a mesma -- o tipo e resolvido no backend
- O sistema de download (`downloadUtils.ts`) e reutilizado como esta
