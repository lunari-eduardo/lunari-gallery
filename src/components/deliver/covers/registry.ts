import { lazy } from 'react';
import type { CoverVariant } from './types';
import {
  FullscreenThumbnail,
  FloatingFrameThumbnail,
  SplitThumbnail,
  EditorialThumbnail,
} from './thumbnails';

const FullscreenCover = lazy(() => import('./variants/FullscreenCover'));
const FloatingFrameCover = lazy(() => import('./variants/FloatingFrameCover'));
const SplitCover = lazy(() => import('./variants/SplitCover'));
const EditorialCover = lazy(() => import('./variants/EditorialCover'));

export const COVER_REGISTRY: Record<string, CoverVariant> = {
  fullscreen: {
    id: 'fullscreen',
    name: 'Fullscreen',
    description: 'Foto em tela cheia com título centralizado',
    Component: FullscreenCover,
    Thumbnail: FullscreenThumbnail,
  },
  'floating-frame': {
    id: 'floating-frame',
    name: 'Floating Frame',
    description: 'Foto enquadrada com margens e fundo do tema visível',
    Component: FloatingFrameCover,
    Thumbnail: FloatingFrameThumbnail,
  },
  split: {
    id: 'split',
    name: 'Split',
    description: 'Foto à esquerda e painel de título à direita',
    Component: SplitCover,
    Thumbnail: SplitThumbnail,
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'Tipografia grande com numeração e retrato à direita',
    Component: EditorialCover,
    Thumbnail: EditorialThumbnail,
  },
};

export const DEFAULT_COVER_ID = 'fullscreen';

export const COVER_LIST: CoverVariant[] = Object.values(COVER_REGISTRY);

export function resolveCoverId(id?: string | null): string {
  if (!id) return DEFAULT_COVER_ID;
  if (COVER_REGISTRY[id]) return id;
  if (import.meta.env?.DEV) {
    console.warn(`[Cover] ID desconhecido "${id}" — usando fallback "${DEFAULT_COVER_ID}".`);
  }
  return DEFAULT_COVER_ID;
}
