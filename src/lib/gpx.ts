// Parsing GPX + calcul des métriques d'une étape.
// Volontairement sans DOM : ce module tourne aussi côté Node (plugin Vite).

export interface RawPoint {
  lat: number
  lon: number
  ele: number | null
  time: number | null // epoch ms
}

/** Point simplifié pour la carte : [lat, lon] */
export type LatLng = [number, number]

/** Point du profil altimétrique : [distance cumulée km, altitude m, lat, lon] */
export type ProfilePoint = [number, number, number, number]

export interface StageData {
  id: string
  file: string
  num: number
  name: string
  from: string
  to: string
  distanceKm: number
  elevationGain: number
  elevationLoss: number
  altMax: number
  altMin: number
  /** km effort = km + D+/100 (convention FFRandonnée) */
  kmEffort: number
  /** Temps en mouvement déduit des horodatages GPX, en minutes (null si absent) */
  gpxMovingMin: number | null
  /** Date de départ issue du GPX (ISO) si présente */
  gpxDate: string | null
  track: LatLng[]
  profile: ProfilePoint[]
  bounds: [LatLng, LatLng]
}

const R = 6371008.8

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

export function parseGpx(xml: string): { name: string | null; points: RawPoint[] } {
  const trk = xml.match(/<trk\b[\s\S]*?<name>([\s\S]*?)<\/name>/)
  const meta = xml.match(/<metadata\b[\s\S]*?<name>([\s\S]*?)<\/name>/)
  const name = trk?.[1] ?? meta?.[1] ?? null

  const points: RawPoint[] = []
  // trkpt (traces) ou, à défaut, rtept (itinéraires)
  const tag = /<trkpt\b/.test(xml) ? 'trkpt' : 'rtept'
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1]
    const body = m[2] ?? ''
    const lat = Number(attrs.match(/lat\s*=\s*["']([^"']+)/)?.[1])
    const lon = Number(attrs.match(/lon\s*=\s*["']([^"']+)/)?.[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const eleStr = body.match(/<ele>([^<]+)<\/ele>/)?.[1]
    const timeStr = body.match(/<time>([^<]+)<\/time>/)?.[1]
    const ele = eleStr != null && Number.isFinite(Number(eleStr)) ? Number(eleStr) : null
    const t = timeStr ? Date.parse(timeStr) : NaN
    points.push({ lat, lon, ele, time: Number.isFinite(t) ? t : null })
  }
  return { name: name ? decodeEntities(name).trim() : null, points }
}

/** Douglas-Peucker en mètres (projection équirectangulaire locale). */
export function simplify(points: RawPoint[], toleranceM: number): RawPoint[] {
  if (points.length < 3) return points.slice()
  const lat0 = (points[0].lat * Math.PI) / 180
  const kx = (Math.PI / 180) * R * Math.cos(lat0)
  const ky = (Math.PI / 180) * R
  const xs = points.map((p) => p.lon * kx)
  const ys = points.map((p) => p.lat * ky)
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const tol2 = toleranceM * toleranceM
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const dx = xs[b] - xs[a]
    const dy = ys[b] - ys[a]
    const len2 = dx * dx + dy * dy
    let maxD = -1
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      let t = len2 ? ((xs[i] - xs[a]) * dx + (ys[i] - ys[a]) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const px = xs[a] + t * dx - xs[i]
      const py = ys[a] + t * dy - ys[i]
      const d = px * px + py * py
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

/**
 * D+ / D- avec hystérésis : on n'accumule une variation que lorsqu'elle
 * dépasse `threshold` mètres depuis le dernier point d'ancrage. Ça élimine
 * le bruit GPS/MNT sans écraser les vraies montées.
 */
export function elevationGainLoss(eles: number[], threshold = 1): { gain: number; loss: number } {
  let gain = 0
  let loss = 0
  if (!eles.length) return { gain, loss }
  let anchor = eles[0]
  for (const e of eles) {
    const d = e - anchor
    if (d >= threshold) {
      gain += d
      anchor = e
    } else if (d <= -threshold) {
      loss -= d
      anchor = e
    }
  }
  return { gain, loss }
}

/** Temps en mouvement (min) : ignore les pauses (vitesse < 0.8 km/h ou trou > 5 min). */
function movingMinutes(points: RawPoint[]): number | null {
  const timed = points.filter((p) => p.time != null)
  if (timed.length < 2 || timed.length < points.length * 0.9) return null
  let ms = 0
  for (let i = 1; i < timed.length; i++) {
    const dt = timed[i].time! - timed[i - 1].time!
    if (dt <= 0 || dt > 5 * 60_000) continue
    const v = haversine(timed[i - 1], timed[i]) / (dt / 1000) // m/s
    if (v * 3.6 >= 0.8) ms += dt
  }
  return ms > 0 ? ms / 60_000 : null
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extrait numéro + départ/arrivée depuis le nom GPX ou le nom de fichier. */
export function parseStageName(gpxName: string | null, file: string): { num: number; from: string; to: string; name: string } {
  const base = file.replace(/\.gpx$/i, '')
  const title = cleanTitle(gpxName ?? base.replace(/_/g, ' '))
  const num =
    Number(title.match(/#\s*(\d+)/)?.[1]) ||
    Number(base.match(/GR\s*34[_\s-]+(\d+)/i)?.[1]) ||
    Number(base.match(/(\d+)/)?.[1]) ||
    0
  // "GR34 - #1 • Nevez - Concarneau" -> "Nevez - Concarneau"
  let route = title.includes('•') ? title.split('•').pop()!.trim() : title.replace(/^GR\s*34\s*[-–]?\s*(#?\d+)?\s*[-–:]?\s*/i, '')
  route = route.trim()
  const parts = route.split(/\s+[-–>→]\s+/)
  const from = parts[0]?.trim() || route
  const to = parts.length > 1 ? parts.slice(1).join(' - ').trim() : ''
  return { num, from, to, name: to ? `${from} → ${to}` : from }
}

export function buildStage(xml: string, file: string): StageData {
  const { name, points } = parseGpx(xml)
  if (points.length < 2) throw new Error(`${file}: aucun point de trace`)

  // Distance cumulée sur la trace complète
  const cum = new Float64Array(points.length)
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + haversine(points[i - 1], points[i])
  const distanceKm = cum[points.length - 1] / 1000

  // Altitudes : comblement des trous, rééchantillonnage tous les 10 m puis
  // moyenne glissante sur ±20 m. Les altitudes GPS / MNT sont très bruitées :
  // sans lissage le D+ d'une trace côtière est facilement multiplié par 5.
  const hasEle = points.some((p) => p.ele != null)
  const eles: number[] = []
  if (hasEle) {
    let last = points.find((p) => p.ele != null)!.ele!
    for (const p of points) {
      if (p.ele != null) last = p.ele
      eles.push(last)
    }
  } else {
    for (let i = 0; i < points.length; i++) eles.push(0)
  }
  const STEP = 10
  const resampled: { d: number; ele: number; lat: number; lon: number }[] = []
  for (let d = 0, j = 0; ; d += STEP) {
    const end = d >= cum[points.length - 1]
    if (end) d = cum[points.length - 1]
    while (j < points.length - 2 && cum[j + 1] < d) j++
    const span = cum[j + 1] - cum[j]
    const t = span > 0 ? Math.max(0, Math.min(1, (d - cum[j]) / span)) : 0
    const a = points[j]
    const b = points[j + 1]
    resampled.push({
      d,
      ele: eles[j] + (eles[j + 1] - eles[j]) * t,
      lat: a.lat + (b.lat - a.lat) * t,
      lon: a.lon + (b.lon - a.lon) * t,
    })
    if (end) break
  }
  const W = 2 // ±2 échantillons = ±20 m
  const smooth = resampled.map((_, i) => {
    let sum = 0
    let n = 0
    for (let k = Math.max(0, i - W); k <= Math.min(resampled.length - 1, i + W); k++) {
      sum += resampled[k].ele
      n++
    }
    return sum / n
  })
  const { gain, loss } = elevationGainLoss(smooth, 1)
  const altMax = hasEle ? Math.max(...smooth) : 0
  const altMin = hasEle ? Math.min(...smooth) : 0

  // Trace pour la carte : simplification légère (1 m) pour garder le détail au zoom max
  const simple = simplify(points, 1)
  const track: LatLng[] = simple.map((p) => [round(p.lat, 6), round(p.lon, 6)])

  // Profil : un point tous les ~30 m
  const profile: ProfilePoint[] = []
  for (let i = 0; i < resampled.length; i++) {
    if (i % 3 === 0 || i === resampled.length - 1) {
      const r = resampled[i]
      profile.push([round(r.d / 1000, 3), round(smooth[i], 1), round(r.lat, 6), round(r.lon, 6)])
    }
  }

  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon)
  }

  const parsed = parseStageName(name, file)
  const firstTime = points.find((p) => p.time != null)?.time
  return {
    id: file.replace(/\.gpx$/i, ''),
    file,
    ...parsed,
    distanceKm: round(distanceKm, 2),
    elevationGain: Math.round(gain),
    elevationLoss: Math.round(loss),
    altMax: Math.round(altMax),
    altMin: Math.round(altMin),
    kmEffort: round(distanceKm + gain / 100, 2),
    gpxMovingMin: movingMinutes(points),
    gpxDate: firstTime != null ? new Date(firstTime).toISOString() : null,
    track,
    profile,
    bounds: [[minLat, minLon], [maxLat, maxLon]],
  }
}

function round(n: number, d: number): number {
  const f = 10 ** d
  return Math.round(n * f) / f
}
