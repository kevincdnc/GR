// Site web de Printrace — hero.
// « Imprimez votre [trek] » : le mot change selon le cas d'usage (trek, marathon,
// road trip, moto trip), l'import GPX / FIT ou le lien Strava mène au studio
// avec le tracé, et un vrai poster d'exemple (même moteur que le studio)
// montre le résultat. Composants : design system (src/ds/ui.jsx).

const { useState: useSiteState, useEffect: useSiteEffect, useRef: useSiteRef, useMemo: useSiteMemo } = React;

// Preuve sociale affichée dans la navigation.
// ⚠ Valeurs d'exemple : à remplacer par les vrais chiffres (avis, posters vendus).
// Durée d'affichage de chaque cas d'usage en lecture automatique
const SITE_ROTATE_MS = 7000;

const SITE_PROOF = { rating: '4,9' };

// ---------------------------------------------------------------- tracés d'exemple
// Tracé d'exemple : points de passage réels, détail naturel ajouté par
// subdivision (déterministe), altitude interpolée.
function siteRng(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function siteTrace(way, { seed = 7, rough = 0.22, depth = 6 } = {}) {
  const rnd = siteRng(seed);
  let pts = way.map((w) => [w[0], w[1], w[2] || 0]);
  for (let d = 0; d < depth; d++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dl = b[0] - a[0], dn = b[1] - a[1], len = Math.hypot(dl, dn);
      const k = (rnd() - 0.5) * rough * Math.pow(0.62, d);
      out.push([(a[0] + b[0]) / 2 - dn * k, (a[1] + b[1]) / 2 + dl * k, (a[2] + b[2]) / 2 + (rnd() - 0.5) * 120 * Math.pow(0.6, d) * (len > 0 ? 1 : 0)], b);
    }
    pts = out;
  }
  return pts.map((p) => [+p[0].toFixed(5), +p[1].toFixed(5), Math.max(0, Math.round(p[2]))]);
}

// Cas d'usage : mot du titre (et sa couleur), activité du studio, poster d'exemple, photos.
// Photos : vraies photos du trip dans assets/site/<cas>-1.webp et -2.webp, à renseigner dans photos[].src (portrait,
// ~800 × 1000 px) ; tant qu'elles manquent, une illustration prend leur place.
const SITE_CASES = [
  {
    id: 'trek', heroBg: 1, accent: '#60a5fa', word: 'trek', label: 'Trek & randonnée', example: 'GR20, Tour du Mont-Blanc, GR34…', icon: 'Footprints', activity: 'hiking',
    pitch: 'Votre trek de plusieurs jours, en poster prêt à encadrer.',
    poster: {
      // GR20 (Corse, Calenzana → Conca) : 16 étapes de refuge en refuge, tracées par
      // les refuges et les cols du parcours ; chiffres officiels affichés
      tpl: 'blueprint', color: 'auto', bg: '#0f1d33', mapStyle: 'epure', mapOpacity: 40, title: 'GR20 ⚪️🔴', subtitle: 'Calenzana → Conca · Corse',
      metrics: ['distance', 'ascent', 'duration', 'stages', 'start'], values: { distance: '180 km', ascent: '12 000 m', duration: '16 jours' }, photos: 2,
      route: { name: 'GR20', seed: 11, rough: 0.16, depth: 5 },
      stages: [
        ['Calenzana', 'Ortu di u Piobbu', [[42.5086, 8.8549, 275], [42.5010, 8.8650, 640], [42.4915, 8.8830, 1250], [42.4800, 8.8930, 1480], [42.4730, 8.9020, 1570]]],
        ['Ortu di u Piobbu', 'Carrozzu', [[42.4730, 8.9020, 1570], [42.4660, 8.9100, 1800], [42.4600, 8.9150, 1950], [42.4540, 8.9290, 1600], [42.4485, 8.9375, 1270]]],
        ['Carrozzu', 'Haut Asco', [[42.4485, 8.9375, 1270], [42.4430, 8.9450, 1200], [42.4350, 8.9440, 1860], [42.4300, 8.9360, 1700], [42.4265, 8.9280, 1422]]],
        ['Haut Asco', 'Tighjettu', [[42.4265, 8.9280, 1422], [42.4170, 8.9240, 1900], [42.4060, 8.9230, 2183], [42.4010, 8.9300, 2000], [42.3955, 8.9370, 1683]]],
        ['Tighjettu', 'Ciuttulu di i Mori', [[42.3955, 8.9370, 1683], [42.3905, 8.9420, 1440], [42.3800, 8.9230, 1962], [42.3685, 8.9180, 1991]]],
        ['Ciuttulu di i Mori', 'Castel di Vergio', [[42.3685, 8.9180, 1991], [42.3570, 8.9080, 1600], [42.3450, 8.9000, 1300], [42.3200, 8.8880, 1250], [42.2965, 8.8780, 1404]]],
        ['Castel di Vergio', 'Manganu', [[42.2965, 8.8780, 1404], [42.2800, 8.9020, 1480], [42.2635, 8.9210, 1743], [42.2555, 8.9340, 1621], [42.2465, 8.9475, 1601]]],
        ['Manganu', 'Petra Piana', [[42.2465, 8.9475, 1601], [42.2420, 8.9650, 1950], [42.2370, 8.9800, 2225], [42.2330, 9.0000, 2100], [42.2310, 9.0170, 1842]]],
        ['Petra Piana', 'Onda', [[42.2310, 9.0170, 1842], [42.2200, 9.0350, 1600], [42.2130, 9.0500, 1500], [42.2060, 9.0650, 1430]]],
        ['Onda', 'Vizzavona', [[42.2060, 9.0650, 1430], [42.1830, 9.0800, 2020], [42.1600, 9.1000, 1500], [42.1400, 9.1180, 1100], [42.1290, 9.1300, 920]]],
        ['Vizzavona', 'Capannelle', [[42.1290, 9.1300, 920], [42.1100, 9.1450, 1300], [42.0880, 9.1630, 1640], [42.0750, 9.1700, 1500], [42.0610, 9.1740, 1586]]],
        ['Capannelle', 'Prati', [[42.0610, 9.1740, 1586], [42.0450, 9.1780, 1400], [42.0300, 9.1820, 1289], [42.0150, 9.1950, 1550], [41.9970, 9.2050, 1820]]],
        ['Prati', 'Usciolu', [[41.9970, 9.2050, 1820], [41.9800, 9.1980, 1700], [41.9600, 9.1880, 1525], [41.9400, 9.1780, 1650], [41.9180, 9.1670, 1750]]],
        ['Usciolu', 'Asinau', [[41.9180, 9.1670, 1750], [41.9000, 9.1700, 1600], [41.8800, 9.1770, 1550], [41.8620, 9.1850, 1750], [41.8470, 9.1990, 1536]]],
        ['Asinau', 'I Paliri', [[41.8470, 9.1990, 1536], [41.8250, 9.2100, 1300], [41.7955, 9.2250, 1218], [41.7820, 9.2420, 1150], [41.7710, 9.2600, 1055]]],
        ['I Paliri', 'Conca', [[41.7710, 9.2600, 1055], [41.7600, 9.2850, 900], [41.7480, 9.3150, 600], [41.7350, 9.3430, 252]]],
      ],
    },
    unsplash: ['corsica mountains hiking', 'gr20 corsica'],
    photos: [{ src: ptRes('siteTrek1', 'assets/site/trek-1.webp'), caption: 'Balisage' }, { src: ptRes('siteTrek2', 'assets/site/trek-2.webp'), caption: 'En chemin' }],
  },
  {
    id: 'marathon', accent: '#fb7a3c', word: 'marathon', label: 'Marathon & course', example: 'Paris, Berlin, New York, votre premier semi…', icon: 'Run', activity: 'running',
    pitch: 'Votre course mythique et votre temps, en poster prêt à encadrer.',
    poster: {
      tpl: 'nuit', border: 'marge', marginColor: '#222222', typeScale: 0.68, color: '#fc5200', mapStyle: 'routes', mapOpacity: 100, title: 'Marathon de Paris', subtitle: '42,195 km · 6 avril 2026',
      metrics: ['distance', 'duration', 'pace'], values: { distance: '42,2 km', duration: '3 h 42', pace: "5'15\"/km" },
      route: { name: 'Marathon de Paris', seed: 5, rough: 0.12, depth: 5, way: [[48.8738, 2.2950], [48.8656, 2.3212], [48.8606, 2.3376], [48.8566, 2.3522], [48.8530, 2.3690], [48.8443, 2.3920], [48.8390, 2.4100], [48.8335, 2.4330], [48.8290, 2.4440], [48.8225, 2.4320], [48.8300, 2.4050], [48.8410, 2.3790], [48.8505, 2.3570], [48.8580, 2.3360], [48.8610, 2.3150], [48.8580, 2.2945], [48.8510, 2.2780], [48.8460, 2.2560], [48.8575, 2.2470], [48.8680, 2.2550], [48.8715, 2.2760]] },
    },
    unsplash: ['marathon runners city', 'marathon finish line'],
    photos: [{ src: null, caption: 'Ligne d’arrivée' }, { src: null, caption: 'Km 30, le mur' }],
  },
  {
    id: 'roadtrip', heroBg: 0, accent: '#facc15', word: 'road trip', label: 'Road trip', example: 'Pacific Coast Highway, Islande, Route 66…', icon: 'Route', activity: 'roadtrip',
    pitch: 'Toutes les étapes de votre road trip, réunies sur un seul poster.',
    poster: {
      tpl: 'blueprint', color: '#facc15', bg: '#141414', mapStyle: 'epure', mapOpacity: 55, title: 'Pacific Coast Hwy', subtitle: 'San Francisco → Los Angeles',
      metrics: ['distance', 'stages', 'duration'], values: { distance: '750 km', stages: '6', duration: '7 jours' }, photos: 2,
      route: { name: 'Pacific Coast Highway', seed: 3, rough: 0.14, depth: 5, way: [[37.7749, -122.4194, 20], [37.50, -122.47, 30], [37.25, -122.40, 40], [36.97, -122.03, 10], [36.60, -121.89, 20], [36.27, -121.81, 200], [35.95, -121.48, 300], [35.66, -121.25, 80], [35.37, -120.85, 20], [35.28, -120.66, 70], [34.95, -120.43, 100], [34.42, -119.70, 15], [34.27, -119.23, 10], [34.03, -118.78, 20], [34.05, -118.24, 90]] },
    },
    unsplash: ['big sur highway coast', 'desert road trip'],
    photos: [{ src: ptRes('siteRoad1', 'assets/site/roadtrip-1.webp'), caption: 'Big Sur' }, { src: null, caption: 'Highway 1' }],
  },
  {
    id: 'moto', heroBg: 0, accent: '#f87171', word: 'moto trip', label: 'Moto trip', example: 'Route des Grandes Alpes, cols pyrénéens…', icon: 'Moto', activity: 'moto',
    pitch: 'Chaque col et chaque virage de votre virée, au mur.',
    poster: {
      tpl: 'nuit', color: '#ffffff', mapStyle: 'routes', mapOpacity: 100, title: 'Route des Grandes Alpes', subtitle: 'Thonon → Menton · 16 cols',
      metrics: ['distance', 'altMax', 'duration'], values: { distance: '720 km', altMax: '2 802 m', duration: '5 jours' },
      route: { name: 'Route des Grandes Alpes', seed: 9, rough: 0.2, way: [[46.37, 6.48, 380], [46.20, 6.55, 900], [45.99, 6.47, 1613], [45.87, 6.47, 1486], [45.69, 6.69, 1967], [45.55, 6.88, 800], [45.42, 7.03, 2764], [45.24, 6.68, 1100], [45.06, 6.41, 2642], [44.89, 6.64, 1300], [44.82, 6.73, 2360], [44.62, 6.75, 1100], [44.39, 6.65, 1132], [44.32, 6.81, 2802], [44.10, 7.10, 900], [43.90, 7.35, 500], [43.77, 7.50, 10]] },
    },
    unsplash: ['motorcycle mountain pass', 'alps hairpin road'],
    photos: [{ src: ptRes('siteMoto1', 'assets/site/moto-1.webp'), caption: 'Col alpin' }, { src: null, caption: 'Lacets du Galibier' }],
  },
  {
    id: 'gpx', heroBg: 0, accent: '#2dd4bf', word: 'GPX', label: 'N’importe quel tracé', example: 'Un tour d’île, une sortie vélo, une balade…', icon: 'Route', activity: 'hiking',
    pitch: 'N’importe quel fichier GPX devient un poster prêt à encadrer.',
    poster: {
      // Modèle « Photo » : la photo du phare de la Jument (Ouessant) sert de fond à la carte, voile renforcé (écume claire)
      tpl: 'photo', bgPhoto: true, photoShade: 1, color: '#ffffff', mapStyle: 'epure', mapOpacity: 60, title: 'Ouessant', subtitle: 'Le tour de l’île · Finistère',
      photos: 1, metrics: ['distance', 'ascent', 'duration'], values: { distance: '45 km', ascent: '620 m', duration: '11 h 30' },
      route: { name: 'Tour de Ouessant', seed: 4, rough: 0.2, depth: 5, way: [[48.4565, -5.0990, 15], [48.4465, -5.1080, 30], [48.4455, -5.1420, 25], [48.4600, -5.1305, 20], [48.4740, -5.1150, 35], [48.4795, -5.0950, 40], [48.4750, -5.0560, 20], [48.4580, -5.0380, 30], [48.4430, -5.0700, 45], [48.4430, -5.0900, 30], [48.4565, -5.0990, 15]] },
    },
    unsplash: ['ouessant lighthouse', 'brittany island coast'],
    photos: [{ src: ptRes('siteGpx1', 'assets/site/gpx-1.webp'), caption: 'Phare de la Jument' }],
  },
];

