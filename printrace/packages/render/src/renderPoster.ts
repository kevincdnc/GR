import type { Activity } from '@printrace/core'
import { CSS_PX_PER_MM, exportPixels, pageGeometry, type PosterSpec } from '@printrace/poster/model'
import { getBrowser } from './browser.ts'
import { setPngDpi } from './png.ts'
import { prepress } from './prepress.ts'

export type ExportFormat = 'pdf' | 'png'

export interface RenderRequest {
  activity: Activity
  spec: PosterSpec
  format: ExportFormat
  /** 300 par défaut ; la carte est rendue à cette résolution */
  dpi?: number
  /** URL de apps/web/render.html */
  pageUrl: string
  timeoutMs?: number
}

export interface RenderResult {
  data: Uint8Array
  mime: string
  fileName: string
  /** false si le fond de carte n'a pas pu être chargé (le poster reste valide) */
  mapOk: boolean
  pixels?: { w: number; h: number }
}

// Au-delà, Chromium refuse la capture : on réduit la résolution (≥ 200 dpi en 50 × 70)
const MAX_PX = 16000

export async function renderPoster(req: RenderRequest): Promise<RenderResult> {
  const g = pageGeometry(req.spec.format.size, req.spec.format.orientation, req.spec.print.bleedMm)
  const pdf = req.format === 'pdf'
  const withBleed = pdf
  const extraMm = withBleed ? 2 * g.bleedMm : 0
  const cssW = Math.ceil((g.trimMm[0] + extraMm) * CSS_PX_PER_MM)
  const cssH = Math.ceil((g.trimMm[1] + extraMm) * CSS_PX_PER_MM)
  let dpi = req.dpi ?? 300
  if (!pdf) dpi = Math.min(dpi, Math.floor((MAX_PX / Math.max(cssW, cssH)) * 96))

  const browser = await getBrowser()
  const context = await browser.newContext({ viewport: { width: cssW, height: cssH }, deviceScaleFactor: pdf ? 1 : dpi / 96 })
  try {
    const page = await context.newPage()
    const logs: string[] = []
    page.on('console', (m) => m.type() === 'error' && logs.push(m.text()))
    page.on('pageerror', (e) => logs.push(e.message))
    await page.addInitScript((job) => {
      ;(window as unknown as { __PRINTRACE_JOB__: unknown }).__PRINTRACE_JOB__ = job
    }, { activity: req.activity, spec: req.spec, dpi, withBleed })
    await page.goto(req.pageUrl, { waitUntil: 'load' })
    const handle = await page
      .waitForFunction(() => (window as unknown as { __PRINTRACE_READY__?: unknown }).__PRINTRACE_READY__, null, { timeout: req.timeoutMs ?? 120_000, polling: 250 })
      .catch(() => {
        throw new Error(`Rendu incomplet (délai dépassé). ${logs.slice(-3).join(' | ')}`)
      })
    const ready = (await handle.jsonValue()) as { mapOk?: boolean; error?: string }
    if (ready.error) throw new Error(`Rendu impossible : ${ready.error}`)

    const base = `printrace-${req.spec.format.size}-${req.activity.name.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'poster'}`
    if (pdf) {
      const raw = await page.pdf({ width: `${g.trimMm[0] + extraMm}mm`, height: `${g.trimMm[1] + extraMm}mm`, printBackground: true, preferCSSPageSize: true })
      const data = await prepress(raw, { trimMm: g.trimMm, bleedMm: g.bleedMm, cropMarks: req.spec.print.cropMarks, title: req.spec.text.title })
      return { data, mime: 'application/pdf', fileName: `${base}.pdf`, mapOk: ready.mapOk !== false }
    }
    const px = exportPixels(g, dpi)
    const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: px.w / (dpi / 96), height: px.h / (dpi / 96) } })
    return { data: setPngDpi(shot, dpi), mime: 'image/png', fileName: `${base}-${dpi}dpi.png`, mapOk: ready.mapOk !== false, pixels: px }
  } finally {
    await context.close()
  }
}
