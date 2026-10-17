import type { Activity } from '@printrace/core'
import { createSpec, Poster, type PosterSpec, TEMPLATES } from '@printrace/poster'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LogoMark } from '../brand.tsx'
import { importStrava, StravaAuthRequired } from '../lib/api.ts'
import { ACCEPT, activityFromFile, SAMPLE_ACTIVITY, sampleActivity } from '../lib/importTrack.ts'

const PENDING = 'printrace:strava-pending'

export function Landing({ onActivity }: { onActivity: (a: Activity) => void }) {
  return (
    <div className="home">
      <header className="home-nav">
        <a href="/" className="home-logo" aria-label="Printrace, accueil">
          <LogoMark height={26} />
        </a>
        <nav>
          <a href="#modeles">Modèles</a>
          <a href="#etapes">Comment ça marche</a>
          <a href="#qualite">Qualité d’impression</a>
        </nav>
        <button className="btn btn-quiet" onClick={() => sampleActivity().then(onActivity)}>
          Voir un exemple
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Strava · GPX · FIT · TCX · KML</span>
          <h1>
            Votre aventure,
            <br />
            <span>en affiche.</span>
          </h1>
          <p className="lede">Un trek, un marathon, le GR20 ou un road-trip à moto : collez le lien de l’activité et repartez avec un poster prêt à encadrer, imprimé en qualité galerie.</p>
          <ImportCard onActivity={onActivity} />
        </div>
        <Showcase />
      </section>

      <section className="facts" aria-label="En bref">
        <div><strong>6</strong><span>modèles dessinés pour l’impression</span></div>
        <div><strong>A4 → 50 × 70</strong><span>portrait, paysage ou carré</span></div>
        <div><strong>300 dpi</strong><span>tracé et textes vectoriels</span></div>
        <div><strong>Encadré</strong><span>livré prêt à accrocher</span></div>
      </section>

      <section id="modeles" className="home-section">
        <div className="section-head">
          <span className="eyebrow">Modèles</span>
          <h2>Un style pour chaque souvenir</h2>
          <p>Chaque modèle s’adapte à votre trace, à vos chiffres et au format choisi. Titre, statistiques, carte et couleurs se règlent ensuite en un clic.</p>
        </div>
        <TemplateStrip />
      </section>

      <section id="etapes" className="home-section">
        <div className="section-head">
          <span className="eyebrow">Comment ça marche</span>
          <h2>Trois étapes, deux minutes</h2>
        </div>
        <ol className="how">
          <li>
            <span className="how-n">1</span>
            <h3>Importez votre trace</h3>
            <p>Collez le lien d’une activité Strava, ou déposez le fichier exporté de votre montre ou de votre application.</p>
          </li>
          <li>
            <span className="how-n">2</span>
            <h3>Personnalisez</h3>
            <p>Choisissez un modèle, un format, le titre et les chiffres à mettre en avant. L’aperçu montre le poster au mur, encadré.</p>
          </li>
          <li>
            <span className="how-n">3</span>
            <h3>Recevez-le</h3>
            <p>Commandez le tirage, encadré ou non, ou téléchargez les fichiers haute définition pour l’imprimer où vous voulez.</p>
          </li>
        </ol>
      </section>

      <section id="qualite" className="home-section quality">
        <div className="section-head">
          <span className="eyebrow">Qualité d’impression</span>
          <h2>Pensé pour le papier, pas pour l’écran</h2>
          <p>Le fichier envoyé à l’atelier sort du même moteur que l’aperçu : ce que vous voyez est exactement ce qui sera imprimé.</p>
        </div>
        <ul className="specs">
          <li><b>Vectoriel</b>Tracé, titres et chiffres restent nets à toutes les tailles.</li>
          <li><b>Carte à 300 dpi</b>Fonds de carte dessinés pour l’affiche, libellés lisibles sur papier.</li>
          <li><b>Prêt pour l’atelier</b>PDF avec fonds perdus de 3 mm et traits de coupe.</li>
          <li><b>Papier fine art</b>Mat 200 g/m², encres pigmentaires, cadre bois en option.</li>
        </ul>
      </section>

      <footer className="home-foot">
        <LogoMark height={18} />
        <span>Né sur le GR34, entre Plouhinec et la Pointe du Raz.</span>
      </footer>
    </div>
  )
}

