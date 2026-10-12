import { useCallback, useEffect, useMemo, useState } from 'react'
import { stages as rawStages, stageMeta } from 'virtual:gr34-stages'
import type { StageData } from './lib/gpx'
import { parseDuration } from './lib/format'

export type { StageData }

export interface StageMeta {
  date?: string
  duree?: string
  notes?: string
}

export type DurationSource = 'saisie' | 'gpx' | 'estimée'

export interface Stage extends StageData {
  date: string | null
  notes: string
  durationMin: number
  durationSource: DurationSource
  /** km/h sur la distance réelle */
  speed: number
  /** km effort / h */
  effortSpeed: number
  /** D+ par km */
  gainPerKm: number
}

export const stages: StageData[] = rawStages

const META_KEY = 'gr34.meta.v1'
const PACE_KEY = 'gr34.pace.v1'

function readLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage indisponible : on garde l'état en mémoire */
  }
}

/**
 * Métadonnées éditables (date, durée réelle, notes). Les valeurs de gpx/etapes.json
 * servent de base ; les modifications faites dans l'UI sont gardées dans le navigateur.
 */
export function useStageMeta() {
  const [local, setLocal] = useState<Record<string, StageMeta>>(() => readLocal(META_KEY, {}))
  const [pace, setPaceState] = useState<number>(() => readLocal(PACE_KEY, 4))

  useEffect(() => writeLocal(META_KEY, local), [local])
  useEffect(() => writeLocal(PACE_KEY, pace), [pace])

  const meta = useMemo(() => {
    const out: Record<string, StageMeta> = {}
    for (const s of stages) {
      const k = String(s.num)
      out[k] = { ...(stageMeta[k] ?? {}), ...(local[k] ?? {}) }
    }
    return out
  }, [local])

  const update = useCallback((num: number, patch: StageMeta) => {
    setLocal((prev) => ({ ...prev, [num]: { ...prev[num], ...patch } }))
  }, [])

  const setPace = useCallback((v: number) => {
    if (Number.isFinite(v) && v > 0) setPaceState(v)
  }, [])

  const enriched: Stage[] = useMemo(
    () =>
      stages.map((s) => {
        const m = meta[String(s.num)] ?? {}
        const manual = m.duree ? parseDuration(m.duree) : null
        let durationMin: number
        let durationSource: DurationSource
        if (manual != null) {
          durationMin = manual
          durationSource = 'saisie'
        } else if (s.gpxMovingMin != null) {
          durationMin = s.gpxMovingMin
          durationSource = 'gpx'
        } else {
          durationMin = (s.kmEffort / pace) * 60
          durationSource = 'estimée'
        }
        const hours = durationMin / 60
        return {
          ...s,
          date: m.date || (s.gpxDate ? s.gpxDate.slice(0, 10) : null),
          notes: m.notes ?? '',
          durationMin,
          durationSource,
          speed: hours > 0 ? s.distanceKm / hours : 0,
          effortSpeed: hours > 0 ? s.kmEffort / hours : 0,
          gainPerKm: s.distanceKm > 0 ? s.elevationGain / s.distanceKm : 0,
        }
      }),
    [meta, pace],
  )

  const exportJson = useCallback(() => {
    const clean: Record<string, StageMeta> = {}
    for (const [k, v] of Object.entries(meta)) {
      const e = Object.fromEntries(Object.entries(v).filter(([, x]) => x)) as StageMeta
      if (Object.keys(e).length) clean[k] = e
    }
    const blob = new Blob([JSON.stringify(clean, null, 2) + '\n'], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'etapes.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, [meta])

  return { stages: enriched, update, pace, setPace, exportJson }
}

/* ---------- Couleurs ---------- */

// Palette catégorielle validée (ordre fixe) — light / dark
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

/**
 * Couleur d'une étape sur la carte. Les étapes sont consécutives le long de la côte :
 * on suit l'ordre fixe de la palette par numéro d'étape, ce qui garantit que deux
 * étapes voisines n'ont jamais la même couleur.
 */
export function stageColor(num: number, dark = false): string {
  const p = dark ? SERIES_DARK : SERIES_LIGHT
  return p[(Math.max(1, num) - 1) % p.length]
}

export interface ChartTheme {
  dark: boolean
  surface: string
  text: string
  textSecondary: string
  muted: string
  grid: string
  axis: string
  s1: string
  s2: string
  s3: string
}

const LIGHT: ChartTheme = {
  dark: false,
  surface: '#fcfcfb',
  text: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#8a8984',
  grid: '#e7e6e2',
  axis: '#c9c8c2',
  s1: SERIES_LIGHT[0],
  s2: SERIES_LIGHT[1],
  s3: SERIES_LIGHT[2],
}
const DARK: ChartTheme = {
  dark: true,
  surface: '#1a1a19',
  text: '#f0efec',
  textSecondary: '#c3c2b7',
  muted: '#8f8e86',
  grid: '#2c2c2a',
  axis: '#45443f',
  s1: SERIES_DARK[0],
  s2: SERIES_DARK[1],
  s3: SERIES_DARK[2],
}

export function useChartTheme(): ChartTheme {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark ? DARK : LIGHT
}
