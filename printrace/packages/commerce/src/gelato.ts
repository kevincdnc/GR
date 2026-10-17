// Fabrication et expédition par Gelato (réseau d'imprimeurs dans 30+ pays :
// production proche du client, cadres disponibles). À valider avec la
// documentation et un compte de test Gelato avant mise en production.
import { timingSafeEqual } from 'node:crypto'
import type { Order } from './orders.ts'
import type { FulfillmentEvent, FulfillmentProvider } from './providers.ts'

export class GelatoFulfillment implements FulfillmentProvider {
  readonly name = 'gelato'
  constructor(private apiKey: string, private webhookToken: string, private endpoint = 'https://order.gelatoapis.com/v4/orders') {}

  async submit(order: Order, fileUrl: string) {
    const sku = order.product.sku.gelato
    if (!sku) throw new Error(`Pas de référence Gelato pour ${order.product.id}`)
    const a = order.shippingAddress
    if (!a) throw new Error('Adresse de livraison manquante')
    const [firstName, ...rest] = a.name.split(' ')
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        orderType: 'order',
        orderReferenceId: order.id,
        customerReferenceId: order.userId ?? order.email ?? order.id,
        currency: order.currency,
        items: [{ itemReferenceId: `${order.id}-1`, productUid: sku, files: [{ type: 'default', url: fileUrl }], quantity: order.quantity }],
        shippingAddress: { firstName, lastName: rest.join(' ') || firstName, addressLine1: a.line1, addressLine2: a.line2, city: a.city, postCode: a.postalCode, country: a.country, email: order.email, phone: a.phone },
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Gelato : ${data.message ?? res.status}`)
    return { externalId: data.id as string }
  }

  async parseWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<FulfillmentEvent> {
    const token = String(headers['x-printrace-token'] ?? '')
    if (token.length !== this.webhookToken.length || !timingSafeEqual(Buffer.from(token), Buffer.from(this.webhookToken))) throw new Error('Jeton webhook invalide')
    const evt = JSON.parse(rawBody)
    const externalId = evt.orderId as string
    switch (evt.fulfillmentStatus) {
      case 'printed':
      case 'in_production':
        return { type: 'in_production', externalId }
      case 'shipped':
        return { type: 'shipped', externalId, trackingUrl: evt.items?.[0]?.fulfillments?.[0]?.trackingUrl }
      case 'delivered':
        return { type: 'delivered', externalId }
      case 'canceled':
      case 'failed':
        return { type: 'failed', externalId, reason: evt.comment ?? evt.fulfillmentStatus }
      default:
        return { type: 'ignored' }
    }
  }
}

/** Sans imprimeur branché : la commande attend un traitement manuel (back-office). */
export class ManualFulfillment implements FulfillmentProvider {
  readonly name = 'manual'
  async submit(order: Order) {
    console.info(`[commande ${order.id}] à imprimer manuellement : ${order.product.name}`)
    return { externalId: `manual-${order.id}` }
  }
  async parseWebhook(): Promise<FulfillmentEvent> {
    return { type: 'ignored' }
  }
}
