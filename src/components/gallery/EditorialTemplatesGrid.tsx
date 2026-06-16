import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GalleryPhoto } from '@/types/gallery';
import { orientationFromAR, PhotoOrientation } from './editorialTemplates';

/**
 * Editorial Planner V4
 * --------------------
 * Evolução do V3 com foco em HIERARQUIA REAL de destaque e ritmo
 * editorial variado.
 *
 * Garantias:
 *  1. Toda foto com peso_visual=1 vira âncora visual (2x2 desktop/tablet,
 *     full-width mobile) e nunca é consumida como apoio.
 *  2. Foto sem destaque nunca recebe linha justificada gigante:
 *     - Desktop: linhas comuns têm K ∈ {3,4}. Nunca 1 ou 2 no meio.
 *     - Tablet:  linhas comuns têm K ∈ {2,3}. Nunca 1 no meio.
 *     - Mobile:  linhas comuns têm K = 2. K=1 só no tail final.
 *  3. Quando antes de um destaque sobram 1, 2 ou 5 fotos comuns (desktop)
 *     que dariam linha tosca, elas são ABSORVIDAS como apoios laterais do
 *     bloco de destaque seguinte.
 *  4. Lado da âncora alterna entre blocos (esquerda/direita) para quebrar
 *     a sensação de padrão repetitivo.
 *  5. Blocos intermediários SEMPRE preenchem 100% da largura útil.
 *  6. Apenas o tail (final da galeria) pode ser incompleto/centralizado.
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
  /** Mantido por compat — não usado pelo planner V4. */
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

type AnchorSide = 'left' | 'right';

interface PlanCtx {
  cols: number;
  cw: number;
  W: number;
  gap: number;
  lastAnchorSide: AnchorSide | null;
}

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

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------
// Linha justificada (sempre preenche 100% da W).
// ------------------------------------------------------------

