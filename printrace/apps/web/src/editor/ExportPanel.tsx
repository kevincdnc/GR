import type { Activity } from '@printrace/core'
import type { PosterSpec } from '@printrace/poster'
import { useState } from 'react'
import { type ExportFormat, exportPoster } from '../lib/api.ts'
import { OrderSheet } from './OrderSheet.tsx'

export function ExportPanel({ activity, spec }: { activity: Activity; spec: PosterSpec }) {
  const [state, setState] = useState<{ format: ExportFormat; label: string } | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [order, setOrder] = useState(false)

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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M7 15l3-3 2 2 2.5-3L17 14" />
        </svg>
        Commander le tirage
      </button>
      <div className="export-row">
        <button className="btn" disabled={!!state} onClick={() => run('png')}>
          {state?.format === 'png' ? state.label : 'PNG HD'}
          <small>300 dpi</small>
        </button>
        <button className="btn" disabled={!!state} onClick={() => run('pdf')}>
          {state?.format === 'pdf' ? state.label : 'PDF imprimeur'}
          <small>vectoriel, fonds perdus</small>
        </button>
      </div>
      {message && <p className={`status${message.error ? ' is-error' : ''}`}>{message.text}</p>}
      {order && <OrderSheet activity={activity} spec={spec} onClose={() => setOrder(false)} />}
    </div>
  )
}