// Données de rendu du poster d'exemple (même forme que dataFor du studio)
// Tracés du poster d'exemple : une partie par étape quand le cas en a (GR20), sinon un seul tracé dessiné
function siteRoutesOf(c) {
  const base = { color: '#ffffff', durationReal: false, activity: c.activity, date: '' };
  if (c.poster.stages) {
    return c.poster.stages.map(([from, to, way], i) => ({
      ...base, id: 'demo_' + c.id + '_' + i, name: from + ' → ' + to, coords: siteTrace(way, { ...c.poster.route, seed: c.poster.route.seed + i }),
      distance: 0, ascent: 0, descent: 0, durationMin: 0, altMax: null,
    }));
  }
  const r = c.poster.route;
  return [{ ...base, id: 'demo_' + c.id, name: r.name, coords: siteTrace(r.way, r), distance: 0, ascent: 0, descent: 0, durationMin: 0, altMax: null }];
}
// Tracés importés par le visiteur -> tracés du poster (affichés à la place de l'exemple)
function siteUserRoutes(items, c) {
  return items.map((x) => ({
    id: 'user_' + x.id, name: siteItemLabel(x), color: '#ffffff', activity: c.activity, date: x.st.gpxDate ? x.st.gpxDate.slice(0, 10) : '',
    coords: x.st.coords, distance: x.st.distanceKm || 0, ascent: x.st.elevationGain || 0, descent: x.st.elevationLoss || 0,
    durationMin: x.st.gpxMovingMin || 0, durationReal: !!x.st.gpxMovingMin, altMax: x.st.altMax || null,
  }));
}
const siteItemLabel = (x) => (x.st.to ? x.st.from + ' → ' + x.st.to : x.st.from) || x.name.replace(/\.[^.]+$/, '');
// Sous-titre d'un poster importé : départ → arrivée sur plusieurs tracés, sinon la date
function siteUserSubtitle(items) {
  if (!items.length) return '';
  const a = items[0].st, b = items[items.length - 1].st;
  if (items.length > 1 && a.from && b.to) return a.from + ' → ' + b.to;
  return a.gpxDate ? ptDate(a.gpxDate) : '';
}
// Titre par défaut du poster : celui de l'exemple, ou le nom du tracé importé
function siteDefaultTitle(c, items) {
  if (!items || !items.length) return c.poster.title;
  return items.length > 1 ? 'Mon ' + c.word : siteItemLabel(items[0]);
}
// o : personnalisation (nom du trip, couleur du tracé, photos) ; o.user : tracés du visiteur
function sitePosterData(c, routes, photos = [], o = {}) {
  const p = c.poster, act = poActivity(c.activity);
  const subtitle = o.user ? o.userSubtitle || act.label : p.subtitle;
  if ((o.photos === false || o.user) && !p.bgPhoto) photos = [];
  const agg = poAggregate(routes, act);
  const stats = poStats(agg, p.metrics, { activity: act.label, start: routes[0].coords[0] })
    .map((st) => (!o.user && p.values[st.key] ? { ...st, value: p.values[st.key], unit: '' } : st));
  return {
    routes, agg, color: o.color || p.color, coords: true, activityLabel: act.label, title: (o.title || '').trim() || o.defaultTitle || p.title, subtitle, stats,
    photoSlot: false, photos: p.bgPhoto ? photos.slice(1) : photos, bgPhoto: p.bgPhoto && photos[0] ? photos[0].img : null, showMap: true, mapStyle: p.mapStyle, mapOpacity: p.mapOpacity / 100, mapLabels: true,
    bg: p.bg || null, preview: false, typeScale: p.typeScale, marginColor: p.marginColor, photoShade: p.photoShade,
  };
}

