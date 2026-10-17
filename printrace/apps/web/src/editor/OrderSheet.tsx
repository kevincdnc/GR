import type { Activity } from '@printrace/core'
import { PAPER_SIZES, type PosterSpec } from '@printrace/poster'
import { useEffect, useState } from 'react'
import { startCheckout } from '../lib/api.ts'
import { DEMO } from '../lib/demo.ts'
import { CATALOG } from '@printrace/commerce/catalog'

interface Product {
  id: string
  kind: 'digital' | 'print' | 'framed'
  size: string | null
  name: string
  description: string
  price: number
  currency: string
}

const eur = (cents: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const KINDS = [
  { id: 'framed', name: 'Encadré', hint: 'Prêt à accrocher' },
  { id: 'print', name: 'Tirage seul', hint: 'Papier fine art' },
  { id: 'digital', name: 'Fichiers HD', hint: 'Imprimez où vous voulez' },
] as const

/**
 * Commande : type de produit → format → paiement (page Stripe hébergée).
 * Le compte n'est pas obligatoire : l'e-mail saisi au paiement suffit pour le suivi.
 */
export function OrderSheet({ activity, spec, onClose }: { activity: Activity; spec: PosterSpec; onClose: () => void }) {
  const [catalog, setCatalog] = useState<Product[] | null>(null)
  const [kind, setKind] = useState<Product['kind']>('framed')
  const [size, setSize] = useState<string>(spec.format.size)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (DEMO) return setCatalog(CATALOG)
    fetch('/api/catalog')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Catalogue indisponible'))))
      .then(setCatalog)
      .catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sizes = catalog?.filter((p) => p.kind === kind && p.size).map((p) => p.size!) ?? []
  const product = catalog?.find((p) => p.kind === kind && (kind === 'digital' || p.size === size)) ?? catalog?.find((p) => p.kind === kind)

  const pay = async () => {
    if (!product) return
    setBusy(true)
    setError(null)
    try {
      const { checkoutUrl } = await startCheckout(activity, spec, product.id)
      window.location.href = checkoutUrl
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal aria-labelledby="order-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="order-title">Commander « {spec.text.title || activity.name} »</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <div className="kinds">
          {KINDS.map((k) => {
            const from = catalog?.filter((p) => p.kind === k.id).reduce((m, p) => Math.min(m, p.price), Infinity)
            return (
              <button key={k.id} className={`kind${kind === k.id ? ' is-on' : ''}`} onClick={() => setKind(k.id)}>
                <strong>{k.name}</strong>
                <span>{k.hint}</span>
                {from != null && Number.isFinite(from) && <em>dès {eur(from)}</em>}
              </button>
            )
          })}
        </div>
        {kind !== 'digital' && (
          <div className="seg">
            {sizes.map((s) => (
              <button key={s} className={size === s ? 'is-on' : ''} onClick={() => setSize(s)}>
                {PAPER_SIZES[s as keyof typeof PAPER_SIZES]?.name ?? s}
              </button>
            ))}
          </div>
        )}
        {product && <p className="product-desc">{product.description}</p>}
        <footer>
          <span className="price">{product ? eur(product.price) : '—'}</span>
          <button className="btn btn-primary" disabled={!product || busy} onClick={pay}>
            {busy ? 'Redirection…' : 'Payer'}
          </button>
        </footer>
        <p className="fineprint">Paiement sécurisé par Stripe · livraison suivie · aperçu identique au tirage</p>
        {error && <p className="status is-error">{error}</p>}
      </div>
    </div>
  )
}
