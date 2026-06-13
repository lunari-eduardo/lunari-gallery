import React, { useEffect, useMemo, useRef, useState, isValidElement, Children } from 'react';

/**
 * RowMasonryGrid — grid de linhas justificadas que PRESERVA a ordem
 * estrita das fotos (1→2→3 / 4→5→6 / 7→...). A única flexibilidade
 * permitida é o encaixe dentro da linha (largura proporcional ao AR
 * original, altura igualada para todos os itens da linha).
 *
 * API drop-in compatível com o legado `MasonryGrid`/`MasonryItem` para
 * uso isolado em galerias de SELEÇÃO (ClientGallery). NÃO use este
 * componente em telas de entrega/preview do fotógrafo.
 */

interface RowMasonryGridProps {
  gap?: number;
  targetRowHeight?: number;
  children: React.ReactNode;
}

interface RowMasonryItemProps {
  photoWidth: number;
  photoHeight: number;
  children: React.ReactNode;
}

interface ParsedItem {
  key: React.Key;
  ar: number;
  node: React.ReactNode;
}

interface LayoutRow {
  items: Array<{ key: React.Key; node: React.ReactNode; width: number; height: number }>;
  height: number;
}

export function RowMasonryItem({ children }: RowMasonryItemProps) {
  // Renderização real é controlada pelo grid; este componente é apenas
  // um "marcador" para extrair photoWidth/photoHeight via props.
  return <>{children}</>;
}

export function RowMasonryGrid({ gap = 8, targetRowHeight = 240, children }: RowMasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const items: ParsedItem[] = useMemo(() => {
    const out: ParsedItem[] = [];
    Children.toArray(children).forEach((child, idx) => {
      if (!isValidElement(child)) return;
      const props = child.props as Partial<RowMasonryItemProps>;
      const w = Number(props.photoWidth) || 0;
      const h = Number(props.photoHeight) || 0;
      const ar = w > 0 && h > 0 ? w / h : 1.5;
      out.push({ key: child.key ?? idx, ar, node: props.children });
    });
    return out;
  }, [children]);

  const rows: LayoutRow[] = useMemo(() => {
    if (width <= 0 || items.length === 0) return [];

    const isMobile = width < 500;
    const effectiveRowHeight = isMobile ? Math.max(220, width * 0.55) : targetRowHeight;
    const minItemsPerRow = isMobile ? 1 : 2;

    const built: LayoutRow[] = [];
    let row: ParsedItem[] = [];
    let acc = 0;

    const flush = (justified: boolean) => {
      if (row.length === 0) return;
      const rowGaps = (row.length - 1) * gap;
      const sumAR = row.reduce((a, it) => a + it.ar, 0);
      let h = (width - rowGaps) / sumAR;
      if (!justified) {
        if (built.length > 0) {
          const avgPrev = built.reduce((a, r) => a + r.height, 0) / built.length;
          const cap = Math.min(h, avgPrev * 1.6);
          h = Math.max(cap, effectiveRowHeight);
        } else {
          h = Math.min(h, effectiveRowHeight * 1.4);
        }
      }
      built.push({
        height: h,
        items: row.map((it) => ({ key: it.key, node: it.node, width: h * it.ar, height: h })),
      });
      row = [];
      acc = 0;
    };

    items.forEach((it) => {
      const w = effectiveRowHeight * it.ar;
      if (acc + w > width && row.length >= minItemsPerRow) flush(true);
      row.push(it);
      acc += w + gap;
    });
    flush(false);

    return built;
  }, [items, width, gap, targetRowHeight]);

  return (
    <div ref={containerRef} className="w-full flex flex-col" style={{ gap: `${gap}px` }}>
      {rows.map((r, ri) => (
        <div
          key={ri}
          className="flex flex-row overflow-hidden"
          style={{ gap: `${gap}px`, height: r.height }}
        >
          {r.items.map((it) => (
            <div
              key={it.key}
              style={{ width: it.width, height: it.height, flexShrink: 0 }}
              className="[&_img]:!w-full [&_img]:!h-full [&_img]:!object-cover [&>*]:!w-full [&>*]:!h-full"
            >
              {it.node}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