// Photos des cas d'usage, par ordre de priorité :
//  1. vraies photos du trip dans assets/site/<cas>-N.webp
//  2. photos Unsplash (clé d'accès gratuite : PRINTRACE_CONFIG.unsplashKey),
//     chargées par le navigateur et créditées comme le demande Unsplash
//  3. illustration dessinée
const siteImgCache = {};
function siteLoadImg(src) {
  if (!src) return Promise.resolve(null);
  if (!siteImgCache[src]) siteImgCache[src] = new Promise((res) => {
    const im = new Image();
    if (/^https?:/.test(src)) im.crossOrigin = 'anonymous'; // Unsplash autorise le dessin sur canvas
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  return siteImgCache[src];
}
const SITE_UTM = '?utm_source=printrace&utm_medium=referral';
async function siteUnsplash(query) {
  const key = (window.PRINTRACE_CONFIG || {}).unsplashKey;
  if (!key || !query) return null;
  const ck = 'pt_unsplash_' + query;
  try { const hit = sessionStorage.getItem(ck); if (hit) return JSON.parse(hit); } catch (e) {}
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=1&content_filter=high&client_id=${key}`);
    if (!r.ok) return null;
    const p = ((await r.json()).results || [])[0];
    if (!p) return null;
    const out = { src: p.urls.raw + '&w=720&h=900&fit=crop&q=80', credit: p.user.name, link: p.user.links.html + SITE_UTM };
    try { sessionStorage.setItem(ck, JSON.stringify(out)); } catch (e) {}
    return out;
  } catch (e) { return null; }
}
// Photo à afficher pour un cas d'usage : { src, credit?, link? } ou null (illustration)
async function siteResolvePhoto(c, i) {
  const local = (c.photos[i] || {}).src;
  if (local && (await siteLoadImg(local))) return { src: local };
  const u = await siteUnsplash((c.unsplash || [])[i]);
  if (u && (await siteLoadImg(u.src))) return u;
  return null;
}
function siteSceneImg(kind, alt) {
  const host = document.createElement('div');
  const root = ReactDOM.createRoot(host);
  ReactDOM.flushSync(() => root.render(<SiteScene kind={kind} alt={alt} />));
  const svg = host.innerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720" ');
  root.unmount();
  return siteLoadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}
async function sitePosterPhotos(c, resolved = []) {
  const out = [];
  for (let i = 0; i < (c.poster.photos || 0); i++) {
    const r = resolved[i];
    const img = (r && (await siteLoadImg(r.src))) || (await siteSceneImg(c.id, i === 1));
    if (img) out.push({ img, url: img.src });
  }
  return out;
}

// ---------------------------------------------------------------- visuels
// Avatars illustrés (pas de vraies personnes) pour la preuve sociale
function SiteAvatar({ i }) {
  const tones = [['#f5d0b5', '#3b2a20', '#2563eb'], ['#e8b893', '#141414', '#059669'], ['#c68a62', '#2b1d14', '#f59e0b'], ['#f1c9a5', '#8a5a2b', '#db2777'], ['#a8714d', '#111111', '#7c3aed']][i % 5];
  const hair = [
    'M6 13c0-6 4-9 10-9s10 3 10 9c-2-3-5-4-10-4s-8 1-10 4z',
    'M6 14c0-7 5-10 10-10 6 0 10 4 10 10-1-2-3-4-5-4-3 2-9 2-15 4z',
    'M7 12c1-5 4-8 9-8s8 3 9 8c-3-2-6-3-9-3s-6 1-9 3z',
    'M5 16c0-8 5-12 11-12s11 4 11 12c0 3-1 6-2 8-1-5-3-10-9-10s-8 5-9 10c-1-2-2-5-2-8z',
    'M8 10c2-4 5-6 8-6 4 0 7 2 8 6-3-1-5-1-8-1s-5 0-8 1z',
  ][i % 5];
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8 rounded-full ring-2 ring-[#0a0a0a] bg-neutral-800 shrink-0" aria-hidden="true">
      <rect width="32" height="32" fill={tones[2]} opacity="0.35" />
      <path d="M4 32c1-7 6-10 12-10s11 3 12 10z" fill={tones[2]} />
      <circle cx="16" cy="15" r="7.5" fill={tones[0]} />
      <path d={hair} fill={tones[1]} />
    </svg>
  );
}
// Note discrète façon avis en ligne : avatars, « 4,9 ★ (2 400+ avis) »
function SiteProof() {
  return (
    <div className="inline-flex items-center gap-2.5 h-10 rounded-full bg-white/[0.04] ring-1 ring-white/[0.09] pl-1.5 pr-3.5"
      aria-label={`Noté ${SITE_PROOF.rating} sur 5 par nos clients`}>
      <div className="flex -space-x-2 [&_svg]:w-7 [&_svg]:h-7 [&_svg]:ring-[#141414]">{[0, 1, 2].map((i) => <SiteAvatar key={i} i={i} />)}</div>
      <div className="flex items-center gap-1.5 text-[13.5px] leading-none">
        <svg viewBox="0 0 20 20" className="w-[15px] h-[15px] text-amber-400 -mt-px" fill="currentColor" aria-hidden="true"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" /></svg>
        <span className="font-semibold text-white">{SITE_PROOF.rating}</span>
      </div>
    </div>
  );
}

// Photo d'ambiance illustrée (remplaçable par une vraie photo : photos[].src)
function SiteScene({ kind, alt }) {
  const id = kind + (alt ? '2' : '');
  const S = {
    trek: alt
      ? { sky: ['#fbd6a5', '#f59e7a'], sun: '#fff4dc', far: '#b77a87', mid: '#7f4f6b', near: '#3a2a43', accent: '#9fd3e6' }
      : { sky: ['#9cc9e8', '#e8f1f6'], sun: '#fffbe9', far: '#8aa7bf', mid: '#4f6f86', near: '#26394a', accent: '#ffffff' },
    marathon: alt
      ? { sky: ['#1b2440', '#43375f'], sun: '#ffe9b0', far: '#2f3557', mid: '#1f2440', near: '#121628', accent: '#fc5200' }
      : { sky: ['#ffd9a8', '#f6a07a'], sun: '#fff1d6', far: '#c98d7e', mid: '#8a5b5c', near: '#3d2b33', accent: '#fc5200' },
    roadtrip: alt
      ? { sky: ['#f7c48a', '#e67b5c'], sun: '#fff0cf', far: '#c46b4f', mid: '#8c4434', near: '#3b2220', accent: '#facc15' }
      : { sky: ['#ffcf9e', '#ff8f70'], sun: '#fff3d9', far: '#5d87a8', mid: '#2f5d7c', near: '#1d3245', accent: '#facc15' },
    gpx: alt
      ? { sky: ['#f6c38f', '#e98a6a'], sun: '#fff1d6', far: '#5b6f86', mid: '#34465a', near: '#1b2531', accent: '#e11d2e' }
      : { sky: ['#8fb8d8', '#dfeaf1'], sun: '#fffbe9', far: '#5f8aa8', mid: '#3d6680', near: '#24323d', accent: '#e11d2e' },
    moto: alt
      ? { sky: ['#a7c6df', '#e9eef2'], sun: '#ffffff', far: '#9db0c0', mid: '#5f7383', near: '#2c3a45', accent: '#ffffff' }
      : { sky: ['#f9b98c', '#fbe2c0'], sun: '#fff6e5', far: '#b08a8f', mid: '#6d5463', near: '#2e2633', accent: '#ffffff' },
  }[kind];
  return (
    <svg viewBox="0 0 300 360" className="block w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={'sky' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={S.sky[0]} /><stop offset="1" stopColor={S.sky[1]} /></linearGradient>
      </defs>
      <rect width="300" height="360" fill={`url(#sky${id})`} />
      <circle cx={alt ? 210 : 90} cy={alt ? 120 : 92} r={alt ? 36 : 26} fill={S.sun} opacity="0.95" />
      {kind === 'trek' && (<>
        <path d="M0 230 L60 150 L110 205 L170 110 L230 190 L300 140 L300 360 L0 360z" fill={S.far} />
        <path d="M170 110 L185 128 L172 126 L160 136z" fill="#fff" opacity="0.85" />
        <path d="M0 270 L70 210 L130 250 L200 190 L300 250 L300 360 L0 360z" fill={S.mid} />
        {alt && <rect x="0" y="282" width="300" height="34" fill={S.accent} opacity="0.55" />}
        <path d="M0 315 L80 280 L160 305 L240 270 L300 290 L300 360 L0 360z" fill={S.near} />
        <path d="M60 360 C90 330 70 318 110 300 C140 287 128 268 165 252 C190 241 186 225 205 214" stroke="#fff" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round" fill="none" opacity="0.9" />
        <g transform="translate(150 262)" fill={S.near}><circle cx="0" cy="-17" r="3.4" /><path d="M-3 -13 h6 l1 10 h-2 l-1 9 h-2 l-1-9 h-2z" /><path d="M3 -12 l4 3 -1 9" stroke={S.near} strokeWidth="1.5" fill="none" /></g>
      </>)}
      {kind === 'marathon' && (<>
        <path d="M0 220 h30 v-30 h20 v20 h25 v-45 h18 v55 h30 v-25 h22 v35 h40 v-60 h20 v60 h35 v-20 h30 v-15 h30 v215 h-300z" fill={S.far} />
        <path d="M205 230 L218 120 L222 85 L226 120 L239 230 M211 190 h22 M214 160 h16" stroke={S.mid} strokeWidth="4" fill="none" />
        <path d="M0 250 h300 v110 h-300z" fill={S.mid} />
        <path d="M120 250 L180 250 L300 360 L0 360z" fill={S.near} />
        <path d="M150 256 v12 M150 280 v16 M150 308 v20 M150 340 v20" stroke="#fff" strokeWidth="3" opacity="0.7" />
        <path d="M70 360 V200 M230 360 V200" stroke={S.near} strokeWidth="7" />
        <rect x="64" y="196" width="172" height="26" rx="3" fill={S.accent} />
        <text x="150" y="214" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="14" fill="#fff" letterSpacing="3">FINISH</text>
      </>)}
      {kind === 'roadtrip' && (<>
        {alt ? (<>
          <path d="M0 230 h40 v-40 h50 v40 h60 l20 -30 h40 l15 30 h75 v130 h-300z" fill={S.far} />
          <path d="M0 250 h300 v110 h-300z" fill={S.mid} />
          <path d="M135 250 L165 250 L280 360 L20 360z" fill={S.near} />
          <path d="M150 258 v10 M150 282 v16 M150 312 v22" stroke={S.accent} strokeWidth="3" />
        </>) : (<>
          <path d="M0 210 h300 v150 h-300z" fill={S.far} />
          <path d="M0 200 L60 170 L120 190 L170 150 L300 200 L300 360 L150 360 C130 320 90 290 0 270z" fill={S.mid} />
          <path d="M300 230 C230 240 200 262 170 290 C150 310 140 330 136 360" stroke="#e8e2d9" strokeWidth="10" fill="none" />
          <path d="M300 230 C230 240 200 262 170 290 C150 310 140 330 136 360" stroke={S.accent} strokeWidth="1.6" strokeDasharray="6 7" fill="none" />
          <path d="M150 360 C170 330 200 300 300 280 L300 360z" fill={S.near} />
          <path d="M0 260 h40 M10 275 h60 M0 292 h30" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
        </>)}
      </>)}
      {kind === 'gpx' && (<>
        {/* Ouessant : mer, côte rocheuse et phare du Créac'h (rayé noir et blanc) */}
        <path d="M0 236 h300 v124 h-300z" fill={S.far} />
        <path d="M0 252 h300 M0 270 h300 M0 292 h300" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="14 10" />
        <path d="M120 236 L150 214 L196 206 L240 216 L300 212 L300 360 L90 360 C110 320 96 280 120 236z" fill={S.mid} />
        <path d="M150 360 C170 320 200 296 300 286 L300 360z" fill={S.near} />
        <g transform="translate(214 120)">
          <path d="M-9 0 h18 l6 92 h-30z" fill="#f4f4f4" />
          {[14, 40, 66].map((y) => <path key={y} d={`M${-9 - y * 0.065} ${y} h${18 + y * 0.13} l${1.6} 13 h${-21.2 - y * 0.13}z`} fill="#1c1c1c" />)}
          <rect x="-11" y="-14" width="22" height="14" rx="2" fill="#1c1c1c" />
          <rect x="-7" y="-11" width="14" height="8" fill={S.sun} />
          <path d="M-11 -14 L0 -24 L11 -14z" fill={S.accent} />
        </g>
        <path d="M30 360 C60 320 100 330 120 300 C140 270 170 262 214 212" stroke="#fff" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round" fill="none" opacity="0.9" />
      </>)}
      {kind === 'moto' && (<>
        <path d="M0 210 L80 120 L140 170 L210 90 L300 170 L300 360 L0 360z" fill={S.far} />
        <path d="M210 90 L228 110 L214 108 L200 118z" fill="#fff" opacity="0.9" />
        <path d="M0 260 L90 190 L170 240 L300 200 L300 360 L0 360z" fill={S.mid} />
        <path d="M40 360 C40 330 250 335 250 312 C250 290 60 300 60 278 C60 258 230 268 230 248 C230 232 110 236 110 222" stroke="#e5e7eb" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M40 360 C40 330 250 335 250 312 C250 290 60 300 60 278 C60 258 230 268 230 248 C230 232 110 236 110 222" stroke={S.near} strokeWidth="1" strokeDasharray="4 6" fill="none" />
        {alt && <ellipse cx="80" cy="330" rx="60" ry="10" fill="#9fd3e6" opacity="0.5" />}
        <g transform="translate(170 318)" fill={S.near}><circle cx="-9" cy="6" r="5" /><circle cx="11" cy="6" r="5" /><path d="M-9 6 L0 -4 h9 l4 6 h-6z" /><circle cx="2" cy="-10" r="3.2" /></g>
      </>)}
    </svg>
  );
}
// Photo posée en décor (cadre type tirage photo, légèrement tournée)
function SitePhoto({ c, i, photo, className = '', rotate = 0, style }) {
  const ph = { ...(c.photos[i] || {}), src: '', ...(photo || {}) };
  const [broken, setBroken] = useSiteState(false);
  useSiteEffect(() => setBroken(false), [ph.src]); // nouvelle photo à chaque cas d'usage
  // Photo seule, contour fin et discret (pas de légende) ; crédit Unsplash si besoin
  return (
    <figure className={`absolute pointer-events-none select-none rounded-[14px] p-[5px] bg-white/[0.07] ring-1 ring-white/[0.08] backdrop-blur-sm shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85)] ${className}`} style={{ ...style, transform: `rotate(${rotate}deg)` }}>
      <div key={c.id} className="relative w-full h-full rounded-[10px] overflow-hidden ds-fade-up bg-neutral-800">
        {ph.src && !broken ? <img src={ph.src} loading="lazy" decoding="async" alt={ph.caption || ''} className="w-full h-full object-cover" onError={() => setBroken(true)} /> : <SiteScene kind={c.id} alt={i === 1} />}
        {ph.credit && (
          <figcaption className="pointer-events-auto absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 text-[9px] text-white/80 bg-gradient-to-t from-black/60 to-transparent" style={{ fontFamily: 'var(--ds-font-site)' }}>
            Photo <a href={ph.link} target="_blank" rel="noopener" className="underline">{ph.credit}</a> · <a href={'https://unsplash.com/' + SITE_UTM} target="_blank" rel="noopener" className="underline">Unsplash</a>
          </figcaption>
        )}
      </div>
    </figure>
  );
}

// Poster d'exemple rendu par le moteur du studio, dans un cadre noir
// finish : 'frame' (encadré), 'print' (poster seul), 'file' (fichier HD)
function SitePoster({ c, photos, custom = {}, items = [], finish = 'frame', children }) {
  const ref = useSiteRef(null);
  const drawn = useSiteRef(null); // cas d'usage déjà dessiné sur le canvas
  const [ready, setReady] = useSiteState(false);
  const user = items.length > 0;
  const routes = useSiteMemo(() => (user ? siteUserRoutes(items, c) : siteRoutesOf(c)), [c.id, items]);
  const title = (custom.title || '').trim() || siteDefaultTitle(c, items);
  const fmt = POSTER_FORMATS[1]; // A3
  useSiteEffect(() => {
    let live = true;
    const same = drawn.current === c.id; // simple retouche : on garde l'image affichée, sans spinner
    if (!same) setReady(false);
    if (!photos) return; // photos du cas d'usage encore en cours de résolution
    (async () => {
      if (same) await new Promise((r) => setTimeout(r, 140)); // saisie du nom : un rendu quand on s'arrête de taper
      await storyFontsReady({ vintage: false }); // modèles du site : pas d'italique « ancienne carte »
      const cv = ref.current; if (!cv || !live) return;
      const tpl = POSTER_TEMPLATES.find((t) => t.id === c.poster.tpl) || POSTER_TEMPLATES[0];
      const w = 900, h = Math.round(w * fmt.mm[1] / fmt.mm[0]);
      const ph = await sitePosterPhotos(c, photos);
      if (!live) return;
      // Rendu hors écran puis copie : pas de clignotement pendant les retouches
      const off = document.createElement('canvas'); off.width = w; off.height = h;
      await renderPoster(off, tpl, sitePosterData(c, routes, ph, { ...custom, user, defaultTitle: siteDefaultTitle(c, items), userSubtitle: siteUserSubtitle(items) }), fmt, c.poster.border || 'none', w / PO_W);
      if (!live) return;
      cv.width = w; cv.height = h; cv.getContext('2d').drawImage(off, 0, 0);
      drawn.current = c.id;
      setReady(true);
    })();
    return () => { live = false; };
  }, [c.id, routes, photos && photos.map((p) => (p ? p.src : '')).join('|'), custom.photos, custom.title, custom.color]);
  const framed = finish === 'frame';
  return (
    <div className="relative mx-auto w-full">
      {/* Éclairage : halo doux et large derrière le poster (plusieurs paliers pour un fondu sans marches) */}
      <div className="pointer-events-none absolute -inset-x-[90%] -top-[45%] -bottom-[40%] -z-10" style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.095) 40%, rgba(255,255,255,0.045) 62%, rgba(255,255,255,0.015) 82%, rgba(255,255,255,0) 100%)' }} />
      {children}
      <div className={`relative z-10 transition-all duration-500 ${framed ? 'p-[3.2%] bg-[#151515] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95),0_20px_40px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]' : 'p-0 bg-transparent shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]'}`} style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}` }}>
        <canvas ref={ref} className={`block w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' }} />
        {!ready && <div className={`absolute ${framed ? 'inset-[3.2%]' : 'inset-0'} grid place-items-center bg-neutral-900`}><UiSpinner size={20} className="text-neutral-500" /></div>}
        {/* Fichier HD : repères de coupe aux coins */}
        {finish === 'file' && ['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((k) => (
          <span key={k} aria-hidden="true" className={`pointer-events-none absolute w-5 h-5 border-white/70 ${k} -m-3 ds-fade-up`} />
        ))}
        {/* Spot de galerie : lumière qui tombe du haut sur le cadre et la vitre */}
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-500 ${framed ? '' : 'opacity-0'}`} style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35) 50%, transparent)' }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 35% at 50% 0%, rgba(255,255,255,0.10), transparent 70%)', mixBlendMode: 'screen' }} />
        {/* Reflet léger sur le verre, en diagonale (seulement sous verre) */}
        <div className={`pointer-events-none absolute inset-[3.2%] transition-opacity duration-500 ${framed ? '' : 'opacity-0'}`} style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 28%, transparent 45%)' }} />
      </div>
      <div className="pointer-events-none mx-auto -mt-2 h-6 w-[86%] rounded-[50%] bg-black/50 blur-xl" />
      <div className="relative z-10 mt-3 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] ring-1 ring-white/10 px-3 h-7 text-[12px] text-neutral-300">
          {finish === 'file' ? <I.Download size={13} /> : <I.Poster size={13} />} {user ? 'Votre poster' : 'Exemple'} · {title} · {finish === 'file' ? 'PDF HD' : finish === 'print' ? 'A3, sans cadre' : 'A3 encadré'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- personnalisation
// Trois réglages volontairement simples sur le poster d'exemple : ils ne peuvent
// pas casser la mise en page (nom limité, couleurs choisies, photos on/off).
const SITE_TRACE_COLORS = [
  { hex: '#ffffff', name: 'Blanc' }, { hex: '#fc5200', name: 'Orange' }, { hex: '#facc15', name: 'Jaune' },
  { hex: '#34d399', name: 'Vert' }, { hex: '#60a5fa', name: 'Bleu' }, { hex: '#f472b6', name: 'Rose' },
];
const SITE_TITLE_MAX = 24;
function SiteCustomize({ c, value, onChange, items = [] }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const defColor = c.poster.color === 'auto' ? '#ffffff' : c.poster.color;
  const color = value.color || defColor;
  const canPhotos = (c.poster.photos || 0) > 0 && !c.poster.bgPhoto && !items.length;
  const photosOn = value.photos !== false;
  const touched = !!(value.title || value.color || value.photos === false);
  return (
    <div className="rounded-2xl bg-[#0e0e0e]/70 backdrop-blur-md ring-1 ring-white/[0.07] px-4 pt-3.5 pb-4">
      <div className="flex items-center justify-between h-6">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Réglages</span>
        {touched && <button onClick={() => onChange({})} className="text-[12.5px] text-neutral-400 hover:text-white transition-colors">Réinitialiser</button>}
      </div>
      <label className="block mt-3">
        <span className="sr-only">Nom du trip</span>
        <span className="relative block">
          <input value={value.title || ''} maxLength={SITE_TITLE_MAX} placeholder={siteDefaultTitle(c, items)} onChange={(e) => set('title', e.target.value)}
            className="w-full h-11 rounded-lg bg-white/[0.05] ring-1 ring-white/10 focus:ring-white/30 outline-none pl-3.5 pr-12 text-[14.5px] text-white placeholder:text-neutral-500 transition-shadow" />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11.5px] tabular-nums text-neutral-600">{(value.title || '').length}/{SITE_TITLE_MAX}</span>
        </span>
      </label>
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-[13.5px] text-neutral-300 whitespace-nowrap">Couleur du tracé</span>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Couleur du tracé">
          {SITE_TRACE_COLORS.map((x) => (
            <button key={x.hex} role="radio" aria-checked={color === x.hex} title={x.name} aria-label={x.name}
              onClick={() => set('color', x.hex === defColor ? null : x.hex)}
              className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${color === x.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212]' : 'ring-1 ring-white/20'}`}
              style={{ background: x.hex }} />
          ))}
        </div>
      </div>
      <button role="switch" aria-checked={canPhotos && photosOn} disabled={!canPhotos} onClick={() => set('photos', !photosOn)}
        title={canPhotos ? undefined : items.length ? 'Vos photos s’ajoutent dans le studio' : 'Ce modèle n’affiche pas de photos'}
        className="mt-3.5 w-full flex items-center justify-between gap-3 text-left disabled:opacity-40 disabled:cursor-not-allowed group">
        <span className="text-[13.5px] text-neutral-300 group-enabled:group-hover:text-white transition-colors">Photos du voyage</span>
        <UiSwitch on={canPhotos && photosOn} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- titre dynamique
