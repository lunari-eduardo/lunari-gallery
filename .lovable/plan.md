

# Melhorias na Tela de Albums + Capa sem Watermark

## Por que o redesign anterior "não apareceu"

O redesign anterior **foi aplicado** — a tela de senha e a tela de boas-vindas estao com o novo visual. O que os screenshots mostram e a **tela de seleção de albums** (folders), que nao fazia parte do escopo anterior. Essa tela fica em `ClientGallery.tsx` linhas 1612-1679.

## Alterações propostas

### 1. Tela de albums — ajustes visuais

**Arquivo**: `src/pages/ClientGallery.tsx` (linhas 1612-1679)

**Mudanças:**
- Remover "Escolha um album para visualizar" (linha 1639)
- Logo mobile: aumentar de `h-16` para `h-24` (alinhar com outras telas que usam `h-[150px]`)
- Desktop: centralizar os cards com `max-w-2xl mx-auto` quando houver apenas 1 album; manter grid para 2+
- Cards de album: aumentar aspect ratio para `aspect-[3/4]` em desktop (mais destaque), limitar `max-w-md mx-auto` quando for coluna unica

**Logo consistente (todas as telas):**
- Usar as mesmas classes de tamanho do header/welcome: `h-[150px] sm:h-[150px] md:h-40 lg:h-[200px]`

### 2. Capa do album sem watermark — analise de viabilidade

**Situação atual:**
- A capa do album usa `thumb.thumbnailUrl` — que e a versão com watermark burn-in
- O watermark e aplicado nos pixels durante a compressão (Canvas), antes do upload
- Nao existe versão separada da imagem sem watermark no storage

**Proposta viavel:**
- Durante o upload, gerar uma **terceira variante** da imagem: `cover` — comprimida com qualidade baixa (40-50%), resolução pequena (600px), SEM watermark
- Salvar no R2 com path `covers/{photoId}.jpg`
- Gravar o path na tabela `galeria_fotos` (novo campo `cover_url`)
- A tela de albums usa `cover_url` quando disponivel, com fallback para `thumbnailUrl`

**Custo:**
- +1 compressão por foto (leve, 600px)
- +1 upload por foto ao R2
- Armazenamento minimo (~30-50KB por foto)
- Campo novo na tabela

**Proteção:**
- Qualidade muito baixa (40%) impede uso comercial
- Resolução 600px impede impressão
- Sem watermark para estética da capa

**Arquivos impactados:**
- `src/lib/uploadPipeline.ts` — gerar variante cover
- `src/lib/imageCompression.ts` — funcao `compressCover()` sem watermark
- `supabase/functions/r2-upload/index.ts` — aceitar upload de cover
- Nova migração SQL — campo `cover_url` em `galeria_fotos`
- `supabase/functions/gallery-access/index.ts` — retornar `cover_url`
- `src/pages/ClientGallery.tsx` — usar `cover_url` na tela de albums

### 3. Resumo de prioridades

| Prioridade | Item | Complexidade |
|---|---|---|
| Alta | Ajustes visuais (logo, remover texto, centralizar) | Baixa |
| Media | Capa sem watermark (pipeline + storage + DB) | Media-alta |

Recomendo implementar os ajustes visuais imediatamente e a capa sem watermark como segunda etapa, dado que envolve pipeline de upload, edge function e migração.

## Arquivos a editar (etapa 1 — visual)

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientGallery.tsx` | Logo maior no mobile, remover "Escolha um album", centralizar card unico em desktop |

## Arquivos a editar (etapa 2 — cover sem watermark)

| Arquivo | Mudança |
|---|---|
| `src/lib/imageCompression.ts` | Nova funcao `compressCover()` |
| `src/lib/uploadPipeline.ts` | Gerar e enviar variante cover |
| `supabase/functions/r2-upload/index.ts` | Aceitar tipo cover |
| Nova migração SQL | Campo `cover_url` em `galeria_fotos` |
| `supabase/functions/gallery-access/index.ts` | Retornar cover_url |
| `src/pages/ClientGallery.tsx` | Usar cover_url como src da capa |

