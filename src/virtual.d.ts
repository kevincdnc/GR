declare module 'virtual:gr34-stages' {
  import type { StageData } from './lib/gpx'
  export const stages: StageData[]
  /** Contenu de gpx/etapes.json, indexé par numéro d'étape */
  export const stageMeta: Record<string, { date?: string; duree?: string; notes?: string }>
}
