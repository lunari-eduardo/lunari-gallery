
# Correcoes no Modal de Compartilhamento e Controle de Status

## Problema 1: Links diferentes no modal

O campo "Link da Galeria" mostra o link correto (`gallery.lunarihub.com/g/...`), mas a mensagem usa o link OG da Supabase (`supabase.co/functions/v1/gallery-og?token=...`). A variavel `messageLink` usa `ogLink` como prioridade, quando deveria usar `clientLink`.

**Solucao**: Usar `clientLink` em todos os lugares. O link OG e util apenas para previews de WhatsApp, mas a mensagem de texto do usuario deve conter o link limpo de producao. O WhatsApp automaticamente gera preview ao detectar o link.

**Arquivo**: `src/components/SendGalleryModal.tsx`
- Remover a variavel `ogLink` e `messageLink`
- Usar `clientLink` diretamente no template de mensagem
- Transformar a secao "Link da Galeria" em um unico botao "Copiar Link" (remover o campo de texto com o link)

## Problema 2: Modal estreito e nao responsivo

**Arquivo**: `src/components/SendGalleryModal.tsx`
- Aumentar largura: de `sm:max-w-lg` para `sm:max-w-2xl`
- Mobile: usar `max-h-[90vh] overflow-y-auto` no conteudo
- Botoes de acao: `grid-cols-1 sm:grid-cols-2` para empilhar no mobile

## Problema 3: Galeria marcada como "enviada" logo apos criacao

Atualmente, o fluxo de criacao chama `sendGallery()` automaticamente no ultimo passo (GalleryCreate.tsx, linha 620). Isso:
1. Muda status para `enviado`
2. Registra acao `enviada` no historico
3. Gera o `public_token`

Mas o usuario nunca "enviou" ao cliente -- apenas criou a galeria. O status deveria ser `criada` ate que o usuario explicitamente clique em "Compartilhar" e envie o link.

**Solucao em 2 partes**:

### Parte A: Separar "publicar" de "enviar" (`src/hooks/useSupabaseGalleries.ts`)

Criar uma nova funcao `publishGallery` que:
- Gera o `public_token` (para o link funcionar)
- Define o prazo de selecao
- Muda status para `publicada` (novo status intermediario, ou manter `rascunho` com token)
- NAO registra acao de `enviada`

Na verdade, a solucao mais simples e: **manter a chamada a `sendGallery` no create, mas mudar o status para um valor que represente "criada/publicada mas nao enviada"**.

Como o sistema ja tem o status `rascunho` (pre-criacao) e `enviado` (pos-envio), a melhor abordagem e:
1. No `GalleryCreate`, ao finalizar, chamar uma nova funcao `publishGallery` que gera o token e define `status = 'publicada'` (pronta para compartilhar, mas nao enviada)
2. O botao "Compartilhar" no `GalleryDetail` continua abrindo o modal
3. Dentro do modal, ao clicar em WhatsApp ou Copiar Mensagem, registrar a acao `enviada` e mudar o status para `enviado`

### Parte B: Implementar `publishGallery` e ajustar fluxo

**Arquivo**: `src/hooks/useSupabaseGalleries.ts`
- Nova mutation `publishGallery`: gera token, status `rascunho` mantido (ou novo status), prazo calculado, SEM acao `enviada`
- Ajustar `sendGallery`: so muda para `enviado` e registra acao se status atual nao for ja `enviado`

**Arquivo**: `src/pages/GalleryCreate.tsx`
- Trocar `sendSupabaseGallery()` por `publishGallery()` no step final

**Arquivo**: `src/components/SendGalleryModal.tsx`
- Ao clicar "WhatsApp" ou "Copiar Mensagem": chamar `onSendGallery()` para registrar o envio real
- Mostrar status correto

**Arquivo**: `src/pages/GalleryDetail.tsx`
- O `handleSendGallery` ja existe e chama `sendSupabaseGallery` -- passar como callback para o modal

### Parte C: StatusBadge e mapeamento

**Arquivo**: `src/pages/GalleryDetail.tsx`
- Adicionar mapeamento `publicada` -> novo display (ex: `'created'` ou novo tipo `'published'`)

**Arquivo**: `src/components/StatusBadge.tsx`
- Verificar se precisa de novo status visual para `publicada`

## Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `src/components/SendGalleryModal.tsx` | Usar `clientLink` na mensagem; remover campo de link e usar botao "Copiar Link"; alargar modal; responsividade mobile; chamar `onSendGallery` ao compartilhar |
| `src/hooks/useSupabaseGalleries.ts` | Nova mutation `publishGallery` (gera token, status rascunho, sem acao enviada); ajustar `sendGallery` para registrar envio real |
| `src/pages/GalleryCreate.tsx` | Trocar `sendSupabaseGallery` por `publishGallery` no step final |
| `src/pages/GalleryDetail.tsx` | Passar `handleSendGallery` ao modal; mapear status `publicada` |
| `src/components/StatusBadge.tsx` | Adicionar status visual para galerias publicadas mas nao enviadas (ex: badge "Criada" em vez de "Enviada") |

## Fluxo resultante

```text
Criar galeria --> status: rascunho --> upload fotos --> publishGallery() --> status: rascunho (com token gerado)
                                                                            Badge: "Criada"
                                                                            Historico: "Galeria criada"

Usuario clica "Compartilhar" --> Abre modal --> Clica WhatsApp/Copiar --> sendGallery() --> status: enviado
                                                                                           Badge: "Enviada"
                                                                                           Historico: + "Galeria enviada para o cliente"
```
