// Import d'une activité Strava *publique* sans connexion : on télécharge la page
// de l'activité, comme le ferait un visiteur non connecté, et on en extrait la
// trace dessinée sur la carte.
//
// L'export GPX de Strava (…/export_gpx) exige d'être connecté en tant que
// l'athlète : il n'est pas accessible ici. La trace de la page publique est
// celle de la carte : complète mais simplifiée, et sans les zones de
// confidentialité choisies par l'athlète. Les altitudes manquantes sont
// complétées par un modèle de terrain (elevation.ts).
//
// Strava change régulièrement le format de ses pages : l'extraction ne dépend
// pas d'un chemin précis mais cherche, dans toutes les données JSON de la page,
// les tableaux de coordonnées et les polylignes encodées, puis les chiffres de
// l'activité (distance, dénivelé, temps) par nom de champ.
import { decodePolyline, type RawTrack, type Sport } from '@printrace/core'

export interface PublicActivity {
  track: RawTrack
  /** chiffres affichés par Strava, s'ils figurent dans la page */
  stats: { distanceM?: number; elevationGainM?: number; movingTimeS?: number; elapsedTimeS?: number; startTime?: number }
}

export class StravaPrivateError extends Error {}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export async function fetchPublicActivity(id: string): Promise<PublicActivity> {
  const res = await fetch(`https://www.strava.com/activities/${id}`, {
    headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8', accept: 'text/html' },
    redirect: 'follow',
  }).catch(() => {
    throw Object.assign(new Error('Strava ne répond pas. Réessayez dans un instant, ou déposez le fichier GPX.'), { statusCode: 502 })
  })
  // une activité privée renvoie vers la page de connexion
  if (res.status === 404 || /\/login|\/session/.test(res.url)) throw new StravaPrivateError('Activité privée ou introuvable.')
  if (!res.ok) throw new Error(`Strava : erreur ${res.status}`)
  return parseActivityPage(await res.text())
}

