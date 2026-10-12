// Construit une version « un seul fichier » de l'app (JS + CSS inline) pour la preview Claude.
import { build } from 'vite'

process.env.GR34_PREVIEW = '1'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = 'preview-dist'
await build({
  logLevel: 'warn',
  build: {
    outDir: out,
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
const assets = join(out, 'assets')
const files = readdirSync(assets)
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8'))
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8'))
const html = `<title>GR34 Tracker</title>
<style>${css.join('\n')}</style>
<div id="root"></div>
<script type="module">${js.join('\n').replace(/<\/script/gi, '<\\/script')}</script>
`
mkdirSync('preview', { recursive: true })
writeFileSync('preview/gr34.html', html)
console.log('preview/gr34.html', (html.length / 1024).toFixed(0), 'KB')
