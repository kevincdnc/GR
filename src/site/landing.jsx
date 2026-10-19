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

const SITE_PROOF = { rating: '4,9', label: 'avis', count: '2 400+' };

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
// Photos : vraies photos du trip dans assets/site/<cas>-1.jpg et -2.jpg (portrait,
// ~800 × 1000 px) ; tant qu'elles manquent, une illustration prend leur place.
const SITE_CASES = [
  {
    id: 'trek', accent: '#34d399', word: 'trek', label: 'Trek & randonnée', example: 'GR20, Tour du Mont-Blanc, Compostelle…', icon: 'Footprints', activity: 'hiking',
    pitch: 'Votre trek de plusieurs jours, en poster prêt à encadrer.',
    poster: {
      tpl: 'blueprint', color: 'auto', bg: '#0f1d33', mapStyle: 'epure', mapOpacity: 40, title: 'GR20', subtitle: 'Corse · Calenzana → Conca',
      metrics: ['distance', 'ascent', 'duration'], values: { distance: '180 km', ascent: '12 000 m', duration: '15 jours' }, photos: 1,
      route: { name: 'GR20', seed: 11, way: [[42.508, 8.855, 270], [42.455, 8.905, 1520], [42.405, 8.93, 1980], [42.355, 8.965, 2130], [42.33, 9.01, 1640], [42.285, 9.045, 2225], [42.235, 9.075, 1600], [42.2, 9.12, 1450], [42.15, 9.135, 2350], [42.09, 9.16, 1190], [42.03, 9.19, 1580], [41.975, 9.18, 1800], [41.9, 9.215, 1350], [41.86, 9.25, 2134], [41.82, 9.295, 1240], [41.775, 9.33, 1500], [41.733, 9.343, 250]] },
    },
    photos: [{ src: 'assets/site/trek-1.jpg', caption: 'GR20 · jour 6' }, { src: 'assets/site/trek-2.jpg', caption: 'Lac de Nino' }],
  },
  {
    id: 'marathon', accent: '#fb7a3c', word: 'marathon', label: 'Marathon & course', example: 'Paris, Berlin, New York, votre premier semi…', icon: 'Run', activity: 'running',
    pitch: 'Votre course mythique et votre temps, en poster prêt à encadrer.',
    poster: {
      tpl: 'nuit', color: '#fc5200', mapStyle: 'routes', mapOpacity: 100, title: 'Marathon de Paris', subtitle: '42,195 km · 6 avril 2026',
      metrics: ['distance', 'duration', 'pace'], values: { distance: '42,2 km', duration: '3 h 42', pace: "5'15\"/km" },
      route: { name: 'Marathon de Paris', seed: 5, rough: 0.12, depth: 5, way: [[48.8738, 2.2950], [48.8656, 2.3212], [48.8606, 2.3376], [48.8566, 2.3522], [48.8530, 2.3690], [48.8443, 2.3920], [48.8390, 2.4100], [48.8335, 2.4330], [48.8290, 2.4440], [48.8225, 2.4320], [48.8300, 2.4050], [48.8410, 2.3790], [48.8505, 2.3570], [48.8580, 2.3360], [48.8610, 2.3150], [48.8580, 2.2945], [48.8510, 2.2780], [48.8460, 2.2560], [48.8575, 2.2470], [48.8680, 2.2550], [48.8715, 2.2760]] },
    },
    photos: [{ src: 'assets/site/marathon-1.jpg', caption: 'Ligne d’arrivée' }, { src: 'assets/site/marathon-2.jpg', caption: 'Km 30, le mur' }],
  },
  {
    id: 'roadtrip', accent: '#facc15', word: 'road trip', label: 'Road trip', example: 'Pacific Coast Highway, Islande, Route 66…', icon: 'Route', activity: 'roadtrip',
    pitch: 'Toutes les étapes de votre road trip, réunies sur un seul poster.',
    poster: {
      tpl: 'blueprint', color: '#facc15', bg: '#141414', mapStyle: 'epure', mapOpacity: 55, title: 'Pacific Coast Hwy', subtitle: 'San Francisco → Los Angeles',
      metrics: ['distance', 'stages', 'duration'], values: { distance: '750 km', stages: '6', duration: '7 jours' }, photos: 2,
      route: { name: 'Pacific Coast Highway', seed: 3, rough: 0.14, depth: 5, way: [[37.7749, -122.4194, 20], [37.50, -122.47, 30], [37.25, -122.40, 40], [36.97, -122.03, 10], [36.60, -121.89, 20], [36.27, -121.81, 200], [35.95, -121.48, 300], [35.66, -121.25, 80], [35.37, -120.85, 20], [35.28, -120.66, 70], [34.95, -120.43, 100], [34.42, -119.70, 15], [34.27, -119.23, 10], [34.03, -118.78, 20], [34.05, -118.24, 90]] },
    },
    photos: [{ src: 'assets/site/roadtrip-1.jpg', caption: 'Big Sur' }, { src: 'assets/site/roadtrip-2.jpg', caption: 'Highway 1' }],
  },
  {
    id: 'moto', accent: '#60a5fa', word: 'moto trip', label: 'Moto trip', example: 'Route des Grandes Alpes, cols pyrénéens…', icon: 'Moto', activity: 'moto',
    pitch: 'Chaque col et chaque virage de votre virée, au mur.',
    poster: {
      tpl: 'nuit', color: '#ffffff', mapStyle: 'routes', mapOpacity: 100, title: 'Route des Grandes Alpes', subtitle: 'Thonon → Menton · 16 cols',
      metrics: ['distance', 'altMax', 'duration'], values: { distance: '720 km', altMax: '2 802 m', duration: '5 jours' },
      route: { name: 'Route des Grandes Alpes', seed: 9, rough: 0.2, way: [[46.37, 6.48, 380], [46.20, 6.55, 900], [45.99, 6.47, 1613], [45.87, 6.47, 1486], [45.69, 6.69, 1967], [45.55, 6.88, 800], [45.42, 7.03, 2764], [45.24, 6.68, 1100], [45.06, 6.41, 2642], [44.89, 6.64, 1300], [44.82, 6.73, 2360], [44.62, 6.75, 1100], [44.39, 6.65, 1132], [44.32, 6.81, 2802], [44.10, 7.10, 900], [43.90, 7.35, 500], [43.77, 7.50, 10]] },
    },
    photos: [{ src: 'assets/site/moto-1.jpg', caption: 'Col de la Bonette' }, { src: 'assets/site/moto-2.jpg', caption: 'Lacets du Galibier' }],
  },
];

