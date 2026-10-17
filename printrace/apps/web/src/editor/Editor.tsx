import type { Activity } from '@printrace/core'
import type { PosterSpec } from '@printrace/poster'
import { useState } from 'react'
import { LogoMark } from '../brand.tsx'
import { ExportPanel } from './ExportPanel.tsx'
import { Options } from './Options.tsx'
import { type FrameId, Preview } from './Preview.tsx'
import { TemplatePicker } from './TemplatePicker.tsx'

export interface EditorProps {
  activity: Activity
  spec: PosterSpec
  onSpec: (s: PosterSpec) => void
  onReset: () => void
}

const nf = (n: number, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n)
const SPORT: Record<Activity['sport'], string> = { hike: 'Randonnée', run: 'Course', ride: 'Vélo', moto: 'Moto', ski: 'Ski', swim: 'Natation', other: 'Activité' }

export function Editor({ activity, spec, onSpec, onReset }: EditorProps) {
  const [frame, setFrame] = useState<FrameId>('noir')
  const [tab, setTab] = useState<'style' | 'options'>('style')
  return (
    <div className="editor">
      <header className="editor-top">
        <a href="/" className="editor-logo" aria-label="Printrace, accueil" onClick={(e) => (e.preventDefault(), onReset())}>
          <LogoMark height={20} />
        </a>
        <span className="top-sep" />
        <div className="activity-chip">
          <strong>{activity.name}</strong>
          <span>
            {SPORT[activity.sport]} · {nf(activity.stats.distanceM / 1000, 1)} km · {nf(activity.stats.elevationGainM)} m D+
          </span>
        </div>
        <button className="btn btn-quiet" onClick={onReset}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
          </svg>
          Changer de trace
        </button>
      </header>

      <nav className="mobile-tabs">
        <button className={tab === 'style' ? 'is-on' : ''} onClick={() => setTab('style')}>Modèles</button>
        <button className={tab === 'options' ? 'is-on' : ''} onClick={() => setTab('options')}>Réglages</button>
      </nav>

      <aside className={`panel panel-left${tab === 'style' ? ' is-tab' : ''}`}>
        <h2 className="label">Modèles</h2>
        <TemplatePicker activity={activity} spec={spec} onSpec={onSpec} />
      </aside>

      <section className="stage">
        <Preview activity={activity} spec={spec} frame={frame} />
      </section>

      <aside className={`panel panel-right${tab === 'options' ? ' is-tab' : ''}`}>
        <div className="panel-scroll">
          <Options activity={activity} spec={spec} onSpec={onSpec} frame={frame} onFrame={setFrame} />
        </div>
      </aside>
      <ExportPanel activity={activity} spec={spec} />
    </div>
  )
}
