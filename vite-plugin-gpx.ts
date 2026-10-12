// Plugin Vite : lit tous les fichiers du dossier gpx/ au build (et en dev, avec
// rechargement auto) et expose les étapes pré-calculées via `virtual:gr34-stages`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { buildStage, type StageData } from './src/lib/gpx'

const VIRTUAL_ID = 'virtual:gr34-stages'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export function gr34Stages(dir = 'gpx'): Plugin {
  const gpxDir = resolve(process.cwd(), dir)
  const cache = new Map<string, { mtime: number; stage: StageData }>()

  function load(): string {
    const files = existsSync(gpxDir) ? readdirSync(gpxDir).filter((f) => f.toLowerCase().endsWith('.gpx')) : []
    const stages: StageData[] = []
    for (const file of files) {
      const path = join(gpxDir, file)
      const mtime = statSync(path).mtimeMs
      const hit = cache.get(file)
      if (hit && hit.mtime === mtime) {
        stages.push(hit.stage)
        continue
      }
      try {
        const stage = buildStage(readFileSync(path, 'utf8'), file)
        cache.set(file, { mtime, stage })
        stages.push(stage)
      } catch (e) {
        console.warn(`[gr34] ${file} ignoré :`, (e as Error).message)
      }
    }
    stages.sort((a, b) => a.num - b.num || a.file.localeCompare(b.file))

    // Infos saisies à la main (dates, durées réelles…) versionnées avec les GPX
    const metaPath = join(gpxDir, 'etapes.json')
    let meta: unknown = {}
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch (e) {
        console.warn('[gr34] etapes.json invalide :', (e as Error).message)
      }
    }
    return `export const stages = ${JSON.stringify(stages)};\nexport const stageMeta = ${JSON.stringify(meta)};\n`
  }

  return {
    name: 'gr34-stages',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id === RESOLVED_ID) return load()
    },
    configureServer(server: ViteDevServer) {
      server.watcher.add(gpxDir)
      const onChange = (file: string) => {
        if (!file.startsWith(gpxDir)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', onChange).on('change', onChange).on('unlink', onChange)
    },
  }
}
