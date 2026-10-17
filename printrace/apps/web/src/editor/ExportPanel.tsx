import type { Activity } from '@printrace/core'
import { exportPixels, pageGeometry, type PosterSpec } from '@printrace/poster'
import { useState } from 'react'
import { type ExportFormat, exportPoster } from '../lib/api.ts'
import { OrderSheet } from './OrderSheet.tsx'

export function ExportPanel({ activity, spec }: { activity: Activity; spec: PosterSpec }) {
  const [state, setState] = useState<{ format: ExportFormat; label: string } | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [order, setOrder] = useState(false)
  const px = exportPixels(pageGeometry(spec.format.size, spec.format.orientation), 300)

  const run = async (format: ExportFormat) => {
    setMessage(null)
    setState({ format, label: 'En file d’attente…' })
    try {
      const r = await exportPoster(activity, spec, format, (s) => setState({ format, label: s === 'rendering' ? 'Rendu haute définition…' : 'En file d’attente…' }))
      window.location.href = r.url
      setMessage(r.mapOk ? { text: 'Fichier prêt, téléchargement lancé.' } : { text: 'Fichier prêt, mais le fond de carte n’a pas pu être chargé.', error: true })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true })
    } finally {
      setState(null)
    }
  }

  return (
    <div className="export">
      <button className="btn btn-primary" onClick={() => setOrder(true)}>
        Commander le tirage
      </button>
      <div className="export-row">
        <button className="btn" disabled={!!state} onClick={() => run('png')}>
          {state?.format === 'png' ? state.label : 'PNG HD'}
          <small>{px.w} × {px.h} px · 300 dpi</small>
        </button>
        <button className="btn" disabled={!!state} onClick={() => run('pdf')}>
          {state?.format === 'pdf' ? state.label : 'PDF imprimeur'}
          <small>vectoriel · fonds perdus {spec.print.bleedMm} mm</small>
        </button>
      </div>
      {message && <p className={`status${message.error ? ' is-error' : ''}`}>{message.text}</p>}
      {order && <OrderSheet activity={activity} spec={spec} onClose={() => setOrder(false)} />}
    </div>
  )
}
