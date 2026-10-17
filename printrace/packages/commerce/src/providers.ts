// Interfaces des prestataires. Paiement et fabrication sont séparés : on peut
// encaisser avec Stripe et imprimer chez Gelato, ou tout passer par Shopify,
// sans changer le reste de l'application.
import type { Address, Order } from './orders.ts'

export interface CheckoutSession {
  sessionId: string
  /** page de paiement hébergée par le prestataire */
  url: string
}

export type PaymentEvent =
  | { type: 'paid'; orderId: string; paymentId: string; email: string | null; shippingAddress: Address | null; amountTotal: number }
  | { type: 'expired'; orderId: string }
  | { type: 'refunded'; paymentId: string }
  | { type: 'ignored' }

export interface PaymentProvider {
  readonly name: string
  createCheckout(order: Order, urls: { success: string; cancel: string }): Promise<CheckoutSession>
  /** Vérifie la signature puis traduit l'événement ; lève une erreur si la signature est invalide */
  parseWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<PaymentEvent>
}

export type FulfillmentEvent =
  | { type: 'in_production'; externalId: string }
  | { type: 'shipped'; externalId: string; trackingUrl?: string }
  | { type: 'delivered'; externalId: string }
  | { type: 'failed'; externalId: string; reason: string }
  | { type: 'ignored' }

export interface FulfillmentProvider {
  readonly name: string
  /** Transmet la commande ; `fileUrl` = URL signée du PDF imprimeur */
  submit(order: Order, fileUrl: string): Promise<{ externalId: string }>
  parseWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<FulfillmentEvent>
}
