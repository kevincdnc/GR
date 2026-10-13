// Partage « story » : visuels 1080×1920 prêts pour Instagram / Strava-like.
// Une modale : modèles (10) à gauche, aperçu en temps réel au centre,
// options (tracés, données affichées, couleur, photo) à droite.
// Le rendu est fait sur <canvas> : le même code dessine l'aperçu, les
// vignettes et l'image exportée (PNG, transparent pour les modèles « calque »).

const { useState: useStState, useEffect: useStEffect, useMemo: useStMemo, useRef: useStRef, useCallback: useStCallback } = React;

const ST_W = 1080, ST_H = 1920;
const ST_NUM = '"Barlow Semi Condensed", Barlow, system-ui, sans-serif';
const ST_TXT = 'Barlow, system-ui, sans-serif';
const ST_LOGO = 'Unbounded, Barlow, system-ui, sans-serif';

// ---------------------------------------------------------------------------
// Données : itinéraires / sections -> tracés résolus (stats, durée, date)
// ---------------------------------------------------------------------------

// Un itinéraire composite se partage section par section (comme les stats)
function sharePartsOf(it) {
  if (it.sections && it.sections.length) {
    return it.sections.map((sec) => ({ ...sec, color: sec.color || it.color, activity: it.activity, fromRepo: it.fromRepo }));
  }
  return [it];
}

function stHaversine(a, b) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function stReadMeta() {
  let local = {};
  try { local = JSON.parse(localStorage.getItem('gr34_meta_v1') || '{}') || {}; } catch (e) {}
  const base = window.GR34_META || {};
  const out = {};
  new Set([...Object.keys(base), ...Object.keys(local)]).forEach((k) => { out[k] = { ...(base[k] || {}), ...(local[k] || {}) }; });
  return out;
}

function resolveShareRoutes(parts) {
  const meta = stReadMeta();
  const byNum = new Map((window.GR34_STAGES || []).map((st) => [st.num, st]));
  return parts.filter((x) => x.coords && x.coords.length > 1).map((x) => {
    const repo = !!(x.fromRepo && x.num);
    const st = (repo && byNum.get(x.num)) || {};
    const m = meta[repo ? String(x.num) : x.id] || {};
    const manual = m.duree && window.parseDurationInput ? window.parseDurationInput(m.duree) : null;
    const distance = x.distance || 0, ascent = x.ascent || 0;
    let descent = x.descent != null ? x.descent : st.elevationLoss;
    if (descent == null && typeof computeElevationStats === 'function') descent = Math.round(computeElevationStats(x.coords).descent);
    const durationMin = manual != null ? manual : (st.gpxMovingMin || x.movingMin || estimateDurationMin(distance, ascent, x.activity || 'hiking'));
    const dateIso = m.date || st.gpxDate || x.gpxDate || '';
    return {
      id: x.id,
      name: String(x.name || '').replace(/^Étape \d+ — /, ''),
      color: (ROUTE_COLORS[x.color] || ROUTE_COLORS.blue || { hex: '#3b82f6' }).hex,
      coords: x.coords,
      distance, ascent, descent: descent || 0, durationMin,
      date: dateIso ? dateIso.slice(0, 10) : '',
    };
  });
}

