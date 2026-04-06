

# Fix: Modais cinza no modo light + inputs que não permitem limpar valor

## Problema 1 — Modais cinza

A variável CSS `--popover` no modo light está definida como `30 30% 98% / 0.42` (42% de opacidade). Quando o modal abre sobre o overlay escuro (`bg-black/80`), o fundo semi-transparente mistura com o preto e fica cinza.

No modo dark, `--popover` é opaco (`20 12% 10%` sem alpha) — por isso só o light mode tem esse problema.

### Solução

Alterar `--popover` no light mode para opaco: `30 30% 98%` (sem alpha). O efeito glassmorphism dos modais já vem do `backdrop-blur-xl` e da borda translúcida — a opacidade do fundo não contribui para o glass effect em modais (pois estão sobre overlay escuro, não sobre conteúdo).

O `--card` (usado em cards da página, não modais) permanece com alpha para manter o glassmorphism sobre os backgrounds com gradientes.

**Arquivo**: `src/index.css` — linha 16, mudar de `30 30% 98% / 0.42` para `30 30% 98%`

## Problema 2 — Inputs numéricos não permitem limpar

Vários inputs usam o padrão `parseInt(e.target.value) || 7` que força um fallback quando o campo fica vazio. Isso impede o usuário de apagar o valor e digitar um novo.

### Solução

Trocar o estado de `number` para `string`, permitir string vazia durante edição, e converter para número apenas na validação/submit.

**Arquivos afetados**:
- `src/components/ReactivateGalleryDialog.tsx` — `days` passa a ser string, converte em `handleReactivate`
- `src/pages/GalleryCreate.tsx` — `includedPhotos`, `customDays` e campos de pacotes de desconto
- `src/pages/GalleryEdit.tsx` — `fotosIncluidas`
- `src/components/settings/GeneralSettings.tsx` — `defaultExpirationDays`

Padrão novo para cada input:
```tsx
const [days, setDays] = useState('7');
// ...
<Input value={days} onChange={(e) => setDays(e.target.value)} />
// No submit:
const parsed = parseInt(days) || defaultValue;
```

