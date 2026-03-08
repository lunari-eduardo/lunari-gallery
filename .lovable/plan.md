

## Corrigir barra de navegação de pastas sobrepondo fotos

### Problema
A barra de navegação de pastas (`← Álbuns | teste asaas`) tem `sticky top-[60px]` assumindo que o header tem 60px fixos, mas o `ClientGalleryHeader` **não é sticky** — ele rola normalmente com a página. Resultado: a barra de pastas fica flutuando sobre as fotos com `top-[60px]` quando o header já saiu da tela.

### Solução
Alterar a barra de pastas para `sticky top-0` (em vez de `top-[60px]`), já que o header principal não é sticky e rola para fora da viewport. Assim, quando o usuário rola a página, a barra de pastas gruda no topo da tela sem sobrepor nada.

### Alteração

**`src/pages/ClientGallery.tsx`** — linha 1716:

- De: `sticky top-[60px] z-30`
- Para: `sticky top-0 z-30`

1 arquivo, 1 linha.

