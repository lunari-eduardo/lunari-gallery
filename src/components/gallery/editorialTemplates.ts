/**
 * Editorial Templates Engine
 *
 * Padrões de composição pré-definidos para o tema "Editorial Revista".
 * Cada template é uma sequência de "strips" (linhas horizontais) onde cada
 * célula tem aspect-ratio fixo. A altura da strip é calculada para preencher
 * 100% da largura do container, garantindo ZERO espaço residual.
 *
 * Regra invioloável: o algoritmo nunca escolhe um template que deixaria
 * fotos sobrando sem template correspondente. Para qualquer N residual,
 * existe um Fallback (FB_N) que consome exatamente N fotos.
 */

export interface TemplateSlot {
  /** aspectRatio do slot (width/height). Foto é cortada via object-cover. */
  ar: number;
}

export interface TemplateStrip {
  /** Índices dos slots (referindo a Template.slots) presentes nesta strip. */
  slotIndexes: number[];
}

export interface Template {
  id: string;
  /** Número de fotos que este template consome. */
  slots: TemplateSlot[];
  /** Strips: cada strip ocupa 100% da largura. */
  strips: TemplateStrip[];
  /** Se for um destaque (slot grande), a 1ª foto deve ir aqui se peso_visual=1. */
  hasFeaturedSlot?: boolean;
}

// ============================================================
// DESKTOP / TABLET TEMPLATES (>= 640px)
// ============================================================

/** T1 — Capa de revista: 1 panorâmica + 2 quadradas */
const T1: Template = {
  id: 'T1',
  slots: [{ ar: 3 / 2 }, { ar: 1 }, { ar: 1 }],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

/** T2 — Quarteto: 4 retratos lado a lado */
const T2: Template = {
  id: 'T2',
  slots: [{ ar: 3 / 4 }, { ar: 3 / 4 }, { ar: 3 / 4 }, { ar: 3 / 4 }],
  strips: [{ slotIndexes: [0, 1, 2, 3] }],
};

/** T3 — Trio assimétrico: 1 grande + 2 médias abaixo */
const T3: Template = {
  id: 'T3',
  slots: [{ ar: 16 / 9 }, { ar: 3 / 2 }, { ar: 3 / 2 }],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

/** T4 — Díptico landscape */
const T4: Template = {
  id: 'T4',
  slots: [{ ar: 3 / 2 }, { ar: 3 / 2 }],
  strips: [{ slotIndexes: [0, 1] }],
};

/** T5 — Mix denso: 1 panorâmica + 4 quadradas */
const T5: Template = {
  id: 'T5',
  slots: [{ ar: 21 / 9 }, { ar: 1 }, { ar: 1 }, { ar: 1 }, { ar: 1 }],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2, 3, 4] }],
  hasFeaturedSlot: true,
};

/** T6 — Trio simétrico: 3 paisagens */
const T6: Template = {
  id: 'T6',
  slots: [{ ar: 3 / 2 }, { ar: 3 / 2 }, { ar: 3 / 2 }],
  strips: [{ slotIndexes: [0, 1, 2] }],
};

/** T7 — Galeria 6 fotos: 3 em cima, 3 embaixo */
const T7: Template = {
  id: 'T7',
  slots: [
    { ar: 3 / 2 }, { ar: 3 / 2 }, { ar: 3 / 2 },
    { ar: 3 / 2 }, { ar: 3 / 2 }, { ar: 3 / 2 },
  ],
  strips: [{ slotIndexes: [0, 1, 2] }, { slotIndexes: [3, 4, 5] }],
};

// Fallbacks: cobrem exatamente N fotos finais (N = 1..5)
const FB1: Template = {
  id: 'FB1',
  slots: [{ ar: 3 / 2 }],
  strips: [{ slotIndexes: [0] }],
};
const FB2: Template = {
  id: 'FB2',
  slots: [{ ar: 3 / 2 }, { ar: 3 / 2 }],
  strips: [{ slotIndexes: [0, 1] }],
};
const FB3: Template = T6;
const FB4: Template = T2;
const FB5: Template = T5;

const DESKTOP_SEQUENCE: Template[] = [T1, T2, T3, T6, T4, T7, T2, T5, T3];
const DESKTOP_FALLBACKS: Record<number, Template> = { 1: FB1, 2: FB2, 3: FB3, 4: FB4, 5: FB5 };

// ============================================================
// MOBILE TEMPLATES (< 640px) — 1 ou 2 colunas
// ============================================================

