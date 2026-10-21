// Build statique de l'app (dossier dist/).
//
// Le prototype de design charge ses fichiers .jsx via Babel dans le navigateur :
// chaque fichier est un <script> classique, transpilé avec les presets
// ["react", "env"], et tous partagent la portée globale. On reproduit exactement
// ça à la compilation (mêmes options Babel, mêmes fichiers, même ordre), ce qui
// garde le comportement du design à l'identique sans Babel côté navigateur.
//
// Plusieurs pages partagent le même build (mêmes scripts compilés, même
// Tailwind, mêmes fondations src/ds/tokens.css servies en ds.css) :
//   hub.html            -> dist/index.html                (hub : accès à tous les services)
//   routdoor.html       -> dist/routdoor/index.html       (Routdoor)
//   printrace-site.html -> dist/printrace/index.html      (site web de Printrace)
//   printrace.html      -> dist/printrace/studio/index.html (studio Printrace)
//   printrace-login.html -> dist/printrace/login/index.html (connexion : entrée du produit)
//   design-system.html  -> dist/design-system/index.html  (documentation du design system)
//
// Performances (dist/) : un seul script minifié par page (esbuild), chargé en
// « defer » ; site Printrace et hub pré-rendus en HTML (React côté serveur),
// puis « hydratés » dans le navigateur ; ds.css minifié ; sitemap.xml et robots.txt.
//
//   node scripts/build.mjs                -> dist/ (site GitHub Pages)
//   node scripts/build.mjs --single-file  -> preview/*.html (une page = un fichier, tout inline)

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { buildStage } from '../lib/gpx.mjs'

const require = createRequire(import.meta.url)
const Babel = require('@babel/standalone')
const esbuild = require('esbuild')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const singleFile = process.argv.includes('--single-file')

/* ---------- Données GPX ---------- */

export function buildStagesData() {
  const dir = join(ROOT, 'gpx')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.gpx')) : []
  const stages = []
  for (const file of files) {
    try {
      stages.push(buildStage(readFileSync(join(dir, file), 'utf8'), file))
    } catch (e) {
      console.warn(`[gr34] ${file} ignoré : ${e.message}`)
    }
  }
  stages.sort((a, b) => a.num - b.num || a.file.localeCompare(b.file))
  let meta = {}
  const metaPath = join(dir, 'etapes.json')
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    } catch (e) {
      console.warn(`[gr34] etapes.json invalide : ${e.message}`)
    }
  }
  return `window.GR34_STAGES = ${JSON.stringify(stages)};\nwindow.GR34_META = ${JSON.stringify(meta)};\n`
}

/* ---------- JSX -> JS (mêmes options que Babel standalone pour <script type="text/babel">) ---------- */

function compileJsx(relPath) {
  const code = readFileSync(join(ROOT, relPath), 'utf8')
  return Babel.transform(code, {
    filename: relPath,
    presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    targets: { browsers: undefined },
    compact: false,
    comments: false,
  }).code
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }
const dataUri = (path) => `data:${MIME[extname(path)] || 'application/octet-stream'};base64,${readFileSync(path).toString('base64')}`

/* ---------- Pré-rendu (SSR) ---------- */

// Exécute le bundle de la page dans un bac à sable Node avec un faux navigateur
// minimal : l'appel final ReactDOM.createRoot(...).render(<Page />) est
// intercepté, et l'élément est rendu en HTML par react-dom/server. Les effets
// (canvas, photos, minuteries) ne tournent pas : le navigateur les lance ensuite.
function prerender(bundle, label) {
  const React = require('react')
  const ReactDOMServer = require('react-dom/server')
  let element = null
  const noop = () => {}
  // Objet « tout-terrain » : toute propriété est une fonction inerte qui renvoie l'objet
  const inert = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : inert), apply: () => inert, construct: () => inert })
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
  const sandbox = {
    console: { ...console, log: noop, warn: noop, error: noop },
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop, requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    URL, URLSearchParams, TextEncoder, TextDecoder, Intl, Promise, Math, JSON, Date,
    localStorage: store(), sessionStorage: store(),
    location: { href: 'https://kevincdnc.github.io/GR/printrace/', hash: '', search: '', pathname: '/GR/printrace/', origin: 'https://kevincdnc.github.io' },
    navigator: { userAgent: 'prerender', language: 'fr-FR', languages: ['fr-FR'] },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    addEventListener: noop, removeEventListener: noop, fetch: () => new Promise(noop),
    Image: function () { return inert }, devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
    document: new Proxy({ getElementById: () => inert, createElement: () => inert, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop, fonts: { ready: new Promise(noop), load: () => new Promise(noop), add: noop } }, { get: (t, k) => (k in t ? t[k] : inert) }),
  }
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  // React UMD du bundle remplacé par les modules Node, ReactDOM intercepté
  sandbox.React = React
  const ReactDOM = { createRoot: () => ({ render: (el) => { element = el }, unmount: noop }), hydrateRoot: (c, el) => { element = el }, flushSync: (f) => f && f(), createPortal: () => null }
  Object.defineProperty(sandbox, 'ReactDOM', { get: () => ReactDOM, set: noop })
  Object.defineProperty(sandbox, 'React', { get: () => React, set: noop })
  try {
    vm.runInContext(bundle, sandbox, { filename: label })
  } catch (e) {
    console.warn(`[prerender] ${label} : ${e.message}`)
    return ''
  }
  if (!element) { console.warn(`[prerender] ${label} : aucune page rendue`); return '' }
  const err = console.error; console.error = noop
  try { return ReactDOMServer.renderToString(element) } catch (e) { console.warn(`[prerender] ${label} : ${e.message}`); return '' } finally { console.error = err }
}

