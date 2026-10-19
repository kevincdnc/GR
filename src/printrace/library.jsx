// Printrace — bibliothèque de tracés (enregistrée dans le navigateur) et
// sources d'import : fichiers, lien Strava, envoi depuis Routdoor (#t=…).
//
// Un tracé de la bibliothèque a la forme attendue par le studio poster
// (PosterPane) : { id, name, color, coords, distance, ascent, descent,
// durationMin, durationReal, altMax, activity, date } + { visible, source,
// sourceRef, addedAt }.

const PT_LIB_KEY = 'printrace_library_v1';
const PT_MAX_POINTS = 6000; // au-delà, simplification légère (rendu identique sur un poster)

// Couleurs des nouveaux tracés : la palette de sections de Routdoor
function ptPalette() {
  const keys = window.GR34_SECTION_COLORS || Object.keys(ROUTE_COLORS);
  return keys.map((k) => (ROUTE_COLORS[k] || {}).hex).filter(Boolean);
}
function ptNextColor(lib, i = 0) {
  const pal = ptPalette();
  return pal[(lib.length + i) % pal.length] || '#3b82f6';
}

function ptLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(PT_LIB_KEY) || '[]');
    return Array.isArray(v) ? v.filter((r) => r && r.coords && r.coords.length > 1) : [];
  } catch (e) { return []; }
}
function ptSave(lib) {
  try { localStorage.setItem(PT_LIB_KEY, JSON.stringify(lib)); return true; } catch (e) { return false; }
}

function ptLighten(coords) {
  if (coords.length <= PT_MAX_POINTS || !window.RoutdoorLink) return coords;
  let tol = 2, out = coords;
  for (let k = 0; k < 12 && out.length > PT_MAX_POINTS; k++) { out = window.RoutdoorLink.simplify(coords, tol); tol *= 1.6; }
  return out;
}
function ptAltMax(coords) {
  let m = null;
  coords.forEach((c) => { if (typeof c[2] === 'number' && c[2] !== 0 && (m == null || c[2] > m)) m = c[2]; });
  return m;
}
const ptId = (p) => 'pt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7) + (p || '');

// Fichier lu (readTrackFile) -> tracé de bibliothèque
function ptFromStage(st, fileName, extra = {}) {
  const name = (st.to ? st.from + ' → ' + st.to : st.from) || String(fileName || 'Tracé').replace(/\.[^.]+$/, '');
  const distance = st.distanceKm || 0, ascent = st.elevationGain || 0;
  const real = st.gpxMovingMin != null && st.gpxMovingMin > 0;
  return {
    id: ptId(), name, coords: ptLighten(st.coords), distance, ascent, descent: st.elevationLoss || 0,
    durationMin: real ? st.gpxMovingMin : estimateDurationMin(distance, ascent, 'hiking'), durationReal: real,
    altMax: st.altMax || ptAltMax(st.coords), activity: 'hiking',
    date: st.gpxDate ? st.gpxDate.slice(0, 10) : '', visible: true, source: 'file', sourceRef: fileName || '', addedAt: Date.now(), ...extra,
  };
}
// Partie reçue de Routdoor (lien #t=…) -> tracé de bibliothèque
function ptFromShared(p, o = {}) {
  const coords = p.coords || [];
  const distance = p.distance || 0, ascent = p.ascent || 0;
  return {
    id: ptId(), name: p.name || 'Tracé Routdoor', color: p.color || null, coords, distance, ascent, descent: p.descent || 0,
    durationMin: p.durationMin || estimateDurationMin(distance, ascent, 'hiking'), durationReal: !!p.durationMin,
    altMax: ptAltMax(coords), activity: o.activity || 'hiking', date: p.date || '', visible: true, source: o.source || 'routdoor', sourceRef: o.sourceRef || '', addedAt: Date.now(),
  };
}
// Même tracé déjà présent ? (nom + distance + premier point)
function ptSame(a, b) {
  const p = a.coords[0], q = b.coords[0];
  return a.name === b.name && Math.abs((a.distance || 0) - (b.distance || 0)) < 0.05 && p && q && Math.abs(p[0] - q[0]) < 1e-4 && Math.abs(p[1] - q[1]) < 1e-4;
}

