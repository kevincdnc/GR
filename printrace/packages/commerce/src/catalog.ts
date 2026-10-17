// Catalogue : ce que l'on vend. Un produit = un type de livrable × un format.
// Les prix sont en centimes, TTC, et restent à fixer (valeurs provisoires).
// Les références imprimeur (SKU) relient chaque produit au catalogue du
// prestataire d'impression (Gelato, Prodigi…).
import { PAPER_SIZES, type PaperSizeId } from '@printrace/poster/model'

export type ProductKind = 'digital' | 'print' | 'framed'

export interface Product {
  id: string
  kind: ProductKind
  size: PaperSizeId | null
  name: string
  description: string
  /** centimes TTC */
  price: number
  currency: 'EUR'
  /** référence produit chez l'imprimeur, par prestataire */
  sku: Partial<Record<'gelato' | 'prodigi', string>>
}

// PROVISOIRE : prix et SKU à valider avec le prestataire retenu
const PRINT_PRICES: Partial<Record<PaperSizeId, [print: number, framed: number]>> = {
  a4: [2900, 6900],
  a3: [3900, 8900],
  '30x40': [4200, 9500],
  a2: [5900, 12900],
  '50x70': [7900, 16900],
  '50x50': [6900, 14900],
}

export const CATALOG: Product[] = [
  {
    id: 'digital-hd',
    kind: 'digital',
    size: null,
    name: 'Fichiers HD',
    description: 'PDF imprimeur vectoriel + PNG 300 dpi, tous formats',
    price: 990,
    currency: 'EUR',
    sku: {},
  },
  ...Object.entries(PRINT_PRICES).flatMap(([size, [print, framed]]) => {
    const p = PAPER_SIZES[size as PaperSizeId]
    return [
      { id: `print-${size}`, kind: 'print', size, name: `Tirage ${p.name}`, description: 'Papier fine art mat 200 g/m², encres pigmentaires', price: print, currency: 'EUR', sku: {} },
      { id: `framed-${size}`, kind: 'framed', size, name: `Tirage encadré ${p.name}`, description: 'Cadre bois, verre acrylique, prêt à accrocher', price: framed, currency: 'EUR', sku: {} },
    ] as Product[]
  }),
]

export const getProduct = (id: string) => CATALOG.find((p) => p.id === id)
