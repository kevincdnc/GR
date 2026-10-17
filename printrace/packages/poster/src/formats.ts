// Formats papier et géométrie d'impression.
//
// Toutes les mises en page travaillent dans un repère où la largeur *au format
// fini* (trim) vaut 1000 unités : un modèle s'adapte ainsi à tous les formats.
// Le fond perdu (bleed) déborde de ce repère de chaque côté.

export const PAPER_SIZES = {
  a4: { name: 'A4', sub: '21 × 29,7 cm', mm: [210, 297] },
  a3: { name: 'A3', sub: '29,7 × 42 cm', mm: [297, 420] },
  a2: { name: 'A2', sub: '42 × 59,4 cm', mm: [420, 594] },
  '30x40': { name: '30 × 40', sub: 'cm', mm: [300, 400] },
  '50x70': { name: '50 × 70', sub: 'cm', mm: [500, 700] },
  '50x50': { name: '50 × 50', sub: 'cm · carré', mm: [500, 500] },
} as const satisfies Record<string, { name: string; sub: string; mm: readonly [number, number] }>

export type PaperSizeId = keyof typeof PAPER_SIZES
export type Orientation = 'portrait' | 'landscape'

export const UNITS_PER_WIDTH = 1000
/** Pixels CSS par millimètre (96 dpi, référence du navigateur et de Chromium headless) */
export const CSS_PX_PER_MM = 96 / 25.4

export interface PageGeometry {
  /** Format fini en mm */
  trimMm: [number, number]
  bleedMm: number
  /** Repère de mise en page : largeur fixe 1000, hauteur selon le ratio */
  W: number
  H: number
  /** Fond perdu dans le repère de mise en page */
  bleed: number
  /** mm par unité de mise en page */
  mmPerUnit: number
}

export function pageGeometry(size: PaperSizeId, orientation: Orientation, bleedMm = 0): PageGeometry {
  const [a, b] = PAPER_SIZES[size].mm
  const trimMm: [number, number] = orientation === 'landscape' ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)]
  const mmPerUnit = trimMm[0] / UNITS_PER_WIDTH
  return {
    trimMm,
    bleedMm,
    W: UNITS_PER_WIDTH,
    H: (trimMm[1] / trimMm[0]) * UNITS_PER_WIDTH,
    bleed: bleedMm / mmPerUnit,
    mmPerUnit,
  }
}

/** Taille en pixels d'un export raster à `dpi` (format fini, ou avec fond perdu). */
export function exportPixels(g: PageGeometry, dpi: number, withBleed = false): { w: number; h: number } {
  const extra = withBleed ? 2 * g.bleedMm : 0
  return {
    w: Math.round(((g.trimMm[0] + extra) / 25.4) * dpi),
    h: Math.round(((g.trimMm[1] + extra) / 25.4) * dpi),
  }
}
