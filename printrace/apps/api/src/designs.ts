import type { Activity } from '@printrace/core'
import type { PosterSpec } from '@printrace/poster/model'
import { randomUUID } from 'node:crypto'

/** Un poster enregistré (spec + activité). Production : table `designs`. */
export interface Design {
  id: string
  userId: string | null
  activity: Activity
  spec: PosterSpec
  createdAt: number
}

export class DesignStore {
  private items = new Map<string, Design>()
  async create(d: Omit<Design, 'id' | 'createdAt'>): Promise<Design> {
    const design = { ...d, id: `dsg_${randomUUID().replace(/-/g, '').slice(0, 20)}`, createdAt: Date.now() }
    this.items.set(design.id, design)
    return design
  }
  async get(id: string) {
    return this.items.get(id) ?? null
  }
}
