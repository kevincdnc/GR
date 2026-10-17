import type { RawTrack, TrackPoint } from '../types.ts'

/** GeoJSON : (Multi)LineString, Feature(Collection) ; heures dans properties.coordTimes */
export function parseGeoJson(input: string | object): RawTrack {
  const data = typeof input === 'string' ? JSON.parse(input) : input
  const points: TrackPoint[] = []
  let name: string | null = null
  const time = (v: unknown) => {
    const t = typeof v === 'string' || typeof v === 'number' ? new Date(v).getTime() : NaN
    return Number.isFinite(t) ? t : null
  }
  const addLine = (coords: number[][], times?: unknown[]) =>
    coords.forEach((c, i) => {
      if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
        points.push({ lat: c[1], lon: c[0], ele: Number.isFinite(c[2]) ? c[2] : null, time: times ? time(times[i]) : null })
      }
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visit = (o: any, props?: any): void => {
    if (!o) return
    if (o.type === 'FeatureCollection') return o.features.forEach((f: unknown) => visit(f))
    if (o.type === 'Feature') {
      const p = o.properties ?? {}
      if (!name && p.name) name = String(p.name)
      return visit(o.geometry, p)
    }
    const times = props?.coordTimes ?? props?.coordinateProperties?.times
    if (o.type === 'LineString') addLine(o.coordinates, times)
    else if (o.type === 'MultiLineString') o.coordinates.forEach((l: number[][], k: number) => addLine(l, Array.isArray(times?.[0]) ? times[k] : undefined))
    else if (o.type === 'GeometryCollection') o.geometries.forEach((g: unknown) => visit(g, props))
  }
  visit(data)
  return { name, points }
}
