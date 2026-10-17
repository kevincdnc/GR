// Polices des posters, servies avec l'app (aucune dépendance à un CDN) : le
// rendu d'export dans Chromium headless utilise exactement les mêmes fichiers,
// et Chromium les incorpore (sous-ensembles) dans le PDF.
import '@fontsource/anton/400.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'

export const FONTS = {
  display: "'Barlow Semi Condensed'",
  sans: "'Inter'",
  serif: "'Playfair Display'",
  mono: "'JetBrains Mono'",
  poster: "'Anton'",
} as const
export type FontFamily = keyof typeof FONTS

const FACES: [FontFamily, number][] = [
  ['poster', 400],
  ['display', 500],
  ['display', 600],
  ['display', 700],
  ['sans', 400],
  ['sans', 500],
  ['sans', 600],
  ['sans', 800],
  ['mono', 400],
  ['mono', 600],
  ['serif', 400],
  ['serif', 700],
]

let ready: Promise<void> | null = null
/** Charge toutes les polices (une fois) : les mesures de texte en dépendent. */
export function ensureFonts(): Promise<void> {
  ready ??= Promise.all(FACES.map(([f, w]) => document.fonts.load(`${w} 40px ${FONTS[f]}`, 'Aa1°′'))).then(() => undefined)
  return ready
}

let ctx: CanvasRenderingContext2D | null = null
/** Largeur d'un texte, dans la même unité que `size`. */
export function measureText(text: string, family: FontFamily, weight: number, size: number, letterSpacing = 0): number {
  ctx ??= document.createElement('canvas').getContext('2d')!
  ctx.font = `${weight} 100px ${FONTS[family]}`
  const chars = [...text].length
  return (ctx.measureText(text).width / 100) * size + letterSpacing * size * Math.max(0, chars - 1)
}

/** Découpe en lignes de largeur ≤ maxW (au plus maxLines, la dernière tronquée par « … »). */
export function wrapText(text: string, family: FontFamily, weight: number, size: number, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (cur && measureText(next, family, weight, size) > maxW) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`
    return kept
  }
  return lines
}
