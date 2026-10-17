import epure from './epure.tsx'
import nuit from './nuit.tsx'
import plan from './plan.tsx'
import relief from './relief.tsx'
import satellite from './satellite.tsx'
import suisse from './suisse.tsx'
import type { PosterTemplate } from './types.ts'

/** Catalogue : ajouter un modèle = un fichier + une ligne ici. */
export const TEMPLATES: PosterTemplate[] = [nuit, epure, relief, satellite, suisse, plan]

export function getTemplate(id: string): PosterTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

export type { PosterTemplate, TemplateInput, TemplateLayout } from './types.ts'
