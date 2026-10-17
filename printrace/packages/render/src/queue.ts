// File d'exports en mémoire, à concurrence limitée (un rendu 300 dpi coûte
// ~1 cœur et 1 à 2 Go). Même interface qu'une file Redis/BullMQ : on pourra
// remplacer l'implémentation sans toucher à l'API.
import { randomUUID } from 'node:crypto'
import type { RenderRequest, RenderResult } from './renderPoster.ts'
import { renderPoster } from './renderPoster.ts'
import type { FileStorage } from './storage.ts'

export type ExportStatus = 'queued' | 'rendering' | 'done' | 'failed'

export interface ExportJob {
  id: string
  status: ExportStatus
  createdAt: number
  error?: string
  file?: { key: string; mime: string; fileName: string; bytes: number }
  mapOk?: boolean
}

export interface ExportQueue {
  enqueue(req: RenderRequest): ExportJob
  get(id: string): ExportJob | undefined
}

export class MemoryExportQueue implements ExportQueue {
  private jobs = new Map<string, ExportJob>()
  private pending: { job: ExportJob; req: RenderRequest }[] = []
  private running = 0

  constructor(
    private storage: FileStorage,
    private concurrency = 2,
    private render: (r: RenderRequest) => Promise<RenderResult> = renderPoster,
  ) {}

  enqueue(req: RenderRequest): ExportJob {
    const job: ExportJob = { id: randomUUID(), status: 'queued', createdAt: Date.now() }
    this.jobs.set(job.id, job)
    this.pending.push({ job, req })
    this.pump()
    return job
  }

  get(id: string) {
    return this.jobs.get(id)
  }

  private pump() {
    while (this.running < this.concurrency && this.pending.length) {
      const { job, req } = this.pending.shift()!
      this.running++
      job.status = 'rendering'
      this.render(req)
        .then(async (r) => {
          const key = `exports/${job.id}/${r.fileName}`
          await this.storage.put(key, r.data, r.mime)
          job.file = { key, mime: r.mime, fileName: r.fileName, bytes: r.data.byteLength }
          job.mapOk = r.mapOk
          job.status = 'done'
        })
        .catch((e) => {
          job.status = 'failed'
          job.error = e instanceof Error ? e.message : String(e)
        })
        .finally(() => {
          this.running--
          this.pump()
        })
    }
  }
}
