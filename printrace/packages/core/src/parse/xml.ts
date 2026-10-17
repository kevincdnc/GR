// GPX, TCX et KML : lus par expressions régulières pour rester utilisables
// sans DOM (navigateur, Node, worker).
import type { RawTrack, Sport, TrackPoint } from '../types.ts'

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

const tagText = (body: string, tag: string) => body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]
const numOrNull = (v: string | undefined) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const timeOrNull = (v: string | undefined) => {
  const t = v ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}
const clean = (s: string | null | undefined) => (s ? decodeEntities(s).trim() || null : null)

/** Type d'activité GPX/TCX (« hiking », « running », « Biking »…) */
export function sportFromLabel(label: string | null | undefined): Sport | undefined {
  if (!label) return undefined
  const l = label.toLowerCase()
  if (/hik|walk|trek|randonn/.test(l)) return 'hike'
  if (/run|trail|course/.test(l)) return 'run'
  if (/bik|cycl|ride|vélo|velo|gravel/.test(l)) return 'ride'
  if (/moto/.test(l)) return 'moto'
  if (/ski/.test(l)) return 'ski'
  if (/swim|nage/.test(l)) return 'swim'
  return undefined
}

export function parseGpx(xml: string): RawTrack {
  const trk = xml.match(/<trk\b[\s\S]*?<name>([\s\S]*?)<\/name>/)
  const meta = xml.match(/<metadata\b[\s\S]*?<name>([\s\S]*?)<\/name>/)
  const type = xml.match(/<trk\b[\s\S]*?<type>([\s\S]*?)<\/type>/)?.[1]
  const points: TrackPoint[] = []
  const tag = /<trkpt\b/.test(xml) ? 'trkpt' : 'rtept'
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1]
    const body = m[2] ?? ''
    const lat = Number(attrs.match(/lat\s*=\s*["']([^"']+)/)?.[1])
    const lon = Number(attrs.match(/lon\s*=\s*["']([^"']+)/)?.[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    points.push({ lat, lon, ele: numOrNull(tagText(body, 'ele')), time: timeOrNull(tagText(body, 'time')) })
  }
  return { name: clean(trk?.[1] ?? meta?.[1]), points, sport: sportFromLabel(type) }
}

export function parseTcx(xml: string): RawTrack {
  const sport = xml.match(/<Activity\b[^>]*Sport="([^"]+)"/)?.[1]
  const points: TrackPoint[] = []
  const re = /<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const b = m[1]
    const lat = numOrNull(tagText(b, 'LatitudeDegrees'))
    const lon = numOrNull(tagText(b, 'LongitudeDegrees'))
    if (lat == null || lon == null) continue
    points.push({ lat, lon, ele: numOrNull(tagText(b, 'AltitudeMeters')), time: timeOrNull(tagText(b, 'Time')) })
  }
  return { name: clean(tagText(xml, 'Name') ?? tagText(xml, 'Notes')), points, sport: sportFromLabel(sport) }
}

export function parseKml(xml: string): RawTrack {
  const points: TrackPoint[] = []
  for (const tr of xml.match(/<gx:Track\b[\s\S]*?<\/gx:Track>/g) ?? []) {
    const whens = [...tr.matchAll(/<when>([^<]+)<\/when>/g)].map((x) => timeOrNull(x[1]))
    const coords = [...tr.matchAll(/<gx:coord>([^<]+)<\/gx:coord>/g)].map((x) => x[1].trim().split(/\s+/).map(Number))
    coords.forEach((c, i) => {
      if (Number.isFinite(c[0]) && Number.isFinite(c[1])) points.push({ lat: c[1], lon: c[0], ele: Number.isFinite(c[2]) ? c[2] : null, time: whens[i] ?? null })
    })
  }
  if (!points.length) {
    for (const ls of xml.match(/<LineString\b[\s\S]*?<\/LineString>/g) ?? []) {
      for (const t of (tagText(ls, 'coordinates') ?? '').trim().split(/\s+/)) {
        const [lon, lat, ele] = t.split(',').map(Number)
        if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null, time: null })
      }
    }
  }
  return { name: clean(tagText(xml, 'name')), points }
}
