import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GalleryPhoto } from '@/types/gallery';
import {
  Template,
  selectTemplateBatch,
  computeStripHeight,
  orientationFromAR,
  PhotoOrientation,
} from './editorialTemplates';

interface EditorialTemplatesGridProps {
  photos: GalleryPhoto[];
  gap: number;
  onPhotoClick?: (photo: GalleryPhoto) => void;
  renderItem?: (photo: GalleryPhoto, style: React.CSSProperties) => React.ReactNode;
  containerWidth?: number;
  /** Editorial: largura máxima do container por breakpoint (px). */
  maxContainerWidth?: {
    desktopSm?: number | null;
    desktopMd?: number | null;
    desktopLg?: number | null;
  };
  /** Editorial: máximo de fotos por strip (linha de template). */
  maxItemsPerStrip?: { mobile: number; tablet: number; desktop: number };
  /** Editorial: cooldown — fotos não-destaque entre dois destaques. */
  featuredCooldown?: number;
}

interface PlannedStrip {
  height: number;
  /** Soma de larguras das células (após cap). Usado para centralizar. */
  contentWidth: number;
  cells: Array<{
    photo: GalleryPhoto;
    width: number;
  }>;
}

/**
 * Editorial Templates Grid — engine "revista".
 *
 * Refinamentos v1.1:
 *  - Container com largura máxima por breakpoint (telas grandes).
 *  - Filtro `maxItemsPerStrip` aplicado na seleção de template.
 *  - Cooldown de destaques: 1 destaque a cada N fotos.
 *  - Teto absoluto de altura por strip (evita fotos gigantes); quando a strip
 *    é capada, células encolhem proporcionalmente e a linha é centralizada.
 *
 * Ordem narrativa: photos[i] sempre cai no slot i. Sem reordenação.
 */
export const EditorialTemplatesGrid: React.FC<EditorialTemplatesGridProps> = ({
  photos,
  gap,
  onPhotoClick,
  renderItem,
  containerWidth: externalWidth,
  maxContainerWidth,
  maxItemsPerStrip,
  featuredCooldown = 0,
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [outerWidth, setOuterWidth] = useState(0);
  const [viewportH, setViewportH] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );

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

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Largura efetiva do container (com cap por breakpoint).
  const innerWidth = useMemo(() => {
    if (outerWidth <= 0) return 0;
    if (!maxContainerWidth) return outerWidth;
    let cap: number | null | undefined = undefined;
    if (outerWidth >= 2000) cap = maxContainerWidth.desktopLg;
    else if (outerWidth >= 1600) cap = maxContainerWidth.desktopMd;
    else if (outerWidth >= 1280) cap = maxContainerWidth.desktopSm;
    if (cap && cap > 0) return Math.min(outerWidth, cap);
    return outerWidth;
  }, [outerWidth, maxContainerWidth]);

  // Cap de itens por strip por breakpoint.
  const stripCap = useMemo(() => {
    if (!maxItemsPerStrip) return undefined;
    if (innerWidth < 640) return maxItemsPerStrip.mobile;
    if (innerWidth < 1024) return maxItemsPerStrip.tablet;
    return maxItemsPerStrip.desktop;
  }, [innerWidth, maxItemsPerStrip]);

  const strips: PlannedStrip[] = useMemo(() => {
    if (innerWidth <= 0 || photos.length === 0) return [];

    const isMobile = innerWidth < 640;
    const out: PlannedStrip[] = [];
    let cursor = 0;
    let idx = 0;
    // Cooldown: quantas fotos ainda precisam passar até liberar próximo destaque.
    let cooldown = 0;

    while (idx < photos.length) {
      const remaining = photos.length - idx;
      const nextPhoto = photos[idx];
      const rawFeatured =
        ((nextPhoto as any).pesoVisual || (nextPhoto as any).peso_visual || 0) === 1;
      const isFeatured = rawFeatured && cooldown <= 0;

      const lookahead = Math.min(remaining, 6);
      const nextOrientations: PhotoOrientation[] = [];
      for (let k = 0; k < lookahead; k++) {
        const p = photos[idx + k];
        const ar = p.width && p.height ? p.width / p.height : 1.5;
        nextOrientations.push(orientationFromAR(ar));
      }

      const { template, nextCursor } = selectTemplateBatch(
        remaining,
        cursor,
        isMobile,
        nextOrientations,
        isFeatured,
        stripCap,
      );
      cursor = nextCursor;

      const consumed = template.slots.length;
      const batchPhotos = photos.slice(idx, idx + consumed);
      idx += consumed;

      // Atualiza cooldown.
      if (isFeatured && template.hasFeaturedSlot) {
        cooldown = featuredCooldown;
      } else {
        cooldown = Math.max(0, cooldown - consumed);
      }

      for (const strip of template.strips) {
        const ratios = strip.slotIndexes.map((i) => template.slots[i].ar);
        const sumAR = ratios.reduce((a, b) => a + b, 0);
        let h = computeStripHeight(strip, template, innerWidth, gap);

        // Teto de altura (evita fotos gigantes).
        const single = strip.slotIndexes.length === 1;
        const slotOrient = single ? template.slots[strip.slotIndexes[0]].orientation : null;
        let cap = innerWidth * 0.62;
        if (single && slotOrient === 'portrait') cap = innerWidth * 0.55;
        if (single && slotOrient === 'landscape' && ratios[0] >= 1.7) cap = innerWidth * 0.42;
        cap = Math.min(cap, viewportH * 0.78);

        if (h > cap) h = cap;

        const cells = strip.slotIndexes.map((slotIdx) => ({
          photo: batchPhotos[slotIdx],
          width: h * template.slots[slotIdx].ar,
        }));
        const contentWidth =
          cells.reduce((a, c) => a + c.width, 0) + (cells.length - 1) * gap;

        out.push({ height: h, contentWidth, cells });
      }
    }

    return out;
  }, [photos, innerWidth, gap, viewportH, stripCap, featuredCooldown]);

  return (
    <div
      ref={outerRef}
      className="w-full flex justify-center"
    >
      <div
        ref={innerRef}
        className="flex flex-col"
        style={{ gap: `${gap}px`, width: innerWidth || '100%' }}
      >
        {strips.map((strip, i) => {
          const justify =
            strip.contentWidth < innerWidth - 1 ? 'center' : 'flex-start';
          return (
            <div
              key={i}
              className="flex flex-row overflow-hidden"
              style={{
                gap: `${gap}px`,
                height: strip.height,
                justifyContent: justify,
              }}
            >
              {strip.cells.map((cell, ci) => {
                const style: React.CSSProperties = {
                  width: cell.width,
                  height: strip.height,
                  flexShrink: 0,
                  cursor: 'pointer',
                };
                if (!cell.photo) return null;
                if (renderItem) return renderItem(cell.photo, style);

                const url =
                  (cell.photo as any).previewPath ||
                  (cell.photo as any).previewUrl ||
                  (cell.photo as any).thumbnailUrl;

                return (
                  <div
                    key={cell.photo.id ?? ci}
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
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
