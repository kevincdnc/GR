// Altitudes d'une trace qui n'en a pas (trace issue d'une carte Strava) :
// modèle numérique de terrain Copernicus GLO-90 via l'API Open-Meteo, comme
// le tracé à la main de Routdoor. Échantillonnage régulier puis interpolation.
import { haversine, type TrackPoint } from '@printrace/core'

const MAX_SAMPLES = 1000
const PER_REQUEST = 100

export async function fillElevation(points: TrackPoint[]): Promise<TrackPoint[]> {
  if (points.length < 2 || points.some((p) => p.ele != null)) return points
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i]))
  const total = cum[cum.length - 1]
  const n = Math.min(MAX_SAMPLES, Math.max(2, Math.round(total / 30)))
  const samples: { lat: number; lon: number; d: number }[] = []
  for (let k = 0, j = 0; k < n; k++) {
    const d = (total * k) / (n - 1)
    while (j < points.length - 2 && cum[j + 1] < d) j++
    const t = cum[j + 1] > cum[j] ? (d - cum[j]) / (cum[j + 1] - cum[j]) : 0
    samples.push({ lat: points[j].lat + (points[j + 1].lat - points[j].lat) * t, lon: points[j].lon + (points[j + 1].lon - points[j].lon) * t, d })
  }
  const eles: number[] = []
  for (let k = 0; k < samples.length; k += PER_REQUEST) {
    const chunk = samples.slice(k, k + PER_REQUEST)
    const q = new URLSearchParams({ latitude: chunk.map((s) => s.lat.toFixed(5)).join(','), longitude: chunk.map((s) => s.lon.toFixed(5)).join(',') })
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?${q}`)
    if (!res.ok) return points // sans altitudes plutôt qu'en échec
    eles.push(...((await res.json()).elevation as number[]))
  }
  return points.map((p, i) => {
    let k = Math.min(samples.length - 2, Math.max(0, Math.floor((cum[i] / total) * (samples.length - 1))))
    while (k < samples.length - 2 && samples[k + 1].d < cum[i]) k++
    const span = samples[k + 1].d - samples[k].d
    const t = span > 0 ? Math.min(1, Math.max(0, (cum[i] - samples[k].d) / span)) : 0
    return { ...p, ele: eles[k] + (eles[k + 1] - eles[k]) * t }
  })
}
