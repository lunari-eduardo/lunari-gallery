import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GalleryPhoto } from '@/types/gallery';
import { orientationFromAR, PhotoOrientation } from './editorialTemplates';

/**
 * Editorial Planner V3
 * --------------------
 * Substitui a seleção cíclica de templates por um planner espacial
 * orientado a blocos:
 *
 *   - normal-row  : 1..maxPerRow células justificadas em 100% da largura.
 *   - featured    : mosaico com a foto destacada como âncora 2x2 (desktop/tablet)
 *                   ou full-width (mobile), preenchendo 100% da largura.
 *   - tail        : último resíduo da galeria (única posição onde
 *                   incompleto é tolerado).
 *
 * Garantias:
 *   1. Toda foto com peso_visual=1 vira âncora visual (nunca consumida
 *      como apoio comum no meio da galeria).
 *   2. Foto sem destaque nunca recebe tratamento de hero/destaque.
 *   3. Blocos intermediários ocupam 100% da largura útil (matematicamente).
 *   4. Apenas o bloco final (tail) pode ficar incompleto.
 *   5. Ordem narrativa preservada; permitida apenas troca local entre
 *      idx e idx+1 quando isso evita um solo não-destaque seguido de
 *      destaque (puxa destaque para a âncora).
 */

interface Props {
  photos: GalleryPhoto[];
  gap: number;
  onPhotoClick?: (photo: GalleryPhoto) => void;
  renderItem?: (photo: GalleryPhoto, style: React.CSSProperties) => React.ReactNode;
  containerWidth?: number;
  maxContainerWidth?: {
    desktopSm?: number | null;
    desktopMd?: number | null;
    desktopLg?: number | null;
  };
  maxItemsPerStrip?: { mobile: number; tablet: number; desktop: number };
  /** Mantido por compat — não usado pelo planner V3. */
  featuredCooldown?: number;
}

type NormPhoto = {
  photo: GalleryPhoto;
  ar: number;
  o: PhotoOrientation;
  featured: boolean;
};

