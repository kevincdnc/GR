import type { Activity } from '@printrace/core'
import { type PosterSpec, PosterSpecSchema } from './spec.ts'
import { templateMeta } from './templates/catalog.ts'
import { defaultStats } from './values.ts'

/** Spec de départ pour une activité : le poster doit être beau sans rien toucher. */
export function createSpec(activity: Activity, templateId = 'nuit'): PosterSpec {
  const t = templateMeta(templateId)
  return {
    version: 1,
    template: t.id,
    format: { size: 'a3', orientation: 'portrait' },
    map: { style: 'auto', detail: 0 },
    track: { color: 'auto', width: 'normal', markers: true },
    text: { title: activity.name, subtitle: '', coords: true, branding: true },
    stats: t.defaults.stats ?? defaultStats(activity.sport),
    profile: false,
    border: 'none',
    units: 'metric',
    overrides: {},
    print: { bleedMm: 3, cropMarks: true },
  }
}

/** Valide une spec venue de l'extérieur (API, stockage local, lien partagé). */
export function parseSpec(input: unknown): PosterSpec {
  return PosterSpecSchema.parse(input)
}
