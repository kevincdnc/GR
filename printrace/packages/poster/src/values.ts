// Mise en forme des valeurs affichées (français, unités métriques/impériales).
import type { Activity } from '@printrace/core'
import type { PosterSpec, StatKey } from './spec.ts'

export interface StatValue {
  key: StatKey
  label: string
  value: string
  unit: string
}

const NNBSP = ' '
const nf = (n: number, d = 0) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n).replace(/\s/g, NNBSP)

export const STAT_LABELS: Record<StatKey, string> = {
  distance: 'Distance',
  elevation: 'Dénivelé +',
  duration: 'Durée',
  pace: 'Allure',
  speed: 'Vitesse moy.',
  altMax: 'Altitude max',
  date: 'Date',
}

/** Vitesse de référence (km/h) pour estimer une durée quand la trace n'est pas horodatée */
const EST_KMH: Record<Activity['sport'], number> = { hike: 4.2, run: 10, ride: 20, moto: 60, ski: 8, swim: 3, other: 5 }

/** Durée retenue (s) : temps en mouvement, sinon estimation (randonnée : +1 min par 10 m de D+). */
export function durationSeconds(a: Activity): number {
  if (a.stats.movingTimeS) return a.stats.movingTimeS
  const h = a.stats.distanceM / 1000 / EST_KMH[a.sport] + (a.sport === 'hike' ? a.stats.elevationGainM / 600 : 0)
  return h * 3600
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h} h ${String(m === 60 ? 59 : m).padStart(2, '0')}`
}

export function formatStat(key: StatKey, a: Activity, spec: Pick<PosterSpec, 'units' | 'overrides'>): StatValue {
  const imp = spec.units === 'imperial'
  const km = a.stats.distanceM / 1000
  const dist = imp ? km / 1.609344 : km
  const dur = durationSeconds(a)
  const base = { key, label: STAT_LABELS[key] }
  switch (key) {
    case 'distance':
      return { ...base, value: nf(dist, dist < 100 ? 1 : 0), unit: imp ? 'mi' : 'km' }
    case 'elevation':
      return { ...base, value: nf(imp ? a.stats.elevationGainM * 3.28084 : a.stats.elevationGainM), unit: imp ? 'ft' : 'm' }
    case 'altMax':
      return { ...base, value: a.stats.altMaxM == null ? '—' : nf(imp ? a.stats.altMaxM * 3.28084 : a.stats.altMaxM), unit: imp ? 'ft' : 'm' }
    case 'duration':
      return { ...base, value: spec.overrides.duration || formatDuration(dur), unit: '' }
    case 'pace': {
      const sPer = dur / Math.max(dist, 0.001)
      const m = Math.floor(sPer / 60)
      const s = Math.round(sPer % 60)
      return { ...base, value: `${m}'${String(s === 60 ? 59 : s).padStart(2, '0')}"`, unit: imp ? '/mi' : '/km' }
    }
    case 'speed':
      return { ...base, value: nf(dist / (dur / 3600), 1), unit: imp ? 'mph' : 'km/h' }
    case 'date': {
      const t = a.stats.startTime
      const value = spec.overrides.date || (t ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(t) : '—')
      return { ...base, value, unit: '' }
    }
  }
}

/** Statistiques proposées par défaut selon le sport */
export function defaultStats(sport: Activity['sport']): StatKey[] {
  switch (sport) {
    case 'run':
      return ['distance', 'duration', 'pace']
    case 'ride':
      return ['distance', 'elevation', 'speed']
    case 'moto':
      return ['distance', 'duration', 'date']
    default:
      return ['distance', 'elevation', 'duration']
  }
}

/** 48°40,1′ N · 4°22,3′ O */
export function formatCoords(lat: number, lon: number): string {
  const dm = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v)
    const d = Math.floor(a)
    return `${d}°${((a - d) * 60).toFixed(1).replace('.', ',')}′ ${v >= 0 ? pos : neg}`
  }
  return `${dm(lat, 'N', 'S')}  ·  ${dm(lon, 'E', 'O')}`
}
