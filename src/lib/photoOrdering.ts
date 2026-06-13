/**
 * Ordenação canônica de fotos em qualquer galeria.
 *
 * Regra única: ordem alfabética natural pelo nome original do arquivo,
 * com comparação numérica ("a (2).jpg" < "a (10).jpg") e desempate
 * determinístico por id.
 *
 * Esta função é a FONTE ÚNICA DE VERDADE de ordenação. Telas e edge
 * functions devem usar esta função em vez de confiar em `order_index`,
 * `created_at` ou na ordem retornada pelo Postgres em empates.
 */

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

type AnyPhoto = Record<string, any>;

export function getPhotoDisplaySortName(p: AnyPhoto): string {
  return (
    p?.originalFilename ||
    p?.original_filename ||
    p?.displayName ||
    p?.display_name ||
    p?.filename ||
    p?.storageKey ||
    p?.storage_key ||
    p?.id ||
    ''
  );
}

export function comparePhotoByNaturalFilename(a: AnyPhoto, b: AnyPhoto): number {
  const nameA = getPhotoDisplaySortName(a);
  const nameB = getPhotoDisplaySortName(b);
  const cmp = collator.compare(nameA, nameB);
  if (cmp !== 0) return cmp;
  const idA = String(a?.id ?? '');
  const idB = String(b?.id ?? '');
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

export function sortPhotosByNaturalFilename<T extends AnyPhoto>(photos: T[]): T[] {
  if (!Array.isArray(photos) || photos.length <= 1) return photos ? [...photos] : [];
  // Decorate-sort-undecorate para estabilidade garantida em qualquer engine JS.
  return photos
    .map((p, i) => ({ p, i, name: getPhotoDisplaySortName(p) }))
    .sort((a, b) => {
      const cmp = collator.compare(a.name, b.name);
      if (cmp !== 0) return cmp;
      const idA = String((a.p as any)?.id ?? '');
      const idB = String((b.p as any)?.id ?? '');
      if (idA < idB) return -1;
      if (idA > idB) return 1;
      return a.i - b.i;
    })
    .map((x) => x.p);
}
