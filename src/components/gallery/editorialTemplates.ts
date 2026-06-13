/**
 * Editorial Templates Engine
 *
 * Padrões de composição pré-definidos para o tema "Editorial Revista".
 * Cada template é uma sequência de "strips" (linhas horizontais) onde cada
 * célula tem aspect-ratio fixo. A altura da strip é calculada para preencher
 * 100% da largura do container, garantindo ZERO espaço residual.
 *
 * Regras invioláveis:
 * 1. Sequência narrativa NUNCA é reordenada — photos[i] cai no slot i.
 * 2. NENHUM template deixa fotos órfãs (sempre existe fallback para N=1..5).
 * 3. Foto vertical NUNCA cai em slot horizontal (e vice-versa).
 *    Slot só aceita foto cuja orientação seja compatível.
 *    Tolerância de 15% em torno do quadrado → fotos "quase-quadradas"
 *    aceitam qualquer slot.
 */

export type SlotOrientation = 'landscape' | 'portrait' | 'square' | 'any';

export interface TemplateSlot {
  /** aspectRatio do slot (width/height). Foto é cortada via object-cover. */
  ar: number;
  /** Orientação obrigatória da foto que pode ocupar este slot. */
  orientation: SlotOrientation;
}

export interface TemplateStrip {
  /** Índices dos slots (referindo a Template.slots) presentes nesta strip. */
  slotIndexes: number[];
}

export interface Template {
  id: string;
  slots: TemplateSlot[];
  strips: TemplateStrip[];
  hasFeaturedSlot?: boolean;
}

// ============================================================
// Helpers — orientação derivada do AR da foto
// ============================================================

export type PhotoOrientation = 'landscape' | 'portrait' | 'square';

export function orientationFromAR(ar: number): PhotoOrientation {
  if (ar >= 1.18) return 'landscape';
  if (ar <= 0.85) return 'portrait';
  return 'square';
}

/** Slot aceita foto se orientações compatíveis (square é coringa). */
function slotAccepts(slot: SlotOrientation, photo: PhotoOrientation): boolean {
  if (slot === 'any') return true;
  if (slot === 'square') return true; // slot quadrado aceita qualquer foto (corte central)
  if (photo === 'square') return true; // foto quase-quadrada cabe em qualquer slot
  return slot === photo;
}

// Atalhos
const L = (ar: number): TemplateSlot => ({ ar, orientation: 'landscape' });
const P = (ar: number): TemplateSlot => ({ ar, orientation: 'portrait' });
const S = (): TemplateSlot => ({ ar: 1, orientation: 'square' });

// ============================================================
// DESKTOP / TABLET TEMPLATES (>= 640px)
// ============================================================

/** T1 — Capa: 1 panorâmica horizontal + 2 quadradas */
const T1: Template = {
  id: 'T1',
  slots: [L(3 / 2), S(), S()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

/** T2 — Quarteto retrato (4 verticais) */
const T2: Template = {
  id: 'T2',
  slots: [P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0, 1, 2, 3] }],
};

/** T3 — Trio assimétrico horizontal: 1 grande + 2 médias */
const T3: Template = {
  id: 'T3',
  slots: [L(16 / 9), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

/** T4 — Díptico landscape */
const T4: Template = {
  id: 'T4',
  slots: [L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1] }],
};

/** T5 — Mix denso: 1 panorâmica + 4 quadradas */
const T5: Template = {
  id: 'T5',
  slots: [L(21 / 9), S(), S(), S(), S()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2, 3, 4] }],
  hasFeaturedSlot: true,
};

/** T6 — Trio simétrico horizontal */
const T6: Template = {
  id: 'T6',
  slots: [L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1, 2] }],
};

/** T7 — 6 paisagens 3x2 */
const T7: Template = {
  id: 'T7',
  slots: [L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1, 2] }, { slotIndexes: [3, 4, 5] }],
};

