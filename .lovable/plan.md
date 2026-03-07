

# Dropdown de Pacotes e Templates de Desconto na Edição de Galeria

## Contexto
Atualmente, o `GalleryEdit` usa campos `Input` simples para "Pacote" e "Valor Foto Extra". O `GalleryCreate` já tem a lógica condicional com `PackageSelect` + `useGestaoPackages` para usuários com integração Gestão. Precisamos replicar esse padrão no `GalleryEdit`, adicionando também suporte a templates de desconto para usuários sem integração.

## Plano

### 1. `src/pages/GalleryEdit.tsx` — Adicionar dropdown de pacotes e templates

**Imports novos:**
- `useAuthContext` (para `hasGestaoIntegration`)
- `useGestaoPackages` (para listar pacotes da tabela `pacotes`)
- `useSettings` (para `discountPresets` — templates de desconto salvos)
- `PackageSelect` (componente dropdown já existente)

**Lógica condicional no campo "Pacote (opcional)":**
- Se `hasGestaoIntegration && gestaoPackages.length > 0`: renderizar `PackageSelect` (dropdown searchable com pacotes do Gestão)
  - Ao selecionar pacote: preencher automaticamente `fotosIncluidas` e `valorFotoExtra` a partir do pacote
- Senão: manter `Input` de texto livre (comportamento atual)

**Lógica condicional no campo "Valor Foto Extra (R$)":**
- Se `hasGestaoIntegration` e pacote selecionado tiver `valorFotoExtra`: mostrar valor preenchido automaticamente (editável)
- Comportamento atual mantido para edição manual

**Templates de desconto (usuários sem integração):**
- Abaixo dos campos de preço, se o usuário tiver `discountPresets` salvos (via `useSettings`), exibir um `Select` dropdown para carregar um template de desconto
- Ao selecionar template: preencher `valorFotoExtra` com o primeiro tier do template

### 2. Mudanças específicas no código

No início do componente `GalleryEdit`:
```typescript
const { hasGestaoIntegration } = useAuthContext();
const { packages: gestaoPackages, isLoading: isLoadingPackages } = useGestaoPackages();
const { settings } = useSettings();
```

No bloco do campo "Pacote (opcional)" (linhas ~383-391):
- Substituir `Input` por lógica condicional idêntica à do `GalleryCreate` (linhas 1107-1119)
- `onSelect` do `PackageSelect` atualiza `nomePacote`, `fotosIncluidas` e `valorFotoExtra`

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/GalleryEdit.tsx` | Importar hooks/componentes, adicionar lógica condicional para pacotes e templates |

