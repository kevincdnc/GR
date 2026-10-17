import type { Order } from './orders.ts'

/** Persistance des commandes. Production : PostgreSQL (voir docs/data-model.sql). */
export interface OrderRepository {
  insert(order: Order): Promise<void>
  update(order: Order): Promise<void>
  get(id: string): Promise<Order | null>
  findByPaymentId(paymentId: string): Promise<Order | null>
  findByFulfillmentId(externalId: string): Promise<Order | null>
  listByUser(userId: string): Promise<Order[]>
}

export class MemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, Order>()
  async insert(o: Order) {
    this.orders.set(o.id, o)
  }
  async update(o: Order) {
    this.orders.set(o.id, o)
  }
  async get(id: string) {
    return this.orders.get(id) ?? null
  }
  async findByPaymentId(id: string) {
    return [...this.orders.values()].find((o) => o.payment?.paymentId === id) ?? null
  }
  async findByFulfillmentId(id: string) {
    return [...this.orders.values()].find((o) => o.fulfillment?.externalId === id) ?? null
  }
  async listByUser(userId: string) {
    return [...this.orders.values()].filter((o) => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
  }
}