/** M1 — Par de quadradas */
const M1: Template = {
  id: 'M1',
  slots: [{ ar: 1 }, { ar: 1 }],
  strips: [{ slotIndexes: [0, 1] }],
};

/** M2 — Hero + par de quadradas */
const M2: Template = {
  id: 'M2',
  slots: [{ ar: 3 / 2 }, { ar: 1 }, { ar: 1 }],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

/** M3 — 4 quadradas em 2x2 */
const M3: Template = {
  id: 'M3',
  slots: [{ ar: 1 }, { ar: 1 }, { ar: 1 }, { ar: 1 }],
  strips: [{ slotIndexes: [0, 1] }, { slotIndexes: [2, 3] }],
};

/** M4 — Panorâmica full-bleed + par */
const M4: Template = {
  id: 'M4',
  slots: [{ ar: 16 / 9 }, { ar: 3 / 4 }, { ar: 3 / 4 }],
  strips: [{ slotIndexes: [0] }, { slotIndexes: [1, 2] }],
  hasFeaturedSlot: true,
};

const MFB1: Template = {
  id: 'MFB1',
  slots: [{ ar: 3 / 2 }],
  strips: [{ slotIndexes: [0] }],
};
const MFB2: Template = M1;
const MFB3: Template = M2;
const MFB4: Template = M3;
const MFB5: Template = {
  id: 'MFB5',
  slots: [{ ar: 16 / 9 }, { ar: 1 }, { ar: 1 }, { ar: 1 }, { ar: 1 }],
  strips: [
    { slotIndexes: [0] },
    { slotIndexes: [1, 2] },
    { slotIndexes: [3, 4] },
  ],
};

const MOBILE_SEQUENCE: Template[] = [M2, M3, M1, M4, M3, M2];
const MOBILE_FALLBACKS: Record<number, Template> = { 1: MFB1, 2: MFB2, 3: MFB3, 4: MFB4, 5: MFB5 };

// ============================================================
// SELECTION ALGORITHM
// ============================================================

/**
 * Garante zero fotos órfãs: para qualquer N restante, escolhe um template
 * cujos slots <= N e que não deixe resíduo impossível de consumir.
 *
 * Como temos fallbacks para N ∈ {1..5}, qualquer resíduo nessa faixa é OK.
 * Para N >= 6, qualquer template do sequence funciona (todos têm slots <= 6).
 *
 * Se a próxima foto tem peso_visual=1, força um template com hasFeaturedSlot.
 */
export function selectTemplateBatch(
  remaining: number,
  cursor: number,
  isMobile: boolean,
  nextPhotoIsFeatured: boolean,
): { template: Template; nextCursor: number } {
  const sequence = isMobile ? MOBILE_SEQUENCE : DESKTOP_SEQUENCE;
  const fallbacks = isMobile ? MOBILE_FALLBACKS : DESKTOP_FALLBACKS;

  // Caso 1: restam poucas fotos — usa fallback exato (consome 100%, zero resíduo).
  if (remaining <= 5) {
    return { template: fallbacks[remaining], nextCursor: cursor };
  }

  // Caso 2: foto de destaque na cabeça — pula até template com slot grande.
  if (nextPhotoIsFeatured) {
    for (let probe = 0; probe < sequence.length; probe++) {
      const candidate = sequence[(cursor + probe) % sequence.length];
      if (candidate.hasFeaturedSlot && candidate.slots.length <= remaining) {
        // Verificar resíduo: remaining - candidate.slots tem que ser 0 ou >= 1 (cobrível por fallback)
        const residue = remaining - candidate.slots.length;
        if (residue === 0 || (residue >= 1 && residue <= 5) || residue >= 6) {
          return { template: candidate, nextCursor: cursor + probe + 1 };
        }
      }
    }
  }

  // Caso 3: pega o próximo do sequence; valida que o resíduo é coberto.
  for (let probe = 0; probe < sequence.length; probe++) {
    const candidate = sequence[(cursor + probe) % sequence.length];
    if (candidate.slots.length > remaining) continue;
    const residue = remaining - candidate.slots.length;
    // Qualquer resíduo é coberto: 0 (acabou), 1..5 (fallback), >=6 (próximo template)
    if (residue === 0 || residue >= 1) {
      return { template: candidate, nextCursor: cursor + probe + 1 };
    }
  }

  // Failsafe (não deve acontecer): usa fallback de 1
  return { template: fallbacks[1], nextCursor: cursor + 1 };
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
