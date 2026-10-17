// PosterSpec : la description complète, sérialisable et versionnée d'un poster.
// C'est le contrat entre l'éditeur, l'API et le moteur d'export : même spec +
// même activité = même poster, à l'écran comme à l'impression.
import { z } from 'zod'
import { PAPER_SIZES } from './formats.ts'

export const MAP_STYLE_IDS = ['none', 'nuit', 'papier', 'relief', 'encre', 'satellite'] as const
export const STAT_KEYS = ['distance', 'elevation', 'duration', 'pace', 'speed', 'altMax', 'date'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type MapStyleId = (typeof MAP_STYLE_IDS)[number]

const hex = z.string().regex(/^#[0-9a-f]{6}$/i)

export const PosterSpecSchema = z.object({
  version: z.literal(1),
  template: z.string().min(1),
  format: z.object({
    size: z.enum(Object.keys(PAPER_SIZES) as [keyof typeof PAPER_SIZES, ...(keyof typeof PAPER_SIZES)[]]),
    orientation: z.enum(['portrait', 'landscape']),
  }),
  map: z.object({
    style: z.union([z.literal('auto'), z.enum(MAP_STYLE_IDS)]),
    /** -1 : moins de détails (gros libellés) · 0 · +1 : plus de détails */
    detail: z.number().int().min(-1).max(1),
  }),
  track: z.object({
    color: z.union([z.literal('auto'), hex]),
    width: z.enum(['fine', 'normal', 'bold']),
    markers: z.boolean(),
  }),
  text: z.object({
    title: z.string().max(80),
    subtitle: z.string().max(120),
    coords: z.boolean(),
    branding: z.boolean(),
  }),
  stats: z.array(z.enum(STAT_KEYS)).max(5),
  profile: z.boolean(),
  border: z.enum(['none', 'fine', 'margin', 'passepartout']),
  units: z.enum(['metric', 'imperial']),
  /** Valeurs saisies à la main (ex. temps officiel d'un marathon) */
  overrides: z.object({ duration: z.string().max(20).optional(), date: z.string().max(30).optional() }),
  print: z.object({ bleedMm: z.number().min(0).max(10), cropMarks: z.boolean() }),
})

export type PosterSpec = z.infer<typeof PosterSpecSchema>
