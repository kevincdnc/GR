// Orchestration d'une commande, du clic « Payer » à la livraison :
//
//   checkout ─► Stripe ─(webhook paid)─► rendu PDF 300 dpi ─► stockage
//        ├─ numérique : lien de téléchargement (statut ready)
//        └─ tirage    : envoi à l'imprimeur ─(webhooks)─► production ► expédition ► livraison
//
// Le paiement n'est jamais validé par le navigateur, uniquement par webhook signé.
import { randomUUID } from 'node:crypto'
import type { PosterSpec } from '@printrace/poster/model'
import { getProduct } from './catalog.ts'
import { type Order, transition } from './orders.ts'
import type { FulfillmentEvent, FulfillmentProvider, PaymentEvent, PaymentProvider } from './providers.ts'
import type { OrderRepository } from './repository.ts'

export interface CommerceDeps {
  repo: OrderRepository
  payments: PaymentProvider
  fulfillment: FulfillmentProvider
  /** Génère le PDF imprimeur et renvoie sa clé de stockage */
  renderPrintFile: (order: Order) => Promise<string>
  /** URL signée et temporaire vers un fichier stocké */
  fileUrl: (key: string) => Promise<string>
  publicUrl: string
  /** Notifications client (e-mail transactionnel) */
  notify?: (order: Order, event: Order['status']) => Promise<void>
}

export class CommerceService {
  constructor(private d: CommerceDeps) {}

  async checkout(input: { designId: string; spec: PosterSpec; productId: string; userId?: string | null; email?: string | null }) {
    const product = getProduct(input.productId)
    if (!product) throw new Error('Produit inconnu')
    // un tirage est imprimé au format du produit
    const spec = product.size ? { ...input.spec, format: { ...input.spec.format, size: product.size } } : input.spec
    const now = Date.now()
    let order: Order = {
      id: `ord_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      userId: input.userId ?? null,
      email: input.email ?? null,
      designId: input.designId,
      spec,
      product: { id: product.id, kind: product.kind, size: product.size, name: product.name, price: product.price, currency: product.currency, sku: product.sku },
      quantity: 1,
      amountTotal: product.price,
      currency: product.currency,
      status: 'awaiting_payment',
      shippingAddress: null,
      payment: { provider: this.d.payments.name },
      fulfillment: null,
      printFileKey: null,
      events: [{ at: now, status: 'awaiting_payment' }],
      createdAt: now,
      updatedAt: now,
    }
    const session = await this.d.payments.createCheckout(order, {
      success: `${this.d.publicUrl}/commande/${order.id}?paiement=ok`,
      cancel: `${this.d.publicUrl}/?paiement=annule`,
    })
    order = { ...order, payment: { provider: this.d.payments.name, sessionId: session.sessionId } }
    await this.d.repo.insert(order)
    return { order, checkoutUrl: session.url }
  }

  async onPayment(evt: PaymentEvent) {
    if (evt.type === 'ignored') return
    if (evt.type === 'refunded') {
      const o = await this.d.repo.findByPaymentId(evt.paymentId)
      if (o) await this.save(transition(o, 'refunded'))
      return
    }
    const order = await this.d.repo.get(evt.orderId)
    if (!order) throw new Error(`Commande inconnue : ${evt.orderId}`)
    if (evt.type === 'expired') return void (order.status === 'awaiting_payment' && (await this.save(transition(order, 'cancelled'))))
    if (order.status !== 'awaiting_payment') return // webhook rejoué
    const paid = transition(
      { ...order, email: evt.email ?? order.email, shippingAddress: evt.shippingAddress, amountTotal: evt.amountTotal, payment: { ...order.payment!, paymentId: evt.paymentId } },
      'paid',
    )
    await this.save(paid)
    // la suite est asynchrone : le webhook répond tout de suite à Stripe
    void this.produce(paid)
  }

  /** Rendu puis envoi à l'imprimeur ; relançable depuis le back-office si `failed`. */
  async produce(order: Order) {
    let o = order
    try {
      o = await this.save(transition(o, 'rendering'))
      const key = await this.d.renderPrintFile(o)
      o = await this.save(transition({ ...o, printFileKey: key }, 'ready'))
      if (o.product.kind === 'digital') return o
      const { externalId } = await this.d.fulfillment.submit(o, await this.d.fileUrl(key))
      o = await this.save(transition({ ...o, fulfillment: { provider: this.d.fulfillment.name, externalId } }, 'submitted'))
    } catch (e) {
      o = await this.save(transition(o, 'failed', e instanceof Error ? e.message : String(e)))
    }
    return o
  }

  async onFulfillment(evt: FulfillmentEvent) {
    if (evt.type === 'ignored') return
    const o = await this.d.repo.findByFulfillmentId(evt.externalId)
    if (!o) return
    if (evt.type === 'shipped') await this.save(transition({ ...o, fulfillment: { ...o.fulfillment!, trackingUrl: evt.trackingUrl } }, 'shipped'))
    else if (evt.type === 'failed') await this.save(transition(o, 'failed', evt.reason))
    else await this.save(transition(o, evt.type))
  }

  private async save(o: Order) {
    await this.d.repo.update(o)
    await this.d.notify?.(o, o.status).catch(() => {})
    return o
  }
}
