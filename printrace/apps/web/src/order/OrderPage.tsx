import { useEffect, useState } from 'react'
import { Logo } from '../landing/Landing.tsx'

interface OrderView {
  id: string
  status: string
  product: string
  title: string
  amountTotal: number
  currency: string
  trackingUrl: string | null
  events: { at: number; status: string }[]
  download: string | null
}

const STEPS = [
  { id: 'paid', label: 'Paiement confirmé' },
  { id: 'ready', label: 'Fichier d’impression prêt' },
  { id: 'submitted', label: 'Transmis à l’atelier' },
  { id: 'in_production', label: 'En fabrication' },
  { id: 'shipped', label: 'Expédié' },
  { id: 'delivered', label: 'Livré' },
]
const ORDER = ['awaiting_payment', 'paid', 'rendering', 'ready', 'submitted', 'in_production', 'shipped', 'delivered']

/** Suivi de commande (page de retour après paiement, lien des e-mails). */
export function OrderPage({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const res = await fetch(`/api/orders/${id}`)
        if (!res.ok) throw new Error(res.status === 404 ? 'Commande introuvable.' : 'Suivi indisponible.')
        const o: OrderView = await res.json()
        if (stop) return
        setOrder(o)
        // le webhook de paiement peut arriver quelques secondes après le retour
        if (!['shipped', 'delivered', 'cancelled', 'refunded'].includes(o.status) && !(o.download && o.status === 'ready')) setTimeout(load, 4000)
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    return () => {
      stop = true
    }
  }, [id])

  const reached = (s: string) => order && ORDER.indexOf(order.status) >= ORDER.indexOf(s)
  const steps = order?.download ? STEPS.slice(0, 2) : STEPS
  return (
    <main className="landing">
      <header className="landing-top">
        <a href="/" className="logo-link"><Logo /></a>
      </header>
      {error && <p className="status is-error">{error}</p>}
      {!order && !error && <p className="status">Chargement…</p>}
      {order && (
        <section className="import-card">
          <h1 className="order-title">{order.status === 'awaiting_payment' ? 'Confirmation du paiement…' : 'Merci pour votre commande'}</h1>
          <p className="status">
            {order.product} · « {order.title} » · {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: order.currency }).format(order.amountTotal / 100)}
          </p>
          {['cancelled', 'refunded', 'failed'].includes(order.status) ? (
            <p className="status is-error">
              {order.status === 'failed' ? 'Un incident est survenu : notre équipe s’en occupe et vous recontacte.' : order.status === 'refunded' ? 'Commande remboursée.' : 'Commande annulée.'}
            </p>
          ) : (
            <ol className="timeline">
              {steps.map((s) => (
                <li key={s.id} className={reached(s.id) ? 'is-done' : ''}>{s.label}</li>
              ))}
            </ol>
          )}
          {order.download && order.status === 'ready' && <a className="btn btn-primary" href={order.download}>Télécharger mes fichiers</a>}
          {order.trackingUrl && <a className="btn" href={order.trackingUrl} target="_blank" rel="noreferrer">Suivre le colis</a>}
          <p className="fineprint">Référence {order.id}</p>
        </section>
      )}
    </main>
  )
}
