// Génère src/lib/sample-activity.json : la trace d'exemple allégée (le GPX brut pèse 2 Mo).
//   npx tsx apps/web/scripts/make-sample.ts
import { buildActivity, parseTrack, simplify } from '@printrace/core'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const web = resolve(import.meta.dirname, '..')
const gpx = join(web, '../../packages/core/test/fixtures/sample.gpx')
const a = buildActivity(parseTrack(gpx, readFileSync(gpx)), { fileName: 'gr34.gpx', source: 'sample' })
const coords = simplify(a.coords.map((c) => ({ lat: c[0], lon: c[1], c })), 4).map((p) => [p.c[0], p.c[1], Math.round(p.c[2]), Math.round(p.c[3])])
const out = { ...a, id: 'sample', name: 'GR34 · Pointe du Raz', coords }
writeFileSync(join(web, 'src/lib/sample-activity.json'), JSON.stringify(out))
console.log(`${coords.length} points, ${(JSON.stringify(out).length / 1024).toFixed(0)} Ko`)
