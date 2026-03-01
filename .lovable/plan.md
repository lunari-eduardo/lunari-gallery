

## Plano: Pastas Obrigatórias + Visualização por Pasta + Códigos Separados + Performance

### Problemas identificados

1. **"Geral" aparece sem pastas criadas** — Deve sumir; sem pastas = comportamento legado (sem tabs)
2. **Fotos não filtram por pasta no client Select** — `ClientGallery.tsx` ignora `pasta_id` e `folders` do response
3. **Fotos fora de pastas quando pastas existem** — Ao criar pastas, upload deve obrigar seleção de pasta
4. **Códigos de seleção não separam por pasta** — `PhotoCodesModal` gera um bloco único
5. **Cliente Select não vê pastas elegantemente** — Na welcome screen, se houver pastas, mostrar grid de pastas como "álbuns" com thumb grande
6. **Performance do primeiro carregamento** — Loading spinner branco sem contexto; fotos carregam todas de uma vez

---

### Arquivos impactados

#### 1. `src/components/FolderManager.tsx`
- Remover botão "Geral" fixo — se não há pastas, nada aparece
- Quando existem pastas, forçar seleção de uma pasta ativa (não permitir `null`)
- Ao criar a primeira pasta, auto-selecionar como ativa

#### 2. `src/pages/GalleryCreate.tsx` (Step 4)
- Se há pastas criadas e `activeFolderId === null`, mostrar aviso: "Selecione uma pasta para enviar fotos"
- Desabilitar upload se há pastas e nenhuma está selecionada
- Fotos enviadas no grid (`uploadedPhotos`) devem mostrar a pasta associada

#### 3. `src/pages/GalleryEdit.tsx`
- Mesma lógica: se há pastas, obrigar seleção antes do upload

#### 4. `src/pages/DeliverCreate.tsx`
- Mesma lógica para Transfer

#### 5. `src/pages/ClientGallery.tsx` — **Maior mudança**

**Welcome screen com pastas:**
- Se `galleryResponse.folders?.length > 0`, ao clicar "Começar Seleção", mostrar tela intermediária de **seleção de pasta** (álbuns)
- Cada pasta exibida como card grande com thumbnail da primeira foto + nome da pasta (tipografia elegante)
- Ao clicar numa pasta, filtrar grid por `pasta_id`
- Adicionar estado `activeFolderId` e `folderViewMode` ('albums' | 'grid')
- Botão "Voltar" no grid para retornar à tela de álbuns

**Grid filtrado:**
- Quando `activeFolderId !== null`, filtrar `localPhotos` por `pasta_id` (precisa incluir `pasta_id` no transform de photos)
- Header mostrar nome da pasta ativa
- Contadores de seleção por pasta

**Sem pastas:**
- Comportamento idêntico ao atual — nenhuma mudança visual

#### 6. `src/pages/ClientDeliverGallery.tsx`
- Se há pastas, mostrar tela de álbuns (cards com thumbs) em vez de tabs horizontais
- Cada álbum leva ao grid filtrado
- Botão voltar para lista de álbuns

#### 7. `src/components/PhotoCodesModal.tsx`
- Receber `folders` como prop
- Se há pastas, gerar códigos **separados por pasta** (cada pasta com seu bloco)
- Adicionar opção "Todos juntos" para código unificado
- Exibir nome da pasta como heading antes de cada bloco

#### 8. `src/pages/GalleryDetail.tsx`
- Passar `folders` e `photos` com `pasta_id` ao `PhotoCodesModal`

#### 9. `supabase/functions/gallery-access/index.ts`
- Já retorna `folders` — OK
- Para select: incluir `pasta_id` no SELECT de fotos (já está em `*`)

#### 10. Performance do primeiro carregamento
- **`ClientGallery.tsx`**: Trocar spinner branco por skeleton com branding (logo do estúdio + nome da sessão do `galleryResponse` inicial)
- **`ClientDeliverGallery.tsx`**: Lazy load de imagens com `loading="lazy"` (já existe)
- Adicionar `<link rel="preconnect">` ao domínio R2 no `index.html`

---

### Detalhes técnicos

**Inclusão de `pasta_id` nas photos do client (Select):**
O transform em `ClientGallery.tsx` (linha ~330) precisa incluir `pasta_id` no objeto `GalleryPhoto`. Adicionar campo `folderId?: string | null` ao tipo `GalleryPhoto` em `src/types/gallery.ts`.

**Tela de álbuns (Select e Transfer):**
```text
┌─────────────────────────────────────┐
│         [Studio Logo]               │
│                                     │
│    ┌──────────┐  ┌──────────┐       │
│    │  📷      │  │  📷      │       │
│    │  thumb   │  │  thumb   │       │
│    │          │  │          │       │
│    │ Cerimônia│  │  Festa   │       │
│    │  32 fotos│  │  48 fotos│       │
│    └──────────┘  └──────────┘       │
│                                     │
│    ┌──────────┐                     │
│    │  📷      │                     │
│    │  thumb   │                     │
│    │          │                     │
│    │Making Of │                     │
│    │  12 fotos│                     │
│    └──────────┘                     │
└─────────────────────────────────────┘
```

**Códigos separados por pasta:**
```text
┌───────────────────────────────┐
│  Cerimônia                    │
│  ┌─────────────────────────┐  │
│  │ "IMG001" OR "IMG002"... │  │
│  └─────────────────────────┘  │
│                               │
│  Festa                        │
│  ┌─────────────────────────┐  │
│  │ "IMG050" OR "IMG051"... │  │
│  └─────────────────────────┘  │
│                               │
│  [Copiar todos juntos]        │
│  [Copiar por pasta ▼]        │
└───────────────────────────────┘
```

---

### Ordem de implementação

1. Adicionar `folderId` ao tipo `GalleryPhoto`
2. Atualizar `FolderManager` (remover "Geral", obrigar seleção)
3. Atualizar `GalleryCreate`, `DeliverCreate`, `GalleryEdit` (obrigar pasta se existirem)
4. Atualizar `ClientGallery` (tela de álbuns + filtro por pasta)
5. Atualizar `ClientDeliverGallery` (tela de álbuns)
6. Atualizar `PhotoCodesModal` (códigos por pasta)
7. Melhorar loading do primeiro carregamento

