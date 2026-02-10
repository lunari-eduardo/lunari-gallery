
# Plano: Produto Deliver (Entrega Final)

## Visao Geral

Adicionar um novo produto "Deliver" ao sistema Gallery. Galerias de entrega permitem que fotografos enviem fotos em alta resolucao para download direto pelo cliente, sem fluxo de selecao, sem creditos, e com prazo de expiracao.

## Arquitetura

### Diferenca entre Selecao vs Entrega

| Aspecto | Selecao (existente) | Entrega (novo) |
|---------|---------------------|----------------|
| Tipo | `selecao` | `entrega` |
| Creditos | Consome creditos | Nao consome |
| Watermark | Configuravel | Sem watermark |
| Download | Opcional | Sempre ativo |
| Previews | 1024/1920/2560px | 2560px fixo |
| Selecao | Cliente seleciona fotos | Nao ha selecao |
| Venda | Configuravel | Nao ha venda |
| Cliente | Obrigatorio | Opcional |
| Pacote | Configuravel | Nao se aplica |

### Fluxo do Usuario

```text
"Nova Galeria" (nav)
      |
      v
  Popover flutuante
  +-----------------+
  | Selecao         |
  | Entrega         |
  +-----------------+
      |
  Selecao --> /gallery/new (existente)
  Entrega --> /deliver/new (nova pagina)
```

## Mudancas por Arquivo

### 1. Migracao SQL - Nova coluna `tipo` na tabela `galerias`

Adicionar coluna `tipo TEXT NOT NULL DEFAULT 'selecao'` na tabela `galerias`. Valores possiveis: `'selecao'` e `'entrega'`. Todas as galerias existentes serao automaticamente `'selecao'`.

### 2. `src/components/Layout.tsx` - Menu "Nova Galeria" com Popover

Substituir o link direto "Nova Galeria" por um botao com Popover que mostra duas opcoes:
- **Selecao** - navega para `/gallery/new`
- **Entrega** - navega para `/deliver/new`

Usar o componente Popover existente do Radix UI.

### 3. `src/pages/Dashboard.tsx` - Botao "Nova Galeria" com Popover

Mesmo tratamento do Layout: substituir o botao que navega direto para `/gallery/new` por um Popover com as duas opcoes.

### 4. `src/pages/DeliverCreate.tsx` - Nova pagina de criacao

Pagina com 3 etapas (steps):

**Etapa 1 - Dados:**
- Cliente (opcional, usando ClientSelect existente + ClientModal)
- Nome da sessao (titulo da galeria, obrigatorio)
- Permissao: Publica ou Privada (com senha)
- Prazo de expiracao em dias

**Etapa 2 - Fotos:**
- Reutiliza o componente `PhotoUploader` existente
- Configuracoes fixas: `maxLongEdge=2560`, sem watermark, `allowDownload=true`
- Nao consome creditos (passara flag para o uploader)

**Etapa 3 - Mensagem:**
- Campo de texto para mensagem de boas-vindas
- Sera exibida em modal quando o cliente acessar a galeria
- Botao de revisao rapida e publicacao

### 5. `src/hooks/useSupabaseGalleries.ts` - Suporte ao tipo `entrega`

- Adicionar campo `tipo` ao `CreateGaleriaData`
- Passar `tipo` no insert do `createGaleria`
- Adicionar `tipo` ao transform e interface `Galeria`

### 6. `src/App.tsx` - Nova rota

Adicionar rota `/deliver/new` apontando para `DeliverCreate`.

### 7. `src/components/PhotoUploader.tsx` - Flag `skipCredits`

Adicionar prop opcional `skipCredits?: boolean`. Quando `true`, pula toda a logica de verificacao e consumo de creditos na Edge Function. Enviar flag no payload para o `r2-upload`.

### 8. `supabase/functions/r2-upload/index.ts` - Suporte a `skipCredits`

Quando `skipCredits: true` no body, pular as chamadas a `check_photo_credits` e `consume_photo_credits`. A validacao de permissao (usuario autenticado + dono da galeria) continua igual.

### 9. `src/integrations/supabase/types.ts` - Atualizar tipos

Refletir a nova coluna `tipo` nos tipos gerados.

## Etapas de Implementacao (ordem)

1. Migracao SQL (coluna `tipo`)
2. Tipos TypeScript atualizados
3. Hook `useSupabaseGalleries` com suporte a `tipo`
4. Pagina `DeliverCreate.tsx` (3 etapas)
5. Layout + Dashboard (popover "Nova Galeria")
6. Rota no App.tsx
7. PhotoUploader + Edge Function (flag `skipCredits`)

## Observacoes

- A visualizacao client-side da galeria de entrega (como o cliente ve) sera implementada em uma fase seguinte, reutilizando o `ClientGallery` com adaptacoes para o tipo `entrega`.
- Planos de armazenamento serao configurados posteriormente conforme mencionado.
- A listagem no Dashboard mostrara ambos os tipos, com badge visual diferenciando "Selecao" de "Entrega".