const buildJustifiedRow = (
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

// ------------------------------------------------------------
// Particionamento de comuns em chunks "limpos".
// Desktop: usa 3s e 4s. Tablet: usa 2s e 3s. Mobile: pares.
// Pressupõe que `n` foi escolhido por chooseAbsorb para ser válido.
// ------------------------------------------------------------

const partitionDesktop = (n: number): number[] => {
  // Conjunto não-particionável em {3,4}: {1, 2, 5}.
  // Para qualquer outro n>=0, monta como 4s + um eventual 3 ou 3,3.
  if (n <= 0) return [];
  if (n === 3) return [3];
  if (n === 4) return [4];
  if (n === 6) return [3, 3];
  if (n === 7) return [4, 3];
  if (n === 8) return [4, 4];
  if (n === 9) return [3, 3, 3];
  // n >= 10: aplica 4s até resto cair em {3,4,6,7,8,9}.
  const out: number[] = [];
  let r = n;
  while (r > 9) {
    out.push(4);
    r -= 4;
  }
  return [...out, ...partitionDesktop(r)];
};

const partitionTablet = (n: number): number[] => {
  // Conjunto não-particionável em {2,3}: {1}.
  if (n <= 0) return [];
  if (n === 2) return [2];
  if (n === 3) return [3];
  if (n === 4) return [2, 2];
  if (n === 5) return [3, 2];
  const out: number[] = [];
  let r = n;
  while (r > 5) {
    out.push(3);
    r -= 3;
  }
  return [...out, ...partitionTablet(r)];
};

const partitionMobile = (n: number): number[] => {
  // Pares; só sobra 1 no final.
  const out: number[] = [];
  let r = n;
  while (r >= 2) {
    out.push(2);
    r -= 2;
  }
  if (r === 1) out.push(1);
  return out;
};

const partitionCommons = (n: number, cols: number): number[] => {
  if (cols === 4) return partitionDesktop(n);
  if (cols === 3) return partitionTablet(n);
  return partitionMobile(n);
};

const isValidCommonCount = (n: number, cols: number): boolean => {
  if (n === 0) return true;
  if (cols === 4) return n !== 1 && n !== 2 && n !== 5;
  if (cols === 3) return n !== 1;
  return n % 2 === 0;
};

/**
 * Escolhe quantas fotos comuns (entre 0 e maxBudget) o próximo bloco de
 * destaque deve "absorver" como apoios laterais, para que as comuns
 * restantes formem somente linhas válidas (3 ou 4 desktop, 2 ou 3 tablet,
 * pares no mobile). Prefere absorver MENOS para manter densidade.
 */
const chooseAbsorb = (total: number, cols: number, maxBudget: number): number => {
  const cap = Math.min(total, maxBudget);
  for (let absorb = 0; absorb <= cap; absorb++) {
    if (isValidCommonCount(total - absorb, cols)) return absorb;
  }
  return cap;
};

// ------------------------------------------------------------
// Bloco de destaque (V4).
// Posicionamento absoluto. Âncora 2x2 (desktop/tablet) ou full-width
// (mobile). Lado da âncora alterna para variar o ritmo.
// ------------------------------------------------------------

const computeAnchorHeight = (ar: number, cw: number): number => {
  const fW = 2 * cw + 0; // gap é pequeno; ignorado para clamp por cw.
  const ideal = fW / Math.max(0.6, ar);
  // Min subiu (1.5 -> 1.7) para garantir destaque > comum de 3 retratos.
  return clamp(ideal, 1.7 * cw, 2.45 * cw);
};

interface FeaturedResult {
  block: Block;
  consumed: number;        // total de itens consumidos a partir de `beforeStart`
  anchorSide: AnchorSide;  // lado escolhido (left/right) — para alternância
}

const buildFeaturedV4 = (
  items: NormPhoto[],
  beforeStart: number,
  beforeCount: number,
  featuredIdx: number,
  ctx: PlanCtx,
): FeaturedResult => {
  const { cols, cw, W, gap, lastAnchorSide } = ctx;
  const f = items[featuredIdx];

  // Apoios "depois" da destacada (até encontrar próxima destacada).
  const targetSupports = cols === 4 ? 4 : 2;
  const needFromAfter = Math.max(0, targetSupports - beforeCount);
  const afterSupports: NormPhoto[] = [];
  for (let k = 1; k <= needFromAfter && featuredIdx + k < items.length; k++) {
    if (items[featuredIdx + k].featured) break;
    afterSupports.push(items[featuredIdx + k]);
  }
  const beforeSupports = items.slice(beforeStart, beforeStart + beforeCount);
  const supports = [...beforeSupports, ...afterSupports];
  const afterConsumed = afterSupports.length;

  // Alterna lado.
  const anchorSide: AnchorSide = lastAnchorSide === 'left' ? 'right' : 'left';

  // ===== MOBILE (cols=2) =====
  if (cols === 2) {
    const fH = clamp(W / Math.max(0.7, f.ar), 1.25 * cw, 2.4 * cw);
    const cells: Cell[] = [{ photo: f.photo, x: 0, y: 0, w: W, h: fH }];
    let height = fH;
    if (supports.length >= 2) {
      const [s1, s2] = supports;
      const sumAR = s1.ar + s2.ar;
      const sH = (W - gap) / sumAR;
      const w1 = s1.ar * sH;
      const w2 = s2.ar * sH;
      cells.push({ photo: s1.photo, x: 0, y: fH + gap, w: w1, h: sH });
      cells.push({ photo: s2.photo, x: w1 + gap, y: fH + gap, w: w2, h: sH });
      height = fH + gap + sH;
    } else if (supports.length === 1) {
      const s1 = supports[0];
      const sH = clamp(W / Math.max(0.7, s1.ar), 0.55 * cw, 1.3 * cw);
      cells.push({ photo: s1.photo, x: 0, y: fH + gap, w: W, h: sH });
      height = fH + gap + sH;
    }
    return {
      block: { kind: 'featured', height, cells },
      consumed: beforeCount + 1 + afterConsumed,
      anchorSide: 'left', // mobile não alterna (full-width)
    };
  }

  // ===== DESKTOP/TABLET =====
  const fW = 2 * cw + gap;
  const sideCols = cols - 2;            // 2 desktop, 1 tablet
  const sideW = sideCols * cw + Math.max(0, sideCols - 1) * gap;

  const hBlock = computeAnchorHeight(f.ar, cw);
  const hHalf = (hBlock - gap) / 2;

  const anchorX = anchorSide === 'left' ? 0 : sideW + gap;
  const sideX = anchorSide === 'left' ? fW + gap : 0;

  const cells: Cell[] = [{ photo: f.photo, x: anchorX, y: 0, w: fW, h: hBlock }];

  // ----- DESKTOP (cols=4) -----
  if (cols === 4) {
    const col2DX = cw + gap;
    if (supports.length >= 4) {
      cells.push({ photo: supports[0].photo, x: sideX,            y: 0,            w: cw, h: hHalf });
      cells.push({ photo: supports[1].photo, x: sideX + col2DX,   y: 0,            w: cw, h: hHalf });
      cells.push({ photo: supports[2].photo, x: sideX,            y: hHalf + gap,  w: cw, h: hHalf });
      cells.push({ photo: supports[3].photo, x: sideX + col2DX,   y: hHalf + gap,  w: cw, h: hHalf });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: beforeCount + 1 + afterConsumed, anchorSide };
    }
    if (supports.length === 3) {
      cells.push({ photo: supports[0].photo, x: sideX,            y: 0,           w: cw,    h: hHalf });
      cells.push({ photo: supports[1].photo, x: sideX + col2DX,   y: 0,           w: cw,    h: hHalf });
      cells.push({ photo: supports[2].photo, x: sideX,            y: hHalf + gap, w: sideW, h: hHalf });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: beforeCount + 1 + afterConsumed, anchorSide };
    }
    if (supports.length === 2) {
      cells.push({ photo: supports[0].photo, x: sideX,            y: 0, w: cw, h: hBlock });
      cells.push({ photo: supports[1].photo, x: sideX + col2DX,   y: 0, w: cw, h: hBlock });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: beforeCount + 1 + afterConsumed, anchorSide };
    }
    if (supports.length === 1) {
      cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: sideW, h: hBlock });
      return { block: { kind: 'featured', height: hBlock, cells }, consumed: beforeCount + 1 + afterConsumed, anchorSide };
    }
    const fullH = clamp(W / Math.max(0.6, f.ar), 1.3 * cw, 2.4 * cw);
    return {
      block: { kind: 'featured', height: fullH, cells: [{ photo: f.photo, x: 0, y: 0, w: W, h: fullH }] },
      consumed: 1,
      anchorSide,
    };
  }

  // ----- TABLET (cols=3, sideCols=1) -----
  if (supports.length >= 2) {
    cells.push({ photo: supports[0].photo, x: sideX, y: 0,           w: cw, h: hHalf });
    cells.push({ photo: supports[1].photo, x: sideX, y: hHalf + gap, w: cw, h: hHalf });
    return { block: { kind: 'featured', height: hBlock, cells }, consumed: beforeCount + 1 + afterConsumed, anchorSide };
  }
  if (supports.length === 1) {
    cells.push({ photo: supports[0].photo, x: sideX, y: 0, w: cw, h: hBlock });
    return { block: { kind: 'featured', height: hBlock, cells }, consumed: beforeCount + 1 + afterConsumed, anchorSide };
  }
  const fullH = clamp(W / Math.max(0.6, f.ar), 1.3 * cw, 2.4 * cw);
  return {
    block: { kind: 'featured', height: fullH, cells: [{ photo: f.photo, x: 0, y: 0, w: W, h: fullH }] },
    consumed: 1,
    anchorSide,
  };
};

