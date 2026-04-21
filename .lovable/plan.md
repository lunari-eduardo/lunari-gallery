

# Plano: tornar o "Modo Escuro/Claro" da galeria realmente respeitado em todas as telas

## Diagnóstico — a raiz exata

A galeria de teste `df9ae2b0…` tem:
- `configuracoes.clientMode = 'dark'` ✅ (a fotógrafa marcou Escuro)
- `configuracoes.themeId = 1abc5db0…`
- mas esse tema custom tem `background_mode = 'light'`

Na `gallery-access` (linhas 1071-1094), quando há `themeId`, o backend monta:
```text
themeData = { backgroundMode: theme.background_mode || 'light', ... }
```
e devolve **junto** com `clientMode`. No frontend (`ClientGallery.tsx` linha 770-773):
```text
effectiveBackgroundMode = theme.backgroundMode || clientMode || 'light'
```
Como `theme.backgroundMode='light'` é truthy, **vence sempre**. O `clientMode='dark'` salvo na galeria é totalmente ignorado.

A tela de **senha** (linha 911-932) escapa porque retorna `clientMode` **sem** `theme`. Por isso ela ficou escura no print, e nada mais ficou.

A fotógrafa não consegue fazer dark "por galeria" enquanto tiver um tema customizado light — o tema custom sobrescreve sempre.

### Bug secundário relacionado

O `ThemeConfig.tsx` força o fotógrafo a escolher **um** modo (Claro **ou** Escuro) ao salvar o tema custom. Esse modo é guardado em `gallery_themes.background_mode`, e a partir daí trava todas as galerias dele naquele modo — não há um conceito de "tema neutro de cores, modo decidido por galeria".

## Solução — duas mudanças simétricas

### Mudança 1 (crítica): `clientMode` da galeria vence o `theme.backgroundMode`

A intenção do produto é clara: quando o fotógrafo entra em "Configurações da galeria" e clica **Escuro**, isso deve valer **para essa galeria**, mesmo que o tema custom seja light. A cor de fundo é decisão da galeria; o tema custom contribui apenas com **cores de marca** (primary, accent, emphasis).

**Backend** (`supabase/functions/gallery-access/index.ts`) — em **todos** os 6 blocos que constroem `themeData` (linhas 162-180, 384-402, 549-565, 697-711, 766-780, 871-889, 950-969, 1076-1107):

```text
backgroundMode: clientMode  // sempre prioriza a decisão da galeria
                            // (era theme.background_mode || 'light')
```

A propriedade `theme.backgroundMode` continua sendo enviada, mas refletindo o `clientMode` da galeria — assim o frontend nem precisa mudar lógica.

**Frontend** (`src/pages/ClientGallery.tsx` linhas 770-773 e 805-810): inverter a precedência do memo para deixar explícito:
```text
effectiveBackgroundMode = clientMode || theme.backgroundMode || 'light'
```
Defensivo: mesmo que o backend antigo esteja em cache de borda, o frontend já honra a galeria.

### Mudança 2: `GalleryCreate` deve hidratar `clientMode` com prioridade ao tema custom escuro

Já implementamos a cascata correta em `GalleryCreate` (linhas 312-326), mas como o tema custom da fotógrafa é light, a galeria nasce light. Não muda nada aqui — a Mudança 1 sozinha resolve, porque agora o `clientMode='dark'` que a fotógrafa clica manualmente passa a valer mesmo havendo tema custom.

### Mudança 3 (UX): rótulo claro em `GalleryEdit` e `GalleryCreate`

Texto atual: "Modo para esta galeria". Trocar para:
- "**Fundo desta galeria**"
- subtítulo: *"As cores do seu tema personalizado serão aplicadas sobre o fundo escolhido."*

Ajuda o fotógrafo a entender que o modo da galeria sobrepõe o do tema.

### Mudança 4 (curativa, opcional): migrar galerias antigas

Galerias criadas antes desta correção podem ter `clientMode='dark'` mas estarem mostrando light. Essa migração só **garante consistência** — não muda comportamento depois do fix:

```sql
-- Nada a migrar para dados; o fix de prioridade resolve tudo runtime.
-- Apenas reaplicar visual: nada a fazer no banco.
```
**Não há migração necessária**: o backend recalculará a cada request. As galerias existentes começarão a respeitar o `clientMode` no próximo acesso.

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gallery-access/index.ts` | em **8 blocos** (linhas ~170, 392, 557, 702, 770, 879, 960, 1086): trocar `backgroundMode: theme.background_mode \|\| 'light'` por `backgroundMode: clientMode` (a galeria decide o modo). O backend envia também `themeColors` separados (primary/accent/emphasis) que o frontend já consome via `themeStyles` |
| `src/pages/ClientGallery.tsx` | linha 770-773: trocar memo para `clientMode \|\| theme?.backgroundMode \|\| 'light'`; linha 810: idem |
| `src/pages/GalleryCreate.tsx` linhas 1854-1864 e `src/pages/GalleryEdit.tsx` (mesma seção) | mudar rótulo "Modo para esta galeria" → "Fundo desta galeria" + subtítulo explicativo |
| Sem alteração em | RLS, RPC `prepare_gallery_share`, `confirm-selection`, `finalize_gallery_payment`, `client-selection`, webhooks Asaas/InfinitePay/MP, `useGallerySettings`, `ThemeConfig`, `gallery_themes`, fluxos de pagamento, `usePhotoCredits`, integrações Studio Pro/Combo, fluxo Modo Assistido |

## Validação

1. abrir a galeria `df9ae2b0…` (Teste, `clientMode='dark'`, tema custom light) → senha **escura**, todas as telas seguintes **escuras** com cores de marca da fotógrafa (botões terracota, accent verde) sobre fundo dark — comportamento idêntico ao print da config "Escuro";
2. criar nova galeria, clicar **Claro** → tudo claro com cores da marca;
3. criar nova galeria, clicar **Escuro** → tudo escuro com cores da marca;
4. galeria com tema custom **dark** + `clientMode='light'` (caso raro) → fundo **claro** (a galeria vence — comportamento previsível);
5. galeria sem tema custom (system) → segue `clientMode` normalmente como hoje;
6. galeria de entrega (Transfer) com `clientMode='dark'` → idem;
7. galeria pública: tela de identificação do visitante respeita o modo da galeria;
8. galeria expirada: tela de expiração respeita modo da galeria (já usa `clientMode` no fallback);
9. fluxos de pagamento (PIX, Asaas, InfinitePay, MercadoPago) renderizam no modo correto — sem regressão em `prepare_gallery_share`, `confirm-selection`, webhook Asaas;
10. `npm run build` sem erros TS;
11. galerias antigas: ao próximo acesso, voltam a respeitar o `clientMode` salvo — sem migração de banco.

## Resultado esperado

- O botão "Escuro/Claro" da galeria volta a fazer o que diz: **força o fundo daquela galeria**, independentemente do tema custom do fotógrafo;
- O tema customizado contribui apenas com **cores de marca** (primary/accent/emphasis), que ficam bonitas em cima de qualquer fundo;
- A tela de senha, welcome, álbuns, grid, lightbox, confirmação, PIX, Asaas, redirect, finalizada — **todas** ficam consistentes;
- Nenhum impacto em pagamentos, webhooks, RLS, integrações Studio/Combo, Modo Assistido, ou no Transfer.

