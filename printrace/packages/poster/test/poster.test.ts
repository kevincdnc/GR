import { describe, expect, it } from 'vitest'
import { fitProjection, mapViewFor } from '../src/geo.ts'
import { exportPixels, pageGeometry } from '../src/formats.ts'
import { PosterSpecSchema } from '../src/spec.ts'
import { formatDuration } from '../src/values.ts'

describe('formats', () => {
  it('A3 à 300 dpi = 3508 × 4961 px', () => {
    expect(exportPixels(pageGeometry('a3', 'portrait'), 300)).toEqual({ w: 3508, h: 4961 })
  })
  it('paysage inverse les côtés et convertit le fond perdu', () => {
    const g = pageGeometry('a4', 'landscape', 3)
    expect(g.trimMm).toEqual([297, 210])
    expect(g.bleed).toBeCloseTo((3 / 297) * 1000)
  })
})

describe('projection', () => {
  const coords = [[48.0, -4.7], [48.1, -4.5]]
  it('cadre le tracé dans la boîte', () => {
    const p = fitProjection(coords, { x: 0, y: 0, w: 100, h: 100 }, 0)
    for (const [lat, lon] of coords) {
      const [x, y] = p.px(lat, lon)
      expect(x).toBeGreaterThanOrEqual(-1e-9)
      expect(x).toBeLessThanOrEqual(100 + 1e-9)
      expect(y).toBeGreaterThanOrEqual(-1e-9)
      expect(y).toBeLessThanOrEqual(100 + 1e-9)
    }
  })
  it('la vue de carte est centrée sur le tracé quand les boîtes coïncident', () => {
    const box = { x: 0, y: 0, w: 1000, h: 1400 }
    const v = mapViewFor(fitProjection(coords, box), box, 1)
    expect(v.center[0]).toBeCloseTo(-4.6, 5)
    expect(v.zoom).toBeGreaterThan(8)
  })
})

describe('spec', () => {
  it('refuse une couleur invalide', () => {
    expect(PosterSpecSchema.shape.track.safeParse({ color: 'red', width: 'normal', markers: true }).success).toBe(false)
  })
  it('formate les durées', () => {
    expect(formatDuration(41 * 3600 + 51 * 60)).toBe('41 h 51')
    expect(formatDuration(42 * 60)).toBe('42 min')
  })
})