// ------------------------------------------------------------
// Tail final (única posição onde k=1/k=2 são permitidos no meio?
// Não — k=1/k=2 só aqui).
// ------------------------------------------------------------

const buildTailBlock = (
  items: NormPhoto[],
  start: number,
  count: number,
  W: number,
  gap: number,
  cw: number,
): Block => {
  const row = buildJustifiedRow(items, start, count, W, gap);
  const cappedH = Math.min(row.height, 1.55 * cw);
  if (count === 1) {
    const ar = items[start].ar;
    const w = Math.min(W, cappedH * ar);
    return {
      kind: 'tail',
      height: cappedH,
      cells: [{ photo: items[start].photo, x: (W - w) / 2, y: 0, w, h: cappedH }],
    };
  }
  // Reescala mantendo 100% W.
  const scale = cappedH / row.height;
  const scaled = row.cells.map((c) => ({ ...c, h: cappedH, w: c.w * scale }));
  const sumW = scaled.reduce((a, c) => a + c.w, 0);
  const totalGap = (scaled.length - 1) * gap;
  const stretch = (W - totalGap - sumW) / scaled.length;
  let x = 0;
  const out = scaled.map((c) => {
    const w = c.w + stretch;
    const o = { ...c, x, w };
    x += w + gap;
    return o;
  });
  return { kind: 'tail', height: cappedH, cells: out };
};