type Cell = {
  photo: GalleryPhoto;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Block = {
  kind: 'normal' | 'featured' | 'tail';
  height: number;
  cells: Cell[];
};

const isFeaturedPhoto = (p: any): boolean => {
  const v = p?.pesoVisual ?? p?.peso_visual ?? 0;
  return Number(v) === 1;
};

const arOf = (p: GalleryPhoto): number => {
  const w = p.width || 1;
  const h = p.height || 1;
  return Math.max(0.3, Math.min(3.5, w / h));
};

const normalize = (photos: GalleryPhoto[]): NormPhoto[] =>
  photos.map((p) => {
    const ar = arOf(p);
    return { photo: p, ar, o: orientationFromAR(ar), featured: isFeaturedPhoto(p) };
  });

// ------------------------------------------------------------
// Bloco comum (linha justificada — sempre preenche 100% da W).
// ------------------------------------------------------------

const buildNormalRow = (
  items: NormPhoto[],
  start: number,
  count: number,
  W: number,
  gap: number,
): Block => {
  const slice = items.slice(start, start + count);
  const sumAR = slice.reduce((a, it) => a + it.ar, 0) || 1;
  const h = (W - (count - 1) * gap) / sumAR;
  let x = 0;
  const cells: Cell[] = slice.map((it) => {
    const w = it.ar * h;
    const cell: Cell = { photo: it.photo, x, y: 0, w, h };
    x += w + gap;
    return cell;
  });
  return { kind: 'normal', height: h, cells };
};

/**
 * Escolhe o melhor número de fotos para a próxima linha comum.
 * - Respeita o cap por breakpoint.
 * - Garante h dentro de [hMin, hMax] para evitar linhas gigantes
 *   ou esmagadas.
 * - Nunca consome uma foto destacada (a busca para antes dela).
 */
const pickNormalRowSize = (
  items: NormPhoto[],
  start: number,
  maxK: number,
  cw: number,
  W: number,
  gap: number,
): number => {
  // Para antes do próximo destaque.
  let avail = 0;
  for (let i = start; i < items.length && avail < maxK; i++) {
    if (items[i].featured) break;
    avail++;
  }
  if (avail <= 0) return 0;

  const hMin = 0.55 * cw;
  const hMax = 1.85 * cw;

  // Prefere K maior (linha mais cheia, fotos menores). Aceita o maior K
  // que devolva altura plausível.
  for (let k = Math.min(maxK, avail); k >= 1; k--) {
    const slice = items.slice(start, start + k);
    const sumAR = slice.reduce((a, it) => a + it.ar, 0) || 1;
    const h = (W - (k - 1) * gap) / sumAR;
    if (h >= hMin && h <= hMax) return k;
  }
  // Fallback: usa todo o disponível (será clamped pela altura natural).
  return avail;
};

// ------------------------------------------------------------
// Mosaico com destaque (âncora visual real).
// ------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Constrói o bloco de destaque. Pode consumir até `maxSupports` fotos
 * de apoio depois da destacada. As variantes preenchem 100% da largura.
 */
const buildFeaturedBlock = (
  items: NormPhoto[],
  start: number,
  cols: number,
  cw: number,
  W: number,
  gap: number,
): { block: Block; consumed: number } => {
  const f = items[start];

  // Quantos apoios pegamos depois da destacada (até encontrar o próximo destaque).
  const maxSupports = cols === 4 ? 4 : cols === 3 ? 2 : 2;
  const supports: NormPhoto[] = [];
  for (let k = 1; k <= maxSupports && start + k < items.length; k++) {
    if (items[start + k].featured) break;
    supports.push(items[start + k]);
  }

  // ------------------ MOBILE (2 colunas) ------------------
  if (cols === 2) {
    // Destaque full-width + (opcional) par de apoios abaixo.
    const fW = W;
    const fH = clamp(fW / Math.max(0.7, f.ar), 1.1 * cw, 2.4 * cw);

    const cells: Cell[] = [
      { photo: f.photo, x: 0, y: 0, w: fW, h: fH },
    ];
    let height = fH;
    let consumed = 1;

    if (supports.length >= 2) {
      // Linha de 2 apoios justificada em 100% logo abaixo.
      const s1 = supports[0];
      const s2 = supports[1];
      const sumAR = s1.ar + s2.ar;
      const sH = (W - gap) / sumAR;
      const w1 = s1.ar * sH;
      const w2 = s2.ar * sH;
      cells.push({ photo: s1.photo, x: 0, y: fH + gap, w: w1, h: sH });
      cells.push({ photo: s2.photo, x: w1 + gap, y: fH + gap, w: w2, h: sH });
      height = fH + gap + sH;
      consumed = 3;
    } else if (supports.length === 1) {
      // Apoio único full-width abaixo (mantém regra de 100%).
      const s1 = supports[0];
      const sH = clamp(W / Math.max(0.7, s1.ar), 0.6 * cw, 1.4 * cw);
      cells.push({ photo: s1.photo, x: 0, y: fH + gap, w: W, h: sH });
      height = fH + gap + sH;
      consumed = 2;
    }
    return { block: { kind: 'featured', height, cells }, consumed };
  }

  // ------------------ TABLET/DESKTOP ------------------
  // Featured 2x2 ocupa colunas 0..1; lado livre = (cols-2) colunas.
  const fW = 2 * cw + gap;
  const sideCols = cols - 2; // 1 (tablet) ou 2 (desktop)
  const sideW = sideCols * cw + (sideCols - 1) * gap;

  // Altura natural do destaque preservando o AR; capada para ritmo editorial.
  const fHIdeal = fW / Math.max(0.6, f.ar);
  const hBlock = clamp(fHIdeal, 1.5 * cw, 2.4 * cw);
  const hHalf = (hBlock - gap) / 2;

  const cells: Cell[] = [
    { photo: f.photo, x: 0, y: 0, w: fW, h: hBlock },
  ];

  // ===== DESKTOP (4 cols, sideCols=2) =====
  if (cols === 4) {
    const sideX = fW + gap;
    const col2X = sideX + cw + gap;

    if (supports.length >= 4) {
      // Lado livre: matriz 2x2 (4 apoios).
      cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: cw, h: hHalf });
      cells.push({ photo: supports[1].photo, x: col2X, y: 0, w: cw, h: hHalf });
      cells.push({ photo: supports[2].photo, x: sideX, y: hHalf + gap, w: cw, h: hHalf });
      cells.push({ photo: supports[3].photo, x: col2X, y: hHalf + gap, w: cw, h: hHalf });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: 5 };
    }
    if (supports.length === 3) {
      // 2 apoios em cima + 1 apoio largo embaixo (cw*2+gap).
      cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: cw, h: hHalf });
      cells.push({ photo: supports[1].photo, x: col2X, y: 0, w: cw, h: hHalf });
      cells.push({ photo: supports[2].photo, x: sideX, y: hHalf + gap, w: sideW, h: hHalf });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: 4 };
    }
    if (supports.length === 2) {
      // 2 apoios em coluna full-height (cada cw × hBlock).
      cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: cw, h: hBlock });
      cells.push({ photo: supports[1].photo, x: col2X, y: 0, w: cw, h: hBlock });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: 3 };
    }
    if (supports.length === 1) {
      // 1 apoio largo ocupando todo o lado.
      cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: sideW, h: hBlock });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: 2 };
    }
    // Sem apoios: destaque full-width (4 cols).
    const fullH = clamp(W / Math.max(0.6, f.ar), 1.2 * cw, 2.4 * cw);
    return {
      block: {
        kind: 'featured',
        height: fullH,
        cells: [{ photo: f.photo, x: 0, y: 0, w: W, h: fullH }],
      },
      consumed: 1,
    };
  }

  // ===== TABLET (3 cols, sideCols=1) =====
  const sideX = fW + gap;

  if (supports.length >= 2) {
    // 2 apoios empilhados na coluna lateral.
    cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: cw, h: hHalf });
    cells.push({ photo: supports[1].photo, x: sideX, y: hHalf + gap, w: cw, h: hHalf });
    return { block: { kind: 'featured', height: hBlock, cells }, consumed: 3 };
  }
  if (supports.length === 1) {
    // 1 apoio full-height.
    cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: cw, h: hBlock });
    return { block: { kind: 'featured', height: hBlock, cells }, consumed: 2 };
  }
  // Sem apoios: destaque full-width (3 cols).
  const fullH = clamp(W / Math.max(0.6, f.ar), 1.2 * cw, 2.4 * cw);
  return {
    block: {
      kind: 'featured',
      height: fullH,
      cells: [{ photo: f.photo, x: 0, y: 0, w: W, h: fullH }],
    },
    consumed: 1,
  };
};

