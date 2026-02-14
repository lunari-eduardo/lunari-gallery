

# Remover extensao dos nomes de arquivo nos codigos de separacao

## Problema

No modal "Codigos para separacao das fotos" (`PhotoCodesModal.tsx`), os nomes dos arquivos incluem a extensao (ex: `LISE7187.JPG`). Isso impede a busca correta no Windows Explorer, Finder, Lightroom etc., pois o fotografo pode ter arquivos em formatos diferentes (`.CRC`, `.NEF`, `.CR2`, `.ARW`, `.DNG`, `.RAF`, `.TIFF`, entre outros).

Atualmente, apenas o formato Windows tenta remover extensoes, mas so cobre `.jpg`, `.jpeg` e `.png` em minusculo -- nao funciona para `.JPG` nem para formatos RAW.

## Solucao

Remover a extensao de **todos os formatos** usando uma funcao generica que elimina qualquer extensao do nome do arquivo. Isso garante compatibilidade com todos os formatos de imagem.

## Detalhe tecnico

**Arquivo**: `src/components/PhotoCodesModal.tsx`

Adicionar funcao auxiliar:
```
function removeExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}
```

Aplicar `removeExtension` no mapeamento de filenames (uma unica vez, para todos os formatos):
```
const filenames = selectedPhotos.map(p => removeExtension(p.originalFilename || p.filename));
```

E simplificar o case `windows` removendo os `.replace` manuais que existem hoje.

Resultado: `"LISE7187" OR "LISE7203" OR ...` em vez de `"LISE7187.JPG" OR "LISE7203.JPG" OR ...`

