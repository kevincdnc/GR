import type { Activity } from '@printrace/core'
import { pageGeometry, Poster, type PosterSpec } from '@printrace/poster'
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

/** Aperçu « au mur » : le poster à l'échelle, dans un cadre (le cadre n'est pas imprimé). */
export function Preview({ activity, spec, frame, onFrame }: { activity: Activity; spec: PosterSpec; frame: FrameId; onFrame: (f: FrameId) => void }) {
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
  const avail = { w: box.w - 48, h: box.h - 48 }
  // largeur du poster (hors cadre) qui tient dans la scène
  const w = Math.max(120, Math.floor(Math.min(avail.w / (1 + 2 * framePad), avail.h / (ratio + 2 * framePad))))
  const [mw, mh] = g.trimMm
  return (
    <div className="preview">
      <div className="wall" ref={host}>
        <div className={`frame frame-${frame}`} style={{ padding: w * framePad }}>
          <Poster activity={activity} spec={spec} mode="preview" displayWidth={w} noMap={DEMO} />
        </div>
      </div>
      <div className="preview-bar">
        <span>
          {spec.format.size.toUpperCase()} · {(mw / 10).toLocaleString('fr-FR')} × {(mh / 10).toLocaleString('fr-FR')} cm · cadre en aperçu uniquement
        </span>
        <div className="frames" role="radiogroup" aria-label="Cadre (aperçu)">
          {FRAMES.map((f) => (
            <button key={f.id} role="radio" aria-checked={frame === f.id} className={`swatch swatch-${f.id}${frame === f.id ? ' is-on' : ''}`} title={f.name} onClick={() => onFrame(f.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}
