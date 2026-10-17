import { unzipSync } from 'fflate'
import type { RawTrack } from '../types.ts'
import { isFit, parseFit } from './fit.ts'
import { parseGeoJson } from './geojson.ts'
import { parseIgc } from './igc.ts'
import { parseGpx, parseKml, parseTcx } from './xml.ts'

export { parseFit, parseGeoJson, parseGpx, parseIgc, parseKml, parseTcx }

/** Extensions acceptées à l'import */
export const TRACK_EXTENSIONS = ['gpx', 'fit', 'tcx', 'kml', 'kmz', 'geojson', 'json', 'igc'] as const

/** Lit n'importe quel fichier de trace supporté (détection par extension puis par contenu). */
export function parseTrack(fileName: string, data: ArrayBuffer | Uint8Array | string): RawTrack {
  const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()
  const bytes = typeof data === 'string' ? null : data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes && (ext === 'fit' || isFit(bytes))) return parseFit(bytes)
  if (bytes && (ext === 'kmz' || (bytes[0] === 0x50 && bytes[1] === 0x4b))) {
    const files = unzipSync(bytes)
    const kml = Object.keys(files).find((f) => f.toLowerCase().endsWith('.kml'))
    if (!kml) throw new Error('KMZ sans fichier KML')
    return parseKml(new TextDecoder().decode(files[kml]))
  }
  const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(bytes!)
  if (ext === 'tcx' || /<TrainingCenterDatabase\b/.test(text)) return parseTcx(text)
  if (ext === 'kml' || /<kml\b/.test(text)) return parseKml(text)
  if (ext === 'igc' || (/^A[A-Z0-9]{3}/.test(text) && /\nB\d{6}/.test(text))) return parseIgc(text)
  if (ext === 'geojson' || ext === 'json' || /^\s*[{[]/.test(text)) return parseGeoJson(text)
  return parseGpx(text)
}