const stNum = (n, d = 1) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ');
function stDuration(min) {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h ${String(r).padStart(2, '0')}` : `${r} min`;
}
function stDateLabel(dates) {
  const ds = dates.filter(Boolean).sort();
  if (!ds.length) return '';
  const f = (iso, opts) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', opts);
  if (ds.length === 1 || ds[0] === ds[ds.length - 1]) return f(ds[0], { day: 'numeric', month: 'long', year: 'numeric' });
  const a = ds[0], b = ds[ds.length - 1];
  if (a.slice(0, 7) === b.slice(0, 7)) return `${f(a, { day: 'numeric' })} → ${f(b, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  return `${f(a, { day: 'numeric', month: 'short' })} → ${f(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function aggregateShare(routes) {
  const sum = (k) => routes.reduce((a, r) => a + (r[k] || 0), 0);
  const distance = sum('distance'), durationMin = sum('durationMin');
  return {
    count: routes.length,
    distance, ascent: sum('ascent'), descent: sum('descent'), durationMin,
    speed: durationMin > 0 ? distance / (durationMin / 60) : 0,
    dateLabel: stDateLabel(routes.map((r) => r.date)),
  };
}

// Données affichables : ordre d'affichage + libellés
const SHARE_FIELDS = [
  { key: 'distance', label: 'Distance', def: true },
  { key: 'ascent', label: 'Dénivelé +', def: true },
  { key: 'duration', label: 'Durée', def: true },
  { key: 'date', label: 'Date', def: false },
  { key: 'title', label: 'Titre', def: false },
  { key: 'descent', label: 'Dénivelé −', def: false },
  { key: 'speed', label: 'Vitesse', def: false },
];

function shareStats(agg, show) {
  const out = [];
  if (show.distance) out.push({ key: 'distance', label: 'Distance', value: stNum(agg.distance), unit: 'km' });
  if (show.ascent) out.push({ key: 'ascent', label: 'Dénivelé +', value: stNum(agg.ascent, 0), unit: 'm' });
  if (show.descent) out.push({ key: 'descent', label: 'Dénivelé −', value: stNum(agg.descent, 0), unit: 'm' });
  if (show.duration) out.push({ key: 'duration', label: 'Durée', value: stDuration(agg.durationMin), unit: '' });
  if (show.speed) out.push({ key: 'speed', label: 'Vitesse', value: stNum(agg.speed), unit: 'km/h' });
  return out;
}

// ---------------------------------------------------------------------------
// Rendu canvas : projection, tuiles, tracé, textes
// ---------------------------------------------------------------------------

const stMerc = (lat, lng) => {
  const s = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * 256, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256];
};

// Cadre le(s) tracé(s) dans un rectangle : renvoie la projection lat/lng -> px
function stFit(routes, rect, maxZ = 16) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  routes.forEach((r) => r.coords.forEach((c) => {
    const [x, y] = stMerc(c[0], c[1]);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }));
  const bw = Math.max(x1 - x0, 1e-9), bh = Math.max(y1 - y0, 1e-9);
  const z = Math.min(maxZ, Math.log2(Math.min(rect.w / bw, rect.h / bh)));
  const k = 2 ** z;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const ox = rect.x + rect.w / 2 - cx * k, oy = rect.y + rect.h / 2 - cy * k;
  return { z, k, ox, oy, px: (lat, lng) => { const [x, y] = stMerc(lat, lng); return [x * k + ox, y * k + oy]; } };
}

const stImgCache = new Map();
function stLoadImage(url, cors = true) {
  if (stImgCache.has(url)) return stImgCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  stImgCache.set(url, p);
  return p;
}

const ST_TILES = {
  dark: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', max: 16,
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 18 },
  topo: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', max: 18 },
};

// Fond de carte en tuiles (CORS) ; une tuile refusée est simplement sautée
// `pr` = pixels réels par unité de dessin (export haute définition : tuiles
// d'un niveau plus détaillé, dans la limite de `maxTiles`).
async function stDrawTiles(ctx, provider, proj, area, layer = 'url', pr = 1, maxTiles = 320) {
  const def = ST_TILES[provider];
  let tz = Math.max(0, Math.min(def.max, Math.round(proj.z + Math.log2(Math.max(0.25, pr)))));
  let size, n, tx0, tx1, ty0, ty1;
  for (;;) {
    size = 256 * 2 ** (proj.z - tz); // unités de dessin par tuile
    n = 2 ** tz;
    tx0 = Math.floor((area.x - proj.ox) / size); tx1 = Math.floor((area.x + area.w - proj.ox) / size);
    ty0 = Math.max(0, Math.floor((area.y - proj.oy) / size)); ty1 = Math.min(n - 1, Math.floor((area.y + area.h - proj.oy) / size));
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= maxTiles || tz <= 0) break;
    tz--;
  }
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const wx = ((tx % n) + n) % n;
      const url = def[layer].replace('{z}', tz).replace('{x}', wx).replace('{y}', ty);
      jobs.push(stLoadImage(url).then((img) => ({ img, x: proj.ox + tx * size, y: proj.oy + ty * size })));
    }
  }
  const tiles = await Promise.all(jobs);
  let drawn = 0;
  tiles.forEach((t) => { if (t.img) { ctx.drawImage(t.img, t.x, t.y, size + 0.6, size + 0.6); drawn++; } });
  return drawn;
}

function stPath(ctx, proj, coords) {
  ctx.beginPath();
  coords.forEach((c, i) => { const [x, y] = proj.px(c[0], c[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
}

// Tracé(s) : liseré + trait, éventuellement lueur
function stDrawRoutes(ctx, routes, proj, o) {
  const { color, width = 9, casing = null, casingWidth = 6, glow = 0, markers = true } = o;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (casing) {
    ctx.strokeStyle = casing; ctx.lineWidth = width + casingWidth * 2;
    routes.forEach((r) => { stPath(ctx, proj, r.coords); ctx.stroke(); });
  }
  routes.forEach((r) => {
    const col = color === 'routes' ? r.color : color;
    if (glow) { ctx.shadowColor = col; ctx.shadowBlur = glow; }
    ctx.strokeStyle = col; ctx.lineWidth = width;
    stPath(ctx, proj, r.coords); ctx.stroke();
    ctx.shadowBlur = 0;
  });
  if (markers && routes.length) {
    const first = routes[0].coords[0], lastR = routes[routes.length - 1], last = lastR.coords[lastR.coords.length - 1];
    const startCol = color === 'routes' ? routes[0].color : color;
    const endCol = color === 'routes' ? lastR.color : color;
    const r0 = Math.max(10, width * 1.5);
    let [x, y] = proj.px(first[0], first[1]);
    ctx.beginPath(); ctx.arc(x, y, r0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r0 * 0.5, 0, Math.PI * 2); ctx.fillStyle = startCol; ctx.fill();
    [x, y] = proj.px(last[0], last[1]);
    ctx.beginPath(); ctx.arc(x, y, r0, 0, Math.PI * 2); ctx.fillStyle = endCol; ctx.fill();
    ctx.lineWidth = r0 * 0.35; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  ctx.restore();
}

function stFont(weight, size, family = ST_TXT) { return `${weight} ${Math.round(size)}px ${family}`; }

function stWrap(ctx, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1] + '…';
    while (ctx.measureText(last).width > maxW && last.length > 2) last = last.slice(0, -2) + '…';
    kept[maxLines - 1] = last;
    return kept;
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Système typographique commun à tous les modèles
//   - compteurs : Barlow Semi Condensed 700, unité en 600 plus petite
//   - libellés : Barlow 600 en capitales espacées
//   - titres : Barlow 700
// Les compteurs se réduisent automatiquement pour toujours tenir dans leur
// colonne (jamais plus gros que la taille demandée).
// ---------------------------------------------------------------------------

const ST_PAD = 96; // marge latérale commune

// Texte espacé (letter-spacing manuel : fiable sur tous les navigateurs)
function stSpaced(ctx, text, x, y, spacing, align = 'left') {
  const chars = [...String(text)];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
  return total;
}
function stLabel(ctx, text, x, y, size, color, align = 'left') {
  ctx.font = stFont(600, size, ST_TXT);
  ctx.fillStyle = color;
  return stSpaced(ctx, String(text).toUpperCase(), x, y, size * 0.14, align);
}
function stLabelWidth(ctx, text, size) {
  ctx.font = stFont(600, size, ST_TXT);
  const t = String(text).toUpperCase();
  return ctx.measureText(t).width + size * 0.14 * Math.max(0, t.length - 1);
}

// Largeur d'un compteur (valeur + unité) à une taille donnée
function stValueWidth(ctx, s, size) {
  ctx.font = stFont(700, size, ST_NUM);
  let w = ctx.measureText(s.value).width;
  if (s.unit) { ctx.font = stFont(600, size * 0.4, ST_NUM); w += ctx.measureText(' ' + s.unit).width; }
  return w;
}
function stValue(ctx, s, x, y, size, color, align = 'left') {
  const w = stValueWidth(ctx, s, size);
  let x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left'; ctx.fillStyle = color;
  ctx.font = stFont(700, size, ST_NUM);
  ctx.fillText(s.value, x0, y);
  if (s.unit) {
    const vw = ctx.measureText(s.value).width;
    ctx.font = stFont(600, size * 0.4, ST_NUM);
    ctx.fillText(' ' + s.unit, x0 + vw, y);
  }
  return w;
}

// Mise en page d'une grille de compteurs : taille commune ajustée
function stStatsLayout(ctx, stats, w, o = {}) {
  const n = stats.length;
  const cols = Math.max(1, Math.min(o.cols || (n === 4 ? 2 : 3), n || 1));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cw = w / cols;
  const inner = cw - (o.cellPad != null ? o.cellPad : 36);
  let size = o.maxSize || 96;
  stats.forEach((s) => { const vw = stValueWidth(ctx, s, size); if (vw > inner) size = size * inner / vw; });
  size = Math.max(36, size);
  const labelSize = Math.max(22, Math.min(o.labelSize || 28, size * 0.34));
  const gapLV = labelSize * 0.75;
  const cellH = labelSize + gapLV + size * 0.78;
  const rowGap = o.rowGap != null ? o.rowGap : size * 0.55;
  return { cols, rows, cw, size, labelSize, gapLV, cellH, rowGap, height: rows * cellH + (rows - 1) * rowGap };
}
// Dessine la grille ; `top` = haut du bloc. Renvoie la hauteur occupée.
function stDrawStats(ctx, stats, x, top, w, o = {}) {
  const L = o.layout || stStatsLayout(ctx, stats, w, o);
  const align = o.align || 'center';
  const color = o.color || '#ffffff', labelColor = o.labelColor || 'rgba(255,255,255,0.68)';
  stats.forEach((s, i) => {
    const c = i % L.cols, r = Math.floor(i / L.cols);
    // Rangée incomplète centrée quand la grille est centrée
    const inRow = Math.min(L.cols, stats.length - r * L.cols);
    const shift = align === 'center' ? (L.cols - inRow) * L.cw / 2 : 0;
    const cx = (align === 'center' ? x + c * L.cw + L.cw / 2 : x + c * L.cw) + shift;
    const ty = top + r * (L.cellH + L.rowGap);
    stLabel(ctx, s.label, cx, ty + L.labelSize * 0.8, L.labelSize, labelColor, align);
    stValue(ctx, s, cx, ty + L.labelSize + L.gapLV + L.size * 0.74, L.size, color, align);
    if (o.dividers && c > 0) {
      ctx.save(); ctx.fillStyle = o.dividerColor || 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + shift + c * L.cw - 1, ty + 4, 2, L.cellH - 4);
      ctx.restore();
    }
  });
  return L.height;
}

// Titre (1 à 3 lignes) + date en capitales ; renvoie la hauteur
function stHeading(ctx, d, x, top, w, o = {}) {
  const t = d.show.title ? d.title : '';
  const date = d.show.date ? d.agg.dateLabel : '';
  const size = o.titleSize || 64, align = o.align || 'left';
  let y = top;
  if (date && o.dateFirst) { stLabel(ctx, date, x, y + 26, 26, o.dateColor || 'rgba(255,255,255,0.7)', align); y += 26 + 26; }
  if (t) {
    ctx.font = stFont(700, size, ST_TXT); ctx.fillStyle = o.color || '#ffffff'; ctx.textAlign = align;
    stWrap(ctx, t, w, o.maxLines || 2).forEach((l, i) => { ctx.fillText(l, x, y + size * 0.86); y += size * 1.12; });
  }
  if (date && !o.dateFirst) { y += t ? 14 : 0; stLabel(ctx, date, x, y + 26, 26, o.dateColor || 'rgba(255,255,255,0.7)', align); y += 26 + 8; }
  return y - top;
}
function stHeadingHeight(ctx, d, w, o = {}) {
  const t = d.show.title ? d.title : '';
  const date = d.show.date ? d.agg.dateLabel : '';
  const size = o.titleSize || 64;
  let h = 0;
  if (t) { ctx.font = stFont(700, size, ST_TXT); h += stWrap(ctx, t, w, o.maxLines || 2).length * size * 1.12; }
  if (date) h += (t ? 14 : 0) + 34;
  return h;
}

function stRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Logo Routdoor : SVG de la navigation, recoloré
const stLogoCache = {};
function stLogo(color) {
  if (stLogoCache[color]) return stLogoCache[color];
  const el = document.querySelector('svg[aria-label="Routdoor"]');
  if (!el) return (stLogoCache[color] = Promise.resolve(null));
  const hole = color === '#ffffff' ? '#000000' : '#ffffff';
  let svg = el.outerHTML.replace(/currentColor/g, color).replace(/fill="#000"/g, `fill="${hole}"`).replace(/fill="#fff"/g, `fill="${hole}"`);
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  // Grande taille intrinsèque : le logo reste net une fois agrandi
  svg = svg.replace(/\swidth="[^"]*"/, ' width="1237"').replace(/\sheight="[^"]*"/, ' height="284"');
  return (stLogoCache[color] = stLoadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), false));
}
async function stDrawLogo(ctx, x, y, h, color = '#ffffff', align = 'left') {
  const img = await stLogo(color);
  if (img) {
    const w = h * 1237 / 284;
    const xx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.drawImage(img, xx, y, w, h);
  } else {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = stFont(800, h, ST_LOGO); ctx.fillText('Routdoor', x, y + h * 0.8);
  }
}

function stCover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function stPlaceholderPhoto(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#1e3a5f'); g.addColorStop(0.55, '#2c5364'); g.addColorStop(1, '#0f2027');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.72); ctx.lineTo(x + w * 0.3, y + h * 0.5); ctx.lineTo(x + w * 0.52, y + h * 0.66);
  ctx.lineTo(x + w * 0.78, y + h * 0.42); ctx.lineTo(x + w, y + h * 0.6); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill();
  ctx.globalAlpha = 0.55; ctx.textAlign = 'center'; ctx.font = stFont(600, Math.min(w, h) * 0.05, ST_TXT);
  ctx.fillText('Ajoutez votre photo', x + w / 2, y + h * 0.35);
  ctx.restore();
}

function stTitleText(d) { return d.show.title ? d.title : ''; }

// Profil d'altitude cumulé de tous les tracés : [{d (km), e (m)}]
function stProfile(routes) {
  const raw = [];
  let dist = 0;
  routes.forEach((r) => r.coords.forEach((c, i) => {
    if (i) dist += stHaversine(r.coords[i - 1], c);
    if (c.length > 2 && typeof c[2] === 'number') raw.push({ d: dist, e: c[2] });
  }));
  if (raw.length < 3) return raw;
  // Rééchantillonnage régulier (≈300 points) + moyenne glissante : profil lisible
  const N = 300, maxD = raw[raw.length - 1].d || 1, out = [];
  let j = 0;
  for (let k = 0; k <= N; k++) {
    const d = (k / N) * maxD;
    while (j < raw.length - 2 && raw[j + 1].d < d) j++;
    const a = raw[j], b = raw[j + 1];
    const t = b.d > a.d ? Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d))) : 0;
    out.push({ d, e: a.e + (b.e - a.e) * t });
  }
  const W = 4;
  return out.map((p, i) => {
    let sum = 0, n = 0;
    for (let q = Math.max(0, i - W); q <= Math.min(out.length - 1, i + W); q++) { sum += out[q].e; n++; }
    return { d: p.d, e: sum / n };
  });
}

// ---------------------------------------------------------------------------
// Les 10 modèles. Chaque draw(ctx, d) dessine en unités 1080×1920.
// ---------------------------------------------------------------------------

const STORY_TEMPLATES = [
  {
    // Calque : tracé lumineux + compteurs alignés, à poser sur une photo/vidéo
    id: 'trace', name: 'Tracé', kind: 'Calque', transparent: true,
    async draw(ctx, d) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18;
      await stDrawLogo(ctx, ST_W / 2, 190, 58, '#ffffff', 'center');
      const w = ST_W - 2 * ST_PAD;
      const L = stStatsLayout(ctx, d.stats, w, { maxSize: 96 });
      const hh = stHeadingHeight(ctx, d, w, { titleSize: 60 });
      const statsTop = ST_H - 250 - L.height;
      const headTop = statsTop - (hh ? hh + 56 : 0);
      if (hh) stHeading(ctx, d, ST_W / 2, headTop, w, { titleSize: 60, align: 'center' });
      if (d.stats.length) stDrawStats(ctx, d.stats, ST_PAD, statsTop, w, { layout: L, dividers: true, dividerColor: 'rgba(255,255,255,0.35)' });
      ctx.restore();
      const proj = stFit(d.routes, { x: 150, y: 340, w: 780, h: Math.max(400, headTop - 120 - 340) });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 13, casing: 'rgba(0,0,0,0.22)', casingWidth: 5, glow: 22 });
    },
  },
  {
    // Calque : compteurs empilés au centre, tracé en filigrane derrière
    id: 'colonne', name: 'Colonne', kind: 'Calque', transparent: true,
    async draw(ctx, d) {
      const proj = stFit(d.routes, { x: 200, y: 300, w: 680, h: 1320 });
      ctx.save(); ctx.globalAlpha = 0.9;
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 15, markers: false });
      ctx.restore();
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 22;
      await stDrawLogo(ctx, ST_W / 2, 250, 64, '#ffffff', 'center');
      const items = [...d.stats];
      if (d.show.date && d.agg.dateLabel) items.push({ label: 'Date', value: d.agg.dateLabel, unit: '', isDate: true });
      const t = d.show.title ? d.title : '';
      let y = 420;
      if (t) { ctx.font = stFont(700, 56, ST_TXT); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; stWrap(ctx, t, 820, 2).forEach((l) => { y += 56; ctx.fillText(l, ST_W / 2, y); y += 10; }); y += 30; }
      const avail = 1640 - y;
      const step = Math.min(250, avail / Math.max(1, items.length));
      const size = Math.min(110, step * 0.5);
      items.forEach((s, i) => {
        const top = y + i * step + (step - size * 1.35) / 2;
        stLabel(ctx, s.label, ST_W / 2, top + 24, 26, 'rgba(255,255,255,0.85)', 'center');
        if (s.isDate) { ctx.font = stFont(700, size * 0.6, ST_NUM); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(s.value, ST_W / 2, top + 40 + size * 0.6); }
        else {
          let sz = size; const vw = stValueWidth(ctx, s, sz); if (vw > 860) sz *= 860 / vw;
          stValue(ctx, s, ST_W / 2, top + 40 + sz * 0.76, sz, '#ffffff', 'center');
        }
      });
      ctx.restore();
    },
  },
  {
    // Calque : pastilles façon badges, tracé dessous
    id: 'pastilles', name: 'Pastilles', kind: 'Calque', transparent: true,
    async draw(ctx, d) {
      const pills = [];
      if (d.show.date && d.agg.dateLabel) pills.push(d.agg.dateLabel.toUpperCase());
      d.stats.forEach((s) => pills.push(`${s.label.toUpperCase()}  ${s.value}${s.unit ? ' ' + s.unit.toUpperCase() : ''}`));
      const h = 84, gap = 16, maxW = ST_W - 2 * ST_PAD, fs = 34;
      ctx.font = stFont(600, fs, ST_NUM);
      const logoH = 44, logoW = logoH * 1237 / 284 + 64;
      const widths = pills.map((p) => ctx.measureText(p).width + 64);
      const rows = [[{ logo: true, w: logoW }]];
      widths.forEach((w, i) => {
        const row = rows[rows.length - 1];
        const rw = row.reduce((a, b) => a + b.w + gap, 0);
        if (rw + w > maxW) rows.push([{ i, w }]); else row.push({ i, w });
      });
      let y = 300;
      const t = d.show.title ? d.title : '';
      if (t) {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = stFont(700, 58, ST_TXT);
        stWrap(ctx, t, maxW, 2).forEach((l) => { ctx.fillText(l, ST_W / 2, y + 50); y += 66; });
        ctx.restore(); y += 34;
      }
      for (const row of rows) {
        const rw = row.reduce((a, b) => a + b.w, 0) + gap * (row.length - 1);
        let x = (ST_W - rw) / 2;
        for (const cell of row) {
          stRoundRect(ctx, x, y, cell.w, h, h / 2);
          ctx.fillStyle = cell.logo ? '#ffffff' : 'rgba(0,0,0,0.38)'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
          if (cell.logo) await stDrawLogo(ctx, x + cell.w / 2, y + (h - logoH) / 2, logoH, '#111111', 'center');
          else { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = stFont(600, fs, ST_NUM); ctx.fillText(pills[cell.i], x + cell.w / 2, y + h / 2 + 2); ctx.textBaseline = 'alphabetic'; }
          x += cell.w + gap;
        }
        y += h + gap;
      }
      const proj = stFit(d.routes, { x: 200, y: y + 110, w: 680, h: Math.max(320, 1640 - y - 110) });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 12, casing: '#ffffff', casingWidth: 5 });
    },
  },
  {
    // Photo plein cadre, dégradés haut/bas, titre + compteurs en bas
    id: 'photo', name: 'Photo', kind: 'Photo', photo: true,
    async draw(ctx, d) {
      if (d.photo) stCover(ctx, d.photo, 0, 0, ST_W, ST_H); else stPlaceholderPhoto(ctx, 0, 0, ST_W, ST_H);
      let g = ctx.createLinearGradient(0, 0, 0, 460); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, ST_W, 460);
      g = ctx.createLinearGradient(0, ST_H * 0.45, 0, ST_H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0.82)');
      ctx.fillStyle = g; ctx.fillRect(0, ST_H * 0.45, ST_W, ST_H * 0.55);
      await stDrawLogo(ctx, ST_PAD, 150, 50, '#ffffff');
      const proj = stFit(d.routes, { x: ST_W - ST_PAD - 220, y: 120, w: 220, h: 220 });
      stDrawRoutes(ctx, d.routes, proj, { color: '#ffffff', width: 6, markers: false, glow: 8 });
      const w = ST_W - 2 * ST_PAD;
      const L = stStatsLayout(ctx, d.stats, w, { maxSize: 92, align: 'left' });
      const statsTop = ST_H - 240 - L.height;
      const hh = stHeadingHeight(ctx, d, w, { titleSize: 68, maxLines: 3 });
      if (hh) stHeading(ctx, d, ST_PAD, statsTop - 60 - hh, w, { titleSize: 68, maxLines: 3 });
      if (d.stats.length) stDrawStats(ctx, d.stats, ST_PAD, statsTop, w, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.75)' });
    },
  },
  {
    // Polaroïd posé sur fond crème, légende manuscrite, compteurs sobres
    id: 'polaroid', name: 'Polaroïd', kind: 'Photo', photo: true,
    async draw(ctx, d) {
      const ink = '#1c1917', mute = '#78716c';
      ctx.fillStyle = '#f2ede3'; ctx.fillRect(0, 0, ST_W, ST_H);
      await stDrawLogo(ctx, ST_W / 2, 140, 44, ink, 'center');
      ctx.save();
      ctx.translate(ST_W / 2, 780); ctx.rotate(-0.03);
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 22;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-420, -500, 840, 1000);
      ctx.shadowColor = 'transparent';
      ctx.save(); ctx.beginPath(); ctx.rect(-384, -464, 768, 800); ctx.clip();
      if (d.photo) stCover(ctx, d.photo, -384, -464, 768, 800); else stPlaceholderPhoto(ctx, -384, -464, 768, 800);
      ctx.restore();
      // mini tracé blanc dans le coin de la photo
      const proj = stFit(d.routes, { x: 160, y: -440, w: 200, h: 200 });
      stDrawRoutes(ctx, d.routes, proj, { color: '#ffffff', width: 5, markers: false, glow: 6 });
      const cap = (d.show.title ? d.title : '') || d.title;
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = stFont(600, 46, ST_TXT);
      ctx.fillText(stWrap(ctx, cap, 720, 1)[0] || '', 0, 420);
      ctx.restore();
      const w = ST_W - 2 * ST_PAD;
      let top = 1390;
      if (d.show.date && d.agg.dateLabel) { stLabel(ctx, d.agg.dateLabel, ST_W / 2, top + 26, 26, mute, 'center'); top += 80; }
      if (d.stats.length) stDrawStats(ctx, d.stats, ST_PAD, top, w, { maxSize: 84, color: ink, labelColor: mute, dividers: true, dividerColor: 'rgba(28,25,23,0.15)' });
    },
  },
  {
    // Carte sombre + tracé lumineux, carte de stats en verre
    id: 'nuit', name: 'Carte nuit', kind: 'Carte',
    async draw(ctx, d) {
      ctx.fillStyle = '#1c1c1c'; ctx.fillRect(0, 0, ST_W, ST_H);
      const w = ST_W - 2 * ST_PAD - 2 * 56;
      const L = stStatsLayout(ctx, d.stats, w, { maxSize: 84 });
      const hh = stHeadingHeight(ctx, d, w, { titleSize: 54, maxLines: 2 });
      const cardH = 64 + (hh ? hh + 44 : 0) + L.height + 64;
      const cardY = ST_H - 200 - cardH;
      const proj = stFit(d.routes, { x: 130, y: 260, w: 820, h: Math.max(400, cardY - 120 - 260) }, 15);
      await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w: ST_W, h: ST_H });
      await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w: ST_W, h: ST_H }, 'labels');
      const g = ctx.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, ST_W, 360);
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 11, glow: 28 });
      await stDrawLogo(ctx, ST_PAD, 150, 50, '#ffffff');
      stRoundRect(ctx, ST_PAD, cardY, ST_W - 2 * ST_PAD, cardH, 40);
      ctx.fillStyle = 'rgba(12,12,12,0.78)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
      let y = cardY + 64;
      if (hh) { stHeading(ctx, d, ST_PAD + 56, y, w, { titleSize: 54, dateColor: 'rgba(255,255,255,0.55)' }); y += hh + 44; }
      if (d.stats.length) stDrawStats(ctx, d.stats, ST_PAD + 56, y, w, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.55)' });
    },
  },
  {
    // Satellite, tracé cerclé de blanc, texte sur dégradé
    id: 'satellite', name: 'Satellite', kind: 'Carte',
    async draw(ctx, d) {
      ctx.fillStyle = '#26301f'; ctx.fillRect(0, 0, ST_W, ST_H);
      const w = ST_W - 2 * ST_PAD;
      const L = stStatsLayout(ctx, d.stats, w, { maxSize: 92 });
      const hh = stHeadingHeight(ctx, d, w, { titleSize: 64 });
      const statsTop = ST_H - 240 - L.height;
      const headTop = statsTop - (hh ? hh + 52 : 0);
      const proj = stFit(d.routes, { x: 130, y: 280, w: 820, h: Math.max(420, headTop - 120 - 280) }, 16);
      await stDrawTiles(ctx, 'satellite', proj, { x: 0, y: 0, w: ST_W, h: ST_H });
      let g = ctx.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, ST_W, 400);
      g = ctx.createLinearGradient(0, headTop - 260, 0, ST_H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.88)');
      ctx.fillStyle = g; ctx.fillRect(0, headTop - 260, ST_W, ST_H);
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 10, casing: '#ffffff', casingWidth: 4 });
      await stDrawLogo(ctx, ST_PAD, 150, 50, '#ffffff');
      if (hh) stHeading(ctx, d, ST_PAD, headTop, w, { titleSize: 64 });
      if (d.stats.length) stDrawStats(ctx, d.stats, ST_PAD, statsTop, w, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.7)' });
    },
  },
  {
    // Carte claire façon appli, feuille blanche en bas
    id: 'carte', name: 'Carte claire', kind: 'Carte',
    async draw(ctx, d) {
      const ink = '#171717', mute = '#737373';
      ctx.fillStyle = '#eef1ec'; ctx.fillRect(0, 0, ST_W, ST_H);
      const w = ST_W - 2 * ST_PAD;
      const L = stStatsLayout(ctx, d.stats, w, { maxSize: 84 });
      const hh = stHeadingHeight(ctx, d, w - 260, { titleSize: 54, maxLines: 2 });
      const sheetH = 120 + Math.max(hh, 50) + 56 + L.height + 220;
      const sheetY = ST_H - sheetH;
      const proj = stFit(d.routes, { x: 130, y: 220, w: 820, h: Math.max(420, sheetY - 100 - 220) }, 16);
      await stDrawTiles(ctx, 'topo', proj, { x: 0, y: 0, w: ST_W, h: ST_H });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color === '#ffffff' ? '#fc5200' : d.color, width: 11, casing: '#ffffff', casingWidth: 4 });
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.16)'; ctx.shadowBlur = 50;
      stRoundRect(ctx, 0, sheetY, ST_W, sheetH + 80, 56); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
      ctx.fillStyle = '#e5e5e5'; stRoundRect(ctx, ST_W / 2 - 50, sheetY + 24, 100, 10, 5); ctx.fill();
      let y = sheetY + 96;
      await stDrawLogo(ctx, ST_W - ST_PAD, y + 4, 40, ink, 'right');
      if (hh) stHeading(ctx, d, ST_PAD, y, w - 260, { titleSize: 54, color: ink, dateColor: mute });
      y += Math.max(hh, 50) + 56;
      if (d.stats.length) stDrawStats(ctx, d.stats, ST_PAD, y, w, { layout: L, align: 'left', color: ink, labelColor: mute });
    },
  },
  {
    // Affiche : gros chiffre, tracé au centre, cadre fin
    id: 'affiche', name: 'Affiche', kind: 'Graphique',
    async draw(ctx, d) {
      const bg = '#13251c', ink = '#efe6d2', mute = 'rgba(239,230,210,0.62)', line = 'rgba(239,230,210,0.3)';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, ST_W, ST_H);
      ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.strokeRect(56, 56, ST_W - 112, ST_H - 112);
      await stDrawLogo(ctx, ST_W / 2, 130, 42, ink, 'center');
      // Gros compteur : même famille que tous les compteurs
      const big = { value: stNum(d.agg.distance, d.agg.distance >= 100 ? 0 : 1), unit: '' };
      let size = 280; const bw = stValueWidth(ctx, big, size); if (bw > 820) size *= 820 / bw;
      stValue(ctx, big, ST_W / 2, 250 + size * 0.78, size, ink, 'center');
      stLabel(ctx, 'Kilomètres', ST_W / 2, 250 + size * 0.78 + 64, 32, mute, 'center');
      const rest = d.stats.filter((s) => s.key !== 'distance');
      const w = ST_W - 2 * 150;
      const L = stStatsLayout(ctx, rest, w, { maxSize: 76 });
      const hh = stHeadingHeight(ctx, d, w, { titleSize: 50 });
      const statsTop = ST_H - 190 - L.height;
      const ruleY = statsTop - 70;
      const headTop = ruleY - 60 - hh;
      const proj = stFit(d.routes, { x: 190, y: 250 + size * 0.78 + 150, w: 700, h: Math.max(320, (hh ? headTop : ruleY) - 110 - (250 + size * 0.78 + 150)) });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color === 'routes' ? '#e8813a' : d.color, width: 10, markers: false });
      if (hh) {
        const dd = { ...d, title: (d.title || '').toUpperCase() };
        stHeading(ctx, dd, ST_W / 2, headTop, w, { titleSize: 50, align: 'center', color: ink, dateColor: mute });
      }
      if (rest.length) {
        ctx.fillStyle = line; ctx.fillRect(150, ruleY, ST_W - 300, 2);
        stDrawStats(ctx, rest, 150, statsTop, w, { layout: L, color: ink, labelColor: mute, dividers: true, dividerColor: line });
      }
    },
  },
  {
    // Profil d'altitude en dégradé, tracé au-dessus
    id: 'profil', name: 'Profil', kind: 'Graphique',
    async draw(ctx, d) {
      const g = ctx.createLinearGradient(0, 0, 0, ST_H); g.addColorStop(0, '#0b1220'); g.addColorStop(1, '#172138');
      ctx.fillStyle = g; ctx.fillRect(0, 0, ST_W, ST_H);
      const accent = d.color === 'routes' ? (d.routes[0] ? d.routes[0].color : '#3b82f6') : d.color;
      await stDrawLogo(ctx, ST_PAD, 150, 50, '#ffffff');
      const w = ST_W - 2 * ST_PAD;
      let y = 290;
      const hh = stHeadingHeight(ctx, d, w, { titleSize: 64 });
      if (hh) { stHeading(ctx, d, ST_PAD, y, w, { titleSize: 64, dateColor: 'rgba(255,255,255,0.55)' }); y += hh + 40; }
      const L = stStatsLayout(ctx, d.stats, w, { maxSize: 84 });
      const statsTop = ST_H - 220 - L.height;
      const py1 = statsTop - 150, py0 = py1 - 380;
      const proj = stFit(d.routes, { x: 170, y: y + 20, w: 740, h: Math.max(260, py0 - 130 - y - 20) });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 9, glow: 16 });
      const pts = stProfile(d.routes);
      if (pts.length > 1) {
        const maxD = pts[pts.length - 1].d || 1;
        let lo = Infinity, hi = -Infinity; pts.forEach((p) => { lo = Math.min(lo, p.e); hi = Math.max(hi, p.e); });
        const span = Math.max(30, hi - lo);
        const X = (dd) => (dd / maxD) * ST_W;
        const Y = (e) => py1 - ((e - lo) / span) * (py1 - py0);
        ctx.beginPath(); ctx.moveTo(0, py1 + 70);
        pts.forEach((p) => ctx.lineTo(X(p.d), Y(p.e)));
        ctx.lineTo(ST_W, py1 + 70); ctx.closePath();
        const fg = ctx.createLinearGradient(0, py0, 0, py1 + 70); fg.addColorStop(0, accent + 'bb'); fg.addColorStop(1, accent + '00');
        ctx.fillStyle = fg; ctx.fill();
        ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(X(p.d), Y(p.e)); else ctx.moveTo(X(p.d), Y(p.e)); });
        ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke();
        stLabel(ctx, `Alt. max ${Math.round(hi)} m`, ST_PAD, py0 - 44, 24, 'rgba(255,255,255,0.6)');
        stLabel(ctx, `${stNum(maxD)} km`, ST_W - ST_PAD, py0 - 44, 24, 'rgba(255,255,255,0.6)', 'right');
      }
      if (d.stats.length) stDrawStats(ctx, d.stats, ST_PAD, statsTop, w, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.6)' });
    },
  },
];

async function renderStory(canvas, tpl, d, scale = 1) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (!d.routes.length) return;
  try { await tpl.draw(ctx, d); } catch (e) { console.warn('story render', e); }
}

async function storyFontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`700 40px "Barlow Semi Condensed"`), document.fonts.load(`600 40px "Barlow Semi Condensed"`),
      document.fonts.load(`700 40px Barlow`), document.fonts.load(`500 40px Barlow`), document.fonts.load(`800 40px Unbounded`),
    ]);
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Modale
// ---------------------------------------------------------------------------

const SHARE_COLORS = [
  { value: 'routes', label: 'Couleurs des tracés' },
  { value: '#fc5200', label: 'Orange' },
  { value: '#ffffff', label: 'Blanc' },
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#facc15', label: 'Jaune' },
  { value: '#22c55e', label: 'Vert' },
  { value: '#ec4899', label: 'Rose' },
];

const ST_CHECKER = { backgroundColor: '#2a2a2a', backgroundImage: 'linear-gradient(45deg,#3a3a3a 25%,transparent 25%),linear-gradient(-45deg,#3a3a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#3a3a3a 75%),linear-gradient(-45deg,transparent 75%,#3a3a3a 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0' };

function StorySwitch({ on }) {
  return (
    <span className="shrink-0 relative rounded-full transition-colors" style={{ width: 28, height: 16, background: on ? '#3b82f6' : '#404040' }}>
      <span className="absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all" style={{ left: on ? 14 : 2 }}></span>
    </span>
  );
}

// Ligne « libellé + interrupteur »
function ShareFieldRow({ dark, label, on, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-neutral-100'}`}>
      <span>{label}</span>
      <StorySwitch on={!!on} />
    </button>
  );
}

