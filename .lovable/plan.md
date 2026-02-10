
# Plano: Reorganizar Etapas de Criacao de Galeria

## Resumo das Mudancas

5 modificacoes no fluxo de criacao de galeria em `GalleryCreate.tsx`:

1. **Remover campo "Onde aplicar"** (watermarkDisplay) - remover da UI de criacao e manter valor fixo `'all'`
2. **Nova etapa "Mensagem"** entre "Fotos" e "Revisao" - dedicada apenas a mensagem de saudacao
3. **Mover "Aparencia da galeria" e "Interacoes do cliente"** para dentro da etapa "Configuracoes" (onde antes estava a mensagem)
4. **Mover "Prazo de Selecao"** para a primeira etapa "Cliente"
5. **Ultima fonte usada como padrao** - persistir no banco e carregar como default

## Nova Estrutura de Etapas

```text
ANTES (5 etapas):
1. Cliente (dados + sessao + fonte + pacote)
2. Venda (modo de cobranca + precos)
3. Configuracoes (mensagem + prazo + imagem + watermark + aparencia + interacoes)
4. Fotos (upload)
5. Revisao

DEPOIS (6 etapas):
1. Cliente (dados + sessao + fonte + pacote + PRAZO)
2. Venda (sem mudanca)
3. Configuracoes (imagem + watermark + APARENCIA + INTERACOES) -- sem mensagem, sem prazo
4. Fotos (upload, sem mudanca)
5. Mensagem (NOVA - apenas mensagem de saudacao)
6. Revisao
```

## Detalhes Tecnicos

### 1. Remover "Onde aplicar" (watermarkDisplay)

**Arquivo**: `src/pages/GalleryCreate.tsx`

- Remover linhas 1512-1525 (bloco do Select "Onde aplicar")
- Manter `watermarkDisplay` fixo em `'all'` (valor ja inicializado na linha 184)
- O campo continua sendo salvo no banco como `'all'` - sem impacto em galerias existentes
- NAO remover de `types/gallery.ts` pois outras partes do sistema ainda usam

### 2. Nova etapa "Mensagem" (step 5)

**Arquivo**: `src/pages/GalleryCreate.tsx`

- Alterar array `steps` (linhas 70-90): adicionar `{ id: 5, name: 'Mensagem', icon: MessageSquare }` e mudar Revisao para `id: 6`
- Adicionar `case 5` no renderStep com apenas o Textarea da mensagem de saudacao
- Atualizar `handleNext` para criar galeria no step 4 (em vez de step 3 => agora step 3 nao precisa criar galeria, step 4 "Fotos" sim)
- Ajustar validacao final: `currentStep < 6` e step final = 6

### 3. Mover Aparencia e Interacoes para step 3

No `case 3` (Configuracoes), remover bloco de mensagem e prazo. Manter:
- Tamanho das imagens
- Watermark (sem "Onde aplicar")
- Aparencia da galeria (tema) -- movido do final do bloco direito
- Interacoes do cliente -- movido do final do bloco direito

A mensagem sai daqui e vai para o novo step 5.

### 4. Mover Prazo para step 1

No `case 1` (Cliente), adicionar o bloco de prazo (campo numerico + texto "dias") apos "Fotos Incluidas no Pacote", antes de "Fonte do Titulo".

Remover prazo do step 3.

### 5. Persistir ultima fonte usada

**Banco**: Adicionar coluna `last_session_font` (text, nullable) na tabela `gallery_settings`

**Arquivo**: `src/hooks/useGallerySettings.ts`
- Adicionar mapeamento `lastSessionFont` no `rowsToSettings` e `updateSettings`

**Arquivo**: `src/types/gallery.ts`
- Adicionar `lastSessionFont?: string` em `GlobalSettings`

**Arquivo**: `src/pages/GalleryCreate.tsx`
- Na inicializacao (useEffect settings), setar `setSessionFont(settings.lastSessionFont || 'playfair')`
- Ao finalizar/salvar (handleNext final e handleSaveDraft), chamar `updateSettings({ lastSessionFont: sessionFont })`

### Ajuste de handleNext

A logica de criar galeria Supabase precisa ser ajustada:
- Antes: criava no step 3 -> step 4 (antes de "Fotos")
- Depois: criar no step 3 -> step 4 (antes de "Fotos", mesma posicao, mas step 3 agora e "Configuracoes")
- O check `currentStep === 3` continua correto pois step 4 continua sendo "Fotos"

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/GalleryCreate.tsx` | Reorganizar etapas, remover "Onde aplicar", nova etapa mensagem, mover prazo |
| `src/hooks/useGallerySettings.ts` | Persistir `lastSessionFont` |
| `src/types/gallery.ts` | Adicionar `lastSessionFont` a `GlobalSettings` |
| Migracao SQL | Adicionar coluna `last_session_font` |

### Sem mudancas em

- Edge Functions (nenhuma afetada)
- Worker Cloudflare (nenhuma afetada)
- Componentes de galeria do cliente (nenhuma afetada)
- `watermarkDisplay` no tipo -- mantido para compatibilidade
