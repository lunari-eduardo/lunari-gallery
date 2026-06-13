import React from 'react';
import { RowMasonryGrid, RowMasonryItem } from '@/components/RowMasonryGrid';

/**
 * Wrapper de compatibilidade.
 *
 * O `MasonryGrid` legado usava CSS columns, que distribui itens em sentido
 * vertical (col 1 top->bottom, depois col 2...). Isso quebra a leitura
 * linha-a-linha 1 -> 2 -> 3 / 4 -> 5 -> 6 exigida em qualquer galeria.
 *
 * Agora delegamos para o `RowMasonryGrid`, que mantém a ordem narrativa
 * estrita por linha e respeita as colunas por dispositivo (2/3/4/5).
 */

interface MasonryGridProps {
  gap?: number;
  children: React.ReactNode;
}

interface MasonryItemProps {
  photoWidth: number;
  photoHeight: number;
  children: React.ReactNode;
}

export function MasonryGrid({ gap = 8, children }: MasonryGridProps) {
  return <RowMasonryGrid gap={gap}>{children}</RowMasonryGrid>;
}

export function MasonryItem({ photoWidth, photoHeight, children }: MasonryItemProps) {
  return (
    <RowMasonryItem photoWidth={photoWidth} photoHeight={photoHeight}>
      {children}
    </RowMasonryItem>
  );
}
