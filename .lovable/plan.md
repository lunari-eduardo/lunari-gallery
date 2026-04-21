

# Plano: corrigir persistência de tema (light/dark) em galerias do cliente

## Diagnóstico — 3 bugs reais encontrados

### Bug 1 (raiz): default global de tema é ignorado se for `'system'`

`src/pages/GalleryCreate.tsx` linha 308:
```text
if (settings.clientTheme === 'dark') setClientMode('dark');
else                                  setClientMode('light');  ← força LIGHT quando é 'system'
```

`GlobalSettings.clientTheme` aceita `'light' | 'dark' | 'system'` (default `'system'` no `mockData` e no DB). Como `'system'` cai no `else`, **nenhuma galeria nasce em dark** a menos que o fotógrafo abra a galeria e clique manualmente em "Escuro" no passo de criação. Por isso ele "criou no modo dark" mas o banco gravou `clientMode='light'`. Confirmado no banco: todas as galerias "Dia das Mães" têm `configuracoes->>'clientMode' = 'light'`, e o tema customizado vinculado (`gallery_themes.background_mode`) também é `'light'`.

### Bug 2: tema do cliente não pode ser editado após criação

`src/pages/GalleryEdit.tsx` (792 linhas) **não tem uma única referência** a `clientMode`, `themeId`, `theme` ou `configuracoes`. O fotógrafo só consegue ajustar o tema da galeria recriando-a — caminho que ninguém faz na prática. É por isso que a galeria do print continuou em light: nem o `GalleryEdit` nem nenhum outro fluxo permite trocar.

### Bug 3: 4 telas internas cliente usam fallback `|| 'light'` em vez de `effectiveBackgroundMode`

`src/pages/ClientGallery.tsx`:
```text
linha 1702: backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}   ← SelectionConfirmation
linha 1747: backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}   ← PixPaymentScreen
linha 1770: backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}   ← AsaasCheckout
linha 1784: backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}   ← PaymentRedirect
```

O `effectiveBackgroundMode` (linha 771) já calcula a prioridade certa `theme.backgroundMode > clientMode > 'light'`, mas essas 4 telas não o usam. Como o tema custom da fotógrafa também tem `background_mode='light'`, todas ficam light mesmo se ela só tivesse pedido `clientMode='dark'`. Isso reproduz exatamente o comportamento das imagens 2-7 (todas claras) enquanto a `PasswordScreen` (linha 933, usa `effectiveBackgroundMode`) ficou escura porque é renderizada **antes** do `theme` carregar — usando apenas o `clientMode` do header da resposta.

Espera — na verdade a tela de senha ficou escura no print e o resto light. Isso significa que para a galeria de teste, o backend responde:
- 1ª chamada (sem senha): `clientMode = 'dark'` mas `theme = null` (sem `themeId` resolvido ainda no early-return de senha) → PasswordScreen vê `effectiveBackgroundMode='dark'` ✓
- 2ª chamada (após senha): `theme.backgroundMode = 'light'` (do custom theme do fotógrafo) → todas as telas pegam `'light'`

Confirmando no banco: a galeria-teste tem `clientMode='light'` e `themeId='1abc5db0...'` com `background_mode='light'`. Então o print da senha em dark deve ser de **outra** galeria. Mesmo assim, os 3 bugs acima estão todos errados e juntos causam o sintoma.

## Solução

### Parte 1 — corrigir hidratação do `clientMode` em `GalleryCreate`

Substituir o bloco linha 307-312:

```text
if (!userTouchedClientModeRef.current) {
  if (settings.clientTheme === 'dark')   setClientMode('dark');
  else if (settings.clientTheme === 'light') setClientMode('light');
  else if (settings.customTheme?.backgroundMode === 'dark') setClientMode('dark');
  else if (settings.customTheme?.backgroundMode === 'light') setClientMode('light');
  else setClientMode('light');   // fallback final
}
```

Adicionar `userTouchedClientModeRef = useRef(false)` e marcar nos 2 botões "Claro/Escuro" do passo de criação (linhas 1828, 1832).

Prioridade: `userTouched > settings.clientTheme > customTheme.backgroundMode > light`. Quando o fotógrafo configurou tema customizado (com modo escuro), a galeria nasce escura mesmo se `clientTheme='system'`. Quando ele explicitamente disse `clientTheme='dark'`, vence.

### Parte 2 — adicionar gestão de tema em `GalleryEdit`

`GalleryEdit.tsx` ganha uma nova seção "Tema da Galeria" similar à de `GalleryCreate`:

- ler `configuracoes.clientMode` e `configuracoes.themeId` na carga inicial
- 2 botões Sol/Lua para alternar light/dark
- preview da paleta atual (reusa lógica do `ThemePreviewCard`)
- ao salvar, atualiza `configuracoes->>'clientMode'` e `configuracoes->>'themeId'` mantendo demais chaves intactas

