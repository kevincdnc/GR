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
// (window.GR34_STAGES, cf. scripts/build.mjs). Chaque étape devient une section
// de l'itinéraire « GR34 » ; ses coords portent l'altitude : [lat, lng, ele].
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
      itineraries: [
        {
          id: 'i_gr34',
          name: 'GR34',
          activity: 'hiking',
          color: GR34_SECTION_COLORS[0],
          difficulty: 'Modérée',
          fromRepo: true,
          sectionsExpanded: true,
          sections: stages.map((st, i) => ({
            id: 's_gr34_' + st.num,
            num: st.num,
            name: 'Étape ' + st.num + ' — ' + st.name,
            color: GR34_SECTION_COLORS[i % GR34_SECTION_COLORS.length],
            distance: st.distanceKm,
            ascent: st.elevationGain,
            descent: st.elevationLoss,
            coords: st.coords,
          })),
        },
      ],
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

Object.assign(window, { ROUTE_COLORS, ACTIVITIES, SEED_GROUPS, PRO_SEED_GROUPS, buildGr34Groups, GR34_SECTION_COLORS, fmtDist, fmtAscent, itineraryStats, estimateDurationMin, fmtDuration });

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
