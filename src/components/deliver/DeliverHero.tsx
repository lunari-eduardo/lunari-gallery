/**
 * Compat: DeliverHero foi convertido em uma variante de Capa (FullscreenCover).
 * Este arquivo permanece como re-export nomeado para não quebrar imports antigos
 * (ex.: ThemePreviewCanvas). Para Galerias de Entrega, prefira CoverRenderer.
 */
import FullscreenCover from './covers/variants/FullscreenCover';
import type { CoverVariantProps } from './covers/types';

export type DeliverHeroProps = CoverVariantProps;

export function DeliverHero(props: DeliverHeroProps) {
  return <FullscreenCover {...props} />;
}

export default DeliverHero;
