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
  /**
   * Índice do slot dominante quando hasFeaturedSlot=true. Default 0.
   * Templates com featuredSlotIndex !== 0 não podem ser usados para destaque
   * sem violar a ordem narrativa, portanto só entram como template comum.
   */
  featuredSlotIndex?: number;
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
/**
 * A() — slot livre. `ar: 0` é sentinela: o engine usará o AR REAL da foto
 * alocada (com clamp). Evita corte forçado em quadrado.
 */
const A = (): TemplateSlot => ({ ar: 0, orientation: 'any' });

// ============================================================
// DESKTOP / TABLET TEMPLATES (>= 640px)
// ============================================================

/** T1 — Capa: 1 panorâmica horizontal + 2 quadradas */
const T1: Template = {
  id: 'T1',
  slots: [L(3 / 2), A(), A()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
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
  featuredSlotIndex: 0,
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
  slots: [L(21 / 9), A(), A(), A(), A()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2, 3, 4] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
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
  slots: [A(), A(), A(), A(), A()],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3, 4] }],
};

// Fallbacks: cobrem exatamente N fotos finais (N = 1..5)
// Cada N tem variantes por orientação dominante do resíduo.
const FB1_LAND: Template = { id: 'FB1L', slots: [L(3 / 2)], strips: [{ slotIndexes: [0] }] };
const FB1_PORT: Template = { id: 'FB1P', slots: [P(3 / 4)], strips: [{ slotIndexes: [0] }] };
const FB1_SQ:   Template = { id: 'FB1S', slots: [A()],      strips: [{ slotIndexes: [0] }] };

const FB2_LAND = T4;
const FB2_PORT = T9;
const FB2_SQ:   Template = { id: 'FB2S', slots: [A(), A()], strips: [{ slotIndexes: [0, 1] }] };

const FB3_LAND = T6;
const FB3_PORT = T8;
const FB3_SQ:   Template = { id: 'FB3S', slots: [A(), A(), A()], strips: [{ slotIndexes: [0, 1, 2] }] };

const FB4_LAND: Template = {
  id: 'FB4L',
  slots: [L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }],
};
const FB4_PORT = T2;
const FB4_SQ:   Template = { id: 'FB4S', slots: [A(), A(), A(), A()], strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }] };

/**
 * T12 — Revista (redesenhado): destaque retrato hero em strip solo +
 * par de quase-quadradas na strip seguinte. Slot 0 é o destaque.
 */
const T12: Template = {
  id: 'T12',
  slots: [P(4 / 5), A(), A()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
};

/**
 * T13 — Trio com retrato central maior. featuredSlotIndex=1 inviabiliza
 * uso como destaque (violaria ordem narrativa), portanto entra apenas
 * como template comum no sequence.
 */
const T13: Template = {
  id: 'T13',
  slots: [P(2 / 3), P(4 / 5), P(2 / 3)],
  strips: [{ slotIndexes: [0, 1, 2] }],
  hasFeaturedSlot: false,
};

/** T14 — Par de retratos lado a lado (composição neutra, não-destaque). */
const T14: Template = {
  id: 'T14',
  slots: [P(4 / 5), P(4 / 5)],
  strips: [{ slotIndexes: [0, 1] }],
  hasFeaturedSlot: false,
};

const FB5_LAND: Template = {
  id: 'FB5L',
  slots: [L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2), L(3 / 2)],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3, 4] }],
};
const FB5_PORT: Template = {
  id: 'FB5P',
  slots: [P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3, 4] }],
};
const FB5_SQ: Template = {
  id: 'FB5S',
  slots: [A(), A(), A(), A(), A()],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3, 4] }],
};

// T12, M2, M4, M6 são templates de DESTAQUE (hero solo + par). Removidos
// do sequence comum para não criar "retrato pequeno solo" no início ou
// no meio da galeria quando a foto-cabeça não é destaque.
const DESKTOP_SEQUENCE: Template[] = [T6, T2, T14, T7, T8, T3, T13, T4, T10, T9];

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
  slots: [A(), A()],
  strips: [{ slotIndexes: [0, 1] }],
};

/** M2 — Hero landscape + par quadrado */
const M2: Template = {
  id: 'M2',
  slots: [L(3 / 2), A(), A()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
};

/** M3 — 4 quadradas em 2x2 */
const M3: Template = {
  id: 'M3',
  slots: [A(), A(), A(), A()],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }],
};

