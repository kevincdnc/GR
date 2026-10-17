import type { Activity } from '@printrace/core'
import { getTemplate, MAP_BACKGROUND, PAPER_SIZES, type PaperSizeId, type PosterSpec, STAT_KEYS, STAT_LABELS, type StatKey } from '@printrace/poster'
import type { ReactNode } from 'react'

const MAP_STYLES = [
  { id: 'auto', name: 'Du modèle' },
  { id: 'none', name: 'Sans carte' },
  { id: 'nuit', name: 'Nuit' },
  { id: 'papier', name: 'Papier' },
  { id: 'relief', name: 'Relief' },
  { id: 'encre', name: 'Encre' },
  { id: 'satellite', name: 'Satellite' },
] as const
const TRACK_COLORS = ['#ffb648', '#ff5a36', '#e2261c', '#ffd23f', '#3ddc84', '#3b82f6', '#ffffff', '#111111']
const BORDERS = [
  { id: 'none', name: 'Aucune' },
  { id: 'fine', name: 'Liseré' },
  { id: 'margin', name: 'Marge blanche' },
  { id: 'passepartout', name: 'Passe-partout' },
] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="opt">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly { id: T; name: string; sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>
          {o.name}
          {o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  )
}

export function Options({ activity, spec, onSpec }: { activity: Activity; spec: PosterSpec; onSpec: (s: PosterSpec) => void }) {
  const set = <K extends keyof PosterSpec>(k: K, v: Partial<PosterSpec[K]> | PosterSpec[K]) =>
    onSpec({ ...spec, [k]: typeof v === 'object' && !Array.isArray(v) ? { ...(spec[k] as object), ...v } : v })
  const t = getTemplate(spec.template)
  const trackColor = spec.track.color === 'auto' ? t.defaults.track : spec.track.color
  const toggleStat = (k: StatKey) => {
    const on = spec.stats.includes(k)
    const next = on ? spec.stats.filter((s) => s !== k) : [...spec.stats, k].slice(0, 5)
    set('stats', STAT_KEYS.filter((s) => next.includes(s)))
  }
  const sizes = Object.entries(PAPER_SIZES).map(([id, p]) => ({ id: id as PaperSizeId, name: p.name, sub: p.sub }))

  return (
    <>
      <Section title="Format">
        <Segmented value={spec.format.size} options={sizes} onChange={(size) => set('format', { size })} />
        <Segmented
          value={spec.format.orientation}
          options={[{ id: 'portrait', name: 'Portrait' }, { id: 'landscape', name: 'Paysage' }] as const}
          onChange={(orientation) => set('format', { orientation })}
        />
      </Section>

      <Section title="Textes">
        <label className="field">
          <span>Titre</span>
          <input value={spec.text.title} maxLength={80} onChange={(e) => set('text', { title: e.target.value })} />
        </label>
        <label className="field">
          <span>Sous-titre</span>
          <input value={spec.text.subtitle} maxLength={120} placeholder="Ex. Bretagne · été 2026" onChange={(e) => set('text', { subtitle: e.target.value })} />
        </label>
        <Toggle label="Coordonnées GPS du départ" on={spec.text.coords} onChange={(coords) => set('text', { coords })} />
        <Toggle label="Signature Printrace" on={spec.text.branding} onChange={(branding) => set('text', { branding })} />
      </Section>

      <Section title="Statistiques">
        <div className="chips">
          {STAT_KEYS.filter((k) => k !== 'pace' || activity.sport === 'run' || spec.stats.includes('pace')).map((k) => (
            <button key={k} className={`chip${spec.stats.includes(k) ? ' is-on' : ''}`} onClick={() => toggleStat(k)}>
              {STAT_LABELS[k]}
            </button>
          ))}
        </div>
        {spec.stats.includes('duration') && (
          <label className="field">
            <span>Durée affichée {activity.stats.movingTimeS ? '' : '(estimée)'}</span>
            <input value={spec.overrides.duration ?? ''} maxLength={20} placeholder="Automatique — ex. 3 h 12 min 05" onChange={(e) => set('overrides', { duration: e.target.value || undefined })} />
          </label>
        )}
        <Toggle label="Profil altimétrique" on={spec.profile} onChange={(profile) => set('profile', profile)} />
        <Segmented value={spec.units} options={[{ id: 'metric', name: 'km · m' }, { id: 'imperial', name: 'mi · ft' }] as const} onChange={(units) => set('units', units)} />
      </Section>

      <Section title="Carte">
        <div className="map-styles">
          {MAP_STYLES.map((m) => (
            <button key={m.id} className={`map-style${spec.map.style === m.id ? ' is-on' : ''}`} onClick={() => set('map', { style: m.id })}>
              <i style={{ background: m.id === 'auto' ? `linear-gradient(135deg, ${t.background} 50%, ${MAP_BACKGROUND[t.defaults.map] || t.background} 50%)` : m.id === 'none' ? 'repeating-linear-gradient(45deg,#2a2c31 0 4px,#1d1f23 4px 8px)' : MAP_BACKGROUND[m.id] }} />
              {m.name}
            </button>
          ))}
        </div>
        <Segmented
          value={String(spec.map.detail) as '-1' | '0' | '1'}
          options={[{ id: '-1', name: 'Épuré' }, { id: '0', name: 'Normal' }, { id: '1', name: 'Détaillé' }] as const}
          onChange={(d) => set('map', { detail: Number(d) })}
        />
      </Section>

      <Section title="Tracé">
        <div className="colors">
          <button className={`color is-auto${spec.track.color === 'auto' ? ' is-on' : ''}`} style={{ background: t.defaults.track }} title="Couleur du modèle" onClick={() => set('track', { color: 'auto' })}>
            A
          </button>
          {TRACK_COLORS.map((c) => (
            <button key={c} className={`color${spec.track.color === c ? ' is-on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => set('track', { color: c })} />
          ))}
          <label className="color color-custom" title="Couleur personnalisée">
            <input type="color" value={trackColor} onChange={(e) => set('track', { color: e.target.value })} />
          </label>
        </div>
        <Segmented
          value={spec.track.width}
          options={[{ id: 'fine', name: 'Fin' }, { id: 'normal', name: 'Normal' }, { id: 'bold', name: 'Épais' }] as const}
          onChange={(width) => set('track', { width })}
        />
        <Toggle label="Départ et arrivée" on={spec.track.markers} onChange={(markers) => set('track', { markers })} />
      </Section>

      <Section title="Bordure imprimée">
        <Segmented value={spec.border} options={BORDERS} onChange={(border) => set('border', border)} />
      </Section>
    </>
  )
}
