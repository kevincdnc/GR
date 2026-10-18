// Seed data + helpers shared across components

// Tailwind palette references (sky/rose/emerald/amber/violet/teal/orange/pink/indigo)
const ROUTE_COLORS = {
  rose:    { name: 'Rose',       hex: '#f43f5e' },
  orange:  { name: 'Orange',     hex: '#f97316' },
  amber:   { name: 'Ambre',      hex: '#f59e0b' },
  lime:    { name: 'Lime',       hex: '#84cc16' },
  emerald: { name: 'Émeraude',   hex: '#10b981' },
  teal:    { name: 'Sarcelle',   hex: '#14b8a6' },
  sky:     { name: 'Ciel',       hex: '#0ea5e9' },
  blue:    { name: 'Bleu',       hex: '#3b82f6' },
  indigo:  { name: 'Indigo',     hex: '#6366f1' },
  violet:  { name: 'Violet',     hex: '#8b5cf6' },
  pink:    { name: 'Rose pâle',  hex: '#ec4899' },
  fuchsia: { name: 'Fuchsia',    hex: '#d946ef' },
};

const ACTIVITIES = {
  hiking:      { label: 'Randonnée',     icon: 'Footprints' },
  trail:       { label: 'Trail',          icon: 'Run' },
  running:     { label: 'Course à pied',  icon: 'Run' },
  cycling:     { label: 'Vélo route',     icon: 'RoadBike' },
  mtb:         { label: 'VTT',            icon: 'MountainBike' },
  gravel:      { label: 'Gravel',         icon: 'MountainBike' },
  skiTouring:  { label: 'Ski de rando',   icon: 'Ski' },
  skiNordic:   { label: 'Ski de fond',    icon: 'Ski' },
  snowshoe:    { label: 'Raquettes',      icon: 'Ski' },
  climbing:    { label: 'Escalade',       icon: 'Mountain' },
  alpinism:    { label: 'Alpinisme',      icon: 'Mountain' },
  kayak:       { label: 'Kayak / SUP',    icon: 'Compass' },
};

// Each route is a hand-tuned SVG polyline in a 1200x800 map viewport.
// They roughly cluster by group to feel like a real region.
const SEED_GROUPS = [];

// GR34 — étapes réelles, calculées au build depuis les fichiers gpx/*.gpx
// (window.GR34_STAGES, cf. scripts/build.mjs). Chaque étape (fichier GPX) devient
// un itinéraire du groupe GR34 ; ses coords portent l'altitude : [lat, lng, ele].
const GR34_SECTION_COLORS = ['rose', 'sky', 'amber', 'emerald', 'violet', 'orange', 'teal', 'pink', 'indigo', 'lime', 'blue', 'fuchsia'];

function buildGr34Groups() {
  const stages = window.GR34_STAGES || [];
  if (!stages.length) return [];
  return [
    {
      id: 'g_gr34',
      name: 'GR34 · Sentier des douaniers',
      icon: 'Folder',
      expanded: true,
      // Un itinéraire par fichier GPX (une étape = un tracé)
      itineraries: stages.map((st, i) => ({
        id: 'i_gr34_' + st.num,
        num: st.num,
        name: 'Étape ' + st.num + ' — ' + st.name,
        activity: 'hiking',
        color: GR34_SECTION_COLORS[i % GR34_SECTION_COLORS.length],
        distance: st.distanceKm,
        ascent: st.elevationGain,
        descent: st.elevationLoss,
        time: '—',
        difficulty: '—',
        fromRepo: true,
        coords: st.coords,
      })),
    },
  ];
}

// Données affichées en plan Pro (bascule Pro/Free dans la barre du bas).
const PRO_SEED_GROUPS = buildGr34Groups();

function fmtDist(km) {
  if (km < 10) return km.toFixed(1) + ' km';
  return Math.round(km) + ' km';
}
function fmtAscent(m) {
  const n = Math.round(m);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' m';
}

