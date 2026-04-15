

# Ajustes na Galeria do Cliente

## Mudança 1: "fotos incluídas" → "fotos contratadas"

Na tela de acesso (welcome screen), linha 1603 de `ClientGallery.tsx`:
```
"{gallery.includedPhotos} fotos incluídas" → "{gallery.includedPhotos} fotos contratadas"
```

## Mudança 2: Barra de pastas não-fixa

Na barra de navegação de pastas (linha 1890 de `ClientGallery.tsx`), remover `sticky top-0 z-30` para que ela role junto com o conteúdo:
```
"sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/30 px-3 py-2"
→
"bg-background border-b border-border/30 px-3 py-2"
```

Remove `sticky`, `top-0`, `z-30` e `backdrop-blur` (não necessário sem sticky). Mantém o fundo e borda para separação visual.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientGallery.tsx` | Linha 1603: texto "contratadas"; Linha 1890: remover sticky |

