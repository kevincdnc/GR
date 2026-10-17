import type { Activity } from '@printrace/core'

/**
 * Build « démo » (npm run build:demo) : l'éditeur seul, sans serveur.
 * Exports HD, import Strava et paiement y sont remplacés par un message.
 */
export const DEMO = import.meta.env.VITE_DEMO === 'true'
export const DEMO_NOTE = 'Aperçu sans serveur : l’export HD, l’import Strava et la commande fonctionnent dans l’app complète.'

// Activité d'exemple précalculée par scripts/build-demo.ts (le GPX brut pèse 2 Mo)
const bundled = import.meta.glob<{ default: Activity }>('../demo/*.json')

export async function demoSample(): Promise<Activity | null> {
  const load = Object.values(bundled)[0]
  return load ? (await load()).default : null
}