// Estimated moving time, based on an average pace per activity plus a climbing
// penalty (Naismith-style: ~+1 min per 10 m of ascent). Returns minutes.
const ACTIVITY_SPEED = {
  running: 9.5, trail: 7.5, hiking: 4.2, walking: 4.5,
  roadBike: 22, cycling: 22, gravel: 16, mtb: 12, moto: 55,
  skiTouring: 4, skiNordic: 10, snowshoe: 3.5,
  default: 6,
};
function estimateDurationMin(distanceKm, ascentM, activity) {
  const speed = ACTIVITY_SPEED[activity] || ACTIVITY_SPEED.default;
  const flatMin = (distanceKm / speed) * 60;
  const climbMin = (ascentM || 0) / 10;
  return Math.max(0, Math.round(flatMin + climbMin));
}
function fmtDuration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? (h + ' h') : (h + ' h ' + String(r).padStart(2, '0'));
}

// Aggregate stats for an itinerary (handles simple + composite-with-sections).
function itineraryStats(it) {
  if (it.sections && it.sections.length) {
    let dist = 0, asc = 0;
    it.sections.forEach((s) => { dist += s.distance; asc += s.ascent; });
    return { distance: dist, ascent: asc, isComposite: true, sectionCount: it.sections.length };
  }
  return { distance: it.distance || 0, ascent: it.ascent || 0, isComposite: false, sectionCount: 1 };
}

