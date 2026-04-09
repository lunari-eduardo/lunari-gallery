

# Adicionar códigos de seleção por visitante na aba Visitantes

## Problema

O fotógrafo não tem acesso aos códigos de separação de fotos (para Windows/Mac/Lightroom) dos visitantes em galerias públicas. A aba "Seleção" mostra apenas um aviso genérico e a aba "Visitantes" mostra contagem mas sem opção de copiar códigos.

## Solução

Ao expandir um visitante na aba "Visitantes", buscar as fotos selecionadas via `gallery-visitors` (que já retorna `selectedPhotos` com `original_filename`) e exibir um botão "Copiar códigos" que abre o `PhotoCodesModal` existente, reutilizando toda a lógica de formatação (Windows/Mac/Lightroom/TXT).

## Implementação

### `src/pages/GalleryDetail.tsx`

1. **Fetch on expand**: Quando o visitante é expandido, fazer uma segunda chamada ao `gallery-visitors` passando `visitorId` para obter `selectedPhotos`
2. **Botão "Copiar códigos"**: Adicionar na área expandida do visitante, ao lado das informações existentes
3. **Reutilizar `PhotoCodesModal`**: Abrir o modal existente passando as fotos do visitante convertidas para o formato `GalleryPhoto[]` e `clientName` = nome do visitante

### Detalhes técnicos

- Novo state: `visitorPhotos` (Record de visitorId → GalleryPhoto[]) e `visitorCodesModalId` (string | null)
- Ao expandir visitante: `useQuery` ou fetch manual para `gallery-visitors` com `{ galleryId, visitorId }` → mapear `selectedPhotos` para formato `GalleryPhoto`
- O `PhotoCodesModal` já aceita `photos` filtradas e `clientName` — nenhuma alteração necessária nele
- Converter `selectedPhotos` (que têm `original_filename`, `filename`) para `GalleryPhoto` com `isSelected: true`

### Fluxo do fotógrafo

1. Abre aba "Visitantes"
2. Expande "Eduardo" → vê detalhes + botão **"Copiar códigos"**
3. Clica → abre modal com seletor Windows/Mac/Lightroom e códigos prontos para copiar

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/GalleryDetail.tsx` | Fetch de fotos ao expandir visitante, botão "Copiar códigos", integração com PhotoCodesModal |

Nenhuma Edge Function precisa ser alterada — `gallery-visitors` já retorna os dados necessários.

