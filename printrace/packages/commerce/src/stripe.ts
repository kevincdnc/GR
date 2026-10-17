// Paiement Stripe Checkout (page hébergée : CB, Apple Pay, Google Pay, PayPal
// selon l'activation ; adresse de livraison et e-mail collectés par Stripe).
// API REST appelée directement : pas de SDK, pas de données carte chez nous.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Address, Order } from './orders.ts'
import type { CheckoutSession, PaymentEvent, PaymentProvider } from './providers.ts'

const SHIP_COUNTRIES = ['FR', 'BE', 'CH', 'LU', 'DE', 'ES', 'IT', 'NL', 'PT', 'AT', 'GB', 'IE', 'US', 'CA']

function form(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v == null) continue
    if (typeof v === 'object') form(v as Record<string, unknown>, key, out)
    else out.append(key, String(v))
  }
  return out
}

export class StripePayments implements PaymentProvider {
  readonly name = 'stripe'
  constructor(private secretKey: string, private webhookSecret: string) {}

  async createCheckout(order: Order, urls: { success: string; cancel: string }): Promise<CheckoutSession> {
    const physical = order.product.kind !== 'digital'
    const body = form({
      mode: 'payment',
      client_reference_id: order.id,
      success_url: urls.success,
      cancel_url: urls.cancel,
      customer_email: order.email ?? undefined,
      line_items: [{ quantity: order.quantity, price_data: { currency: order.currency.toLowerCase(), unit_amount: order.product.price, product_data: { name: `${order.product.name} — ${order.spec.text.title}`.slice(0, 250) } } }],
      shipping_address_collection: physical ? { allowed_countries: SHIP_COUNTRIES } : undefined,
      phone_number_collection: physical ? { enabled: true } : undefined,
      automatic_tax: { enabled: true },
      metadata: { orderId: order.id },
      payment_intent_data: { metadata: { orderId: order.id } },
    })
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.secretKey}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': `checkout-${order.id}` },
      body,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Stripe : ${data.error?.message ?? res.status}`)
    return { sessionId: data.id, url: data.url }
  }

  /** Vérification de l'en-tête Stripe-Signature (HMAC-SHA256, tolérance 5 min). */
  verify(rawBody: string, header: string | undefined, now = Date.now()) {
    const parts = Object.fromEntries((header ?? '').split(',').map((kv) => kv.split('=') as [string, string]))
    const t = Number(parts.t)
    const sigs = (header ?? '').split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
    if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) throw new Error('Signature Stripe invalide')
    const expected = createHmac('sha256', this.webhookSecret).update(`${t}.${rawBody}`).digest()
    if (!sigs.some((s) => s.length === expected.length * 2 && timingSafeEqual(Buffer.from(s, 'hex'), expected))) throw new Error('Signature Stripe invalide')
  }

  async parseWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<PaymentEvent> {
    this.verify(rawBody, headers['stripe-signature'] as string | undefined)
    const evt = JSON.parse(rawBody)
    const obj = evt.data?.object ?? {}
    if (evt.type === 'charge.refunded') return obj.refunded && obj.payment_intent ? { type: 'refunded', paymentId: obj.payment_intent } : { type: 'ignored' }
    const orderId: string | undefined = obj.metadata?.orderId ?? obj.client_reference_id
    if (!orderId) return { type: 'ignored' }
    switch (evt.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        if (obj.payment_status !== 'paid') return { type: 'ignored' }
        const s = obj.collected_information?.shipping_details ?? obj.shipping_details
        const address: Address | null = s?.address
          ? { name: s.name, line1: s.address.line1, line2: s.address.line2 ?? undefined, postalCode: s.address.postal_code, city: s.address.city, country: s.address.country, phone: obj.customer_details?.phone ?? undefined }
          : null
        return { type: 'paid', orderId, paymentId: obj.payment_intent, email: obj.customer_details?.email ?? null, shippingAddress: address, amountTotal: obj.amount_total }
      }
      case 'checkout.session.expired':
        return { type: 'expired', orderId }
      default:
        return { type: 'ignored' }
    }
  }
}