/** M4 — Panorâmica full + par retrato */
const M4: Template = {
  id: 'M4',
  slots: [L(16 / 9), P(3 / 4), P(3 / 4)],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
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
  slots: [P(3 / 4), A(), A()],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
};

const MFB1_LAND: Template = { id: 'MFB1L', slots: [L(3 / 2)], strips: [{ slotIndexes: [0] }] };
const MFB1_PORT: Template = { id: 'MFB1P', slots: [P(3 / 4)], strips: [{ slotIndexes: [0] }] };
const MFB1_SQ:   Template = { id: 'MFB1S', slots: [A()],      strips: [{ slotIndexes: [0] }] };

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
const MFB3_SQ:   Template = { id: 'MFB3S', slots: [A(), A(), A()], strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }] };

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
  slots: [A(), A(), A(), A(), A()],
  strips: [
    { slotIndexes: [0, 1] },
    { slotIndexes: [2, 3, 4] },
  ],
};

// M2/M4/M6 são templates de DESTAQUE — removidos do sequence comum.
const MOBILE_SEQUENCE: Template[] = [M3, M1, M5, M3, M1, M5];

const MOBILE_FALLBACKS: Record<PhotoOrientation, Record<number, Template>> = {
  landscape: { 1: MFB1_LAND, 2: MFB2_LAND, 3: MFB3_LAND, 4: MFB4_LAND, 5: MFB5_LAND },
  portrait:  { 1: MFB1_PORT, 2: MFB2_PORT, 3: MFB3_PORT, 4: MFB4_PORT, 5: MFB5_PORT },
  square:    { 1: MFB1_SQ,   2: MFB2_SQ,   3: MFB3_SQ,   4: MFB4_SQ,   5: MFB5_SQ },
};

// ============================================================
// FEATURED CATALOG — templates de destaque por orientação da foto-cabeça.
// Todos têm featuredSlotIndex=0 (a foto destacada vai no primeiro slot,
// preservando a ordem narrativa).
// ============================================================