// ------------------------------------------------------------
// Planner principal.
// ------------------------------------------------------------

const planEditorial = (
  raw: NormPhoto[],
  cols: number,
  W: number,
  gap: number,
  maxPerRow: number,
): Block[] => {
  // Cópia trabalhável (permite swap local idx <-> idx+1 quando necessário).
  const items: NormPhoto[] = raw.slice();
  const blocks: Block[] = [];
  const cw = (W - (cols - 1) * gap) / cols;

  let idx = 0;
  while (idx < items.length) {
    const cur = items[idx];
    const remaining = items.length - idx;

    // Swap local: se a próxima é destaque e a atual não é, puxa o destaque
    // para a posição atual — evita "solo não-destaque" seguido de destaque
    // que enterraria a marcação.
    if (!cur.featured && remaining >= 2 && items[idx + 1].featured) {
      // Só fazemos o swap se a foto não-destacada não criar "solo" depois
      // do destaque: o pior caso vira apoio dentro do mosaico — ok.
      const tmp = items[idx];
      items[idx] = items[idx + 1];
      items[idx + 1] = tmp;
    }

    const head = items[idx];

    if (head.featured) {
      const { block, consumed } = buildFeaturedBlock(items, idx, cols, cw, W, gap);
      blocks.push(block);
      idx += consumed;
      continue;
    }

    // Bloco comum (linha justificada). Para antes do próximo destaque.
    const k = pickNormalRowSize(items, idx, maxPerRow, cw, W, gap);
    if (k <= 0) {
      // Defesa: não deveria acontecer.
      idx++;
      continue;
    }

    // Última linha incompleta? Marca como tail e capa altura.
    const isTail = idx + k >= items.length && k < maxPerRow;
    const row = buildNormalRow(items, idx, k, W, gap);

    if (isTail) {
      const cappedH = Math.min(row.height, 1.6 * cw);
      // Reescala larguras proporcionalmente (mantendo 100% W).
      const scale = cappedH / row.height;
      const cells = row.cells.map((c) => ({
        ...c,
        h: cappedH,
        w: c.w * scale,
      }));
      // Re-justifica X para fechar gaps (mantém 100% via stretch final).
      let x = 0;
      const sumW = cells.reduce((a, c) => a + c.w, 0);
      const totalGap = (cells.length - 1) * gap;
      const stretch = cells.length > 1 ? (W - totalGap - sumW) / cells.length : 0;
      const tailCells = cells.map((c) => {
        const w = c.w + stretch;
        const out = { ...c, x, w };
        x += w + gap;
        return out;
      });
      // Para 1 foto solo no tail, centralizamos via offset x.
      if (tailCells.length === 1) {
        const w = Math.min(W, cappedH * raw[idx].ar);
        tailCells[0] = { ...tailCells[0], w, x: (W - w) / 2 };
      }
      blocks.push({ kind: 'tail', height: cappedH, cells: tailCells });
    } else {
      blocks.push(row);
    }
    idx += k;
  }

  return blocks;
};

