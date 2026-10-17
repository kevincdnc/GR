import { haversine, simplify } from './geo.ts'
import type { Activity, RawTrack, Sport, TrackPoint, TrackStats } from './types.ts'

/**
 * D+ / D- avec hystérésis : une variation n'est comptée que lorsqu'elle dépasse
 * `threshold` mètres depuis le dernier point d'ancrage (élimine le bruit GPS/MNT).
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

/** Temps en mouvement (s) : ignore les pauses (vitesse < 0,8 km/h ou trou > 5 min). */
function movingSeconds(points: TrackPoint[]): number | null {
  const timed = points.filter((p) => p.time != null)
  if (timed.length < 2 || timed.length < points.length * 0.9) return null
  let ms = 0
  for (let i = 1; i < timed.length; i++) {
    const dt = timed[i].time! - timed[i - 1].time!
    if (dt <= 0 || dt > 5 * 60_000) continue
    const v = haversine(timed[i - 1], timed[i]) / (dt / 1000)
    if (v * 3.6 >= 0.8) ms += dt
  }
  return ms > 0 ? ms / 1000 : null
}

function elapsedSeconds(points: TrackPoint[]): number | null {
  const timed = points.filter((p) => p.time != null)
  if (timed.length < 2) return null
  const ms = timed[timed.length - 1].time! - timed[0].time!
  return ms > 0 ? ms / 1000 : null
}

/** Devine le sport à partir de la vitesse moyenne quand le fichier ne le dit pas. */
export function guessSport(distanceM: number, movingS: number | null): Sport {
  if (!movingS) return 'hike'
  const kmh = distanceM / 1000 / (movingS / 3600)
  if (kmh < 7) return 'hike'
  if (kmh < 16) return 'run'
  if (kmh < 45) return 'ride'
  return 'moto'
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

/** Trace brute -> activité prête pour le poster (altitudes lissées, stats, simplification). */
export function buildActivity(track: RawTrack, opts: { id?: string; fileName?: string; source?: Activity['source'] } = {}): Activity {
  const points = track.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (points.length < 2) throw new Error('La trace ne contient pas assez de points.')

  const cum = new Float64Array(points.length)
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + haversine(points[i - 1], points[i])
  const total = cum[points.length - 1]

  // Altitudes : trous comblés, rééchantillonnage tous les 10 m, moyenne glissante ±20 m.
  const hasEle = points.some((p) => p.ele != null)
  const eles: number[] = []
  let last = points.find((p) => p.ele != null)?.ele ?? 0
  for (const p of points) {
    if (p.ele != null) last = p.ele
    eles.push(last)
  }
  const STEP = 10
  const resampled: number[] = []
  for (let d = 0, j = 0; ; d += STEP) {
    const end = d >= total
    if (end) d = total
    while (j < points.length - 2 && cum[j + 1] < d) j++
    const span = cum[j + 1] - cum[j]
    const t = span > 0 ? Math.max(0, Math.min(1, (d - cum[j]) / span)) : 0
    resampled.push(eles[j] + (eles[j + 1] - eles[j]) * t)
    if (end) break
  }
  const W = 2
  const smooth = resampled.map((_, i) => {
    let sum = 0
    let n = 0
    for (let k = Math.max(0, i - W); k <= Math.min(resampled.length - 1, i + W); k++) {
      sum += resampled[k]
      n++
    }
    return sum / n
  })
  const smoothAt = (d: number) => {
    const k = Math.min(smooth.length - 1, Math.max(0, d / STEP))
    const a = Math.floor(k)
    const b = Math.min(smooth.length - 1, a + 1)
    return smooth[a] + (smooth[b] - smooth[a]) * (k - a)
  }
  const { gain, loss } = hasEle ? elevationGainLoss(smooth, 1) : { gain: 0, loss: 0 }

  const indexed = points.map((p, i) => ({ ...p, i }))
  const coords = simplify(indexed, 0.5).map(
    (p) => [round(p.lat, 6), round(p.lon, 6), round(hasEle ? smoothAt(cum[p.i]) : 0, 1), round(cum[p.i], 1)] as Activity['coords'][number],
  )

  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const p of points) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon)
    maxLon = Math.max(maxLon, p.lon)
  }

  const movingTimeS = movingSeconds(points)
  const stats: TrackStats = {
    distanceM: Math.round(total),
    elevationGainM: Math.round(gain),
    elevationLossM: Math.round(loss),
    altMinM: hasEle ? Math.round(Math.min(...smooth)) : null,
    altMaxM: hasEle ? Math.round(Math.max(...smooth)) : null,
    movingTimeS,
    elapsedTimeS: elapsedSeconds(points),
    startTime: points.find((p) => p.time != null)?.time ?? null,
  }
  const base = opts.fileName?.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim()
  return {
    id: opts.id ?? `act_${Date.now().toString(36)}`,
    name: (track.name || base || 'Mon parcours').replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/\s+/g, ' ').trim(),
    sport: track.sport ?? guessSport(total, movingTimeS),
    source: opts.source ?? 'file',
    coords,
    stats,
    bounds: { minLat, minLon, maxLat, maxLon },
  }
}