// Données de rendu du poster d'exemple (même forme que dataFor du studio)
function siteRouteOf(c) {
  const r = c.poster.route;
  const coords = siteTrace(r.way, r);
  return { id: 'demo_' + c.id, name: r.name, color: '#ffffff', coords, distance: 0, ascent: 0, descent: 0, durationMin: 0, durationReal: false, altMax: null, activity: c.activity, date: '' };
}
function sitePosterData(c, route, photos = []) {
  const p = c.poster, act = poActivity(c.activity);
  const agg = poAggregate([route], act);
  const stats = poStats(agg, p.metrics, { activity: act.label, start: route.coords[0] })
    .map((st) => (p.values[st.key] ? { ...st, value: p.values[st.key], unit: '' } : st));
  return {
    routes: [route], agg, color: p.color, coords: true, activityLabel: act.label, title: p.title, subtitle: p.subtitle, stats,
    photoSlot: false, photos, bgPhoto: null, showMap: true, mapStyle: p.mapStyle, mapOpacity: p.mapOpacity / 100, mapLabels: true,
    bg: p.bg || null, preview: false,
  };
}

// Photos posées sur le poster d'exemple : les vraies photos du trip
// (assets/site/<cas>-N.jpg) ou, à défaut, l'illustration rendue en image.
const siteImgCache = {};
function siteLoadImg(src) {
  if (!src) return Promise.resolve(null);
  if (!siteImgCache[src]) siteImgCache[src] = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  return siteImgCache[src];
}
function siteSceneImg(kind, alt) {
  const host = document.createElement('div');
  const root = ReactDOM.createRoot(host);
  ReactDOM.flushSync(() => root.render(<SiteScene kind={kind} alt={alt} />));
  const svg = host.innerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720" ');
  root.unmount();
  return siteLoadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}