// ------------------------------------------------------------
// Componente.
// ------------------------------------------------------------

export const EditorialTemplatesGrid: React.FC<Props> = ({
  photos,
  gap,
  onPhotoClick,
  renderItem,
  containerWidth: externalWidth,
  maxContainerWidth,
  maxItemsPerStrip,
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [outerWidth, setOuterWidth] = useState(0);

  useEffect(() => {
    if (externalWidth !== undefined) {
      setOuterWidth(externalWidth);
      return;
    }
    if (!outerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setOuterWidth(e.contentRect.width);
    });
    obs.observe(outerRef.current);
    return () => obs.disconnect();
  }, [externalWidth]);

  const innerWidth = useMemo(() => {
    if (outerWidth <= 0) return 0;
    if (!maxContainerWidth) return outerWidth;
    let cap: number | null | undefined;
    if (outerWidth >= 2000) cap = maxContainerWidth.desktopLg;
    else if (outerWidth >= 1600) cap = maxContainerWidth.desktopMd;
    else if (outerWidth >= 1280) cap = maxContainerWidth.desktopSm;
    if (cap && cap > 0) return Math.min(outerWidth, cap);
    return outerWidth;
  }, [outerWidth, maxContainerWidth]);

  const blocks = useMemo<Block[]>(() => {
    if (innerWidth <= 0 || photos.length === 0) return [];
    const cols = innerWidth < 640 ? 2 : innerWidth < 1024 ? 3 : 4;
    const maxPerRow = maxItemsPerStrip
      ? (cols === 2 ? maxItemsPerStrip.mobile : cols === 3 ? maxItemsPerStrip.tablet : maxItemsPerStrip.desktop)
      : cols;
    const norm = normalize(photos);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[editorial-v3] plan', {
        total: norm.length,
        featured: norm.filter((n) => n.featured).length,
        cols,
        maxPerRow,
        innerWidth,
      });
    }

    return planEditorial(norm, cols, innerWidth, gap, maxPerRow);
  }, [photos, innerWidth, gap, maxItemsPerStrip]);

  const renderCell = (cell: Cell, isAbsolute: boolean) => {
    const style: React.CSSProperties = isAbsolute
      ? {
          position: 'absolute',
          left: cell.x,
          top: cell.y,
          width: cell.w,
          height: cell.h,
          cursor: 'pointer',
          overflow: 'hidden',
        }
      : {
          width: cell.w,
          height: cell.h,
          flexShrink: 0,
          cursor: 'pointer',
          overflow: 'hidden',
        };

    if (renderItem) return renderItem(cell.photo, style);

    const url =
      (cell.photo as any).previewPath ||
      (cell.photo as any).previewUrl ||
      (cell.photo as any).thumbnailUrl;

    return (
      <div
        key={cell.photo.id}
        style={style}
        onClick={() => onPhotoClick?.(cell.photo)}
        className="overflow-hidden"
      >
        <img
          src={url}
          alt={cell.photo.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  };

  return (
    <div ref={outerRef} className="w-full flex justify-center">
      <div
        className="flex flex-col"
        style={{ gap: `${gap}px`, width: innerWidth || '100%' }}
      >
        {blocks.map((block, bi) => {
          const key = `b-${bi}`;
          if (block.kind === 'featured') {
            // Renderiza com posicionamento absoluto (mosaico real).
            return (
              <div
                key={key}
                className="relative w-full"
                style={{ height: block.height, width: '100%' }}
              >
                {block.cells.map((c) => (
                  <React.Fragment key={c.photo.id}>
                    {renderCell(c, true)}
                  </React.Fragment>
                ))}
              </div>
            );
          }
          // Linha justificada normal/tail.
          return (
            <div
              key={key}
              className="relative w-full"
              style={{ height: block.height, width: '100%' }}
            >
              {block.cells.map((c) => (
                <React.Fragment key={c.photo.id}>
                  {renderCell(c, true)}
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
