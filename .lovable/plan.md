

# Plano: Lightbox da aba "Seleção" deve navegar apenas entre fotos selecionadas

## Diagnóstico

Em `src/pages/GalleryDetail.tsx`:

- O `Lightbox` (linhas 1138-1147) sempre recebe `photos={transformedPhotos}` (todas as fotos da galeria).
- Na lista da aba **Seleção** (linha 778), o thumbnail abre o lightbox usando `transformedPhotos.findIndex(...)`, ou seja, indexando contra **todas** as fotos.
- Resultado: ao deslizar para o lado dentro do lightbox aberto pela aba Seleção, aparecem fotos não selecionadas.

Já na aba **Fotos** (linha 689), faz sentido navegar entre todas — esse comportamento deve ser preservado.

## Correção

Tornar o conjunto de fotos do Lightbox **dependente da origem da abertura**.

### 1. Novo estado: origem do lightbox

Substituir o estado simples `lightboxIndex: number | null` por um par com contexto:

```ts
type LightboxSource = 'all' | 'selection';
const [lightboxState, setLightboxState] = useState<{
  source: LightboxSource;
  index: number;
} | null>(null);
```

### 2. Lista derivada para o lightbox

```ts
const lightboxPhotos = useMemo(() => {
  if (!lightboxState) return [];
  return lightboxState.source === 'selection' ? selectedPhotos : transformedPhotos;
}, [lightboxState, selectedPhotos, transformedPhotos]);
```

### 3. Aberturas

- **Aba Fotos** (linha 689): mantém comportamento atual, mas usando o novo estado.
  ```ts
  onViewFullscreen={() => setLightboxState({
    source: 'all',
    index: transformedPhotos.findIndex(p => p.id === photo.id),
  })}
  ```
- **Lista da aba Seleção** (linha 778): indexar contra `selectedPhotos`.
  ```ts
  onClick={() => setLightboxState({
    source: 'selection',
    index: selectedPhotos.findIndex(p => p.id === photo.id),
  })}
  ```

### 4. Render do Lightbox

```tsx
{lightboxState !== null && (
  <Lightbox
    photos={lightboxPhotos}
    currentIndex={lightboxState.index}
    allowComments={supabaseGallery.configuracoes?.allowComments ?? true}
    disabled
    onClose={() => setLightboxState(null)}
    onNavigate={(idx) => setLightboxState((prev) => prev ? { ...prev, index: idx } : prev)}
    onSelect={() => {}}
  />
)}
```

### 5. Guard contra estado inválido

Se `selectedPhotos` mudar enquanto o lightbox estiver aberto na origem `selection` e o índice ficar fora dos limites, fechar automaticamente:

```ts
useEffect(() => {
  if (lightboxState && lightboxState.index >= lightboxPhotos.length) {
    setLightboxState(null);
  }
}, [lightboxPhotos.length, lightboxState]);
```

## Resultado

- Abrir foto via aba **Fotos** → lightbox navega por todas as fotos (comportamento mantido).
- Abrir foto via lista da aba **Seleção** → lightbox navega **apenas entre as selecionadas**, mostrando o contador correto (ex: `2 / 5`).
- Sem regressões nas outras abas/lista.

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/pages/GalleryDetail.tsx` | Estado do lightbox passa a guardar a origem; lista de fotos passada ao Lightbox depende da aba; índices recalculados conforme a origem |

