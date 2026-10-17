// Projection Web Mercator partagée par le tracé (SVG) et le fond de carte
// (MapLibre) : les deux couches se superposent au pixel près.

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const mercX = (lon: number) => (lon + 180) / 360
const mercY = (lat: number) => {
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180)
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
}
const lonOf = (x: number) => x * 360 - 180
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI

export interface Projection {
  /** unités de mise en page par « monde » Mercator normalisé */
  k: number
  /** centre Mercator normalisé, placé au centre de `box` */
  mx: number
  my: number
  box: Box
  px(lat: number, lon: number): [number, number]
  /** mètres au sol par unité de mise en page, à la latitude donnée */
  metersPerUnit(lat: number): number
}

/** Cadre le tracé dans `box` (marge `pad` en fraction de la boîte). */
export function fitProjection(coords: readonly (readonly number[])[], box: Box, pad = 0.04): Projection {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const c of coords) {
    const x = mercX(c[1])
    const y = mercY(c[0])
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  if (!Number.isFinite(x0)) x0 = x1 = y0 = y1 = 0.5
  const iw = box.w * (1 - 2 * pad)
  const ih = box.h * (1 - 2 * pad)
  const k = Math.min(iw / Math.max(x1 - x0, 1e-9), ih / Math.max(y1 - y0, 1e-9))
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  return {
    k,
    mx,
    my,
    box,
    px: (lat, lon) => [cx + (mercX(lon) - mx) * k, cy + (mercY(lat) - my) * k],
    metersPerUnit: (lat) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / k,
  }
}

/**
 * Vue MapLibre équivalente à une projection, pour un conteneur couvrant
 * `mapBox` (même repère) affiché à `cssPerUnit` pixels CSS par unité.
 */
export function mapViewFor(proj: Projection, mapBox: Box, cssPerUnit: number): { center: [number, number]; zoom: number } {
  const cx = proj.box.x + proj.box.w / 2
  const cy = proj.box.y + proj.box.h / 2
  const mx = proj.mx + (mapBox.x + mapBox.w / 2 - cx) / proj.k
  const my = proj.my + (mapBox.y + mapBox.h / 2 - cy) / proj.k
  // MapLibre : le monde mesure 512 · 2^zoom pixels CSS
  return { center: [lonOf(mx), latOf(my)], zoom: Math.log2((proj.k * cssPerUnit) / 512) }
}