Implementação: adicionar estados `clientMode`, `selectedThemeId`; carregar do `gallery.configuracoes` no `useEffect` inicial; mesclar ao payload de update existente:

```text
configuracoes: { ...existingConfig, clientMode, themeId: selectedThemeId }
```

### Parte 3 — corrigir os 4 fallbacks em `ClientGallery`

Substituir nas linhas 1702, 1747, 1770, 1784:

```text
- backgroundMode={galleryResponse?.theme?.backgroundMode || 'light'}
+ backgroundMode={effectiveBackgroundMode}
```

Como `effectiveBackgroundMode` já é o memo correto (linha 771), a mudança é mecânica e sem risco. Garante que `SelectionConfirmation`, `PixPaymentScreen`, `AsaasCheckout` e `PaymentRedirect` herdam o tema da galeria.

### Parte 4 — `pendingBgMode` (linha 1123) já está OK

Só renomeia de `pendingBgMode` para `effectiveBackgroundMode` por consistência (mesmo cálculo). Não muda comportamento.

### Parte 5 — log de migração para galerias antigas

Migração SQL **opcional** que pode ser executada uma única vez para galerias criadas no período do bug:

```sql
-- Para galerias que apontam para um tema custom dark,
-- mas têm clientMode='light' por causa do bug do default,
-- alinhar clientMode ao background_mode do tema vinculado.
UPDATE galerias g
SET configuracoes = jsonb_set(
  COALESCE(g.configuracoes, '{}'::jsonb),
  '{clientMode}',
  to_jsonb(t.background_mode)
)
FROM gallery_themes t
WHERE (g.configuracoes->>'themeId')::uuid = t.id
  AND COALESCE(g.configuracoes->>'clientMode', 'light') <> t.background_mode;
```

Sem efeito retroativo perigoso: só copia o `background_mode` do tema customizado escolhido para o `clientMode` da galeria. Se nenhum tema custom estiver vinculado, nada muda. **Esta migração é opcional** — apresento para o usuário decidir se quer corrigir o histórico.

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `src/pages/GalleryCreate.tsx` | adicionar `userTouchedClientModeRef`; reescrever bloco linhas 307-312 com cascata de prioridades; marcar ref nos onClick dos botões Sol/Lua (linhas 1828, 1832) |
| `src/pages/GalleryEdit.tsx` | adicionar estado `clientMode` e `selectedThemeId`; carregar de `gallery.configuracoes` no `useEffect` de hidratação; nova seção UI "Tema da galeria" com 2 botões Sol/Lua + seletor opcional de tema custom; mesclar `clientMode` e `themeId` no payload de `update` preservando outras chaves de `configuracoes` |
| `src/pages/ClientGallery.tsx` | linhas 1702, 1747, 1770, 1784 → trocar fallback por `effectiveBackgroundMode`; renomear `pendingBgMode` → `effectiveBackgroundMode` na linha 1123 (idêntico, só clareza) |
| `supabase/migrations/<novo>.sql` (opcional) | alinhar `clientMode` ao `background_mode` do `themeId` vinculado para galerias afetadas |
| Sem alteração em | `gallery-access` (já manda `theme.backgroundMode` e `clientMode` corretos), `useGallerySettings`, `ThemeConfig`, webhooks, fluxos de pagamento, `prepare_gallery_share`, `confirm-selection`, `finalize_gallery_payment` |

## Validação

1. configurar em `Configurações > Personalização` um tema custom com modo **Escuro**;
2. criar uma galeria standalone → todas as telas (welcome, álbuns, grid, lightbox, confirmação, pagamento Asaas, pagamento PIX manual) ficam escuras de ponta a ponta;
3. configurar `clientTheme='dark'` no settings e criar outra galeria → mesma coisa;
4. configurar `clientTheme='system'` mas tema custom light → galeria nasce light;
5. abrir galeria existente em `GalleryEdit`, mudar para Escuro, salvar → recarregar a URL pública do cliente mostra todas as telas escuras;
6. criar galeria via Gestão (`?session_id=...`) com tema custom dark → idem;
7. tocar manualmente no botão Sol em `GalleryCreate` → settings async tardio não reverte;
8. galeria antiga (com tema light) continua light — não há regressão visual;
9. (opcional) rodar migração → galerias afetadas pelo bug histórico passam a refletir o tema do fotógrafo;
10. `npm run build` sem erros TS.

## Resultado esperado

- o tema (light/dark) escolhido pelo fotógrafo persiste em **todas** as telas que o cliente vê: senha, visitante, welcome, álbuns, grid, lightbox, confirmação, PIX manual, Asaas, redirect, finalizada;
- fotógrafo passa a poder editar o tema de uma galeria existente em `GalleryEdit`;
- o default do sistema (`clientTheme='system'`) deixa de forçar light quando há um tema custom dark configurado;
- nenhum impacto em integrações de pagamento, webhooks, fluxo de reativação ou em galerias Transfer/entrega.

