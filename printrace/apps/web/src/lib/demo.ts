/**
 * Build « démo » (npm run build:demo) : l'éditeur seul, sans serveur.
 * Exports HD, import Strava et paiement y sont remplacés par un message.
 */
export const DEMO = import.meta.env.VITE_DEMO === 'true'
export const DEMO_NOTE = 'Aperçu sans serveur : l’export HD, l’import Strava et la commande fonctionnent dans l’app complète.'
