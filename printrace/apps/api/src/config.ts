import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../../..')
const port = Number(process.env.PORT ?? 8787)
const webDist = resolve(root, 'apps/web/dist')

export const config = {
  port,
  publicUrl: (process.env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
  cookieSecret: process.env.COOKIE_SECRET ?? 'dev-only-secret-change-me-in-production!!',
  webDist,
  // page d'impression : celle du serveur Vite en dev, sinon celle servie par l'API
  renderPageUrl: process.env.RENDER_PAGE_URL ?? (existsSync(webDist) ? `http://127.0.0.1:${port}/render.html` : 'http://127.0.0.1:5173/render.html'),
  exportDir: resolve(root, process.env.EXPORT_DIR ?? '.exports'),
  exportConcurrency: Number(process.env.EXPORT_CONCURRENCY ?? 2),
  strava: { clientId: process.env.STRAVA_CLIENT_ID ?? '', clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '' },
  stripe: { secretKey: process.env.STRIPE_SECRET_KEY ?? '', webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '' },
  gelato: { apiKey: process.env.GELATO_API_KEY ?? '', webhookToken: process.env.GELATO_WEBHOOK_TOKEN ?? '' },
}
