// Page d'impression : ouverte par @printrace/render dans Chromium headless.
// Le job (activité + spec) est injecté avant le chargement ; la page signale
// qu'elle est prête quand polices et carte sont rendues.
import type { Activity } from '@printrace/core'
import { pageGeometry, parseSpec, Poster } from '@printrace/poster'
import { createRoot } from 'react-dom/client'

interface RenderJob {
  activity: Activity
  spec: unknown
  dpi: number
  withBleed: boolean
}

declare global {
  interface Window {
    __PRINTRACE_JOB__?: RenderJob
    __PRINTRACE_READY__?: { mapOk: boolean } | { error: string }
  }
}

const job = window.__PRINTRACE_JOB__
const root = createRoot(document.getElementById('root')!)
try {
  if (!job) throw new Error('Aucun job de rendu injecté')
  const spec = parseSpec(job.spec)
  const g = pageGeometry(spec.format.size, spec.format.orientation, spec.print.bleedMm)
  const extra = job.withBleed ? 2 * g.bleedMm : 0
  const style = document.createElement('style')
  style.textContent = `@page { size: ${g.trimMm[0] + extra}mm ${g.trimMm[1] + extra}mm; margin: 0 }`
  document.head.appendChild(style)
  root.render(
    <Poster activity={job.activity} spec={spec} mode="print" dpi={job.dpi} withBleed={job.withBleed} onReady={(info) => (window.__PRINTRACE_READY__ = info)} />,
  )
} catch (e) {
  window.__PRINTRACE_READY__ = { error: e instanceof Error ? e.message : String(e) }
}
