import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../config.ts'
import { authorizeUrl, exchangeCode, fetchActivity, freshTokens, resolveActivityId, type StravaTokens } from '../strava/client.ts'

// Jetons par session navigateur. Production : table `oauth_accounts` (chiffrés), liée au compte.
const sessions = new Map<string, StravaTokens>()
const COOKIE = 'pt_sid'

export async function stravaRoutes(app: FastifyInstance) {
  const enabled = () => !!(config.strava.clientId && config.strava.clientSecret)
  const sid = (req: { cookies: Record<string, string | undefined>; unsignCookie: (v: string) => { valid: boolean; value: string | null } }) => {
    const raw = req.cookies[COOKIE]
    const u = raw ? req.unsignCookie(raw) : null
    return u?.valid ? u.value : null
  }

  app.get('/api/strava/connect', async (req, reply) => {
    if (!enabled()) return reply.code(503).send({ message: 'Import Strava non configuré sur ce serveur.' })
    const state = randomUUID()
    reply.setCookie('pt_oauth_state', state, { path: '/api/strava', httpOnly: true, sameSite: 'lax', secure: config.publicUrl.startsWith('https'), signed: true, maxAge: 600 })
    return reply.redirect(authorizeUrl(config.strava.clientId, `${config.publicUrl}/api/strava/callback`, state))
  })

  app.get('/api/strava/callback', async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string }
    const st = req.cookies.pt_oauth_state ? req.unsignCookie(req.cookies.pt_oauth_state) : null
    if (q.error || !q.code || !st?.valid || st.value !== q.state) return reply.redirect(`${config.publicUrl}/?strava=denied`)
    const tokens = await exchangeCode(config.strava.clientId, config.strava.clientSecret, q.code)
    const id = sid(req) ?? randomUUID()
    sessions.set(id, tokens)
    reply.setCookie(COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.publicUrl.startsWith('https'), signed: true, maxAge: 60 * 60 * 24 * 30 })
    return reply.redirect(`${config.publicUrl}/?strava=connected`)
  })

  app.post('/api/strava/activity', async (req, reply) => {
    if (!enabled()) return reply.code(503).send({ message: 'Import Strava pas encore disponible : exportez le GPX depuis Strava (⋯ → Exporter GPX) et déposez-le ici.' })
    const { url } = z.object({ url: z.string().url().max(500) }).parse(req.body)
    const id = sid(req)
    const tokens = id ? sessions.get(id) : undefined
    if (!id || !tokens) return reply.code(401).send({ connectUrl: '/api/strava/connect' })
    const fresh = await freshTokens(tokens, config.strava.clientId, config.strava.clientSecret)
    sessions.set(id, fresh)
    return fetchActivity(await resolveActivityId(url), fresh.accessToken)
  })
}