/** Destaque solo — última linha de defesa: 1 foto isolada na strip. */
const TF_SOLO_L: Template = {
  id: 'TF_SOLO_L',
  slots: [L(3 / 2)],
  strips: [{ slotIndexes: [0] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
};
const TF_SOLO_P: Template = {
  id: 'TF_SOLO_P',
  slots: [P(3 / 4)],
  strips: [{ slotIndexes: [0] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
};
const TF_SOLO_S: Template = {
  id: 'TF_SOLO_S',
  slots: [A()],
  strips: [{ slotIndexes: [0] }],
  hasFeaturedSlot: true,
  featuredSlotIndex: 0,
};

/** Catálogo ordenado por preferência (do mais rico ao solo). */
const FEATURED_DESKTOP: Record<PhotoOrientation, Template[]> = {
  landscape: [T3, T1, T5, TF_SOLO_L],
  portrait:  [T12, TF_SOLO_P],
  square:    [T1, TF_SOLO_S],
};

const FEATURED_MOBILE: Record<PhotoOrientation, Template[]> = {
  landscape: [M4, M2, TF_SOLO_L],
  portrait:  [M6, TF_SOLO_P],
  square:    [M2, TF_SOLO_S],
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

/** Maior número de fotos em uma única strip de um template. */
function maxStripCells(t: Template): number {
  let m = 0;
  for (const s of t.strips) m = Math.max(m, s.slotIndexes.length);
  return m;
}

/**
 * Escolhe template para o batch corrente.
 *
 * Garantias:
 * 1. Ordem narrativa: photos[idx] sempre vai para slot[0].
 * 2. Zero órfãs: fallback exato para N=1..5.
 * 3. Zero violação de orientação (foto vertical nunca em slot horizontal).
 * 4. Se a foto-cabeça é destaque, SEMPRE retorna template com hasFeaturedSlot
 *    e featuredSlotIndex=0 (degrada até solo). Nunca cai em template comum.
 *
 * `avoidIds` permite a engine pedir re-seleção quando um template gera
 * vazio horizontal excessivo após cálculo de larguras (rede de segurança).
 */
export function selectTemplateBatch(
  remaining: number,
  cursor: number,
  isMobile: boolean,
  nextOrientations: PhotoOrientation[],
  nextPhotoIsFeatured: boolean,
  maxItemsPerStrip?: number,
  avoidIds?: Set<string>,
  forbidLeadingSolo?: boolean,
): { template: Template; nextCursor: number } {
  const sequence = isMobile ? MOBILE_SEQUENCE : DESKTOP_SEQUENCE;
  const fallbacks = isMobile ? MOBILE_FALLBACKS : DESKTOP_FALLBACKS;
  const featuredCatalog = isMobile ? FEATURED_MOBILE : FEATURED_DESKTOP;
  const stripCapOk = (t: Template) =>
    maxItemsPerStrip === undefined || maxStripCells(t) <= maxItemsPerStrip;
  const notAvoided = (t: Template) => !avoidIds || !avoidIds.has(t.id);
  // Bloqueia templates cuja PRIMEIRA strip tem só 1 célula NÃO-destaque
  // (evita "retrato pequeno solo" no início da galeria).
  const leadingSoloOk = (t: Template) => {
    if (!forbidLeadingSolo) return true;
    const firstStrip = t.strips[0];
    if (!firstStrip || firstStrip.slotIndexes.length > 1) return true;
    const slotIdx = firstStrip.slotIndexes[0];
    const isFeaturedStrip =
      !!t.hasFeaturedSlot && slotIdx === (t.featuredSlotIndex ?? 0);
    return isFeaturedStrip;
  };

  // Caso 1 (destaque): catálogo dirigido por orientação da foto-cabeça.
  if (nextPhotoIsFeatured) {
    const head = nextOrientations[0];
    const candidates = featuredCatalog[head] ?? [];
    for (const cand of candidates) {
      if (cand.slots.length > remaining) continue;
      if (!stripCapOk(cand)) continue;
      if (cand.featuredSlotIndex !== undefined && cand.featuredSlotIndex !== 0) continue;
      if (!templateMatchesOrientations(cand, nextOrientations)) continue;
      if (!notAvoided(cand)) continue;
      return { template: cand, nextCursor: cursor };
    }
    const solo =
      head === 'landscape' ? TF_SOLO_L : head === 'portrait' ? TF_SOLO_P : TF_SOLO_S;
    return { template: solo, nextCursor: cursor };
  }

  // Caso 2: poucas fotos restantes — fallback exato pela orientação dominante.
  if (remaining <= 5) {
    const dom = dominantOrientation(nextOrientations.slice(0, remaining));
    let fb = fallbacks[dom][remaining];
    if (!templateMatchesOrientations(fb, nextOrientations) || !notAvoided(fb)) {
      const alt: PhotoOrientation[] = ['portrait', 'landscape', 'square'];
      for (const o of alt) {
        const cand = fallbacks[o][remaining];
        if (templateMatchesOrientations(cand, nextOrientations) && notAvoided(cand)) {
          fb = cand;
          break;
        }
      }
      if (!templateMatchesOrientations(fb, nextOrientations)) {
        fb = fallbacks.square[remaining];
      }
    }
    return { template: fb, nextCursor: cursor };
  }

  // Caso 3: sequence comum, com filtro anti-solo na cabeça.
  for (let probe = 0; probe < sequence.length; probe++) {
    const cand = sequence[(cursor + probe) % sequence.length];
    if (cand.slots.length > remaining) continue;
    if (!stripCapOk(cand)) continue;
    if (!templateMatchesOrientations(cand, nextOrientations)) continue;
    if (!notAvoided(cand)) continue;
    if (!leadingSoloOk(cand)) continue;
    return { template: cand, nextCursor: cursor + probe + 1 };
  }

  // Caso 3b: tenta novamente sem o filtro leadingSolo (último recurso).
  if (forbidLeadingSolo) {
    for (let probe = 0; probe < sequence.length; probe++) {
      const cand = sequence[(cursor + probe) % sequence.length];
      if (cand.slots.length > remaining) continue;
      if (!stripCapOk(cand)) continue;
      if (!templateMatchesOrientations(cand, nextOrientations)) continue;
      if (!notAvoided(cand)) continue;
      return { template: cand, nextCursor: cursor + probe + 1 };
    }
  }

  // Caso 4: nenhum template casou — consome 1 foto via fallback exato.
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
