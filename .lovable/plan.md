
# Sistema de Seleção de Fonte para Nome da Galeria ✅ IMPLEMENTADO

## Status: COMPLETO

## Visão Geral

Implementar um seletor de fontes no formulário de criação de galeria que permite ao fotógrafo escolher entre 10 fontes do Google Fonts para exibir o nome da sessão na galeria do cliente.

## Fontes Disponíveis (Google Fonts)

| Nome Corrigido | Estilo | URL Google Fonts |
|----------------|--------|------------------|
| Imperial Script | Cursiva elegante | `Imperial+Script` |
| League Script | Cursiva casual | `League+Script` |
| Allura | Script romântica | `Allura` |
| Amatic SC | Handwritten | `Amatic+SC:wght@400;700` |
| Shadows Into Light | Handwritten | `Shadows+Into+Light` |
| Source Serif 4 | Serif clássica | `Source+Serif+4:wght@400;600;700` |
| Cormorant | Serif elegante | `Cormorant:wght@400;500;600;700` |
| Bodoni Moda | Serif moderna | `Bodoni+Moda:wght@400;500;600;700` |
| Raleway | Sans-serif clean | `Raleway:wght@400;500;600;700` |
| Quicksand | Sans-serif amigável | `Quicksand:wght@400;500;600;700` |

---

## Mudanças Técnicas

### 1. Carregar Fontes no `index.html`

```html
<!-- Após linha 22, adicionar: -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Imperial+Script&family=League+Script&family=Allura&family=Amatic+SC:wght@400;700&family=Shadows+Into+Light&family=Source+Serif+4:wght@400;600;700&family=Cormorant:wght@400;500;600;700&family=Bodoni+Moda:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 2. Novo Componente: `src/components/FontSelect.tsx`

Componente de seletor com preview em tempo real:

```typescript
interface FontOption {
  id: string;
  name: string;
  family: string;  // CSS font-family
}

const GALLERY_FONTS: FontOption[] = [
  { id: 'playfair', name: 'Playfair Display', family: '"Playfair Display", serif' }, // Padrão atual
  { id: 'imperial', name: 'Imperial Script', family: '"Imperial Script", cursive' },
  { id: 'league', name: 'League Script', family: '"League Script", cursive' },
  { id: 'allura', name: 'Allura', family: '"Allura", cursive' },
  { id: 'amatic', name: 'Amatic SC', family: '"Amatic SC", cursive' },
  { id: 'shadows', name: 'Shadows Into Light', family: '"Shadows Into Light", cursive' },
  { id: 'source-serif', name: 'Source Serif 4', family: '"Source Serif 4", serif' },
  { id: 'cormorant', name: 'Cormorant', family: '"Cormorant", serif' },
  { id: 'bodoni', name: 'Bodoni Moda', family: '"Bodoni Moda", serif' },
  { id: 'raleway', name: 'Raleway', family: '"Raleway", sans-serif' },
  { id: 'quicksand', name: 'Quicksand', family: '"Quicksand", sans-serif' },
];
```

UI do componente:
- Dropdown com nome da fonte
- Preview abaixo mostrando o nome da sessão na fonte selecionada
- Cada item do dropdown mostra o nome da fonte estilizado

### 3. Atualizar `GalleryCreate.tsx`

#### Novo estado (após linha 171):
```typescript
const [sessionFont, setSessionFont] = useState<string>('playfair');
```

#### Adicionar campo no Step 1 (após linha 1049):
```typescript
<div className="space-y-2">
  <Label>Fonte do Título</Label>
  <FontSelect
    value={sessionFont}
    onChange={setSessionFont}
    previewText={sessionName || 'Ensaio Gestante'}
  />
</div>
```

#### Salvar no objeto `configuracoes` (linhas 651-665, 705-719):
```typescript
configuracoes: {
  // ... existente
  sessionFont: sessionFont,  // Novo campo
}
```

### 4. Atualizar Edge Function `gallery-access`

Incluir `sessionFont` na resposta da galeria (já vem automaticamente dentro de `configuracoes`).

### 5. Atualizar Componentes do Cliente

#### `ClientGalleryHeader.tsx` (linha 91):
```typescript
// Antes
<h1 className="font-display text-lg sm:text-xl font-semibold uppercase tracking-wide">
  {sessionName}
</h1>

// Depois
<h1 
  className="text-lg sm:text-xl font-semibold uppercase tracking-wide"
  style={{ fontFamily: sessionFont || '"Playfair Display", serif' }}
>
  {sessionName}
</h1>
```

#### Componentes afetados:
| Arquivo | Mudança |
|---------|---------|
| `ClientGalleryHeader.tsx` | Aplicar `sessionFont` via style inline |
| `ClientGallery.tsx` (welcome) | Aplicar `sessionFont` no h1 da tela de boas-vindas |
| `PasswordScreen.tsx` | Aplicar `sessionFont` no nome da sessão |
| `FinalizedGalleryScreen.tsx` | Aplicar `sessionFont` no nome da sessão |

### 6. Passagem de Dados

Fluxo de dados do font selecionado:

```text
GalleryCreate                    ClientGallery
     │                                │
     ▼                                ▼
configuracoes.sessionFont ────► gallery.settings.sessionFont
     │                                │
     ▼                                ▼
Supabase: galerias.configuracoes     Props para Header/Welcome/Password
```

---

## Arquivos a Criar/Modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `index.html` | Modificar | Adicionar link das 10 fontes Google |
| `src/components/FontSelect.tsx` | **Criar** | Componente seletor com preview |
| `src/pages/GalleryCreate.tsx` | Modificar | Estado + campo no Step 1 + salvar em configuracoes |
| `src/pages/ClientGallery.tsx` | Modificar | Extrair sessionFont e passar para componentes |
| `src/components/ClientGalleryHeader.tsx` | Modificar | Aceitar prop sessionFont e aplicar no h1 |
| `src/components/PasswordScreen.tsx` | Modificar | Aceitar prop sessionFont |
| `src/components/FinalizedGalleryScreen.tsx` | Modificar | Aceitar prop sessionFont |

---

## Preview do Componente FontSelect

```text
┌───────────────────────────────────────────┐
│  Fonte do Título                          │
├───────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐  │
│  │  Cormorant                      ▾   │  │  ← Dropdown
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  │      Ensaio Gestante               │  │  ← Preview com fonte aplicada
│  │      (fonte: Cormorant)            │  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

---

## Resultado na Galeria do Cliente

O nome da sessão será exibido na fonte escolhida pelo fotógrafo em:
- Tela de senha (se galeria privada)
- Tela de boas-vindas
- Header durante seleção
- Tela de confirmação final