const decodeEntities = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** Tous les blocs JSON d'une page : scripts JSON (Next.js…), attributs data-react-props, affectations JS. */
export function jsonBlobs(html: string): unknown[] {
  const out: unknown[] = []
  const tryParse = (s: string) => {
    try {
      out.push(JSON.parse(s))
    } catch {
      /* bloc non JSON */
    }
  }
  for (const m of html.matchAll(/<script\b[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) tryParse(m[1])
  for (const m of html.matchAll(/data-react-props="([^"]*)"/g)) tryParse(decodeEntities(m[1]))
  for (const m of html.matchAll(/data-react-props='([^']*)'/g)) tryParse(decodeEntities(m[1]))
  // anciennes pages : pageView.activity().set({...}) ou var x = {...};
  for (const m of html.matchAll(/(?:\.set\(|=\s*)(\{"[\s\S]{20,}?\})\s*\)?;\s*\n/g)) tryParse(m[1])
  return out
}

type Pt = [number, number]
const isLatLng = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0)

/** Parcourt un JSON et rassemble les candidats « trace » et les champs utiles. */
function walk(root: unknown) {
  const tracks: { pts: Pt[]; key: string }[] = []
  const elevations: number[][] = []
  const fields = new Map<string, unknown>()
  const visit = (v: unknown, key: string, depth: number) => {
    if (depth > 40 || v == null) return
    if (typeof v === 'string') {
      if (/polyline/i.test(key) && v.length > 10) {
        const pts = decodePolyline(v).filter(([a, b]) => isLatLng(a, b))
        if (pts.length > 1) tracks.push({ pts, key })
      }
      if (!fields.has(key)) fields.set(key, v)
      return
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      if (!fields.has(key)) fields.set(key, v)
      return
    }
    if (Array.isArray(v)) {
      if (v.length > 1) {
        // [[lat, lng], …]
        if (v.every((p) => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number')) {
          const pts = (v as number[][]).filter((p) => isLatLng(p[0], p[1])).map((p) => [p[0], p[1]] as Pt)
          if (pts.length > 1 && /latlng|location|coord|points|stream|path/i.test(key)) return void tracks.push({ pts, key })
        }
        // [{lat, lng}, …]
        if (v.every((p) => p && typeof p === 'object' && 'lat' in p && ('lng' in p || 'lon' in p))) {
          const pts = (v as { lat: number; lng?: number; lon?: number }[]).map((p) => [p.lat, (p.lng ?? p.lon)!] as Pt).filter(([a, b]) => isLatLng(a, b))
          if (pts.length > 1) return void tracks.push({ pts, key })
        }
        // altitudes
        if (/altitude|elevation/i.test(key) && v.every((x) => typeof x === 'number')) return void elevations.push(v as number[])
      }
      v.forEach((x) => visit(x, key, depth + 1))
      return
    }
    if (typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, k, depth + 1)
  }
  visit(root, '', 0)
  return { tracks, elevations, fields }
}

const SPORTS: Record<string, Sport> = {
  hike: 'hike', walk: 'hike', run: 'run', trailrun: 'run', virtualrun: 'run', ride: 'ride', gravelride: 'ride', mountainbikeride: 'ride',
  ebikeride: 'ride', emountainbikeride: 'ride', virtualride: 'ride', alpineski: 'ski', backcountryski: 'ski', nordicski: 'ski', swim: 'swim',
}

/** Valeur numérique d'un champ, quel que soit son nom exact (camelCase, snake_case, chaîne « 12,4 km »…). */
function num(fields: Map<string, unknown>, names: RegExp): number | undefined {
  for (const [k, v] of fields) {
    if (!names.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''))
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return undefined
}

export function parseActivityPage(html: string): PublicActivity {
  const all = jsonBlobs(html).map(walk)
  const tracks = all.flatMap((w) => w.tracks)
  // anciennes pages : polyline dans l'URL d'une carte statique
  for (const m of html.matchAll(/(?:enc:|path-\d[^(]*\(|polyline=)([A-Za-z0-9_\-`@?^~|{}[\]\\%]{20,})/g)) {
    const pts = decodePolyline(decodeURIComponent(m[1])).filter(([a, b]) => isLatLng(a, b))
    if (pts.length > 1) tracks.push({ pts, key: 'static-map' })
  }
  if (!tracks.length) throw new StravaPrivateError('Aucune trace dans la page : l’activité est sans doute privée.')
  // la trace la plus détaillée (la carte de la page, pas une vignette)
  const best = tracks.sort((a, b) => b.pts.length - a.pts.length)[0]

  const fields = new Map<string, unknown>()
  for (const w of all) for (const [k, v] of w.fields) if (!fields.has(k)) fields.set(k, v)
  const elev = all.flatMap((w) => w.elevations).find((e) => e.length === best.pts.length)

  const title = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/)?.[1] ?? html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
  const name = (typeof fields.get('name') === 'string' ? (fields.get('name') as string) : decodeEntities(title).replace(/\s*[|–-]\s*Strava.*$/i, '')).trim() || null
  const type = String(fields.get('sportType') ?? fields.get('sport_type') ?? fields.get('activityType') ?? fields.get('type') ?? '').toLowerCase().replace(/[^a-z]/g, '')
  const start = String(fields.get('startDateLocal') ?? fields.get('start_date_local') ?? fields.get('startDate') ?? fields.get('start_date') ?? '')
  const startTime = Date.parse(start)

  let distanceM = num(fields, /^(distance|distanceInMeters|distance_in_meters)$/i)
  if (distanceM != null && distanceM < 1000 && /km/i.test(String(fields.get('distance')))) distanceM *= 1000
  return {
    track: { name, sport: SPORTS[type], points: best.pts.map(([lat, lon], i) => ({ lat, lon, ele: elev?.[i] ?? null, time: null })) },
    stats: {
      distanceM,
      elevationGainM: num(fields, /^(elev(ation)?_?gain|elevationGain|total_?elevation_?gain|totalElevationGain)$/i),
      movingTimeS: num(fields, /^(moving_?time|movingTime)$/i),
      elapsedTimeS: num(fields, /^(elapsed_?time|elapsedTime)$/i),
      startTime: Number.isFinite(startTime) ? startTime : undefined,
    },
  }
}
