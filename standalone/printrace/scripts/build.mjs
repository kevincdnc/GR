// Build statique de Printrace (dossier dist/).
//
// Les sources sont des fichiers .jsx chargés comme des <script> classiques qui
// partagent la portée globale (héritage du prototype de design). On les compile
// avec Babel (presets ["react", "env"]), dans l'ordre de chaque page, puis on
// réunit les scripts d'une page en un seul fichier minifié (esbuild).
//
//   index.html  -> dist/index.html         (site de présentation, pré-rendu en HTML)
//   studio.html -> dist/studio/index.html  (studio : éditeur de posters)
//   login.html  -> dist/login/index.html   (connexion)
//
// Configuration (URL publique, Strava, Routdoor…) : printrace.config.mjs, réglable
// par variables d'environnement. Elle est injectée dans data/config.js et dans
// les balises <head> (canonical, Open Graph, JSON-LD), sitemap.xml et robots.txt.
//
//   node scripts/build.mjs                -> dist/
//   node scripts/build.mjs --single-file  -> preview/*.html (une page = un fichier, tout inline)

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import config from '../printrace.config.mjs'

const require = createRequire(import.meta.url)
const Babel = require('@babel/standalone')
const esbuild = require('esbuild')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const singleFile = process.argv.includes('--single-file')

/* ---------- Configuration publique ---------- */

// Ce que le navigateur reçoit (window.PRINTRACE_CONFIG) : uniquement des valeurs publiques
export function configJs() {
  const pub = { siteUrl: config.siteUrl, routdoorUrl: config.routdoorUrl, stravaApi: config.stravaApi,
    googleClientId: config.googleClientId, unsplashKey: config.unsplashKey, content: config.content }
  return `window.PRINTRACE_CONFIG = ${JSON.stringify(pub).replace(/</g, '\\u003c')};\n`
}
// URL publique dans le <head> : remplacée, ou balises retirées si elle n'est pas configurée
function withSiteUrl(html) {
  if (config.siteUrl) return html.replaceAll('%SITE_URL%', config.siteUrl)
  return html
    .replace(/<script type="application\/ld\+json" data-site-url>[\s\S]*?<\/script>\n?/, '')
    .replace(/^.*%SITE_URL%.*\n/gm, '')
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
    location: { href: 'http://localhost/', hash: '', search: '', pathname: '/', origin: 'http://localhost', hostname: 'localhost' },
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
  { src: 'index.html', out: 'index.html', preview: 'printrace-site.html', prerender: true },
  { src: 'studio.html', out: 'studio/index.html', preview: 'printrace-studio.html' },
  { src: 'login.html', out: 'login/index.html', preview: 'printrace-login.html' },
]

export function build({ single = false } = {}) {
  const t0 = Date.now()
  const out = join(ROOT, single ? 'preview' : 'dist')
  if (!single) rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const pages = PAGES.filter((p) => existsSync(join(ROOT, p.src))).map((p) => ({ ...p, html: readFileSync(join(ROOT, p.src), 'utf8') }))
  const dsCss = readFileSync(join(ROOT, 'src', 'ds', 'tokens.css'), 'utf8')

  const cfgJs = configJs()
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
    // Export SVG des posters (contexte canvas -> SVG)
    'vendor/canvas2svg.js': nm('canvas2svg/canvas2svg.js'),
  }

  if (!single) {
    for (const src of compiled.keys()) mkdirSync(dirname(join(out, 'js', src)), { recursive: true })
    mkdirSync(join(out, 'data'), { recursive: true })
    for (const [src, code] of compiled) writeFileSync(join(out, 'js', src.replace(/\.jsx$/, '.js')), code)
    writeFileSync(join(out, 'data', 'config.js'), cfgJs)
    writeFileSync(join(out, 'js', 'gpx.js'), gpxLib)
    cpSync(join(ROOT, 'assets'), join(out, 'assets'), { recursive: true })
    // Émojis des posters (Apple) : servis par le site, nommés sans sélecteur FE0F (clé du rendu)
    const emojiDir = nm('emoji-datasource-apple/img/apple/64')
    if (existsSync(emojiDir)) {
      mkdirSync(join(out, 'assets', 'emoji'), { recursive: true })
      for (const f of readdirSync(emojiDir).filter((x) => x.endsWith('.png'))) {
        const key = f.replace(/-fe0f/g, '')
        if (!existsSync(join(out, 'assets', 'emoji', key))) cpSync(join(emojiDir, f), join(out, 'assets', 'emoji', key))
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
      const sources = { 'js/gpx.js': gpxLib, 'data/config.js': cfgJs, 'data/site-content.js': contentJs }
      const vendorCode = parts.filter((src) => vendor[src]).map((src) => readFileSync(vendor[src], 'utf8')).join('\n;\n')
      const appCode = esbuild.transformSync(parts.filter((src) => !vendor[src]).map((src) => compiled.get(src) ?? sources[src]).join('\n;\n'),
        { minify: true, target: 'es2019', legalComments: 'none', charset: 'utf8' }).code
      const name = 'js/' + (p.src === 'index.html' ? 'site' : p.src.replace(/\.html$/, '')) + '.min.js'
      writeFileSync(join(out, name), vendorCode + '\n;\n' + appCode)
      let html = withSiteUrl(p.html).replace(classicRe, '')
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
    // Moteurs de recherche : sitemap (site seulement) si l'URL publique est configurée
    if (config.siteUrl) writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${config.siteUrl}</loc></url>\n</urlset>\n`)
    else console.warn('[config] PRINTRACE_SITE_URL non défini : pas d’URL canonique, d’Open Graph absolu ni de sitemap.')
    writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n${config.siteUrl ? `Sitemap: ${config.siteUrl}sitemap.xml\n` : ''}`)
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
    let html = withSiteUrl(p.html)
    const resources = {}
    for (const m of html.matchAll(/<meta name="ext-resource-dependency" content="([^"]+)" data-resource-id="([^"]+)" \/>/g)) {
      resources[m[2]] = dataUri(join(ROOT, m[1]))
    }
    html = html
      .replace('<link rel="stylesheet" href="ds.css" />', () => style(dsInline))
      .replace('<link rel="stylesheet" href="tailwind.css" />', () => style(tailwindCss))
      .replace(/<script src="(vendor\/[\w-]+\.js)"><\/script>/g, (_, v) => inline(readFileSync(vendor[v], 'utf8')))
      .replace('<script src="data/config.js"></script>', () => inline(cfgJs))
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
