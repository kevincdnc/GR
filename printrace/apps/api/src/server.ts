import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { CommerceService, GelatoFulfillment, ManualFulfillment, MemoryOrderRepository, StripePayments } from '@printrace/commerce'
import { type FileStorage, LocalStorage, MemoryExportQueue, renderPoster } from '@printrace/render'
import Fastify from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { ZodError } from 'zod'
import { config } from './config.ts'
import { DesignStore } from './designs.ts'
import { commerceRoutes } from './routes/commerce.ts'
import { exportRoutes } from './routes/exports.ts'
import { stravaRoutes } from './routes/strava.ts'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: 20 * 1024 * 1024 })
await app.register(cookie, { secret: config.cookieSecret })

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ message: 'Requête invalide', issues: err.issues.slice(0, 5) })
  const e = err as Error & { statusCode?: number }
  const status = e.statusCode ?? 500
  if (status >= 500) app.log.error(e)
  return reply.code(status).send({ message: status >= 500 ? 'Erreur serveur' : e.message })
})

// --- Stockage et exports
const storage: FileStorage = new LocalStorage(config.exportDir)
const queue = new MemoryExportQueue(storage, config.exportConcurrency)

// URL signées temporaires (téléchargement client, récupération par l'imprimeur)
const sign = (key: string, exp: number) => createHmac('sha256', config.cookieSecret).update(`${key}:${exp}`).digest('hex')
const fileUrl = async (key: string, ttlS = 7 * 24 * 3600) => {
  const exp = Math.floor(Date.now() / 1000) + ttlS
  return `${config.publicUrl}/api/files/${encodeURIComponent(key)}?exp=${exp}&sig=${sign(key, exp)}`
}
app.get('/api/files/:key', async (req, reply) => {
  const { key } = req.params as { key: string }
  const { exp, sig } = req.query as { exp?: string; sig?: string }
  const good = exp && sig && Number(exp) > Date.now() / 1000 && sig.length === 64 && timingSafeEqual(Buffer.from(sig), Buffer.from(sign(key, Number(exp))))
  if (!good) return reply.code(403).send({ message: 'Lien expiré' })
  return reply.header('content-type', key.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream').send(Buffer.from(await storage.get(key)))
})

// --- Commerce (actif seulement si Stripe est configuré)
const repo = new MemoryOrderRepository()
const designs = new DesignStore()
const payments = config.stripe.secretKey ? new StripePayments(config.stripe.secretKey, config.stripe.webhookSecret) : null
const fulfillment = config.gelato.apiKey ? new GelatoFulfillment(config.gelato.apiKey, config.gelato.webhookToken) : new ManualFulfillment()
const service = payments
  ? new CommerceService({
      repo,
      payments,
      fulfillment,
      publicUrl: config.publicUrl,
      fileUrl,
      renderPrintFile: async (order) => {
        const design = await designs.get(order.designId)
        if (!design) throw new Error('Design introuvable')
        const r = await renderPoster({ activity: design.activity, spec: order.spec, format: 'pdf', pageUrl: config.renderPageUrl })
        const key = `orders/${order.id}/${r.fileName}`
        await storage.put(key, r.data, r.mime)
        return key
      },
    })
  : null

app.get('/api/orders/:id/file', async (req, reply) => {
  const o = await repo.get((req.params as { id: string }).id)
  if (!o?.printFileKey || o.product.kind !== 'digital') return reply.code(404).send({ message: 'Fichier indisponible' })
  return reply.redirect(await fileUrl(o.printFileKey, 3600))
})

await app.register(stravaRoutes)
await app.register(exportRoutes, { queue, storage })
await app.register(commerceRoutes, { service, payments, fulfillment, repo, designs })
app.get('/api/health', async () => ({ ok: true, strava: !!config.strava.clientId, payments: !!payments, fulfillment: fulfillment.name }))

// --- Front (build Vite) : éditeur + page d'impression
if (existsSync(config.webDist)) {
  await app.register(fastifyStatic, { root: config.webDist })
  app.setNotFoundHandler((req, reply) => (req.url.startsWith('/api/') ? reply.code(404).send({ message: 'Introuvable' }) : reply.sendFile('index.html')))
}

await app.listen({ port: config.port, host: process.env.HOST ?? '0.0.0.0' })
