/**
 * Shared watermark tile layout calculator.
 * Used by both the upload pipeline (canvas) and the settings preview (DOM)
 * so the user sees exactly the pattern that will be burned into photos.
 *
 * The pattern uses a diagonal (45°) mesh: tiles are positioned along axes
 * rotated 45°, but each tile itself stays upright (0°). This produces a
 * true diagonal interleaved layout rather than a straight horizontal grid.
 */

export type TileScale = 'small' | 'medium' | 'large';

export interface WatermarkLayoutInput {
  /** Canvas/container width in px */
  canvasWidth: number;
  /** Canvas/container height in px */
  canvasHeight: number;
  /** Watermark image width in px (natural) */
  watermarkWidth: number;
  /** Watermark image height in px (natural) */
  watermarkHeight: number;
  /** Tile size preset */
  tileScale: TileScale;
}

export interface TilePosition {
  /** Top-left X of the tile in canvas coords */
  x: number;
  /** Top-left Y of the tile in canvas coords */
  y: number;
  /** Drawn tile width */
  width: number;
  /** Drawn tile height */
  height: number;
}

export interface WatermarkLayout {
  tiles: TilePosition[];
  tileWidth: number;
  tileHeight: number;
}

const ANGLE_DEG = 45;
const ANGLE_RAD = (ANGLE_DEG * Math.PI) / 180;

/**
 * Compute tile positions for a diagonal 45° interleaved watermark pattern.
 */
export function computeWatermarkLayout(input: WatermarkLayoutInput): WatermarkLayout {
  const { canvasWidth, canvasHeight, watermarkWidth, watermarkHeight, tileScale } = input;

  const shortEdge = Math.min(canvasWidth, canvasHeight);

  // Base tile sizes (relative to short edge): small / medium (+30%) / large (+60%)
  const scaleFactor =
    tileScale === 'small' ? 0.16 : tileScale === 'large' ? 0.34 : 0.21;

  const tileHeight = shortEdge * scaleFactor;
  const aspect = watermarkWidth / watermarkHeight;
  const tileWidth = aspect * tileHeight;

  // Spacing in the rotated coordinate space.
  // Rows are spaced tighter than columns so the diagonal mesh feels dense
  // but never overlaps. Brick offset (half spacingU) is applied per row.
  const spacingU = tileWidth * 1.15; // along the rotated X axis
  const spacingV = tileHeight * 1.35; // along the rotated Y axis

  const cos = Math.cos(ANGLE_RAD);
  const sin = Math.sin(ANGLE_RAD);

  // We need to cover the entire canvas after rotating the mesh by 45°.
  // The diagonal of the canvas defines the max extent we must iterate over.
  const diagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
  const halfExtent = diagonal / 2 + Math.max(tileWidth, tileHeight);

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  const tiles: TilePosition[] = [];

  let rowIndex = 0;
  for (let v = -halfExtent; v <= halfExtent; v += spacingV) {
    // Brick offset on alternating rows so columns don't align in the diagonal mesh
    const uOffset = rowIndex % 2 === 0 ? 0 : spacingU / 2;

    for (let u = -halfExtent; u <= halfExtent; u += spacingU) {
      const ru = u + uOffset;
      const rv = v;

      // Rotate (ru, rv) by 45° and translate to canvas center
      const screenX = centerX + ru * cos - rv * sin;
      const screenY = centerY + ru * sin + rv * cos;

      // Top-left of the upright tile (logo itself is NOT rotated)
      const x = screenX - tileWidth / 2;
      const y = screenY - tileHeight / 2;

      // Cull tiles fully outside the canvas (with margin)
      if (
        x + tileWidth < -tileWidth ||
        y + tileHeight < -tileHeight ||
        x > canvasWidth + tileWidth ||
        y > canvasHeight + tileHeight
      ) {
        continue;
      }

      tiles.push({ x, y, width: tileWidth, height: tileHeight });
    }
    rowIndex++;
  }

  return { tiles, tileWidth, tileHeight };
}
