import type { Activity } from '@printrace/core'
import { type PosterSpec, PosterSpecSchema } from '@printrace/poster'

const KEY = 'printrace:draft:v1'

export interface Draft {
  activity: Activity
  spec: PosterSpec
}

/** Brouillon local (confort) : la source de vérité deviendra le compte utilisateur. */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    return { activity: d.activity, spec: PosterSpecSchema.parse(d.spec) }
  } catch {
    return null
  }
}

export function saveDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d))
    else localStorage.removeItem(KEY)
  } catch {
    /* stockage plein ou bloqué : sans conséquence */
  }
}
