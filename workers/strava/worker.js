// Relais Strava de Printrace (Cloudflare Worker).
//
// Printrace est un site statique : il ne peut pas appeler l'API Strava seul
// (secret d'application, CORS). Ce relais fait le lien :
//   GET /auth?redirect=URL         -> autorisation Strava (OAuth), puis retour sur URL
//   GET /callback                  -> échange du code, ouverture d'une session
//   GET /activities/:id/gpx        -> GPX d'une activité (flux latlng / altitude / heure)
//   GET /routes/:id/gpx            -> GPX d'un itinéraire Strava
// La session est un identifiant opaque envoyé par Printrace dans l'en-tête
// Authorization (pas de cookie tiers, bloqués par Safari). Les jetons Strava
// restent dans KV, jamais dans le navigateur.
//
// Variables : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET (secret), ALLOWED_ORIGINS
// (ex. « https://kevincdnc.github.io »), KV : SESSIONS. Voir README.md.

const STRAVA = 'https://www.strava.com';
const SESSION_TTL = 60 * 60 * 24 * 60; // 60 jours

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' }
      : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/auth') return auth(url, env, allowed);
      if (url.pathname === '/callback') return callback(url, env, allowed);
      const m = url.pathname.match(/^\/(activities|routes)\/(\d+)\/gpx$/);
      if (m) return await gpx(req, env, m[1], m[2], cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      return json({ error: 'server', message: String(e && e.message || e) }, 502, cors);
    }
  },
};

// ---------------------------------------------------------------- OAuth
function safeRedirect(target, allowed) {
  try { const u = new URL(target); return allowed.includes(u.origin) ? u.toString() : null; } catch (e) { return null; }
}
function auth(url, env, allowed) {
  const back = safeRedirect(url.searchParams.get('redirect') || '', allowed);
  if (!back) return new Response('Adresse de retour non autorisée', { status: 400 });
  const q = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID, response_type: 'code', approval_prompt: 'auto',
    scope: 'read,activity:read_all', redirect_uri: new URL('/callback', url).toString(), state: back,
  });
  return Response.redirect(`${STRAVA}/oauth/authorize?${q}`, 302);
}
async function callback(url, env, allowed) {
  const back = safeRedirect(url.searchParams.get('state') || '', allowed);
  if (!back) return new Response('Adresse de retour non autorisée', { status: 400 });
  const code = url.searchParams.get('code');
  if (!code) return Response.redirect(back, 302); // autorisation refusée : retour simple
  const tok = await token(env, { code, grant_type: 'authorization_code' });
  const sid = crypto.randomUUID().replace(/-/g, '');
  await env.SESSIONS.put(sid, JSON.stringify(pick(tok)), { expirationTtl: SESSION_TTL });
  // La session revient à Printrace dans le fragment (#…&ss=…), jamais envoyé aux serveurs
  return Response.redirect(back + (back.includes('#') ? '&' : '#') + 'ss=' + sid, 302);
}
async function token(env, body) {
  const res = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...body }),
  });
  if (!res.ok) throw new Error('Échange de jeton Strava refusé');
  return res.json();
}
const pick = (t) => ({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at });

// Jeton valide pour la session (rafraîchi si besoin)
async function session(req, env) {
  const sid = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!sid) return null;
  const raw = await env.SESSIONS.get(sid);
  if (!raw) return null;
  let s = JSON.parse(raw);
  if (s.expires_at * 1000 < Date.now() + 60000) {
    s = pick(await token(env, { grant_type: 'refresh_token', refresh_token: s.refresh_token }));
    await env.SESSIONS.put(sid, JSON.stringify(s), { expirationTtl: SESSION_TTL });
  }
  return s.access_token;
}

// ---------------------------------------------------------------- GPX
async function gpx(req, env, kind, id, cors) {
  const at = await session(req, env);
  if (!at) return json({ error: 'auth_required' }, 401, cors);
  const api = (path) => fetch(`${STRAVA}/api/v3${path}`, { headers: { Authorization: `Bearer ${at}` } });
  const fail = (res) => json({ error: res.status === 404 ? 'not_found' : 'strava', status: res.status }, res.status === 404 || res.status === 403 ? 404 : 502, cors);
  const gpxHeaders = { ...cors, 'Content-Type': 'application/gpx+xml; charset=utf-8', 'Cache-Control': 'private, max-age=300' };

  if (kind === 'routes') {
    const res = await api(`/routes/${id}/export_gpx`);
    return res.ok ? new Response(res.body, { headers: gpxHeaders }) : fail(res);
  }
  const [aRes, sRes] = await Promise.all([api(`/activities/${id}`), api(`/activities/${id}/streams?keys=latlng,altitude,time&key_by_type=true`)]);
  if (!aRes.ok) return fail(aRes);
  if (!sRes.ok) return fail(sRes);
  const act = await aRes.json(), st = await sRes.json();
  const ll = (st.latlng && st.latlng.data) || [];
  if (ll.length < 2) return json({ error: 'no_gps' }, 422, cors);
  const alt = (st.altitude && st.altitude.data) || [], time = (st.time && st.time.data) || [];
  const t0 = Date.parse(act.start_date);
  const esc = (s) => String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const pts = ll.map(([la, lo], i) => {
    const ele = alt[i] != null ? `<ele>${alt[i]}</ele>` : '';
    const tm = time[i] != null && !isNaN(t0) ? `<time>${new Date(t0 + time[i] * 1000).toISOString()}</time>` : '';
    return `<trkpt lat="${la}" lon="${lo}">${ele}${tm}</trkpt>`;
  }).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Printrace (Strava)" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${esc(act.name)}</name>${isNaN(t0) ? '' : `<time>${new Date(t0).toISOString()}</time>`}</metadata>
<trk><name>${esc(act.name)}</name><type>${esc(act.sport_type || act.type)}</type><trkseg>${pts}</trkseg></trk>
</gpx>`;
  return new Response(body, { headers: gpxHeaders });
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
