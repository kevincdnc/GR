import type { RawTrack, TrackPoint } from '../types.ts'

/** IGC (vol libre, format FAI) : enregistrements B + date HFDTE */
export function parseIgc(text: string): RawTrack {
  const dm = text.match(/HFDTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/)
  const day0 = dm ? Date.UTC(2000 + Number(dm[3]), Number(dm[2]) - 1, Number(dm[1])) : null
  const points: TrackPoint[] = []
  let prevSec = -1
  let dayOffset = 0
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])[AV](\d{5}|-\d{4})(\d{5}|-\d{4})/)
    if (!m) continue
    let lat = Number(m[4]) + Number(m[5]) / 60000
    if (m[6] === 'S') lat = -lat
    let lon = Number(m[7]) + Number(m[8]) / 60000
    if (m[9] === 'W') lon = -lon
    const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    if (sec < prevSec) dayOffset += 86400
    prevSec = sec
    points.push({ lat, lon, ele: Number(m[11]) || Number(m[10]) || null, time: day0 != null ? day0 + (dayOffset + sec) * 1000 : null })
  }
  return { name: null, points, sport: 'other' }
}
