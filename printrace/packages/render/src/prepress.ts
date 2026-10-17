// Prépresse PDF : boîtes TrimBox / BleedBox (lues par les imprimeurs et les
// RIP) et traits de coupe. La page Chromium est incorporée telle quelle
// (embedPage) : tracé, textes et polices restent vectoriels.
import { PDFDocument, PDFName, cmyk } from 'pdf-lib'

const PT_PER_MM = 72 / 25.4

export interface PrepressOptions {
  trimMm: [number, number]
  bleedMm: number
  cropMarks: boolean
  title?: string
}

export async function prepress(chromiumPdf: Uint8Array, o: PrepressOptions): Promise<Uint8Array> {
  const src = await PDFDocument.load(chromiumPdf)
  const out = await PDFDocument.create()
  const [page] = await out.embedPdf(src, [0])
  const bleed = o.bleedMm * PT_PER_MM
  const trimW = o.trimMm[0] * PT_PER_MM
  const trimH = o.trimMm[1] * PT_PER_MM
  // zone des traits de coupe autour du fond perdu
  const slug = o.cropMarks ? 10 * PT_PER_MM : 0
  const W = trimW + 2 * (bleed + slug)
  const H = trimH + 2 * (bleed + slug)
  const p = out.addPage([W, H])
  p.drawPage(page, { x: slug, y: slug, width: trimW + 2 * bleed, height: trimH + 2 * bleed })

  const trim = [slug + bleed, slug + bleed, slug + bleed + trimW, slug + bleed + trimH]
  const box = (r: number[]) => out.context.obj(r)
  p.node.set(PDFName.of('TrimBox'), box(trim))
  p.node.set(PDFName.of('BleedBox'), box([slug, slug, W - slug, H - slug]))
  p.node.set(PDFName.of('ArtBox'), box(trim))

  if (o.cropMarks) {
    // noir de repérage (100 % sur les 4 couches), 0,25 pt, hors du fond perdu
    const reg = cmyk(1, 1, 1, 1)
    const len = 6 * PT_PER_MM
    const gap = bleed + 1.5 * PT_PER_MM
    const [x0, y0, x1, y1] = trim
    const lines: [number, number, number, number][] = []
    for (const x of [x0, x1]) for (const y of [y0, y1]) {
      const sx = x === x0 ? -1 : 1
      const sy = y === y0 ? -1 : 1
      lines.push([x + sx * gap, y, x + sx * (gap + len), y]) // horizontal
      lines.push([x, y + sy * gap, x, y + sy * (gap + len)]) // vertical
    }
    for (const [ax, ay, bx, by] of lines) p.drawLine({ start: { x: ax, y: ay }, end: { x: bx, y: by }, thickness: 0.25, color: reg })
  }
  out.setTitle(o.title ?? 'Printrace')
  out.setProducer('Printrace')
  out.setCreator('Printrace render')
  return out.save()
}
