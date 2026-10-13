// Parsing GPX + calcul des métriques d'une étape.
// Volontairement sans DOM : utilisé par le script de build (Node).

/** Point simplifié pour la carte : [lat, lon] */

/** Point du profil altimétrique : [distance cumulée km, altitude m, lat, lon] */

const R = 6371008.8;
export function haversine(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function decodeEntities(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
}
export function parseGpx(xml) {
  const trk = xml.match(/<trk\b[\s\S]*?<name>([\s\S]*?)<\/name>/);
  const meta = xml.match(/<metadata\b[\s\S]*?<name>([\s\S]*?)<\/name>/);
  const name = trk?.[1] ?? meta?.[1] ?? null;
  const points = [];
  // trkpt (traces) ou, à défaut, rtept (itinéraires)
  const tag = /<trkpt\b/.test(xml) ? 'trkpt' : 'rtept';
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  let m;
  while (m = re.exec(xml)) {
    const attrs = m[1];
    const body = m[2] ?? '';
    const lat = Number(attrs.match(/lat\s*=\s*["']([^"']+)/)?.[1]);
    const lon = Number(attrs.match(/lon\s*=\s*["']([^"']+)/)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleStr = body.match(/<ele>([^<]+)<\/ele>/)?.[1];
    const timeStr = body.match(/<time>([^<]+)<\/time>/)?.[1];
    const ele = eleStr != null && Number.isFinite(Number(eleStr)) ? Number(eleStr) : null;
    const t = timeStr ? Date.parse(timeStr) : NaN;
    points.push({
      lat,
      lon,
      ele,
      time: Number.isFinite(t) ? t : null
    });
  }
  return {
    name: name ? decodeEntities(name).trim() : null,
    points
  };
}

// ---------------------------------------------------------------------------
// Autres formats de trace -> { name, points }
// ---------------------------------------------------------------------------

const tagText = (body, tag) => body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`))?.[1];
const numOrNull = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const timeOrNull = (v) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };

/** TCX (Garmin Training Center) : Trackpoint / Position / AltitudeMeters / Time */
export function parseTcx(xml) {
  const name = tagText(xml, 'Name') || tagText(xml, 'Notes') || null;
  const points = [];
  const re = /<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    const lat = numOrNull(tagText(b, 'LatitudeDegrees'));
    const lon = numOrNull(tagText(b, 'LongitudeDegrees'));
    if (lat == null || lon == null) continue;
    points.push({ lat, lon, ele: numOrNull(tagText(b, 'AltitudeMeters')), time: timeOrNull(tagText(b, 'Time')) });
  }
  return { name: name ? decodeEntities(name).trim() : null, points };
}

/** KML (Google Earth) : gx:Track (when + gx:coord) ou LineString (coordinates) */
export function parseKml(xml) {
  const name = tagText(xml, 'name');
  const points = [];
  const tracks = xml.match(/<gx:Track\b[\s\S]*?<\/gx:Track>/g) || [];
  for (const tr of tracks) {
    const whens = [...tr.matchAll(/<when>([^<]+)<\/when>/g)].map((x) => timeOrNull(x[1]));
    const coords = [...tr.matchAll(/<gx:coord>([^<]+)<\/gx:coord>/g)].map((x) => x[1].trim().split(/\s+/).map(Number));
    coords.forEach((c, i) => {
      if (Number.isFinite(c[0]) && Number.isFinite(c[1])) points.push({ lat: c[1], lon: c[0], ele: Number.isFinite(c[2]) ? c[2] : null, time: whens[i] ?? null });
    });
  }
  if (!points.length) {
    const lines = xml.match(/<LineString\b[\s\S]*?<\/LineString>/g) || [];
    for (const ls of lines) {
      const txt = tagText(ls, 'coordinates') || '';
      txt.trim().split(/\s+/).forEach((t) => {
        const [lon, lat, ele] = t.split(',').map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : null, time: null });
      });
    }
  }
  return { name: name ? decodeEntities(name).trim() : null, points };
}

/** GeoJSON : (Multi)LineString, Feature(Collection) ; temps dans properties.coordTimes */
export function parseGeoJson(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text;
  const points = [];
  let name = null;
  const addLine = (coords, times) => coords.forEach((c, i) => {
    if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      points.push({ lat: c[1], lon: c[0], ele: Number.isFinite(c[2]) ? c[2] : null, time: times ? timeOrNull(times[i]) : null });
    }
  });
  const visit = (o, props) => {
    if (!o) return;
    if (o.type === 'FeatureCollection') return o.features.forEach((f) => visit(f));
    if (o.type === 'Feature') {
      const p = o.properties || {};
      if (!name && p.name) name = String(p.name);
      return visit(o.geometry, p);
    }
    const times = props && (props.coordTimes || (props.coordinateProperties && props.coordinateProperties.times));
    if (o.type === 'LineString') addLine(o.coordinates, times);
    else if (o.type === 'MultiLineString') o.coordinates.forEach((l, k) => addLine(l, times && Array.isArray(times[0]) ? times[k] : null));
    else if (o.type === 'GeometryCollection') o.geometries.forEach((g) => visit(g, props));
  };
  visit(data);
  return { name, points };
}

/** IGC (vol libre, format FAI) : enregistrements B + date HFDTE */
export function parseIgc(text) {
  const dm = text.match(/HFDTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/);
  const day0 = dm ? Date.UTC(2000 + Number(dm[3]), Number(dm[2]) - 1, Number(dm[1])) : null;
  const name = null; // l'en-tête IGC décrit le pilote / l'aile, pas le parcours : nom du fichier
  const points = [];
  let prevSec = -1, dayOffset = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])[AV](\d{5}|-\d{4})(\d{5}|-\d{4})/);
    if (!m) continue;
    let lat = Number(m[4]) + Number(m[5]) / 60000; if (m[6] === 'S') lat = -lat;
    let lon = Number(m[7]) + Number(m[8]) / 60000; if (m[9] === 'W') lon = -lon;
    const gps = Number(m[11]), baro = Number(m[10]);
    const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    if (sec < prevSec) dayOffset += 86400; // passage de minuit
    prevSec = sec;
    points.push({ lat, lon, ele: gps || baro || null, time: day0 != null ? day0 + (dayOffset + sec) * 1000 : null });
  }
  return { name, points };
}

/** FIT (Garmin, Wahoo, Coros, Suunto…) : messages « record » (position, altitude, heure) */
export function parseFit(buffer) {
  const dv = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const headerSize = dv.getUint8(0);
  const dataSize = dv.getUint32(4, true);
  const sig = String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11));
  if (sig !== '.FIT') throw new Error('fichier FIT invalide');
  const end = Math.min(dv.byteLength, headerSize + dataSize);
  const defs = {};
  const points = [];
  let name = null;
  let pos = headerSize, lastTs = null;
  const FIT_EPOCH = 631065600; // 1989-12-31T00:00:00Z
  const read = (off, size, base, le) => {
    const t = base & 0x1f;
    if (t === 7) { // chaîne
      const bytes = []; for (let i = 0; i < size; i++) { const c = dv.getUint8(off + i); if (!c) break; bytes.push(c); }
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }
    if (size === 1) return t === 1 ? dv.getInt8(off) : dv.getUint8(off);
    if (size === 2) return (t === 3 ? dv.getInt16(off, le) : dv.getUint16(off, le));
    if (size === 4) return (t === 5 ? dv.getInt32(off, le) : dv.getUint32(off, le));
    return null;
  };
  while (pos < end) {
    const h = dv.getUint8(pos++);
    let local, compressedTs = null;
    if (h & 0x80) {
      local = (h >> 5) & 0x3;
      const off = h & 0x1f;
      if (lastTs != null) { compressedTs = (lastTs & ~0x1f) + off; if (off < (lastTs & 0x1f)) compressedTs += 0x20; }
    } else if (h & 0x40) {
      local = h & 0x0f;
      const hasDev = h & 0x20;
      const le = dv.getUint8(pos + 1) === 0;
      const global = dv.getUint16(pos + 2, le);
      const n = dv.getUint8(pos + 4);
      pos += 5;
      const fields = [];
      for (let i = 0; i < n; i++) { fields.push({ num: dv.getUint8(pos), size: dv.getUint8(pos + 1), base: dv.getUint8(pos + 2) }); pos += 3; }
      let devSize = 0;
      if (hasDev) { const nd = dv.getUint8(pos++); for (let i = 0; i < nd; i++) { devSize += dv.getUint8(pos + 1); pos += 3; } }
      defs[local] = { global, le, fields, devSize };
      continue;
    } else {
      local = h & 0x0f;
    }
    const def = defs[local];
    if (!def) throw new Error('FIT : définition manquante');
    const v = {};
    for (const f of def.fields) { v[f.num] = read(pos, f.size, f.base, def.le); pos += f.size; }
    pos += def.devSize;
    if (v[253] != null && v[253] !== 0xffffffff) lastTs = v[253];
    else if (compressedTs != null) { lastTs = compressedTs; v[253] = compressedTs; }
    if (def.global === 20) { // record
      const la = v[0], lo = v[1];
      if (la == null || lo == null || la === 0x7fffffff || lo === 0x7fffffff) continue;
      let ele = null;
      if (v[78] != null && v[78] !== 0xffffffff) ele = v[78] / 5 - 500;
      else if (v[2] != null && v[2] !== 0xffff) ele = v[2] / 5 - 500;
      points.push({ lat: la * (180 / 2 ** 31), lon: lo * (180 / 2 ** 31), ele, time: v[253] != null ? (v[253] + FIT_EPOCH) * 1000 : null });
    } else if (def.global === 31 && typeof v[5] === 'string' && v[5]) { // course.name
      name = v[5];
    }
  }
  return { name, points };
}

/** Formats acceptés à l'import (extensions) */
export const TRACK_EXTENSIONS = ['gpx', 'fit', 'tcx', 'kml', 'kmz', 'geojson', 'json', 'igc'];

/** Lit un fichier de trace (hors KMZ, à décompresser avant) : renvoie { name, points } */
export function parseTrack(fileName, data) {
  const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const isFit = typeof data !== 'string' && bytes.length > 12 && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === '.FIT';
  if (ext === 'fit' || isFit) return parseFit(data);
  const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(bytes);
  if (ext === 'tcx' || /<TrainingCenterDatabase\b/.test(text)) return parseTcx(text);
  if (ext === 'kml' || /<kml\b/.test(text)) return parseKml(text);
  if (ext === 'igc' || /^A[A-Z0-9]{3}/.test(text) && /\nB\d{6}/.test(text)) return parseIgc(text);
  if (ext === 'geojson' || ext === 'json' || /^\s*[{[]/.test(text)) return parseGeoJson(text);
  return parseGpx(text);
}

/** Douglas-Peucker en mètres (projection équirectangulaire locale). */
export function simplify(points, toleranceM) {
  if (points.length < 3) return points.slice();
  const lat0 = points[0].lat * Math.PI / 180;
  const kx = Math.PI / 180 * R * Math.cos(lat0);
  const ky = Math.PI / 180 * R;
  const xs = points.map(p => p.lon * kx);
  const ys = points.map(p => p.lat * ky);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const tol2 = toleranceM * toleranceM;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const dx = xs[b] - xs[a];
    const dy = ys[b] - ys[a];
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      let t = len2 ? ((xs[i] - xs[a]) * dx + (ys[i] - ys[a]) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = xs[a] + t * dx - xs[i];
      const py = ys[a] + t * dy - ys[i];
      const d = px * px + py * py;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * D+ / D- avec hystérésis : on n'accumule une variation que lorsqu'elle
 * dépasse `threshold` mètres depuis le dernier point d'ancrage. Ça élimine
 * le bruit GPS/MNT sans écraser les vraies montées.
 */
export function elevationGainLoss(eles, threshold = 1) {
  let gain = 0;
  let loss = 0;
  if (!eles.length) return {
    gain,
    loss
  };
  let anchor = eles[0];
  for (const e of eles) {
    const d = e - anchor;
    if (d >= threshold) {
      gain += d;
      anchor = e;
    } else if (d <= -threshold) {
      loss -= d;
      anchor = e;
    }
  }
  return {
    gain,
    loss
  };
}

/** Temps en mouvement (min) : ignore les pauses (vitesse < 0.8 km/h ou trou > 5 min). */
function movingMinutes(points) {
  const timed = points.filter(p => p.time != null);
  if (timed.length < 2 || timed.length < points.length * 0.9) return null;
  let ms = 0;
  for (let i = 1; i < timed.length; i++) {
    const dt = timed[i].time - timed[i - 1].time;
    if (dt <= 0 || dt > 5 * 60_000) continue;
    const v = haversine(timed[i - 1], timed[i]) / (dt / 1000); // m/s
    if (v * 3.6 >= 0.8) ms += dt;
  }
  return ms > 0 ? ms / 60_000 : null;
}
/** Durée totale (min) entre le premier et le dernier horodatage, pauses comprises. */
function totalMinutes(points) {
  const timed = points.filter(p => p.time != null);
  if (timed.length < 2) return null;
  const ms = timed[timed.length - 1].time - timed[0].time;
  return ms > 0 ? ms / 60_000 : null;
}
function cleanTitle(raw) {
  return raw.replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/\s+/g, ' ').trim();
}

/** Extrait numéro + départ/arrivée depuis le nom GPX ou le nom de fichier. */
export function parseStageName(gpxName, file) {
  const base = file.replace(/\.(gpx|fit|tcx|kml|kmz|geojson|json|igc)$/i, '');
  const title = cleanTitle(gpxName ?? base.replace(/_/g, ' '));
  const num = Number(title.match(/#\s*(\d+)/)?.[1]) || Number(base.match(/GR\s*34[_\s-]+(\d+)/i)?.[1]) || Number(base.match(/(\d+)/)?.[1]) || 0;
  // "GR34 - #1 • Nevez - Concarneau" -> "Nevez - Concarneau"
  let route = title.includes('•') ? title.split('•').pop().trim() : title.replace(/^GR\s*34\s*[-–]?\s*(#?\d+)?\s*[-–:]?\s*/i, '');
  route = route.trim();
  const parts = route.split(/\s+[-–>→]\s+/);
  const from = parts[0]?.trim() || route;
  const to = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
  return {
    num,
    from,
    to,
    name: to ? `${from} → ${to}` : from
  };
}
export function buildStage(xml, file) {
  return buildStageFromTrack(parseGpx(xml), file);
}

/** Étape à partir d'une trace déjà lue : { name, points: [{ lat, lon, ele, time }] } */
export function buildStageFromTrack(track, file) {
  const {
    name,
    points
  } = track;
  if (points.length < 2) throw new Error(`${file}: aucun point de trace`);

  // Distance cumulée sur la trace complète
  const cum = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + haversine(points[i - 1], points[i]);
  const distanceKm = cum[points.length - 1] / 1000;

  // Altitudes : comblement des trous, rééchantillonnage tous les 10 m puis
  // moyenne glissante sur ±20 m. Les altitudes GPS / MNT sont très bruitées :
  // sans lissage le D+ d'une trace côtière est facilement multiplié par 5.
  const hasEle = points.some(p => p.ele != null);
  const eles = [];
  if (hasEle) {
    let last = points.find(p => p.ele != null).ele;
    for (const p of points) {
      if (p.ele != null) last = p.ele;
      eles.push(last);
    }
  } else {
    for (let i = 0; i < points.length; i++) eles.push(0);
  }
  const STEP = 10;
  const resampled = [];
  for (let d = 0, j = 0;; d += STEP) {
    const end = d >= cum[points.length - 1];
    if (end) d = cum[points.length - 1];
    while (j < points.length - 2 && cum[j + 1] < d) j++;
    const span = cum[j + 1] - cum[j];
    const t = span > 0 ? Math.max(0, Math.min(1, (d - cum[j]) / span)) : 0;
    const a = points[j];
    const b = points[j + 1];
    resampled.push({
      d,
      ele: eles[j] + (eles[j + 1] - eles[j]) * t,
      lat: a.lat + (b.lat - a.lat) * t,
      lon: a.lon + (b.lon - a.lon) * t
    });
    if (end) break;
  }
  const W = 2; // ±2 échantillons = ±20 m
  const smooth = resampled.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - W); k <= Math.min(resampled.length - 1, i + W); k++) {
      sum += resampled[k].ele;
      n++;
    }
    return sum / n;
  });
  const {
    gain,
    loss
  } = elevationGainLoss(smooth, 1);
  const altMax = hasEle ? Math.max(...smooth) : 0;
  const altMin = hasEle ? Math.min(...smooth) : 0;

  // Trace pour la carte : simplification légère (2 m) pour garder le détail au
  // zoom max ; chaque point porte l'altitude lissée -> [lat, lng, ele].
  const indexed = points.map((p, i) => ({ ...p, i }));
  const simple = simplify(indexed, 2);
  const smoothAt = (d) => {
    const k = Math.min(smooth.length - 1, Math.max(0, d / STEP));
    const a = Math.floor(k);
    const b = Math.min(smooth.length - 1, a + 1);
    return smooth[a] + (smooth[b] - smooth[a]) * (k - a);
  };
  const coords = simple.map((p) => [round(p.lat, 6), round(p.lon, 6), round(hasEle ? smoothAt(cum[p.i]) : 0, 1)]);

  let minLat = Infinity,
    minLon = Infinity,
    maxLat = -Infinity,
    maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  const parsed = parseStageName(name, file);
  const firstTime = points.find(p => p.time != null)?.time;
  return {
    id: file.replace(/\.(gpx|fit|tcx|kml|kmz|geojson|json|igc)$/i, ''),
    file,
    ...parsed,
    distanceKm: round(distanceKm, 2),
    elevationGain: Math.round(gain),
    elevationLoss: Math.round(loss),
    altMax: Math.round(altMax),
    altMin: Math.round(altMin),
    kmEffort: round(distanceKm + gain / 100, 2),
    gpxMovingMin: movingMinutes(points),
    gpxTotalMin: totalMinutes(points),
    gpxDate: firstTime != null ? new Date(firstTime).toISOString() : null,
    coords,
    bounds: [[minLat, minLon], [maxLat, maxLon]]
  };
}
function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
