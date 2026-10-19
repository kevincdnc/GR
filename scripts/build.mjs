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
//   index.html          -> dist/index.html                (Routdoor)
//   printrace-site.html -> dist/printrace/index.html      (site web de Printrace)
//   printrace.html      -> dist/printrace/studio/index.html (studio Printrace)
//   design-system.html  -> dist/design-system/index.html  (documentation du design system)
//
//   node scripts/build.mjs                -> dist/ (site GitHub Pages)
//   node scripts/build.mjs --single-file  -> preview/*.html (une page = un fichier, tout inline)

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStage } from '../lib/gpx.mjs'

const require = createRequire(import.meta.url)
const Babel = require('@babel/standalone')

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

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' }
const dataUri = (path) => `data:${MIME[extname(path)] || 'application/octet-stream'};base64,${readFileSync(path).toString('base64')}`

/* ---------- Build ---------- */

// Pages du site : source, sortie dans dist/, fichier unique de preview
const PAGES = [
  { src: 'index.html', out: 'index.html', preview: 'gr34.html' },
  { src: 'printrace-site.html', out: 'printrace/index.html', preview: 'printrace-site.html' },
  { src: 'printrace.html', out: 'printrace/studio/index.html', preview: 'printrace.html' },
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
    mkdirSync(join(out, 'vendor'), { recursive: true })
    for (const [dest, src] of Object.entries(vendor)) cpSync(src, join(out, dest))
    writeFileSync(join(out, 'tailwind.css'), tailwindCss)
    writeFileSync(join(out, 'ds.css'), dsCss)
    mkdirSync(join(out, 'fonts'), { recursive: true })
    for (const f of fontFiles) cpSync(f.path, join(out, 'fonts', f.name))
    for (const p of pages) {
      let html = p.html.replace(babelRe, (_, src) => `<script src="js/${src.replace(/\.jsx$/, '.js')}"></script>`)
      // Page dans un sous-dossier : les chemins relatifs repartent de la racine du site
      const depth = p.out.split('/').length - 1
      if (depth) html = html.replace(/<head>/i, `<head>\n<base href="${'../'.repeat(depth)}" />`)
      mkdirSync(dirname(join(out, p.out)), { recursive: true })
      writeFileSync(join(out, p.out), html)
    }
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
      .replace(babelRe, (_, src) => inline(compiled.get(src)))
      .replace(/<meta name="ext-resource-dependency"[^>]*\/>\n?/g, '')
      .replace(/<link rel="icon"[^>]*\/>\n?/, '')
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