// ------------------------------------------------------------
// Planner principal V4.
// ------------------------------------------------------------

const planEditorial = (
  raw: NormPhoto[],
  cols: number,
  W: number,
  gap: number,
): Block[] => {
  const items = raw.slice();
  const blocks: Block[] = [];
  const cw = (W - (cols - 1) * gap) / cols;
  const ctx: PlanCtx = { cols, cw, W, gap, lastAnchorSide: null };

  // Quantos comuns "antes" um bloco de destaque pode absorver como apoio.
  const maxAbsorb = cols === 4 ? 4 : cols === 3 ? 2 : 2;

  let i = 0;
  while (i < items.length) {
    // Próximo destaque a partir de i.
    let nextF = -1;
    for (let j = i; j < items.length; j++) {
      if (items[j].featured) { nextF = j; break; }
    }

    if (nextF === -1) {
      // Sem mais destaques — empacota o resto em chunks válidos + tail.
      const n = items.length - i;
      // Tenta partição "limpa"; se n inválido (1, 2 ou 5 desktop), libera tail.
      let chunks: number[];
      if (isValidCommonCount(n, cols)) {
        chunks = partitionCommons(n, cols);
      } else {
        // Coloca o máximo possível em chunks válidos e deixa o resíduo como tail.
        // Para n inválido, separa últimos 1, 2 ou 5 fotos como tail.
        let tailSize = 0;
        for (let t = 1; t <= n; t++) {
          if (isValidCommonCount(n - t, cols)) {
            tailSize = t;
            break;
          }
        }
        const head = n - tailSize;
        chunks = [...partitionCommons(head, cols)];
        if (tailSize > 0) chunks.push(-tailSize); // negativo marca tail
      }
      let cursor = i;
      for (const c of chunks) {
        if (c < 0) {
          const k = -c;
          blocks.push(buildTailBlock(items, cursor, k, W, gap, cw));
          cursor += k;
        } else {
          blocks.push(buildJustifiedRow(items, cursor, c, W, gap));
          cursor += c;
        }
      }
      i = items.length;
      break;
    }

    // Há destaque em nextF. Decide quantos comuns absorver como apoio.
    const beforeTotal = nextF - i;
    const absorb = chooseAbsorb(beforeTotal, cols, maxAbsorb);
    const emitCount = beforeTotal - absorb;

    if (emitCount > 0) {
      const chunks = partitionCommons(emitCount, cols);
      let cursor = i;
      for (const k of chunks) {
        blocks.push(buildJustifiedRow(items, cursor, k, W, gap));
        cursor += k;
      }
      i += emitCount;
    }

    // Constrói o bloco de destaque consumindo `absorb` antes + apoios depois.
    const r = buildFeaturedV4(items, i, absorb, nextF, ctx);
    blocks.push(r.block);
    ctx.lastAnchorSide = r.anchorSide;
    i += r.consumed;
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
      console.debug('[editorial-v4] plan', {
        total: norm.length,
        featured: norm.filter((n) => n.featured).length,
        cols,
        maxPerRow,
        innerWidth,
      });
    }

    return planEditorial(norm, cols, innerWidth, gap);
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
