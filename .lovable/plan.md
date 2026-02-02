

# Sistema de Controle de Caixa para Título da Galeria

## Situação Atual

O título da galeria (nome da sessão) é exibido em **caixa alta forçada** em vários locais:
- Preview no seletor de fontes (`FontSelect.tsx`) - usa classe `uppercase`
- Header da galeria (`ClientGalleryHeader.tsx`) - usa classe `uppercase`
- Demais telas não usam uppercase, mas também não oferecem controle

O usuário quer que o título seja exibido **exatamente como digitado**, com opção de aplicar transformações.

## Nova Funcionalidade

Adicionar um botão `[T]` ao lado do preview no seletor de fontes que alterna entre 3 modos:

| Modo | Descrição | Exemplo |
|------|-----------|---------|
| `normal` | Exatamente como digitado | "Ensaio gestante" |
| `uppercase` | Tudo em caixa alta | "ENSAIO GESTANTE" |
| `titlecase` | Início de palavras (exceto conjunções) | "Ensaio Gestante" |

### Conjunções ignoradas no Title Case
`e`, `de`, `da`, `do`, `das`, `dos`, `com`, `em`, `para`, `a`, `o`, `as`, `os`

---

## Mudanças Técnicas

### 1. Atualizar Tipo `GallerySettings` (types/gallery.ts)

```typescript
export type TitleCaseMode = 'normal' | 'uppercase' | 'titlecase';

export interface GallerySettings {
  // ... existente
  sessionFont?: string;
  titleCaseMode?: TitleCaseMode;  // Novo campo
}
```

### 2. Função de Transformação de Texto (novo helper)

Criar `src/lib/textTransform.ts`:

```typescript
const CONJUNCTIONS = ['e', 'de', 'da', 'do', 'das', 'dos', 'com', 'em', 'para', 'a', 'o', 'as', 'os'];

export function applyTitleCase(text: string, mode: 'normal' | 'uppercase' | 'titlecase' = 'normal'): string {
  if (!text) return text;
  
  switch (mode) {
    case 'uppercase':
      return text.toUpperCase();
    case 'titlecase':
      return text
        .toLowerCase()
        .split(' ')
        .map((word, index) => {
          // Primeira palavra sempre capitalizada
          if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
          // Conjunções ficam minúsculas
          if (CONJUNCTIONS.includes(word)) return word;
          // Outras palavras capitalizadas
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    default:
      return text;
  }
}
```

### 3. Atualizar `FontSelect.tsx`

Adicionar prop para modo e toggle button:

```typescript
interface FontSelectProps {
  value: string;
  onChange: (value: string) => void;
  previewText?: string;
  titleCaseMode?: TitleCaseMode;
  onTitleCaseModeChange?: (mode: TitleCaseMode) => void;
}
```

UI com botão toggle ao lado do preview:

```text
┌────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐  │
│  │  Cormorant                              ▾    │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌────────────────────────────────────────────┬──┐ │
│  │                                            │Tt│ │ ← Botão toggle
│  │       Alice e Pedro                        │  │ │
│  │       (título com fonte aplicada)          │──│ │
│  │                                            │  │ │
│  └────────────────────────────────────────────┴──┘ │
│  Prévia do título da galeria                       │
└────────────────────────────────────────────────────┘
```

Ícones do botão por modo:
- `normal`: `Type` (fonte normal)
- `uppercase`: `CaseSensitive` ou `ALargeSmall`
- `titlecase`: `CaseUpper` ou ícone personalizado

Ciclo: normal → uppercase → titlecase → normal

### 4. Atualizar `GalleryCreate.tsx`

Novo estado:
```typescript
const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
```

Passar para `FontSelect`:
```typescript
<FontSelect
  value={sessionFont}
  onChange={setSessionFont}
  previewText={sessionName || 'Ensaio Gestante'}
  titleCaseMode={titleCaseMode}
  onTitleCaseModeChange={setTitleCaseMode}
/>
```

Salvar em `configuracoes`:
```typescript
configuracoes: {
  // ... existente
  sessionFont: sessionFont,
  titleCaseMode: titleCaseMode,  // Novo
}
```

### 5. Atualizar Componentes do Cliente

Cada componente que exibe o título deve:
1. Receber `titleCaseMode` como prop (ou extrair de settings)
2. Aplicar `applyTitleCase(sessionName, titleCaseMode)`
3. **Remover a classe `uppercase`** quando existente

| Arquivo | Mudança |
|---------|---------|
| `ClientGalleryHeader.tsx` | Remover `uppercase`, aplicar `applyTitleCase()` |
| `PasswordScreen.tsx` | Aplicar `applyTitleCase()` |
| `FinalizedGalleryScreen.tsx` | Aplicar `applyTitleCase()` |
| `ClientGallery.tsx` (welcome + confirmed) | Aplicar `applyTitleCase()` |

Exemplo no `ClientGalleryHeader.tsx`:

```typescript
// Antes
<h1 className="text-lg sm:text-xl font-semibold uppercase tracking-wide">
  {sessionName}
</h1>

// Depois
<h1 
  className="text-lg sm:text-xl font-semibold tracking-wide"
  style={{ fontFamily: sessionFont || '"Playfair Display", serif' }}
>
  {applyTitleCase(sessionName, titleCaseMode)}
</h1>
```

### 6. Atualizar `ClientGallery.tsx`

Extrair `titleCaseMode` do settings e passar para componentes:

```typescript
const titleCaseMode = gallery.settings.titleCaseMode || 'normal';

// Passar para header
<ClientGalleryHeader
  sessionName={gallery.sessionName}
  sessionFont={getFontFamilyById(gallery.settings.sessionFont)}
  titleCaseMode={titleCaseMode}
  // ...
/>
```

---

## Arquivos a Criar/Modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `src/lib/textTransform.ts` | **Criar** | Função `applyTitleCase()` |
| `src/types/gallery.ts` | Modificar | Adicionar tipo `TitleCaseMode` e campo em `GallerySettings` |
| `src/components/FontSelect.tsx` | Modificar | Adicionar botão toggle + props + lógica |
| `src/pages/GalleryCreate.tsx` | Modificar | Estado + salvar em configuracoes |
| `src/components/ClientGalleryHeader.tsx` | Modificar | Remover `uppercase`, adicionar prop + aplicar função |
| `src/components/PasswordScreen.tsx` | Modificar | Adicionar prop + aplicar função |
| `src/components/FinalizedGalleryScreen.tsx` | Modificar | Adicionar prop + aplicar função |
| `src/pages/ClientGallery.tsx` | Modificar | Extrair titleCaseMode e passar para componentes |

---

## Fluxo de Dados

```text
GalleryCreate                         ClientGallery
     │                                      │
     ▼                                      ▼
configuracoes.titleCaseMode ──────► gallery.settings.titleCaseMode
     │                                      │
     ▼                                      ▼
Preview com transformação            Componentes aplicam applyTitleCase()
```

---

## Resultado Visual no Cliente

Com modo `titlecase` selecionado:

```text
Usuário digita: "alice e pedro"
                      ↓
Exibido como: "Alice e Pedro"
```

Com modo `normal`:
```text
Usuário digita: "alice e pedro"
                      ↓
Exibido como: "alice e pedro"
```

Com modo `uppercase`:
```text
Usuário digita: "alice e pedro"
                      ↓
Exibido como: "ALICE E PEDRO"
```

