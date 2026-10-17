import { describe, expect, it } from 'vitest'
import { decodePolyline } from '../../../packages/core/src/index.ts'
import { parseActivityPage, StravaPrivateError } from '../src/strava/public.ts'

// Exemple de la documentation Google : (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
const POLY = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'

// Polyline d'une petite boucle en Bretagne, encodée pour les tests
function encode(points: [number, number][]) {
  let out = ''
  let plat = 0
  let plon = 0
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1
    let s = ''
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63)
      n >>= 5
    }
    return s + String.fromCharCode(n + 63)
  }
  for (const [lat, lon] of points) {
    const a = Math.round(lat * 1e5)
    const b = Math.round(lon * 1e5)
    out += enc(a - plat) + enc(b - plon)
    plat = a
    plon = b
  }
  return out
}
const loop: [number, number][] = Array.from({ length: 40 }, (_, i) => [48.03 + 0.01 * Math.sin(i / 6), -4.6 + 0.01 * Math.cos(i / 6)])

describe('decodePolyline', () => {
  it('décode l’exemple de référence', () => {
    expect(decodePolyline(POLY)).toEqual([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]])
  })
})

describe('page publique Strava', () => {
  it('page Next.js : polyline + chiffres', () => {
    const data = { props: { pageProps: { activity: { name: 'Tour de la Pointe', sportType: 'Hike', distance: 12345.6, elevationGain: 312, movingTime: 14000, startDateLocal: '2026-07-14T08:00:00Z', mapAndPhotos: { activityPolyline: encode(loop), thumbnail: { polyline: encode(loop.slice(0, 5)) } } } } } }
    const html = `<html><head><meta property="og:title" content="Tour | Strava"></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`
    const r = parseActivityPage(html)
    expect(r.track.name).toBe('Tour de la Pointe')
    expect(r.track.sport).toBe('hike')
    expect(r.track.points).toHaveLength(40)
    expect(r.track.points[0].lat).toBeCloseTo(48.03, 4)
    expect(r.stats).toMatchObject({ distanceM: 12345.6, elevationGainM: 312, movingTimeS: 14000 })
    expect(r.stats.startTime).toBe(Date.parse('2026-07-14T08:00:00Z'))
  })

  it('ancienne page : data-react-props avec tableau latlng et altitudes', () => {
    const props = { activity: { name: 'Sortie vélo', type: 'Ride', streams: { latlng: loop, altitude: loop.map((_, i) => 10 + i) } } }
    const html = `<div data-react-props="${JSON.stringify(props).replace(/"/g, '&quot;')}"></div>`
    const r = parseActivityPage(html)
    expect(r.track.sport).toBe('ride')
    expect(r.track.points).toHaveLength(40)
    expect(r.track.points[5].ele).toBe(15)
  })

  it('carte statique : polyline dans l’URL de l’image', () => {
    const html = `<img src="https://maps.example.com/static?path=weight:3|enc:${encodeURIComponent(encode(loop))}&size=600x400">`
    expect(parseActivityPage(html).track.points.length).toBe(40)
  })

  it('page sans trace (activité privée) : erreur explicite', () => {
    expect(() => parseActivityPage('<html><body>Log in</body></html>')).toThrow(StravaPrivateError)
  })
})
