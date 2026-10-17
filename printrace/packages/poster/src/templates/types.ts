import type { Activity } from '@printrace/core'
import type { ReactNode } from 'react'
import type { Box, Projection } from '../geo.ts'
import type { MapStyleId, PosterSpec } from '../spec.ts'
import type { TemplateMeta } from './catalog.ts'
import type { StatValue } from '../values.ts'

/** Ce qu'un modèle reçoit : tout est déjà résolu (textes, couleurs, statistiques). */
export interface TemplateInput {
  /** Zone de dessin du modèle : largeur 1000, hauteur selon le format */
  W: number
  H: number
  /** Fond perdu disponible autour de la zone (0 si une marge blanche l'entoure) */
  bleed: number
  activity: Activity
  spec: PosterSpec
  title: string
  subtitle: string
  stats: StatValue[]
  coordsText: string | null
  trackColor: string
  /** Épaisseur du tracé, déjà multipliée par le réglage fin / normal / épais */
  trackScale: number
  mapStyle: MapStyleId
  attribution: string
  /** Préfixe unique pour les id SVG (dégradés) : plusieurs posters par page */
  uid: string
}

export interface TemplateLayout {
  /** Boîte dans laquelle le tracé est cadré */
  trackBox: Box
  /** Zone couverte par le fond de carte (null : pas de carte) */
  mapBox: Box | null
  /** Marge intérieure du cadrage du tracé (fraction) */
  pad?: number
}

export interface PosterTemplate<L extends TemplateLayout = TemplateLayout> extends TemplateMeta {
  layout(i: TemplateInput): L
  /** Dessin au-dessus de la carte */
  render(i: TemplateInput, l: L, proj: Projection): ReactNode
}

export const defineTemplate = <L extends TemplateLayout>(t: PosterTemplate<L>) => t as unknown as PosterTemplate

/** Toute la zone, fond perdu compris */
export const fullBleed = (i: TemplateInput): Box => ({ x: -i.bleed, y: -i.bleed, w: i.W + 2 * i.bleed, h: i.H + 2 * i.bleed })
