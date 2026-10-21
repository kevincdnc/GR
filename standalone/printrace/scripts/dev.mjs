// Serveur de dev : build dans dist/, sert dist/ sur http://localhost:5173
// et reconstruit à chaque modification (src/, assets/, pages .html…). Recharger la page.
// Les URL se comportent comme sur Cloudflare Pages : /studio -> /studio/ (index.html du dossier).
// printrace.config.mjs est lu au démarrage : relancer après l'avoir modifié.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync, watch } from 'node:fs'
import { extname, join, normalize, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from './build.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT) || 5173
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' }

// build() est synchrone : une modification pendant un build est notée et
// déclenche un nouveau build juste après.
let dirty = false
const safeBuild = () => {
  dirty = false
  try { build() } catch (e) { console.error(e.message) }
  if (dirty) setTimeout(safeBuild, 50)
}
safeBuild()

let timer = null
for (const p of ['src', 'assets', 'lib', 'content', 'index.html', 'studio.html', 'login.html', 'tailwind.config.cjs'].filter((f) => existsSync(join(ROOT, f)))) {
  watch(join(ROOT, p), { recursive: true }, () => {
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(safeBuild, 150)
  })
}

createServer((req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let file = join(DIST, p)
  if (existsSync(file) && statSync(file).isDirectory()) {
    // Dossier sans barre finale : redirection (les chemins relatifs des pages en dépendent)
    if (!p.endsWith('/') && !p.endsWith('\\')) { res.writeHead(301, { Location: req.url.replace(/^([^?]*)/, '$1/') }); return res.end() }
    file = join(file, 'index.html')
  }
  if (!existsSync(file)) { res.writeHead(404); return res.end('404') }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
  res.end(readFileSync(file))
}).listen(PORT, () => console.log(`Printrace → http://localhost:${PORT}/ (studio : /studio/, connexion : /login/)`))
