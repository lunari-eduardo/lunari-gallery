

# Tela de galeria finalizada: diferenciar com/sem download

## Problema

Após finalização + pagamento, galerias sem download ativo mostram a `FinalizedPreviewScreen` com fotos em preview (marcas d'água) sem opção de download — experiência confusa. O usuário quer:

1. **Sem download ativo**: Mensagem clara "Sua galeria já foi finalizada, para acessá-la novamente, entre em contato com o(a) fotógrafo(a)"
2. **Com download ativo**: Manter comportamento atual (fotos + botão download)

## Solução

### 1. `FinalizedPreviewScreen.tsx` — Bifurcar exibição

Quando `allowDownload === false`, renderizar uma tela simples com:
- Logo do estúdio (se disponível)
- Ícone de check
- "Seleção Confirmada" + contagem de fotos
- Mensagem: "Sua galeria já foi finalizada. Para acessá-la novamente, entre em contato com o(a) fotógrafo(a)."
- SEM grid de fotos, SEM lightbox

Quando `allowDownload === true`, manter o comportamento atual completo (grid + download).

### 2. Sem mudanças no backend

O `gallery-access` já retorna `finalized: true` com `allowDownload` correto. O `ClientGallery.tsx` já passa `allowDownload` para o componente. A mudança é 100% no componente de apresentação.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/components/FinalizedPreviewScreen.tsx` | Quando `allowDownload=false`, mostrar tela de mensagem em vez do grid de fotos |

