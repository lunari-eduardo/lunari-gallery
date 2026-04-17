

# Plano: Padrões de "Modo de Venda" e "Tamanho de Imagens" nas Configurações

## Diagnóstico

Hoje na criação de galeria (`GalleryCreate.tsx`):
- `saleMode` inicia hardcoded como `'sale_without_payment'` (linha 155)
- `imageResizeOption` inicia hardcoded como `1920` (linha 273)

Usuário precisa reescolher manualmente toda vez. Vamos transformar isso em **defaults configuráveis** por fotógrafo, lidos das Configurações.

## 1. Schema do banco

Adicionar duas colunas em `gallery_settings` via migração:

| Coluna | Tipo | Default |
|---|---|---|
| `default_sale_mode` | `text` | `'sale_without_payment'` |
| `default_image_resize` | `int` | `1920` |

Constraint check em `default_sale_mode`: `IN ('no_sale', 'sale_with_payment', 'sale_without_payment')`.
Constraint check em `default_image_resize`: `IN (1024, 1920, 2560)`.

## 2. Tipos (`src/types/gallery.ts`)

Adicionar em `GlobalSettings`:
```ts
defaultSaleMode?: SaleMode;
defaultImageResize?: ImageResizeOption;
```

## 3. Hook `useGallerySettings.ts`

- `rowsToSettings`: ler `default_sale_mode` e `default_image_resize`
- `defaultSettings`: incluir `defaultSaleMode: 'sale_without_payment'` e `defaultImageResize: 1920`
- `updateSettings`: mapear novos campos para colunas do BD (snake_case)
- `initializeSettings`: gravar defaults na criação inicial

## 4. UI — `GeneralSettings.tsx` (aba Geral)

Adicionar **dois novos cards** seguindo o padrão visual existente:

### Card "Modo de Venda Padrão" (ícone `Tag`)
RadioGroup com 3 opções (mesmo conteúdo da Etapa 2 da galeria):
- **Não, sem venda** — cliente não vê preços
- **Sim, COM pagamento** — cliente é cobrado ao finalizar
- **Sim, SEM pagamento** — cliente é apenas informado dos preços

### Card "Tamanho Padrão das Imagens" (ícone `Image`)
RadioGroup ou Select com 3 opções:
- **1024 px** — leve, ideal para web
- **1920 px** (recomendado) — equilíbrio qualidade/peso
- **2560 px** — alta resolução

Ambos chamam `updateSettings({ defaultSaleMode: ... })` / `updateSettings({ defaultImageResize: ... })`.

## 5. Aplicar defaults em `GalleryCreate.tsx`

Trocar inicializações hardcoded:
```ts
const { settings } = useSettings();

const [saleMode, setSaleMode] = useState<SaleMode>(
  settings?.defaultSaleMode ?? 'sale_without_payment'
);
const [imageResizeOption, setImageResizeOption] = useState<ImageResizeOption>(
  settings?.defaultImageResize ?? 1920
);
```

**Importante** — como `settings` chega async, adicionar `useEffect` para hidratar quando settings carregar (se o usuário ainda não interagiu):

```ts
useEffect(() => {
  if (settings?.defaultSaleMode) setSaleMode(settings.defaultSaleMode);
  if (settings?.defaultImageResize) setImageResizeOption(settings.defaultImageResize);
}, [settings?.defaultSaleMode, settings?.defaultImageResize]);
// Apenas no mount — não sobrescrever após o usuário interagir
```

Usaremos uma flag `userTouchedRef` para impedir sobrescrita após o usuário ter alterado manualmente nessa sessão.

**Não aplicar** quando vier do Modo Assistido (`gestaoParams.modelo_de_cobranca` tem prioridade — já existe lógica para isso).

## 6. Integração com Modo Assistido

A hierarquia continua:
1. `regras_congeladas` da sessão (Modo Assistido) — prioridade máxima
2. Defaults do fotógrafo (novo)
3. Fallback hardcoded

Nada a alterar na lógica do `useGestaoParams` — apenas garantir que o `useEffect` de hidratação **não rode** se `hasGestaoParams === true`.

## 7. UX

- Toast confirmando alteração (já tem via `updateSettings` existente)
- Adicionar texto auxiliar pequeno em cada card explicando "Aplicado automaticamente em novas galerias"
- Manter padrão visual de cards `lunari-card p-6 space-y-6` com ícone redondo

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<novo>.sql` | Adicionar colunas `default_sale_mode` e `default_image_resize` |
| `src/types/gallery.ts` | Adicionar campos em `GlobalSettings` |
| `src/data/mockData.ts` | Defaults no mock |
| `src/hooks/useGallerySettings.ts` | Ler/gravar novas colunas |
| `src/components/settings/GeneralSettings.tsx` | Dois novos cards |
| `src/pages/GalleryCreate.tsx` | Hidratar `saleMode` e `imageResizeOption` dos settings |

## Resultado

- Fotógrafo configura "modo de venda padrão" e "tamanho padrão" uma vez
- Toda nova galeria já abre com esses valores pré-selecionados
- Modo Assistido continua tendo prioridade sobre os defaults
- Persistência por usuário no banco

