import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../config.ts'
import { buildActivity, type Activity } from '@printrace/core'
import { fillElevation } from '../strava/elevation.ts'
import { fetchPublicActivity, StravaPrivateError } from '../strava/public.ts'
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

  // 1. activité publique : trace lue sur la page Strava, sans connexion
  // 2. activité privée : API Strava avec l'accord de l'athlète (OAuth), si configurée
  app.post('/api/strava/activity', async (req, reply) => {
    const { url } = z.object({ url: z.string().url().max(500) }).parse(req.body)
    const activityId = await resolveActivityId(url)
    const id = sid(req)
    const tokens = enabled() && id ? sessions.get(id) : undefined
    if (tokens) {
      const fresh = await freshTokens(tokens, config.strava.clientId, config.strava.clientSecret)
      sessions.set(id!, fresh)
      return fetchActivity(activityId, fresh.accessToken)
    }
    try {
      return await importPublicActivity(activityId)
    } catch (e) {
      if (!(e instanceof StravaPrivateError)) throw e
      if (enabled()) return reply.code(401).send({ connectUrl: '/api/strava/connect' })
      return reply.code(422).send({
        message: 'Cette activité est privée sur Strava. Rendez-la visible par « Tout le monde » (Modifier l’activité → Visibilité), ou exportez le GPX (⋯ → Exporter le GPX) et déposez le fichier ici.',
      })
    }
  })
}

async function importPublicActivity(id: string): Promise<Activity> {
  const { track, stats } = await fetchPublicActivity(id)
  const a = buildActivity({ ...track, points: await fillElevation(track.points) }, { id: `strava_${id}`, source: 'strava' })
  // chiffres officiels de Strava quand la page les donne
  if (stats.distanceM) a.stats.distanceM = Math.round(stats.distanceM)
  if (stats.elevationGainM != null) a.stats.elevationGainM = Math.round(stats.elevationGainM)
  if (stats.movingTimeS) a.stats.movingTimeS = stats.movingTimeS
  if (stats.elapsedTimeS) a.stats.elapsedTimeS = stats.elapsedTimeS
  if (stats.startTime) a.stats.startTime = stats.startTime
  return a
}
