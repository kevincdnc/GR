import type { Activity } from '@printrace/core'
import { useEffect, useRef, useState } from 'react'
import { importStrava, StravaAuthRequired } from '../lib/api.ts'
import { ACCEPT, activityFromFile, sampleActivity } from '../lib/importTrack.ts'

const PENDING = 'printrace:strava-pending'

export function Landing({ onActivity }: { onActivity: (a: Activity) => void }) {
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

  // Retour de la connexion Strava : reprise du lien collé
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
      run('Import Strava…', () => importStrava(pending!))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (f) run('Lecture du fichier…', () => activityFromFile(f))
  }

  return (
    <main className="landing">
      <header className="landing-top">
        <Logo />
      </header>
      <section className="hero">
        <h1>
          Votre trace,
          <br />
          <em>en affiche.</em>
        </h1>
        <p>Un trek, un marathon, un GR20, un road-trip à moto : transformez votre parcours en poster d’art, prêt à imprimer en qualité galerie.</p>
      </section>

      <section className="import-card">
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
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" />
            <path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
          </svg>
          <strong>Déposez votre fichier</strong>
          <span>GPX, FIT, TCX, KML, GeoJSON, IGC — lu dans votre navigateur</span>
        </div>

        <div className="or">ou</div>

        <form
          className="strava"
          onSubmit={(e) => {
            e.preventDefault()
            if (link.trim()) run('Import Strava…', () => importStrava(link.trim()))
          }}
        >
          <label htmlFor="strava-link">Lien d’une activité Strava</label>
          <div className="strava-row">
            <input id="strava-link" type="url" inputMode="url" placeholder="https://www.strava.com/activities/…" value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="btn btn-strava" disabled={!link.trim() || !!busy}>
              Importer
            </button>
          </div>
        </form>

        {busy && <p className="status">{busy}</p>}
        {error && <p className="status is-error">{error}</p>}

        <button className="link" onClick={() => run('Chargement de l’exemple…', sampleActivity)} disabled={!!busy}>
          Pas de trace sous la main ? Essayer avec le GR34 →
        </button>
      </section>

      <ol className="steps">
        <li><b>1</b> Importez votre trace</li>
        <li><b>2</b> Choisissez un style, ajustez les textes</li>
        <li><b>3</b> Téléchargez en HD ou commandez le tirage</li>
      </ol>
    </main>
  )
}

export function Logo() {
  return (
    <span className="logo">
      <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#1f2024" />
        <path d="M12 44c6-2 8-14 15-14s6 10 12 9 6-16 13-19" fill="none" stroke="#ffb648" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="44" r="4" fill="#fff" />
      </svg>
      Printrace
    </span>
  )
}