// --- Tracé automatique & altitudes (création d'itinéraire) ---------------
// BRouter (OpenStreetMap) : suit les sentiers, chemins ou routes.
const ROUTE_PROFILES = {
  hiking: { label: 'Sentiers', brouter: 'hiking-mountain' },
  bike: { label: 'Chemins', brouter: 'trekking' },
  road: { label: 'Routes', brouter: 'car-fast' },
};
async function routeBetween(from, to, profile) {
  const p = (ROUTE_PROFILES[profile] || ROUTE_PROFILES.hiking).brouter;
  const url = `https://brouter.de/brouter?lonlats=${from[1].toFixed(6)},${from[0].toFixed(6)}|${to[1].toFixed(6)},${to[0].toFixed(6)}&profile=${p}&alternativeidx=0&format=geojson`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error('routage ' + res.status);
    const data = await res.json();
    const coords = data && data.features && data.features[0] && data.features[0].geometry && data.features[0].geometry.coordinates;
    if (!coords || coords.length < 2) throw new Error('aucun itinéraire');
    const out = coords.map((c) => (typeof c[2] === 'number' ? [c[1], c[0], c[2]] : [c[1], c[0]]));
    // Raccord exact aux points cliqués
    out[0] = typeof from[2] === 'number' ? from : [from[0], from[1], out[0][2]].filter((v) => v != null);
    const last = out[out.length - 1];
    out[out.length - 1] = typeof last[2] === 'number' ? [to[0], to[1], last[2]] : [to[0], to[1]];
    return out;
  } finally { if (timer) clearTimeout(timer); }
}
// Ligne droite découpée tous les `stepM` mètres (pour suivre le relief)
function densifySegment(a, b, stepM = 40) {
  const d = (typeof L !== 'undefined') ? L.latLng(a).distanceTo(L.latLng(b)) : 0;
  const n = Math.min(200, Math.max(1, Math.ceil(d / stepM)));
  const out = [a];
  for (let i = 1; i < n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  out.push([b[0], b[1]]);
  return out;
}
// Altitudes (Open-Meteo, MNT Copernicus 90 m) : Map « lat,lng » -> mètres
async function fetchElevations(pts) {
  const found = new Map();
  const key = (c) => c[0].toFixed(6) + ',' + c[1].toFixed(6);
  for (let i = 0; i < pts.length; i += 100) {
    const chunk = pts.slice(i, i + 100);
    try {
      const url = 'https://api.open-meteo.com/v1/elevation?latitude=' + chunk.map((c) => c[0].toFixed(6)).join(',') + '&longitude=' + chunk.map((c) => c[1].toFixed(6)).join(',');
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      (data.elevation || []).forEach((e, k) => { if (typeof e === 'number' && Number.isFinite(e)) found.set(key(chunk[k]), e); });
    } catch (e) { /* hors ligne : altitudes inconnues */ }
  }
  return found;
}

// Mobile : écran étroit (< 768 px). La version bureau reste inchangée au-delà.
const MOBILE_QUERY = '(max-width: 767px)';
function isMobileNow() {
  try { return window.matchMedia(MOBILE_QUERY).matches; } catch (e) { return false; }
}
function useIsMobile() {
  const [m, setM] = React.useState(isMobileNow);
  React.useEffect(() => {
    let mq;
    try { mq = window.matchMedia(MOBILE_QUERY); } catch (e) { return; }
    const on = () => setM(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);
  return m;
}

Object.assign(window, { ROUTE_PROFILES, routeBetween, densifySegment, fetchElevations, isMobileNow, useIsMobile, ROUTE_COLORS, ACTIVITIES, SEED_GROUPS, PRO_SEED_GROUPS, buildGr34Groups, GR34_SECTION_COLORS, fmtDist, fmtAscent, itineraryStats, estimateDurationMin, fmtDuration });

// ---- Map projection helpers ---------------------------------------------
// The original seed routes are encoded as SVG paths in a 1200x800 viewport.
// We project that viewport onto a geographic bounding box around Chamonix /
// Mont-Blanc so the same data renders on a real Leaflet map without rewriting.
const MAP_BOUNDS = {
  // North-West corner (top-left of SVG)
  nwLat: 46.05, nwLng: 6.55,
  // South-East corner (bottom-right of SVG)
  seLat: 45.78, seLng: 7.05,
  viewW: 1200, viewH: 800,
};

function svgPointToLatLng(x, y) {
  const { nwLat, nwLng, seLat, seLng, viewW, viewH } = MAP_BOUNDS;
  const lat = nwLat - (y / viewH) * (nwLat - seLat);
  const lng = nwLng + (x / viewW) * (seLng - nwLng);
  return [lat, lng];
}

// Sample N points along an SVG path 'd' attribute and return [[lat,lng], ...]
// Cached per (path, samples) so repeat calls are free.
const _pathCache = new Map();
function samplePathToLatLng(d, samples = 80) {
  if (!d) return [];
  const key = d + '|' + samples;
  if (_pathCache.has(key)) return _pathCache.get(key);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('style', 'position:absolute;left:-99999px;top:0;');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const total = path.getTotalLength();
  const out = [];
  for (let i = 0; i <= samples; i++) {
    const p = path.getPointAtLength((i / samples) * total);
    out.push(svgPointToLatLng(p.x, p.y));
  }
  document.body.removeChild(svg);
  _pathCache.set(key, out);
  return out;
}

Object.assign(window, { svgPointToLatLng, samplePathToLatLng, MAP_BOUNDS });

// Compose the effective coordinates of a draft based on the route type.
// oneWay     → coords as drawn
// outAndBack → coords + reverse(coords without last) so we double back along the same line
// loop       → coords + first coord at the end to close the polygon
function composeDraftCoords(coords, routeType) {
  if (!coords || coords.length === 0) return [];
  if (routeType === 'outAndBack' && coords.length >= 2) {
    return coords.concat(coords.slice(0, -1).reverse());
  }
  if (routeType === 'loop' && coords.length >= 3) {
    return coords.concat([coords[0]]);
  }
  return coords;
}

// Compute the total distance in km from a coords array (latlng pairs).
function totalDistanceKm(coords) {
  if (!coords || coords.length < 2 || typeof L === 'undefined') return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += L.latLng(coords[i - 1]).distanceTo(L.latLng(coords[i]));
  }
  return total / 1000;
}

Object.assign(window, { composeDraftCoords, totalDistanceKm });
