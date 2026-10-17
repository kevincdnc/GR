import { CATALOG, type CommerceService, type FulfillmentProvider, type OrderRepository, type PaymentProvider } from '@printrace/commerce'
import { parseSpec } from '@printrace/poster/model'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { DesignStore } from '../designs.ts'
import { ActivitySchema } from '../schemas.ts'

interface Deps {
  service: CommerceService | null
  payments: PaymentProvider | null
  fulfillment: FulfillmentProvider
  repo: OrderRepository
  designs: DesignStore
}

const Checkout = z.object({ activity: ActivitySchema, spec: z.unknown(), productId: z.string().max(40), email: z.string().email().optional() })

export async function commerceRoutes(app: FastifyInstance, d: Deps) {
  app.get('/api/catalog', async () => CATALOG.map(({ sku: _sku, ...p }) => p))

  app.post('/api/checkout', async (req, reply) => {
    if (!d.service) return reply.code(503).send({ message: 'La commande en ligne ouvre bientôt. En attendant, téléchargez le PDF imprimeur.' })
    const body = Checkout.parse(req.body)
    const spec = parseSpec(body.spec)
    // le poster est figé au moment de la commande : ce qui est payé est ce qui est imprimé
    const design = await d.designs.create({ userId: null, activity: body.activity, spec })
    const { order, checkoutUrl } = await d.service.checkout({ designId: design.id, spec, productId: body.productId, email: body.email })
    return { orderId: order.id, checkoutUrl }
  })

  // Webhooks : corps brut indispensable à la vérification de signature
  app.register(async (hooks) => {
    hooks.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body))
    hooks.post('/api/webhooks/stripe', async (req, reply) => {
      if (!d.service || !d.payments) return reply.code(503).send()
      const evt = await d.payments.parseWebhook(req.body as string, req.headers).catch(() => null)
      if (!evt) return reply.code(400).send({ message: 'signature invalide' })
      await d.service.onPayment(evt)
      return { received: true }
    })
    hooks.post('/api/webhooks/fulfillment', async (req, reply) => {
      if (!d.service) return reply.code(503).send()
      const evt = await d.fulfillment.parseWebhook(req.body as string, req.headers).catch(() => null)
      if (!evt) return reply.code(400).send({ message: 'jeton invalide' })
      await d.service.onFulfillment(evt)
      return { received: true }
    })
  })

  // Suivi public : l'identifiant de commande, non devinable, sert de jeton
  app.get('/api/orders/:id', async (req, reply) => {
    const o = await d.repo.get((req.params as { id: string }).id)
    if (!o) return reply.code(404).send({ message: 'Commande inconnue' })
    return {
      id: o.id,
      status: o.status,
      product: o.product.name,
      title: o.spec.text.title,
      amountTotal: o.amountTotal,
      currency: o.currency,
      trackingUrl: o.fulfillment?.trackingUrl ?? null,
      events: o.events.map(({ at, status }) => ({ at, status })),
      download: o.product.kind === 'digital' && o.printFileKey ? `/api/orders/${o.id}/file` : null,
    }
  })
}
