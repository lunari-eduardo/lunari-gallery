import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GalleryPhoto } from '@/types/gallery';
import {
  Template,
  selectTemplateBatch,
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
  /** Soma de larguras das células + gaps. Usado para centralizar quando < innerWidth. */
  contentWidth: number;
  /** true quando a strip não preencheu 100% da largura (deve ser centralizada). */
  needsCenter: boolean;
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
    let cooldown = 0;

    if (import.meta.env.DEV) {
      const featCount = photos.filter(
        (p) => ((p as any).pesoVisual || (p as any).peso_visual || 0) === 1,
      ).length;
      // eslint-disable-next-line no-console
      console.debug('[editorial] init', { total: photos.length, featured: featCount });
    }


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

      // Loop de seleção com rede de segurança: até 2 reseleções se uma
      // strip do template gerar vazio horizontal > 5%.
      const avoidIds = new Set<string>();
      let attempt = 0;
      let chosen: { template: Template; nextCursor: number } | null = null;
      let plannedStrips: PlannedStrip[] = [];
      let consumed = 0;

      while (attempt < 3) {
        const sel = selectTemplateBatch(
          remaining,
          cursor,
          isMobile,
          nextOrientations,
          isFeatured,
          stripCap,
          avoidIds.size > 0 ? avoidIds : undefined,
          idx === 0 && !isFeatured, // forbidLeadingSolo: nada de retrato solo no topo
        );
        const template = sel.template;
        consumed = template.slots.length;
        const batchPhotos = photos.slice(idx, idx + consumed);

        // Planeja todas as strips do template e mede vazio.
        const stripsTmp: PlannedStrip[] = [];
        let worstEmptyPct = 0;
        let forceCropApplied = false;

        for (const strip of template.strips) {
          const isFeaturedStrip =
            !!template.hasFeaturedSlot &&
            strip.slotIndexes.includes(template.featuredSlotIndex ?? 0);

          const cellsMeta = strip.slotIndexes.map((slotIdx) => {
            const slot = template.slots[slotIdx];
            const photo = batchPhotos[slotIdx];
            const photoAR =
              photo && photo.width && photo.height ? photo.width / photo.height : 1;
            const naturalAR =
              slot.ar > 0 ? slot.ar : Math.max(0.6, Math.min(2.0, photoAR));
            // Regra anti-distorção (conservadora para o fotógrafo):
            // - Retrato (AR<1): até quadrado (1.0).
            // - Quase-quadrado: até 1.10.
            // - Paisagem: AR natural + 0.20 (crop vertical ≤ ~8%, teto 2.4).
            let maxAR: number;
            if (naturalAR < 0.95) maxAR = 1.0;
            else if (naturalAR < 1.15) maxAR = 1.10;
            else maxAR = Math.min(naturalAR + 0.20, 2.4);
            return { slot, photo, naturalAR, maxAR };
          });

          const sumNaturalAR = cellsMeta.reduce((a, c) => a + c.naturalAR, 0);
          const gaps = (cellsMeta.length - 1) * gap;
          const widthForCells = Math.max(0, innerWidth - gaps);

          // FIT-WIDTH-FIRST: a altura natural que preenche 100% da largura.
          const hIdeal = widthForCells / sumNaturalAR;

          // Tetos de altura apenas por viewport / absoluto — não por fração de innerWidth.
          // Strips comuns só são capadas quando a altura natural extrapolaria o viewport.
          const single = cellsMeta.length === 1;
          const onlyAR = single ? cellsMeta[0].naturalAR : 0;

          let vhCap: number;
          let absCap: number;
          if (isFeaturedStrip && single) {
            // Hero destacado solo: presença forte, mas limitado ao viewport.
            vhCap = viewportH * 0.92;
            absCap = 1200;
          } else if (single) {
            // Solo comum (raro — geralmente última foto da galeria).
            vhCap = viewportH * 0.82;
            absCap = onlyAR < 1 ? 900 : 760;
          } else {
            // Strips com 2+ células: cap generoso, na prática quase nunca aciona.
            vhCap = viewportH * 0.80;
            absCap = 820;
          }
          const cap = Math.min(vhCap, absCap);

          let h = Math.min(hIdeal, cap);
          let widths = cellsMeta.map((c) => c.naturalAR * h);
          let totalW = widths.reduce((a, w) => a + w, 0);

          // Quando h foi capada, larguras encolhem; tenta recuperar via crop controlado (até maxAR).
          if (h < hIdeal - 0.5) {
            for (let iter = 0; iter < 6 && widthForCells - totalW > 0.5; iter++) {
              const deficit = widthForCells - totalW;
              const slack = cellsMeta.reduce((a, c, i) => {
                const cellMaxW = c.maxAR * h;
                return a + Math.max(0, cellMaxW - widths[i]);
              }, 0);
              if (slack <= 0.5) break;
              for (let i = 0; i < widths.length; i++) {
                const cellMaxW = cellsMeta[i].maxAR * h;
                const cellSlack = Math.max(0, cellMaxW - widths[i]);
                const add = deficit * (cellSlack / slack);
                widths[i] = Math.min(cellMaxW, widths[i] + add);
              }
              totalW = widths.reduce((a, w) => a + w, 0);
            }
          }

          // emptyPct mede vazio RELATIVO ao espaço útil (não ao innerWidth).
          let emptyPct = (widthForCells - totalW) / Math.max(1, widthForCells);

          // 3ª tentativa: hard-crop também para retratos (até 1.18) e paisagens (+0.45).
          if (emptyPct > 0.02 && attempt === 2) {
            for (let iter = 0; iter < 6 && widthForCells - totalW > 0.5; iter++) {
              const deficit = widthForCells - totalW;
              const hardMaxOf = (c: typeof cellsMeta[number]) =>
                c.naturalAR >= 1.15
                  ? Math.min(c.naturalAR + 0.45, 2.8) * h
                  : Math.min(c.naturalAR + 0.30, 1.18) * h;
              const hardSlack = cellsMeta.reduce(
                (a, c, i) => a + Math.max(0, hardMaxOf(c) - widths[i]),
                0,
              );
              if (hardSlack <= 0.5) break;
              for (let i = 0; i < widths.length; i++) {
                const hardMax = hardMaxOf(cellsMeta[i]);
                const cellSlack = Math.max(0, hardMax - widths[i]);
                const add = deficit * (cellSlack / hardSlack);
                widths[i] = Math.min(hardMax, widths[i] + add);
              }
              totalW = widths.reduce((a, w) => a + w, 0);
            }
            emptyPct = (widthForCells - totalW) / Math.max(1, widthForCells);
            forceCropApplied = true;
          }

          if (emptyPct > worstEmptyPct) worstEmptyPct = emptyPct;

          const cells = cellsMeta.map((c, i) => ({
            photo: c.photo,
            width: widths[i],
          }));
          const contentWidth = totalW + (cells.length - 1) * gap;
          const needsCenter = innerWidth - contentWidth > 0.5;
          stripsTmp.push({ height: h, contentWidth, needsCenter, cells });
        }

        // Se vazio relevante e ainda há tentativas, evita este template.
        if (worstEmptyPct > 0.02 && attempt < 2) {
          avoidIds.add(template.id);
          attempt++;
          continue;
        }


        chosen = sel;
        plannedStrips = stripsTmp;

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[editorial]', {
            headPhotoId: (nextPhoto as any).id,
            headOrient: nextOrientations[0],
            isFeatured,
            templateId: template.id,
            featuredSlotIndex: template.featuredSlotIndex,
            attempts: attempt + 1,
            emptyPct: Number(worstEmptyPct.toFixed(4)),
            forceCropApplied,
          });
        }
        break;
      }

      // Falha rara: usa o último resultado mesmo com vazio.
      if (!chosen) {
        const sel = selectTemplateBatch(
          remaining, cursor, isMobile, nextOrientations, isFeatured, stripCap,
        );
        chosen = sel;
        consumed = sel.template.slots.length;
      }

      cursor = chosen.nextCursor;
      idx += consumed;

      // Cooldown (mantido por compatibilidade; padrão do tema = 0).
      if (isFeatured && chosen.template.hasFeaturedSlot) {
        cooldown = featuredCooldown;
      } else {
        cooldown = Math.max(0, cooldown - consumed);
      }

      for (const s of plannedStrips) out.push(s);
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
          return (
            <div
              key={i}
              className="flex flex-row overflow-hidden"
              style={{
                gap: `${gap}px`,
                height: strip.height,
                justifyContent: 'flex-start',
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
