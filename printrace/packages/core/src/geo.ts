const R = 6371008.8

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Douglas-Peucker en mètres (projection équirectangulaire locale). */
export function simplify<T extends { lat: number; lon: number }>(points: T[], toleranceM: number): T[] {
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