/* ---------- Build ---------- */

// Pages du site : source, sortie dans dist/, fichier unique de preview
const PAGES = [
  { src: 'hub.html', out: 'index.html', preview: 'hub.html', prerender: true },
  { src: 'routdoor.html', out: 'routdoor/index.html', preview: 'gr34.html' },
  { src: 'printrace-site.html', out: 'printrace/index.html', preview: 'printrace-site.html', prerender: true },
  // Studio Printrace (nouvelle app) ; l'ancienne version reste en ligne sous printrace/v1/
  { src: 'printrace-studio.html', out: 'printrace/studio/index.html', preview: 'printrace-studio.html' },
  { src: 'printrace.html', out: 'printrace/v1/index.html', preview: 'printrace-v1.html' },
  { src: 'printrace-login.html', out: 'printrace/login/index.html', preview: 'printrace-login.html' },
  { src: 'design-system.html', out: 'design-system/index.html', preview: 'design-system.html' },
]

export function build({ single = false } = {}) {
  const t0 = Date.now()
  const out = join(ROOT, single ? 'preview' : 'dist')
  if (!single) rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const pages = PAGES.filter((p) => existsSync(join(ROOT, p.src))).map((p) => ({ ...p, html: readFileSync(join(ROOT, p.src), 'utf8') }))
  const dsCss = readFileSync(join(ROOT, 'src', 'ds', 'tokens.css'), 'utf8')

  const data = buildStagesData()
  // Textes du site modifiés en mode édition (content/site.json) -> window.PT_CONTENT
  const contentPath = join(ROOT, 'content', 'site.json')
  let siteContent = {}
  try {
    if (existsSync(contentPath)) siteContent = JSON.parse(readFileSync(contentPath, 'utf8'))
  } catch (e) {
    console.warn(`[content] site.json invalide : ${e.message}`)
  }
  const contentJs = `window.PT_CONTENT = ${JSON.stringify(siteContent).replace(/</g, '\\u003c')};\n`
  // Parseur GPX (lib/gpx.mjs) exposé au navigateur pour l'import de fichiers
  const gpxLib = '(function () {\n' + readFileSync(join(ROOT, 'lib', 'gpx.mjs'), 'utf8').replace(/^export /gm, '') +
    '\nwindow.GpxLib = { buildStage: buildStage, buildStageFromTrack: buildStageFromTrack, parseTrack: parseTrack, parseGpx: parseGpx, TRACK_EXTENSIONS: TRACK_EXTENSIONS };\n})();\n'

  // Scripts JSX de toutes les pages (chacune garde son ordre)
  const babelRe = /<script type="text\/babel" src="([^"]+)"><\/script>/g
  const scripts = [...new Set(pages.flatMap((p) => [...p.html.matchAll(babelRe)].map((m) => m[1])))]
  const compiled = new Map(scripts.map((s) => [s, compileJsx(s)]))

  // Tailwind compilé à partir des classes utilisées dans les sources
  const tailwindCss = execFileSync(process.execPath, [
    join(ROOT, 'node_modules', 'tailwindcss', 'lib', 'cli.js'), '-c', join(ROOT, 'tailwind.config.cjs'),
    '-i', join(ROOT, 'src', 'tailwind.css'), '--minify',
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString()

  const nm = (p) => join(ROOT, 'node_modules', p)
  // Polices Barlow (index.html les référence en url(fonts/…))
  const fontFiles = ['barlow', 'barlow-semi-condensed'].flatMap((fam) => [400, 500, 600, 700].map((w) => {
    const name = `${fam}-latin-${w}-normal.woff2`
    return { name, path: nm(`@fontsource/${fam}/files/${name}`) }
  })).concat([
    // Logotypes (Unbounded)
    { name: 'unbounded-latin-400-normal.woff2', path: nm('@fontsource/unbounded/files/unbounded-latin-400-normal.woff2') },
    { name: 'unbounded-latin-800-normal.woff2', path: nm('@fontsource/unbounded/files/unbounded-latin-800-normal.woff2') },
    // Posters : titres éditoriaux (Playfair Display) et style « ancienne carte » (IM Fell English)
    ...['400-normal', '400-italic', '700-normal'].map((v) => ({ name: `playfair-display-latin-${v}.woff2`, path: nm(`@fontsource/playfair-display/files/playfair-display-latin-${v}.woff2`) })),
    ...['400-normal', '400-italic'].map((v) => ({ name: `im-fell-english-latin-${v}.woff2`, path: nm(`@fontsource/im-fell-english/files/im-fell-english-latin-${v}.woff2`) })),
    // Site Printrace : Inter (texte) et Montserrat (titres, en attendant les fichiers de Mont)
    ...[400, 500, 600, 700].map((w) => ({ name: `inter-latin-${w}-normal.woff2`, path: nm(`@fontsource/inter/files/inter-latin-${w}-normal.woff2`) })),
    ...['800-normal', '900-normal', '800-italic'].map((v) => ({ name: `montserrat-latin-${v}.woff2`, path: nm(`@fontsource/montserrat/files/montserrat-latin-${v}.woff2`) })),
  ])
  const vendor = {
    'vendor/react.js': nm('react/umd/react.production.min.js'),
    'vendor/react-dom.js': nm('react-dom/umd/react-dom.production.min.js'),
    'vendor/leaflet.js': nm('leaflet/dist/leaflet.js'),
    'vendor/leaflet.css': nm('leaflet/dist/leaflet.css'),
    // Export SVG des posters (contexte canvas -> SVG)
    'vendor/canvas2svg.js': nm('canvas2svg/canvas2svg.js'),
  }

  if (!single) {
    for (const src of compiled.keys()) mkdirSync(dirname(join(out, 'js', src)), { recursive: true })
    mkdirSync(join(out, 'data'), { recursive: true })
    for (const [src, code] of compiled) writeFileSync(join(out, 'js', src.replace(/\.jsx$/, '.js')), code)
    writeFileSync(join(out, 'data', 'gr34.js'), data)
    writeFileSync(join(out, 'js', 'gpx.js'), gpxLib)
    cpSync(join(ROOT, 'assets'), join(out, 'assets'), { recursive: true })
    // Émojis des posters (Twemoji) : servis par le site, avec une taille propre (dessin sur canvas)
    const emojiDir = nm('@twemoji/svg')
    if (existsSync(emojiDir)) {
      mkdirSync(join(out, 'assets', 'emoji'), { recursive: true })
      for (const f of readdirSync(emojiDir).filter((x) => x.endsWith('.svg'))) {
        writeFileSync(join(out, 'assets', 'emoji', f), readFileSync(join(emojiDir, f), 'utf8').replace('<svg ', '<svg width="72" height="72" '))
      }
    }
    mkdirSync(join(out, 'vendor'), { recursive: true })
    for (const [dest, src] of Object.entries(vendor)) cpSync(src, join(out, dest))
    writeFileSync(join(out, 'tailwind.css'), tailwindCss)
    writeFileSync(join(out, 'ds.css'), esbuild.transformSync(dsCss, { loader: 'css', minify: true }).code)
    mkdirSync(join(out, 'fonts'), { recursive: true })
    for (const f of fontFiles) cpSync(f.path, join(out, 'fonts', f.name))
    for (const p of pages) {
      // Tous les scripts classiques de la page (vendor, données, JSX compilé), dans
      // l'ordre, réunis en un seul fichier minifié chargé en « defer » : une seule
      // requête, rien ne bloque l'affichage. Les noms globaux partagés entre fichiers
      // sont gardés (pas de renommage au niveau supérieur hors module).
      const classicRe = /<script(?: type="text\/babel")? src="([^"]+)"><\/script>\n?/g
      const parts = [...p.html.matchAll(classicRe)].map((m) => m[1])
      const sources = { 'js/gpx.js': gpxLib, 'data/gr34.js': data, 'data/site-content.js': contentJs }
      const vendorCode = parts.filter((src) => vendor[src]).map((src) => readFileSync(vendor[src], 'utf8')).join('\n;\n')
      const appCode = esbuild.transformSync(parts.filter((src) => !vendor[src]).map((src) => compiled.get(src) ?? sources[src]).join('\n;\n'),
        { minify: true, target: 'es2019', legalComments: 'none', charset: 'utf8' }).code
      const name = 'js/' + p.src.replace(/\.html$/, '') + '.min.js'
      writeFileSync(join(out, name), vendorCode + '\n;\n' + appCode)
      let html = p.html.replace(classicRe, '')
        .replace('</head>', `<script defer src="${name}"></script>\n</head>`)
      // Pré-rendu : le HTML de la page est calculé ici (React côté serveur), pour
      // un affichage immédiat avant le JavaScript et un contenu lisible par les moteurs
      if (p.prerender) html = html.replace('<div id="root"></div>', () => `<div id="root">${prerender(appCode, p.src)}</div>`)
      // Page dans un sous-dossier : les chemins relatifs repartent de la racine du site
      const depth = p.out.split('/').length - 1
      if (depth) html = html.replace(/<head>/i, `<head>\n<base href="${'../'.repeat(depth)}" />`)
      mkdirSync(dirname(join(out, p.out)), { recursive: true })
      writeFileSync(join(out, p.out), html)
    }
    // Moteurs de recherche : sitemap des pages publiques
    const SITE = 'https://kevincdnc.github.io/GR/'
    const urls = ['', 'printrace/', 'routdoor/']
    writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`)
    writeFileSync(join(out, 'robots.txt'), `User-agent: *\nDisallow: /GR/design-system/\nDisallow: /GR/printrace/v1/\nSitemap: ${SITE}sitemap.xml\n`)
    // Carte intégrable (iframe) : page légère, sans React
    writeFileSync(join(out, 'embed.html'), readFileSync(join(ROOT, 'embed.html'), 'utf8'))
    console.log(`dist/ prêt en ${Date.now() - t0} ms (${pages.length} pages, ${scripts.length} scripts)`)
    return
  }

  // --- Version un fichier par page (preview Claude) ---
  // Les assets passent par window.__resources, comme le build standalone du design.
  const inline = (code) => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`
  const style = (css) => `<style>${css}</style>`
  let dsInline = dsCss
  for (const f of fontFiles) {
    dsInline = dsInline.replace(`url(fonts/${f.name})`, `url(data:font/woff2;base64,${readFileSync(f.path).toString('base64')})`)
  }
  for (const p of pages) {
    let html = p.html
    const resources = {}
    for (const m of html.matchAll(/<meta name="ext-resource-dependency" content="([^"]+)" data-resource-id="([^"]+)" \/>/g)) {
      resources[m[2]] = dataUri(join(ROOT, m[1]))
    }
    html = html
      .replace('<link rel="stylesheet" href="ds.css" />', () => style(dsInline))
      .replace('<link rel="stylesheet" href="tailwind.css" />', () => style(tailwindCss))
      .replace('<link rel="stylesheet" href="vendor/leaflet.css" />', () => style(readFileSync(vendor['vendor/leaflet.css'], 'utf8')))
      .replace(/<script src="(vendor\/[\w-]+\.js)"><\/script>/g, (_, v) => inline(readFileSync(vendor[v], 'utf8')))
      .replace(/<script src="data\/gr34\.js"><\/script>/, () => inline(data))
      .replace('<script src="js/gpx.js"></script>', () => inline(gpxLib))
      .replace('<script src="data/site-content.js"></script>', () => inline(contentJs))
      .replace(babelRe, (_, src) => inline(compiled.get(src)))
      .replace(/<meta name="ext-resource-dependency"[^>]*\/>\n?/g, '')
      .replace(/<link rel="icon"[^>]*\/>\n?/, '')
      // Préchargements inutiles en fichier unique (polices déjà intégrées)
      .replace(/<link rel="(?:preload|preconnect)"[^>]*\/>\n?/g, '')
      .replace(/<template id="__bundler_thumbnail"[\s\S]*?<\/template>\n?/, '')
      .replace('<div id="root"></div>', () => `<div id="root"></div>\n${inline(`window.__resources = ${JSON.stringify(resources)};`)}`)
      // La preview fournit son propre squelette <html>/<head>/<body>
      .replace(/<!doctype html>\s*/i, '')
      .replace(/<\/?html[^>]*>\s*/g, '')
      .replace(/<\/?head>\s*/g, '')
      .replace(/<\/?body>\s*/g, '')
      .replace(/<meta charset[^>]*>\s*/, '')
      .replace(/<meta name="viewport"[^>]*>\s*/, '')
    // <title> en premier pour la preview
    const title = html.match(/<title>[^<]*<\/title>/)[0]
    html = title + '\n' + html.replace(title, '')
    writeFileSync(join(out, p.preview), html)
    console.log(`preview/${p.preview} prêt (${(html.length / 1024) | 0} Ko)`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({ single: singleFile })
}