/** T8 — Trio retrato (3 verticais) */
const T8: Template = {
  id: 'T8',
  slots: [P(3 / 4), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0, 1, 2] }],
};

/** T9 — Par retrato (2 verticais lado a lado) */
const T9: Template = {
  id: 'T9',
  slots: [P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0, 1] }],
};

/** T10 — Sexteto retrato (6 verticais 3x2) */
const T10: Template = {
  id: 'T10',
  slots: [P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0, 1, 2] }, { slotIndexes: [3, 4, 5] }],
};

/** T11 — Quintento misto: 1 retrato grande + 4 quadrados (para batches mistos) */
const T11: Template = {
  id: 'T11',
  slots: [S(), S(), S(), S(), S()],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3, 4] }],
};

// Fallbacks: cobrem exatamente N fotos finais (N = 1..5)
// Cada N tem variantes por orientação dominante do resíduo.
const FB1_LAND: Template = { id: 'FB1L', slots: [L(3 / 2)], strips: [{ slotIndexes: [0] }] };
const FB1_PORT: Template = { id: 'FB1P', slots: [P(3 / 4)], strips: [{ slotIndexes: [0] }] };
const FB1_SQ:   Template = { id: 'FB1S', slots: [S()],      strips: [{ slotIndexes: [0] }] };

const FB2_LAND = T4;
const FB2_PORT = T9;
const FB2_SQ:   Template = { id: 'FB2S', slots: [S(), S()], strips: [{ slotIndexes: [0, 1] }] };

const FB3_LAND = T6;
const FB3_PORT = T8;
const FB3_SQ:   Template = { id: 'FB3S', slots: [S(), S(), S()], strips: [{ slotIndexes: [0, 1, 2] }] };

const FB4_LAND: Template = {
  id: 'FB4L',
  slots: [L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }],
};
const FB4_PORT = T2;
const FB4_SQ:   Template = { id: 'FB4S', slots: [S(), S(), S(), S()], strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }] };

/** T12 — Revista: destaque vertical à esquerda + 2 quadradas empilhadas à direita */
const T12: Template = {
  id: 'T12',
  slots: [P(4 / 5), S(), S()],
  // Layout absoluto: usa pairs simétricos via 2 strips iguais com o destaque
  // ocupando ambas via flex-row é inviável aqui (engine é strip-based).
  // Estratégia: strip 1 com destaque + quadrada; strip 2 com 2 quadradas
  // empilhadas seria via colunas. Para manter o engine simples e a regra
  // "sem espaços vazios", aproximamos como duas strips: linha grande
  // (destaque + quadrada) e linha menor (1 quadrada esticada).
  // Para evitar foto solitária esticada, T12 usa apenas strip 1.
  strips: [{ slotIndexes: [0, 1, 2] }],
  hasFeaturedSlot: true,
};

/** T13 — Trio com destaque central (vertical) entre duas paisagens */
const T13: Template = {
  id: 'T13',
  slots: [L(3 / 2), P(4 / 5), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1, 2] }],
  hasFeaturedSlot: true,
};

const DESKTOP_SEQUENCE: Template[] = [T6, T2, T12, T7, T8, T3, T13, T4, T10, T9];

const DESKTOP_FALLBACKS: Record<PhotoOrientation, Record<number, Template>> = {
  landscape: { 1: FB1_LAND, 2: FB2_LAND, 3: FB3_LAND, 4: FB4_LAND, 5: FB5_LAND },
  portrait:  { 1: FB1_PORT, 2: FB2_PORT, 3: FB3_PORT, 4: FB4_PORT, 5: FB5_PORT },
  square:    { 1: FB1_SQ,   2: FB2_SQ,   3: FB3_SQ,   4: FB4_SQ,   5: FB5_SQ },
};

// ============================================================
// MOBILE TEMPLATES (< 640px)
// ============================================================

/** M1 — Par quadrado */
const M1: Template = {
  id: 'M1',
  slots: [S(), S()],
  strips: [{ slotIndexes: [0, 1] }],
};

