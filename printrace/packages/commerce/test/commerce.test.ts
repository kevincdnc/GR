import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createSpec } from '../../poster/src/model.ts'
import { CommerceService, MemoryOrderRepository, StripePayments, type PaymentProvider } from '../src/index.ts'

const activity = { name: 'Test', sport: 'hike', coords: [[48, -4, 0, 0]], stats: { distanceM: 1000, elevationGainM: 0 } } as never
const spec = createSpec(activity)

function setup() {
  const repo = new MemoryOrderRepository()
  const payments: PaymentProvider = {
    name: 'fake',
    createCheckout: async () => ({ sessionId: 'cs_1', url: 'https://pay.example/cs_1' }),
    parseWebhook: async () => ({ type: 'ignored' }),
  }
  const submit = vi.fn(async () => ({ externalId: 'g_1' }))
  const svc = new CommerceService({
    repo,
    payments,
    fulfillment: { name: 'fake', submit, parseWebhook: async () => ({ type: 'ignored' }) },
    renderPrintFile: async (o) => `orders/${o.id}.pdf`,
    fileUrl: async (k) => `https://files.example/${k}`,
    publicUrl: 'https://printrace.example',
  })
  return { repo, svc, submit }
}

describe('commande', () => {
  it('tirage : paiement → rendu → imprimeur → expédition', async () => {
    const { repo, svc, submit } = setup()
    const { order, checkoutUrl } = await svc.checkout({ designId: 'd1', spec, productId: 'print-a2' })
    expect(checkoutUrl).toContain('cs_1')
    expect(order.spec.format.size).toBe('a2')
    await svc.onPayment({ type: 'paid', orderId: order.id, paymentId: 'pi_1', email: 'a@b.c', shippingAddress: null, amountTotal: order.amountTotal })
    await vi.waitFor(async () => expect((await repo.get(order.id))!.status).toBe('submitted'))
    expect(submit).toHaveBeenCalledOnce()
    await svc.onFulfillment({ type: 'shipped', externalId: 'g_1', trackingUrl: 'https://t' })
    const o = (await repo.get(order.id))!
    expect(o.status).toBe('shipped')
    expect(o.events.map((e) => e.status)).toEqual(['awaiting_payment', 'paid', 'rendering', 'ready', 'submitted', 'shipped'])
  })

  it('numérique : s’arrête au fichier prêt, webhook rejoué sans effet', async () => {
    const { repo, svc, submit } = setup()
    const { order } = await svc.checkout({ designId: 'd1', spec, productId: 'digital-hd' })
    const paid = { type: 'paid' as const, orderId: order.id, paymentId: 'pi_2', email: null, shippingAddress: null, amountTotal: 990 }
    await svc.onPayment(paid)
    await vi.waitFor(async () => expect((await repo.get(order.id))!.status).toBe('ready'))
    await svc.onPayment(paid)
    expect((await repo.get(order.id))!.status).toBe('ready')
    expect(submit).not.toHaveBeenCalled()
  })
})

describe('webhook Stripe', () => {
  const stripe = new StripePayments('sk_test', 'whsec_test')
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid', metadata: { orderId: 'ord_1' }, payment_intent: 'pi_9', amount_total: 3900, customer_details: { email: 'x@y.z' } } } })
  const sign = (t: number, b = body) => `t=${t},v1=${createHmac('sha256', 'whsec_test').update(`${t}.${b}`).digest('hex')}`

  it('accepte une signature valide', async () => {
    const evt = await stripe.parseWebhook(body, { 'stripe-signature': sign(Math.floor(Date.now() / 1000)) })
    expect(evt).toMatchObject({ type: 'paid', orderId: 'ord_1', paymentId: 'pi_9' })
  })
  it('refuse un corps modifié ou une signature périmée', async () => {
    const t = Math.floor(Date.now() / 1000)
    await expect(stripe.parseWebhook(body.replace('3900', '1'), { 'stripe-signature': sign(t) })).rejects.toThrow()
    await expect(stripe.parseWebhook(body, { 'stripe-signature': sign(t - 3600) })).rejects.toThrow()
  })
})
