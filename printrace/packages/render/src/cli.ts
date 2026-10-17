// Export de démonstration sans API : npm run build && npm run export:sample -- [modèle] [format]
//   → .exports/ : PDF imprimeur + PNG 300 dpi
import { buildActivity, parseTrack } from '@printrace/core'
import { createSpec } from '@printrace/poster/model'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { closeBrowser } from './browser.ts'
import { renderPoster } from './renderPoster.ts'
import { serveStatic } from './staticServer.ts'

const root = resolve(import.meta.dirname, '../../..')
const [templateId = 'epure', size = 'a3', file = join(root, 'apps/web/public/samples/gr34-plouhinec-pointe-du-raz.gpx')] = process.argv.slice(2)
const activity = buildActivity(parseTrack(file, readFileSync(file)), { fileName: file.split('/').pop() })
const spec = createSpec(activity, templateId)
spec.format.size = size as typeof spec.format.size
spec.text.title = 'GR34 · Pointe du Raz'
spec.text.subtitle = 'Bretagne · été 2026'

const { url, server } = await serveStatic(join(root, 'apps/web/dist'))
mkdirSync(join(root, '.exports'), { recursive: true })
try {
  for (const format of ['pdf', 'png'] as const) {
    const t0 = Date.now()
    const r = await renderPoster({ activity, spec, format, pageUrl: `${url}/render.html` })
    writeFileSync(join(root, '.exports', r.fileName), r.data)
    console.log(`${r.fileName}  ${(r.data.byteLength / 1e6).toFixed(1)} Mo  ${r.pixels ? `${r.pixels.w}×${r.pixels.h} px  ` : ''}carte ${r.mapOk ? 'ok' : 'indisponible'}  ${Date.now() - t0} ms`)
  }
} finally {
  await closeBrowser()
  server.close()
}
