import type { Activity } from '@printrace/core'
import type { PosterSpec } from '@printrace/poster'

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.message || body.error || `Erreur ${res.status}`), { status: res.status, body })
  return body as T
}

/** Allège l'activité envoyée au serveur (précision bien inférieure au trait imprimé). */
function compact(a: Activity): Activity {
  return { ...a, coords: a.coords.map((c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5, Math.round(c[2]), Math.round(c[3])]) }
}

export type ExportFormat = 'pdf' | 'png'
export interface ExportJob {
  id: string
  status: 'queued' | 'rendering' | 'done' | 'failed'
  error?: string
  mapOk?: boolean
}

/** Lance un export haute définition et attend le fichier. */
export async function exportPoster(activity: Activity, spec: PosterSpec, format: ExportFormat, onStatus: (s: ExportJob['status']) => void): Promise<{ url: string; mapOk: boolean }> {
  let job = await json<ExportJob>(await fetch('/api/exports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activity: compact(activity), spec, format }) }))
  while (job.status === 'queued' || job.status === 'rendering') {
    onStatus(job.status)
    await new Promise((r) => setTimeout(r, 1200))
    job = await json<ExportJob>(await fetch(`/api/exports/${job.id}`))
  }
  if (job.status === 'failed') throw new Error(job.error || 'Export impossible')
  return { url: `/api/exports/${job.id}/file`, mapOk: job.mapOk !== false }
}

export class StravaAuthRequired extends Error {
  constructor(public connectUrl: string) {
    super('Connexion Strava requise')
  }
}

/** Importe une activité Strava depuis son lien (strava.com/activities/… ou strava.app.link/…). */
export async function importStrava(url: string): Promise<Activity> {
  const res = await fetch('/api/strava/activity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  if (res.status === 401) {
    const body = await res.json()
    throw new StravaAuthRequired(body.connectUrl)
  }
  return json<Activity>(res)
}

export async function startCheckout(activity: Activity, spec: PosterSpec, productId: string): Promise<{ checkoutUrl: string }> {
  return json(await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activity: compact(activity), spec, productId }) }))
}