/** M2 — Hero landscape + par quadrado */
const M2: Template = {
  id: 'M2',
  slots: [L(3 / 2), S(), S()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

/** M3 — 4 quadradas em 2x2 */
const M3: Template = {
  id: 'M3',
  slots: [S(), S(), S(), S()],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }],
};

/** M4 — Panorâmica full + par retrato */
const M4: Template = {
  id: 'M4',
  slots: [L(16 / 9), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

/** M5 — Par retrato */
const M5: Template = {
  id: 'M5',
  slots: [P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0, 1] }],
};

/** M6 — Hero retrato + par quadrado */
const M6: Template = {
  id: 'M6',
  slots: [P(3 / 4), S(), S()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

const MFB1_LAND: Template = { id: 'MFB1L', slots: [L(3 / 2)], strips: [{ slotIndexes: [0] }] };
const MFB1_PORT: Template = { id: 'MFB1P', slots: [P(3 / 4)], strips: [{ slotIndexes: [0] }] };
const MFB1_SQ:   Template = { id: 'MFB1S', slots: [S()],      strips: [{ slotIndexes: [0] }] };

const MFB2_LAND: Template = { id: 'MFB2L', slots: [L(3 / 2), L(3 / 2)], strips: [{ slotIndexes: [0, 1] }] };
const MFB2_PORT = M5;
const MFB2_SQ   = M1;

const MFB3_LAND: Template = {
  id: 'MFB3L',
  slots: [L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
};
const MFB3_PORT: Template = {
  id: 'MFB3P',
  slots: [P(3 / 4), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
};
const MFB3_SQ:   Template = { id: 'MFB3S', slots: [S(), S(), S()], strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }] };

const MFB4_SQ = M3;
const MFB4_PORT: Template = {
  id: 'MFB4P',
  slots: [P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }],
};
const MFB4_LAND: Template = {
  id: 'MFB4L',
  slots: [L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }],
};

const MFB5_LAND: Template = {
  id: 'MFB5L',
  slots: [L(16 / 9), L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [
    { slotIndexes: [0] },
    { slotIndexes: [1, 2] },
    { slotIndexes: [3, 4] },
  ],
};
const MFB5_PORT: Template = {
  id: 'MFB5P',
  slots: [P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4)],
  strips: [
    { slotIndexes: [0, 1] },
    { slotIndexes: [2, 3, 4] },
  ],
};
const MFB5_SQ:   Template = {
  id: 'MFB5S',
  slots: [S(), S(), S(), S(), S()],
  strips: [
    { slotIndexes: [0, 1] },
    { slotIndexes: [2, 3, 4] },
  ],
};

const MOBILE_SEQUENCE: Template[] = [M2, M3, M1, M4, M6, M5, M3, M2];

const MOBILE_FALLBACKS: Record<PhotoOrientation, Record<number, Template>> = {
  landscape: { 1: MFB1_LAND, 2: MFB2_LAND, 3: MFB3_LAND, 4: MFB4_LAND, 5: MFB5_LAND },
  portrait:  { 1: MFB1_PORT, 2: MFB2_PORT, 3: MFB3_PORT, 4: MFB4_PORT, 5: MFB5_PORT },
  square:    { 1: MFB1_SQ,   2: MFB2_SQ,   3: MFB3_SQ,   4: MFB4_SQ,   5: MFB5_SQ },
};

// ============================================================
// SELECTION ALGORITHM
// ============================================================

/** Verifica se um template é compatível com a janela de orientações. */
function templateMatchesOrientations(
  template: Template,
  orientations: PhotoOrientation[],
): boolean {
  if (template.slots.length > orientations.length) return false;
  for (let i = 0; i < template.slots.length; i++) {
    if (!slotAccepts(template.slots[i].orientation, orientations[i])) return false;
  }
  return true;
}

