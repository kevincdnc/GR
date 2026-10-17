// Commandes : modèle et cycle de vie. Toute transition passe par `transition`,
// qui refuse les changements d'état incohérents (ex. expédier une commande impayée).
import type { PosterSpec } from '@printrace/poster/model'
import type { Product } from './catalog.ts'

export type OrderStatus =
  | 'awaiting_payment' // session de paiement créée
  | 'paid' // paiement confirmé par webhook (jamais par le navigateur)
  | 'rendering' // génération du fichier d'impression
  | 'ready' // fichier prêt (produit numérique : terminé ici)
  | 'submitted' // transmise à l'imprimeur
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled' // paiement abandonné / expiré
  | 'refunded'
  | 'failed' // erreur de rendu ou refus imprimeur : intervention requise

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['rendering', 'refunded', 'failed'],
  rendering: ['ready', 'failed'],
  ready: ['submitted', 'refunded'],
  submitted: ['in_production', 'shipped', 'failed', 'cancelled'],
  in_production: ['shipped', 'failed'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
  failed: ['rendering', 'submitted', 'refunded'],
}

export interface Address {
  name: string
  line1: string
  line2?: string
  postalCode: string
  city: string
  country: string // ISO 3166-1 alpha-2
  phone?: string
}

export interface OrderEvent {
  at: number
  status: OrderStatus
  note?: string
}

export interface Order {
  id: string
  /** null : achat sans compte (rattaché ensuite par e-mail) */
  userId: string | null
  email: string | null
  /** Le poster acheté est figé : spec + activité au moment du paiement */
  designId: string
  spec: PosterSpec
  product: Pick<Product, 'id' | 'kind' | 'size' | 'name' | 'price' | 'currency' | 'sku'>
  quantity: number
  amountTotal: number
  currency: string
  status: OrderStatus
  shippingAddress: Address | null
  payment: { provider: string; sessionId?: string; paymentId?: string } | null
  fulfillment: { provider: string; externalId?: string; trackingUrl?: string } | null
  /** Clé du fichier d'impression dans le stockage */
  printFileKey: string | null
  events: OrderEvent[]
  createdAt: number
  updatedAt: number
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return NEXT[from].includes(to)
}

export function transition(order: Order, to: OrderStatus, note?: string): Order {
  if (order.status === to) return order // webhooks rejoués : idempotent
  if (!canTransition(order.status, to)) throw new Error(`Transition refusée : ${order.status} → ${to}`)
  const at = Date.now()
  return { ...order, status: to, updatedAt: at, events: [...order.events, { at, status: to, note }] }
}
