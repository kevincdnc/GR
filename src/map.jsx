// Real interactive map (Leaflet) with itinerary polylines, hover highlight,
// live drawing for new itineraries, and a floating legend.

const { useState, useMemo, useEffect, useRef } = React;
const Tooltip = window.Tooltip;

// Shared elevation stats generator — used for both the live draft and any
// single visible existing route (rendered in the bottom toolbar).
function computeElevationStats(coords) {
  if (!coords || coords.length < 2) {
    return { profile: [], minAlt: 0, maxAlt: 0, ascent: 0, descent: 0, slopeMin: 0, slopeMax: 0 };
  }
  // Vraies altitudes seulement ([lat, lng, ele]) : plus aucune altitude
  // simulée. Les points sans altitude (en cours de chargement) sont
  // interpolés entre leurs voisins ; sans aucune altitude : stats vides.
  const known = [];
  coords.forEach((c, i) => { if (c.length >= 3 && typeof c[2] === 'number' && Number.isFinite(c[2])) known.push(i); });
  if (!known.length) {
    return { profile: [], minAlt: 0, maxAlt: 0, ascent: 0, descent: 0, slopeMin: 0, slopeMax: 0, noEle: true };
  }
  const partialEle = known.length < coords.length;
  const hasRealEle = true;
  const elev = new Array(coords.length);
  let k = 0;
  for (let i = 0; i < coords.length; i++) {
    while (k < known.length - 1 && known[k + 1] <= i) k++;
    const a = known[k], b = known[Math.min(k + 1, known.length - 1)];
    if (i === a) elev[i] = coords[a][2];
    else if (i < a || a === b) elev[i] = coords[i < a ? a : b][2];
    else elev[i] = coords[a][2] + (coords[b][2] - coords[a][2]) * (i - a) / (b - a);
  }
  const profile = [];
  const SAMPLES_PER_SEG = 8;
  for (let i = 0; i < coords.length - 1; i++) {
    for (let j = 0; j < SAMPLES_PER_SEG; j++) {
      const t = j / SAMPLES_PER_SEG;
      const a = elev[i] * (1 - t) + elev[i + 1] * t;
      const wobble = hasRealEle ? 0 : Math.sin((i + t) * 5.3) * 3 + Math.sin((i + t) * 12) * 1.4;
      profile.push(a + wobble);
    }
  }
  profile.push(elev[elev.length - 1]);
  let minAlt = Infinity, maxAlt = -Infinity, asc = 0, desc = 0;
  for (let i = 0; i < profile.length; i++) {
    const v = profile[i];
    if (v < minAlt) minAlt = v;
    if (v > maxAlt) maxAlt = v;
    if (i > 0) {
      const d = v - profile[i - 1];
      if (d > 0) asc += d; else desc += -d;
    }
  }
  if (hasRealEle) {
    asc = 0; desc = 0;
    let anchor = elev[0];
    for (const e of elev) {
      if (e - anchor >= 1) { asc += e - anchor; anchor = e; }
      else if (anchor - e >= 1) { desc += anchor - e; anchor = e; }
    }
  }
  const total = typeof L !== 'undefined' && coords.length >= 2
    ? coords.reduce((acc, c, i) => i === 0 ? 0 : acc + L.latLng(coords[i - 1]).distanceTo(L.latLng(c)), 0)
    : 1000;
  const hStep = total / Math.max(profile.length - 1, 1);
  let slopeMin = 0, slopeMax = 0;
  if (hasRealEle && typeof L !== 'undefined') {
    // Pente réelle sur des tronçons d'au moins 50 m (les points GPX ne sont pas
    // également espacés : un pas fixe donnerait des pentes absurdes).
    let a = 0, dist = 0;
    for (let i = 1; i < coords.length; i++) {
      dist += L.latLng(coords[i - 1]).distanceTo(L.latLng(coords[i]));
      if (dist >= 50) {
        const deg = Math.atan((elev[i] - elev[a]) / dist) * 180 / Math.PI;
        if (deg < slopeMin) slopeMin = deg;
        if (deg > slopeMax) slopeMax = deg;
        a = i; dist = 0;
      }
    }
  } else {
    for (let i = 1; i < profile.length; i++) {
      const slope = (profile[i] - profile[i - 1]) / Math.max(hStep, 1);
      const deg = Math.atan(slope) * 180 / Math.PI;
      if (deg < slopeMin) slopeMin = deg;
      if (deg > slopeMax) slopeMax = deg;
    }
  }
  return {
    profile,
    minAlt: Math.round(minAlt),
    maxAlt: Math.round(maxAlt),
    ascent: Math.round(asc),
    descent: Math.round(desc),
    slopeMin: Math.round(slopeMin),
    slopeMax: Math.round(slopeMax),
    partialEle,
  };
}

// ---- Fonds de carte réels ------------------------------------------------
// « Plan » = fond CARTO Voyager du design (par défaut). Les autres fonds
// remplacent les cartes simulées du prototype par de vraies tuiles.
const IGN_WMTS = (layer, fmt) =>
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=' + layer +
  '&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/' + fmt;
const IGN_ATTR = '© <a href="https://www.ign.fr/">IGN</a> – Géoplateforme';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BASE_LAYERS = {
  // OSM France : plan détaillé (chemins, sentiers), sans clé — CARTO exige désormais une clé API
  plan: {
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution: OSM_ATTR + ' · Fond © <a href="https://www.openstreetmap.fr">OpenStreetMap France</a>',
    subdomains: 'abc', maxNativeZoom: 20,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR + ', SRTM · © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    subdomains: 'abc', maxNativeZoom: 17,
  },
  ign: { url: IGN_WMTS('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'png'), attribution: IGN_ATTR, maxNativeZoom: 19 },
  ortho: { url: IGN_WMTS('ORTHOIMAGERY.ORTHOPHOTOS', 'jpeg'), attribution: IGN_ATTR, maxNativeZoom: 19 },
  // Carte routière IGN façon Visorando : villes, routes, sites. SCAN 1000 aux
  // petites échelles puis SCAN Régional (1/250 000) ; Esri World Street Map
  // dessous prend le relais hors de France ou si l'IGN ne répond pas.
  routiere: {
    url: IGN_WMTS('SCANREG_PYR-JPEG_WLD_WM', 'jpeg'),
    thumb: IGN_WMTS('SCANREG_PYR-JPEG_WLD_WM', 'jpeg').replace('{z}', '10').replace('{x}', '500').replace('{y}', '355'),
    thumbFallback: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/10/355/500',
    attribution: IGN_ATTR + ' (SCAN Régional, SCAN 1000) · Fond © Esri, HERE, Garmin',
    stack: [
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', maxNativeZoom: 19 },
      { url: IGN_WMTS('SCAN1000_PYR-JPEG_WLD_WM', 'jpeg'), maxNativeZoom: 10, maxZoom: 9 },
      { url: IGN_WMTS('SCANREG_PYR-JPEG_WLD_WM', 'jpeg'), maxNativeZoom: 12, minZoom: 9.0001 },
    ],
  },
  relief: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Fond © Esri, HERE, Garmin, FAO, NOAA, USGS, ' + OSM_ATTR, maxNativeZoom: 19,
  },
  sombre: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Fond © Esri, HERE, Garmin, ' + OSM_ATTR, maxNativeZoom: 16,
    overlay: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', maxNativeZoom: 16 },
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics', maxNativeZoom: 19,
  },
  winter: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR + ' · © OpenTopoMap · Pistes © <a href="https://www.opensnowmap.org">OpenSnowMap</a>',
    subdomains: 'abc', maxNativeZoom: 17,
    overlay: { url: 'https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png', maxNativeZoom: 18 },
  },
};
const MAP_MAX_ZOOM = 20;
// La carte s'étend sous la navigation flottante (16px + 340px) : on décale le
// cadrage automatique pour que les traces restent dans la partie visible.
const MAP_UNDERLAY_DESKTOP = 356;
// Largeur de carte cachée sous la navigation : aucune sur mobile (tiroir)
function mapUnderlay() { return isMobileNow() ? 0 : MAP_UNDERLAY_DESKTOP; }
// Marges de cadrage automatique : en haut la recherche, en bas la légende
function mapFitPadding(extraLeft = 60) {
  return isMobileNow()
    ? { paddingTopLeft: [28, 90], paddingBottomRight: [28, 150] }
    : { paddingTopLeft: [MAP_UNDERLAY_DESKTOP + extraLeft, 80], paddingBottomRight: [80, 80] };
}
const MAP_STYLE_KEY = 'gr34_map_style';
const MAP_OPACITY_KEY = 'gr34_map_opacity';
function savedMapOpacity() {
  try { const v = Number(localStorage.getItem(MAP_OPACITY_KEY)); return Number.isFinite(v) && v >= 0 && v <= 100 && localStorage.getItem(MAP_OPACITY_KEY) !== null ? v : 100; } catch (e) { return 100; }
}
// Opacité du fond de carte (les tracés restent opaques) — fond noir dessous
function applyMapOpacity(map, pct) {
  try { map.getPane('tilePane').style.opacity = String(pct / 100); } catch (e) {}
}
// Couleur de fond sous les tuiles (visible quand l'opacité de la carte baisse)
const MAP_BG_KEY = 'gr34_map_bg';
const MAP_BG_DEFAULT = '#171717';
function normalizeHex(v) {
  const m = String(v || '').trim().replace(/^#/, '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return '#' + h.toLowerCase();
}
function savedMapBg() {
  try { return normalizeHex(localStorage.getItem(MAP_BG_KEY)) || MAP_BG_DEFAULT; } catch (e) { return MAP_BG_DEFAULT; }
}
function applyMapBg(map, color) {
  try { map.getContainer().style.background = color; } catch (e) {}
}
function savedMapStyle() {
  try { const v = localStorage.getItem(MAP_STYLE_KEY); return BASE_LAYERS[v] ? v : 'plan'; } catch (e) { return 'plan'; }
}
// Remplace le fond de carte courant (et sa surcouche éventuelle).
function applyBaseLayer(map, key) {
  if (!map) return;
  const def = BASE_LAYERS[key] || BASE_LAYERS.plan;
  (map.__baseLayers || []).forEach((l) => { try { map.removeLayer(l); } catch (e) {} });
  const opts = (d) => ({
    attribution: d.attribution, maxZoom: MAP_MAX_ZOOM, maxNativeZoom: d.maxNativeZoom,
    ...(d.subdomains ? { subdomains: d.subdomains } : {}),
  });
  const layers = def.stack
    ? def.stack.map((d, i) => L.tileLayer(d.url, {
        ...opts(d), attribution: i === 0 ? def.attribution : '',
        ...(d.minZoom != null ? { minZoom: d.minZoom } : {}), ...(d.maxZoom != null ? { maxZoom: d.maxZoom } : {}),
      }))
    : [L.tileLayer(def.url, opts(def))];
  if (def.overlay) layers.push(L.tileLayer(def.overlay.url, { ...opts(def.overlay), attribution: '' }));
  layers.forEach((l, i) => { l.addTo(map); l.setZIndex(i); });
  map.__baseLayers = layers;
  map.__baseLayerKey = key;
}
// Ombrage du relief (« Enrichissement ») : vraie couche Esri, en multiplication.
function applyHillshade(map, on) {
  if (!map) return;
  if (map.__hillshade) { try { map.removeLayer(map.__hillshade); } catch (e) {} map.__hillshade = null; }
  if (!on) return;
  const l = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: MAP_MAX_ZOOM, maxNativeZoom: 16, opacity: 0.22, className: 'hillshade-layer',
    attribution: 'Relief © Esri',
  });
  l.addTo(map); l.setZIndex(5);
  map.__hillshade = l;
}

// Sentiers de randonnée balisés (GR, GRP, PR, chemins de Compostelle…) :
// surcouche transparente Waymarked Trails, au-dessus de n'importe quel fond.
const TRAILS_KEY = 'gr34_trails_overlay';
function savedTrailsOverlay() {
  try { const v = localStorage.getItem(TRAILS_KEY); return v === null ? true : v === '1'; } catch (e) { return true; }
}
function applyTrailsOverlay(map, on) {
  if (!map) return;
  if (map.__trails) { try { map.removeLayer(map.__trails); } catch (e) {} map.__trails = null; }
  if (!on) return;
  const l = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: MAP_MAX_ZOOM, maxNativeZoom: 18, opacity: 0.85,
    attribution: 'Sentiers © <a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)',
  });
  l.addTo(map); l.setZIndex(10);
  map.__trails = l;
}

// Marqueurs de départ / arrivée des tracés (réglage « Préférences carte »)
const ENDPOINTS_KEY = 'gr34_show_endpoints';
function savedShowEndpoints() {
  try { return localStorage.getItem(ENDPOINTS_KEY) !== '0'; } catch (e) { return true; }
}

// Zoom molette / trackpad fluide et réactif. Le zoom molette de Leaflet
// regroupe les événements et arrondit par paliers : très lent au trackpad
// (pincement = petits deltas). Ici chaque événement zoome aussitôt, autour
// du pointeur, proportionnellement au geste.
// On passe par le même mécanisme que le pincement tactile de Leaflet
// (_move + pinch) : les tuiles affichées sont simplement mises à l'échelle
// pendant le geste au lieu d'être effacées à chaque palier (écran noir),
// et les nouvelles tuiles se chargent par-dessus à la fin du geste.
function enableSmoothWheelZoom(map) {
  const el = map.getContainer();
  let target = null, point = null, raf = 0, idle = 0, active = false;
  const apply = () => {
    raf = 0;
    if (target == null) return;
    const zoom = map._limitZoom(target);
    const half = map.getSize().divideBy(2);
    const latlng = map.containerPointToLatLng(point);
    const center = map.unproject(map.project(latlng, zoom).subtract(point.subtract(half)), zoom);
    map._move(center, zoom, { pinch: true });
  };
  const end = () => {
    idle = 0;
    if (raf) { cancelAnimationFrame(raf); apply(); }
    target = null;
    if (!active) return;
    active = false;
    map._moveEnd(true);
  };
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
    // ctrlKey = pincement trackpad (deltas fins) ; sinon molette ou défilement à deux doigts
    const step = e.ctrlKey ? 0.022 : 0.006;
    const d = Math.max(-1, Math.min(1, -dy * step));
    if (!active) {
      map._stop();
      active = true;
      map.fire('movestart').fire('zoomstart');
    }
    const base = target == null ? map.getZoom() : target;
    target = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), base + d));
    point = map.mouseEventToContainerPoint(e);
    if (!raf) raf = requestAnimationFrame(apply);
    clearTimeout(idle);
    idle = setTimeout(end, 160);
  }, { passive: false });
}

