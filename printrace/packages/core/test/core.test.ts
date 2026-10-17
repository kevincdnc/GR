import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildActivity, elevationGainLoss, parseTrack } from '../src/index.ts'

const gpx = readFileSync(new URL('./fixtures/sample.gpx', import.meta.url), 'utf8')

describe('parseTrack', () => {
  it('lit un GPX', () => {
    const t = parseTrack('sample.gpx', gpx)
    expect(t.points.length).toBeGreaterThan(100)
    expect(t.points[0].lat).toBeCloseTo(48, 0)
  })
  it('lit un GeoJSON', () => {
    const t = parseTrack('x.geojson', JSON.stringify({ type: 'Feature', properties: { name: 'Boucle' }, geometry: { type: 'LineString', coordinates: [[-4, 48, 10], [-4.1, 48.1, 20]] } }))
    expect(t.name).toBe('Boucle')
    expect(t.points).toHaveLength(2)
  })
})

describe('buildActivity', () => {
  it('calcule distance et dénivelé', () => {
    const a = buildActivity(parseTrack('sample.gpx', gpx), { fileName: 'sample.gpx' })
    expect(a.stats.distanceM / 1000).toBeGreaterThan(30)
    expect(a.stats.distanceM / 1000).toBeLessThan(40)
    expect(a.stats.elevationGainM).toBeGreaterThan(200)
    expect(a.coords.length).toBeLessThan(parseTrack('sample.gpx', gpx).points.length)
    expect(a.coords.at(-1)![3]).toBeCloseTo(a.stats.distanceM, -1)
  })
  it('refuse une trace vide', () => {
    expect(() => buildActivity({ name: null, points: [] })).toThrow()
  })
})

describe('elevationGainLoss', () => {
  it('ignore le bruit sous le seuil', () => {
    expect(elevationGainLoss([0, 0.5, 0, 0.5, 10, 9.5, 20], 1)).toEqual({ gain: 20, loss: 0 })
  })
})
