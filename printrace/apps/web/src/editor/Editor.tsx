import type { Activity } from '@printrace/core'
import type { PosterSpec } from '@printrace/poster'
import { useState } from 'react'
import { Logo } from '../landing/Landing.tsx'
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

const km = (m: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(m / 1000)

export function Editor({ activity, spec, onSpec, onReset }: EditorProps) {
  const [frame, setFrame] = useState<FrameId>('noir')
  const [tab, setTab] = useState<'style' | 'options'>('style')
  return (
    <div className="editor">
      <header className="editor-top">
        <Logo />
        <div className="activity-chip">
          <strong>{activity.name}</strong>
          <span>
            {km(activity.stats.distanceM)} km · {new Intl.NumberFormat('fr-FR').format(activity.stats.elevationGainM)} m D+
          </span>
        </div>
        <button className="btn btn-ghost" onClick={onReset}>
          Changer de trace
        </button>
      </header>

      <nav className="mobile-tabs">
        <button className={tab === 'style' ? 'is-on' : ''} onClick={() => setTab('style')}>Modèles</button>
        <button className={tab === 'options' ? 'is-on' : ''} onClick={() => setTab('options')}>Réglages</button>
      </nav>

      <aside className={`panel panel-left${tab === 'style' ? ' is-tab' : ''}`}>
        <h2 className="panel-title">Modèles</h2>
        <TemplatePicker activity={activity} spec={spec} onSpec={onSpec} />
      </aside>

      <section className="stage">
        <Preview activity={activity} spec={spec} frame={frame} onFrame={setFrame} />
      </section>

      <aside className={`panel panel-right${tab === 'options' ? ' is-tab' : ''}`}>
        <div className="panel-scroll">
          <Options activity={activity} spec={spec} onSpec={onSpec} />
        </div>
      </aside>
      <ExportPanel activity={activity} spec={spec} />
    </div>
  )
}