function MapView({
  groups, visibleIds, hoveredId, setHoveredId, multiSel, accent, dark, showLegend, onToggleVisible,
  creating, draftCoords, previewCoords, draftRouteType, draftDistance, draftActivity,
  draftSections, activeSectionId,
  draftPois, placingPoi,
  poiFilters, onToggleFilterPoi,
  importPreview,
  locationPrompt, userLocation, onAcceptLocation, onDeclineLocation, onRequestLocation,
  onMapClick, onUndo, onClearDraft, onAddSection, onFinish, onMapReady, onAction,
  autoRoute, onToggleAutoRoute, routeProfile, onRouteProfile, routingBusy, onDraftColor,
}) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const isMobile = useIsMobile();
  // Keep the latest POI toggle handler in a ref so marker effects don't re-run
  // (and recreate/flicker markers) on every unrelated re-render (e.g. mousemove).
  const toggleFilterPoiRef = useRef(onToggleFilterPoi);
  useEffect(() => { toggleFilterPoiRef.current = onToggleFilterPoi; });
  // Latest map-click handler in a ref so POI markers can forward a click to it
  // (place a trace waypoint directly on the POI) without re-running marker effects.
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; });
  // True while the pointer is over a POI marker/popover — restores the system
  // cursor (so the popover button is clickable) and dims the ghost trace line.
  const [hoveringPoi, setHoveringPoi] = useState(false);
  const tileLayerRef = useRef(null);
  const routeLayersRef = useRef(new Map());
  const draftLayersRef = useRef({ line: null, markers: [] });
  const savedPoiLayersRef = useRef([]);

  // Compute visible routes (flatten section composites). Keep them rendered
  // during route creation but dim them via the polyline opacity logic below.
  // When an import preview is active, REPLACE visibleRoutes with just the preview.
  const visibleRoutes = useMemo(() => {
    // Import de plusieurs GPX : une trace par fichier
    if (importPreview && importPreview.routes && importPreview.routes.length) {
      return importPreview.routes.map((r) => ({
        id: r.id, parentId: r.id, name: r.name, shortName: r.name, parentName: 'Import GPX',
        color: r.color || 'emerald', distance: r.distance || 0, ascent: r.ascent || 0,
        coords: r.coords, isSection: false,
      }));
    }
    if (importPreview && importPreview.coords && importPreview.coords.length >= 2) {
      return [{
        id: importPreview.id,
        parentId: importPreview.id,
        name: importPreview.name,
        shortName: importPreview.name,
        parentName: 'Import GPX',
        color: importPreview.color || 'emerald',
        distance: importPreview.distance || 0,
        ascent: importPreview.ascent || 0,
        coords: importPreview.coords,
        isSection: false,
      }];
    }
    const out = [];
    groups.forEach((g) => {
      g.itineraries.forEach((it) => {
        if (it.sections && it.sections.length) {
          it.sections.forEach((s) => {
            if (visibleIds.has(s.id)) out.push({
              id: s.id, parentId: it.id,
              name: it.name + ' · ' + s.name,
              shortName: s.name, parentName: it.name,
              color: s.color || it.color, distance: s.distance, ascent: s.ascent,
              path: s.path, coords: s.coords, isSection: true
            });
          });
        } else if (visibleIds.has(it.id)) {
          out.push({
            id: it.id, parentId: it.id, name: it.name, shortName: it.name,
            parentName: g.name, color: it.color, distance: it.distance,
            ascent: it.ascent, path: it.path, coords: it.coords, isSection: false
          });
        }
      });
    });
    return out;
  }, [groups, visibleIds, creating, importPreview]);

  // Saved POIs to display on visible itineraries (kept with their colors once a
  // route is validated). A POI belongs to its parent itinerary; show it when the
  // itinerary (or any of its sections) is visible. Hidden during creation.
  const visiblePois = useMemo(() => {
    if (creating || importPreview) return [];
    const out = [];
    groups.forEach((g) => {
      g.itineraries.forEach((it) => {
        if (!it.pois || !it.pois.length) return;
        const sectionVisible = it.sections && it.sections.some((s) => visibleIds.has(s.id));
        if (visibleIds.has(it.id) || sectionVisible) {
          it.pois.forEach((p) => out.push(p));
        }
      });
    });
    return out;
  }, [groups, visibleIds, creating, importPreview]);

  // Init Leaflet map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0, // zoom continu (molette / trackpad fluides) ; boutons +/− : 1 niveau
      maxZoom: MAP_MAX_ZOOM,
      scrollWheelZoom: false, // remplacé par enableSmoothWheelZoom
    }).setView([46.6, 2.5], 6);
    mapRef.current = map;
    enableSmoothWheelZoom(map);
    // Fit roughly the metropolitan France bounding box so the whole country
    // is visible on first paint, regardless of viewport size.
    try {
      map.fitBounds([[41.3, -5.5], [51.2, 9.8]], { paddingTopLeft: [mapUnderlay() + 20, 20], paddingBottomRight: [20, 20], animate: false });
    } catch (e) {}
    if (onMapReady) onMapReady(map);

    // Defer + observe to fix the "only top strip rendered" issue:
    // the map container may be 0px tall at mount time. Recompute on every size change.
    requestAnimationFrame(() => {try {map.invalidateSize();} catch (e) {}});
    setTimeout(() => {try {map.invalidateSize();} catch (e) {}}, 250);

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        try {map.invalidateSize();} catch (e) {}
      });
      ro.observe(mapEl.current);
    } else {
      const onResize = () => {try {map.invalidateSize();} catch (e) {}};
      window.addEventListener('resize', onResize);
      ro = { disconnect: () => window.removeEventListener('resize', onResize) };
    }

    return () => {
      try {ro && ro.disconnect();} catch (e) {}
      try {map.remove();} catch (e) {}
      mapRef.current = null;
    };
  }, []);

  // Fond de carte : celui choisi dans « Cartes » (mémorisé), « Plan » par défaut.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyBaseLayer(map, savedMapStyle());
    applyTrailsOverlay(map, savedTrailsOverlay());
    applyMapOpacity(map, savedMapOpacity());
  }, []);

  // User geolocation marker (pulsing live dot) ----------------------------
  const userLayerRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userLayerRef.current) { try { userLayerRef.current.remove(); } catch (e) {} userLayerRef.current = null; }
    if (!userLocation) return;
    const icon = L.divIcon({
      className: 'user-loc',
      html:
        `<div style="position:relative;width:18px;height:18px;">` +
        `<div style="position:absolute;inset:0;border-radius:9999px;background:rgba(59,130,246,0.25);animation:grPulse 1.6s ease-out infinite;"></div>` +
        `<div style="position:absolute;inset:3px;border-radius:9999px;background:#3b82f6;box-shadow:0 0 0 2px #fff,0 1px 3px rgba(0,0,0,0.35);"></div>` +
        `</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const m = L.marker(userLocation, { icon, interactive: false, zIndexOffset: 600 }).addTo(map);
    userLayerRef.current = m;
  }, [userLocation]);

  // Live elevation profile derived from draft coords. Pseudo-altitudes are
  // generated deterministically from each point's lat/lng so the profile keeps
  // its shape as the user adds points (no jitter on every redraw).
  // ----------------------------------------------------------------------
  // Shared helper so we can reuse the same generator for a single-visible
  // existing route (legend stats while looking at one route).
  const draftElevation = useMemo(() => {
    return computeElevationStats(draftCoords);
  }, [draftCoords]);

  // Map sections → contiguous index ranges in the flattened draftCoords / profile.
  // Section[n>0]'s first coord is shared with section[n-1]'s last → dedup'd in app,
  // BUT we still consider that shared point as part of BOTH sections (so the chart
  // segments visually connect at the junction).
  const sectionRanges = useMemo(() => {
    if (!draftSections || draftSections.length === 0) return [];
    let coordIdx = 0;
    return draftSections.map((sec, si) => {
      const coords = sec.coords || [];
      if (coords.length === 0) {
        return { id: sec.id, color: sec.color, name: sec.name, startIdx: coordIdx, endIdx: coordIdx, startCoord: coordIdx, endCoord: coordIdx, empty: true };
      }
      // Sections must NOT overlap on the chart. Each section starts exactly
      // where the previous one ended. The shared waypoint is owned by the
      // PREVIOUS section so we drop it from this section's range.
      const dropFirst = si > 0;
      const physicalCount = coords.length - (dropFirst ? 1 : 0);
      const logicalStart = coordIdx;
      const logicalEnd = coordIdx + physicalCount;
      coordIdx += physicalCount;
      return {
        id: sec.id, color: sec.color, name: sec.name,
        startCoord: logicalStart,
        endCoord: logicalEnd,
        // Profile-space mapping done lazily in the chart (needs profile length)
        startIdx: logicalStart,
        endIdx: logicalEnd,
        empty: false,
      };
    });
  }, [draftSections]);

  // Cumulative distance per coord — used by the chart to position points by km.
  const coordCumKm = useMemo(() => {
    if (!draftCoords || draftCoords.length === 0 || typeof L === 'undefined') return [];
    const out = [0];
    for (let i = 1; i < draftCoords.length; i++) {
      const d = L.latLng(draftCoords[i - 1]).distanceTo(L.latLng(draftCoords[i])) / 1000;
      out.push(out[i - 1] + d);
    }
    return out;
  }, [draftCoords]);

  // Per-section elevation stats (for hover-filter on the chart)
  const sectionStats = useMemo(() => {
    if (!draftSections) return [];
    return draftSections.map((sec) => ({
      id: sec.id,
      color: sec.color,
      name: sec.name,
      stats: computeElevationStats(sec.coords || []),
    }));
  }, [draftSections]);

  // Hover state from the elevation chart — drives BOTH the cursor on the chart
  // AND the stats filtering (which section is being inspected).
  const [hoverIdx, setHoverIdx] = useState(null);
  // Hovered section based on the chart's hoverIdx (which is a PROFILE index).
  // We compare against profile indices derived from each section's coord range.
  const hoveredSection = useMemo(() => {
    if (hoverIdx == null || !sectionRanges.length) return null;
    const SAMPLES_PER_SEG = 8;
    const lastCoord = (coordCumKm && coordCumKm.length ? coordCumKm.length - 1 : 0);
    const profileLen = lastCoord > 0 ? (lastCoord * SAMPLES_PER_SEG + 1) : 0;
    const cToP = (c) => (c >= lastCoord) ? Math.max(0, profileLen - 1) : (c * SAMPLES_PER_SEG);
    return sectionRanges.find((r) => {
      if (r.empty) return false;
      const sP = cToP(r.startCoord);
      const eP = cToP(r.endCoord);
      return hoverIdx >= sP && hoverIdx <= eP;
    }) || null;
  }, [hoverIdx, sectionRanges, coordCumKm]);

  // Stats shown — full draft by default, filtered to a section when hovering it.
  const shownStats = useMemo(() => {
    if (!hoveredSection) {
      // Même trace que la distance : boucle / aller-retour compris
      const eff = computeElevationStats(composeDraftCoords(draftCoords || [], draftRouteType));
      return {
        distance: draftDistance || 0,
        minAlt: eff.minAlt,
        maxAlt: eff.maxAlt,
        ascent: eff.ascent,
        descent: eff.descent,
        slopeMin: eff.slopeMin,
        slopeMax: eff.slopeMax,
        noEle: eff.noEle, partialEle: eff.partialEle,
      };
    }
    const s = sectionStats.find((x) => x.id === hoveredSection.id)?.stats;
    if (!s) return null;
    // Compute distance of just that section
    let distKm = 0;
    if (typeof L !== 'undefined') {
      const sec = draftSections.find((x) => x.id === hoveredSection.id);
      if (sec && sec.coords && sec.coords.length >= 2) {
        for (let i = 1; i < sec.coords.length; i++) {
          distKm += L.latLng(sec.coords[i - 1]).distanceTo(L.latLng(sec.coords[i]));
        }
        distKm /= 1000;
      }
    }
    return {
      distance: distKm,
      minAlt: s.minAlt,
      maxAlt: s.maxAlt,
      ascent: s.ascent,
      descent: s.descent,
      slopeMin: s.slopeMin,
      slopeMax: s.slopeMax,
    };
  }, [hoveredSection, draftDistance, draftElevation, sectionStats, draftSections, draftCoords, draftRouteType]);

  // For an existing single visible route OR a composite itinerary whose ALL
  // sections are currently visible, expose elevation stats at the bottom of
  // the map. Only kicks in when not drawing.
  const singleRouteStats = useMemo(() => {
    try {
      if (creating) return null;
      if (!visibleRoutes || visibleRoutes.length === 0) return null;

      // Case A — exactly one visible polyline (a simple itinerary or a single
      // section of a composite).
      if (visibleRoutes.length === 1) {
        const r = visibleRoutes[0];
        let coords = (r.coords && r.coords.length) ? r.coords : null;
        if (!coords && r.path) {
          try { coords = samplePathToLatLng(r.path, 48); } catch (e) { coords = null; }
        }
        if (!coords || coords.length < 2) return null;
        const rawStats = computeElevationStats(coords);
        // D+ de l'itinéraire / de la section quand il est connu (calculé sur la trace complète)
        const stats = r.ascent ? { ...rawStats, ascent: r.ascent } : rawStats;
        // Cumulative distance per coord (for POI projection on the chart).
        const cumKmA = [0];
        if (typeof L !== 'undefined') {
          for (let i = 1; i < coords.length; i++) {
            cumKmA.push(cumKmA[i - 1] + L.latLng(coords[i - 1]).distanceTo(L.latLng(coords[i])) / 1000);
          }
        }
        let groupId = null;
        let parentItinerary = null;
        for (const g of groups) {
          for (const it of g.itineraries) {
            if (it.id === r.id || it.id === r.parentId) { groupId = g.id; parentItinerary = it; break; }
          }
          if (groupId) break;
        }
        return { route: r, stats, distance: r.distance, coords, groupId, parentItinerary, coordCumKm: cumKmA };
      }

      // Case B — multiple visible polylines that ALL belong to the same
      // composite itinerary. Treat them as a single combined route.
      const firstParentId = visibleRoutes[0].parentId;
      const allSameParent = visibleRoutes.every((r) => r.isSection && r.parentId === firstParentId);
      if (!allSameParent) return null;
      let parentItinerary = null;
      let groupId = null;
      for (const g of groups) {
        for (const it of g.itineraries) {
          if (it.id === firstParentId) { parentItinerary = it; groupId = g.id; break; }
        }
        if (parentItinerary) break;
      }
      if (!parentItinerary || !parentItinerary.sections || !parentItinerary.sections.length) return null;
      const visibleIdsSet = new Set(visibleRoutes.map((r) => r.id));
      const allShown = parentItinerary.sections.every((s) => visibleIdsSet.has(s.id));
      if (!allShown) return null;
      // Stitch coords: drop the shared junction point between consecutive sections.
      const combined = [];
      parentItinerary.sections.forEach((s, i) => {
        const c = s.coords || (s.path && typeof samplePathToLatLng === 'function' ? samplePathToLatLng(s.path, 60) : null);
        if (!c || !c.length) return;
        c.forEach((pt, j) => {
          if (i > 0 && j === 0) {
            const lastSeen = combined[combined.length - 1];
            if (lastSeen && lastSeen[0] === pt[0] && lastSeen[1] === pt[1]) return;
          }
          combined.push(pt);
        });
      });
      if (combined.length < 2) return null;
      const stats = computeElevationStats(combined);
      const totalDist = parentItinerary.distance || parentItinerary.sections.reduce((acc, x) => acc + (x.distance || 0), 0);
      const totalAscent = parentItinerary.ascent || parentItinerary.sections.reduce((acc, x) => acc + (x.ascent || 0), 0);
      const primaryColor = parentItinerary.sections[0].color || parentItinerary.color || 'sky';
      // Build per-section index ranges in the combined coords for the chart.
      let coordIdx = 0;
      const ranges = parentItinerary.sections.map((s, i) => {
        const c = s.coords || (s.path && typeof samplePathToLatLng === 'function' ? samplePathToLatLng(s.path, 60) : []);
        if (!c || !c.length) return { id: s.id, color: s.color, name: s.name, startCoord: coordIdx, endCoord: coordIdx, empty: true };
        const dropFirst = i > 0;
        const physicalCount = c.length - (dropFirst ? 1 : 0);
        const start = coordIdx;
        const end = coordIdx + physicalCount;
        coordIdx += physicalCount;
        return { id: s.id, color: s.color, name: s.name, startCoord: start, endCoord: end, empty: false };
      });
      // Cumulative distance per coord
      const cumKm = [0];
      if (typeof L !== 'undefined') {
        for (let i = 1; i < combined.length; i++) {
          cumKm.push(cumKm[i - 1] + L.latLng(combined[i - 1]).distanceTo(L.latLng(combined[i])) / 1000);
        }
      }
      return {
        route: {
          id: parentItinerary.id,
          name: parentItinerary.name,
          color: primaryColor,
          isSection: false,
          isComposite: true,
          sectionCount: parentItinerary.sections.length,
        },
        stats: { ...stats, ascent: totalAscent || stats.ascent },
        distance: totalDist,
        coords: combined,
        groupId,
        parentItinerary,
        sectionRanges: ranges,
        coordCumKm: cumKm,
      };
    } catch (e) {
      console.warn('singleRouteStats compute failed:', e);
      return null;
    }
  }, [visibleRoutes, creating, groups]);

  // Hovered profile index — synced between map route hover and chart hover.
  const [chartHoverIdx, setChartHoverIdx] = useState(null);
  // 3-dots menu open state for the single-route stats panel
  const [singleMenuOpen, setSingleMenuOpen] = useState(false);
  const singleMenuRef = useRef(null);
  useEffect(() => {
    if (!singleMenuOpen) return;
    const onDoc = (e) => {
      if (singleMenuRef.current && !singleMenuRef.current.contains(e.target)) setSingleMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setSingleMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [singleMenuOpen]);
  const hoverMarkerRef = useRef(null);

  // When chartHoverIdx changes, drop / move a tiny marker on the map at the
  // corresponding point along the visible route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (hoverMarkerRef.current) {
      try { hoverMarkerRef.current.remove(); } catch (e) {}
      hoverMarkerRef.current = null;
    }
    if (chartHoverIdx == null || !singleRouteStats) return;
    const coords = singleRouteStats.coords;
    if (!coords || coords.length === 0) return;
    // The chart profile has more samples than coords. Map profile idx → coord idx.
    const profileLen = singleRouteStats.stats.profile.length;
    const ratio = profileLen > 1 ? chartHoverIdx / (profileLen - 1) : 0;
    const coordIdx = Math.max(0, Math.min(coords.length - 1, Math.round(ratio * (coords.length - 1))));
    const pos = coords[coordIdx];
    const color = ROUTE_COLORS[singleRouteStats.route.color].hex;
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:9999px;background:#fff;border:3px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    hoverMarkerRef.current = L.marker(pos, { icon, interactive: false, zIndexOffset: 700 }).addTo(map);
  }, [chartHoverIdx, singleRouteStats]);

  // When user hovers the route polyline on the map, derive the profile index
  // from the nearest point in the coord list. Attached to Leaflet polylines
  // via mousemove / mouseout below.
  useEffect(() => {
    if (!singleRouteStats) { setChartHoverIdx(null); return; }
    const layer = routeLayersRef.current.get(singleRouteStats.route.id);
    if (!layer || !layer.line) return;
    const coords = singleRouteStats.coords;
    const profileLen = singleRouteStats.stats.profile.length;
    const onMove = (e) => {
      const ll = e.latlng;
      let bestI = 0;
      let bestD = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        const d = (c[0] - ll.lat) ** 2 + (c[1] - ll.lng) ** 2;
        if (d < bestD) { bestD = d; bestI = i; }
      }
      const ratio = bestI / Math.max(coords.length - 1, 1);
      setChartHoverIdx(Math.round(ratio * (profileLen - 1)));
    };
    const onOut = () => setChartHoverIdx(null);
    layer.line.on('mousemove', onMove);
    layer.line.on('mouseout', onOut);
    return () => {
      try {
        layer.line.off('mousemove', onMove);
        layer.line.off('mouseout', onOut);
      } catch (e) {}
    };
  }, [singleRouteStats, routeLayersRef.current.size]);

  const [showEndpoints, setShowEndpoints] = useState(savedShowEndpoints);
  useEffect(() => {
    const on = (e) => setShowEndpoints(!!e.detail);
    window.addEventListener('gr-show-endpoints', on);
    return () => window.removeEventListener('gr-show-endpoints', on);
  }, []);

  // Survol depuis la carte : le « mouseout » d'un tracé peut ne jamais arriver
  // (tracé passé au premier plan, tracés redessinés sous le pointeur…). Filet
  // de sécurité : dès que le pointeur bouge hors d'un tracé ou quitte la
  // carte, on retire la mise en avant posée depuis la carte.
  const mapHoverRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !setHoveredId) return;
    const isRoutePath = (el) => {
      let found = false;
      routeLayersRef.current.forEach((l) => { if (l.line.getElement() === el || l.casing.getElement() === el) found = true; });
      return found;
    };
    const clear = () => { if (mapHoverRef.current != null) { mapHoverRef.current = null; setHoveredId(null); } };
    const onMove = (e) => { if (mapHoverRef.current != null && !isRoutePath(e.originalEvent && e.originalEvent.target)) clear(); };
    const el = map.getContainer();
    map.on('mousemove', onMove);
    el.addEventListener('mouseleave', clear);
    return () => { map.off('mousemove', onMove); el.removeEventListener('mouseleave', clear); };
  }, [setHoveredId]);

  // Sync route polylines + fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // remove old
    routeLayersRef.current.forEach(({ casing, line, startMarker, endMarker }) => {
      try {casing.remove();line.remove();} catch (e) {}
      try { startMarker && startMarker.remove(); } catch (e) {}
      try { endMarker && endMarker.remove(); } catch (e) {}
    });
    routeLayersRef.current.clear();
    // Tracés redessinés : une mise en avant posée depuis la carte n'a plus de sens
    if (mapHoverRef.current != null && setHoveredId) { mapHoverRef.current = null; setHoveredId(null); }
    // Jonctions : une extrémité proche (< 400 m) d'une extrémité d'un autre tracé
    // affiché n'a pas de marqueur ; le départ et l'arrivée de la chaîne
    // gardent les leurs (cercle de départ, check d'arrivée).
    const routeCoords = visibleRoutes.map((r) => (r.coords && r.coords.length ? r.coords : samplePathToLatLng(r.path, 100)));
    const ends = [];
    routeCoords.forEach((c, i) => { if (c && c.length >= 2) { ends.push({ i, kind: 'start', p: c[0] }); ends.push({ i, kind: 'end', p: c[c.length - 1] }); } });
    const JUNCTION_M = 400;
    const isJunction = (i, kind) => {
      const me = ends.find((e) => e.i === i && e.kind === kind);
      if (!me) return false;
      return ends.some((e) => e.i !== i && L.latLng(e.p).distanceTo(L.latLng(me.p)) < JUNCTION_M);
    };
    // add new
    visibleRoutes.forEach((r, routeIdx) => {
      const coords = routeCoords[routeIdx];
      if (!coords || coords.length < 2) return;
      const color = ROUTE_COLORS[r.color].hex;
      const casing = L.polyline(coords, {
        color: dark ? '#000' : '#fff',
        weight: 7, opacity: dark ? 0.65 : 1,
        lineCap: 'round', lineJoin: 'round', interactive: !creating
      }).addTo(map);
      const line = L.polyline(coords, {
        color, weight: 4, opacity: 1,
        lineCap: 'round', lineJoin: 'round'
      }).addTo(map);

      const start = coords[0];
      const end = coords[coords.length - 1];
      const sameStartEnd = Math.abs(start[0] - end[0]) < 1e-6 && Math.abs(start[1] - end[1]) < 1e-6;

      const startIcon = L.divIcon({
        className: 'route-endpoint',
        html: `<svg viewBox="0 0 18 18" width="18" height="18" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">`
          + `<circle cx="9" cy="9" r="8" fill="#fff" stroke="${color}" stroke-width="2.5" />`
          + `<circle cx="9" cy="9" r="3" fill="${color}" />`
          + `</svg>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const endIcon = L.divIcon({
        className: 'route-endpoint',
        html: `<svg viewBox="0 0 18 18" width="18" height="18" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">`
          + `<circle cx="9" cy="9" r="8" fill="${color}" stroke="#fff" stroke-width="2.5" />`
          + `<path d="M5 9 L8 12 L13 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
          + `</svg>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      // Jonction avec un autre tracé affiché : pas de marqueur, seuls le départ
      // et l'arrivée de la chaîne restent visibles.
      const startJ = isJunction(routeIdx, 'start');
      const endJ = isJunction(routeIdx, 'end');
      const startMarker = !startJ
        ? L.marker(start, { icon: startIcon, interactive: false, zIndexOffset: 400, opacity: creating ? 0.5 : 1 }).addTo(map)
        : null;
      const endMarker = !sameStartEnd && !endJ
        ? L.marker(end, { icon: endIcon, interactive: false, zIndexOffset: 401, opacity: creating ? 0.5 : 1 }).addTo(map)
        : null;

      // Survol d'un tracé sur la carte : le met en avant (carte + navigation)
      if (!creating && setHoveredId) {
        [line, casing].forEach((l) => {
          l.on('mouseover', () => { mapHoverRef.current = r.id; setHoveredId(r.id); });
          l.on('mouseout', () => { mapHoverRef.current = null; setHoveredId(null); });
        });
      }

      routeLayersRef.current.set(r.id, { casing, line, startMarker, endMarker, baseColor: color, parentId: r.parentId });
    });
    // fit — skip when creating so the user keeps their view
    if (visibleRoutes.length > 0 && !creating) {
      const all = [];
      visibleRoutes.forEach((r) => {
        const pts = r.coords && r.coords.length ? r.coords : samplePathToLatLng(r.path, 30);
        pts.forEach((p) => all.push(p));
      });
      if (all.length > 0) {
        const bounds = L.latLngBounds(all);
        map.fitBounds(bounds, { ...mapFitPadding(60), maxZoom: 13, animate: true, duration: 0.5 });
      }
    }
  }, [visibleRoutes, dark, creating]);

  // Hover highlight (dim existing routes during creation to 50%)
  useEffect(() => {
    const dim = creating ? 0.5 : 1;
    routeLayersRef.current.forEach((layer, id) => {
      // Mise en avant : le tracé survolé, sinon la sélection multiple
      const sel = multiSel && multiSel.size && [...routeLayersRef.current].some(([rid, l]) => multiSel.has(rid) || multiSel.has(l.parentId)) ? multiSel : null;
      const focusOn = hoveredId || sel;
      const isHovered = hoveredId
        ? (hoveredId === id || hoveredId === layer.parentId)
        : !!sel && (sel.has(id) || sel.has(layer.parentId));
      const markerOpacity = showEndpoints ? dim : 0; // réglage « Départ et arrivée »
      try { layer.startMarker && layer.startMarker.setOpacity(markerOpacity); } catch (e) {}
      try { layer.endMarker && layer.endMarker.setOpacity(markerOpacity); } catch (e) {}
      if (creating) {
        // While creating, no hover highlight — keep everything at 50%.
        layer.line.setStyle({ weight: 4, opacity: dim });
        layer.casing.setStyle({ weight: 7, opacity: (dark ? 0.65 : 1) * dim });
      } else if (!focusOn) {
        layer.line.setStyle({ weight: 4, opacity: 1 });
        layer.casing.setStyle({ weight: 7, opacity: dark ? 0.65 : 1 });
      } else if (isHovered) {
        layer.line.setStyle({ weight: 6, opacity: 1 });
        layer.casing.setStyle({ weight: 10, opacity: dark ? 0.7 : 1 });
        try { layer.casing.bringToFront(); layer.line.bringToFront(); } catch (e) {}
      } else {
        layer.line.setStyle({ weight: 4, opacity: 0.3 });
        layer.casing.setStyle({ weight: 7, opacity: 0.18 });
      }
    });
  }, [hoveredId, multiSel, visibleRoutes, dark, creating, showEndpoints]);

  // Draft polyline (creating mode) — per-section rendering with section colors.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Clear previously rendered layers
    draftLayersRef.current.markers.forEach((m) => { try { m.remove(); } catch (e) {} });
    (draftLayersRef.current.lines || []).forEach((l) => { try { l.remove(); } catch (e) {} });
    if (draftLayersRef.current.line) { try { draftLayersRef.current.line.remove(); } catch (e) {} }
    if (draftLayersRef.current.returnLine) { try { draftLayersRef.current.returnLine.remove(); } catch (e) {} }
    draftLayersRef.current = { lines: [], line: null, returnLine: null, markers: [] };

    if (!creating) return;
    const sections = (draftSections && draftSections.length)
      ? draftSections
      : (draftCoords && draftCoords.length ? [{ id: 'sec_default', color: 'sky', coords: draftCoords }] : []);
    if (sections.length === 0) return;

    // One polyline per section with its own color
    sections.forEach((sec) => {
      const coords = sec.coords || [];
      if (coords.length < 2) return;
      const color = ROUTE_COLORS[sec.color]?.hex || accent;
      const line = L.polyline(coords, {
        color, weight: 4, opacity: 1,
        lineCap: 'round', lineJoin: 'round'
      }).addTo(map);
      draftLayersRef.current.lines.push(line);
    });

    // outAndBack overlay: dashed return path of the whole chain
    if (draftRouteType === 'outAndBack' && draftCoords && draftCoords.length >= 2) {
      const ret = L.polyline(draftCoords, {
        color: accent, weight: 4, opacity: 0.55,
        dashArray: '8,8', lineCap: 'round', lineJoin: 'round'
      }).addTo(map);
      draftLayersRef.current.returnLine = ret;
    }

    // Markers — small waypoint dots at every clicked point during creation.
    sections.forEach((sec, sIdx) => {
      const color = ROUTE_COLORS[sec.color]?.hex || accent;
      const coords = sec.coords || [];
      // Points posés par l'utilisateur seulement (pas chaque point du tracé suivi)
      const idxs = sec.marks && sec.marks.length ? sec.marks.filter((i) => i < coords.length) : coords.map((_, i) => i);
      idxs.forEach((i) => {
        const c = coords[i];
        const isFirstOverall = sIdx === 0 && i === 0;
        const isLastOverall = sIdx === sections.length - 1 && i === coords.length - 1;
        const big = isFirstOverall || isLastOverall;
        const size = big ? 14 : 10;
        const cls = `draft-waypoint${isFirstOverall ? ' draft-waypoint-first' : ''}`;
        const icon = L.divIcon({ className: cls, html: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
        const m = L.marker(c, { icon, interactive: false }).addTo(map);
        try {
          const el = m.getElement();
          if (el) {
            el.style.background = isFirstOverall ? color : '#fff';
            el.style.borderColor = color;
            el.style.borderStyle = 'solid';
            el.style.borderWidth = '2.5px';
            el.style.borderRadius = '50%';
            el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
          }
        } catch (e) {}
        draftLayersRef.current.markers.push(m);
      });
    });
  }, [creating, draftCoords, draftSections, accent, draftRouteType]);

  // OSM-style POI filter markers (rendered around the current map view based on
  // the user's active filters). Mocked: each filter type generates a few
  // deterministic markers offset from the current map center.
  const filterPoiLayersRef = useRef([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    filterPoiLayersRef.current.forEach((m) => { try { m.remove(); } catch (e) {} });
    filterPoiLayersRef.current = [];
    if (!poiFilters || poiFilters.length === 0) return;
    const types = (window.POI_FILTER_TYPES || []).filter((t) => poiFilters.includes(t.key));
    if (!types.length) return;
    // Glyphs keyed by category so each roundel shows its own icon (not a generic pin).
    const ICON_PATHS = {
      parking:    '<path d="M8 19V5h5a4 4 0 0 1 0 8H8" />',
      toilet:     '<rect x="8" y="3" width="8" height="4" rx="1" /><path d="M7 10h10a5 5 0 0 1-10 0Z" /><path d="M12 15v4M10 19h4" />',
      water:      '<path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z" />',
      refuge:     '<path d="M4 21V10l8-6 8 6v11M9 21v-7h6v7" />',
      restaurant: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v8M11 3v8M16 3c-1 0-2 2-2 5s1 4 2 4v9" />',
      pharmacy:   '<path d="M12 4v16M4 12h16" />',
      viewpoint:  '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="4" />',
      shelter:    '<path d="M12 4 3 20h18L12 4Zm0 0v16" />',
    };
    // Build the set of filter ids already attached to the route.
    const addedIds = new Set((draftPois || []).filter((p) => p.fromFilterId).map((p) => p.fromFilterId));
    const center = map.getCenter();
    types.forEach((t, ti) => {
      for (let i = 0; i < 4; i++) {
        const id = `filter_${t.key}_${i}`;
        if (addedIds.has(id)) return; // rendered by the draft-POI layer with its ring
        const angle = ((ti * 37 + i * 91) % 360) * Math.PI / 180;
        const radius = 0.012 + ((ti * 7 + i * 11) % 9) * 0.002;
        const lat = center.lat + Math.cos(angle) * radius;
        const lng = center.lng + Math.sin(angle) * radius;
        const inner = ICON_PATHS[t.key] || ICON_PATHS.parking;
        const html = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:26px;height:26px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.3));">
            <div style="position:absolute;inset:0;border-radius:50%;background:${t.color};border:2.5px solid #fff;"></div>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="position:relative;">${inner}</svg>
          </div>`;
        const icon = L.divIcon({ className: 'osm-poi', html, iconSize: [26, 26], iconAnchor: [13, 13] });
        const marker = L.marker([lat, lng], { icon, zIndexOffset: 300 }).addTo(map);
        const poiObj = {
          fromFilterId: id, name: t.label, iconKey: t.key, catColor: t.color,
          type: 'osm', latlng: [lat, lng],
        };
        if (creating && toggleFilterPoiRef.current) {
          // Click → popover to attach this POI to the current route.
          const popHtml = `
            <div style="font-family:Inter,sans-serif;min-width:150px;">
              <div style="font-weight:600;font-size:12.5px;color:#171717;margin-bottom:6px;">${t.label}</div>
              <button class="poi-attach-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;background:${accent};color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;">Ajouter au tracé</button>
            </div>`;
          marker.bindPopup(popHtml, { closeButton: false, offset: [0, -6], className: 'poi-popover' });
          // Hover shows the attach popover; click drops a trace waypoint on the POI.
          marker.on('mouseover', () => { marker.openPopup(); setHoveringPoi(true); });
          marker.on('mouseout', () => setHoveringPoi(false));
          marker.on('click', () => {
            if (onMapClickRef.current) onMapClickRef.current([lat, lng]);
          });
          marker.on('popupopen', () => {
            const pop = marker.getPopup() && marker.getPopup().getElement();
            if (pop) {
              pop.style.cursor = 'auto';
              pop.addEventListener('mouseenter', () => setHoveringPoi(true));
              pop.addEventListener('mouseleave', () => setHoveringPoi(false));
            }
            const btn = document.querySelector('.poi-attach-btn');
            if (btn) btn.onclick = (ev) => { ev.stopPropagation(); marker.closePopup(); setHoveringPoi(false); toggleFilterPoiRef.current(poiObj); };
          });
        } else {
          marker.bindTooltip(t.label, { direction: 'top', offset: [0, -8] });
        }
        filterPoiLayersRef.current.push(marker);
      }
    });
  }, [poiFilters, creating, draftPois, accent]);

  // POI markers (draft) — render each draft POI on the map with its icon + color.
  // Each POI uses an L.divIcon containing an SVG roundel.
  const poiLayersRef = useRef([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Cleanup previous
    poiLayersRef.current.forEach((m) => { try { m.remove(); } catch (e) {} });
    poiLayersRef.current = [];
    if (!creating || !draftPois || !draftPois.length) return;
    const ICON_PATHS = {
      Pin: '<path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Z" /><circle cx="12" cy="9" r="2.5" />',
      Flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5" />',
      Alert: '<circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16v.01" />',
      Checkpoint: '<circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />',
      Info: '<circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5" />',
      Medical: '<path d="M12 4v16M4 12h16" />',
      Accommodation: '<path d="M4 21V10l8-6 8 6v11M9 21v-7h6v7" />',
      Water: '<path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z" />',
      Restaurant: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v8M11 3v8M16 3c-1 0-2 2-2 5s1 4 2 4v9" />',
      Parking: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M10 17V8h3a2.5 2.5 0 1 1 0 5h-3" />',
      Camera: '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="4" />',
    };
    // Glyphs for filter-derived POIs, keyed by their category.
    const CAT_PATHS = {
      parking:    '<path d="M8 19V5h5a4 4 0 0 1 0 8H8" />',
      toilet:     '<rect x="8" y="3" width="8" height="4" rx="1" /><path d="M7 10h10a5 5 0 0 1-10 0Z" /><path d="M12 15v4M10 19h4" />',
      water:      '<path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z" />',
      refuge:     '<path d="M4 21V10l8-6 8 6v11M9 21v-7h6v7" />',
      restaurant: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v8M11 3v8M16 3c-1 0-2 2-2 5s1 4 2 4v9" />',
      pharmacy:   '<path d="M12 4v16M4 12h16" />',
      viewpoint:  '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="4" />',
      shelter:    '<path d="M12 4 3 20h18L12 4Zm0 0v16" />',
    };
    draftPois.forEach((p) => {
      if (!p.latlng) return;
      // Filter-derived POI attached to the route: category icon + section-color ring.
      if (p.fromFilterId) {
        const fill = p.catColor || accent;
        const ring = p.ringColor || accent;
        const inner = CAT_PATHS[p.iconKey] || CAT_PATHS.parking;
        const html = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));">
            <div style="position:absolute;inset:-3px;border-radius:50%;border:3px solid ${ring};background:#fff;"></div>
            <div style="position:absolute;inset:0;border-radius:50%;background:${fill};border:2.5px solid #fff;"></div>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="position:relative;">${inner}</svg>
          </div>`;
        const icon = L.divIcon({ className: 'draft-poi', html, iconSize: [38, 38], iconAnchor: [19, 19] });
        const m = L.marker(p.latlng, { icon, zIndexOffset: 520 }).addTo(map);
        if (toggleFilterPoiRef.current) {
          const popHtml = `
            <div style="font-family:Inter,sans-serif;min-width:150px;">
              <div style="font-weight:600;font-size:12.5px;color:#171717;margin-bottom:6px;">${p.name || ''}</div>
              <button class="poi-detach-btn" style="width:100%;background:#fef2f2;color:#e11d48;border:1px solid #fecdd3;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;">Retirer du tracé</button>
            </div>`;
          m.bindPopup(popHtml, { closeButton: false, offset: [0, -10], className: 'poi-popover' });
          m.on('mouseover', () => { m.openPopup(); setHoveringPoi(true); });
          m.on('mouseout', () => setHoveringPoi(false));
          m.on('click', () => {
            if (onMapClickRef.current) onMapClickRef.current(p.latlng);
          });
          m.on('popupopen', () => {
            const pop = m.getPopup() && m.getPopup().getElement();
            if (pop) {
              pop.style.cursor = 'auto';
              pop.addEventListener('mouseenter', () => setHoveringPoi(true));
              pop.addEventListener('mouseleave', () => setHoveringPoi(false));
            }
            const btn = document.querySelector('.poi-detach-btn');
            if (btn) btn.onclick = (ev) => { ev.stopPropagation(); m.closePopup(); setHoveringPoi(false); toggleFilterPoiRef.current(p); };
          });
        }
        poiLayersRef.current.push(m);
        return;
      }
      const cHex = ROUTE_COLORS[p.color]?.hex || accent;
      const inner = ICON_PATHS[p.icon] || ICON_PATHS.Pin;
      const ringHtml = p.ringColor
        ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:3px solid ${p.ringColor};background:#fff;"></div>`
        : `<div style="position:absolute;inset:-4px;border-radius:50%;background:${cHex};opacity:0.18;animation:poiPulse 2.4s ease-in-out infinite;"></div>`;
      const html = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.35));">
          ${ringHtml}
          <div style="position:absolute;inset:0;border-radius:50%;background:${cHex};border:3px solid #fff;"></div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="position:relative;">${inner}</svg>
        </div>`;
      const icon = L.divIcon({
        className: 'draft-poi',
        html, iconSize: [34, 34], iconAnchor: [17, 17],
      });
      const m = L.marker(p.latlng, { icon, interactive: false, zIndexOffset: 500 }).addTo(map);
      poiLayersRef.current.push(m);
    });
  }, [creating, draftPois, accent]);

  // Saved POIs — render markers for POIs attached to visible itineraries, with
  // their own color (custom) or category color (filter-derived), plus the ring.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    savedPoiLayersRef.current.forEach((m) => { try { m.remove(); } catch (e) {} });
    savedPoiLayersRef.current = [];
    if (!visiblePois || !visiblePois.length) return;
    const ICON_PATHS = {
      Pin: '<path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Z" /><circle cx="12" cy="9" r="2.5" />',
      Flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5" />',
      Alert: '<circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16v.01" />',
      Checkpoint: '<circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />',
      Info: '<circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5" />',
      Medical: '<path d="M12 4v16M4 12h16" />',
      Accommodation: '<path d="M4 21V10l8-6 8 6v11M9 21v-7h6v7" />',
      Water: '<path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z" />',
      Restaurant: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v8M11 3v8M16 3c-1 0-2 2-2 5s1 4 2 4v9" />',
      Parking: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M10 17V8h3a2.5 2.5 0 1 1 0 5h-3" />',
      Camera: '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="4" />',
    };
    const CAT_PATHS = {
      parking:    '<path d="M8 19V5h5a4 4 0 0 1 0 8H8" />',
      toilet:     '<rect x="8" y="3" width="8" height="4" rx="1" /><path d="M7 10h10a5 5 0 0 1-10 0Z" /><path d="M12 15v4M10 19h4" />',
      water:      '<path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z" />',
      refuge:     '<path d="M4 21V10l8-6 8 6v11M9 21v-7h6v7" />',
      restaurant: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v8M11 3v8M16 3c-1 0-2 2-2 5s1 4 2 4v9" />',
      pharmacy:   '<path d="M12 4v16M4 12h16" />',
      viewpoint:  '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="4" />',
      shelter:    '<path d="M12 4 3 20h18L12 4Zm0 0v16" />',
    };
    visiblePois.forEach((p) => {
      if (!p.latlng) return;
      const isFilter = !!p.fromFilterId;
      const fill = isFilter ? (p.catColor || accent) : (ROUTE_COLORS[p.color]?.hex || accent);
      const ring = p.ringColor || '#3b82f6';
      const inner = isFilter ? (CAT_PATHS[p.iconKey] || CAT_PATHS.parking) : (ICON_PATHS[p.icon] || ICON_PATHS.Pin);
      const html = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));">
          <div style="position:absolute;inset:-3px;border-radius:50%;border:3px solid ${ring};background:#fff;"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:${fill};border:2.5px solid #fff;"></div>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="position:relative;">${inner}</svg>
        </div>`;
      const icon = L.divIcon({ className: 'saved-poi', html, iconSize: [38, 38], iconAnchor: [19, 19] });
      const m = L.marker(p.latlng, { icon, zIndexOffset: 480 }).addTo(map);
      if (p.name) m.bindTooltip(p.name, { direction: 'top', offset: [0, -12] });
      savedPoiLayersRef.current.push(m);
    });
  }, [visiblePois, accent]);

  // Click handler (creating mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e) => {
      if (!creating || !onMapClick) return;
      // Clic sur le dernier point posé = terminer le tracé (comme Visorando)
      const pts = draftCoordsRef.current;
      if (!placingPoi && pts && pts.length >= 2) {
        try {
          const lp = map.latLngToContainerPoint(pts[pts.length - 1]);
          if (lp.distanceTo(e.containerPoint) < 14) { setDraftHintDismissed(true); onFinish && onFinish(); return; }
        } catch (err) {}
      }
      onMapClick([e.latlng.lat, e.latlng.lng]);
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [creating, onMapClick, onFinish, placingPoi]);

  // Cursor for creating + track mouse (pixel + latlng) for custom cursor & ghost line
  const draftCoordsRef = useRef(draftCoords);
  draftCoordsRef.current = draftCoords;
  const [draftHintDismissed, setDraftHintDismissed] = useState(false);
  useEffect(() => { if (creating) setDraftHintDismissed(false); }, [creating]);
  const [cursorPos, setCursorPos] = useState(null);
  const [expandedLegend, setExpandedLegend] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false); // légende repliée par défaut : seulement les totaux
  const [cursorLatLng, setCursorLatLng] = useState(null);
  const ghostLineRef = useRef(null);
  const loopHintLineRef = useRef(null);

  useEffect(() => {
    if (!mapEl.current) return;
    // Hide the system cursor only when we're actively drawing or placing a POI —
    // but restore it while hovering a POI marker so its popover button is usable.
    const hide = (creating || placingPoi) && !hoveringPoi;
    mapEl.current.style.cursor = hide ? 'none' : '';
  }, [creating, placingPoi, hoveringPoi]);

  useEffect(() => {
    if (!creating || !mapEl.current || !mapRef.current) return;
    const el = mapEl.current;
    const map = mapRef.current;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setCursorPos({ x: px, y: py });
      try {
        const ll = map.containerPointToLatLng([px, py]);
        setCursorLatLng([ll.lat, ll.lng]);
      } catch (err) {}
    };
    const onLeave = () => {setCursorPos(null);setCursorLatLng(null);};
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [creating]);

  // Dashed "ghost" line from the last waypoint to the current cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (ghostLineRef.current) {try {ghostLineRef.current.remove();} catch (e) {}ghostLineRef.current = null;}
    if (loopHintLineRef.current) {try {loopHintLineRef.current.remove();} catch (e) {}loopHintLineRef.current = null;}

    if (!creating || placingPoi || !draftCoords || draftCoords.length === 0 || !cursorLatLng) return;
    const last = draftCoords[draftCoords.length - 1];
    // Use the active section's color for the ghost line
    const activeSection = (draftSections || []).find((s) => s.id === activeSectionId);
    const ghostColor = activeSection ? (ROUTE_COLORS[activeSection.color]?.hex || accent) : accent;
    ghostLineRef.current = L.polyline([last, cursorLatLng], {
      color: ghostColor, weight: 3, opacity: hoveringPoi ? 0.45 : 0.9,
      dashArray: '2,7', lineCap: 'round', interactive: false
    }).addTo(map);

    // For loop mode: also show a faint dashed segment back to the start
    if (draftRouteType === 'loop' && draftCoords.length >= 2) {
      const first = draftCoords[0];
      loopHintLineRef.current = L.polyline([cursorLatLng, first], {
        color: accent, weight: 2.5, opacity: hoveringPoi ? 0.22 : 0.45,
        dashArray: '2,8', lineCap: 'round', interactive: false
      }).addTo(map);
    }
  }, [creating, draftCoords, cursorLatLng, accent, draftRouteType, draftSections, activeSectionId, hoveringPoi]);

  // Totals (legend)
  const totals = useMemo(() => {
    let dist = 0,ascent = 0;
    visibleRoutes.forEach((r) => {dist += r.distance;ascent += r.ascent;});
    return { dist, ascent, count: visibleRoutes.length };
  }, [visibleRoutes]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  return (
    <div className={`relative w-full h-full ${dark ? 'dark' : ''}`}>
      <div
        ref={mapEl}
        className="absolute top-0 right-0 bottom-0"
        style={{ '--accent': accent, left: -(isMobile ? 0 : MAP_UNDERLAY_DESKTOP), background: savedMapBg() }}>
      </div>

      {/* Custom POI placement cursor — when in POI step and a POI template is selected */}
      {creating && cursorPos && placingPoi && !hoveringPoi && (() => {
        const ICON_PATHS = {
          Pin: '<path d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Z" /><circle cx="12" cy="9" r="2.5" />',
          Flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5" />',
          Alert: '<circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16v.01" />',
          Checkpoint: '<circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />',
          Info: '<circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5" />',
          Medical: '<path d="M12 4v16M4 12h16" />',
          Accommodation: '<path d="M4 21V10l8-6 8 6v11M9 21v-7h6v7" />',
          Water: '<path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12Z" />',
          Restaurant: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v8M11 3v8M16 3c-1 0-2 2-2 5s1 4 2 4v9" />',
          Parking: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M10 17V8h3a2.5 2.5 0 1 1 0 5h-3" />',
          Camera: '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="4" />',
        };
        const cHex = ROUTE_COLORS[placingPoi.color]?.hex || accent;
        const inner = ICON_PATHS[placingPoi.icon] || ICON_PATHS.Pin;
        // Magnetic snap: if cursor is within SNAP_RADIUS_PX of the route, move the
        // ghost icon to the projected point. Threshold + smooth transition for
        // the "aimant" feel. Also compute the km along the route at the snap
        // point so we can show a "km X.XX" pill near the cursor.
        let display = { x: cursorPos.x, y: cursorPos.y, snapped: false, km: null };
        const offX = isMobile ? 0 : -MAP_UNDERLAY_DESKTOP; // carte décalée sous la navigation
        try {
          const map = mapRef.current;
          if (map && cursorLatLng && draftCoords && draftCoords.length >= 2) {
            let bestPt = null;
            let bestIdx = 0, bestT = 0;
            let bestPxDist = Infinity;
            for (let i = 0; i < draftCoords.length - 1; i++) {
              const a = draftCoords[i], b = draftCoords[i + 1];
              const dx = b[1] - a[1], dy = b[0] - a[0];
              const len2 = dx * dx + dy * dy;
              let t = len2 === 0 ? 0 : ((cursorLatLng[1] - a[1]) * dx + (cursorLatLng[0] - a[0]) * dy) / len2;
              t = Math.max(0, Math.min(1, t));
              const py = a[0] + t * dy, px = a[1] + t * dx;
              const projPx = map.latLngToContainerPoint([py, px]);
              const dxPx = projPx.x - cursorPos.x;
              const dyPx = projPx.y - cursorPos.y;
              const d = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
              if (d < bestPxDist) { bestPxDist = d; bestPt = projPx; bestIdx = i; bestT = t; }
            }
            const SNAP_RADIUS_PX = 48;
            if (bestPt && bestPxDist <= SNAP_RADIUS_PX) {
              let km = null;
              if (coordCumKm && coordCumKm.length > bestIdx + 1) {
                const a = coordCumKm[bestIdx];
                const b = coordCumKm[bestIdx + 1];
                km = a + bestT * (b - a);
              }
              display = { x: bestPt.x, y: bestPt.y, snapped: true, km };
            }
          }
        } catch (e) {}
        return (
          <div
            className="pointer-events-none absolute z-[600]"
            style={{
              left: display.x + offX, top: display.y,
              transform: 'translate(-50%, -50%)',
              transition: display.snapped ? 'left 90ms ease-out, top 90ms ease-out' : 'none',
            }}
          >
            {display.snapped && (
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                width: 56, height: 56, marginLeft: -28, marginTop: -28,
                borderRadius: '50%',
                background: 'radial-gradient(circle, ' + cHex + '55 0%, ' + cHex + '00 70%)',
                pointerEvents: 'none',
              }}></div>
            )}
            <div style={{ position: 'relative', width: 30, height: 30, display: 'grid', placeItems: 'center' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%', background: cHex,
                boxShadow: display.snapped
                  ? '0 0 0 3px #fff, 0 2px 10px rgba(0,0,0,0.45)'
                  : '0 2px 6px rgba(0,0,0,0.35)',
                border: '2.5px solid #fff',
                transform: display.snapped ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
              }}></div>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }} dangerouslySetInnerHTML={{ __html: inner }} />
            </div>
            {/* Km along route popover */}
            {display.snapped && display.km != null && (
              <div
                style={{
                  position: 'absolute', left: '50%', top: -10,
                  transform: 'translate(-50%, -100%)',
                  background: dark ? '#171717' : '#171717',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 7px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  letterSpacing: 0,
                }}
              >
                km {display.km.toFixed(2)}
                <span style={{
                  position: 'absolute', left: '50%', top: '100%',
                  transform: 'translateX(-50%)',
                  width: 0, height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '4px solid #171717',
                }}></span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Custom creation cursor — with "first point" label */}
      {creating && cursorPos && !placingPoi && !hoveringPoi &&
      <div
        className="pointer-events-none absolute z-[600]"
        style={{
          // cursorPos est relatif à la carte, elle-même décalée sous la navigation
          left: cursorPos.x - (isMobile ? 0 : MAP_UNDERLAY_DESKTOP),
          top: cursorPos.y,
          transform: 'translate(-13px, -13px)'
        }}>
        
          <svg
          width="26"
          height="26"
          viewBox="0 0 26 26"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
          
            <path d="M13 4v18M4 13h18" stroke="white" strokeWidth="5" strokeLinecap="round" />
            <path d="M13 4v18M4 13h18" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {(!draftCoords || draftCoords.length === 0) ?
        <div
          className="absolute left-[28px] top-[14px] px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap text-[12px] font-medium text-white"
          style={{ background: accent }}>
              Posez votre point de départ
            </div> :
        routingBusy ?
        <div className="absolute left-[28px] top-[14px] px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap text-[12px] font-medium text-white bg-black/80 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></span> Calcul du tracé…
            </div> :
        draftCoords.length >= 2 && !draftHintDismissed &&
        <div className="absolute left-[28px] top-[16px] px-2.5 py-1.5 rounded-md shadow-lg text-[11.5px] leading-snug text-white bg-black/80 w-[230px]">
              Pour terminer, cliquez sur le dernier point posé ou appuyez sur <span className="font-semibold">Entrée ↵</span>.
            </div>
        }
        </div>
      }

      {/* Single-route stats panel (one route visible, not drawing) */}
      

      {/* Single-route stats panel (one route visible, not drawing) */}
      {singleRouteStats && (() => {
        try {
          const r = singleRouteStats.route;
          const stats = singleRouteStats.stats;
          const col = (ROUTE_COLORS[r.color] && ROUTE_COLORS[r.color].hex) || '#3b82f6';
          return (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-6 max-md:bottom-10 z-[500] w-[min(94%,920px)]">
              <div className={`rounded-md glass ${dark ? 'text-neutral-100' : 'text-neutral-800'}`}>
                <div className="flex items-center justify-between gap-6 pl-3 pr-5 pt-3.5 pb-3 max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:pr-3">
                <div className="flex items-center gap-3 min-w-0">
                  {(() => {
                    const parent = singleRouteStats.parentItinerary;
                    const actKey = parent && parent.activity;
                    const ActIcon = actKey && ACTIVITIES[actKey] ? I[ACTIVITIES[actKey].icon] : I.Route;
                    return (
                      <span
                        className="w-7 h-7 rounded-md grid place-items-center shrink-0"
                        style={{ background: col + '22', color: col }}>
                        <ActIcon size={14} strokeWidth="2" />
                      </span>
                    );
                  })()}
                  <span className={`text-[12.5px] font-medium truncate ${dark ? 'text-white' : 'text-neutral-900'}`}>
                    {r.isSection
                      ? <><span className={dark ? 'text-neutral-400' : 'text-neutral-500'}>{r.parentName} · </span>{r.shortName}</>
                      : r.name}
                  </span>
                </div>
                  <div className="flex items-center gap-7 shrink-0 max-md:flex-wrap max-md:gap-x-5 max-md:gap-y-3 max-md:pl-1">
                    <DraftStatIcon dark={dark} icon={<I.Distance size={11} />} label="Distance"
                      value={(singleRouteStats.distance || 0).toFixed(2) + ' km'} />
                    <DraftStatIcon dark={dark} icon={<I.Mountains size={11} />} label="Altitude"
                      value={`${stats.minAlt} m – ${stats.maxAlt} m`} />
                    <DraftStatIcon dark={dark} icon={<I.TrendingUp size={11} />} label="D+"
                      value={`${stats.ascent} m`} />
                    <DraftStatIcon dark={dark} icon={<I.TrendingDown size={11} />} label="D−"
                      value={`${stats.descent} m`} />
                    <DraftStatIcon dark={dark} icon={<I.Slope size={11} />} label="Pente"
                      value={`${stats.slopeMin}° – ${stats.slopeMax}°`} />
                    <Tooltip dark={dark} label="Durée estimée"
                      sub="Basée sur un rythme moyen pour l'activité + le dénivelé. À titre indicatif." side="top">
                      <DraftStatIcon dark={dark} icon={<I.Clock size={11} />} label="Estimé"
                        value={fmtDuration(estimateDurationMin(singleRouteStats.distance || 0, stats.ascent || 0, (singleRouteStats.parentItinerary && singleRouteStats.parentItinerary.activity) || r.activity))} info />
                    </Tooltip>
                    {/* Divider + discreet icon-only Share button */}
                    <span className={`w-px self-stretch my-0.5 -ml-3 ${dark ? 'bg-neutral-700/60' : 'bg-neutral-200'}`}></span>
                    <Tooltip dark={dark} label="Partager cet itinéraire" sub="Lien public ou intégration sur votre site" side="top" delay={120}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAction && onAction('share', { itinerary: singleRouteStats.parentItinerary || r }); }}
                        className={`-ml-3 p-1.5 rounded-md transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}
                        aria-label="Partager cet itinéraire"
                      >
                        <I.ShareUp size={15} />
                      </button>
                    </Tooltip>
                    {/* 3-dots actions menu — placed at the far right */}
                    <div className="relative -ml-5" ref={singleMenuRef}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSingleMenuOpen((o) => !o); }}
                        className={`p-1.5 rounded-md transition-colors ${singleMenuOpen
                          ? (dark ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-900')
                          : (dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100')
                        }`}
                        title="Actions"
                        aria-haspopup="menu"
                        aria-expanded={singleMenuOpen}>
                        <I.More size={14} />
                      </button>
                      {singleMenuOpen && (
                        <div
                          role="menu"
                          className={`absolute right-0 bottom-full mb-1 z-30 w-52 rounded-lg shadow-2xl overflow-hidden animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}>
                          <SingleRoutePopItem dark={dark} icon={<I.Edit size={13} />} label="Modifier le tracé"
                            onClick={() => { setSingleMenuOpen(false); onAction && onAction('edit', { itinerary: singleRouteStats.parentItinerary || r, groupId: singleRouteStats.groupId }); }} />
                          <SingleRoutePopItem dark={dark} icon={<I.Share size={13} />} label="Partager"
                            onClick={() => { setSingleMenuOpen(false); onAction && onAction('share', { itinerary: singleRouteStats.parentItinerary || r }); }} />
                          <SingleRoutePopItem dark={dark} icon={<I.Download size={13} />} label="Exporter en GPX"
                            onClick={() => { setSingleMenuOpen(false); onAction && onAction('export', { itinerary: singleRouteStats.parentItinerary || r }); }} />
                          <SingleRoutePopItem dark={dark} icon={<I.Folder size={13} />} label="Déplacer vers…"
                            onClick={() => { setSingleMenuOpen(false); onAction && onAction('move', { itinerary: singleRouteStats.parentItinerary || r, groupId: singleRouteStats.groupId }); }} />
                          <SingleRoutePopItem dark={dark} icon={<I.Pin size={13} />} label="Renommer"
                            onClick={() => { setSingleMenuOpen(false); onAction && onAction('rename', { itinerary: singleRouteStats.parentItinerary || r }); }} />
                          <div className={`h-px mx-2 my-1 ${dark ? 'bg-neutral-800' : 'bg-neutral-100'}`}></div>
                          <SingleRoutePopItem dark={dark} icon={<I.Trash size={13} />} label="Supprimer" danger
                            onClick={() => { setSingleMenuOpen(false); onAction && onAction('delete', { itinerary: singleRouteStats.parentItinerary || r, groupId: singleRouteStats.groupId }); }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`px-5 pb-3 pt-3 ${dark ? 'border-t border-neutral-700/50' : 'border-t border-neutral-200/70'}`}>
                  <DraftElevationChart
                    dark={dark}
                    accent={col}
                    profile={stats.profile}
                    minAlt={stats.minAlt}
                    maxAlt={stats.maxAlt}
                    distance={singleRouteStats.distance || 0}
                    sectionRanges={singleRouteStats.sectionRanges}
                    coordCumKm={singleRouteStats.coordCumKm}
                    coords={singleRouteStats.coords}
                    pois={singleRouteStats.parentItinerary && singleRouteStats.parentItinerary.pois}
                  />
                </div>
              </div>
            </div>
          );
        } catch (e) {
          return null;
        }
      })()}

      {/* Right-side controls */}
      <MapControls
        dark={dark}
        accent={accent}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        creating={creating}
        userLocation={userLocation}
        mapRef={mapRef}
        onRequestLocation={onRequestLocation}
        onCenterUserLocation={() => {
          if (userLocation && mapRef.current) {
            try { mapRef.current.flyTo(userLocation, 14, { duration: 0.9 }); } catch (e) {}
          }
        }}
      />

      {/* Drawing helper overlay (creating mode) — bottom-centered, full draft stats */}
      {creating &&
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 max-md:bottom-10 z-[500] w-[min(96%,1140px)]">
          <div
          className={`rounded-md glass ${dark ? 'text-neutral-100' : 'text-neutral-800'}`}>

            {/* Prompt while empty */}
            {(!draftCoords || draftCoords.length === 0) ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-md grid place-items-center shrink-0"
                    style={{ background: accent + '22', color: accent }}>
                    <I.Pin size={14} />
                  </span>
                  <span className="text-[12.5px] font-medium">Cliquez sur la carte pour poser le départ</span>
                </div>
              </div>
            ) : (
              <>
                {/* Stats row */}
                <div className="flex items-center justify-between gap-6 px-5 pt-3.5 pb-3">
                  <div className="flex items-center gap-7">
                    <DraftStatIcon dark={dark} icon={<I.Distance size={11} />} label="Distance"
                      value={(shownStats?.distance || 0).toFixed(2) + ' km'} highlight={!!hoveredSection} />
                    <DraftStatIcon dark={dark} icon={<I.Mountains size={11} />} label="Altitude"
                      value={shownStats?.noEle ? '—' : `${shownStats?.minAlt || 0} m – ${shownStats?.maxAlt || 0} m${shownStats?.partialEle ? ' …' : ''}`} highlight={!!hoveredSection} />
                    <DraftStatIcon dark={dark} icon={<I.TrendingUp size={11} />} label="D+"
                      value={shownStats?.noEle ? '—' : `${shownStats?.ascent || 0} m${shownStats?.partialEle ? ' …' : ''}`} highlight={!!hoveredSection} />
                    <DraftStatIcon dark={dark} icon={<I.TrendingDown size={11} />} label="D−"
                      value={shownStats?.noEle ? '—' : `${shownStats?.descent || 0} m${shownStats?.partialEle ? ' …' : ''}`} highlight={!!hoveredSection} />
                    <DraftStatIcon dark={dark} icon={<I.Slope size={11} />} label="Pente"
                      value={shownStats?.noEle ? '—' : `${shownStats?.slopeMin || 0}° – ${shownStats?.slopeMax || 0}°`} highlight={!!hoveredSection} />
                    <Tooltip dark={dark} label="Durée estimée"
                      sub="Basée sur un rythme moyen pour l'activité + le dénivelé. À titre indicatif." side="top">
                      <DraftStatIcon dark={dark} icon={<I.Clock size={11} />} label="Estimé"
                        value={fmtDuration(estimateDurationMin(shownStats?.distance || 0, shownStats?.ascent || 0, draftActivity))}
                        highlight={!!hoveredSection} info />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1.5">
                        <button
                          onClick={onAddSection}
                          className={`flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md border border-dashed transition-colors ${dark ? 'border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/60' : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}
                          title="Ajouter une nouvelle section">
                          <I.Plus size={12} strokeWidth="2.4" /> Nouvelle section
                        </button>
                        {draftCoords.length >= 2 &&
                        <button
                          onClick={onFinish}
                          className="btn-cta-primary flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-md text-white shadow-sm transition-all hover:shadow active:scale-[0.98]"
                          style={{ background: accent }}
                          title="Valider l'itinéraire">
                          <I.Check size={12} stroke="white" strokeWidth="3" />
                          Valider
                        </button>
                        }
                      
                  </div>
                </div>

                {/* Elevation chart */}
                {draftCoords.length >= 2 && (
                  <div className={`px-5 pb-3 pt-3 ${dark ? 'border-t border-neutral-700/50' : 'border-t border-neutral-200/70'}`}>
                    <DraftElevationChart
                      dark={dark}
                      accent={accent}
                      profile={draftElevation.profile}
                      minAlt={draftElevation.minAlt}
                      maxAlt={draftElevation.maxAlt}
                      distance={draftDistance || 0}
                      coordCumKm={coordCumKm}
                      sectionRanges={sectionRanges}
                      hoverIdx={hoverIdx}
                      onHoverIdxChange={setHoverIdx}
                      pois={draftPois}
                      coords={draftCoords}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      }

      {/* Barre d'outils du tracé (façon Visorando) */}
      {creating && !placingPoi && (
        <DraftToolbar
          dark={dark}
          isMobile={isMobile}
          autoRoute={autoRoute}
          onToggleAutoRoute={onToggleAutoRoute}
          routeProfile={routeProfile}
          onRouteProfile={onRouteProfile}
          busy={routingBusy}
          color={(() => { const sec = (draftSections || []).find((x) => x.id === activeSectionId) || (draftSections || [])[0]; return sec ? sec.color : 'blue'; })()}
          onColor={onDraftColor}
          canUndo={!!(draftCoords && draftCoords.length)}
          onUndo={onUndo}
          onClear={onClearDraft}
          canCenter={!!(draftCoords && draftCoords.length)}
          onCenter={() => {
            const map = mapRef.current;
            if (!map || !draftCoords || !draftCoords.length) return;
            if (draftCoords.length === 1) map.flyTo(draftCoords[0], Math.max(map.getZoom(), 14), { duration: 0.5 });
            else map.flyToBounds(L.latLngBounds(draftCoords.map((c) => [c[0], c[1]])), { ...mapFitPadding(60), maxZoom: 16, duration: 0.6 });
          }} />
      )}

      {/* Scale + attribution bottom-left already provided by Leaflet */}

      {/* Friendly geolocation prompt (Free plan, first open) */}
      {locationPrompt === 'pending' && !creating && (
        <div className="absolute inset-0 z-[700] flex items-center justify-center p-4">
          {/* Dim the map behind */}
          <div
            className="absolute inset-0 backdrop-blur-[1px]"
            style={{ background: 'rgba(15,15,15,0.28)' }}
            onClick={onDeclineLocation}
          ></div>
          <div
            className={`relative w-[420px] max-w-full rounded-xl shadow-2xl overflow-hidden animate-tip ${dark ? 'bg-neutral-900 border border-neutral-700/60 text-neutral-100' : 'bg-white border border-neutral-200/80 text-neutral-900'}`}
            style={{ transform: 'translateY(-15%)' }}
          >
            <div className={`relative h-[126px] overflow-hidden ${dark ? 'bg-neutral-800/40' : 'bg-blue-50'}`}>
              <GeoIllustration dark={dark} />
            </div>
            <div className="px-7 pt-5 pb-6">
              <h3 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>
                Activer votre localisation&nbsp;?
              </h3>
              <p className={`mt-2 text-[12.5px] leading-relaxed ${dark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Pour vous afficher sur la carte et vous suggérer des itinéraires près de chez vous, GPXmap peut accéder à votre position.
              </p>
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={onDeclineLocation}
                  className={`flex-1 rounded-md px-3 py-2.5 text-[12.5px] font-medium border transition-colors whitespace-nowrap ${dark ? 'border-neutral-800 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                >
                  Pas maintenant
                </button>
                <button
                  onClick={onAcceptLocation}
                  className="btn-cta-primary flex-[1.4] rounded-md px-3 py-2.5 text-[12.5px] font-medium text-white shadow-sm transition-all hover:shadow active:scale-[0.99] flex items-center justify-center gap-1.5 whitespace-nowrap"
                  style={{ background: '#3b82f6' }}
                >
                  <I.LocateArrow size={13} />
                  Activer la localisation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick-stats live legend */}
      {showLegend && totals.count > 0 && !creating && !singleRouteStats &&
      <div className={`absolute z-[500] rounded-md overflow-hidden glass ${isMobile ? 'left-3 right-3' : 'bottom-4 right-4'} ${dark ? 'text-neutral-100' : 'text-neutral-900'}`}
        style={isMobile ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)' } : { width: 'min(560px, 90vw)' }}>
          <button type="button" onClick={() => setLegendOpen((o) => !o)} aria-expanded={legendOpen}
            title={legendOpen ? 'Masquer le détail' : 'Afficher le détail des itinéraires'}
            className={`w-full text-left px-5 pt-4 pb-3 flex items-center justify-between gap-8 transition-colors ${dark ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.02]'}`}>
            <div>
              <div className={`text-[10px] font-medium uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Affichés</div>
              <div className="text-sm font-semibold mt-1">{totals.count} itinéraire{totals.count > 1 ? 's' : ''}</div>
            </div>
            <div className="flex gap-6">
              <div>
                <div className={`text-[10px] font-medium uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Distance</div>
                <div className="text-sm font-semibold tabular-nums mt-1">{totals.dist.toFixed(1)} km</div>
              </div>
              <div>
                <div className={`text-[10px] font-medium uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>D+ total</div>
                <div className="text-sm font-semibold tabular-nums mt-1">{fmtAscent(totals.ascent)}</div>
              </div>
              <span className={`self-center w-7 h-7 -mr-1.5 grid place-items-center rounded-md ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                <span className="block transition-transform" style={{ transform: legendOpen ? 'rotate(180deg)' : 'none' }}><I.ChevronUp size={16} /></span>
              </span>
            </div>
          </button>
          {legendOpen &&
          <div className={`px-3 py-3 max-h-72 overflow-y-auto sb-scroll ${dark ? 'border-t border-neutral-700/60' : 'border-t border-neutral-200/80'}`}>
            <div className="flex flex-col gap-0.5">
              {visibleRoutes.map((r) => (
                <LegendRow
                  key={r.id}
                  route={r}
                  dark={dark}
                  expanded={expandedLegend === r.id}
                  onToggleExpand={() => setExpandedLegend(expandedLegend === r.id ? null : r.id)}
                  onHide={() => onToggleVisible(r.id)}
                />
              ))}
            </div>
          </div>
          }
        </div>
      }
    </div>);

}

// Barre d'outils pendant le tracé : tracé automatique (sentiers / chemins /
// routes), recentrer, couleur, retour, supprimer.
const DRAFT_BAR_POS_KEY = 'gr34_draft_bar_pos';
function DraftToolbar({ dark, isMobile, autoRoute, onToggleAutoRoute, routeProfile, onRouteProfile, busy, color, onColor, canUndo, onUndo, onClear, canCenter, onCenter }) {
  // Position libre (glisser la poignée), mémorisée ; double-clic = recentrer
  const rootRef = useRef(null);
  const [pos, setPos] = useState(() => { try { return JSON.parse(localStorage.getItem(DRAFT_BAR_POS_KEY) || 'null'); } catch (e) { return null; } });
  const [dragging, setDragging] = useState(false);
  const clampPos = (p) => {
    const el = rootRef.current, parent = el && el.offsetParent;
    if (!el || !parent || !p) return p;
    return {
      x: Math.max(8, Math.min(parent.clientWidth - el.offsetWidth - 8, p.x)),
      y: Math.max(8, Math.min(parent.clientHeight - el.offsetHeight - 8, p.y)),
    };
  };
  // Reste dans la carte si la fenêtre ou la barre change de taille
  useEffect(() => {
    if (!pos) return;
    const fix = () => setPos((p) => clampPos(p));
    fix();
    window.addEventListener('resize', fix);
    return () => window.removeEventListener('resize', fix);
  }, [autoRoute]);
  const startDrag = (e) => {
    if (isMobile) return;
    e.preventDefault(); e.stopPropagation();
    const el = rootRef.current, parent = el.offsetParent;
    const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect();
    const gx = e.clientX - r.left, gy = e.clientY - r.top;
    let last = null;
    setDragging(true);
    const move = (ev) => { last = clampPos({ x: ev.clientX - pr.left - gx, y: ev.clientY - pr.top - gy }); setPos(last); };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      try { if (last) localStorage.setItem(DRAFT_BAR_POS_KEY, JSON.stringify(last)); } catch (err) {}
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const resetPos = () => { setPos(null); try { localStorage.removeItem(DRAFT_BAR_POS_KEY); } catch (e) {} };
  const [colorOpen, setColorOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const colorRef = useRef(null);
  useEffect(() => {
    if (!colorOpen) return;
    const onDoc = (e) => { if (colorRef.current && !colorRef.current.contains(e.target)) setColorOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [colorOpen]);
  useEffect(() => { if (!confirmClear) return; const t = setTimeout(() => setConfirmClear(false), 2500); return () => clearTimeout(t); }, [confirmClear]);
  const hex = (ROUTE_COLORS[color] && ROUTE_COLORS[color].hex) || '#3b82f6';
  const btn = `h-9 min-w-9 px-2 grid place-items-center rounded-md transition-colors ${dark ? 'text-neutral-200 hover:bg-white/10 disabled:text-neutral-600 disabled:hover:bg-transparent' : 'text-neutral-700 hover:bg-neutral-100 disabled:text-neutral-300'}`;
  const sep = <span className={`w-px h-6 mx-1 ${dark ? 'bg-white/10' : 'bg-neutral-200'}`}></span>;
  const stop = (e) => e.stopPropagation();
  return (
    <div ref={rootRef} onMouseDown={stop} onClick={stop} onDoubleClick={stop}
      className={`absolute z-[650] flex items-center gap-0.5 p-1 rounded-lg glass-strong ${dragging ? 'shadow-2xl ring-1 ring-white/20' : 'shadow-xl'} ${dark ? 'text-neutral-100' : 'text-neutral-900'} ${isMobile ? 'left-3 right-[60px] flex-wrap' : (pos ? '' : 'left-1/2 -translate-x-1/2 top-4')}`}
      style={isMobile ? { top: 'calc(env(safe-area-inset-top, 0px) + 68px)' } : (pos ? { left: pos.x, top: pos.y } : undefined)}>
      {!isMobile && (
        <Tooltip dark={dark} label="Déplacer la barre" sub="Glisser · double-clic pour la recentrer">
          <span onPointerDown={startDrag} onDoubleClick={resetPos}
            className={`h-9 w-6 grid place-items-center rounded-md touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${dark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-white/10' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`}>
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2.5" cy="3" r="1.4" /><circle cx="7.5" cy="3" r="1.4" /><circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" /><circle cx="2.5" cy="13" r="1.4" /><circle cx="7.5" cy="13" r="1.4" /></svg>
          </span>
        </Tooltip>
      )}
      {/* Tracé automatique */}
      <Tooltip dark={dark} label={autoRoute ? 'Tracé automatique activé' : 'Tracé automatique désactivé'} sub={autoRoute ? 'Le tracé suit les ' + ((ROUTE_PROFILES[routeProfile] || {}).label || '').toLowerCase() + ' de la carte' : 'Lignes droites entre les points'}>
        <button onClick={onToggleAutoRoute} aria-pressed={autoRoute}
          className={`h-9 flex items-center gap-2 pl-2 pr-2.5 rounded-md transition-colors whitespace-nowrap ${dark ? 'hover:bg-white/10' : 'hover:bg-neutral-100'}`}>
          <span className="relative rounded-full transition-colors shrink-0" style={{ width: 30, height: 18, background: autoRoute ? '#3b82f6' : (dark ? '#404040' : '#d4d4d4') }}>
            <span className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all grid place-items-center" style={{ left: autoRoute ? 14 : 2 }}>
              {busy && <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin"></span>}
            </span>
          </span>
          <span className="text-[12.5px] font-medium">Tracé auto</span>
        </button>
      </Tooltip>
      {autoRoute && (
        <div className={`flex items-center p-0.5 rounded-md ${dark ? 'bg-black/30' : 'bg-neutral-100'}`}>
          {Object.entries(ROUTE_PROFILES).map(([k, p]) => (
            <button key={k} onClick={() => onRouteProfile(k)}
              className={`h-8 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors whitespace-nowrap ${routeProfile === k ? (dark ? 'bg-white/15 text-white' : 'bg-white text-neutral-900 shadow-sm') : (dark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-900')}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      {sep}
      <Tooltip dark={dark} label="Recentrer sur le tracé">
        <button className={btn} onClick={onCenter} disabled={!canCenter} aria-label="Recentrer sur le tracé">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </Tooltip>
      <div className="relative" ref={colorRef}>
        <Tooltip dark={dark} label="Couleur du tracé">
          <button className={btn} onClick={() => setColorOpen((o) => !o)} aria-label="Couleur du tracé" aria-expanded={colorOpen}>
            <span className="w-[18px] h-[18px] rounded-full ring-2 ring-white/80" style={{ background: hex }}></span>
          </button>
        </Tooltip>
        {colorOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-40 w-[194px] p-2 rounded-md shadow-2xl animate-menu glass-strong">
            <div className={`text-[10px] font-semibold uppercase tracking-wider px-0.5 pb-1.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Couleur du tracé</div>
            <div className="grid grid-cols-6 gap-1.5">
              {Object.entries(ROUTE_COLORS).map(([key, c]) => (
                <button key={key} title={c.name} onClick={() => { onColor(key); setColorOpen(false); }}
                  className="w-6 h-6 rounded-full grid place-items-center transition-transform hover:scale-110"
                  style={{ background: c.hex, boxShadow: color === key ? `0 0 0 2px ${dark ? '#171717' : '#fff'}, 0 0 0 3.5px ${c.hex}` : 'none' }}>
                  {color === key && <I.Check size={12} stroke="white" strokeWidth="3" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {sep}
      <Tooltip dark={dark} label="Retour" sub="Annule le dernier segment (Ctrl/Cmd + Z)">
        <button className={btn} onClick={onUndo} disabled={!canUndo} aria-label="Retour">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
        </button>
      </Tooltip>
      <Tooltip dark={dark} label={confirmClear ? 'Cliquez à nouveau pour supprimer' : 'Supprimer le tracé en cours'}>
        <button onClick={() => { if (!canUndo) return; if (confirmClear) { setConfirmClear(false); onClear(); } else setConfirmClear(true); }} disabled={!canUndo} aria-label="Supprimer le tracé"
          className={`${btn} ${confirmClear ? '!bg-rose-500/20 !text-rose-400 px-2.5' : ''}`}>
          {confirmClear ? <span className="text-[12px] font-semibold whitespace-nowrap">Supprimer ?</span> : <I.Trash size={16} />}
        </button>
      </Tooltip>
    </div>
  );
}

function MapBtn({ children, dark, onClick, active, refEl }) {
  return (
    <button
      ref={refEl}
      onClick={onClick}
      className={`w-9 h-9 grid place-items-center transition-colors ${active ? (dark ? 'text-white bg-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-neutral-900 bg-neutral-100') : (dark ? 'text-neutral-300 hover:text-white hover:bg-white/[0.08]' : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50')}`}>
      {children}
    </button>);
}

function DraftMapStat({ dark, label, value }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className={`text-[9.5px] font-medium uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${dark ? 'text-white' : 'text-neutral-900'}`}>{value}</span>
    </div>);

}

function DraftStatIcon({ dark, icon, label, value, highlight, info }) {
  return (
    <div className="flex flex-col leading-tight">
      <div className={`flex items-center gap-1 text-[10px] font-medium ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
        <span className="opacity-90">{icon}</span>
        <span className={info ? 'border-b border-dotted border-current/40 cursor-help' : ''}>{label}</span>
      </div>
      <span
        className={`text-[12.5px] font-semibold tabular-nums mt-0.5 transition-colors ${dark ? 'text-white' : 'text-neutral-900'}`}
        style={highlight ? { color: 'currentColor' } : undefined}
      >{value}</span>
    </div>
  );
}

function DraftElevationChart({ dark, accent, profile, minAlt, maxAlt, distance, hoverIdx, onHoverIdxChange, sectionRanges, coordCumKm, pois, coords }) {
  if (!profile || profile.length < 2) return null;
  const W = 880, H = 56, PAD_L = 36, PAD_R = 8, PAD_T = 8, PAD_B = 14;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const range = Math.max(maxAlt - minAlt, 1);
  // Profile sampling constant — keep in sync with computeElevationStats.
  const SAMPLES_PER_SEG = 8;
  // Distance-based X: map each profile index to its cumulative km, then to X.
  const totalKm = distance > 0 ? distance
    : (coordCumKm && coordCumKm.length ? coordCumKm[coordCumKm.length - 1] : 1);
  const kmAt = (p) => {
    if (!coordCumKm || coordCumKm.length === 0) {
      // Fallback: index-proportional
      return (p / (profile.length - 1)) * totalKm;
    }
    if (p >= profile.length - 1) return coordCumKm[coordCumKm.length - 1];
    const c = Math.floor(p / SAMPLES_PER_SEG);
    const t = (p % SAMPLES_PER_SEG) / SAMPLES_PER_SEG;
    if (c + 1 >= coordCumKm.length) return coordCumKm[coordCumKm.length - 1];
    return coordCumKm[c] + t * (coordCumKm[c + 1] - coordCumKm[c]);
  };
  const toX = (p) => PAD_L + (kmAt(p) / Math.max(totalKm, 0.0001)) * innerW;
  const toY = (alt) => PAD_T + (1 - (alt - minAlt) / range) * innerH;

  // Convert sectionRanges (in COORD space) to PROFILE space at render time.
  const useSections = sectionRanges && sectionRanges.length > 0;
  // Hover index: external wiring if provided, else internal (read-only panel).
  const [internalHover, setInternalHover] = React.useState(null);
  const effHoverIdx = (onHoverIdxChange ? hoverIdx : internalHover);
  // Coord index N maps to profile idx N * SAMPLES_PER_SEG, EXCEPT the very last
  // coord which maps to profile.length - 1 (the appended last point).
  const lastCoordIdx = (coordCumKm && coordCumKm.length ? coordCumKm.length - 1 : 0);
  const coordToProfile = (c) => (c >= lastCoordIdx) ? (profile.length - 1) : (c * SAMPLES_PER_SEG);

  const buildSeg = (startI, endI) => {
    if (endI <= startI) return { line: '', area: '' };
    const parts = [];
    for (let i = startI; i <= endI && i < profile.length; i++) {
      parts.push((i === startI ? 'M' : 'L') + toX(i).toFixed(1) + ' ' + toY(profile[i]).toFixed(1));
    }
    const line = parts.join(' ');
    const lastX = toX(Math.min(endI, profile.length - 1)).toFixed(1);
    const firstX = toX(startI).toFixed(1);
    const area = line + ' L ' + lastX + ' ' + (PAD_T + innerH).toFixed(1) + ' L ' + firstX + ' ' + (PAD_T + innerH).toFixed(1) + ' Z';
    return { line, area };
  };

  // Identify hovered section (if any) so we can dim the others
  const hoveredSec = (useSections && effHoverIdx != null)
    ? sectionRanges.find((r) => {
        const sP = coordToProfile(r.startCoord ?? r.startIdx);
        const eP = coordToProfile(r.endCoord ?? r.endIdx);
        return effHoverIdx >= sP && effHoverIdx <= eP;
      })
    : null;

  const fallbackLine = profile.map((v, i) => (i === 0 ? 'M' : 'L') + toX(i).toFixed(1) + ' ' + toY(v).toFixed(1)).join(' ');
  const fallbackArea = fallbackLine + ' L ' + toX(profile.length - 1).toFixed(1) + ' ' + (PAD_T + innerH).toFixed(1) + ' L ' + toX(0).toFixed(1) + ' ' + (PAD_T + innerH).toFixed(1) + ' Z';
  const t0 = Math.round(minAlt / 10) * 10;
  const t1 = Math.round(maxAlt / 10) * 10;
  const axisColor = dark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)';
  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const svgRef = React.useRef(null);
  const setHover = (v) => { if (onHoverIdxChange) onHoverIdxChange(v); else setInternalHover(v); };
  const handleMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    if (xPx < PAD_L || xPx > W - PAD_R) { setHover(null); return; }
    const idx = Math.round(((xPx - PAD_L) / innerW) * (profile.length - 1));
    setHover(Math.max(0, Math.min(profile.length - 1, idx)));
  };
  const handleLeave = () => setHover(null);

  const hover = (effHoverIdx != null && effHoverIdx >= 0 && effHoverIdx < profile.length) ? {
    idx: effHoverIdx,
    x: toX(effHoverIdx),
    y: toY(profile[effHoverIdx]),
    alt: Math.round(profile[effHoverIdx]),
  } : null;

  // Resolve POI marker positions in viewBox space → percentages for the HTML overlay.
  const [hoveredPoi, setHoveredPoi] = React.useState(null);
  const poiMarkers = (pois && pois.length > 0 && coords && coords.length >= 2 && coordCumKm && coordCumKm.length >= 2)
    ? pois.map((p) => {
        if (!p.latlng) return null;
        let bestIdx = 0, bestT = 0, bestD = Infinity;
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i], b = coords[i + 1];
          const dx = b[1] - a[1], dy = b[0] - a[0];
          const len2 = dx * dx + dy * dy;
          let t = len2 === 0 ? 0 : ((p.latlng[1] - a[1]) * dx + (p.latlng[0] - a[0]) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
          const px = a[1] + t * dx, py = a[0] + t * dy;
          const d2 = (px - p.latlng[1]) ** 2 + (py - p.latlng[0]) ** 2;
          if (d2 < bestD) { bestD = d2; bestIdx = i; bestT = t; }
        }
        const km = coordCumKm[bestIdx] + bestT * ((coordCumKm[bestIdx + 1] || coordCumKm[bestIdx]) - coordCumKm[bestIdx]);
        const tk = distance > 0 ? distance : coordCumKm[coordCumKm.length - 1];
        const leftPct = (PAD_L + (km / Math.max(tk, 0.0001)) * innerW) / W * 100;
        const filterMeta = p.iconKey && (window.POI_FILTER_TYPES || []).find((t) => t.key === p.iconKey);
        const Ic = filterMeta ? (I[filterMeta.icon] || I.Pin) : (I[p.icon] || I.Pin);
        const cHex = p.iconKey ? (p.catColor || ROUTE_COLORS[p.color]?.hex || accent) : (ROUTE_COLORS[p.color]?.hex || accent);
        return { id: p.id, leftPct, color: cHex, name: p.name, Ic };
      }).filter(Boolean)
    : [];

  const hoverColor = (() => {
    if (!hover) return accent;
    const hoveredR = useSections ? sectionRanges.find((r) => hover.idx >= (coordToProfile(r.startCoord ?? r.startIdx)) && hover.idx <= (coordToProfile(r.endCoord ?? r.endIdx))) : null;
    return hoveredR ? (ROUTE_COLORS[hoveredR.color]?.hex || accent) : accent;
  })();

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'visible' }}>
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="56" style={{ display: 'block' }} preserveAspectRatio="none"
      onMouseMove={handleMove} onMouseLeave={handleLeave}
    >
      <defs>
        <linearGradient id="draft-ele-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.22" />
          <stop offset="1" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[t1, t0].map((t, i) => {
        const yPx = PAD_T + i * innerH;
        return (
          <g key={i}>
            <line x1={PAD_L} y1={yPx} x2={W - PAD_R} y2={yPx} stroke={gridColor} strokeWidth="1" strokeDasharray="2 3" />
            <text x={PAD_L - 6} y={yPx + 3} textAnchor="end" fontSize="9" fill={axisColor} fontFamily="inherit">{t} m</text>
          </g>
        );
      })}
      {useSections ? (
        <>
          {sectionRanges.map((r) => {
            if (r.empty) return null;
            const startP = coordToProfile(r.startCoord ?? r.startIdx);
            const endP = coordToProfile(r.endCoord ?? r.endIdx);
            if (endP <= startP) return null;
            const seg = buildSeg(startP, Math.min(endP, profile.length - 1));
            const color = (ROUTE_COLORS[r.color]?.hex) || accent;
            const isDimmed = hoveredSec && hoveredSec.id !== r.id;
            const isActive = hoveredSec && hoveredSec.id === r.id;
            return (
              <g key={r.id} opacity={isDimmed ? 0.18 : 1} style={{ transition: 'opacity .15s' }}>
                <path d={seg.area} fill={color} opacity={isActive ? 0.22 : 0.14} />
                <path d={seg.line} fill="none" stroke={color} strokeWidth={isActive ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}
          {/* Section boundary tick lines */}
          {sectionRanges.slice(1).map((r) => {
            if (r.empty) return null;
            const startP = coordToProfile(r.startCoord ?? r.startIdx);
            const x = toX(startP);
            return (
              <line key={r.id + '_b'} x1={x} x2={x} y1={PAD_T} y2={PAD_T + innerH}
                stroke={dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.18)'}
                strokeWidth="1" strokeDasharray="2 2" />
            );
          })}
        </>
      ) : (
        <>
          <path d={fallbackArea} fill="url(#draft-ele-fill)" />
          <path d={fallbackLine} fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      <text x={PAD_L} y={H - 3} fontSize="9" fill={axisColor} fontFamily="inherit">0 km</text>
      <text x={W - PAD_R} y={H - 3} textAnchor="end" fontSize="9" fill={axisColor} fontFamily="inherit">{distance.toFixed(2)} km</text>
      {/* Hover vertical guide line (lines aren't distorted enough to matter) */}
      {hover && (
        <line x1={hover.x} y1={PAD_T} x2={hover.x} y2={PAD_T + innerH} stroke={hoverColor} strokeWidth="1" opacity="0.55" />
      )}
    </svg>

    {/* HTML overlay — round dots + labels (not X-stretched, never cropped) */}
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {/* Hover point + altitude label */}
      {hover && (
        <div style={{ position: 'absolute', left: hover.x / W * 100 + '%', top: (hover.y / H) * 56, transform: 'translate(-50%, -50%)' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', border: `2px solid ${hoverColor}`, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></div>
          <div style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%, -6px)',
            background: dark ? '#171717' : '#fff', color: dark ? '#fff' : '#171717',
            border: `1px solid ${hoverColor}`, borderRadius: 5, padding: '2px 6px',
            fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 30, boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          }}>{hover.alt} m</div>
        </div>
      )}
      {/* POI markers — perfect circles, hover reveals name + icon */}
      {poiMarkers.map((m) => {
        const Ic = m.Ic;
        const isHovered = hoveredPoi === m.id;
        return (
          <div key={m.id} style={{ position: 'absolute', left: m.leftPct + '%', top: 0, bottom: 0, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            {/* colored stem */}
            <div style={{ position: 'absolute', top: PAD_T, bottom: PAD_B, left: '50%', width: 1.4, transform: 'translateX(-50%)', background: m.color, opacity: 0.5 }}></div>
            {/* dot (interactive) — small plain dot at rest, icon revealed on hover */}
            <div
              onMouseEnter={() => setHoveredPoi(m.id)}
              onMouseLeave={() => setHoveredPoi((h) => h === m.id ? null : h)}
              style={{
                position: 'absolute', left: '50%', top: 56 - PAD_B - 7, transform: 'translate(-50%, -50%)',
                width: isHovered ? 16 : 9, height: isHovered ? 16 : 9, borderRadius: '50%', background: m.color, border: '2px solid #fff',
                display: 'grid', placeItems: 'center', color: '#fff', cursor: 'default', pointerEvents: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)', zIndex: isHovered ? 40 : 20,
                transition: 'width .12s ease, height .12s ease',
              }}
            >
              {isHovered && <Ic size={9} />}
            </div>
            {/* hover tooltip: icon + name */}
            {isHovered && m.name && (
              <div style={{
                position: 'absolute', left: '50%', top: 56 - PAD_B - 18, transform: 'translate(-50%, -100%)',
                background: dark ? '#171717' : '#fff', color: dark ? '#fff' : '#171717',
                border: `1px solid ${m.color}`, borderRadius: 6, padding: '3px 7px',
                fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 50,
                boxShadow: '0 2px 8px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ color: m.color, display: 'inline-flex' }}><Ic size={11} /></span>
                {m.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

// Pseudo-random but deterministic elevation profile based on the route id, so
// the same route always renders the same shape. Returns an array of points
// in 0..1 normalized coords (x = distance, y = altitude).
function genElevationProfile(seedStr, samples = 48) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0;
  const rand = () => {
    h = (h * 9301 + 49297) | 0;
    return ((h >>> 0) % 100000) / 100000;
  };
  const pts = [];
  let v = 0.3 + rand() * 0.2;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // base undulation
    const base = 0.45 + 0.25 * Math.sin(t * Math.PI * (1.4 + rand() * 0.5)) - 0.15 * Math.cos(t * Math.PI * 3);
    // walk
    v = v * 0.7 + base * 0.3 + (rand() - 0.5) * 0.06;
    pts.push({ x: t, y: Math.max(0.05, Math.min(0.95, v)) });
  }
  return pts;
}

function ElevationChart({ route, dark }) {
  const color = ROUTE_COLORS[route.color].hex;
  // Total distance & ascent (already on route). Use these for axis labels.
  const distKm = route.distance || 0;
  // Generate the elevation profile
  const profile = useMemo(() => genElevationProfile(route.id, 60), [route.id]);
  const W = 320, H = 96, PAD_L = 32, PAD_R = 8, PAD_T = 6, PAD_B = 18;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  // Approximate min/max altitude in meters for ticks. Map y=0 → baseline,
  // y=1 → top. Convert to plausible altitude using the route's D+.
  const ascentM = route.ascent || Math.round(distKm * 40);
  const minAlt = 100 + (route.id.charCodeAt(0) % 50);
  const maxAlt = minAlt + Math.max(ascentM, 200);
  const yToAlt = (y) => minAlt + y * (maxAlt - minAlt);
  // Build path strings
  const toX = (x) => PAD_L + x * innerW;
  const toY = (y) => PAD_T + (1 - y) * innerH;
  const linePath = profile.map((p, i) => (i === 0 ? 'M' : 'L') + toX(p.x).toFixed(1) + ' ' + toY(p.y).toFixed(1)).join(' ');
  const areaPath = linePath + ' L ' + toX(1).toFixed(1) + ' ' + toY(0).toFixed(1) + ' L ' + toX(0).toFixed(1) + ' ' + toY(0).toFixed(1) + ' Z';

  const axisColor = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  // Y ticks (3) – min / mid / max-ish rounded
  const ticks = [
    Math.round(yToAlt(0) / 100) * 100,
    Math.round(yToAlt(0.5) / 100) * 100,
    Math.round(yToAlt(1) / 100) * 100,
  ];

  return (
    <div className={`mt-1.5 mb-2 mx-2 rounded-md p-2 ${dark ? 'bg-neutral-800/60' : 'bg-neutral-50'}`}>
      <div className={`px-1 pb-1 text-[10.5px] font-semibold ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}>Profil d'altitude</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`ele-fill-${route.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.32" />
            <stop offset="1" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {/* Y grid + labels */}
        {ticks.map((t, i) => {
          const yPx = toY(i / 2);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={yPx} x2={W - PAD_R} y2={yPx} stroke={gridColor} strokeWidth="1" strokeDasharray="2 3" />
              <text x={PAD_L - 4} y={yPx + 3.5} textAnchor="end" fontSize="9" fill={axisColor} fontFamily="inherit">{t} m</text>
            </g>
          );
        })}
        {/* Area + line */}
        <path d={areaPath} fill={`url(#ele-fill-${route.id})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* X labels: 0 and total km */}
        <text x={PAD_L} y={H - 4} fontSize="9" fill={axisColor} fontFamily="inherit">0 km</text>
        <text x={W - PAD_R} y={H - 4} textAnchor="end" fontSize="9" fill={axisColor} fontFamily="inherit">{distKm.toFixed(1)} km</text>
      </svg>
    </div>
  );
}

function LegendRow({ route, dark, expanded, onToggleExpand, onHide }) {
  const color = ROUTE_COLORS[route.color]?.hex || '#3b82f6';
  // Compute elevation stats for the expanded view (same shape as the single-route panel)
  const coords = route.coords && route.coords.length
    ? route.coords
    : (route.path && typeof samplePathToLatLng === 'function' ? samplePathToLatLng(route.path, 48) : null);
  const stats = (expanded && coords && coords.length >= 2)
    ? computeElevationStats(coords)
    : null;

  return (
    <div className={`rounded-md ${dark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-50'}`}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          onClick={onToggleExpand}
          className={`p-0.5 -m-0.5 transition-transform ${expanded ? 'rotate-90' : ''} ${dark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-700'}`}
          title={expanded ? 'Replier' : 'Voir le profil d\'altitude'}
        >
          <I.ChevronRight size={12} />
        </button>
        <span
          className="block h-0.5 w-5 rounded-full shrink-0"
          style={{ background: color }}
        ></span>
        <span
          className={`text-[12px] truncate flex-1 ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}
        >
          {route.isSection ? (
            <>
              <span className={dark ? 'text-neutral-400' : 'text-neutral-500'}>{route.parentName} · </span>{route.shortName}
            </>
          ) : route.name}
        </span>
        <span className={`text-[10.5px] tabular-nums shrink-0 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{route.distance.toFixed(1)} km</span>
        <span className={`text-[10.5px] tabular-nums shrink-0 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>↑ {fmtAscent(route.ascent || Math.round((route.distance || 0) * 35))}</span>
        <button
          onClick={onHide}
          className={`p-0.5 rounded transition-colors ${dark ? 'text-neutral-500 hover:text-rose-400' : 'text-neutral-400 hover:text-rose-600'}`}
          title="Masquer"
        >
          <I.X size={12} />
        </button>
      </div>
      {expanded && stats && (
        <div className={`mt-1.5 mx-1 mb-1.5 rounded-lg overflow-hidden ${dark ? 'bg-neutral-900/60 border border-neutral-800' : 'bg-white border border-neutral-200/80'}`}>
          {/* Stats row — like the single-route panel */}
          <div className="flex items-center justify-between gap-5 px-3.5 pt-3 pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-7 h-7 rounded-md grid place-items-center shrink-0"
                style={{ background: color + '22', color }}
              >
                <I.Route size={12} />
              </span>
              <span className={`text-[12px] font-medium truncate ${dark ? 'text-white' : 'text-neutral-900'}`}>
                {route.isSection ? route.shortName : route.name}
              </span>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <ExpandStat dark={dark} icon={<I.Distance size={10} />} label="Distance" value={(route.distance || 0).toFixed(2) + ' km'} />
              <ExpandStat dark={dark} icon={<I.Mountains size={10} />} label="Altitude" value={`${stats.minAlt}–${stats.maxAlt} m`} />
              <ExpandStat dark={dark} icon={<I.TrendingUp size={10} />} label="D+" value={`${stats.ascent} m`} />
              <ExpandStat dark={dark} icon={<I.TrendingDown size={10} />} label="D−" value={`${stats.descent} m`} />
              <ExpandStat dark={dark} icon={<I.Slope size={10} />} label="Pente" value={`${stats.slopeMin}° – ${stats.slopeMax}°`} />
            </div>
          </div>
          <div className={`px-3.5 pb-3 pt-2 ${dark ? 'border-t border-neutral-700/40' : 'border-t border-neutral-200/70'}`}>
            <DraftElevationChart
              dark={dark}
              accent={color}
              profile={stats.profile}
              minAlt={stats.minAlt}
              maxAlt={stats.maxAlt}
              distance={route.distance || 0}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ExpandStat({ dark, icon, label, value }) {
  return (
    <div className="flex flex-col leading-tight">
      <div className={`flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
        <span className="opacity-90">{icon}</span>
        <span>{label}</span>
      </div>
      <span className={`text-[11.5px] font-semibold tabular-nums mt-px ${dark ? 'text-white' : 'text-neutral-900'}`}>{value}</span>
    </div>
  );
}

// Repère de localisation en 3D qui tourne sur lui-même (CSS 3D : couches
// empilées en profondeur pour l'épaisseur), avec ondes au sol.
function GeoIllustration({ dark }) {
  const PIN = 'M24 2C13.5 2 5 10.3 5 20.6 5 34 24 54 24 54s19-20 19-33.4C43 10.3 34.5 2 24 2Zm0 11.2a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8Z';
  const layers = [];
  for (let z = -5; z <= 5; z++) layers.push(z);
  return (
    <div className="relative w-full h-full overflow-hidden grid place-items-center"
      style={{ background: dark ? 'radial-gradient(120% 90% at 50% 70%, #10213f 0%, #121212 70%)' : 'radial-gradient(120% 90% at 50% 70%, #dbeafe 0%, #f8fafc 70%)' }}>
      {/* Sol : ondes qui s'élargissent sous le repère */}
      <div className="absolute left-1/2 top-[74%] -translate-x-1/2 -translate-y-1/2" style={{ perspective: 400 }}>
        <div style={{ transform: 'rotateX(72deg)', transformStyle: 'preserve-3d', width: 160, height: 160, position: 'relative' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="geo3d-ring absolute inset-0 rounded-full"
              style={{ border: '2px solid #3b82f6', animationDelay: `${i * 1.4}s` }}></span>
          ))}
          <span className="geo3d-shadow absolute rounded-full" style={{ left: 58, top: 58, width: 44, height: 44, background: 'radial-gradient(circle, rgba(0,0,0,0.55), transparent 70%)' }}></span>
        </div>
      </div>
      {/* Repère 3D */}
      <div className="geo3d-float relative" style={{ perspective: 500, width: 52, height: 60, marginTop: -4 }}>
        <div className="geo3d-spin absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          {layers.map((z) => {
            const face = Math.abs(z) === 5;
            return (
              <svg key={z} viewBox="0 0 48 56" width="52" height="60" className="absolute inset-0"
                style={{ transform: `translateZ(${z * 0.95}px)`, backfaceVisibility: 'visible' }}>
                {face && (
                  <defs>
                    <linearGradient id={`geo3d-g${z}`} x1="0.2" y1="0" x2="0.8" y2="1">
                      <stop offset="0" stopColor="#93c5fd" />
                      <stop offset="0.45" stopColor="#3b82f6" />
                      <stop offset="1" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                )}
                <path d={PIN} fillRule="evenodd" fill={face ? `url(#geo3d-g${z})` : '#1e40af'} />
              </svg>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.MapView = MapView;

// ------------------------------------------------------------------------
// Right-side map controls — zoom + locate + cartes (style picker) + settings.
// Cartes and settings each open a popover anchored to the button.
// Selection color stays blue (Tailwind blue) per design system.
// ------------------------------------------------------------------------
function MapControls({ dark, accent, zoomIn, zoomOut, creating, userLocation, onRequestLocation, onCenterUserLocation, mapRef }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(null); // 'cartes' | 'settings' | null
  // First-visit onboarding hint pointing at the locate button.
  const [showLocateHint, setShowLocateHint] = useState(() => {
    try { return !localStorage.getItem('gr_onboard_geo'); } catch (e) { return true; }
  });
  const dismissLocateHint = () => {
    setShowLocateHint(false);
    try { localStorage.setItem('gr_onboard_geo', '1'); } catch (e) {}
  };
  // Replaced by the global 2-step guided tour (see App). Keep disabled here.
  const locateHintVisible = false;
  const [mapStyle, setMapStyle] = useState(savedMapStyle); // cf. BASE_LAYERS
  const [mapOpacity, setMapOpacity] = useState(savedMapOpacity); // 0..100 (pas de 10)
  const [mapBg, setMapBg] = useState(savedMapBg);
  useEffect(() => {
    applyMapBg(mapRef && mapRef.current, mapBg);
    try { localStorage.setItem(MAP_BG_KEY, mapBg); } catch (e) {}
  }, [mapBg]);
  useEffect(() => {
    applyMapOpacity(mapRef && mapRef.current, mapOpacity);
    try { localStorage.setItem(MAP_OPACITY_KEY, String(mapOpacity)); } catch (e) {}
  }, [mapOpacity]);
  const [trailsOn, setTrailsOn] = useState(savedTrailsOverlay);
  useEffect(() => {
    const map = mapRef && mapRef.current;
    if (!map || !!map.__trails === trailsOn) return;
    applyTrailsOverlay(map, trailsOn);
    try { localStorage.setItem(TRAILS_KEY, trailsOn ? '1' : '0'); } catch (e) {}
  }, [trailsOn]);
  const [forecastDay, setForecastDay] = useState(0); // -2 .. +5 days
  const [enrichment, setEnrichment] = useState({ poi: false, hillshade: false });
  const [overlayTab, setOverlayTab] = useState('weather'); // weather | surface | snow
  const [overlay, setOverlay] = useState(null); // active overlay key or null
  const [theme, setTheme] = useState('auto');
  const [units, setUnits] = useState('km');
  const wrapRef = useRef(null);

  // Applique le fond choisi et le mémorise
  useEffect(() => {
    const map = mapRef && mapRef.current;
    if (!map || map.__baseLayerKey === mapStyle) return;
    applyBaseLayer(map, mapStyle);
    try { localStorage.setItem(MAP_STYLE_KEY, mapStyle); } catch (e) {}
  }, [mapStyle]);
  // Ombrage du relief
  useEffect(() => {
    const apply = () => applyHillshade(mapRef && mapRef.current, enrichment.hillshade);
    if (mapRef && mapRef.current) apply(); else { const t = setTimeout(apply, 300); return () => clearTimeout(t); }
  }, [enrichment.hillshade]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Track map bearing for the compass rotation. Leaflet doesn't rotate the
  // map natively, but if `map.getBearing` exists (e.g. via a plugin), we read
  // it; otherwise the compass stays at 0. We also listen to a `rotate` event
  // for plugins that emit it.
  const [bearing, setBearing] = useState(0);
  useEffect(() => {
    const map = mapRef && mapRef.current;
    if (!map) return;
    const read = () => {
      try {
        const b = (typeof map.getBearing === 'function' && map.getBearing()) || 0;
        setBearing(b);
      } catch (e) {}
    };
    read();
    map.on('rotate', read);
    map.on('moveend', read);
    return () => { try { map.off('rotate', read); map.off('moveend', read); } catch (e) {} };
  }, []);

  const cardCls = 'rounded-md overflow-hidden glass glass-nav'; // même opacité que la navigation

  return (
    <div ref={wrapRef} className={`absolute flex flex-col gap-2 z-[600] ${isMobile ? 'right-3' : 'left-4 top-4'}`}
      style={isMobile ? { top: 'calc(env(safe-area-inset-top, 0px) + 68px)' } : undefined}>
      {/* Zoom stack */}
      <div className={`flex flex-col ${cardCls}`}>
        <MapBtn dark={dark} title="Zoomer" onClick={zoomIn}><I.ZoomIn size={16} /></MapBtn>
        <div className={`h-px ${dark ? 'bg-neutral-700/50' : 'bg-neutral-200'}`} />
        <MapBtn dark={dark} title="Dézoomer" onClick={zoomOut}><I.ZoomOut size={16} /></MapBtn>
      </div>

      {/* Cartes + Settings combined stack */}
      <div className="relative">
        <div className={`flex flex-col ${cardCls}`}>
          <Tooltip dark={dark} label="Cartes" sub="Choisir le fond de carte" side="right">
            <MapBtn
              dark={dark}
              active={open === 'cartes'}
              onClick={() => setOpen(open === 'cartes' ? null : 'cartes')}
            ><I.Stack size={15} /></MapBtn>
          </Tooltip>
          <div className={`h-px ${dark ? 'bg-neutral-700/50' : 'bg-neutral-200'}`} />
          <Tooltip dark={dark} label="Préférences carte" sub="Apparence, unités, options" side="right">
            <MapBtn
              dark={dark}
              active={open === 'settings'}
              onClick={() => setOpen(open === 'settings' ? null : 'settings')}
            ><I.Cog size={15} /></MapBtn>
          </Tooltip>
        </div>
        {open === 'cartes' && (
          <CartesPopover
            dark={dark}
            mapStyle={mapStyle}
            setMapStyle={setMapStyle}
            mapOpacity={mapOpacity}
            setMapOpacity={setMapOpacity}
            trailsOn={trailsOn}
            setTrailsOn={setTrailsOn}
            mapBg={mapBg}
            setMapBg={setMapBg}
            forecastDay={forecastDay}
            setForecastDay={setForecastDay}
            enrichment={enrichment}
            setEnrichment={setEnrichment}
            overlayTab={overlayTab}
            setOverlayTab={setOverlayTab}
            overlay={overlay}
            setOverlay={setOverlay}
          />
        )}
        {open === 'settings' && (
          <SettingsPopover
            dark={dark}
            theme={theme} setTheme={setTheme}
            units={units} setUnits={setUnits}
          />
        )}
      </div>

      {/* Locate — moved to the bottom of the stack */}
      <div className={`relative ${cardCls}`}>
        {/* Onboarding coachmark — points at the locate button on first visit */}
        {locateHintVisible && (
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 flex items-center gap-2 z-[60]" style={{ pointerEvents: 'none' }}>
            <div
              className="rounded-lg px-3 py-2 shadow-xl whitespace-nowrap"
              style={{ background: '#3b82f6', color: '#fff', pointerEvents: 'auto' }}
            >
              <div className="flex items-center gap-2">
                <div>
                  <div className="text-[12px] font-semibold leading-tight">Activez votre position</div>
                  <div className="text-[10.5px] leading-tight" style={{ color: 'rgba(255,255,255,0.8)' }}>Pour démarrer un itinéraire près de vous</div>
                </div>
                <button
                  onClick={dismissLocateHint}
                  className="ml-1 -mr-1 p-0.5 rounded hover:bg-white/20 transition-colors"
                  aria-label="Ignorer"
                >
                  <I.X size={13} stroke="white" strokeWidth="2.4" />
                </button>
              </div>
            </div>
            {/* Bouncing arrow pointing right toward the button */}
            <span style={{ animation: 'onboardNudge 1.1s ease-in-out infinite', color: '#3b82f6' }}>
              <I.ChevronRight size={22} strokeWidth="3" />
            </span>
          </div>
        )}
        <Tooltip
          dark={dark}
          label={userLocation ? 'Recentrer sur ma position' : 'Localisation désactivée'}
          sub={userLocation ? 'Cliquez pour revenir à votre position' : 'Cliquez pour activer'}
          side="right"
        >
          <button
            onClick={() => {
              dismissLocateHint();
              if (userLocation && onCenterUserLocation) onCenterUserLocation();
              else if (!userLocation && onRequestLocation) onRequestLocation();
            }}
            data-onboard="locate"
            aria-pressed={!!userLocation}
            aria-label={userLocation ? 'Centrer sur ma position' : 'Activer la localisation'}
            className={`relative w-9 h-9 grid place-items-center transition-colors ${dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50'} ${locateHintVisible ? 'onboard-ring' : ''}`}
          >
            <I.LocateArrow
              size={15}
              style={{ color: userLocation ? '#3b82f6' : (dark ? '#a3a3a3' : '#737373') }}
            />
            <span
              className="absolute top-1 right-1 block w-1 h-1 rounded-full"
              style={{
                background: userLocation ? '#10b981' : (dark ? '#525252' : '#d4d4d4'),
                boxShadow: userLocation ? '0 0 0 1.5px ' + (dark ? '#171717' : '#ffffff') : 'none',
              }}
            ></span>
          </button>
        </Tooltip>
      </div>

      {/* Compass — rotates with the map bearing */}
      <Tooltip
        dark={dark}
        label="Boussole"
        sub={bearing ? `Orienté ${Math.round(bearing)}° — cliquez pour remettre au nord` : 'Le haut indique le nord'}
        side="right"
      >
        <button
          onClick={() => {
            const map = mapRef && mapRef.current;
            if (map && typeof map.setBearing === 'function') {
              try { map.setBearing(0); } catch (e) {}
              setBearing(0);
            }
          }}
          aria-label="Boussole"
          className="w-9 h-9 rounded-full overflow-hidden grid place-items-center shadow-lg transition-transform hover:scale-105"
        >
          <img
            src={(window.__resources && window.__resources.boussole) || "assets/boussole.svg"}
            alt="Boussole"
            width="36"
            height="36"
            draggable="false"
            style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform .25s ease-out', display: 'block', width: '100%', height: '100%' }}
          />
        </button>
      </Tooltip>
    </div>
  );
}

// --- Popover shell ------------------------------------------------------
function PopoverShell({ dark, children, width = 340 }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    // Mobile : feuille en bas d'écran, défilable
    return (
      <div className={`fixed left-2 right-2 z-[1250] rounded-xl animate-menu glass-strong overflow-y-auto sb-scroll ${dark ? 'text-neutral-100' : 'text-neutral-900'}`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', maxHeight: '78vh' }}>
        <div className="flex justify-center pt-2"><span className={`w-10 h-1 rounded-full ${dark ? 'bg-white/20' : 'bg-black/15'}`}></span></div>
        {children}
      </div>
    );
  }
  return (
    <div
      className={`absolute left-[44px] top-0 rounded-md animate-menu glass-strong ${dark ? 'text-neutral-100' : 'text-neutral-900'}`}
      style={{ width }}
    >
      {children}
    </div>
  );
}

function PopHeader({ dark, title }) {
  return (
    <div className={`px-4 pt-3.5 pb-2`}>
      <div className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>{title}</div>
    </div>
  );
}

function PopSection({ dark, label, children }) {
  return (
    <div className="px-4 pb-3">
      <div className={`text-[10.5px] font-semibold uppercase tracking-wider mb-2 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{label}</div>
      {children}
    </div>
  );
}

// Card with a stylized preview + label, blue ring when selected
function StyleCard({ dark, label, selected, onClick, preview }) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-md overflow-hidden border transition-all text-left ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : (dark ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-200 hover:border-neutral-300')}`}
    >
      <div className="aspect-[5/3] relative overflow-hidden">{preview}</div>
      <div className={`px-2 py-1.5 text-[11.5px] font-medium ${selected ? 'text-blue-600' : (dark ? 'text-neutral-200' : 'text-neutral-800')}`}>{label}</div>
    </button>
  );
}

// Stylized preview SVGs (no external image deps)
function PreviewPlan({ dark }) {
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full h-full">
      <rect width="100" height="60" fill={dark ? '#1f1f1f' : '#f5f5f1'} />
      <path d="M0 32 L 35 22 L 70 28 L 100 18" stroke={dark ? '#3f3f3f' : '#dcd9cf'} strokeWidth="6" fill="none" />
      <path d="M0 46 L 100 36" stroke={dark ? '#525252' : '#e7e3d3'} strokeWidth="4" fill="none" />
      <path d="M20 0 L 28 60" stroke={dark ? '#3f3f3f' : '#dcd9cf'} strokeWidth="3" fill="none" />
      <path d="M68 0 L 60 60" stroke={dark ? '#3f3f3f' : '#dcd9cf'} strokeWidth="3" fill="none" />
      <path d="M0 50 Q 30 44 50 50 T 100 48 L 100 60 L 0 60 Z" fill={dark ? '#1a2a36' : '#cfe4ec'} />
    </svg>
  );
}
function PreviewSat({ dark }) {
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <radialGradient id="sat-g" cx="40%" cy="40%" r="80%">
          <stop offset="0" stopColor="#3a5a45" />
          <stop offset="0.5" stopColor="#2c4233" />
          <stop offset="1" stopColor="#1a2920" />
        </radialGradient>
      </defs>
      <rect width="100" height="60" fill="url(#sat-g)" />
      <path d="M0 40 Q 30 30 60 38 T 100 34" stroke="#6b7d4d" strokeWidth="3" opacity="0.7" fill="none" />
      <circle cx="25" cy="20" r="6" fill="#4d6839" opacity="0.6" />
      <circle cx="70" cy="42" r="9" fill="#4d6839" opacity="0.55" />
      <path d="M0 52 Q 40 48 80 52 L 100 50 L 100 60 L 0 60 Z" fill="#2a4054" opacity="0.85" />
    </svg>
  );
}
function PreviewTopo({ dark }) {
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full h-full">
      <rect width="100" height="60" fill={dark ? '#1c1a16' : '#f3eee2'} />
      <g stroke={dark ? '#5a4f37' : '#b39c70'} strokeWidth="0.6" fill="none" opacity="0.8">
        <path d="M-5 35 Q 25 25 50 32 T 105 28" />
        <path d="M-5 42 Q 25 32 55 38 T 105 36" />
        <path d="M-5 28 Q 25 18 50 24 T 105 20" />
        <path d="M-5 50 Q 30 40 60 46 T 105 44" />
        <path d="M-5 20 Q 25 12 55 16 T 105 12" />
      </g>
      <path d="M0 56 L 100 50" stroke={dark ? '#7a5a32' : '#c79a4a'} strokeWidth="1.5" />
    </svg>
  );
}

function CartesPopover({ dark, mapStyle, setMapStyle, mapOpacity, setMapOpacity, trailsOn, setTrailsOn, mapBg, setMapBg, forecastDay, setForecastDay, enrichment, setEnrichment, overlayTab, setOverlayTab, overlay, setOverlay }) {
  // Resolve a maps/*.png to its inlined blob URL in the standalone build.
  const M = (name) => (window.__resources && window.__resources['map_' + name]) || ('assets/maps/' + name + '.png');
  // Vignette = vraie tuile (zoom 12, autour de Quimper) pour les fonds sans image dédiée
  const TILE_THUMB = (key) => BASE_LAYERS[key].thumb || BASE_LAYERS[key].url
    .replace('{s}', 'a').replace('{r}', '@2x').replace('{z}', '12').replace('{x}', '2001').replace('{y}', '1423');

  return (
    <PopoverShell dark={dark} width={360}>
      <PopHeader dark={dark} title="Cartes" />

      {/* Terrains */}
      <PopSection dark={dark} label="Fond de carte">
        <div className="grid grid-cols-3 gap-2">
          <TerrainCard dark={dark} label="Plan" selected={mapStyle === 'plan'} onClick={() => setMapStyle('plan')} img={TILE_THUMB('plan')} />
          <TerrainCard dark={dark} label="Topo" selected={mapStyle === 'topo'} onClick={() => setMapStyle('topo')} img={M('topo')} />
          <TerrainCard dark={dark} label="IGN" selected={mapStyle === 'ign'} onClick={() => setMapStyle('ign')} img={TILE_THUMB('ign')} />
          <TerrainCard dark={dark} label="Routière" selected={mapStyle === 'routiere'} onClick={() => setMapStyle('routiere')} img={TILE_THUMB('routiere')} fallback={BASE_LAYERS.routiere.thumbFallback} />
          <TerrainCard dark={dark} label="Relief" selected={mapStyle === 'relief'} onClick={() => setMapStyle('relief')} img={TILE_THUMB('relief')} />
          <TerrainCard dark={dark} label="Photos IGN" selected={mapStyle === 'ortho'} onClick={() => setMapStyle('ortho')} img={TILE_THUMB('ortho')} />
          <TerrainCard dark={dark} label="Satellite" selected={mapStyle === 'satellite'} onClick={() => setMapStyle('satellite')} img={M('satellite')} />
          <TerrainCard dark={dark} label="Sombre" selected={mapStyle === 'sombre'} onClick={() => setMapStyle('sombre')} img={TILE_THUMB('sombre')} />
          <TerrainCard dark={dark} label="Hiver" selected={mapStyle === 'winter'} onClick={() => setMapStyle('winter')} img={M('winter')} />
        </div>
      </PopSection>

      {/* Surcouche sentiers balisés */}
      <PopSection dark={dark} label="Randonnée">
        <button onClick={() => setTrailsOn(!trailsOn)} aria-pressed={trailsOn}
          className={`w-full flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${trailsOn ? 'border-blue-500 ring-2 ring-blue-500/30' : (dark ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-200 hover:border-neutral-300')}`}>
          <span className="w-12 h-9 shrink-0 rounded-md overflow-hidden grid place-items-center" style={{ background: dark ? '#262626' : '#f5f5f5' }}>
            <svg viewBox="0 0 48 36" className="w-full h-full">
              <path d="M2 28 C 12 22, 16 30, 26 20 S 40 10, 46 6" stroke="#dc2626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M4 8 C 14 14, 22 10, 30 18 S 40 30, 46 32" stroke="#f59e0b" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeDasharray="3 2" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block text-[12.5px] font-medium ${trailsOn ? 'text-blue-500' : (dark ? 'text-neutral-200' : 'text-neutral-800')}`}>Sentiers balisés</span>
            <span className={`block text-[11px] leading-snug ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>GR, GRP, PR et itinéraires locaux, sur tous les fonds</span>
          </span>
          <span className="shrink-0 relative rounded-full transition-colors" style={{ width: 28, height: 16, background: trailsOn ? '#3b82f6' : (dark ? '#404040' : '#d4d4d4') }}>
            <span className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all" style={{ left: trailsOn ? 14 : 2 }}></span>
          </span>
        </button>
      </PopSection>

      {/* Opacité du fond de carte (même UI que l'ancien curseur historique / prévisions) */}
      <PopSection dark={dark} label="Opacité de la carte">
        <OpacitySlider dark={dark} value={mapOpacity} onChange={setMapOpacity} />
      </PopSection>

      {/* Couleur de l'arrière-plan sous la carte */}
      <PopSection dark={dark} label="Couleur de l'arrière-plan">
        <MapBgColorField dark={dark} value={mapBg} onChange={setMapBg} />
      </PopSection>
    </PopoverShell>
  );
}

function TerrainCard({ dark, label, selected, onClick, img, preview, fallback }) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-lg overflow-hidden border transition-all text-left ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : (dark ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-200 hover:border-neutral-300')}`}
    >
      <div className="aspect-[5/3] relative bg-neutral-200">
        {img ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" draggable="false"
          onError={fallback ? (e) => { if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; } : undefined} /> : preview}
      </div>
      <div className={`px-2 py-1.5 text-[12px] font-medium leading-tight ${selected ? 'text-blue-600' : (dark ? 'text-neutral-200' : 'text-neutral-800')}`}>{label}</div>
    </button>
  );
}

function EnrichCard({ dark, label, on, onClick, img, preview }) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-lg overflow-hidden border transition-all text-left ${on ? 'border-blue-500 ring-2 ring-blue-500/30' : (dark ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-200 hover:border-neutral-300')}`}
    >
      <div className="aspect-[2/1] relative bg-neutral-200">
        {img ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" draggable="false" /> : preview}
        {on && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full grid place-items-center" style={{ background: '#3b82f6' }}>
            <I.Check size={10} stroke="white" strokeWidth="3" />
          </span>
        )}
      </div>
      <div className={`px-1.5 py-1 text-[10.5px] font-medium leading-tight ${on ? 'text-blue-600' : (dark ? 'text-neutral-200' : 'text-neutral-800')}`}>{label}</div>
    </button>
  );
}

function OverlayCard({ dark, label, img, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-lg overflow-hidden border transition-all text-left ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : (dark ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-200 hover:border-neutral-300')}`}
    >
      <div className="aspect-[5/3] relative bg-neutral-200">
        <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" draggable="false" />
        {selected && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full grid place-items-center" style={{ background: '#3b82f6' }}>
            <I.Check size={10} stroke="white" strokeWidth="3" />
          </span>
        )}
      </div>
      <div className={`px-2 py-1.5 text-[11.5px] font-medium leading-tight ${selected ? 'text-blue-600' : (dark ? 'text-neutral-200' : 'text-neutral-800')}`}>{label}</div>
    </button>
  );
}

function PreviewPoiEnrich({ dark }) {
  return (
    <div className="w-full h-full relative" style={{ background: dark ? 'linear-gradient(135deg,#1f2e24,#16241c)' : 'linear-gradient(135deg,#dcefe0,#c2e6cf)' }}>
      <span className="absolute" style={{ left: '22%', top: '34%' }}><I.MarkerPin size={11} style={{ color: '#3b82f6' }} /></span>
      <span className="absolute" style={{ left: '54%', top: '52%' }}><I.MarkerPin size={11} style={{ color: '#f43f5e' }} /></span>
      <span className="absolute" style={{ left: '72%', top: '28%' }}><I.MarkerPin size={11} style={{ color: '#f59e0b' }} /></span>
    </div>
  );
}

// Polished day slider for history / forecast (-2 .. +5). Bigger value pill,
// tick marks, and an accent-filled track up to the thumb.
function ForecastSlider({ dark, value, onChange }) {
  const MIN = -4, MAX = 4;
  const steps = MAX - MIN; // 8 intervals → 9 snap points
  const pct = ((value - MIN) / steps) * 100;
  const dayLabel = (d) => d === 0 ? "Maintenant" : (d < 0 ? `Il y a ${-d} j` : `Dans ${d} j`);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <span className={`text-[15px] font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>{dayLabel(value)}</span>
        <span className={`text-[11px] tabular-nums ${value === 0 ? 'text-blue-500 font-medium' : (dark ? 'text-neutral-500' : 'text-neutral-400')}`}>
          {value === 0 ? 'Temps réel' : (value < 0 ? 'Historique' : 'Prévision')}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        {/* track */}
        <div className={`absolute left-0 right-0 h-1.5 rounded-full ${dark ? 'bg-neutral-800' : 'bg-neutral-200'}`}></div>
        {/* filled (from center to thumb) */}
        <div
          className="absolute h-1.5 rounded-full"
          style={{
            background: '#3b82f6',
            left: value >= 0 ? '50%' : `${pct}%`,
            right: value >= 0 ? `${100 - pct}%` : '50%',
          }}
        ></div>
        {/* snap ticks (9 points) */}
        <div className="absolute left-0 right-0 flex justify-between px-[1px] pointer-events-none">
          {Array.from({ length: steps + 1 }).map((_, i) => {
            const d = MIN + i;
            const isNow = d === 0;
            const reached = (value >= 0 && d >= 0 && d <= value) || (value < 0 && d <= 0 && d >= value);
            return (
              <span
                key={i}
                className="rounded-full"
                style={{
                  width: isNow ? 4 : 3, height: isNow ? 4 : 3,
                  background: isNow ? (dark ? '#e5e5e5' : '#525252') : (reached ? '#3b82f6' : (dark ? '#525252' : '#d4d4d4')),
                }}
              ></span>
            );
          })}
        </div>
        <input
          type="range" min={MIN} max={MAX} step="1" value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="cartes-range absolute left-0 right-0 w-full appearance-none bg-transparent cursor-pointer"
          style={{ accentColor: '#3b82f6' }}
        />
      </div>
      <div className={`flex justify-between mt-1.5 text-[10px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>
        <span>-4 j</span><span>Maintenant</span><span>+4 j</span>
      </div>
    </div>
  );
}

// Conversions couleur pour le sélecteur maison (HSV <-> hex)
function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h, s, v }) {
  const f = (k) => { const x = (k + h / 60) % 6; return v - v * s * Math.max(0, Math.min(x, 4 - x, 1)); };
  return '#' + [f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}
const MAP_BG_PRESETS = ['#171717', '#0a0a0a', '#262626', '#1c1917', '#0f172a', '#101838', '#0c1f17', '#2a1215', '#f5f5f4', '#e0f2fe'];

// Sélecteur de couleur aux couleurs de l'app (le sélecteur natif du
// navigateur ne se thématise pas) : saturation/luminosité, teinte,
// pipette (si le navigateur la propose), couleurs rapides.
function MapColorPicker({ dark, value, onChange, onClose, inline }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const ref = useRef(null);
  useEffect(() => { if (hsvToHex(hsv) !== value) setHsv(hexToHsv(value)); }, [value]);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('[data-color-swatch]')) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);
  const update = (next) => { setHsv(next); onChange(hsvToHex(next)); };
  const drag = (e, el, fn) => {
    e.preventDefault();
    const move = (ev) => { const r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))); };
    move(e);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const svRef = useRef(null), hueRef = useRef(null);
  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const canPick = typeof window !== 'undefined' && 'EyeDropper' in window;
  return (
    <div ref={ref} className={inline ? 'mt-3' : `absolute left-full bottom-0 ml-6 z-50 w-[232px] p-3 rounded-md shadow-2xl animate-menu glass-strong ${dark ? 'text-neutral-100' : 'text-neutral-900'}`}>
      <div ref={svRef} onPointerDown={(e) => drag(e, svRef.current, (x, y) => update({ ...hsv, s: x, v: 1 - y }))}
        className="relative h-[140px] rounded-md cursor-crosshair touch-none"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})` }}>
        <span className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }}></span>
      </div>
      <div className="flex items-center gap-2.5 mt-3">
        {canPick && (
          <button title="Pipette" onClick={async () => { try { const r = await new window.EyeDropper().open(); const h = normalizeHex(r.sRGBHex); if (h) onChange(h); } catch (e) {} }}
            className={`w-7 h-7 shrink-0 grid place-items-center rounded-md transition-colors ${dark ? 'text-neutral-300 hover:bg-neutral-800' : 'text-neutral-600 hover:bg-neutral-100'}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
          </button>
        )}
        <div ref={hueRef} onPointerDown={(e) => drag(e, hueRef.current, (x) => update({ ...hsv, h: x * 359.9 }))}
          className="relative flex-1 h-2.5 rounded-full cursor-pointer touch-none"
          style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
          <span className="absolute top-1/2 w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 border-white shadow pointer-events-none"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: hueHex }}></span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5 mt-3">
        {MAP_BG_PRESETS.map((c) => (
          <button key={c} title={c.toUpperCase()} onClick={() => onChange(c)}
            className={`h-6 rounded-md border transition-transform hover:scale-105 ${value === c ? 'ring-2 ring-blue-500' : ''} ${dark ? 'border-white/10' : 'border-black/10'}`}
            style={{ background: c }}></button>
        ))}
      </div>
    </div>
  );
}

// Champ hexadécimal + pastille ouvrant le sélecteur de couleur
function MapBgColorField({ dark, value, onChange }) {
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(false);
  const text = draft != null ? draft : value.toUpperCase();
  const valid = normalizeHex(text);
  const commit = () => { if (valid) onChange(valid); setDraft(null); };
  const inline = isMobileNow(); // mobile : sélecteur déplié sous le champ
  return (
    <div>
    <div className="relative flex items-center gap-2">
      <button data-color-swatch title="Choisir une couleur" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`w-9 h-9 shrink-0 rounded-md border transition-shadow ${open ? 'ring-2 ring-blue-500/60' : ''} ${dark ? 'border-neutral-700' : 'border-neutral-300'}`}
        style={{ background: valid || value }}></button>
      {open && !inline && <MapColorPicker dark={dark} value={value} onChange={(c) => { setDraft(null); onChange(c); }} onClose={() => setOpen(false)} />}
      <input value={text} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); } }}
        aria-label="Couleur hexadécimale" spellCheck="false" maxLength={7}
        className={`flex-1 min-w-0 h-9 rounded-md border px-2.5 font-mono text-[13px] uppercase outline-none transition-colors ${!valid ? 'border-rose-400' : (dark ? 'border-neutral-800 bg-neutral-900/60 text-neutral-100 focus:border-neutral-600' : 'border-neutral-200 bg-white text-neutral-900 focus:border-neutral-400')}`} />
      <button onClick={() => { setDraft(null); onChange(MAP_BG_DEFAULT); }} disabled={value === MAP_BG_DEFAULT}
        className={`h-9 px-2.5 rounded-md text-[12px] font-medium transition-colors ${value === MAP_BG_DEFAULT ? (dark ? 'text-neutral-600' : 'text-neutral-400') : (dark ? 'text-neutral-300 hover:bg-neutral-800' : 'text-neutral-700 hover:bg-neutral-100')}`}>
        Défaut
      </button>
    </div>
    {open && inline && <MapColorPicker inline dark={dark} value={value} onChange={(c) => { setDraft(null); onChange(c); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

function OpacitySlider({ dark, value, onChange }) {
  const MIN = 0, MAX = 100, STEP = 10;
  const steps = (MAX - MIN) / STEP; // 10 intervalles -> 11 crans
  const pct = ((value - MIN) / (MAX - MIN)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <span className={`text-[15px] font-semibold tabular-nums ${dark ? 'text-white' : 'text-neutral-900'}`}>{value} %</span>
        <span className={`text-[11px] ${value === 100 ? 'text-blue-500 font-medium' : (dark ? 'text-neutral-500' : 'text-neutral-400')}`}>
          {value === 100 ? 'Carte pleine' : value === 0 ? 'Tracés seuls' : 'Tracés mis en avant'}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className={`absolute left-0 right-0 h-1.5 rounded-full ${dark ? 'bg-neutral-800' : 'bg-neutral-200'}`}></div>
        <div className="absolute left-0 h-1.5 rounded-full" style={{ background: '#3b82f6', width: `${pct}%` }}></div>
        <div className="absolute left-0 right-0 flex justify-between px-[1px] pointer-events-none">
          {Array.from({ length: steps + 1 }).map((_, i) => {
            const v = MIN + i * STEP;
            const isEnd = v === MAX;
            return (
              <span key={i} className="rounded-full"
                style={{ width: isEnd ? 4 : 3, height: isEnd ? 4 : 3, background: v <= value ? '#3b82f6' : (dark ? '#525252' : '#d4d4d4') }}></span>
            );
          })}
        </div>
        <input
          type="range" min={MIN} max={MAX} step={STEP} value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          aria-label="Opacité de la carte"
          className="cartes-range absolute left-0 right-0 w-full appearance-none bg-transparent cursor-pointer"
          style={{ accentColor: '#3b82f6' }}
        />
      </div>
      <div className={`flex justify-between mt-1.5 text-[10px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>
        <span>0 %</span><span>50 %</span><span>100 %</span>
      </div>
    </div>
  );
}

function SettingsPopover({ dark, theme, setTheme, units, setUnits }) {
  const [tempUnit, setTempUnit] = useState('c');
  const [slopeUnit, setSlopeUnit] = useState('deg');
  const [lang, setLang] = useState('fr');
  const [showEndpoints, setShowEndpoints] = useState(savedShowEndpoints);
  return (
    <PopoverShell dark={dark} width={320}>
      <PopHeader dark={dark} title="Préférences carte" />
      <PopSection dark={dark} label="Unité de distance">
        <div className="grid grid-cols-2 gap-2">
          <UnitCard dark={dark} title="Km · m" sub="Métrique" selected={units === 'km'} onClick={() => setUnits('km')} />
          <UnitCard dark={dark} title="Mi · ft" sub="Impérial" selected={units === 'mi'} onClick={() => setUnits('mi')} />
        </div>
      </PopSection>
      <PopSection dark={dark} label="Unité de température">
        <div className="grid grid-cols-2 gap-2">
          <UnitCard dark={dark} title="°C" sub="Celsius" selected={tempUnit === 'c'} onClick={() => setTempUnit('c')} />
          <UnitCard dark={dark} title="°F" sub="Fahrenheit" selected={tempUnit === 'f'} onClick={() => setTempUnit('f')} />
        </div>
      </PopSection>
      <PopSection dark={dark} label="Unité de pente">
        <div className="grid grid-cols-2 gap-2">
          <UnitCard dark={dark} title="Degrés" sub="°" selected={slopeUnit === 'deg'} onClick={() => setSlopeUnit('deg')} />
          <UnitCard dark={dark} title="Pourcentage" sub="%" selected={slopeUnit === 'pct'} onClick={() => setSlopeUnit('pct')} />
        </div>
      </PopSection>
      <PopSection dark={dark} label="Tracés">
        <ToggleRow dark={dark} label="Afficher le départ et l'arrivée" checked={showEndpoints}
          onToggle={() => {
            const next = !showEndpoints;
            setShowEndpoints(next);
            try { localStorage.setItem(ENDPOINTS_KEY, next ? '1' : '0'); } catch (e) {}
            window.dispatchEvent(new CustomEvent('gr-show-endpoints', { detail: next }));
          }} />
      </PopSection>
      <PopSection dark={dark} label="Langue de la carte">
        <MapLangDropdown dark={dark} value={lang} onChange={setLang} />
      </PopSection>
    </PopoverShell>
  );
}

const MAP_LANG_OPTIONS = [
  { value: 'fr', label: 'Français',  flag: '🇫🇷' },
  { value: 'en', label: 'English',   flag: '🇬🇧' },
  { value: 'es', label: 'Español',   flag: '🇪🇸' },
  { value: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { value: 'it', label: 'Italiano',  flag: '🇮🇹' },
  { value: 'pt', label: 'Português', flag: '🇵🇹' },
];

function MapLangDropdown({ dark, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const cur = MAP_LANG_OPTIONS.find((o) => o.value === value) || MAP_LANG_OPTIONS[0];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700' : 'bg-white border-neutral-200 text-neutral-800 hover:border-neutral-300'}`}
      >
        <span className="text-[15px] leading-none">{cur.flag}</span>
        <span className="flex-1 text-left">{cur.label}</span>
        <I.ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''} ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-1 z-30 rounded-lg shadow-2xl overflow-hidden animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
        >
          {MAP_LANG_OPTIONS.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value}
                role="option"
                aria-selected={sel}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${sel ? (dark ? 'bg-neutral-800/80' : 'bg-neutral-50') : (dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50')}`}
              >
                <span className="text-[15px] leading-none">{o.flag}</span>
                <span className={`flex-1 ${sel ? 'font-medium' : ''} ${dark ? 'text-neutral-100' : 'text-neutral-800'}`}>{o.label}</span>
                {sel && <I.Check size={13} style={{ color: '#3b82f6' }} strokeWidth="2.6" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnitCard({ dark, title, sub, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-9 rounded-md border px-2.5 flex items-baseline gap-1.5 text-left transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : (dark ? 'border-neutral-800 hover:border-neutral-700 hover:bg-white/5' : 'border-neutral-200 hover:border-neutral-300')}`}
      style={{ alignItems: 'center' }}
    >
      <span className={`text-[12.5px] font-semibold ${selected ? 'text-blue-500' : (dark ? 'text-white' : 'text-neutral-900')}`}>{title}</span>
      <span className={`text-[11px] truncate ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{sub}</span>
    </button>
  );
}

function ThemeCard({ dark, label, selected, onClick, variant }) {
  const preview =
    variant === 'light' ? (
      <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#fafafa,#e5e5e5)' }}>
        <div className="absolute inset-2 rounded-sm" style={{ background: '#f5f5f5', border: '1px solid #d4d4d4' }}></div>
      </div>
    ) : variant === 'dark' ? (
      <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#1f1f1f,#0a0a0a)' }}>
        <div className="absolute inset-2 rounded-sm" style={{ background: '#171717', border: '1px solid #2a2a2a' }}></div>
      </div>
    ) : (
      <div className="w-full h-full relative">
        <div className="absolute inset-0" style={{ background: '#fafafa', clipPath: 'polygon(0 0,50% 0,50% 100%,0 100%)' }}></div>
        <div className="absolute inset-0" style={{ background: '#0a0a0a', clipPath: 'polygon(50% 0,100% 0,100% 100%,50% 100%)' }}></div>
      </div>
    );
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-md overflow-hidden border transition-all text-left ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : (dark ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-200 hover:border-neutral-300')}`}
    >
      <div className="aspect-[5/3] relative">{preview}</div>
      <div className={`px-2 py-1.5 text-[11.5px] font-medium ${selected ? 'text-blue-600' : (dark ? 'text-neutral-200' : 'text-neutral-800')}`}>{label}</div>
    </button>
  );
}

function SegmentedRow({ dark, value, onChange, options }) {
  return (
    <div className={`flex p-0.5 rounded-md border ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'}`}>
      {options.map((o) => {
        const sel = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded text-[11.5px] font-medium py-1 transition-colors ${sel ? (dark ? 'bg-blue-500/20 text-blue-300' : 'bg-white text-blue-700 shadow-sm') : (dark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900')}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({ dark, label, defaultChecked, checked, onToggle }) {
  const [internal, setInternal] = useState(!!defaultChecked);
  const isControlled = typeof checked === 'boolean';
  const on = isControlled ? checked : internal;
  const toggle = () => { if (isControlled) { onToggle && onToggle(); } else { setInternal((v) => !v); } };
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-[13px] ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>{label}</span>
      <button
        onClick={toggle}
        aria-pressed={on}
        style={{
          position: 'relative',
          width: 28,
          height: 16,
          borderRadius: 999,
          background: on ? '#3b82f6' : (dark ? '#404040' : '#d4d4d4'),
          transition: 'background-color .15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
            transition: 'left .18s',
          }}
        ></span>
      </button>
    </div>
  );
}

function SingleRoutePopItem({ icon, label, onClick, dark, danger }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition-colors ${danger
        ? (dark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50')
        : (dark ? 'text-neutral-200 hover:bg-neutral-800' : 'text-neutral-800 hover:bg-neutral-50')
      }`}>
      <span className={`shrink-0 ${danger ? '' : (dark ? 'text-neutral-400' : 'text-neutral-500')}`}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

window.MapView = MapView;