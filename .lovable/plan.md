

# Mensagem Padrao Global + Correcao de Slugs {estudio} e {cliente}

## Problemas identificados

### 1. Slug `{estudio}` hardcoded como "Studio Lunari"
Em `src/pages/ClientGallery.tsx` (linha 905), o slug `{estudio}` esta fixo:
```
.replace('{estudio}', 'Studio Lunari');
```
Deveria usar o nome real do estudio vindo do backend: `galleryResponse?.studioSettings?.studio_name`

### 2. Slug `{cliente}` parcialmente correto
O `{cliente}` usa `gallery.clientName.split(' ')[0]` (primeiro nome). A logica esta funcional, mas depende de `clientName` estar preenchido na galeria. Quando nao ha cliente, retorna string vazia. Sera adicionado fallback para "Cliente".

### 3. Sem mensagem padrao global configuravel
Atualmente, a mensagem de boas-vindas vem de uma constante hardcoded (`defaultWelcomeMessage` em `mockData.ts`). O fotografo nao pode personalizar um modelo padrao global em "Personalizacao", nem ativar/desativar mensagem.

---

## Solucao

### A. Corrigir `{estudio}` no ClientGallery.tsx

**Arquivo**: `src/pages/ClientGallery.tsx` (linha 905)

Substituir:
```
.replace('{estudio}', 'Studio Lunari');
```
Por:
```
.replace('{estudio}', galleryResponse?.studioSettings?.studio_name || 'Estudio');
```

### B. Adicionar fallback para `{cliente}`

Na mesma linha 903, garantir fallback:
```
.replace('{cliente}', (gallery.clientName || 'Cliente').split(' ')[0])
```

### C. Adicionar campo de mensagem padrao global no banco

**Migracao SQL**: Adicionar coluna `default_welcome_message` e `welcome_message_enabled` na tabela `gallery_settings`:

```text
ALTER TABLE gallery_settings 
ADD COLUMN default_welcome_message text,
ADD COLUMN welcome_message_enabled boolean DEFAULT true;
```

### D. Atualizar `useGallerySettings.ts`

- Ler `default_welcome_message` e `welcome_message_enabled` do banco
- Adicionar ao tipo `GlobalSettings` os novos campos: `defaultWelcomeMessage?: string` e `welcomeMessageEnabled?: boolean`
- Suportar persistencia via `updateSettings`

### E. Adicionar secao "Mensagem Padrao" em Personalizacao

**Arquivo**: `src/components/settings/PersonalizationSettings.tsx`

Dentro da secao "Comunicacao", adicionar um card com:
- Switch para ativar/desativar mensagem de boas-vindas globalmente
- Textarea para editar o template padrao da mensagem
- Dica com os slugs disponiveis: `{cliente}`, `{sessao}`, `{estudio}`

### F. Usar mensagem global como default na criacao da galeria

**Arquivo**: `src/pages/GalleryCreate.tsx`

No `useEffect` que inicializa a partir de `settings`:
- Se `settings.welcomeMessageEnabled` for `true` e `settings.defaultWelcomeMessage` existir, usar como valor inicial do `welcomeMessage`
- Se `false`, inicializar com string vazia
- Manter textarea editavel para o fotografo personalizar por galeria

Adicionar toggle no Step 5 (Mensagem) para ativar/desativar a mensagem naquela galeria especifica.

### G. Aplicar mesma correcao ao DeliverCreate e DeliverWelcomeModal

**Arquivo**: `src/components/deliver/DeliverWelcomeModal.tsx`
- Ja usa `{cliente}` e `{sessao}` corretamente
- Adicionar suporte a `{estudio}` usando o studioName do contexto

**Arquivo**: `src/pages/DeliverCreate.tsx`
- Inicializar mensagem com template global quando disponivel

---

## Detalhes tecnicos

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/ClientGallery.tsx` | Corrigir `{estudio}` para usar `studioSettings.studio_name` |
| `src/types/gallery.ts` | Adicionar `defaultWelcomeMessage` e `welcomeMessageEnabled` ao `GlobalSettings` |
| `src/hooks/useGallerySettings.ts` | Ler/salvar novos campos do banco |
| `src/components/settings/PersonalizationSettings.tsx` | Adicionar card de mensagem padrao |
| `src/pages/GalleryCreate.tsx` | Inicializar mensagem do settings global; adicionar toggle on/off |
| `src/pages/DeliverCreate.tsx` | Inicializar mensagem do settings global |
| `src/components/deliver/DeliverWelcomeModal.tsx` | Adicionar suporte a `{estudio}` |
| `src/data/mockData.ts` | Atualizar fallback com novos campos |
| Migracao SQL | Adicionar colunas `default_welcome_message` e `welcome_message_enabled` |

### Fluxo final

1. Fotografo configura mensagem padrao em Personalizacao (com toggle global)
2. Ao criar galeria, Step 5 pre-carrega o template global (se ativo)
3. Fotografo pode editar livremente ou desativar para aquela galeria
4. Quando cliente acessa, `{estudio}` resolve para o nome real do estudio, `{cliente}` resolve para o primeiro nome do cliente, `{sessao}` resolve para o nome da sessao
