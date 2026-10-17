// Aperçu autonome de l'éditeur en un seul fichier HTML (sans serveur) :
//   npm run build:demo -w @printrace/web  →  apps/web/dist-demo/printrace-demo.html
// Le fichier ne contient pas de squelette <html>/<head>/<body> : il est publié
// tel quel comme page (le squelette est ajouté à la publication).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'

const web = resolve(import.meta.dirname, '..')
const out = join(web, 'dist-demo')

// 2. Build Vite en un seul paquet JS
await build({
  root: web,
  configFile: join(web, 'vite.config.ts'),
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('true') },
  logLevel: 'warn',
  build: {
    outDir: out,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: { input: join(web, 'index.html'), output: { inlineDynamicImports: true } },
  },
})

// 3. Tout dans un fichier : CSS + JS inline, polices latines en data URI (woff2 seulement)
const html = readFileSync(join(out, 'index.html'), 'utf8')
const assets = join(out, 'assets')
const files = readdirSync(assets)
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n')
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n')
const fonts = css.replace(/@font-face\s*{[^}]*}/g, (block) => {
  const woff2 = block.match(/url\(\/?assets\/([^)]+\.woff2)\)/)?.[1]
  if (!woff2 || !/-latin-(ext-)?\d{3}-/.test(woff2)) return ''
  const data = readFileSync(join(assets, woff2)).toString('base64')
  return block.replace(/src:[^;}]*/, `src:url(data:font/woff2;base64,${data}) format("woff2")`)
})
const title = html.match(/<title>[^<]*<\/title>/)![0].replace(/—.*</, '<')
const page = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>:root{color-scheme:dark}${fonts}</style>`,
  '<div id="root"></div>',
  `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`,
].join('\n')
writeFileSync(join(out, 'printrace-demo.html'), page)
console.log(`dist-demo/printrace-demo.html : ${(page.length / 1e6).toFixed(2)} Mo`)