// Choix des tracés inclus (partagé par les 3 modes)
function ShareRoutesPicker({ allRoutes, included, setIncluded, dark, sectionTitle, label }) {
  if (allRoutes.length < 2) return null;
  return (
    <div>
      <div className={sectionTitle}>Tracés</div>
      <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto sb-scroll -mx-1 px-1">
        {allRoutes.map((r) => {
          const on = included.has(r.id);
          return (
            <button key={r.id} onClick={() => setIncluded((s) => { const n = new Set(s); if (n.has(r.id)) { if (n.size > 1) n.delete(r.id); } else n.add(r.id); return n; })}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-neutral-100'}`}>
              <span className={`w-4 h-4 shrink-0 rounded grid place-items-center border ${on ? 'bg-blue-500 border-blue-500' : (dark ? 'border-neutral-600' : 'border-neutral-300')}`}>
                {on && <I.Check size={11} stroke="white" strokeWidth="3" />}
              </span>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }}></span>
              <span className={`flex-1 min-w-0 truncate text-[12.5px] ${on ? '' : label}`}>{r.name}</span>
              <span className={`text-[11px] tabular-nums ${label}`}>{stNum(r.distance)} km</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SHARE_MODES = [
  { id: 'story', name: 'Story', icon: 'Story' },
  { id: 'poster', name: 'Poster', icon: 'Poster' },
  { id: 'embed', name: 'Embed', icon: 'Code' },
];
const SHARE_MODE_KEY = 'gr34_share_mode';

// Modale de partage : Story (réseaux sociaux) · Poster (impression) · Embed
// (carte intégrable), plus l'envoi du lien à un ami.
function StoryShareModal({ parts, title: initialTitle, dark, onClose, onToast }) {
  const allRoutes = useStMemo(() => resolveShareRoutes(parts), [parts]);
  const [included, setIncluded] = useStState(() => new Set(allRoutes.map((r) => r.id)));
  const routes = useStMemo(() => allRoutes.filter((r) => included.has(r.id)), [allRoutes, included]);
  const agg = useStMemo(() => aggregateShare(routes), [routes]);
  const [title, setTitle] = useStState(initialTitle || '');
  const [mode, setModeState] = useStState(() => { try { const m = localStorage.getItem(SHARE_MODE_KEY); return SHARE_MODES.some((x) => x.id === m) ? m : 'story'; } catch (e) { return 'story'; } });
  const setMode = (m) => { setModeState(m); try { localStorage.setItem(SHARE_MODE_KEY, m); } catch (e) {} };
  const isMobile = useIsMobile();

  // Échap pour fermer
  useStEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label = dark ? 'text-neutral-400' : 'text-neutral-500';
  const strong = dark ? 'text-white' : 'text-neutral-900';
  const common = { allRoutes, routes, included, setIncluded, agg, title, setTitle, initialTitle, dark, isMobile, onToast };
  const linkTitle = title.trim() || initialTitle || '';

  const toggle = (
    <div className={`flex p-0.5 rounded-lg ${dark ? 'bg-white/[0.06] ring-1 ring-white/[0.06]' : 'bg-neutral-100'}`}>
      {SHARE_MODES.map((m) => {
        const Ico = I[m.icon];
        const on = m.id === mode;
        return (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`h-8 flex items-center gap-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${isMobile ? 'flex-1 justify-center px-2' : 'px-3.5'} ${on ? (dark ? 'bg-white/[0.14] text-white shadow-sm' : 'bg-white text-neutral-900 shadow-sm') : (dark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-900')}`}>
            <Ico size={15} /> {m.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-menu ${isMobile ? '' : 'p-4'}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`glass-strong shadow-2xl flex flex-col overflow-hidden ${isMobile ? '' : 'rounded-xl'} ${strong}`}
        style={isMobile ? { width: '100vw', height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' } : { width: 'min(1240px, 98vw)', height: 'min(860px, 96vh)' }}>
        {/* En-tête : titre · toggle des modes + lien · fermer */}
        <div className={`relative z-30 flex items-center justify-between gap-3 px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-neutral-200'} ${isMobile ? 'flex-wrap px-3' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 grid place-items-center rounded-lg bg-blue-500/15 text-blue-400"><I.Share size={16} /></span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-tight">Partager</div>
              <div className={`text-[12px] truncate ${label}`}>
                {routes.length} tracé{routes.length > 1 ? 's' : ''} · {stNum(agg.distance)} km · {stNum(agg.ascent, 0)} m D+
              </div>
            </div>
          </div>
          <div className={isMobile ? 'order-3 w-full flex items-center gap-2' : 'absolute left-1/2 -translate-x-1/2 flex items-center gap-2'}>
            <div className={isMobile ? 'flex-1' : ''}>{toggle}</div>
            <ShareLinkButton title={linkTitle} routes={routes} dark={dark} onToast={onToast} compact={isMobile} />
          </div>
          <button onClick={onClose} aria-label="Fermer" className={`w-8 h-8 grid place-items-center rounded-md transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-500 hover:bg-neutral-100'}`}>
            <I.X size={16} />
          </button>
        </div>

        {mode === 'story' && <StoryPane {...common} />}
        {mode === 'poster' && <PosterPane {...common} />}
        {mode === 'embed' && <EmbedPane {...common} />}
      </div>
    </div>
  );
}

function StoryPane({ allRoutes, routes, included, setIncluded, agg, title, setTitle, initialTitle, dark, isMobile, onToast }) {
  const [tplId, setTplId] = useStState('trace');
  const [show, setShow] = useStState(() => Object.fromEntries(SHARE_FIELDS.map((f) => [f.key, f.def])));
  const [color, setColor] = useStState(allRoutes.length > 1 ? 'routes' : '#fc5200');
  const [photo, setPhoto] = useStState(null); // { url, img }
  const [busy, setBusy] = useStState(false);
  const [ready, setReady] = useStState(false);
  const [dragPhoto, setDragPhoto] = useStState(false);
  const previewRef = useStRef(null);
  const thumbRefs = useStRef({});
  const fileRef = useStRef(null);
  const tpl = STORY_TEMPLATES.find((t) => t.id === tplId) || STORY_TEMPLATES[0];

  const data = useStMemo(() => ({
    routes, agg, show, title: title.trim() || initialTitle || 'Ma sortie',
    stats: shareStats(agg, show), color, photo: photo && photo.img,
  }), [routes, agg, show, title, color, photo]);

  // Aperçu + vignettes, redessinés à chaque changement (le dernier gagne)
  const token = useStRef(0);
  useStEffect(() => {
    const my = ++token.current;
    const t = setTimeout(async () => {
      await storyFontsReady();
      if (my !== token.current) return;
      if (previewRef.current) await renderStory(previewRef.current, tpl, data, previewRef.current.width / ST_W);
      if (my !== token.current) return;
      setReady(true);
      for (const tp of STORY_TEMPLATES) {
        const c = thumbRefs.current[tp.id];
        if (c && my === token.current) await renderStory(c, tp, data, c.width / ST_W);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [data, tplId]);

  const loadPhoto = (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setPhoto({ url: reader.result, img });
        if (!tpl.photo) setTplId('photo');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const exportBlob = async () => {
    const c = document.createElement('canvas');
    c.width = ST_W; c.height = ST_H;
    await storyFontsReady();
    await renderStory(c, tpl, data, 1);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  };
  const fileName = () => {
    const slug = (data.title || 'sortie').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return `routdoor-${slug || 'sortie'}-${tpl.id}.png`;
  };
  const doDownload = async () => {
    setBusy(true);
    try {
      const blob = await exportBlob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      onToast && onToast('Image téléchargée');
    } catch (e) { onToast && onToast('Export impossible : ' + e.message); }
    setBusy(false);
  };
  const doCopy = async () => {
    setBusy(true);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportBlob() })]);
      onToast && onToast('Image copiée dans le presse-papiers');
    } catch (e) { onToast && onToast('Copie impossible dans ce navigateur'); }
    setBusy(false);
  };
  const canShareFiles = typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  const doShare = async () => {
    setBusy(true);
    try {
      const blob = await exportBlob();
      await navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })], title: data.title });
    } catch (e) { if (e && e.name !== 'AbortError') onToast && onToast('Partage impossible : ' + e.message); }
    setBusy(false);
  };

  const label = dark ? 'text-neutral-400' : 'text-neutral-500';
  const strong = dark ? 'text-white' : 'text-neutral-900';
  const sectionTitle = `text-[10.5px] font-semibold uppercase tracking-wider mb-2 ${label}`;
  const multi = allRoutes.length > 1;
  const sep = dark ? 'border-white/10' : 'border-neutral-200';

  return (
        <div className={`flex-1 min-h-0 flex ${isMobile ? 'flex-col overflow-y-auto sb-scroll' : ''}`}>
          {/* Modèles (mobile : bandeau horizontal sous l'aperçu) */}
          <div className={isMobile ? `order-2 shrink-0 px-3 pt-3 pb-1 border-t ${sep}` : `w-[248px] shrink-0 overflow-y-auto sb-scroll p-4 border-r ${sep}`}>
            <div className={sectionTitle}>Modèles</div>
            <div className={isMobile ? 'flex gap-2.5 overflow-x-auto sb-scroll pb-2 -mx-3 px-3 snap-x' : 'grid grid-cols-2 gap-2.5'}>
              {STORY_TEMPLATES.map((t) => {
                const sel = t.id === tplId;
                return (
                  <button key={t.id} onClick={() => setTplId(t.id)} className={`text-left group ${isMobile ? 'w-[84px] shrink-0 snap-start' : ''}`}>
                    <div className={`relative rounded-lg overflow-hidden transition-all ${sel ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : (dark ? 'ring-1 ring-white/10 group-hover:ring-white/30' : 'ring-1 ring-neutral-200')}`}
                      style={t.transparent ? ST_CHECKER : { background: '#111' }}>
                      <canvas ref={(el) => { thumbRefs.current[t.id] = el; }} width={216} height={384} className="block w-full h-auto" />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 px-0.5">
                      <span className={`text-[12px] font-medium ${sel ? 'text-blue-400' : ''}`}>{t.name}</span>
                      <span className={`text-[9.5px] uppercase tracking-wider ${label}`}>{t.kind}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aperçu */}
          <div className={`min-w-0 flex flex-col items-center justify-center gap-3 ${isMobile ? 'order-1 shrink-0 px-3 pt-3 pb-2' : 'flex-1 p-5'}`}
            style={isMobile ? { height: 'min(62vh, 640px)' } : undefined}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragPhoto(true); } }}
            onDragLeave={() => setDragPhoto(false)}
            onDrop={(e) => { e.preventDefault(); setDragPhoto(false); loadPhoto(e.dataTransfer.files[0]); }}>
            <div className={`relative h-full max-h-full rounded-[22px] overflow-hidden shadow-2xl ring-1 ${dragPhoto ? 'ring-2 ring-blue-500' : 'ring-white/10'}`}
              style={{ aspectRatio: '9 / 16', ...(tpl.transparent ? ST_CHECKER : { background: '#111' }) }}>
              <canvas ref={previewRef} width={720} height={1280} className="block w-full h-full" />
              {!ready && <div className="absolute inset-0 grid place-items-center text-[12px] text-neutral-400">Préparation…</div>}
              {tpl.photo && !photo && (
                <button onClick={() => fileRef.current && fileRef.current.click()}
                  className="absolute left-1/2 top-[44%] -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium bg-black/60 text-white backdrop-blur hover:bg-black/75">
                  <I.Camera size={15} /> Ajouter une photo
                </button>
              )}
            </div>
            <div className={`text-[11px] ${label}`}>
              1080 × 1920 · format story{tpl.transparent ? ' · fond transparent, à poser sur ta photo ou ta vidéo' : ''}
            </div>
          </div>

          {/* Options */}
          <div className={isMobile ? `order-3 flex flex-col border-t ${sep}` : `w-[300px] shrink-0 flex flex-col border-l ${sep}`}>
            <div className={isMobile ? 'p-4 flex flex-col gap-5' : 'flex-1 overflow-y-auto sb-scroll p-4 flex flex-col gap-5'}>
              <ShareRoutesPicker allRoutes={allRoutes} included={included} setIncluded={setIncluded} dark={dark} sectionTitle={sectionTitle} label={label} />

              <div>
                <div className={sectionTitle}>Données affichées</div>
                <div className="flex flex-col gap-0.5 -mx-1">
                  {SHARE_FIELDS.map((f) => (
                    <div key={f.key}>
                      <button onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))}
                        className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-neutral-100'}`}>
                        <span>{f.label}</span>
                        <StorySwitch on={!!show[f.key]} />
                      </button>
                      {f.key === 'title' && show.title && (
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la publication" maxLength={80}
                          className={`mt-1 mb-1.5 mx-1 w-[calc(100%-8px)] h-9 rounded-md border px-2.5 text-[12.5px] outline-none ${dark ? 'border-neutral-700 bg-neutral-900/70 focus:border-neutral-500' : 'border-neutral-200 bg-white focus:border-neutral-400'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className={sectionTitle}>Couleur du tracé</div>
                <div className="flex flex-wrap gap-2">
                  {SHARE_COLORS.map((c) => (
                    <button key={c.value} title={c.label} onClick={() => setColor(c.value)}
                      className={`w-8 h-8 rounded-full grid place-items-center transition-transform hover:scale-105 ${color === c.value ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : 'ring-1 ring-white/15'}`}
                      style={{ background: c.value === 'routes' ? 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)' : c.value }}>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className={sectionTitle}>Photo de fond</div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { loadPhoto(e.target.files[0]); e.target.value = ''; }} />
                {photo ? (
                  <div className="flex items-center gap-3">
                    <img src={photo.url} alt="" className="w-14 h-14 rounded-md object-cover ring-1 ring-white/10" />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => fileRef.current.click()} className="text-[12px] font-medium text-blue-400 hover:underline text-left">Changer</button>
                      <button onClick={() => setPhoto(null)} className={`text-[12px] text-left hover:underline ${label}`}>Retirer</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current.click()}
                    className={`w-full rounded-lg border border-dashed py-3 text-[12px] flex items-center justify-center gap-2 transition-colors ${dark ? 'border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:bg-white/5' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}>
                    <I.Camera size={15} /> Choisir ou glisser une photo
                  </button>
                )}
                <p className={`mt-1.5 text-[11px] ${label}`}>Utilisée par les modèles Photo et Polaroïd.</p>
              </div>
            </div>

            {/* Actions */}
            <div className={`p-4 border-t flex flex-col gap-2 ${sep} ${isMobile ? 'sticky bottom-0 z-10 glass-strong' : ''}`}
              style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' } : undefined}>
              {canShareFiles && (
                <button onClick={doShare} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50">
                  <I.Share size={15} /> Partager en story
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={doDownload} disabled={busy}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold disabled:opacity-50 ${canShareFiles ? (dark ? 'bg-white/10 hover:bg-white/15' : 'bg-neutral-100 hover:bg-neutral-200') : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                  <I.Download size={15} /> Télécharger
                </button>
                <button onClick={doCopy} disabled={busy} title="Copier l'image"
                  className={`px-3.5 flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-medium disabled:opacity-50 ${dark ? 'bg-white/10 hover:bg-white/15' : 'bg-neutral-100 hover:bg-neutral-200'}`}>
                  Copier
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}


Object.assign(window, { StoryShareModal, StoryPane, ShareFieldRow, ShareRoutesPicker, sharePartsOf, STORY_TEMPLATES, renderStory, resolveShareRoutes, aggregateShare, shareStats });
