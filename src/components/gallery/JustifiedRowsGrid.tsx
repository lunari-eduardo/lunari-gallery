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

  // ============ MODO MASONRY DE COLUNAS FIXAS (Clean) ============
  // Colunas verticais independentes (estilo Pinterest). Cada foto entra na
  // coluna de menor altura acumulada, preservando a ordem narrativa
  // aproximadamente da esquerda para a direita / topo para baixo. Proporção
  // original 100% preservada — sem corte, sem object-cover dependente.
  const masonryLayout = useMemo(() => {
    if (!masonryColumns || internalWidth <= 0 || photos.length === 0) return null;

    const cols = internalWidth < 640
      ? masonryColumns.mobile
      : internalWidth < 1024
      ? masonryColumns.tablet
      : masonryColumns.desktop;
    const N = Math.max(1, cols);
    const colWidth = (internalWidth - (N - 1) * gap) / N;

    const ratioOf = (p: GalleryPhoto) =>
      p.width && p.height ? p.width / p.height : 1.5;

    const heights = new Array(N).fill(0);
    const columns: Array<{ width: number; items: Array<{ photo: GalleryPhoto; width: number; height: number }> }> =
      Array.from({ length: N }, () => ({ width: colWidth, items: [] }));

    photos.forEach((photo) => {
      const ar = ratioOf(photo);
      const h = colWidth / ar;
      let idx = 0;
      let min = heights[0];
      for (let i = 1; i < N; i++) {
        if (heights[i] < min) { min = heights[i]; idx = i; }
      }
      columns[idx].items.push({ photo, width: colWidth, height: h });
      heights[idx] += h + gap;
    });

    return columns;
  }, [photos, internalWidth, gap, masonryColumns]);

  if (masonryColumns) {
    return (
      <div
        ref={containerRef}
        className="w-full flex flex-row items-start"
        style={{ gap: `${gap}px` }}
      >
        {masonryLayout?.map((col, ci) => (
          <div
            key={ci}
            className="flex flex-col"
            style={{ width: col.width, gap: `${gap}px`, flexShrink: 0 }}
          >
            {col.items.map((item) => {
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
