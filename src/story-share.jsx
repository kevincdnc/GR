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
async function stDrawTiles(ctx, provider, proj, area, layer = 'url') {
  const def = ST_TILES[provider];
  const tz = Math.max(0, Math.min(def.max, Math.round(proj.z)));
  const scale = 2 ** (proj.z - tz); // px canvas par px de tuile
  const size = 256 * scale;
  const n = 2 ** tz;
  const tx0 = Math.floor((area.x - proj.ox) / size), tx1 = Math.floor((area.x + area.w - proj.ox) / size);
  const ty0 = Math.max(0, Math.floor((area.y - proj.oy) / size)), ty1 = Math.min(n - 1, Math.floor((area.y + area.h - proj.oy) / size));
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

// Libellé + valeur (+ unité plus petite)
function stStat(ctx, s, x, y, o) {
  const { size = 88, color = '#fff', labelColor = 'rgba(255,255,255,0.75)', align = 'left', labelSize = size * 0.34 } = o;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = labelColor;
  ctx.font = stFont(500, labelSize, ST_TXT);
  ctx.fillText(s.label, x, y - size * 0.98);
  ctx.font = stFont(700, size, ST_NUM);
  const vw = ctx.measureText(s.value).width;
  ctx.font = stFont(600, size * 0.42, ST_NUM);
  const uw = s.unit ? ctx.measureText(' ' + s.unit).width : 0;
  let x0 = align === 'center' ? x - (vw + uw) / 2 : align === 'right' ? x - vw - uw : x;
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = stFont(700, size, ST_NUM);
  ctx.fillText(s.value, x0, y);
  if (s.unit) { ctx.font = stFont(600, size * 0.42, ST_NUM); ctx.fillText(' ' + s.unit, x0 + vw, y); }
}

// Grille de stats (n colonnes) dans une largeur donnée
function stStatGrid(ctx, stats, x, y, w, o) {
  const cols = o.cols || Math.min(3, Math.max(1, stats.length));
  const rowH = o.rowH || (o.size || 88) * 1.75;
  const cw = w / cols;
  stats.forEach((s, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    stStat(ctx, s, x + c * cw + (o.align === 'center' ? cw / 2 : 0), y + r * rowH, o);
  });
  return Math.ceil(stats.length / cols) * rowH;
}

// Ordonnée de la 1re rangée pour que la grille tienne au-dessus de `bottom`
function stGridY(desired, n, cols, rowH, bottom = ST_H - 90) {
  const rows = Math.max(1, Math.ceil(n / cols));
  return Math.min(desired, bottom - (rows - 1) * rowH);
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
    id: 'trace', name: 'Tracé', kind: 'Calque', transparent: true,
    async draw(ctx, d) {
      const proj = stFit(d.routes, { x: 150, y: 330, w: 780, h: 900 });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 14, casing: 'rgba(0,0,0,0.25)', casingWidth: 5, glow: 18 });
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16;
      await stDrawLogo(ctx, ST_W / 2, 170, 62, '#ffffff', 'center');
      let y = 1430;
      const t = stTitleText(d);
      if (t) {
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = stFont(700, 62, ST_TXT);
        stWrap(ctx, t, 900, 2).forEach((l) => { ctx.fillText(l, ST_W / 2, y); y += 72; });
        y += 10;
      }
      if (d.show.date && d.agg.dateLabel) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center'; ctx.font = stFont(500, 38, ST_TXT); ctx.fillText(d.agg.dateLabel, ST_W / 2, y); y += 50; }
      stStatGrid(ctx, d.stats, 90, stGridY(y + 120, d.stats.length, 3, 161), 900, { size: 92, align: 'center', cols: Math.min(3, d.stats.length || 1) });
      ctx.restore();
    },
  },
  {
    id: 'colonne', name: 'Colonne', kind: 'Calque', transparent: true,
    async draw(ctx, d) {
      const proj = stFit(d.routes, { x: 240, y: 260, w: 600, h: 1400 });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 16, markers: false });
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18;
      await stDrawLogo(ctx, ST_W / 2, 330, 70, '#ffffff', 'center');
      const items = [...d.stats];
      if (d.show.date && d.agg.dateLabel) items.push({ label: 'Date', value: d.agg.dateLabel, unit: '', small: true });
      const t = stTitleText(d);
      let y = 560;
      if (t) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = stFont(700, 52, ST_TXT); stWrap(ctx, t, 820, 2).forEach((l) => { ctx.fillText(l, ST_W / 2, y); y += 62; }); y += 40; }
      const step = Math.min(200, 1050 / Math.max(1, items.length));
      items.forEach((s, i) => {
        const yy = y + 90 + i * step;
        if (s.small) {
          ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = stFont(500, 32, ST_TXT); ctx.fillText(s.label, ST_W / 2, yy - 66);
          ctx.fillStyle = '#fff'; ctx.font = stFont(700, 54, ST_NUM); ctx.fillText(s.value, ST_W / 2, yy);
        } else stStat(ctx, s, ST_W / 2, yy, { size: 84, align: 'center', labelColor: 'rgba(255,255,255,0.85)' });
      });
      ctx.restore();
    },
  },
  {
    id: 'pastilles', name: 'Pastilles', kind: 'Calque', transparent: true,
    async draw(ctx, d) {
      const pills = [];
      if (d.show.date && d.agg.dateLabel) pills.push(d.agg.dateLabel.toUpperCase());
      d.stats.forEach((s) => pills.push(`${s.label.toUpperCase()} ${s.value}${s.unit ? ' ' + s.unit.toUpperCase() : ''}`));
      ctx.font = stFont(600, 34, ST_NUM);
      const h = 72, gap = 14, maxW = 940;
      // Rangées centrées ; logo dans la première pastille
      const logoW = 46 * 1237 / 284 + 56;
      const widths = pills.map((p) => ctx.measureText(p).width + 56);
      const rows = [[{ logo: true, w: logoW }]];
      widths.forEach((w, i) => {
        const row = rows[rows.length - 1];
        const rw = row.reduce((a, b) => a + b.w + gap, 0);
        if (rw + w > maxW) rows.push([{ i, w }]); else row.push({ i, w });
      });
      let y = 360;
      const t = stTitleText(d);
      if (t) {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = stFont(700, 56, ST_TXT);
        stWrap(ctx, t, 900, 2).forEach((l) => { ctx.fillText(l, ST_W / 2, y); y += 66; });
        ctx.restore(); y += 30;
      }
      for (const row of rows) {
        const rw = row.reduce((a, b) => a + b.w, 0) + gap * (row.length - 1);
        let x = (ST_W - rw) / 2;
        for (const cell of row) {
          stRoundRect(ctx, x, y, cell.w, h, h / 2);
          ctx.fillStyle = cell.logo ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.35)'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
          if (cell.logo) await stDrawLogo(ctx, x + cell.w / 2, y + (h - 46) / 2, 46, '#111111', 'center');
          else { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = stFont(600, 34, ST_NUM); ctx.fillText(pills[cell.i], x + cell.w / 2, y + h / 2 + 2); ctx.textBaseline = 'alphabetic'; }
          x += cell.w + gap;
        }
        y += h + gap;
      }
      const proj = stFit(d.routes, { x: 260, y: y + 90, w: 560, h: Math.max(300, 1700 - y - 90) });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 11, casing: 'rgba(255,255,255,0.9)', casingWidth: 4 });
    },
  },
  {
    id: 'photo', name: 'Photo', kind: 'Photo', photo: true,
    async draw(ctx, d) {
      if (d.photo) stCover(ctx, d.photo, 0, 0, ST_W, ST_H); else stPlaceholderPhoto(ctx, 0, 0, ST_W, ST_H);
      let g = ctx.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, ST_W, 420);
      g = ctx.createLinearGradient(0, ST_H * 0.48, 0, ST_H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = g; ctx.fillRect(0, ST_H * 0.48, ST_W, ST_H * 0.52);
      await stDrawLogo(ctx, 80, 110, 54, '#ffffff');
      // Mini tracé en haut à droite
      const proj = stFit(d.routes, { x: 760, y: 90, w: 240, h: 240 });
      stDrawRoutes(ctx, d.routes, proj, { color: '#ffffff', width: 6, markers: false, glow: 6 });
      let y = 1290;
      const t = stTitleText(d);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      if (t) { ctx.font = stFont(700, 64, ST_TXT); stWrap(ctx, t, 920, 3).forEach((l) => { ctx.fillText(l, 80, y); y += 74; }); y += 20; }
      if (d.show.date && d.agg.dateLabel) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = stFont(500, 36, ST_TXT); ctx.fillText(d.agg.dateLabel, 80, y); y += 40; }
      stStatGrid(ctx, d.stats, 80, stGridY(Math.max(y + 130, 1560), d.stats.length, 2, 175), 920, { size: 86, cols: 2, rowH: 175, labelColor: 'rgba(255,255,255,0.8)' });
    },
  },
  {
    id: 'polaroid', name: 'Polaroïd', kind: 'Photo', photo: true,
    async draw(ctx, d) {
      ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, ST_W, ST_H);
      // Cadre photo légèrement incliné
      ctx.save();
      ctx.translate(ST_W / 2, 700); ctx.rotate(-0.025);
      ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-440, -520, 880, 1060);
      ctx.shadowColor = 'transparent';
      ctx.save(); ctx.beginPath(); ctx.rect(-400, -480, 800, 860); ctx.clip();
      if (d.photo) stCover(ctx, d.photo, -400, -480, 800, 860); else stPlaceholderPhoto(ctx, -400, -480, 800, 860);
      ctx.restore();
      const t = stTitleText(d) || d.title;
      ctx.fillStyle = '#262626'; ctx.textAlign = 'center'; ctx.font = stFont(600, 46, ST_TXT);
      ctx.fillText(stWrap(ctx, t, 760, 1)[0] || '', 0, 470);
      ctx.restore();
      // Tracé + stats dessous
      const proj = stFit(d.routes, { x: 90, y: 1340, w: 300, h: 420 });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color === '#ffffff' ? '#171717' : d.color, width: 8, markers: true });
      let y = 1400;
      if (d.show.date && d.agg.dateLabel) { ctx.textAlign = 'left'; ctx.fillStyle = '#737373'; ctx.font = stFont(500, 34, ST_TXT); ctx.fillText(d.agg.dateLabel, 450, y); y += 30; }
      stStatGrid(ctx, d.stats, 450, y + 110, 560, { size: 66, cols: 2, rowH: 140, color: '#171717', labelColor: '#737373' });
      await stDrawLogo(ctx, ST_W / 2, 1810, 40, '#171717', 'center');
    },
  },
  {
    id: 'nuit', name: 'Carte nuit', kind: 'Carte',
    async draw(ctx, d) {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, ST_W, ST_H);
      const proj = stFit(d.routes, { x: 110, y: 230, w: 860, h: 1050 }, 15);
      await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w: ST_W, h: ST_H });
      await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w: ST_W, h: ST_H }, 'labels');
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 11, glow: 26 });
      await stDrawLogo(ctx, 80, 100, 54, '#ffffff');
      // Carte de stats en verre sombre
      const t = stTitleText(d);
      const rows = Math.ceil(d.stats.length / 3);
      const ch = 90 + (t ? 90 : 0) + (d.show.date && d.agg.dateLabel ? 50 : 0) + rows * 170;
      const cy = ST_H - 70 - ch;
      stRoundRect(ctx, 60, cy, ST_W - 120, ch, 36);
      ctx.fillStyle = 'rgba(10,10,10,0.72)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
      let y = cy + 90;
      ctx.textAlign = 'left';
      if (t) { ctx.fillStyle = '#fff'; ctx.font = stFont(700, 54, ST_TXT); ctx.fillText(stWrap(ctx, t, ST_W - 240, 1)[0], 110, y); y += 60; }
      if (d.show.date && d.agg.dateLabel) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = stFont(500, 34, ST_TXT); ctx.fillText(d.agg.dateLabel, 110, y); y += 50; }
      stStatGrid(ctx, d.stats, 110, y + 120, ST_W - 220, { size: 76, cols: 3, rowH: 170, labelColor: 'rgba(255,255,255,0.6)' });
    },
  },
  {
    id: 'satellite', name: 'Satellite', kind: 'Carte',
    async draw(ctx, d) {
      ctx.fillStyle = '#1f2a1f'; ctx.fillRect(0, 0, ST_W, ST_H);
      const proj = stFit(d.routes, { x: 120, y: 260, w: 840, h: 1050 }, 16);
      await stDrawTiles(ctx, 'satellite', proj, { x: 0, y: 0, w: ST_W, h: ST_H });
      let g = ctx.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, ST_W, 380);
      g = ctx.createLinearGradient(0, ST_H * 0.6, 0, ST_H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g; ctx.fillRect(0, ST_H * 0.6, ST_W, ST_H * 0.4);
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 10, casing: '#ffffff', casingWidth: 4 });
      await stDrawLogo(ctx, 80, 100, 54, '#ffffff');
      let y = 1470;
      const t = stTitleText(d);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      if (t) { ctx.font = stFont(700, 60, ST_TXT); stWrap(ctx, t, 920, 2).forEach((l) => { ctx.fillText(l, 80, y); y += 70; }); }
      if (d.show.date && d.agg.dateLabel) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = stFont(500, 36, ST_TXT); ctx.fillText(d.agg.dateLabel, 80, y); y += 30; }
      stStatGrid(ctx, d.stats, 80, stGridY(Math.max(y + 130, 1700), d.stats.length, 3, 160), 920, { size: 80, cols: 3, rowH: 160 });
    },
  },
  {
    id: 'carte', name: 'Carte claire', kind: 'Carte',
    async draw(ctx, d) {
      ctx.fillStyle = '#eef2ee'; ctx.fillRect(0, 0, ST_W, ST_H);
      const proj = stFit(d.routes, { x: 110, y: 200, w: 860, h: 1080 }, 16);
      await stDrawTiles(ctx, 'topo', proj, { x: 0, y: 0, w: ST_W, h: ST_H });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color === '#ffffff' ? '#fc5200' : d.color, width: 11, casing: '#ffffff', casingWidth: 4 });
      // Bandeau blanc arrondi en bas
      const t = stTitleText(d);
      const rows = Math.ceil(d.stats.length / 3);
      const ch = 110 + (t ? 80 : 0) + (d.show.date && d.agg.dateLabel ? 50 : 0) + rows * 165;
      const cy = ST_H - ch;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 40;
      stRoundRect(ctx, 0, cy, ST_W, ch + 60, 48); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
      let y = cy + 100;
      ctx.textAlign = 'left';
      if (t) { ctx.fillStyle = '#171717'; ctx.font = stFont(700, 54, ST_TXT); ctx.fillText(stWrap(ctx, t, 640, 1)[0], 80, y); y += 54; }
      if (d.show.date && d.agg.dateLabel) { ctx.fillStyle = '#737373'; ctx.font = stFont(500, 34, ST_TXT); ctx.fillText(d.agg.dateLabel, 80, y); y += 40; }
      await stDrawLogo(ctx, ST_W - 80, cy + 55, 42, '#171717', 'right');
      stStatGrid(ctx, d.stats, 80, y + 120, ST_W - 160, { size: 74, cols: 3, rowH: 165, color: '#171717', labelColor: '#737373' });
    },
  },
  {
    id: 'affiche', name: 'Affiche', kind: 'Graphique',
    async draw(ctx, d) {
      const bg = '#14251d', ink = '#efe6d2';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, ST_W, ST_H);
      ctx.strokeStyle = 'rgba(239,230,210,0.35)'; ctx.lineWidth = 3; ctx.strokeRect(50, 50, ST_W - 100, ST_H - 100);
      await stDrawLogo(ctx, ST_W / 2, 110, 44, ink, 'center');
      // Gros chiffre : distance
      ctx.fillStyle = ink; ctx.textAlign = 'center';
      ctx.font = stFont(800, 230, ST_LOGO);
      ctx.fillText(stNum(d.agg.distance, d.agg.distance >= 100 ? 0 : 1), ST_W / 2, 470);
      ctx.font = stFont(600, 44, ST_TXT); ctx.fillText('KILOMÈTRES', ST_W / 2, 545);
      const proj = stFit(d.routes, { x: 160, y: 640, w: 760, h: 760 });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color === 'routes' ? '#e8813a' : d.color, width: 10, markers: false });
      let y = 1500;
      const t = stTitleText(d);
      if (t) { ctx.fillStyle = ink; ctx.font = stFont(700, 54, ST_TXT); stWrap(ctx, t.toUpperCase(), 900, 2).forEach((l) => { ctx.fillText(l, ST_W / 2, y); y += 64; }); }
      if (d.show.date && d.agg.dateLabel) { ctx.fillStyle = 'rgba(239,230,210,0.7)'; ctx.font = stFont(500, 34, ST_TXT); ctx.fillText(d.agg.dateLabel, ST_W / 2, y); y += 20; }
      const rest = d.stats.filter((s) => s.key !== 'distance');
      if (rest.length) {
        ctx.strokeStyle = 'rgba(239,230,210,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(140, y + 30); ctx.lineTo(ST_W - 140, y + 30); ctx.stroke();
        stStatGrid(ctx, rest, 120, stGridY(Math.max(y + 170, 1720), rest.length, 3, 140, ST_H - 110), ST_W - 240, { size: 66, cols: Math.min(3, rest.length), align: 'center', rowH: 140, color: ink, labelColor: 'rgba(239,230,210,0.65)' });
      }
    },
  },
  {
    id: 'profil', name: 'Profil', kind: 'Graphique',
    async draw(ctx, d) {
      const g = ctx.createLinearGradient(0, 0, 0, ST_H); g.addColorStop(0, '#0b1220'); g.addColorStop(1, '#16213a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, ST_W, ST_H);
      const accent = d.color === 'routes' ? (d.routes[0] ? d.routes[0].color : '#3b82f6') : d.color;
      await stDrawLogo(ctx, 80, 100, 50, '#ffffff');
      let y = 300;
      const t = stTitleText(d);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      if (t) { ctx.font = stFont(700, 60, ST_TXT); stWrap(ctx, t, 920, 2).forEach((l) => { ctx.fillText(l, 80, y); y += 70; }); }
      if (d.show.date && d.agg.dateLabel) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = stFont(500, 36, ST_TXT); ctx.fillText(d.agg.dateLabel, 80, y); y += 40; }
      // Profil d'altitude
      const pts = stProfile(d.routes);
      // Stats ancrées en bas, profil juste au-dessus
      const statsY = stGridY(1800, d.stats.length, 3, 150);
      const px0 = 0, px1 = ST_W, py1 = statsY - 210, py0 = py1 - 360;
      const rTop = Math.max(y + 40, 380);
      const proj = stFit(d.routes, { x: 180, y: rTop, w: 720, h: Math.max(240, py0 - 110 - rTop) });
      stDrawRoutes(ctx, d.routes, proj, { color: d.color, width: 9, glow: 14 });
      if (pts.length > 1) {
        const maxD = pts[pts.length - 1].d || 1;
        let lo = Infinity, hi = -Infinity; pts.forEach((p) => { lo = Math.min(lo, p.e); hi = Math.max(hi, p.e); });
        const span = Math.max(30, hi - lo);
        const X = (dd) => px0 + (dd / maxD) * (px1 - px0);
        const Y = (e) => py1 - ((e - lo) / span) * (py1 - py0);
        const step = 1;
        ctx.beginPath(); ctx.moveTo(X(0), py1 + 60);
        for (let i = 0; i < pts.length; i += step) ctx.lineTo(X(pts[i].d), Y(pts[i].e));
        ctx.lineTo(X(maxD), Y(pts[pts.length - 1].e)); ctx.lineTo(X(maxD), py1 + 60); ctx.closePath();
        const fg = ctx.createLinearGradient(0, py0, 0, py1 + 60); fg.addColorStop(0, accent + 'cc'); fg.addColorStop(1, accent + '00');
        ctx.fillStyle = fg; ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += step) { const x = X(pts[i].d), yy = Y(pts[i].e); if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
        ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = stFont(600, 32, ST_NUM); ctx.textAlign = 'left';
        ctx.fillText(`Alt. max ${Math.round(hi)} m`, 80, py0 - 40);
        ctx.textAlign = 'right'; ctx.fillText(`${stNum(maxD)} km`, ST_W - 80, py0 - 40);
      }
      stStatGrid(ctx, d.stats, 80, statsY, 920, { size: 76, cols: Math.min(3, d.stats.length || 1), rowH: 150 });
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

function StoryShareModal({ parts, title: initialTitle, dark, onClose, onToast }) {
  const allRoutes = useStMemo(() => resolveShareRoutes(parts), [parts]);
  const [included, setIncluded] = useStState(() => new Set(allRoutes.map((r) => r.id)));
  const routes = useStMemo(() => allRoutes.filter((r) => included.has(r.id)), [allRoutes, included]);
  const agg = useStMemo(() => aggregateShare(routes), [routes]);
  const [tplId, setTplId] = useStState('trace');
  const [show, setShow] = useStState(() => Object.fromEntries(SHARE_FIELDS.map((f) => [f.key, f.def])));
  const [title, setTitle] = useStState(initialTitle || '');
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

  // Échap pour fermer
  useStEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-menu" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`glass-strong rounded-xl shadow-2xl flex flex-col overflow-hidden ${strong}`} style={{ width: 'min(1240px, 98vw)', height: 'min(860px, 96vh)' }}>
        {/* En-tête */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${dark ? 'border-white/10' : 'border-neutral-200'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 grid place-items-center rounded-lg bg-blue-500/15 text-blue-400"><I.Share size={16} /></span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-tight">Partager</div>
              <div className={`text-[12px] truncate ${label}`}>
                {routes.length} tracé{routes.length > 1 ? 's' : ''} · {stNum(agg.distance)} km · {stNum(agg.ascent, 0)} m D+
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className={`w-8 h-8 grid place-items-center rounded-md transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-500 hover:bg-neutral-100'}`}>
            <I.X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Modèles */}
          <div className={`w-[248px] shrink-0 overflow-y-auto sb-scroll p-4 border-r ${dark ? 'border-white/10' : 'border-neutral-200'}`}>
            <div className={sectionTitle}>Modèles</div>
            <div className="grid grid-cols-2 gap-2.5">
              {STORY_TEMPLATES.map((t) => {
                const sel = t.id === tplId;
                return (
                  <button key={t.id} onClick={() => setTplId(t.id)} className="text-left group">
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
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-5 gap-3"
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
          <div className={`w-[300px] shrink-0 flex flex-col border-l ${dark ? 'border-white/10' : 'border-neutral-200'}`}>
            <div className="flex-1 overflow-y-auto sb-scroll p-4 flex flex-col gap-5">
              {multi && (
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
              )}

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
            <div className={`p-4 border-t flex flex-col gap-2 ${dark ? 'border-white/10' : 'border-neutral-200'}`}>
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
      </div>
    </div>
  );
}

Object.assign(window, { StoryShareModal, sharePartsOf, STORY_TEMPLATES, renderStory, resolveShareRoutes, aggregateShare, shareStats });
