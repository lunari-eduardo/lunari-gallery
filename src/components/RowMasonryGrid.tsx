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

interface ColumnsConfig {
  mobile?: number;
  tablet?: number;
  desktop?: number;
  desktopLarge?: number;
}

interface RowMasonryGridProps {
  gap?: number;
  targetRowHeight?: number;
  columns?: ColumnsConfig;
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
  return <>{children}</>;
}

const DEFAULT_COLS: Required<ColumnsConfig> = {
  mobile: 2,
  tablet: 3,
  desktop: 4,
  desktopLarge: 5,
};

function colsFor(w: number, cfg: Required<ColumnsConfig>): number {
  // Espelha breakpoints do grid legado (Tailwind):
  // columns-2 sm:columns-3 md:columns-4 lg:columns-5
  if (w >= 1024) return cfg.desktopLarge;
  if (w >= 768) return cfg.desktop;
  if (w >= 640) return cfg.tablet;
  return cfg.mobile;
}

export function RowMasonryGrid({ gap = 8, targetRowHeight = 240, columns, children }: RowMasonryGridProps) {
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

    const cfg: Required<ColumnsConfig> = { ...DEFAULT_COLS, ...(columns ?? {}) };
    const N = Math.max(1, colsFor(width, cfg));

    const built: LayoutRow[] = [];

    for (let i = 0; i < items.length; i += N) {
      const slice = items.slice(i, i + N);
      const count = slice.length;
      const rowGaps = (count - 1) * gap;
      const sumAR = slice.reduce((a, it) => a + it.ar, 0) || 1;
      let rowH = (width - rowGaps) / sumAR;

      // Cap apenas em última linha incompleta — evita foto solitária gigante.
      if (count < N) {
        const avgPrev = built.length > 0
          ? built.reduce((a, r) => a + r.height, 0) / built.length
          : targetRowHeight;
        const cap = avgPrev * 1.4;
        if (rowH > cap) rowH = cap;
      }

      built.push({
        height: rowH,
        items: slice.map((it) => ({
          key: it.key,
          node: it.node,
          width: rowH * it.ar,
          height: rowH,
        })),
      });
    }

    return built;
  }, [items, width, gap, targetRowHeight, columns]);

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