async function sitePosterPhotos(c) {
  const out = [];
  for (let i = 0; i < (c.poster.photos || 0); i++) {
    const img = (await siteLoadImg((c.photos[i] || {}).src)) || (await siteSceneImg(c.id, i === 1));
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
    <div className="flex items-center gap-2.5" aria-label={`Noté ${SITE_PROOF.rating} sur 5 par ${SITE_PROOF.count} clients`}>
      <div className="flex -space-x-2 scale-[0.85] origin-right">{[0, 1, 2].map((i) => <SiteAvatar key={i} i={i} />)}</div>
      <div className="flex items-center gap-1 text-[13px] leading-none">
        <span className="font-semibold text-neutral-100 tabular-nums">{SITE_PROOF.rating}</span>
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-amber-400" fill="currentColor" aria-hidden="true"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" /></svg>
        <span className="hidden sm:inline text-neutral-500 tabular-nums">({SITE_PROOF.count} {SITE_PROOF.label})</span>
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
function SitePhoto({ c, i, className = '', rotate = 0, style }) {
  const ph = c.photos[i] || {};
  const [broken, setBroken] = useSiteState(false);
  useSiteEffect(() => setBroken(false), [ph.src]); // nouvelle photo à chaque cas d'usage
  return (
    <figure className={`absolute pointer-events-none select-none rounded-[6px] bg-[#f4f1ea] p-2.5 pb-9 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] ${className}`} style={{ ...style, transform: `rotate(${rotate}deg)` }}>
      <div key={c.id} className="w-full h-full rounded-[3px] overflow-hidden ds-fade-up bg-neutral-300">
        {ph.src && !broken ? <img src={ph.src} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} /> : <SiteScene kind={c.id} alt={i === 1} />}
      </div>
      <figcaption className="absolute left-0 right-0 bottom-2.5 text-center text-[12px] font-medium text-neutral-600" style={{ fontFamily: 'var(--ds-font-site)' }}>{ph.caption}</figcaption>
    </figure>
  );
}

// Poster d'exemple rendu par le moteur du studio, dans un cadre noir
function SitePoster({ c }) {
  const ref = useSiteRef(null);
  const [ready, setReady] = useSiteState(false);
  const route = useSiteMemo(() => siteRouteOf(c), [c.id]);
  const fmt = POSTER_FORMATS[1]; // A3
  useSiteEffect(() => {
    let live = true;
    setReady(false);
    (async () => {
      await storyFontsReady();
      const cv = ref.current; if (!cv || !live) return;
      const tpl = POSTER_TEMPLATES.find((t) => t.id === c.poster.tpl) || POSTER_TEMPLATES[0];
      const w = 900; cv.width = w; cv.height = Math.round(w * fmt.mm[1] / fmt.mm[0]);
      const photos = await sitePosterPhotos(c);
      if (!live) return;
      await renderPoster(cv, tpl, sitePosterData(c, route, photos), fmt, 'none', w / PO_W);
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [c.id]);
  return (
    <div className="relative mx-auto w-[min(480px,80vw)]">
      {/* Halo et ombre au sol : le poster se détache du fond */}
      <div className="pointer-events-none absolute -inset-x-[40%] -top-[12%] bottom-[10%] -z-10" style={{ background: `radial-gradient(50% 45% at 50% 45%, ${c.accent}24, transparent 70%)` }} />
      <div className="relative p-[3.2%] bg-[#151515] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]" style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}` }}>
        <canvas ref={ref} className={`block w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' }} />
        {!ready && <div className="absolute inset-[3.2%] grid place-items-center bg-neutral-900"><UiSpinner size={20} className="text-neutral-500" /></div>}
      </div>
      <div className="pointer-events-none mx-auto -mt-2 h-6 w-[86%] rounded-[50%] bg-black/50 blur-xl" />
      <div className="mt-3 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] ring-1 ring-white/10 px-3 h-7 text-[12px] text-neutral-300">
          <I.Poster size={13} /> Exemple · {c.poster.title} · A3
        </span>
      </div>
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
        className="group relative inline-flex items-baseline gap-[0.12em] text-white rounded-xl px-[0.08em] -mx-[0.08em] hover:bg-white/[0.04] transition-colors">
        <span key={value} className="ds-fade-up relative inline-block" style={{ color: c.accent }}>
          {c.word}
          {/* Trait discret en pointillés ; en lecture auto, il se remplit jusqu'au mot suivant */}
          {/* Fine barre de progression : rail discret, remplissage dans la couleur du mot */}
          <span aria-hidden="true" className="site-bar absolute left-[0.04em] right-[0.04em] -bottom-[0.08em] overflow-hidden" style={{ background: c.accent + '26' }}>
            {auto
              ? <span key={value} className="site-bar-fill block h-full" style={{ background: c.accent, animationDuration: `${SITE_ROTATE_MS}ms` }} />
              : <span className="block h-full w-full" style={{ background: c.accent + '99' }} />}
          </span>
        </span>
        <span className="text-neutral-500 group-hover:text-white transition-colors self-center" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
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
async function siteOpenStudio(stages, c, source) {
  const parts = stages.map(({ st, name }) => ({
    name: (st.to ? st.from + ' → ' + st.to : st.from) || name.replace(/\.[^.]+$/, ''),
    color: '', distance: st.distanceKm, ascent: st.elevationGain, descent: st.elevationLoss,
    durationMin: st.gpxMovingMin || 0, date: st.gpxDate ? st.gpxDate.slice(0, 10) : '', coords: st.coords,
  }));
  const code = await window.RoutdoorLink.encodeShare({ title: parts.length > 1 ? 'Mon ' + c.word : '', parts }, 6000);
  const url = siteStudioUrl() + '#t=' + code + '&a=' + c.activity + '&src=site' + (source === 'strava' ? '&from=strava' : '');
  const sameSite = /github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  if (sameSite) location.href = url; else window.open(url, '_blank', 'noopener');
}

function SiteImport({ c }) {
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
    if (!ok.length) { setBusy(false); setError('Impossible de lire ce fichier.'); return; }
    try { await siteOpenStudio(ok, c, source); } catch (e) { setError('Ouverture du studio impossible.'); }
    setBusy(false);
  };
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
    <div className="w-full max-w-[780px] mx-auto">
      <input ref={fileRef} type="file" multiple accept={TRACK_ACCEPT} className="hidden" onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }} />
      {/* Fichier et lien Strava côte à côte, sur une seule ligne (empilés sur mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={pick}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); importFiles(e.dataTransfer.files); }}
          className={`group h-16 rounded-2xl border-[1.5px] border-dashed flex items-center gap-3 pl-2.5 pr-2.5 text-left transition-all ${over ? 'border-white bg-white/[0.08] scale-[1.01]' : 'border-white/25 bg-white/[0.03] hover:border-white/50 hover:bg-white/[0.05]'}`}>
          <span className={`w-11 h-11 shrink-0 rounded-xl grid place-items-center ring-1 transition-colors ${over ? 'bg-white text-neutral-900 ring-white' : 'bg-white/[0.07] text-white ring-white/10 group-hover:bg-white group-hover:text-neutral-900'}`}>
            {busy ? <UiSpinner size={18} /> : <I.Upload size={19} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-white leading-tight">{busy ? 'Lecture du tracé…' : over ? 'Déposez votre tracé' : 'Importez votre tracé'}</span>
            <span className="block text-[12px] text-neutral-500 mt-1 tracking-[0.04em]">GPX · FIT · TCX · KML</span>
          </span>
          {!busy && <span className="shrink-0 h-10 px-3.5 rounded-lg grid place-items-center text-[13px] font-medium text-neutral-200 bg-white/[0.07] group-hover:bg-white/[0.12] transition-colors">Parcourir</span>}
        </button>
        <div className={`h-16 flex items-center gap-3 rounded-2xl bg-white/[0.05] ring-1 pl-5 pr-2 transition-colors focus-within:bg-white/[0.08] ${error && link ? 'ring-red-400/60' : 'ring-white/10 focus-within:ring-white/30'}`}>
          <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="24" height="24" className="rounded-[5px] shrink-0" />
          <input value={link} onChange={(e) => { setLink(e.target.value); setError(''); setStravaRef(null); }} onKeyDown={(e) => { if (e.key === 'Enter') submitStrava(); }}
            placeholder="Ou collez votre lien Strava" aria-label="Lien d'activité Strava"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-white placeholder:text-neutral-500" />
          <UiButton variant="strava" size="md" className="h-12 rounded-lg px-5 text-[14.5px]" loading={stravaBusy} onClick={submitStrava}>Importer</UiButton>
        </div>
      </div>
      {error && <p className="mt-2.5 text-[13px] text-red-300">{error}</p>}

      {stravaRef && (
        <div className="mt-4 text-left rounded-2xl bg-[#fc4c02]/[0.07] ring-1 ring-[#fc4c02]/25 p-4 ds-fade-up">
          <div className="flex items-start gap-3">
            <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="28" height="28" className="rounded-md shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-white">Activité Strava n° {stravaRef.id}</div>
              <p className="text-[13px] text-neutral-300 mt-0.5 leading-snug">Téléchargez le GPX depuis votre compte Strava, puis déposez-le ici : votre poster s'ouvre aussitôt.</p>
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

  return (
    <div className="h-full overflow-y-auto sb-scroll font-site bg-[#0a0a0a] text-white">
      {/* Fond : noir en haut, plus clair vers le poster (dégradé linéaire) */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0c0c0d 38%, #1c1c1f 62%, #2e2e33 84%, #36363b 100%)' }}>
        {/* Décor : lueur, quadrillage de plan qui s'efface */}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(255,255,255,0.08), rgba(255,255,255,0) 70%)' }} />
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px', maskImage: 'radial-gradient(70% 60% at 50% 30%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(70% 60% at 50% 30%, #000 30%, transparent 75%)' }} />

        <nav className="relative z-20 max-w-[1240px] mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <a href="./" aria-label="Printrace" className="text-white"><UiPrintraceLogo height={24} /></a>
          <SiteProof />
        </nav>

        {/* Photos du cas d'usage, de part et d'autre (en dehors de la colonne de texte) */}
        <SitePhoto c={c} i={0} rotate={-7} className="hidden lg:block z-0 top-[150px] w-[188px] h-[236px] xl:w-[214px] xl:h-[268px]" style={{ left: 'max(20px, calc(50% - 690px))' }} />
        <SitePhoto c={c} i={1} rotate={6} className="hidden lg:block z-0 top-[420px] w-[180px] h-[226px] xl:w-[204px] xl:h-[256px]" style={{ right: 'max(20px, calc(50% - 690px))' }} />

        <section className="relative z-10 max-w-[1240px] mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-24 text-center">

          {/* Deux lignes fixes : la hauteur ne bouge pas quand le mot change */}
          <h1 className="font-display font-extrabold tracking-[-0.035em] leading-[1.02] text-[clamp(36px,5.4vw,76px)]">
            <span className="block text-white/90">Imprimez votre</span>
            <span className="block" onMouseEnter={stop}><SiteUseCasePicker value={caseId} auto={auto} onChange={(id) => { setCaseId(id); stop(); }} onInteract={stop} /></span>
          </h1>
          {/* Description sur une seule ligne */}
          <p key={c.id} className="ds-fade-up mt-6 text-[17px] sm:text-[19px] leading-relaxed text-neutral-400 sm:whitespace-nowrap">
            {c.pitch}
          </p>

          <div className="mt-10"><SiteImport c={c} /></div>

          <div className="mt-12 sm:mt-14"><SitePoster c={c} /></div>
        </section>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrintraceSite />);