function SiteUseCasePicker({ value, onChange, onInteract, auto }) {
  const [open, setOpen] = useSiteState(false);
  const ref = useSiteRef(null);
  const c = SITE_CASES.find((x) => x.id === value);
  useSiteEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-block">
      <button onClick={() => { setOpen((v) => !v); onInteract(); }} aria-haspopup="listbox" aria-expanded={open}
        className="group relative inline-flex items-baseline gap-[0.12em] text-white">
        {/* Fond du survol : déborde du mot (marges égales) sans changer la hauteur de ligne */}
        <span aria-hidden="true" className="absolute -left-[0.2em] -right-[0.16em] -top-[0.08em] -bottom-[0.22em] rounded-[0.2em] transition-colors group-hover:bg-white/[0.045]" />
        <span key={value} className="ds-fade-up relative inline-block italic pr-[0.06em]" style={{ color: c.accent }}>
          {c.word}
          {/* Trait discret en pointillés ; en lecture auto, il se remplit jusqu'au mot suivant */}
          {/* Fine barre de progression : rail discret, remplissage dans la couleur du mot */}
          <span aria-hidden="true" className="site-bar absolute left-[0.04em] right-[0.04em] -bottom-[0.08em] overflow-hidden" style={{ background: c.accent + '17' }}>
            {auto
              ? <span key={value} className="site-bar-fill block h-full" style={{ background: c.accent + '99', animationDuration: `${SITE_ROTATE_MS}ms` }} />
              : <span className="block h-full w-full" style={{ background: c.accent + '66' }} />}
          </span>
        </span>
        <span className="relative text-neutral-500 group-hover:text-white transition-colors self-center" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <svg viewBox="0 0 24 24" className="w-[0.32em] h-[0.32em]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {open && (
        <div role="listbox" className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-40 w-[340px] max-w-[88vw] rounded-2xl bg-[#141415] ring-1 ring-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-1.5 text-left animate-menu" style={{ fontFamily: 'var(--ds-font-site)', fontSize: 14, letterSpacing: 0, lineHeight: 1.3 }}>
          {SITE_CASES.map((x) => {
            const on = x.id === value, Ico = I[x.icon] || I.Route;
            return (
              <button key={x.id} role="option" aria-selected={on} onClick={() => { onChange(x.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${on ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}>
                <span className="w-9 h-9 shrink-0 rounded-lg grid place-items-center transition-colors"
                  style={on ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#a3a3a3' }}><Ico size={17} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-white">{x.label}</span>
                  <span className="block text-[12px] text-neutral-500 truncate">{x.example}</span>
                </span>
                {on && <span className="text-neutral-300"><I.Check size={15} /></span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- import
// Adresse du studio (même site) ; les tracés partent dans le lien (#t=…)
function siteStudioUrl() {
  return (window.RoutdoorLink ? window.RoutdoorLink.siteRoot() : '../') + 'printrace/studio/';
}
// o : réglages du hero repris dans le studio (nom du trip, couleur du tracé)
async function siteOpenStudio(stages, c, source, o = {}) {
  const parts = stages.map(({ st, name }) => ({
    name: (st.to ? st.from + ' → ' + st.to : st.from) || name.replace(/\.[^.]+$/, ''),
    color: o.color || '', distance: st.distanceKm, ascent: st.elevationGain, descent: st.elevationLoss,
    durationMin: st.gpxMovingMin || 0, date: st.gpxDate ? st.gpxDate.slice(0, 10) : '', coords: st.coords,
  }));
  const code = await window.RoutdoorLink.encodeShare({ title: (o.title || '').trim() || (parts.length > 1 ? 'Mon ' + c.word : ''), parts }, 6000);
  const url = siteStudioUrl() + '#t=' + code + '&a=' + c.activity + '&src=site' + (source === 'strava' ? '&from=strava' : '');
  const sameSite = /github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  if (sameSite) location.href = url; else window.open(url, '_blank', 'noopener');
}

function SiteImport({ c, items, setItems, onNext }) {
  const fileRef = useSiteRef(null);
  const [busy, setBusy] = useSiteState(false);
  const [over, setOver] = useSiteState(false);
  const [error, setError] = useSiteState('');
  const [link, setLink] = useSiteState('');
  const [stravaRef, setStravaRef] = useSiteState(null); // lien valide, en attente du fichier (sans relais)
  const [stravaBusy, setStravaBusy] = useSiteState(false);

  const importFiles = async (list, source) => {
    setError('');
    const files = [...(list || [])].filter(isTrackFile);
    if (!files.length) { setError('Formats acceptés : GPX, FIT, TCX, KML, GeoJSON, IGC.'); return; }
    setBusy(true);
    const res = await Promise.all(files.map((f) => readTrackFile(f).then((st) => ({ st, name: f.name })).catch(() => null)));
    const ok = res.filter((r) => r && r.st && r.st.coords && r.st.coords.length > 1);
    setBusy(false);
    if (!ok.length) { setError('Impossible de lire ce fichier.'); return; }
    if (ok.length < files.length) setError(`${files.length - ok.length} fichier(s) illisible(s) ignoré(s).`);
    setItems((prev) => {
      const same = (a, b) => a.name === b.name && Math.abs((a.st.distanceKm || 0) - (b.st.distanceKm || 0)) < 0.01;
      const fresh = ok.filter((r) => !prev.some((p) => same(p, r))).map((r, i) => ({ ...r, id: Date.now() + '_' + i, source }));
      return [...prev, ...fresh];
    });
  };
  const removeItem = (id) => setItems((l) => l.filter((x) => x.id !== id));
  const total = items.reduce((a, x) => a + (x.st.distanceKm || 0), 0);
  const fileLabel = siteItemLabel;
  const submitStrava = async () => {
    setError('');
    const r = ptParseStrava(link);
    if (!r || r.kind === 'invalid') { setError("Ce lien n'est pas une activité Strava."); return; }
    if (r.kind === 'short') { setError("Lien raccourci : ouvrez-le puis copiez l'adresse complète (strava.com/activities/…)."); return; }
    if (!ptStravaApi()) { setStravaRef(r); return; } // parcours guidé
    setStravaBusy(true);
    try { const f = await ptFetchStravaGpx(r); if (f) await importFiles([f], 'strava'); }
    catch (e) { setError(e.message || 'Import Strava impossible.'); }
    setStravaBusy(false);
  };
  const pick = () => fileRef.current && fileRef.current.click();

  return (
    <div className="w-full max-w-[520px] mx-auto lg:mx-0">
      <input ref={fileRef} type="file" multiple accept={TRACK_ACCEPT} className="hidden" onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }} />
      {/* Fichier et lien Strava côte à côte, sur une seule ligne (empilés sur mobile) */}
      <div className="flex flex-col gap-3">
        <button onClick={pick}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); importFiles(e.dataTransfer.files); }}
          className={`group min-h-[84px] rounded-2xl border-[1.5px] border-dashed flex items-center gap-4 px-4 py-4 text-left transition-all ${over ? 'border-white bg-white/[0.08] scale-[1.01]' : 'border-white/25 bg-white/[0.03] hover:border-white/50 hover:bg-white/[0.05]'}`}>
          <span className={`w-12 h-12 shrink-0 rounded-xl grid place-items-center ring-1 transition-colors ${over ? 'bg-white text-neutral-900 ring-white' : 'bg-white/[0.07] text-white ring-white/10 group-hover:bg-white group-hover:text-neutral-900'}`}>
            {busy ? <UiSpinner size={18} /> : <I.Upload size={19} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15.5px] font-semibold text-white leading-snug">{busy ? 'Lecture…' : over ? 'Déposez vos tracés' : items.length ? 'Ajoutez d’autres tracés' : 'Importez vos tracés'}</span>
            <span className="block text-[12.5px] text-neutral-500 mt-1.5 leading-none tracking-[0.03em]">GPX · FIT · TCX · KML</span>
          </span>
          {!busy && <span className="shrink-0 h-10 px-3.5 rounded-lg grid place-items-center text-[13px] font-medium text-neutral-200 bg-white/[0.07] group-hover:bg-white/[0.12] transition-colors">Parcourir</span>}
        </button>
        <div className={`h-16 flex items-center gap-3 rounded-2xl bg-white/[0.05] ring-1 pl-5 pr-2 transition-colors focus-within:bg-white/[0.08] ${error && link ? 'ring-red-400/60' : 'ring-white/10 focus-within:ring-white/30'}`}>
          <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="30" height="30" className="rounded-[6px] shrink-0" />
          <input value={link} onChange={(e) => { setLink(e.target.value); setError(''); setStravaRef(null); }} onKeyDown={(e) => { if (e.key === 'Enter') submitStrava(); }}
            placeholder="Collez le lien d’une activité Strava" aria-label="Lien d'activité Strava"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-white placeholder:text-neutral-500" />
          <UiButton variant="strava" size="md" className="h-11 rounded-lg px-4 text-[14px] shrink-0" loading={stravaBusy} onClick={submitStrava}>Importer</UiButton>
        </div>
      </div>
      {error && <p className="mt-2.5 text-[13px] text-red-300">{error}</p>}

      {/* Tracés ajoutés (déjà sur le poster) : supprimables, puis étape suivante */}
      {items.length > 0 && (
        <div className="mt-4 text-left ds-fade-up">
          <ul className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
            {items.map((x) => (
              <li key={x.id} className="flex items-center gap-3 pl-3.5 pr-2 h-14">
                <span className="w-8 h-8 shrink-0 rounded-lg grid place-items-center bg-white/[0.06] text-neutral-300">
                  {x.source === 'strava' ? <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="18" height="18" className="rounded-[4px]" /> : <I.Route size={15} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-medium text-white truncate">{fileLabel(x)}</span>
                  <span className="block text-[11.5px] text-neutral-500 tabular-nums">{ptKm(x.st.distanceKm || 0)} · {ptM(x.st.elevationGain)} D+</span>
                </span>
                <UiIconButton icon="X" label={'Retirer ' + fileLabel(x)} size="sm" onClick={() => removeItem(x.id)} />
              </li>
            ))}
          </ul>
          <UiButton variant="primary" size="lg" block iconRight="ChevronDown" onClick={onNext} className="mt-3">
            Personnaliser ma carte{items.length > 1 ? ` · ${items.length} tracés, ${ptKm(total)}` : ''}
          </UiButton>
        </div>
      )}

      {stravaRef && (
        <div className="mt-4 text-left rounded-2xl bg-[#fc4c02]/[0.07] ring-1 ring-[#fc4c02]/25 p-4 ds-fade-up">
          <div className="flex items-start gap-3">
            <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="28" height="28" className="rounded-md shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-white">Activité Strava n° {stravaRef.id}</div>
              <p className="text-[13px] text-neutral-300 mt-0.5 leading-snug">Téléchargez le GPX depuis votre compte Strava, puis déposez-le ici : il s'ajoute à vos tracés.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={ptStravaExportUrl(stravaRef)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold text-white bg-[#fc4c02] hover:brightness-110"><I.Download size={15} /> Télécharger le GPX</a>
                <UiButton icon="Upload" onClick={pick}>Déposer le fichier</UiButton>
              </div>
            </div>
            <UiIconButton icon="X" label="Fermer" size="sm" onClick={() => setStravaRef(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

// Grain très fin (bruit SVG) : adoucit les dégradés sur écran Retina
const SITE_GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

// ---------------------------------------------------------------- parcours en 3 étapes
// Au scroll, le poster reste au centre et l'étape active s'affiche à côté :
// 1. importer son tracé, 2. personnaliser la carte, 3. choisir fichier ou poster.
const SITE_FLOW = [
  { id: 'import', title: 'Importez votre tracé', text: 'Fichier GPX, FIT, TCX ou KML, ou lien d’une activité Strava : votre tracé s’affiche aussitôt sur le poster.' },
  { id: 'custom', title: 'Personnalisez votre carte', text: 'Nommez votre aventure, choisissez la couleur du tracé, gardez ou non vos photos.' },
  { id: 'print', title: 'Imprimez-le', text: 'Téléchargez le fichier prêt pour l’imprimeur, ou recevez votre poster chez vous, avec ou sans cadre.' },
];
// ⚠ Prix d'exemple : à remplacer par la vraie grille tarifaire
const SITE_OFFERS = [
  { id: 'file', title: 'Fichier HD', sub: 'PDF vectoriel et PNG 300 dpi, téléchargement immédiat', price: '9 €', icon: 'Download' },
  { id: 'print', title: 'Poster imprimé', sub: 'Papier mat 200 g, livré roulé sous 5 jours', price: 'dès 29 €', icon: 'Poster' },
  { id: 'frame', title: 'Poster encadré', sub: 'Cadre bois noir et verre, prêt à accrocher', price: 'dès 69 €', icon: 'Poster' },
];

function SiteOffers({ offer, onOffer, items, onImport, onCreate, opening }) {
  const ready = items.length > 0;
  return (
    <div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Format">
        {SITE_OFFERS.map((o) => {
          const on = offer === o.id;
          const Ic = I[o.icon];
          return (
            <button key={o.id} role="radio" aria-checked={on} onClick={() => onOffer(o.id)}
              className={`w-full flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left ring-1 transition-colors ${on ? 'bg-white/[0.08] ring-white/40' : 'bg-white/[0.03] ring-white/[0.08] hover:bg-white/[0.05]'}`}>
              <span className={`w-10 h-10 shrink-0 rounded-xl grid place-items-center transition-colors ${on ? 'bg-white text-neutral-900' : 'bg-white/[0.06] text-neutral-300'}`}><Ic size={18} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14.5px] font-semibold text-white">{o.title}</span>
                <span className="block text-[12.5px] text-neutral-500 leading-snug mt-0.5">{o.sub}</span>
              </span>
              <span className="shrink-0 text-[13.5px] font-semibold text-neutral-200 tabular-nums">{o.price}</span>
            </button>
          );
        })}
      </div>
      <UiButton variant="primary" size="lg" block iconRight={ready ? 'ChevronRight' : 'ChevronUp'} loading={opening} onClick={ready ? onCreate : onImport} className="mt-3">
        {ready ? (offer === 'file' ? 'Télécharger mon fichier' : 'Commander mon poster') : 'Importer mon tracé'}
      </UiButton>
      {!ready && <p className="mt-2.5 text-[12.5px] text-neutral-500 text-center">Commencez par importer votre tracé : l’exemple n’est pas à vendre.</p>}
    </div>
  );
}

// Étape : numéro, titre, texte puis son module
// Sur grand écran, l'étape active entre en cascade (numéro, titre, texte, module)
// depuis le sens du scroll ; l'étape quittée glisse dans l'autre sens et s'efface.
function SiteStepPanel({ i, active, desktop, dir = 1, children }) {
  const st = SITE_FLOW[i];
  const hidden = desktop && !active;
  const anim = desktop && active ? 'site-step-in' : '';
  const d = (k) => ({ animationDelay: `${k * 70}ms` });
  return (
    <div aria-hidden={hidden || undefined} inert={hidden ? '' : undefined} style={{ '--site-dy': `${dir * 22}px`, transform: hidden ? `translateY(${-dir * 18}px)` : undefined }}
      className={`self-start transition-[opacity,transform,filter] duration-300 ease-out ${hidden ? 'opacity-0 pointer-events-none blur-[2px]' : 'opacity-100'}`}>
      <div className={`flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-neutral-500 ${anim}`} style={d(0)}>
        <span className="tabular-nums text-white">0{i + 1}</span><span className={`h-px bg-white/25 ${desktop && active ? 'site-line-in' : 'w-6'}`} />Étape {i + 1} sur 3
      </div>
      <h2 className={`mt-3 text-[26px] leading-tight font-semibold text-white tracking-[-0.02em] ${anim}`} style={{ fontFamily: 'var(--ds-font-site)', ...d(1) }}>{st.title}</h2>
      <p className={`mt-2 text-[15px] leading-relaxed text-neutral-400 ${anim}`} style={d(2)}>{st.text}</p>
      <div className={`mt-6 ${anim}`} style={d(3)}>{children}</div>
    </div>
  );
}

// Progression verticale (à droite du poster) : cliquable pour aller à une étape
function SiteStepRail({ step, progress, onGo }) {
  return (
    <ol className="relative flex flex-col gap-7">
      <span aria-hidden="true" className="absolute left-[15px] top-4 bottom-4 w-px bg-white/10" />
      <span aria-hidden="true" className="absolute left-[15px] top-4 w-px bg-white/60 transition-[height] duration-150" style={{ height: `calc((100% - 32px) * ${progress})` }} />
      {SITE_FLOW.map((st, i) => {
        const on = i === step, done = i < step;
        return (
          <li key={st.id}>
            <button onClick={() => onGo(i)} aria-current={on ? 'step' : undefined} className="group relative flex items-center gap-3.5 text-left">
              {on && <span key={step} aria-hidden="true" className="site-rail-pulse absolute left-0 top-1/2 -mt-4 w-8 h-8 rounded-full" />}
              <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-[12.5px] font-semibold tabular-nums ring-1 transition-all duration-300 ${on ? 'scale-110 bg-white text-neutral-900 ring-white' : done ? 'bg-[#1a1a1a] text-white ring-white/50' : 'bg-[#121212] text-neutral-500 ring-white/15 group-hover:text-white'}`}>
                {done ? <I.Check size={14} /> : i + 1}
              </span>
              <span className={`text-[14px] transition-colors ${on ? 'text-white font-medium' : 'text-neutral-500 group-hover:text-neutral-300'}`}>{st.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- page
function PrintraceSite() {
  const [caseId, setCaseId] = useSiteState('trek');
  const [auto, setAuto] = useSiteState(true); // défilement des cas d'usage tant qu'on n'a pas choisi
  const c = SITE_CASES.find((x) => x.id === caseId);
  useSiteEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setCaseId((id) => SITE_CASES[(SITE_CASES.findIndex((x) => x.id === id) + 1) % SITE_CASES.length].id), SITE_ROTATE_MS);
    return () => clearTimeout(t);
  }, [caseId, auto]);
  const stop = () => setAuto(false);
  const [customs, setCustoms] = useSiteState({}); // personnalisation par cas d'usage
  // Photos du cas d'usage (fichiers locaux, Unsplash ou illustration)
  const [photoSet, setPhotoSet] = useSiteState({});
  useSiteEffect(() => {
    if (photoSet[caseId]) return;
    let live = true;
    Promise.all([0, 1].map((i) => siteResolvePhoto(c, i))).then((ps) => { if (live) setPhotoSet((m) => ({ ...m, [caseId]: ps })); });
    return () => { live = false; };
  }, [caseId]);
  const photos = photoSet[caseId] || [];
  const custom = customs[caseId] || {};
  // Tracés importés par le visiteur (affichés sur le poster), format choisi à l'étape 3
  const [items, setItems] = useSiteState([]);
  const [offer, setOffer] = useSiteState('frame');
  const [opening, setOpening] = useSiteState(false);
  useSiteEffect(() => { if (items.length) stop(); }, [items.length]);

  // Parcours au scroll (grand écran) : la zone fait 3 hauteurs d'écran, le poster y reste collé
  const scroller = useSiteRef(null), flow = useSiteRef(null);
  const [desktop, setDesktop] = useSiteState(false);
  const [progress, setProgress] = useSiteState(0);
  useSiteEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const onScroll = () => {
    const sc = scroller.current, el = flow.current;
    if (!sc || !el) return;
    const total = el.offsetHeight - sc.clientHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total)) : 0;
    setProgress(p);
  };
  const step = progress < 0.25 ? 0 : progress < 0.75 ? 1 : 2;
  const lastStep = useSiteRef(0), [dir, setDir] = useSiteState(1);
  const posterBox = useSiteRef(null);
  useSiteEffect(() => {
    if (step > 0) stop();
    if (step === lastStep.current) return;
    setDir(step > lastStep.current ? 1 : -1);
    lastStep.current = step;
    // Le poster « respire » à chaque étape : léger recul puis retour, avec un éclat
    const el = posterBox.current;
    if (el && el.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(0.975)', filter: 'brightness(1.12)', offset: 0.35 }, { transform: 'scale(1)', filter: 'brightness(1)' }],
        { duration: 650, easing: 'cubic-bezier(.22,.8,.3,1)' });
    }
  }, [step]);
  const goTo = (i) => {
    const sc = scroller.current, el = flow.current;
    if (!sc || !el) return;
    if (!desktop) { const t = document.getElementById('site-step-' + i); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const top = el.getBoundingClientRect().top + sc.scrollTop, total = el.offsetHeight - sc.clientHeight;
    sc.scrollTo({ top: top + total * [0, 0.5, 1][i], behavior: 'smooth' });
  };
  const create = async () => {
    setOpening(true);
    try { await siteOpenStudio(items, c, items.every((x) => x.source === 'strava') ? 'strava' : undefined, { title: custom.title, color: custom.color }); }
    catch (e) { /* le studio reste joignable depuis le lien */ }
    setOpening(false);
  };
  const finish = desktop && step < 2 ? 'frame' : desktop ? offer : 'frame';

  return (
    <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto sb-scroll font-site bg-[#0a0a0a] text-white lg:[scroll-snap-type:y_proximity]">
     <div className="relative isolate min-h-full overflow-x-clip">
      {/* Fond : grille fine qui s'estompe vers le bas et les bords + grain léger contre le banding */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '32px 32px', backgroundPosition: 'center top',
        maskImage: 'radial-gradient(90% 60% at 50% 0%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)', WebkitMaskImage: 'radial-gradient(90% 60% at 50% 0%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: SITE_GRAIN }} />
      {/* Fond noir ; seule la zone du poster est éclairée */}
      <div className="relative overflow-x-clip">
        <nav className="relative z-20 max-w-[1240px] mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <a href="./" aria-label="Printrace" className="text-white"><UiPrintraceLogo height={29} /></a>
          <SiteProof />
        </nav>

        {/* Titre centré en haut ; le parcours en 3 étapes suit */}
        <section className="relative z-10 max-w-[1240px] mx-auto px-5 sm:px-8 pt-12 lg:pt-20 pb-10 lg:pb-0">
          <div className="text-center">
            {/* Deux lignes fixes : la hauteur ne bouge pas quand le mot change */}
            <h1 className="font-display font-extrabold tracking-[-0.035em] leading-[1.08] text-[clamp(34px,4.4vw,62px)]">
              <span className="block text-white/90">Imprimez votre</span>
              <span className="block" onMouseEnter={stop}><SiteUseCasePicker value={caseId} auto={auto} onChange={(id) => { setCaseId(id); stop(); }} onInteract={stop} /></span>
            </h1>
            <p key={c.id} className="ds-fade-up mt-5 text-[17px] sm:text-[18px] leading-relaxed text-neutral-400 max-w-[560px] mx-auto">
              {c.pitch}
            </p>
          </div>
        </section>
      </div>

      {/* Parcours en 3 étapes : poster collé au centre, étape active à gauche, progression à droite */}
      <section ref={flow} aria-label="Créer votre poster" className="relative lg:h-[300vh]">
        {/* Points d'arrêt du scroll : un par étape */}
        {[0, 1, 2].map((k) => <span key={k} aria-hidden="true" className="hidden lg:block absolute left-0 w-px h-px" style={{ top: `${k * 100}vh`, scrollSnapAlign: 'start' }} />)}
        <div className="lg:sticky lg:top-0 lg:h-screen flex items-start lg:pt-[max(36px,5vh)]">
          <div className="w-full max-w-[1360px] mx-auto px-5 sm:px-8 pb-20 lg:pb-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-12 lg:gap-10 items-start">
            {/* Étapes : superposées et en fondu sur grand écran, à la suite sur mobile */}
            {/* Mobile : étape 1, poster, étapes 2 et 3 (le conteneur s'efface, ses enfants rejoignent la grille) */}
            <div className="contents lg:grid lg:grid-cols-[minmax(0,1fr)] lg:order-1 lg:w-full lg:max-w-[420px] lg:mr-0 lg:ml-auto lg:pt-1">
              <div id="site-step-0" style={{ gridArea: desktop ? '1 / 1' : undefined }} className="order-1 lg:order-none grid grid-cols-[minmax(0,1fr)] w-full max-w-[420px] mx-auto lg:max-w-none">
                <SiteStepPanel i={0} active={step === 0} desktop={desktop} dir={dir}><SiteImport c={c} items={items} setItems={setItems} onNext={() => goTo(1)} /></SiteStepPanel>
              </div>
              <div id="site-step-1" style={{ gridArea: desktop ? '1 / 1' : undefined }} className="order-3 lg:order-none grid grid-cols-[minmax(0,1fr)] w-full max-w-[420px] mx-auto lg:max-w-none">
                <SiteStepPanel i={1} active={step === 1} desktop={desktop} dir={dir}>
                  <SiteCustomize c={c} items={items} value={custom} onChange={(v) => { stop(); setCustoms((m) => ({ ...m, [caseId]: v })); }} />
                  <button onClick={() => goTo(2)} className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-neutral-300 hover:text-white transition-colors">Choisir le format <I.ChevronDown size={15} /></button>
                </SiteStepPanel>
              </div>
              <div id="site-step-2" style={{ gridArea: desktop ? '1 / 1' : undefined }} className="order-4 lg:order-none grid grid-cols-[minmax(0,1fr)] w-full max-w-[420px] mx-auto lg:max-w-none">
                <SiteStepPanel i={2} active={step === 2} desktop={desktop} dir={dir}>
                  <SiteOffers offer={offer} onOffer={setOffer} items={items} onImport={() => goTo(0)} onCreate={create} opening={opening} />
                </SiteStepPanel>
              </div>
            </div>

            <div className="order-2 lg:order-2 relative w-full max-w-[400px] lg:max-w-none lg:w-[min(440px,calc((100vh_-_120px)/1.5))] mx-auto">
              {/* Photo du trip fondue dans le fond, décalée à droite du cadre */}
              {c.heroBg != null && photos[c.heroBg] && (
                <div key={c.id} aria-hidden="true" className="pointer-events-none absolute left-[5%] -right-[92%] -top-[22%] -bottom-[16%] ds-fade-up" style={{
                  maskImage: 'radial-gradient(closest-side, #000 15%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.12) 75%, transparent 92%)', WebkitMaskImage: 'radial-gradient(closest-side, #000 15%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.12) 75%, transparent 92%)' }}>
                  <img src={photos[c.heroBg].src} alt="" decoding="async" fetchpriority="low" className="w-full h-full object-cover opacity-[0.3] saturate-[0.8]" />
                </div>
              )}
              <div ref={posterBox}><SitePoster c={c} photos={photoSet[caseId] || null} custom={custom} items={items} finish={finish} /></div>
            </div>

            <div className="hidden lg:flex lg:order-3 lg:mr-auto lg:pt-10 relative z-10">
              <SiteStepRail step={step} progress={progress} onGo={goTo} />
            </div>
          </div>
        </div>
      </section>
     </div>
    </div>
  );
}

// Page pré-rendue au build (HTML déjà là) : React s'y raccroche sans tout redessiner
const siteRootEl = document.getElementById('root');
if (siteRootEl.firstElementChild) ReactDOM.hydrateRoot(siteRootEl, <PrintraceSite />);
else ReactDOM.createRoot(siteRootEl).render(<PrintraceSite />);
