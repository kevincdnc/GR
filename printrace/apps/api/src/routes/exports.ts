import { parseSpec } from '@printrace/poster/model'
import type { ExportQueue, FileStorage } from '@printrace/render'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../config.ts'
import { ActivitySchema } from '../schemas.ts'

const Body = z.object({ activity: ActivitySchema, spec: z.unknown(), format: z.enum(['pdf', 'png']) })

export async function exportRoutes(app: FastifyInstance, { queue, storage }: { queue: ExportQueue; storage: FileStorage }) {
  app.post('/api/exports', async (req, reply) => {
    const body = Body.parse(req.body)
    const job = queue.enqueue({ activity: body.activity, spec: parseSpec(body.spec), format: body.format, pageUrl: config.renderPageUrl })
    return reply.code(202).send(job)
  })

  app.get('/api/exports/:id', async (req, reply) => {
    const job = queue.get((req.params as { id: string }).id)
    return job ? { id: job.id, status: job.status, error: job.error, mapOk: job.mapOk } : reply.code(404).send({ message: 'Export inconnu' })
  })

  app.get('/api/exports/:id/file', async (req, reply) => {
    const job = queue.get((req.params as { id: string }).id)
    if (!job?.file) return reply.code(404).send({ message: 'Fichier indisponible' })
    return reply
      .header('content-type', job.file.mime)
      .header('content-disposition', `attachment; filename="${job.file.fileName}"`)
      .send(Buffer.from(await storage.get(job.file.key)))
  })
}
