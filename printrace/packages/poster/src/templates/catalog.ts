// Métadonnées des modèles, sans code de dessin : utilisables côté serveur
// (validation, valeurs par défaut, catalogue produits).
import type { MapStyleId, StatKey } from '../spec.ts'

export interface TemplateMeta {
  id: string
  name: string
  kind: 'Carte' | 'Minimal' | 'Graphique' | 'Illustré'
  /** Couleur de page sous la carte et les dessins */
  background: string
  dark: boolean
  defaults: { map: MapStyleId; track: string; stats?: StatKey[] }
}

const meta = <T extends Record<string, Omit<TemplateMeta, 'id'>>>(m: T) =>
  Object.fromEntries(Object.entries(m).map(([id, v]) => [id, { id, ...v }])) as { [K in keyof T]: TemplateMeta }

export const TEMPLATE_META = meta({
  nuit: { name: 'Nuit', kind: 'Carte', background: '#16171a', dark: true, defaults: { map: 'nuit', track: '#ffb648' } },
  epure: { name: 'Épure', kind: 'Minimal', background: '#f4f1ea', dark: false, defaults: { map: 'none', track: '#1b1b1b' } },
  relief: { name: 'Relief', kind: 'Carte', background: '#ffffff', dark: false, defaults: { map: 'relief', track: '#e5482d' } },
  satellite: { name: 'Satellite', kind: 'Carte', background: '#26301f', dark: true, defaults: { map: 'satellite', track: '#ffd23f' } },
  suisse: { name: 'Suisse', kind: 'Graphique', background: '#f5f4ef', dark: false, defaults: { map: 'none', track: '#111111' } },
  plan: { name: 'Plan', kind: 'Graphique', background: '#103c6b', dark: true, defaults: { map: 'none', track: '#ffffff', stats: ['distance', 'elevation', 'duration', 'altMax'] } },
})

export type TemplateId = keyof typeof TEMPLATE_META
export const TEMPLATE_IDS = Object.keys(TEMPLATE_META) as TemplateId[]
export const templateMeta = (id: string): TemplateMeta => TEMPLATE_META[id as TemplateId] ?? TEMPLATE_META.nuit
