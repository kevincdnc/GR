/**
 * Décodage d'une polyline encodée (algorithme Google, utilisé par Strava pour
 * ses cartes). Précision 1e-5 par défaut (≈ 1 m).
 */
export function decodePolyline(str: string, precision = 5): [number, number][] {
  const factor = 10 ** precision
  const out: [number, number][] = []
  let index = 0
  let lat = 0
  let lon = 0
  while (index < str.length) {
    for (const axis of [0, 1]) {
      let result = 0
      let shift = 0
      let byte: number
      do {
        if (index >= str.length) return out
        byte = str.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += delta
      else lon += delta
    }
    out.push([lat / factor, lon / factor])
  }
  return out
}
