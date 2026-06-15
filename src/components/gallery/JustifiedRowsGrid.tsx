import React, { useMemo, useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { GalleryPhoto } from '@/types/gallery';

interface JustifiedRowsGridProps {
  photos: GalleryPhoto[];
  gap: number;
  targetRowHeight: number;
  onPhotoClick?: (photo: GalleryPhoto) => void;
  renderItem?: (photo: GalleryPhoto, style: React.CSSProperties) => React.ReactNode;
  containerWidth?: number;
  /** Quando false, ignora pesoVisual e nunca amplia fotos destacadas. Default: true. */
  featuredEnabled?: boolean;
  /** Quando definido, força N colunas por breakpoint preservando ordem e proporção. */
  fixedColumns?: { mobile: number; tablet: number; desktop: number };
  /** Clean: grade rígida de tiles uniformes (mesmo tamanho, mesmo AR, ordem fixa). */
  uniformTiles?: {
    aspect: number;
    tilesPerRow: { mobile: number; tablet: number; desktop: number };
  };
  /** Lunari: cap de fotos por linha no modo justificado. */
  maxItemsPerRow?: { mobile: number; tablet: number; desktop: number };
  /** Clean: masonry de colunas fixas preservando proporção original. */
  masonryColumns?: { mobile: number; tablet: number; desktop: number };
  /** Clean v2: grade uniforme; horizontais ocupam N colunas. */
  uniformGridSpan?: {
    cols: { mobile: number; tablet: number; desktop: number };
    cellAspect: number;
    landscapeSpan: 1 | 2;
    lookaheadSwap?: boolean;
  };
  /** Editorial Clássico: foto destaque ocupa 2 colunas × 2 linhas reais. */
  pairedRowsFeatured?: boolean;
}

interface LayoutItem {
  photo: GalleryPhoto;
  width: number;
  height: number;
  isFeatured: boolean;
}

interface LayoutRow {
  items: LayoutItem[];
  rowHeight: number;
}

export const JustifiedRowsGrid: React.FC<JustifiedRowsGridProps> = ({
  photos,
  gap,
  targetRowHeight,
  onPhotoClick,
  renderItem,
  containerWidth: externalWidth,
  featuredEnabled = true,
  fixedColumns,
  uniformTiles,
  maxItemsPerRow,
  masonryColumns,
  uniformGridSpan,
  pairedRowsFeatured,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalWidth, setInternalWidth] = useState(0);

  useEffect(() => {
    if (externalWidth !== undefined) {
      setInternalWidth(externalWidth);
      return;
    }

    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setInternalWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [externalWidth]);

  const rows = useMemo(() => {
    if (internalWidth <= 0 || photos.length === 0) return [];

    const isMobile = internalWidth < 500;
    const effectiveRowHeight = isMobile ? Math.max(220, internalWidth * 0.55) : targetRowHeight;
    const minItemsPerRow = isMobile ? 1 : 2;

    const ratioOf = (p: GalleryPhoto) =>
      p.width && p.height ? p.width / p.height : 1.5;

    // ============ MODO TILES UNIFORMES (Clean) ============
    // Todas as fotos viram tiles do MESMO tamanho e MESMO aspect ratio.
    // A foto é encaixada via object-cover (corte central) — orientação
    // original da foto não importa visualmente. Ordem narrativa preservada.
    if (uniformTiles) {
      const tilesPerRow = internalWidth < 640
        ? uniformTiles.tilesPerRow.mobile
        : internalWidth < 1024
        ? uniformTiles.tilesPerRow.tablet
        : uniformTiles.tilesPerRow.desktop;
      const N = Math.max(1, tilesPerRow);
      const rowGaps = (N - 1) * gap;
      const tileWidth = (internalWidth - rowGaps) / N;
      const tileHeight = tileWidth / uniformTiles.aspect;

      const layoutRows: LayoutRow[] = [];
      for (let i = 0; i < photos.length; i += N) {
        const chunk = photos.slice(i, i + N);
        layoutRows.push({
          rowHeight: tileHeight,
          items: chunk.map(p => ({
            photo: p,
            isFeatured: false,
            height: tileHeight,
            width: tileWidth,
          })),
        });
      }
      return layoutRows;
    }

    // ============ MODO COLUNAS FIXAS ============
    // Particiona fotos na ordem original em chunks de N colunas e justifica
    // cada chunk preservando proporção de cada item. Última linha parcial
    // herda altura média e fica alinhada à esquerda sem buracos visíveis.
    if (fixedColumns) {
      const cols = internalWidth < 640
        ? fixedColumns.mobile
        : internalWidth < 1024
        ? fixedColumns.tablet
        : fixedColumns.desktop;

      const chunks: GalleryPhoto[][] = [];
      for (let i = 0; i < photos.length; i += cols) {
        chunks.push(photos.slice(i, i + cols));
      }

      const fullChunks = chunks.filter(c => c.length === cols);
      const avgRatio = fullChunks.length > 0
        ? fullChunks.reduce((acc, c) => acc + c.reduce((a, p) => a + ratioOf(p), 0), 0)
          / (fullChunks.length * cols)
        : 1.5;

      const layoutRows: LayoutRow[] = chunks.map((chunk) => {
        const N = chunk.length;
        const sumRatio = chunk.reduce((a, p) => a + ratioOf(p), 0);
        const rowGaps = (cols - 1) * gap;
        const denom = N === cols
          ? sumRatio
          : sumRatio + (cols - N) * avgRatio;
        const rowHeight = (internalWidth - rowGaps) / denom;
        return {
          rowHeight,
          items: chunk.map(p => ({
            photo: p,
            isFeatured: false,
            height: rowHeight,
            width: rowHeight * ratioOf(p),
          })),
        };
      });

      return layoutRows;
    }

    // ============ MODO JUSTIFICADO PADRÃO ============
    // Cap de itens por linha (Lunari): evita 6+ verticais minúsculas por linha.
    const itemsCap = maxItemsPerRow
      ? (internalWidth < 640
          ? maxItemsPerRow.mobile
          : internalWidth < 1024
          ? maxItemsPerRow.tablet
          : maxItemsPerRow.desktop)
      : Infinity;

    const layoutRows: LayoutRow[] = [];
    let currentRow: LayoutItem[] = [];
    let currentRowWidth = 0;

    // Peso de destaque é aplicado APENAS na lógica de quebra de linha
    // (virtualWidth), NUNCA no AR renderizado. Assim, foto vertical destacada
    // continua vertical (orientação preservada) e foto horizontal destacada
    // continua horizontal — destaque vira "ocupar mais peso de linha".
    const FEATURED_WEIGHT = 1.8;

    const flushRow = (justified: boolean) => {
      if (currentRow.length === 0) return;
      const rowGaps = (currentRow.length - 1) * gap;
      const sumAspectRatios = currentRow.reduce(
        (acc, item) => acc + ratioOf(item.photo),
        0,
      );
      let finalHeight = (internalWidth - rowGaps) / sumAspectRatios;
      if (!justified && currentRow.length === 1 && layoutRows.length > 0) {
        const avgPrev = layoutRows.reduce((a, r) => a + r.rowHeight, 0) / layoutRows.length;
        const cap = Math.min(finalHeight, avgPrev * 1.6);
        finalHeight = Math.max(cap, effectiveRowHeight);
      }
      layoutRows.push({
        items: currentRow.map(item => ({
          ...item,
          height: finalHeight,
          width: finalHeight * ratioOf(item.photo),
        })),
        rowHeight: finalHeight,
      });
      currentRow = [];
      currentRowWidth = 0;
    };

    photos.forEach((photo) => {
      const weight = (photo as any).pesoVisual || (photo as any).peso_visual || 0;
      const isFeatured = featuredEnabled && weight === 1;

      const aspectRatio = ratioOf(photo);
      const baseWidth = effectiveRowHeight * aspectRatio;
      const virtualWidth = isFeatured ? baseWidth * FEATURED_WEIGHT : baseWidth;

      const overflowing =
        currentRowWidth + virtualWidth > internalWidth &&
        currentRow.length >= minItemsPerRow;
      const reachedCap = currentRow.length >= itemsCap;

      if (overflowing || reachedCap) {
        flushRow(true);
      }

      currentRow.push({ photo, width: virtualWidth, height: effectiveRowHeight, isFeatured });
      currentRowWidth += virtualWidth + gap;
    });

    // Última linha
    flushRow(false);

    return layoutRows;
  }, [photos, internalWidth, gap, targetRowHeight, featuredEnabled, fixedColumns, uniformTiles, maxItemsPerRow]);

  // ============ MODO COLUNAS FIXAS SEQUENCIAL (Clean) ============
  // Rejeita o antigo algoritmo "shortest-column" (estilo Pinterest) porque
  // ele reordena visualmente as fotos. Aqui particionamos fotos na ORDEM
  // ORIGINAL em chunks de N (colunas por dispositivo) e justificamos cada
  // linha igualando altura. Proporção de cada foto é preservada dentro
  // da linha (width = rowH * AR). Ordem 1 -> 2 -> 3 / 4 -> 5 -> 6 garantida.
  const masonryLayout = useMemo(() => {
    if (!masonryColumns || internalWidth <= 0 || photos.length === 0) return null;

    const cols = internalWidth < 640
      ? masonryColumns.mobile
      : internalWidth < 1024
      ? masonryColumns.tablet
      : masonryColumns.desktop;
    const N = Math.max(1, cols);

    const ratioOf = (p: GalleryPhoto) =>
      p.width && p.height ? p.width / p.height : 1.5;

    const rows: Array<{ height: number; items: Array<{ photo: GalleryPhoto; width: number; height: number }> }> = [];

    for (let i = 0; i < photos.length; i += N) {
      const slice = photos.slice(i, i + N);
      const count = slice.length;
      const rowGaps = (count - 1) * gap;
      const sumAR = slice.reduce((a, p) => a + ratioOf(p), 0) || 1;
      let rowH = (internalWidth - rowGaps) / sumAR;

      // Última linha incompleta: limita altura para evitar foto solitária gigante.
      if (count < N && rows.length > 0) {
        const avgPrev = rows.reduce((a, r) => a + r.height, 0) / rows.length;
        const cap = avgPrev * 1.4;
        if (rowH > cap) rowH = cap;
      }

      rows.push({
        height: rowH,
        items: slice.map((p) => ({ photo: p, width: rowH * ratioOf(p), height: rowH })),
      });
    }

    return rows;
  }, [photos, internalWidth, gap, masonryColumns]);

  // ============ MODO PAIRED ROWS FEATURED (Editorial Clássico) ============
  // Foto destaque ocupa bloco 2 colunas × 2 linhas reais. Vizinhas adjacentes
  // ao bloco preenchem o lado livre em 2 andares de altura H_half. Ordem
  // narrativa preservada. Lados alternam (esq/dir) para ritmo editorial.
  // Mobile (N=2): destaque vira hero 2x2 puro, sem lado livre.
  const pairedLayout = useMemo(() => {
    const hasFeatured = photos.some((p) => {
      const w = (p as any).pesoVisual || (p as any).peso_visual || 0;
      return w === 1;
    });
    if (!pairedRowsFeatured || !featuredEnabled || !hasFeatured) return null;
    if (internalWidth <= 0 || photos.length === 0) return null;

    const N = internalWidth < 640 ? 2 : internalWidth < 1024 ? 3 : 4;
    const colWidth = (internalWidth - (N - 1) * gap) / N;
    const ratioOf = (p: GalleryPhoto) =>
      p.width && p.height ? p.width / p.height : 1.5;

    const minBlockH = Math.max(targetRowHeight * 1.6, 360);
    const maxBlockH = Math.max(targetRowHeight * 2.4, 720);

    type PairedCell = {
      photo: GalleryPhoto;
      left: number;
      top: number;
      width: number;
      height: number;
      isFeatured: boolean;
    };
    type Block =
      | { kind: 'paired'; height: number; cells: PairedCell[] }
      | { kind: 'row'; rowHeight: number; items: LayoutItem[] };

    const blocks: Block[] = [];
    const isFeat = (p: GalleryPhoto) => {
      const w = (p as any).pesoVisual || (p as any).peso_visual || 0;
      return w === 1;
    };

    let pendingNormal: GalleryPhoto[] = [];
    let alternateSide: 'left' | 'right' = 'left';

    // Empacota uma fila de fotos não-destaque em linhas justificadas (mesma
    // lógica do flushRow padrão), respeitando minItemsPerRow.
    const isMobile = internalWidth < 500;
    const effectiveRowHeight = isMobile ? Math.max(220, internalWidth * 0.55) : targetRowHeight;
    const minItemsPerRow = isMobile ? 1 : 2;

    const flushNormalRows = () => {
      if (pendingNormal.length === 0) return;
      const queue = pendingNormal;
      pendingNormal = [];
      let row: LayoutItem[] = [];
      let rowWidth = 0;
      const pushRow = (justified: boolean) => {
        if (row.length === 0) return;
        const rowGaps = (row.length - 1) * gap;
        const sumAR = row.reduce((a, it) => a + ratioOf(it.photo), 0);
        let finalH = (internalWidth - rowGaps) / sumAR;
        if (!justified && row.length === 1) {
          finalH = Math.min(finalH, effectiveRowHeight * 1.4);
        }
        blocks.push({
          kind: 'row',
          rowHeight: finalH,
          items: row.map((it) => ({
            ...it,
            height: finalH,
            width: finalH * ratioOf(it.photo),
          })),
        });
        row = [];
        rowWidth = 0;
      };
      queue.forEach((photo) => {
        const ar = ratioOf(photo);
        const w = effectiveRowHeight * ar;
        if (rowWidth + w > internalWidth && row.length >= minItemsPerRow) {
          pushRow(true);
        }
        row.push({ photo, width: w, height: effectiveRowHeight, isFeatured: false });
        rowWidth += w + gap;
      });
      pushRow(false);
    };

    let i = 0;
    while (i < photos.length) {
      const p = photos[i];
      if (isFeat(p)) {
        flushNormalRows();
        if (N < 2) {
          // Salvaguarda: sem 2 colunas, trata como linha normal.
          pendingNormal.push(p);
          i++;
          continue;
        }
        // Bloco pareado
        const blockW = 2 * colWidth + gap;
        const arF = ratioOf(p);
        const naturalH = blockW / arF;
        const H_block = Math.max(minBlockH, Math.min(maxBlockH, naturalH));
        const H_half = (H_block - gap) / 2;

        const sideLeft = N === 2 ? true : alternateSide === 'left';
        const featCol = sideLeft ? 0 : N - 2;
        const featLeft = featCol * (colWidth + gap);

        const cells: PairedCell[] = [
          {
            photo: p,
            left: featLeft,
            top: 0,
            width: blockW,
            height: H_block,
            isFeatured: true,
          },
        ];

        // Lado livre (N-2 colunas × 2 andares)
        const freeCols = N - 2;
        const sideStartCol = sideLeft ? 2 : 0;
        const slotsNeeded = freeCols * 2;
        let filled = 0;
        for (let s = 0; s < slotsNeeded && i + 1 + s < photos.length; s++) {
          const candidate = photos[i + 1 + s];
          if (isFeat(candidate)) break; // próximo destaque interrompe o preenchimento
          const colIdx = s % freeCols;
          const rowIdx = Math.floor(s / freeCols);
          const left = (sideStartCol + colIdx) * (colWidth + gap);
          const top = rowIdx * (H_half + gap);
          cells.push({
            photo: candidate,
            left,
            top,
            width: colWidth,
            height: H_half,
            isFeatured: false,
          });
          filled++;
        }

        blocks.push({ kind: 'paired', height: H_block, cells });
        i += 1 + filled;
        if (N > 2) alternateSide = sideLeft ? 'right' : 'left';
      } else {
        pendingNormal.push(p);
        i++;
      }
    }
    flushNormalRows();

    return blocks;
  }, [photos, internalWidth, gap, targetRowHeight, pairedRowsFeatured, featuredEnabled]);

  // ============ MODO UNIFORM GRID SPAN (Clean v2) ============
  // Grade rígida: verticais 1 célula, horizontais span N colunas × 1 linha.
  // Altura uniforme = colW / cellAspect (ex.: 3/4 → rowH = colW * 4/3).
  // Look-ahead-swap mínimo evita "buraco" quando horizontal cai na última coluna.
  const uniformGridLayout = useMemo(() => {
    if (!uniformGridSpan || internalWidth <= 0 || photos.length === 0) return null;

    const N = Math.max(
      1,
      internalWidth < 640
        ? uniformGridSpan.cols.mobile
        : internalWidth < 1024
        ? uniformGridSpan.cols.tablet
        : uniformGridSpan.cols.desktop,
    );
    const colW = (internalWidth - (N - 1) * gap) / N;
    const rowH = colW / uniformGridSpan.cellAspect;
    const lspan = Math.min(uniformGridSpan.landscapeSpan, N) as 1 | 2;
    const lookahead = uniformGridSpan.lookaheadSwap !== false;

    const arOf = (p: GalleryPhoto) =>
      p.width && p.height ? p.width / p.height : 1.5;
    // landscape se AR ≥ 1.18 (mesma regra do editorial)
    const isLand = (p: GalleryPhoto) => arOf(p) >= 1.18;

    // Build span list (with optional swap)
    const ordered: GalleryPhoto[] = photos.slice();
    if (lookahead && lspan === 2 && N >= 2) {
      let col = 0;
      let i = 0;
      while (i < ordered.length) {
        const span = isLand(ordered[i]) ? 2 : 1;
        if (span === 2 && col === N - 1) {
          // tenta swap com próxima vertical (janela 1)
          if (i + 1 < ordered.length && !isLand(ordered[i + 1])) {
            const tmp = ordered[i];
            ordered[i] = ordered[i + 1];
            ordered[i + 1] = tmp;
            col = (col + 1) % N;
            i++;
            continue;
          }
          // não dá: aceita célula vazia, horizontal vai pra próxima linha
          col = 0;
          continue;
        }
        col = (col + span) % N;
        i++;
      }
    }

    return {
      N,
      colW,
      rowH,
      lspan,
      photos: ordered.map((p) => ({ photo: p, span: isLand(p) ? lspan : 1 })),
    };
  }, [photos, internalWidth, gap, uniformGridSpan]);

  if (uniformGridLayout) {
    const { N, rowH, photos: items } = uniformGridLayout;
    return (
      <div
        ref={containerRef}
        className="w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          gridAutoRows: `${rowH}px`,
          gap: `${gap}px`,
        }}
      >
        {items.map(({ photo, span }) => {
          const style: React.CSSProperties = {
            gridColumn: `span ${span}`,
            gridRow: 'span 1',
            cursor: 'pointer',
            overflow: 'hidden',
          };
          if (renderItem) return renderItem(photo, style);
          const photoUrl =
            (photo as any).previewPath || photo.previewUrl || photo.thumbnailUrl;
          return (
            <div
              key={photo.id}
              style={style}
              onClick={() => onPhotoClick?.(photo)}
              className="overflow-hidden"
            >
              <img
                src={photoUrl}
                alt={photo.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (pairedLayout) {
    return (
      <div
        ref={containerRef}
        className="w-full flex flex-col"
        style={{ gap: `${gap}px` }}
      >
        {pairedLayout.map((block, bi) => {
          if (block.kind === 'paired') {
            return (
              <div
                key={`p-${bi}`}
                className="relative w-full"
                style={{ height: block.height }}
              >
                {block.cells.map((cell) => {
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    left: cell.left,
                    top: cell.top,
                    width: cell.width,
                    height: cell.height,
                    cursor: 'pointer',
                  };
                  if (renderItem) return renderItem(cell.photo, style);
                  const photoUrl = (cell.photo as any).previewPath || cell.photo.previewUrl || cell.photo.thumbnailUrl;
                  return (
                    <div
                      key={cell.photo.id}
                      style={style}
                      onClick={() => onPhotoClick?.(cell.photo)}
                      className="overflow-hidden"
                    >
                      <img
                        src={photoUrl}
                        alt={cell.photo.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  );
                })}
              </div>
            );
          }
          return (
            <div
              key={`r-${bi}`}
              className="flex flex-row overflow-hidden"
              style={{ gap: `${gap}px`, height: block.rowHeight }}
            >
              {block.items.map((item) => {
                const style: React.CSSProperties = {
                  width: item.width,
                  height: item.height,
                  flexShrink: 0,
                  cursor: 'pointer',
                };
                if (renderItem) return renderItem(item.photo, style);
                const photoUrl = (item.photo as any).previewPath || item.photo.previewUrl || item.photo.thumbnailUrl;
                return (
                  <div
                    key={item.photo.id}
                    style={style}
                    onClick={() => onPhotoClick?.(item.photo)}
                    className="overflow-hidden"
                  >
                    <img
                      src={photoUrl}
                      alt={item.photo.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  if (masonryColumns) {
    return (
      <div
        ref={containerRef}
        className="w-full flex flex-col"
        style={{ gap: `${gap}px` }}
      >
        {masonryLayout?.map((row, ri) => (
          <div
            key={ri}
            className="flex flex-row overflow-hidden"
            style={{ gap: `${gap}px`, height: row.height }}
          >
            {row.items.map((item) => {
              const style: React.CSSProperties = {
                width: item.width,
                height: item.height,
                flexShrink: 0,
                cursor: 'pointer',
              };
              if (renderItem) return renderItem(item.photo, style);
              const photoUrl = (item.photo as any).previewPath || item.photo.previewUrl || item.photo.thumbnailUrl;
              return (
                <div
                  key={item.photo.id}
                  style={style}
                  onClick={() => onPhotoClick?.(item.photo)}
                  className="overflow-hidden"
                >
                  <img
                    src={photoUrl}
                    alt={item.photo.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col"
      style={{ gap: `${gap}px` }}
    >
      {rows.map((row, rowIndex) => (
        <div 
          key={rowIndex} 
          className="flex flex-row overflow-hidden" 
          style={{ gap: `${gap}px`, height: row.rowHeight }}
        >
          {row.items.map((item) => {
            const style: React.CSSProperties = {
              width: item.width,
              height: item.height,
              flexShrink: 0,
              cursor: 'pointer'
            };

            if (renderItem) {
              return renderItem(item.photo, style);
            }

            // Fallback render (important for theme previews with demo photos)
            const photoUrl = (item.photo as any).previewPath || item.photo.previewUrl || item.photo.thumbnailUrl;

            return (
              <div 
                key={item.photo.id} 
                style={style}
                onClick={() => onPhotoClick?.(item.photo)}
                className="overflow-hidden"
              >
                <img
                  src={photoUrl}
                  alt={item.photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            );
          })}

        </div>
      ))}
    </div>
  );
};
