import type { Activity } from '@printrace/core'
import { Poster, type PosterSpec, TEMPLATES } from '@printrace/poster'
import { memo } from 'react'

/** Vignettes vivantes : chaque modèle avec la vraie trace et les vrais textes (sans carte). */
export const TemplatePicker = memo(function TemplatePicker({ activity, spec, onSpec }: { activity: Activity; spec: PosterSpec; onSpec: (s: PosterSpec) => void }) {
  return (
    <div className="templates">
      {TEMPLATES.map((t) => {
        const preview: PosterSpec = { ...spec, template: t.id, map: { ...spec.map, style: 'auto' }, track: { ...spec.track, color: 'auto' }, border: 'none', stats: t.defaults.stats ?? spec.stats }
        return (
          <button
            key={t.id}
            className={`template${spec.template === t.id ? ' is-on' : ''}`}
            aria-pressed={spec.template === t.id}
            onClick={() => onSpec({ ...spec, template: t.id, map: { ...spec.map, style: 'auto' }, track: { ...spec.track, color: 'auto' }, stats: t.defaults.stats ?? spec.stats })}
          >
            <span className="template-thumb">
              <Poster activity={activity} spec={preview} mode="thumb" displayWidth={116} />
            </span>
            <span className="template-name">
              {t.name} <small>{t.kind}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
})