// Libellés courts
const ptKm = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('fr-FR') + ' km';
const ptM = (v) => Math.round(v || 0).toLocaleString('fr-FR') + ' m';
function ptDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------- Strava
// Lien d'activité ou d'itinéraire Strava -> { kind, id }
function ptParseStrava(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  let m = s.match(/strava\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?activities\/(\d+)/i);
  if (m) return { kind: 'activity', id: m[1] };
  m = s.match(/strava\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?routes\/(\d+)/i);
  if (m) return { kind: 'route', id: m[1] };
  if (/strava\.app\.link\//i.test(s)) return { kind: 'short' };
  if (/^\d{6,}$/.test(s)) return { kind: 'activity', id: s };
  return { kind: 'invalid' };
}
const ptStravaUrl = (ref) => `https://www.strava.com/${ref.kind === 'route' ? 'routes' : 'activities'}/${ref.id}`;
const ptStravaExportUrl = (ref) => ptStravaUrl(ref) + '/export_gpx';

// Serveur relais Strava (workers/strava) : récupère le GPX via l'API officielle
// avec la connexion Strava de l'utilisateur. Non configuré = parcours guidé.
const PT_STRAVA_SESSION = 'printrace_strava_session'; // session opaque du relais (pas le jeton Strava)
const ptStravaApi = () => ((window.PRINTRACE_CONFIG || {}).stravaApi || '').replace(/\/+$/, '');
async function ptFetchStravaGpx(ref) {
  const api = ptStravaApi();
  let sid = '';
  try { sid = localStorage.getItem(PT_STRAVA_SESSION) || ''; } catch (e) {}
  const res = await fetch(`${api}/${ref.kind === 'route' ? 'routes' : 'activities'}/${ref.id}/gpx`, { headers: sid ? { Authorization: 'Bearer ' + sid } : {} });
  if (res.status === 401) {
    // Pas encore connecté à Strava : autorisation puis retour ici, l'import reprend
    const back = location.href.split('#')[0] + '#strava=' + ref.kind + ':' + ref.id;
    location.href = `${api}/auth?redirect=${encodeURIComponent(back)}`;
    return null;
  }
  if (!res.ok) throw new Error(res.status === 404 ? 'Activité introuvable ou privée' : 'Strava ne répond pas');
  const blob = await res.blob();
  return new File([blob], `strava-${ref.id}.gpx`, { type: 'application/gpx+xml' });
}

// ---------------------------------------------------------------- Routdoor
// Tracés envoyés par Routdoor (« Envoyer sur Printrace ») ou par le site
// Printrace : lien #t=… (+ a = activité, src = provenance)
async function ptReadInbox() {
  const L = window.RoutdoorLink;
  if (!L) return null;
  const h = L.readHash(location.hash);
  if (!h || !h.data) return null;
  const d = await L.decodeShare(h.data);
  if (!d || !d.parts || !d.parts.length) return null;
  const q = new URLSearchParams(location.hash.replace(/^#/, ''));
  return { ...d, activity: q.get('a') || 'hiking', from: q.get('src') || 'routdoor', source: q.get('from') || '' };
}
// Adresse de Routdoor (même site) pour créer ou modifier un itinéraire
function ptRoutdoorUrl() {
  return window.RoutdoorLink ? window.RoutdoorLink.routdoorBase() : '../../routdoor/';
}

Object.assign(window, {
  PT_LIB_KEY, PT_STRAVA_SESSION, ptLoad, ptSave, ptFromStage, ptFromShared, ptSame, ptNextColor, ptKm, ptM, ptDate,
  ptParseStrava, ptStravaUrl, ptStravaExportUrl, ptStravaApi, ptFetchStravaGpx, ptReadInbox, ptRoutdoorUrl,
});