function ImportCard({ onActivity }: { onActivity: (a: Activity) => void }) {
  const [tab, setTab] = useState<'strava' | 'file'>('strava')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [link, setLink] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const run = async (label: string, fn: () => Promise<Activity>) => {
    setBusy(label)
    setError(null)
    try {
      onActivity(await fn())
    } catch (e) {
      if (e instanceof StravaAuthRequired) {
        try {
          sessionStorage.setItem(PENDING, link)
        } catch {}
        window.location.href = e.connectUrl
        return
      }
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  // Retour de la connexion Strava (activité privée) : reprise du lien collé
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('strava')) return
    history.replaceState(null, '', window.location.pathname)
    let pending: string | null = null
    try {
      pending = sessionStorage.getItem(PENDING)
      sessionStorage.removeItem(PENDING)
    } catch {}
    if (params.get('strava') !== 'connected') setError('Connexion Strava annulée.')
    else if (pending) {
      setLink(pending)
      run('Récupération de la trace…', () => importStrava(pending!))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (f) run('Lecture du fichier…', () => activityFromFile(f))
  }

  return (
    <div className="import">
      <div className="seg seg-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'strava'} className={tab === 'strava' ? 'is-on' : ''} onClick={() => setTab('strava')}>
          <StravaIcon /> Lien Strava
        </button>
        <button role="tab" aria-selected={tab === 'file'} className={tab === 'file' ? 'is-on' : ''} onClick={() => setTab('file')}>
          <FileIcon /> Fichier
        </button>
      </div>

      {tab === 'strava' ? (
        <form
          className="import-strava"
          onSubmit={(e) => {
            e.preventDefault()
            if (link.trim()) run('Récupération de la trace sur Strava…', () => importStrava(link.trim()))
          }}
        >
          <label htmlFor="strava-link" className="sr-only">Lien de l’activité Strava</label>
          <input id="strava-link" type="url" inputMode="url" autoComplete="off" placeholder="https://www.strava.com/activities/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="btn btn-primary" disabled={!link.trim() || !!busy}>
            Créer mon poster
          </button>
          <p className="hint">Dans Strava : <b>Partager → Copier le lien</b>. L’activité doit être visible par « Tout le monde ».</p>
        </form>
      ) : (
        <div
          className={`dropzone${drag ? ' is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            onFiles(e.dataTransfer.files)
          }}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        >
          <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => onFiles(e.target.files)} />
          <FileIcon size={26} />
          <strong>Déposez votre fichier ici</strong>
          <span>ou cliquez pour le choisir · GPX, FIT, TCX, KML, GeoJSON, IGC</span>
        </div>
      )}

      {busy && <p className="status"><span className="spinner" /> {busy}</p>}
      {error && <p className="status is-error">{error}</p>}
      <button className="link" onClick={() => run('Chargement…', sampleActivity)} disabled={!!busy}>
        Pas de trace sous la main ? Essayer avec une étape du GR34 →
      </button>
    </div>
  )
}

/** Trois posters « au mur », dessinés avec la vraie trace d'exemple */
function Showcase() {
  const posters = useMemo(() => {
    const base = createSpec(SAMPLE_ACTIVITY)
    const mk = (template: string, patch: Partial<PosterSpec> = {}): PosterSpec => ({
      ...base,
      template,
      ...patch,
      text: { ...base.text, subtitle: 'Bretagne · été 2026', ...patch.text },
    })
    return [
      { spec: mk('epure'), frame: 'chene', w: 168, cls: 'sc-left' },
      { spec: mk('nuit'), frame: 'noir', w: 236, cls: 'sc-center' },
      { spec: mk('suisse', { stats: ['distance', 'elevation', 'duration'] }), frame: 'blanc', w: 168, cls: 'sc-right' },
    ]
  }, [])
  return (
    <div className="showcase" aria-hidden>
      {posters.map((p) => (
        <div key={p.spec.template} className={`sc ${p.cls} frame frame-${p.frame}`} style={{ padding: p.w * 0.05 }}>
          <Poster activity={SAMPLE_ACTIVITY} spec={p.spec} mode="thumb" displayWidth={p.w} />
        </div>
      ))}
    </div>
  )
}

function TemplateStrip() {
  const base = useMemo(() => createSpec(SAMPLE_ACTIVITY), [])
  return (
    <div className="strip">
      {TEMPLATES.map((t) => (
        <figure key={t.id}>
          <div className="strip-poster">
            <Poster activity={SAMPLE_ACTIVITY} spec={{ ...base, template: t.id, stats: t.defaults.stats ?? base.stats }} mode="thumb" displayWidth={150} />
          </div>
          <figcaption>
            {t.name} <small>{t.kind}</small>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

function StravaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M15.39 17.94 13.3 13.8h-3.07l5.16 10.2 5.15-10.2h-3.07M10.04 0 3 13.8h4.15l2.89-5.48 2.86 5.48h4.12z" />
    </svg>
  )
}

function FileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 15l3-3 3 3M12 12v6" />
    </svg>
  )
}
