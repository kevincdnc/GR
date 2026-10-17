import type { Activity } from '@printrace/core'
import { exportPixels, pageGeometry, PAPER_SIZES, Poster, type PosterSpec } from '@printrace/poster'
import { useLayoutEffect, useRef, useState } from 'react'
import { DEMO } from '../lib/demo.ts'

export const FRAMES = [
  { id: 'none', name: 'Sans' },
  { id: 'noir', name: 'Noir' },
  { id: 'chene', name: 'Chêne' },
  { id: 'blanc', name: 'Blanc' },
  { id: 'alu', name: 'Alu' },
] as const
export type FrameId = (typeof FRAMES)[number]['id']

const cm = (mm: number) => (mm / 10).toLocaleString('fr-FR')

/** Aperçu « au mur » : le poster à l'échelle, dans un cadre (le cadre n'est pas imprimé). */
export function Preview({ activity, spec, frame }: { activity: Activity; spec: PosterSpec; frame: FrameId }) {
  const host = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 600, h: 800 })
  useLayoutEffect(() => {
    const el = host.current!
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const g = pageGeometry(spec.format.size, spec.format.orientation)
  const ratio = g.trimMm[1] / g.trimMm[0]
  const framePad = frame === 'none' ? 0 : 0.045
  const avail = { w: box.w - 56, h: box.h - 56 }
  const w = Math.max(120, Math.floor(Math.min(avail.w / (1 + 2 * framePad), avail.h / (ratio + 2 * framePad))))
  const px = exportPixels(g, 300)
  return (
    <div className="preview">
      <div className="wall" ref={host}>
        <div className={`frame frame-${frame}`} style={{ padding: w * framePad }}>
          <Poster activity={activity} spec={spec} mode="preview" displayWidth={w} noMap={DEMO} />
        </div>
      </div>
      <p className="caption">
        {PAPER_SIZES[spec.format.size].name} · {cm(g.trimMm[0])} × {cm(g.trimMm[1])} cm · export {px.w} × {px.h} px (300 dpi) · cadre en aperçu seulement
      </p>
    </div>
  )
}