/** Orientação dominante de uma lista. */
function dominantOrientation(orientations: PhotoOrientation[]): PhotoOrientation {
  const count = { landscape: 0, portrait: 0, square: 0 };
  for (const o of orientations) count[o]++;
  if (count.portrait > count.landscape && count.portrait >= count.square) return 'portrait';
  if (count.landscape >= count.portrait && count.landscape >= count.square) return 'landscape';
  return 'square';
}

/**
 * Escolhe template para o batch corrente.
 *
 * Recebe a janela de orientações das próximas fotos (mesma ordem).
 * Garante: zero órfãs (fallback exato para N=1..5) E zero violação de
 * orientação (foto vertical nunca em slot horizontal e vice-versa).
 */
export function selectTemplateBatch(
  remaining: number,
  cursor: number,
  isMobile: boolean,
  nextOrientations: PhotoOrientation[],
  nextPhotoIsFeatured: boolean,
): { template: Template; nextCursor: number } {
  const sequence = isMobile ? MOBILE_SEQUENCE : DESKTOP_SEQUENCE;
  const fallbacks = isMobile ? MOBILE_FALLBACKS : DESKTOP_FALLBACKS;

  // Caso 1: poucas fotos restantes — usa fallback exato pela orientação dominante.
  if (remaining <= 5) {
    const dom = dominantOrientation(nextOrientations.slice(0, remaining));
    let fb = fallbacks[dom][remaining];
    // Se o fallback dominante não casar exatamente (caso muito misto),
    // tenta os outros antes de degradar para o quadrado (coringa).
    if (!templateMatchesOrientations(fb, nextOrientations)) {
      const alt: PhotoOrientation[] = ['portrait', 'landscape', 'square'];
      for (const o of alt) {
        const cand = fallbacks[o][remaining];
        if (templateMatchesOrientations(cand, nextOrientations)) {
          fb = cand;
          break;
        }
      }
      // Última garantia: fallback quadrado aceita qualquer foto via object-cover
      if (!templateMatchesOrientations(fb, nextOrientations)) {
        fb = fallbacks.square[remaining];
      }
    }
    return { template: fb, nextCursor: cursor };
  }

  // Caso 2: foto destaque na cabeça — prioriza template com slot grande
  // QUE TAMBÉM case orientações da janela.
  if (nextPhotoIsFeatured) {
    for (let probe = 0; probe < sequence.length; probe++) {
      const cand = sequence[(cursor + probe) % sequence.length];
      if (!cand.hasFeaturedSlot) continue;
      if (cand.slots.length > remaining) continue;
      if (!templateMatchesOrientations(cand, nextOrientations)) continue;
      return { template: cand, nextCursor: cursor + probe + 1 };
    }
  }

  // Caso 3: próximo template do sequence que case orientações.
  for (let probe = 0; probe < sequence.length; probe++) {
    const cand = sequence[(cursor + probe) % sequence.length];
    if (cand.slots.length > remaining) continue;
    if (!templateMatchesOrientations(cand, nextOrientations)) continue;
    return { template: cand, nextCursor: cursor + probe + 1 };
  }

  // Caso 4: nenhum template casou perfeitamente — consome 1 foto via fallback
  // exato de orientação para a primeira foto. Garante progresso sem violação.
  const head = nextOrientations[0];
  return { template: fallbacks[head][1], nextCursor: cursor };
}

/**
 * Calcula a altura de uma strip dado a largura do container.
 * Largura = soma(AR_i * h) + (n-1)*gap  →  h = (W - (n-1)*gap) / sum(AR)
 */
export function computeStripHeight(
  strip: TemplateStrip,
  template: Template,
  containerWidth: number,
  gap: number,
): number {
  const ratios = strip.slotIndexes.map((i) => template.slots[i].ar);
  const sumAR = ratios.reduce((a, b) => a + b, 0);
  const gaps = (strip.slotIndexes.length - 1) * gap;
  return Math.max(0, (containerWidth - gaps) / sumAR);
}
