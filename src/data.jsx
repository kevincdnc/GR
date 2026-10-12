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

// Demo data restored for Pro users (toggle from the bottom-bar Pro/Free tag).
const PRO_SEED_GROUPS = [
  {
    id: 'g_bretagne',
    name: 'Bretagne côtière',
    icon: 'Folder',
    expanded: true,
    itineraries: [
      {
        id: 'i_douaniers',
        name: 'Sentier des Douaniers',
        activity: 'hiking',
        distance: 20.95,
        ascent: 854,
        time: '5h 20',
        color: 'rose',
        difficulty: 'Modérée',
        path: 'M180,540 C220,520 260,500 300,470 S360,430 400,410 460,380 500,360 540,310 580,280 620,240 660,210 700,180 740,170',
      },
      {
        id: 'i_baie',
        name: 'Baie de Douarnenez',
        activity: 'trail',
        distance: 14.2,
        ascent: 412,
        time: '3h 15',
        color: 'emerald',
        difficulty: 'Facile',
        path: 'M200,600 C260,610 320,590 380,560 S480,530 540,510 620,490 680,470',
      },
      {
        id: 'i_crozon',
        name: 'Presqu\'île de Crozon',
        activity: 'hiking',
        distance: 28.6,
        ascent: 1180,
        time: '7h 40',
        color: 'amber',
        difficulty: 'Difficile',
        path: 'M120,400 C160,380 200,360 240,340 S320,310 380,290 460,260 500,230 580,200 620,180 700,170 740,160 800,140 860,120',
      },
      {
        id: 'i_pointe',
        name: 'Pointe du Raz boucle',
        activity: 'running',
        distance: 8.4,
        ascent: 220,
        time: '1h 10',
        color: 'violet',
        difficulty: 'Facile',
        path: 'M280,250 C310,260 340,280 370,300 S420,340 410,380 360,420 320,400 270,360 280,320 290,280 280,250',
      },
    ],
  },
  {
    id: 'g_courses',
    name: 'Mes courses',
    icon: 'Folder',
    expanded: false,
    itineraries: [
      {
        id: 'i_marathon',
        name: 'Marathon du Mont-Blanc',
        activity: 'trail',
        color: 'orange',
        difficulty: 'Extrême',
        sectionsExpanded: false,
        sections: [
          { id: 's_mb_1', name: 'Étape 1 — Chamonix → Plan Praz',    distance: 8.4,  ascent: 720, path: 'M150,650 C190,630 230,605 270,580 S330,540 360,520' },
          { id: 's_mb_2', name: 'Étape 2 — Plan Praz → Flegere',     distance: 11.2, ascent: 680, path: 'M360,520 S430,480 490,440 560,395 620,360' },
          { id: 's_mb_3', name: 'Étape 3 — Flegere → Tete aux Vents', distance: 13.0, ascent: 740, path: 'M620,360 S720,310 800,265 880,225 930,200' },
          { id: 's_mb_4', name: 'Étape 4 — Descente Argentière',     distance: 9.4,  ascent: 400, path: 'M930,200 S1000,170 1040,150 1060,130 1060,120' },
        ],
      },
      {
        id: 'i_ttg',
        name: 'Trail des Templiers',
        activity: 'trail',
        color: 'teal',
        difficulty: 'Extrême',
        sectionsExpanded: false,
        sections: [
          { id: 's_tt_1', name: 'Section 1 — Millau → Causse Noir',  distance: 24.0, ascent: 1120, path: 'M100,700 C160,680 220,650 280,620 S360,560 400,530' },
          { id: 's_tt_2', name: 'Section 2 — Causse → Templiers',    distance: 28.0, ascent: 1280, path: 'M400,530 S480,470 540,440 640,380 720,330' },
          { id: 's_tt_3', name: 'Section 3 — Templiers → Roquefort', distance: 23.0, ascent: 1000, path: 'M720,330 S830,250 920,200 1020,160 1080,140' },
        ],
      },
      {
        id: 'i_10k',
        name: '10K parc municipal',
        activity: 'running',
        distance: 10.0,
        ascent: 65,
        time: '0h 52',
        color: 'pink',
        difficulty: 'Facile',
        path: 'M520,420 C540,400 570,395 600,400 S640,420 650,450 640,490 610,500 570,495 550,475 520,450 520,420',
      },
    ],
  },
  {
    id: 'g_mercantour',
    name: 'Voyage Mercantour',
    icon: 'Folder',
    expanded: false,
    itineraries: [
      {
        id: 'i_madone',
        name: 'Cime de la Madone',
        activity: 'hiking',
        distance: 16.8,
        ascent: 1320,
        time: '5h 50',
        color: 'lime',
        difficulty: 'Difficile',
        path: 'M300,620 C340,580 380,540 420,500 S480,440 520,400 580,360 620,330',
      },
      {
        id: 'i_gelas',
        name: 'Mont Gelas',
        activity: 'trail',
        distance: 22.4,
        ascent: 1850,
        time: '8h 15',
        color: 'sky',
        difficulty: 'Difficile',
        path: 'M400,680 C440,640 480,600 520,560 S580,500 620,460 680,420 720,390 780,360 820,340',
      },
    ],
  },
  {
    id: 'g_explorer',
    name: 'À explorer plus tard',
    icon: 'Folder',
    expanded: false,
    itineraries: [
      {
        id: 'i_gr20',
        name: 'GR20 — étape 4',
        activity: 'hiking',
        distance: 18.3,
        ascent: 1420,
        time: '7h 00',
        color: 'amber',
        difficulty: 'Difficile',
        path: 'M500,500 C540,470 580,440 620,410 S680,360 720,330 780,290 820,270',
      },
    ],
  },
];

function fmtDist(km) {
  if (km < 10) return km.toFixed(1) + ' km';
  return Math.round(km) + ' km';
}
function fmtAscent(m) {
  const n = Math.round(m);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m';
}

// Estimated moving time, based on an average pace per activity plus a climbing
// penalty (Naismith-style: ~+1 min per 10 m of ascent). Returns minutes.
const ACTIVITY_SPEED = {
  running: 9.5, trail: 7.5, hiking: 4.2, walking: 4.5,
  roadBike: 22, gravel: 16, mtb: 12,
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

Object.assign(window, { ROUTE_COLORS, ACTIVITIES, SEED_GROUPS, PRO_SEED_GROUPS, fmtDist, fmtAscent, itineraryStats, estimateDurationMin, fmtDuration });

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
