// Import d'une activité Strava par son lien. L'API Strava exige l'accord de
// l'athlète (OAuth, scope activity:read_all) : on ne peut lire que ses propres
// activités, y compris privées. Liens acceptés :
//   https://www.strava.com/activities/123456789
//   https://strava.app.link/AbCdEf (lien de partage de l'app mobile)
import { type Activity, buildActivity, type RawTrack, type Sport } from '@printrace/core'

export interface StravaTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  athleteId: number
}

const API = 'https://www.strava.com/api/v3'

export function authorizeUrl(clientId: string, redirectUri: string, state: string) {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', approval_prompt: 'auto', scope: 'activity:read_all', state })
  return `https://www.strava.com/oauth/authorize?${q}`
}

async function tokenRequest(params: Record<string, string>): Promise<StravaTokens> {
  const res = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body: new URLSearchParams(params) })
  const d = await res.json()
  if (!res.ok) throw new Error(`Strava OAuth : ${d.message ?? res.status}`)
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: d.expires_at * 1000, athleteId: d.athlete?.id ?? 0 }
}

export const exchangeCode = (clientId: string, clientSecret: string, code: string) =>
  tokenRequest({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' })

export async function freshTokens(t: StravaTokens, clientId: string, clientSecret: string): Promise<StravaTokens> {
  if (t.expiresAt - Date.now() > 60_000) return t
  const n = await tokenRequest({ client_id: clientId, client_secret: clientSecret, refresh_token: t.refreshToken, grant_type: 'refresh_token' })
  return { ...n, athleteId: t.athleteId }
}

/** Identifiant d'activité, en suivant les liens courts de l'app. */
export async function resolveActivityId(link: string): Promise<string> {
  let url = link.trim()
  for (let hop = 0; hop < 5; hop++) {
    const m = url.match(/strava\.com\/activities\/(\d+)/)
    if (m) return m[1]
    if (!/^https:\/\/([a-z0-9-]+\.)*(strava\.app\.link|strava\.com)\//i.test(url)) break
    const res = await fetch(url, { redirect: 'manual' }).catch(() => {
      throw Object.assign(new Error('Strava ne répond pas. Réessayez dans un instant, ou déposez le fichier GPX.'), { statusCode: 502 })
    })
    const next = res.headers.get('location')
    if (!next) {
      // certains liens courts renvoient une page HTML contenant l'URL finale
      const html = await res.text()
      const found = html.match(/strava\.com\/activities\/(\d+)/)
      if (found) return found[1]
      break
    }
    url = new URL(next, url).toString()
  }
  throw Object.assign(new Error('Lien Strava non reconnu. Copiez le lien d’une activité (strava.com/activities/…).'), { statusCode: 400 })
}

const SPORTS: Record<string, Sport> = {
  Hike: 'hike', Walk: 'hike', Run: 'run', TrailRun: 'run', VirtualRun: 'run', Ride: 'ride', GravelRide: 'ride',
  MountainBikeRide: 'ride', EBikeRide: 'ride', EMountainBikeRide: 'ride', VirtualRide: 'ride', AlpineSki: 'ski',
  BackcountrySki: 'ski', NordicSki: 'ski', Swim: 'swim',
}

export async function fetchActivity(id: string, token: string): Promise<Activity> {
  const get = async (path: string) => {
    const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } })
    if (res.status === 404) throw Object.assign(new Error('Activité introuvable, ou elle appartient à un autre athlète.'), { statusCode: 404 })
    if (!res.ok) throw new Error(`Strava : erreur ${res.status}`)
    return res.json()
  }
  const [meta, streams] = await Promise.all([get(`/activities/${id}`), get(`/activities/${id}/streams?keys=latlng,altitude,time&key_by_type=true`)])
  const latlng: [number, number][] = streams.latlng?.data ?? []
  if (latlng.length < 2) throw new Error('Cette activité n’a pas de trace GPS.')
  const start = Date.parse(meta.start_date)
  const track: RawTrack = {
    name: meta.name,
    sport: SPORTS[meta.sport_type] ?? SPORTS[meta.type] ?? 'other',
    points: latlng.map(([lat, lon], i) => ({ lat, lon, ele: streams.altitude?.data[i] ?? null, time: streams.time ? start + streams.time.data[i] * 1000 : null })),
  }
  const a = buildActivity(track, { id: `strava_${id}`, source: 'strava' })
  // chiffres officiels de Strava (ceux que l'athlète connaît)
  a.stats.distanceM = Math.round(meta.distance)
  a.stats.elevationGainM = Math.round(meta.total_elevation_gain)
  a.stats.movingTimeS = meta.moving_time
  a.stats.elapsedTimeS = meta.elapsed_time
  return a
}
