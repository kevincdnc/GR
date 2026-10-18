// Studio poster : affiches imprimables de tes tracés (trek, marathon, road trip
// moto, tour à vélo…). 6 modèles, formats papier (A4 → 50×70), cadres, photos
// du voyage, métriques adaptées à l'activité.
// Même moteur canvas que les stories (story-share.jsx) : un modèle dessine dans
// une zone w×h en unités de dessin (largeur 1200) ; l'export rééchantillonne à
// ~300 dpi et va chercher des tuiles de carte plus détaillées.

const { useState: usePoState, useEffect: usePoEffect, useMemo: usePoMemo, useRef: usePoRef } = React;

const PO_W = 1200;
const PO_SERIF = '"Playfair Display", Georgia, serif';
const PO_FELL = '"IM Fell English", Georgia, serif';

const POSTER_FORMATS = [
  { id: 'a4', name: 'A4', sub: '21 × 29,7 cm', mm: [210, 297] },
  { id: 'a3', name: 'A3', sub: '29,7 × 42 cm', mm: [297, 420] },
  { id: 'a2', name: 'A2', sub: '42 × 59,4 cm', mm: [420, 594] },
  { id: '30x40', name: '30 × 40', sub: 'cm', mm: [300, 400] },
  { id: '50x70', name: '50 × 70', sub: 'cm', mm: [500, 700] },
];
const poHeight = (f) => Math.round(PO_W * f.mm[1] / f.mm[0]);
// Taille d'export : 300 dpi, plafonnée à 6000 px sur le grand côté
function poExportSize(f) {
  const longPx = Math.min(6000, Math.round(f.mm[1] / 25.4 * 300));
  const w = Math.round(longPx * f.mm[0] / f.mm[1]);
  return { w, h: longPx, dpi: Math.round(longPx / (f.mm[1] / 25.4)) };
}

const POSTER_BORDERS = [
  { id: 'none', name: 'Aucune' },
  { id: 'fine', name: 'Liseré' },
  { id: 'marge', name: 'Marge blanche' },
  { id: 'passe', name: 'Passe-partout' },
];
const POSTER_MOCKUPS = [
  { id: 'none', name: 'Sans', swatch: 'transparent' },
  { id: 'noir', name: 'Noir', swatch: '#151515' },
  { id: 'chene', name: 'Chêne', swatch: 'linear-gradient(135deg,#c8a47a,#a57c52 55%,#8a6440)' },
  { id: 'blanc', name: 'Blanc', swatch: '#f4f4f2' },
  { id: 'alu', name: 'Alu', swatch: 'linear-gradient(135deg,#d9dbde,#9ea3a8 50%,#c9ccd0)' },
];
const PO_MOCK_STYLE = {
  noir: { border: '#151515', shadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' },
  chene: { border: 'linear-gradient(135deg,#c8a47a,#a57c52 55%,#8a6440)' },
  blanc: { border: '#f4f4f2', shadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' },
  alu: { border: 'linear-gradient(135deg,#e2e4e7,#9ea3a8 50%,#cfd2d6)' },
};

// ---------------------------------------------------------------- activités & métriques
const PO_METRICS = {
  distance: 'Distance', ascent: 'Dénivelé +', descent: 'Dénivelé −', duration: 'Durée',
  pace: 'Allure', speed: 'Vitesse moy.', altMax: 'Altitude max', stages: 'Étapes',
  // Infos propres à certains modèles (liste `infos` du modèle)
  activity: 'Activité', start: 'Départ (GPS)',
};
const PO_ACTIVITIES = [
  { id: 'hiking', label: 'Randonnée', icon: 'Footprints', est: 'hiking', metrics: ['distance', 'ascent', 'duration'], avail: ['distance', 'ascent', 'descent', 'duration', 'altMax', 'stages', 'speed'] },
  { id: 'trail', label: 'Trail', icon: 'Run', est: 'trail', metrics: ['distance', 'ascent', 'duration', 'pace'], avail: ['distance', 'ascent', 'descent', 'duration', 'pace', 'altMax'] },
  { id: 'running', label: 'Course · Marathon', icon: 'Run', est: 'running', metrics: ['distance', 'duration', 'pace'], avail: ['distance', 'duration', 'pace', 'ascent', 'speed'] },
  { id: 'cycling', label: 'Vélo route', icon: 'RoadBike', est: 'cycling', metrics: ['distance', 'ascent', 'duration', 'speed'], avail: ['distance', 'ascent', 'descent', 'duration', 'speed', 'altMax', 'stages'] },
  { id: 'mtb', label: 'VTT', icon: 'MountainBike', est: 'mtb', metrics: ['distance', 'ascent', 'duration', 'speed'], avail: ['distance', 'ascent', 'descent', 'duration', 'speed', 'altMax'] },
  { id: 'gravel', label: 'Bikepacking', icon: 'MountainBike', est: 'gravel', metrics: ['distance', 'ascent', 'stages', 'speed'], avail: ['distance', 'ascent', 'descent', 'duration', 'speed', 'altMax', 'stages'] },
  { id: 'moto', label: 'Road trip moto', icon: 'Moto', est: 'moto', metrics: ['distance', 'stages', 'duration', 'altMax'], avail: ['distance', 'stages', 'duration', 'altMax', 'speed', 'ascent'] },
  { id: 'ski', label: 'Ski de rando', icon: 'Ski', est: 'skiTouring', metrics: ['distance', 'ascent', 'duration', 'altMax'], avail: ['distance', 'ascent', 'descent', 'duration', 'altMax'] },
];
const poActivity = (id) => PO_ACTIVITIES.find((a) => a.id === id) || PO_ACTIVITIES[0];
function poActivityOf(routes) {
  const a = routes[0] && routes[0].activity;
  const map = { hiking: 'hiking', trail: 'trail', running: 'running', cycling: 'cycling', mtb: 'mtb', gravel: 'gravel', skiTouring: 'ski', skiNordic: 'ski', snowshoe: 'hiking' };
  return map[a] || 'hiking';
}
function poPace(min, km) {
  if (!km || !min) return '—';
  const p = min / km; let m = Math.floor(p), s = Math.round((p - m) * 60);
  if (s === 60) { m++; s = 0; }
  return `${m}'${String(s).padStart(2, '0')}"`;
}
// Agrégat recalculé pour l'activité (durées estimées selon l'activité)
function poAggregate(routes, act) {
  const rs = routes.map((r) => ({ ...r, durationMin: r.durationReal ? r.durationMin : estimateDurationMin(r.distance, r.ascent, act.est) }));
  const sum = (k) => rs.reduce((a, r) => a + (r[k] || 0), 0);
  const distance = sum('distance'), durationMin = sum('durationMin');
  const alts = rs.map((r) => r.altMax).filter((v) => v != null);
  return {
    count: rs.length, distance, ascent: sum('ascent'), descent: sum('descent'), durationMin,
    speed: durationMin > 0 ? distance / (durationMin / 60) : 0,
    altMax: alts.length ? Math.max(...alts) : null,
    dateLabel: stDateLabel(rs.map((r) => r.date)),
  };
}
function poStats(agg, keys, x = {}) {
  const out = [];
  keys.forEach((k) => {
    const label = PO_METRICS[k];
    if (k === 'distance') out.push({ key: k, label, value: stNum(agg.distance, agg.distance >= 100 ? 0 : 1), unit: 'km' });
    if (k === 'ascent') out.push({ key: k, label, value: stNum(agg.ascent, 0), unit: 'm' });
    if (k === 'descent') out.push({ key: k, label, value: stNum(agg.descent, 0), unit: 'm' });
    if (k === 'duration') out.push({ key: k, label, value: stDuration(agg.durationMin), unit: '' });
    if (k === 'pace') out.push({ key: k, label, value: poPace(agg.durationMin, agg.distance), unit: '/km' });
    if (k === 'speed') out.push({ key: k, label, value: stNum(agg.speed), unit: 'km/h' });
    if (k === 'altMax' && agg.altMax != null) out.push({ key: k, label, value: stNum(agg.altMax, 0), unit: 'm' });
    if (k === 'stages') out.push({ key: k, label, value: String(agg.count), unit: '' });
    if (k === 'activity' && x.activity) out.push({ key: k, label, value: x.activity, unit: '' });
    if (k === 'start' && x.start) out.push({ key: k, label, short: 'Départ', value: poDms(x.start[0], 'N', 'S') + '  ' + poDms(x.start[1], 'E', 'O'), unit: '' });
  });
  return out;
}

// ---------------------------------------------------------------- utilitaires de dessin
// Colonnes de chiffres : une seule ligne jusqu'à 5, puis grille de 3
function poCols(n) { return n <= 5 ? Math.max(1, n) : 3; }
function poCol(d, native) { return d.color === 'auto' ? native : d.color; }
function poOne(d, native) {
  if (d.color === 'auto') return native;
  if (d.color === 'routes') return (d.routes[0] && d.routes[0].color) || native;
  return d.color;
}
function poDms(v, pos, neg) {
  const a = Math.abs(v), deg = Math.floor(a), min = (a - deg) * 60;
  return `${deg}°${min.toFixed(1).replace('.', ',')}′ ${v >= 0 ? pos : neg}`;
}
function poCoords(d) {
  const r = d.routes[0]; if (!r) return '';
  const c = r.coords[0];
  return `${poDms(c[0], 'N', 'S')}  ·  ${poDms(c[1], 'E', 'O')}`;
}
function poFont(weight, size, family, italic) { return `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px ${family}`; }
// Titre sur une ligne, réduit pour tenir dans maxW ; renvoie la taille utilisée
function poLine(ctx, text, x, y, maxW, size, color, o = {}) {
  const t = o.upper ? String(text || '').toUpperCase() : String(text || '');
  if (!t) return 0;
  const fam = o.family || ST_TXT, wt = o.weight || 700, sp = o.spacing || 0;
  const width = (sz) => { ctx.font = poFont(wt, sz, fam, o.italic); return ctx.measureText(t).width + sp * sz * Math.max(0, [...t].length - 1); };
  let sz = size; const w0 = width(sz); if (w0 > maxW) sz = sz * maxW / w0;
  ctx.font = poFont(wt, sz, fam, o.italic); ctx.fillStyle = color;
  if (sp) stSpaced(ctx, t, x, y, sp * sz, o.align || 'left');
  else { ctx.textAlign = o.align || 'left'; ctx.fillText(t, x, y); }
  return sz;
}
// Titre sur plusieurs lignes (taille fixe) ; renvoie la hauteur
function poLines(ctx, text, x, y, maxW, size, color, o = {}) {
  const t = o.upper ? String(text || '').toUpperCase() : String(text || '');
  if (!t) return 0;
  ctx.font = poFont(o.weight || 700, size, o.family || ST_TXT, o.italic); ctx.fillStyle = color; ctx.textAlign = o.align || 'left';
  const lines = stWrap(ctx, t, maxW, o.maxLines || 3);
  const lh = size * (o.lh || 1.04);
  lines.forEach((l, i) => ctx.fillText(l, x, y + size * 0.82 + i * lh));
  return lines.length * lh;
}
function poLinesHeight(ctx, text, maxW, size, o = {}) {
  const t = o.upper ? String(text || '').toUpperCase() : String(text || '');
  if (!t) return 0;
  ctx.font = poFont(o.weight || 700, size, o.family || ST_TXT, o.italic);
  return stWrap(ctx, t, maxW, o.maxLines || 3).length * size * (o.lh || 1.04);
}
// Échelle graphique (km) sous une projection Web Mercator
function poScale(d, proj, maxW) {
  const r = d.routes[0]; if (!r) return null;
  const mPerUnit = 156543.03392 * Math.cos(r.coords[0][0] * Math.PI / 180) / proj.k;
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
  const m = steps.filter((s) => s <= maxW * mPerUnit).pop() || steps[0];
  return { m, len: m / mPerUnit, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
}
function poScaleBar(ctx, d, proj, x, y, maxW, color, u = 1) {
  const s = poScale(d, proj, maxW); if (!s) return;
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2 * u;
  ctx.fillRect(x, y, s.len / 2, 6 * u);
  ctx.strokeRect(x, y, s.len, 6 * u);
  ctx.font = stFont(600, 18 * u, ST_NUM); ctx.textAlign = 'left';
  ctx.fillText(s.label, x + s.len + 12 * u, y + 8 * u);
}
function poRound(ctx, x, y, w, h, r) { if (r > 0) stRoundRect(ctx, x, y, w, h, Math.min(r, w / 2, h / 2)); else { ctx.beginPath(); ctx.rect(x, y, w, h); } }
// Photos du voyage : une rangée (ou une grille 2×2) de photos recadrées
function poPhotos(ctx, photos, x, y, w, h, o = {}) {
  const n = photos.length; if (!n) return;
  const gap = o.gap != null ? o.gap : 16;
  const grid = o.grid && n === 4;
  const cols = grid ? 2 : n, rows = grid ? 2 : 1;
  let cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  if (o.maxRatio && cw > ch * o.maxRatio) cw = ch * o.maxRatio;
  const total = cw * cols + gap * (cols - 1);
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x + w - total : x + (w - total) / 2;
  photos.forEach((p, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const px = x0 + c * (cw + gap), py = y + r * (ch + gap);
    const b = o.border || 0;
    ctx.save();
    if (o.rotate) { const a = ((i % 2 ? 1 : -1) * o.rotate * (1 + (i % 3) * 0.4)) * Math.PI / 180; ctx.translate(px + cw / 2, py + ch / 2); ctx.rotate(a); ctx.translate(-(px + cw / 2), -(py + ch / 2)); }
    if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = o.shadow; ctx.shadowOffsetY = o.shadow * 0.35; }
    if (b) { poRound(ctx, px, py, cw, ch, o.radius || 0); ctx.fillStyle = o.borderColor || '#fff'; ctx.fill(); }
    ctx.shadowColor = 'transparent';
    poRound(ctx, px + b, py + b, cw - 2 * b, ch - 2 * b, Math.max(0, (o.radius || 0) - b)); ctx.clip();
    stCover(ctx, p.img, px + b, py + b, cw - 2 * b, ch - 2 * b);
    if (o.sepia && !ctx.__isSvg) {
      ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#8a6a3e'; ctx.fillRect(px, py, cw, ch);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(234,217,181,0.55)'; ctx.fillRect(px, py, cw, ch);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (o.tape) {
      ctx.save(); ctx.translate(px + cw / 2, py + 2); ctx.rotate((i % 2 ? 4 : -3) * Math.PI / 180);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-cw * 0.18, -10 * (o.u || 1), cw * 0.36, 22 * (o.u || 1));
      ctx.restore();
    }
  });
}
// Statistiques empilées (étiquette + valeur), colonne
function poStack(ctx, stats, x, y, w, h, o = {}) {
  if (!stats.length) return;
  const step = h / stats.length;
  stats.forEach((s, i) => {
    const yy = y + i * step;
    if (o.rule) { ctx.fillStyle = o.rule; ctx.fillRect(x, yy, w, Math.max(1, (o.u || 1) * 2)); }
    stLabel(ctx, s.label, x, yy + (o.labelSize || 18) * 1.9, o.labelSize || 18, o.labelColor || '#777');
    let sz = Math.min(o.maxSize || 90, step * 0.5); const vw = stValueWidth(ctx, s, sz); if (vw > w) sz *= w / vw;
    stValue(ctx, s, x, yy + (o.labelSize || 18) * 2.6 + sz * 0.8, sz, o.color || '#111');
  });
}
// Placeholder « ajoute ta photo » (modèles à photo de fond)
function poPhotoBg(ctx, d, x, y, w, h) {
  if (d.bgPhoto) { stCover(ctx, d.bgPhoto, x, y, w, h); return; }
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#2b3a4a'); g.addColorStop(0.5, '#3d5566'); g.addColorStop(1, '#1d2731');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.75); ctx.lineTo(x + w * 0.28, y + h * 0.48); ctx.lineTo(x + w * 0.46, y + h * 0.62);
  ctx.lineTo(x + w * 0.72, y + h * 0.36); ctx.lineTo(x + w, y + h * 0.58); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill();
  ctx.restore();
}
// Bruit déterministe (texture papier)
function poSpeckle(ctx, x, y, w, h, n, color, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) { const r = rnd() * 1.6 + 0.3; ctx.globalAlpha = 0.04 + rnd() * 0.1; ctx.beginPath(); ctx.arc(x + rnd() * w, y + rnd() * h, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
// Inverse de la projection (lat/lng d'un point du dessin)
function poUnproj(proj, x, y) {
  const mx = (x - proj.ox) / proj.k, my = (y - proj.oy) / proj.k;
  const lng = mx / 256 * 360 - 180;
  const n = Math.PI - 2 * Math.PI * my / 256;
  return [180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng];
}

// Logo Printrace (produit posters) : SVG vectoriel recoloré selon le modèle
const PO_LOGO_SVG = '<svg width="1236" height="335" viewBox="0 0 1236 335" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M112.422 81.6821C145.713 81.6821 167.992 105.242 167.992 135.972C167.992 177.714 133.933 210.237 90.6545 210.237H61.7168L51.4733 260.942H3.84129L39.6933 81.6821H112.422ZM90.9106 170.032C107.812 170.032 119.336 155.947 119.336 139.814C119.336 128.802 112.934 121.888 100.898 121.888H79.3867L69.6554 170.032H90.9106ZM268.294 122.144H281.611L273.16 164.398H255.234C238.076 164.398 229.625 171.312 225.528 188.214L210.931 260.942H165.091L192.749 122.656H223.223L227.064 136.997C238.844 126.497 252.161 122.144 268.294 122.144ZM303.358 105.498L311.297 66.0609H357.392L349.453 105.498H303.358ZM272.628 260.942L300.285 122.656H346.124L318.467 260.942H272.628ZM459.526 118.302C486.416 118.302 502.293 136.485 502.293 163.63C502.293 175.154 500.5 181.044 484.623 260.942H438.784C453.893 185.141 455.173 181.044 455.173 175.666C455.173 164.91 449.795 159.276 439.808 159.276C424.699 159.276 413.943 169.52 409.846 186.934L394.993 260.942H349.153L376.811 122.656H408.821L412.407 136.741C424.699 125.217 441.344 118.302 459.526 118.302ZM623.862 161.325H588.522C580.583 200.25 580.071 203.835 580.071 206.396C580.071 215.103 585.449 219.713 595.436 219.713H612.338L604.143 260.942H578.278C549.597 260.942 532.695 244.809 532.695 219.2C532.695 211.518 533.976 206.396 542.939 161.325H516.818L519.122 150.569L594.412 82.4504H603.887L595.692 122.656H631.544L623.862 161.325ZM730.45 122.144H743.766L735.315 164.398H717.389C700.231 164.398 691.781 171.312 687.683 188.214L673.086 260.942H627.247L654.904 122.656H685.378L689.22 136.997C701 126.497 714.316 122.144 730.45 122.144ZM872.587 122.656H907.415L879.758 260.942H847.235L844.93 250.443C831.87 259.918 815.992 265.552 799.347 265.552C764.263 265.552 738.398 240.968 738.398 203.579C738.398 154.411 777.067 118.302 821.882 118.302C838.784 118.302 853.637 124.705 864.137 136.228L872.587 122.656ZM811.127 224.066C831.614 224.066 849.027 205.884 849.027 185.141C849.027 169.776 838.528 159.532 822.394 159.532C802.164 159.532 785.006 177.458 785.006 198.713C785.006 214.079 795.249 224.066 811.127 224.066ZM979.729 265.552C941.316 265.552 915.708 238.151 915.708 202.811C915.708 154.667 954.121 118.302 1003.29 118.302C1041.45 118.302 1066.29 144.935 1066.03 178.739H1020.96C1018.4 166.703 1009.44 159.788 996.887 159.788C976.912 159.788 961.547 179.251 961.803 199.482C962.059 214.591 971.791 223.81 985.619 223.81C998.424 223.81 1009.95 216.383 1016.86 203.323H1061.93C1049.64 243.016 1018.14 265.552 979.729 265.552ZM1226.08 179.251C1226.33 187.958 1224.8 195.128 1222.75 203.067H1119.29C1119.29 219.456 1128.25 227.907 1144.64 227.907C1156.17 227.907 1166.15 222.786 1172.3 214.079H1218.91C1204.57 246.602 1174.09 265.552 1138.5 265.552C1101.36 265.552 1076.01 237.895 1076.01 202.811C1076.01 155.179 1111.86 118.302 1162.06 118.302C1200.73 118.302 1226.08 144.679 1226.08 179.251ZM1157.45 154.923C1142.34 154.923 1131.33 164.142 1124.92 176.69H1183.06C1181.26 162.349 1172.3 154.923 1157.45 154.923Z" fill="white" fill-opacity="0.98"/><path d="M502.983 101.001C502.983 101.001 617 -35.0894 628.983 26.4988C640.967 88.087 673.482 20.8826 703.482 98.1606" stroke-width="21" stroke="white" stroke-opacity="0.6"/></svg>';
const poLogoCache = {};
function poLogo(color) {
  if (!poLogoCache[color]) {
    const svg = PO_LOGO_SVG.replace(/fill="white"/g, `fill="${color}"`).replace(/stroke="white"/g, `stroke="${color}"`);
    poLogoCache[color] = stLoadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), false);
  }
  return poLogoCache[color];
}
// h = hauteur visuelle souhaitée (comme stDrawLogo) ; la boîte du SVG a de la marge en haut
async function poDrawLogo(ctx, x, y, h, color = '#ffffff', align = 'left') {
  const img = await poLogo(color);
  const bh = h * 1.3, bw = bh * 1236 / 335;
  const yy = y - (bh - h) * 0.55;
  if (img) {
    const xx = align === 'center' ? x - bw / 2 : align === 'right' ? x - bw : x;
    ctx.drawImage(img, xx, yy, bw, bh);
  } else {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = stFont(800, h, ST_TXT); ctx.fillText('printrace', x, y + h * 0.8);
  }
}

// Carte vectorielle (poster-map.jsx) aux couleurs du modèle
async function poMap(ctx, d, proj, rect, pal, o = {}) {
  // Carte et noms de villes s'affichent indépendamment l'une de l'autre
  if ((!d.showMap && !d.mapLabels) || typeof pmDrawMap !== 'function') return false;
  try {
    return await pmDrawMap(ctx, { proj, rect, pal, style: d.mapStyle || 'epure', opacity: d.mapOpacity == null ? 1 : d.mapOpacity,
      geometry: !!d.showMap, labels: !!d.mapLabels, routes: d.routes, ...o });
  } catch (e) { console.warn('carte vectorielle', e); return false; }
}
// Mélange de deux couleurs hex (t = part de b)
function poMix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// Palette de carte « plan » dérivée de la couleur de fond (routes discrètes)
function poBlueprintPal(bg) {
  const W = '#ffffff';
  return {
    land: poMix(bg, W, 0.07), water: poMix(bg, '#000000', 0.14), coast: poMix(bg, W, 0.55), coastWidth: 1.2,
    road: poMix(bg, W, 0.13), roadMajor: poMix(bg, W, 0.22), path: poMix(bg, W, 0.15), waterway: poMix(bg, W, 0.24),
    wood: poMix(bg, W, 0.1), park: poMix(bg, W, 0.1),
    label: { color: 'rgba(255,255,255,0.9)', halo: bg, haloWidth: 3.5, upper: true, spacing: 0.14, weight: 600, dot: '#ffffff' },
  };
}
// Fonds sombres proposés (rendu sûr à l'impression : blanc et tracé clair ressortent)
const PO_DARK_BGS = [
  { hex: '#141414', name: 'Noir' }, { hex: '#103c6b', name: 'Bleu marine' }, { hex: '#0f1d33', name: 'Bleu nuit' }, { hex: '#1e2a33', name: 'Ardoise' },
  { hex: '#15362b', name: 'Vert forêt' }, { hex: '#3a1420', name: 'Bordeaux' }, { hex: '#2b2140', name: 'Aubergine' },
];
// Boussole minimale : anneau fin, aiguille losange, points cardinaux
function poCompass(ctx, x, y, R, u, color, bg) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
  // Aiguille : nord plein, sud au trait
  const nl = R * 0.7, wd = R * 0.17;
  ctx.beginPath(); ctx.moveTo(x, y - nl); ctx.lineTo(x + wd, y); ctx.lineTo(x - wd, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bg || '#000000'; ctx.lineWidth = 1 * u;
  ctx.beginPath(); ctx.moveTo(x, y + nl); ctx.lineTo(x + wd, y); ctx.lineTo(x - wd, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  [['N', 0], ['E', 1], ['S', 2], ['O', 3]].forEach(([t, k]) => {
    const r = k * Math.PI / 2, sz = t === 'N' ? 13 * u : 10.5 * u, dd = R + 12 * u;
    ctx.globalAlpha = t === 'N' ? 1 : 0.75;
    ctx.font = stFont(t === 'N' ? 700 : 600, sz, ST_TXT); ctx.textAlign = 'center';
    ctx.fillText(t, x + Math.sin(r) * dd, y - Math.cos(r) * dd + sz * 0.36);
  });
  ctx.restore();
}
// Marqueurs départ / arrivée : même pastille (anneau + point) aux deux bouts
function poStartEnd(ctx, d, proj, u, color, bg) {
  if (!d.routes.length) return;
  const a = d.routes[0].coords[0], lr = d.routes[d.routes.length - 1], b = lr.coords[lr.coords.length - 1];
  ctx.save();
  [a, b].forEach((c) => {
    const [x, y] = proj.px(c[0], c[1]);
    ctx.beginPath(); ctx.arc(x, y, 11 * u, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 3 * u; ctx.strokeStyle = color; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 4 * u, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  });
  ctx.restore();
}
// Photo factice (aperçu seulement) : cadre en pointillés discret avec un croquis
function poPhotoPlaceholder(ctx, x, y, w, h, u, bg, onSlot) {
  const pw = Math.min(w, h * 1.25) * 0.86, ph = h * 0.86;
  const ox = x + (Math.min(w, h * 1.25) - pw) / 2, oy = y + (h - ph) / 2;
  // Position à l'écran (px du canvas) pour y poser le bouton « Ajouter une photo »
  if (onSlot && ctx.getTransform) { const m = ctx.getTransform(); onSlot({ x: m.a * ox + m.e, y: m.d * oy + m.f, w: m.a * pw, h: m.d * ph }); }
  ctx.save();
  ctx.translate(ox + pw / 2, oy + ph / 2); ctx.rotate(-1.5 * Math.PI / 180); ctx.translate(-pw / 2, -ph / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, pw, ph);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.4 * u;
  ctx.setLineDash && ctx.setLineDash([6 * u, 5 * u]); ctx.strokeRect(0, 0, pw, ph); ctx.setLineDash && ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.6 * u; ctx.lineJoin = 'round';
  // Croquis dans la moitié haute : le bouton « Ajouter une photo » se pose en dessous
  ctx.beginPath(); ctx.arc(pw * 0.68, ph * 0.24, ph * 0.08, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pw * 0.2, ph * 0.64); ctx.lineTo(pw * 0.4, ph * 0.38); ctx.lineTo(pw * 0.54, ph * 0.52); ctx.lineTo(pw * 0.66, ph * 0.4); ctx.lineTo(pw * 0.8, ph * 0.64); ctx.stroke();
  ctx.restore();
}

const PO_PAL = {
  blueprint: { land: '#174b82', water: '#0e3765', coast: '#a9c6e6', coastWidth: 1.2, road: '#4f7aa9', roadMajor: '#8fb1d8', path: '#5f88b6', waterway: '#4a7cb0', wood: '#1a5089', park: '#1a5089',
    label: { color: 'rgba(255,255,255,0.92)', halo: '#123f70', haloWidth: 3.5, upper: true, spacing: 0.14, weight: 600, dot: '#ffffff' } },
  nuit: { land: '#1e1e1f', water: '#111112', coast: '#3b3b3d', road: '#2f2f31', roadMajor: '#434346', path: '#36363a', waterway: '#1c2630', wood: '#202421', park: '#202421',
    label: { color: 'rgba(255,255,255,0.6)', halo: '#18181a', upper: true, spacing: 0.16, weight: 600, dot: 'rgba(255,255,255,0.7)' } },
  satellite: { label: { color: '#ffffff', halo: 'rgba(0,0,0,0.6)', haloWidth: 3.5, upper: true, spacing: 0.14, weight: 600, dot: '#ffffff' } },
  relief: { land: '#ebe7df', water: '#cfd9dd', coast: '#a9b8bd', coastWidth: 0.9, road: '#d6cfc2', roadMajor: '#bdb3a2', path: '#cbc3b5', waterway: '#b6c6cc', wood: '#dfe2d2', park: '#dfe2d2',
    label: { color: '#6a645a', halo: '#ebe7df', family: PO_SERIF, weight: 400, italic: true, scale: 1.1, dot: '#6a645a' } },
  galerie: { land: '#ecebe6', water: '#d5dee2', coast: '#bac7cc', coastWidth: 0.9, road: '#ffffff', roadMajor: '#ffffff', roadScale: 1.35, path: '#d8d5cd', waterway: '#c3d0d5', wood: '#e1e5d8', park: '#e1e5d8',
    label: { color: '#77736b', halo: '#ecebe6', upper: true, spacing: 0.12, weight: 600, dot: '#8a857c' } },
  photo: { water: 'rgba(10,20,30,0.22)', coast: 'rgba(255,255,255,0.55)', road: 'rgba(255,255,255,0.26)', roadMajor: 'rgba(255,255,255,0.45)', path: 'rgba(255,255,255,0.32)', waterway: 'rgba(255,255,255,0.3)',
    label: { color: '#ffffff', halo: 'rgba(0,0,0,0.5)', haloWidth: 3.5, upper: true, spacing: 0.14, weight: 600, dot: '#ffffff' } },
};

// ---------------------------------------------------------------- les modèles
// Modèles ouverts pour l'instant ; les autres sont affichés verrouillés
const PO_OPEN_TEMPLATES = ['blueprint'];
const poOpen = (id) => PO_OPEN_TEMPLATES.includes(id);

const POSTER_TEMPLATES = [
  {
    // Plan technique : grille, cartouche, échelle, nord
    id: 'blueprint', name: 'Plan', kind: 'Technique', dark: true, maxPhotos: 3, mapDefault: true,
    // Réglages recommandés pour l'impression (couleurs testées, style de carte, opacité)
    rec: { colors: ['#ffffff', '#facc15'], mapStyle: 'epure', mapOpacity: 40, map: true, bg: '#103c6b' },
    bgs: PO_DARK_BGS, photoSlot: true, infos: ['activity', 'start'],
    async draw(ctx, d, w, h) {
      const u = w / 1200, bg = d.bg || '#103c6b', line = 'rgba(255,255,255,0.85)';
      const M = 50 * u;
      const items = d.stats.map((s) => [s.short || s.label, s.value + (s.unit ? ' ' + s.unit : '')]);
      const cw = w * 0.5, rh = 50 * u, hh = d.subtitle ? 124 * u : 104 * u, ch = hh + items.length * rh;
      const cx = w - M - 12 * u - cw, cy = h - M - 12 * u - ch;
      const proj = stFit(d.routes, { x: M + 110 * u, y: M + 130 * u, w: w - 2 * M - 220 * u, h: cy - M - 230 * u });
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // Carte vectorielle dans le cadre, sous la grille
      const R = 30 * u, rx = w - M - 12 * u - 60 * u - R, ry = M + 12 * u + 52 * u + R; // boussole, marges haut/droite
      await poMap(ctx, d, proj, { x: M + 12 * u, y: M + 12 * u, w: w - 2 * M - 24 * u, h: h - 2 * M - 24 * u }, poBlueprintPal(bg),
        { u, labelRect: { x: M + 30 * u, y: M + 150 * u, w: w - 2 * M - 60 * u, h: cy - M - 170 * u },
          avoid: [{ x0: rx - R - 40 * u, x1: rx + R + 40 * u, y0: ry - R - 40 * u, y1: ry + R + 40 * u }] });
      // Fondu linéaire en haut de la carte : logo, coordonnées et boussole restent lisibles
      {
        const fy = M + 12 * u, fh = 230 * u;
        const fg = ctx.createLinearGradient(0, fy, 0, fy + fh);
        const rgba = (a) => `rgba(${[1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16)).join(',')},${a})`;
        fg.addColorStop(0, rgba(1)); fg.addColorStop(0.45, rgba(0.85)); fg.addColorStop(1, rgba(0));
        ctx.fillStyle = fg; ctx.fillRect(M + 12 * u, fy, w - 2 * M - 24 * u, fh);
      }
      // Quadrillage : normal autour du cadre, atténué à l'intérieur de la carte
      const gs = w / 48;
      const grid = (r, a1, a2) => {
        ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
        for (let i = 0, x = 0; x <= w; i++, x += gs) { ctx.fillStyle = i % 4 ? `rgba(255,255,255,${a1})` : `rgba(255,255,255,${a2})`; ctx.fillRect(x, 0, 1.2 * u, h); }
        for (let i = 0, y = 0; y <= h; i++, y += gs) { ctx.fillStyle = i % 4 ? `rgba(255,255,255,${a1})` : `rgba(255,255,255,${a2})`; ctx.fillRect(0, y, w, 1.2 * u); }
        ctx.restore();
      };
      const ix = M + 12 * u, iy = M + 12 * u, iw = w - 2 * M - 24 * u, ih = h - 2 * M - 24 * u;
      [[0, 0, w, iy], [0, iy + ih, w, h - iy - ih], [0, iy, ix, ih], [ix + iw, iy, w - ix - iw, ih]].forEach(([x, y, ww, hh2]) => grid({ x, y, w: ww, h: hh2 }, 0.05, 0.11));
      grid({ x: ix, y: iy, w: iw, h: ih }, 0.022, 0.05);
      ctx.strokeStyle = line; ctx.lineWidth = 3 * u; ctx.strokeRect(M, M, w - 2 * M, h - 2 * M);
      ctx.lineWidth = 1.2 * u; ctx.strokeRect(M + 12 * u, M + 12 * u, w - 2 * M - 24 * u, h - 2 * M - 24 * u);
      // Cartouche
      ctx.fillStyle = bg; ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = line; ctx.lineWidth = 2 * u; ctx.strokeRect(cx, cy, cw, ch);
      // En-tête du cartouche : titre (et sous-titre) centrés verticalement, marges égales
      const tSize = 42 * u, pad = 30 * u;
      const blockH = tSize * 0.74 + (d.subtitle ? 14 * u + 16 * u * 0.75 : 0);
      const tBase = cy + (hh - blockH) / 2 + tSize * 0.74;
      poLine(ctx, d.title || 'Itinéraire', cx + pad, tBase, cw - 2 * pad, tSize, '#fff', { upper: true, spacing: 0.06 });
      if (d.subtitle) stLabel(ctx, d.subtitle, cx + pad, tBase + 14 * u + 16 * u * 0.75, 16 * u, 'rgba(255,255,255,0.65)');
      const ip = 22 * u; // marges des lignes d'infos
      items.forEach(([k, v], i) => {
        const y = cy + hh + i * rh;
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx, y, cw, 1.5 * u);
        stLabel(ctx, k, cx + ip, y + rh / 2 + 5.5 * u, 15 * u, 'rgba(255,255,255,0.65)');
        ctx.font = stFont(700, 24 * u, ST_NUM); ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
        ctx.fillText(stWrap(ctx, v, cw * 0.58, 1)[0] || '', cx + cw - ip, y + rh / 2 + 8.5 * u);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx + cw * 0.36, cy + hh, 1.5 * u, ch - hh);
      // Photos punaisées à gauche du cartouche
      const leftX = M + 50 * u, leftW = cx - 40 * u - leftX;
      // Zone photos : entre le bord gauche du cadre et le cartouche, sous l'échelle
      const zx = M + 12 * u, zw = cx - zx, zy = cy + 64 * u, zh = ch - 100 * u;
      if (d.photos.length === 1) poPhotos(ctx, d.photos, zx + 30 * u, zy, zw - 60 * u, zh, { border: 8 * u, rotate: 2, shadow: 18 * u, maxRatio: 1.25, align: 'center', tape: true, u });
      else if (d.photos.length) poPhotos(ctx, d.photos.slice(0, 3), leftX, zy + 6 * u, leftW, zh - 6 * u, { gap: 18 * u, border: 8 * u, rotate: 2, shadow: 18 * u, maxRatio: 1.25, align: 'left', tape: true, u });
      else if (d.preview && d.photoSlot !== false) { const pw = Math.min(zw - 60 * u, zh * 1.25); poPhotoPlaceholder(ctx, zx + (zw - pw) / 2, zy + 6 * u, pw, zh - 10 * u, u, bg, d.onSlot); }
      // Tracé
      // Halo du tracé dans la couleur choisie (ressort mieux qu'un halo blanc)
      const rc = poCol(d, '#ffffff');
      const halo = rc === 'routes' ? 'routes' : /^#[0-9a-f]{6}$/i.test(rc) ? poMix(bg, rc, 0.42) : 'rgba(255,255,255,0.35)';
      ctx.save(); ctx.setLineDash([2 * u, 10 * u]);
      stDrawRoutes(ctx, d.routes, proj, { color: halo, width: 18 * u, markers: false });
      ctx.restore();
      stDrawRoutes(ctx, d.routes, proj, { color: rc, width: 4 * u, markers: false });
      poStartEnd(ctx, d, proj, u, rc === 'routes' ? '#ffffff' : rc, bg);
      // Nord + échelle
      poCompass(ctx, rx, ry, R, u, '#ffffff', bg);
      poScaleBar(ctx, d, proj, leftX, cy + 14 * u, Math.min(leftW, w * 0.22), '#fff', u);
      await poDrawLogo(ctx, M + 50 * u, M + 60 * u, 26 * u, '#ffffff');
      if (d.coords && d.routes[0]) stLabel(ctx, poCoords(d), M + 50 * u, M + 120 * u, 14 * u, 'rgba(255,255,255,0.7)');
    },
  },
  {
    // Carte de nuit : fond sombre, tracé lumineux
    id: 'nuit', name: 'Nuit', kind: 'Carte', dark: true, maxPhotos: 3, mapDefault: true,
    // Réglages recommandés pour l'impression (couleurs testées, style de carte, opacité)
    rec: { colors: ['#fc5200', '#ffffff'], mapStyle: 'routes', mapOpacity: 100, map: true },
    async draw(ctx, d, w, h) {
      const u = w / 1200;
      ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, w, h);
      const L = stStatsLayout(ctx, d.stats, w - 220 * u, { maxSize: 70 * u, labelSize: 20 * u, cols: poCols(d.stats.length) });
      const statsTop = h - 130 * u - L.height;
      const titleY = statsTop - 90 * u;
      const ph = d.photos.length ? 190 * u : 0;
      const photosTop = titleY - 120 * u - ph;
      const mapBottom = ph ? photosTop - 50 * u : titleY - 160 * u;
      const proj = stFit(d.routes, { x: 140 * u, y: 230 * u, w: w - 280 * u, h: mapBottom - 230 * u }, 15);
      await poMap(ctx, d, proj, { x: 0, y: 0, w, h }, PO_PAL.nuit,
        { u, labelRect: { x: 70 * u, y: 170 * u, w: w - 140 * u, h: (ph ? photosTop : titleY - 150 * u) - 190 * u } });
      let g = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.2, w / 2, h * 0.5, w * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const fadeTop = (ph ? photosTop : titleY) - 260 * u;
      g = ctx.createLinearGradient(0, fadeTop, 0, h); g.addColorStop(0, 'rgba(10,10,10,0)'); g.addColorStop(0.45, 'rgba(10,10,10,0.85)'); g.addColorStop(1, 'rgba(10,10,10,0.96)');
      ctx.fillStyle = g; ctx.fillRect(0, fadeTop, w, h);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffb648'), width: 7 * u, glow: 30 * u });
      await poDrawLogo(ctx, w / 2, 110 * u, 34 * u, '#ffffff', 'center');
      if (ph) poPhotos(ctx, d.photos, 110 * u, photosTop, w - 220 * u, ph, { gap: 18 * u, radius: 14 * u, maxRatio: 1.5 });
      if (d.title) poLine(ctx, d.title, w / 2, titleY, w - 220 * u, 84 * u, '#ffffff', { upper: true, spacing: 0.1, align: 'center' });
      if (d.subtitle) stLabel(ctx, d.subtitle, w / 2, titleY + 50 * u, 20 * u, 'rgba(255,255,255,0.6)', 'center');
      if (d.stats.length) stDrawStats(ctx, d.stats, 110 * u, statsTop, w - 220 * u, { layout: L, labelColor: 'rgba(255,255,255,0.55)', dividers: true, dividerColor: 'rgba(255,255,255,0.18)' });
      if (d.coords) stLabel(ctx, poCoords(d), w / 2, h - 60 * u, 16 * u, 'rgba(255,255,255,0.45)', 'center');
    },
  },
  {
    // Satellite plein cadre
    id: 'satellite', name: 'Satellite', kind: 'Carte', dark: true, maxPhotos: 4,
    // Réglages recommandés pour l'impression (couleurs testées, style de carte, opacité)
    rec: { colors: ['#ffffff', '#facc15'], mapStyle: 'epure', mapOpacity: 100, map: true },
    async draw(ctx, d, w, h) {
      const u = w / 1200, M = 100 * u;
      { const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#13202c'); bg.addColorStop(1, '#05080b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 70 * u, labelSize: 20 * u, cols: poCols(d.stats.length) });
      const statsTop = h - 110 * u - L.height;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, 96 * u, { maxLines: 2 });
      const titleTop = statsTop - 70 * u - (d.subtitle ? 44 * u : 0) - th;
      const ph = d.photos.length ? 170 * u : 0;
      const photosTop = titleTop - 50 * u - ph;
      const proj = stFit(d.routes, { x: 130 * u, y: 160 * u, w: w - 260 * u, h: (ph ? photosTop : titleTop) - 130 * u - 160 * u }, 16);
      if (d.showMap) {
        // Imagerie satellite (photo aérienne, forcément en image)
        ctx.save(); ctx.globalAlpha = d.mapOpacity == null ? 1 : d.mapOpacity;
        await stDrawTiles(ctx, 'satellite', proj, { x: 0, y: 0, w, h }, 'url', d.pr);
        ctx.restore();
      }
      await poMap(ctx, { ...d, showMap: false }, proj, { x: 0, y: 0, w, h }, PO_PAL.satellite,
        { u, labelRect: { x: 70 * u, y: 170 * u, w: w - 140 * u, h: (ph ? photosTop : titleTop) - 260 * u } });
      const fadeTop = (ph ? photosTop : titleTop) - 300 * u;
      let g = ctx.createLinearGradient(0, fadeTop, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = g; ctx.fillRect(0, fadeTop, w, h);
      g = ctx.createLinearGradient(0, 0, 0, 260 * u); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, 260 * u);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffd23f'), width: 7 * u, casing: 'rgba(0,0,0,0.45)', casingWidth: 3 * u });
      await poDrawLogo(ctx, M, 80 * u, 32 * u, '#ffffff');
      if (d.coords) stLabel(ctx, poCoords(d), w - M, 104 * u, 16 * u, 'rgba(255,255,255,0.75)', 'right');
      if (ph) poPhotos(ctx, d.photos, M, photosTop, w - 2 * M, ph, { gap: 14 * u, border: 6 * u, maxRatio: 1.4, align: 'left' });
      if (d.title) poLines(ctx, d.title, M, titleTop, w - 2 * M, 96 * u, '#ffffff', { maxLines: 2, lh: 1.02 });
      if (d.subtitle) stLabel(ctx, d.subtitle, M, titleTop + th + 34 * u, 22 * u, 'rgba(255,255,255,0.7)');
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, w - 2 * M, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.6)' });
    },
  },
  {
    // Relief : ombrage du terrain sur papier, typographie éditoriale
    id: 'relief', name: 'Éditorial', kind: 'Magazine', maxPhotos: 4,
    // Réglages recommandés pour l'impression (couleurs testées, style de carte, opacité)
    rec: { colors: ['#fc5200', '#3b82f6'], mapStyle: 'nature', mapOpacity: 85, map: true },
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#1c1a17', mute = '#7d776c', M = 90 * u;
      ctx.fillStyle = '#f3f0ea'; ctx.fillRect(0, 0, w, h);
      await poDrawLogo(ctx, M, M - 26 * u, 26 * u, ink);
      if (d.coords) stLabel(ctx, poCoords(d), w - M, M - 6 * u, 15 * u, mute, 'right');
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 62 * u, labelSize: 18 * u, cols: poCols(d.stats.length) });
      const statsTop = h - M - L.height;
      const ruleY = statsTop - 46 * u;
      const subH = d.subtitle ? 50 * u : 0;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, 116 * u, { family: PO_SERIF, maxLines: 2, lh: 1.02 });
      const titleTop = ruleY - 46 * u - subH - th;
      const ph = d.photos.length ? 230 * u : 0;
      const mapTop = M + 30 * u, mapBottom = titleTop - 60 * u - (ph ? ph + 24 * u : 0);
      const mapH = mapBottom - mapTop;
      const proj = stFit(d.routes, { x: M + 80 * u, y: mapTop + 80 * u, w: w - 2 * M - 160 * u, h: mapH - 160 * u }, 15);
      await poMap(ctx, d, proj, { x: M, y: mapTop, w: w - 2 * M, h: mapH }, PO_PAL.relief, { u });
      ctx.save(); ctx.beginPath(); ctx.rect(M, mapTop, w - 2 * M, mapH); ctx.clip();
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#c2410c'), width: 6 * u, casing: '#ffffff', casingWidth: 3 * u });
      ctx.restore();
      if (ph) poPhotos(ctx, d.photos, M, mapBottom + 24 * u, w - 2 * M, ph, { gap: 24 * u });
      if (d.title) poLines(ctx, d.title, M, titleTop, w - 2 * M, 116 * u, ink, { family: PO_SERIF, maxLines: 2, lh: 1.02 });
      if (d.subtitle) poLine(ctx, d.subtitle, M, titleTop + th + 36 * u, w - 2 * M, 34 * u, mute, { family: PO_SERIF, weight: 400, italic: true });
      ctx.fillStyle = ink; ctx.fillRect(M, ruleY, w - 2 * M, 2 * u);
      stLabel(ctx, d.activityLabel, w - M, ruleY - 16 * u, 16 * u, mute, 'right');
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, w - 2 * M, { layout: L, align: 'left', color: ink, labelColor: mute });
    },
  },
  {
    // Galerie : carte claire + photos du voyage, façon carnet
    id: 'galerie', name: 'Galerie', kind: 'Carnet', maxPhotos: 4,
    // Réglages recommandés pour l'impression (couleurs testées, style de carte, opacité)
    rec: { colors: ['#3b82f6', '#fc5200'], mapStyle: 'routes', mapOpacity: 100, map: true },
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#161616', mute = '#8a857c', M = 80 * u;
      ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, w, h);
      let y = M + 10 * u;
      stLabel(ctx, [d.activityLabel, d.subtitle].filter(Boolean).join('  ·  '), w / 2, y + 18 * u, 18 * u, mute, 'center');
      y += 44 * u;
      if (d.title) y += poLines(ctx, d.title, w / 2, y, w - 2 * M, 96 * u, ink, { family: PO_SERIF, maxLines: 2, align: 'center', lh: 1.04 });
      y += 40 * u;
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 56 * u, labelSize: 17 * u, cols: poCols(d.stats.length) });
      const footTop = h - M - 60 * u - L.height;
      const n = d.photos.length;
      const phH = n ? (n === 4 ? (footTop - 40 * u - y) * 0.48 : (footTop - 40 * u - y) * 0.34) : 0;
      const mapH = footTop - 40 * u - y - (n ? phH + 22 * u : 0);
      const proj = stFit(d.routes, { x: M + 60 * u, y: y + 60 * u, w: w - 2 * M - 120 * u, h: mapH - 120 * u }, 16);
      const gy = y;
      ctx.save(); stRoundRect(ctx, M, gy, w - 2 * M, mapH, 20 * u); ctx.fillStyle = '#ecebe6'; ctx.fill(); ctx.restore();
      await poMap(ctx, d, proj, { x: M, y: gy, w: w - 2 * M, h: mapH }, PO_PAL.galerie, { u, clip: (g) => stRoundRect(g, M, gy, w - 2 * M, mapH, 20 * u) });
      ctx.save(); stRoundRect(ctx, M, gy, w - 2 * M, mapH, 20 * u); ctx.clip();
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, 'routes'), width: 7 * u, casing: '#ffffff', casingWidth: 3 * u });
      ctx.restore();
      if (n) poPhotos(ctx, d.photos, M, y + mapH + 22 * u, w - 2 * M, phH, { gap: 22 * u, radius: 20 * u, grid: true });
      ctx.fillStyle = 'rgba(22,22,22,0.12)'; ctx.fillRect(M, footTop - 10 * u, w - 2 * M, 1.5 * u);
      if (d.stats.length) stDrawStats(ctx, d.stats, M, footTop + 20 * u, w - 2 * M, { layout: L, color: ink, labelColor: mute, dividers: true, dividerColor: 'rgba(22,22,22,0.1)' });
      await poDrawLogo(ctx, w / 2, h - M + 6 * u, 22 * u, ink, 'center');
      if (d.coords) stLabel(ctx, poCoords(d), M, h - M + 24 * u, 14 * u, mute);
    },
  },
  {
    // Photo plein cadre : ta photo en fond, tracé et chiffres par-dessus
    id: 'photo', name: 'Photo', kind: 'Ta photo', photoBg: true, dark: true, maxPhotos: 3,
    // Réglages recommandés pour l'impression (couleurs testées, style de carte, opacité)
    rec: { colors: ['#ffffff', '#facc15'], mapStyle: 'epure', mapOpacity: 60, map: false },
    async draw(ctx, d, w, h) {
      const u = w / 1200, M = 100 * u;
      poPhotoBg(ctx, d, 0, 0, w, h);
      let g = ctx.createLinearGradient(0, 0, 0, h * 0.4); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.4);
      g = ctx.createLinearGradient(0, h * 0.42, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g; ctx.fillRect(0, h * 0.42, w, h * 0.58);
      await poDrawLogo(ctx, M, 80 * u, 32 * u, '#ffffff');
      if (d.coords) stLabel(ctx, poCoords(d), w - M, 104 * u, 16 * u, 'rgba(255,255,255,0.8)', 'right');
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 72 * u, labelSize: 20 * u, cols: poCols(d.stats.length) });
      const statsTop = h - 110 * u - L.height;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, 120 * u, { family: PO_SERIF, maxLines: 2, lh: 1.0 });
      const titleTop = statsTop - 70 * u - (d.subtitle ? 50 * u : 0) - th;
      const ph = d.photos.length ? 160 * u : 0;
      const photosTop = titleTop - 50 * u - ph;
      const proj = stFit(d.routes, { x: w * 0.42, y: 170 * u, w: w * 0.5, h: (ph ? photosTop : titleTop) - 120 * u - 170 * u });
      await poMap(ctx, d, proj, { x: 0, y: 0, w, h: (ph ? photosTop : titleTop) - 40 * u }, PO_PAL.photo,
        { u, labelRect: { x: 60 * u, y: 160 * u, w: w - 120 * u, h: (ph ? photosTop : titleTop) - 220 * u } });
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffffff'), width: 6 * u, glow: 16 * u, markers: true });
      if (ph) poPhotos(ctx, d.photos, M, photosTop, w - 2 * M, ph, { gap: 16 * u, border: 7 * u, maxRatio: 1.3, align: 'left', shadow: 16 * u });
      if (d.title) poLines(ctx, d.title, M, titleTop, w - 2 * M, 120 * u, '#ffffff', { family: PO_SERIF, maxLines: 2, lh: 1.0 });
      if (d.subtitle) poLine(ctx, d.subtitle, M, titleTop + th + 40 * u, w - 2 * M, 34 * u, 'rgba(255,255,255,0.85)', { family: PO_SERIF, weight: 400, italic: true });
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(M, statsTop - 34 * u, w - 2 * M, 1.5 * u);
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, w - 2 * M, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.7)' });
    },
  },
];

// Rendu complet : cadre (bordure) + modèle, dans un contexte déjà à l'échelle.
async function renderPosterCtx(ctx, tpl, d, fmt, border, pr) {
  const W = PO_W, H = poHeight(fmt);
  if (!d.routes.length) return;
  const dd = { ...d, pr, photos: (d.photos || []).slice(0, tpl.maxPhotos || 4), showMap: d.showMap != null ? d.showMap : !!tpl.mapDefault };
  try {
    if (border === 'marge' || border === 'passe') {
      const m = border === 'passe' ? W * 0.085 : W * 0.035;
      ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(m, m); ctx.beginPath(); ctx.rect(0, 0, W - 2 * m, H - 2 * m); ctx.clip();
      await tpl.draw(ctx, dd, W - 2 * m, H - 2 * m);
      ctx.restore();
      if (border === 'passe') {
        ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 3; ctx.strokeRect(m - 2, m - 2, W - 2 * m + 4, H - 2 * m + 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(m - 5, m - 5, W - 2 * m + 10, H - 2 * m + 10);
      }
    } else {
      await tpl.draw(ctx, dd, W, H);
      if (border === 'fine') {
        const m = W * 0.03;
        ctx.strokeStyle = tpl.dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5;
        ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
      }
    }
  } catch (e) { console.warn('poster render', e); }
}
// Canvas (aperçu, vignettes, PNG). `scale` = px canvas par unité.
async function renderPoster(canvas, tpl, d, fmt, border, scale) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  await renderPosterCtx(ctx, tpl, d, fmt, border, scale);
}
// SVG vectoriel prêt pour l'imprimeur : carte, tracé et textes en vecteurs,
// polices intégrées, dimensions physiques en mm.
async function renderPosterSvg(tpl, d, fmt, border) {
  const W = PO_W, H = poHeight(fmt);
  const ctx = new C2S(W, H);
  ctx.__isSvg = true;
  // Images distantes (imagerie satellite) intégrées dans le fichier
  const draw = ctx.drawImage.bind(ctx);
  ctx.drawImage = function (img, ...rest) {
    if (img && img.nodeName === 'IMG' && !/^data:/.test(img.src)) {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return draw(c, ...rest);
    }
    return draw(img, ...rest);
  };
  await renderPosterCtx(ctx, tpl, d, fmt, border, 3);
  let svg = ctx.getSerializedSvg(true);
  svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, `<svg$1 width="${fmt.mm[0]}mm" height="${fmt.mm[1]}mm" viewBox="0 0 ${W} ${H}"`);
  const css = await pmFontFaceCss(svg);
  if (css) svg = svg.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
  return svg;
}

// ---------------------------------------------------------------- panneau (studio)
function readImageFile(file) {
  return new Promise((resolve) => {
    if (!file || !/^image\//.test(file.type)) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => { const img = new Image(); img.onload = () => resolve({ url: reader.result, img }); img.onerror = () => resolve(null); img.src = reader.result; };
    reader.readAsDataURL(file);
  });
}

// Section repliable de l'inspecteur
function StudioSection({ title, aside, children, defaultOpen = true }) {
  const [open, setOpen] = usePoState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-3.5 text-left group">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 group-hover:text-neutral-200 transition-colors">{title}</span>
        <span className="flex items-center gap-2">
          {aside}
          <span className="text-neutral-500 transition-transform" style={{ transform: open ? 'none' : 'rotate(-90deg)' }}><I.ChevronDown size={14} /></span>
        </span>
      </button>
      {open && <div className="px-5 pb-5 -mt-0.5">{children}</div>}
    </div>
  );
}

// Empreinte courte d'une chaîne (clé d'enregistrement)
function poHash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

// Petite étoile « recommandé » posée sur une pastille
// Étapes du panneau : contenu → personnalisation de la carte → cadrage et impression
const PO_STEPS = ['Contenu', 'Carte', 'Cadre'];
function PoStepper({ step, setStep }) {
  return (
    <div className="shrink-0 flex items-center gap-1 px-4 h-12 border-b border-white/[0.06]">
      {PO_STEPS.map((name, i) => {
        const n = i + 1, on = n === step, done = n < step;
        return (
          <React.Fragment key={n}>
            {i > 0 && <span className={`flex-1 h-px ${n <= step ? 'bg-white/30' : 'bg-white/10'}`} />}
            <button onClick={() => setStep(n)} className={`flex items-center gap-1.5 h-8 px-1.5 rounded-lg text-[12px] font-medium transition-colors ${on ? 'text-white' : done ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[10.5px] font-semibold tabular-nums ${on ? 'bg-white text-neutral-900' : done ? 'bg-white/15 text-white' : 'ring-1 ring-white/20'}`}>
                {done ? <I.Check size={11} /> : n}
              </span>
              {name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Recommandé : simple point vert, discret
function RecStar() {
  return <span className="pointer-events-none absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-neutral-950" />;
}
function RecDot({ className = '' }) {
  return <span className={`inline-block shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ${className}`} />;
}
// Les choix recommandés passent en tête de liste
function poRecFirst(list, isRec) { return [...list.filter(isRec), ...list.filter((x) => !isRec(x))]; }

// Liste des infos : interrupteur, valeur, réordonnable au glisser (souris et tactile)
// Réglages communs à tous les modèles : textes et infos affichées
const PO_SHARED_KEYS = ['title', 'subtitle', 'showTitle', 'showSub', 'act', 'order', 'enabled', 'values'];
function poPick(o, keys) { const r = {}; if (o) keys.forEach((k) => { if (k in o) r[k] = o[k]; }); return r; }
function poOmit(o, keys) { const r = { ...(o || {}) }; keys.forEach((k) => delete r[k]); return r; }

function MetricsList({ order, setOrder, enabled, onToggle, values, overrides = {}, onEdit }) {
  const listRef = usePoRef(null);
  const [editKey, setEditKey] = usePoState(null);
  const [dragKey, setDragKey] = usePoState(null);
  usePoEffect(() => {
    if (!dragKey) return;
    const up = () => setDragKey(null);
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [dragKey]);
  const onMove = (e) => {
    if (!dragKey || !listRef.current) return;
    const rows = [...listRef.current.children];
    let idx = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (idx < 0) idx = rows.length;
    setOrder((o) => {
      const from = o.indexOf(dragKey);
      const to = Math.max(0, Math.min(o.length - 1, idx > from ? idx - 1 : idx));
      if (to === from) return o;
      const n = o.filter((k) => k !== dragKey); n.splice(to, 0, dragKey); return n;
    });
  };
  return (
    <div ref={listRef} className="rounded-xl ring-1 ring-white/[0.07] overflow-hidden divide-y divide-white/[0.06]"
      onPointerMove={onMove} onPointerUp={() => setDragKey(null)} onPointerCancel={() => setDragKey(null)}>
      {order.map((k) => {
        const on = enabled.has(k);
        const dragging = dragKey === k;
        return (
          <div key={k} className={`flex items-center gap-2 h-11 pr-3 transition-colors select-none ${dragging ? 'bg-white/[0.1]' : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}>
            <span onPointerDown={(e) => { e.preventDefault(); setDragKey(k); }} title="Glisser pour réordonner"
              className="w-8 h-full grid place-items-center text-neutral-500 hover:text-neutral-200 cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }}>
              <I.Drag size={14} />
            </span>
            <button onClick={() => onToggle(k)} className="flex-1 min-w-0 h-full text-left">
              <span className={`block truncate text-[13px] ${on ? 'text-white' : 'text-neutral-500'}`}>{PO_METRICS[k]}</span>
            </button>
            {editKey === k ? (
              <input autoFocus defaultValue={overrides[k] || values[k] || ''}
                onBlur={(e) => { onEdit && onEdit(k, e.target.value === values[k] ? '' : e.target.value); setEditKey(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditKey(null); }}
                className="w-[96px] h-7 rounded-md bg-white/10 px-2 text-right text-[12px] tabular-nums text-white outline-none ring-1 ring-white/30 focus:ring-white/60" />
            ) : (
              <span onDoubleClick={() => setEditKey(k)} title="Double-clic pour modifier"
                className={`text-[12px] tabular-nums whitespace-nowrap cursor-text rounded px-1 -mx-1 hover:bg-white/[0.08] ${overrides[k] ? 'text-amber-300' : on ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {overrides[k] || values[k] || '—'}
              </span>
            )}
            {overrides[k] && editKey !== k && (
              <button onClick={() => onEdit && onEdit(k, '')} title="Revenir à la valeur calculée" className="w-5 h-5 grid place-items-center rounded text-neutral-500 hover:text-white"><I.X size={11} /></button>
            )}
            <button onClick={() => onToggle(k)} aria-label={on ? 'Masquer' : 'Afficher'} className="shrink-0 ml-1 h-full flex items-center"><StorySwitch on={on} /></button>
          </div>
        );
      })}
    </div>
  );
}

function PosterPane({ allRoutes, routes, included, setIncluded, title, setTitle, initialTitle, dark, isMobile, onToast, routeTools }) {
  const [tplId, setTplId] = usePoState('blueprint');
  const [fmtId, setFmtId] = usePoState('a3');
  // Parcours : 1 = design, 2 = « Imprimez votre tracé » (fichier ou tirage encadré)
  const [step, setStep] = usePoState(1);
  const [offer, setOffer] = usePoState('file');
  const [actOpen, setActOpen] = usePoState(false);
  const [actId, setActId] = usePoState(() => poActivityOf(allRoutes));
  const act = poActivity(actId);
  const orderFor = (a) => [...a.metrics, ...a.avail.filter((k) => !a.metrics.includes(k))];
  const [bgPhoto, setBgPhoto] = usePoState(null);
  const [photos, setPhotos] = usePoState([]);
  const [busy, setBusy] = usePoState(false);
  const [ready, setReady] = usePoState(false);
  const [slot, setSlot] = usePoState(null); // emplacement photo factice dans l'aperçu
  const previewRef = usePoRef(null);
  const thumbRefs = usePoRef({});
  const bgRef = usePoRef(null);
  const photosRef = usePoRef(null);

  // Réglages de design PAR MODÈLE : modifier un modèle ne touche pas les autres.
  // Exception : textes et infos affichées sont communs à tous les modèles (cfgs._shared).
  // Ils s'enregistrent automatiquement (navigateur) pour ce jeu de tracés.
  const storeKey = 'printrace_studio_' + poHash(allRoutes.map((r) => r.id).join('|'));
  const saved = usePoMemo(() => { try { return JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (e) { return null; } }, [storeKey]);
  const [cfgs, setCfgs] = usePoState(() => {
    const c = (saved && saved.cfgs) || {};
    if (c._shared || !saved || !saved.tplId || !c[saved.tplId]) return c;
    return { ...c, _shared: poPick(c[saved.tplId], PO_SHARED_KEYS) };
  });
  usePoEffect(() => { if (saved && saved.tplId && poOpen(saved.tplId)) setTplId(saved.tplId); if (saved && saved.fmtId) setFmtId(saved.fmtId); if (saved && saved.actId) setActId(saved.actId); }, []);
  const [versions, setVersions] = usePoState(() => (saved && saved.versions) || []);
  usePoEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(storeKey, JSON.stringify({ cfgs, tplId, fmtId, actId, versions })); } catch (e) {} }, 300);
    return () => clearTimeout(t);
  }, [cfgs, tplId, fmtId, actId, versions, storeKey]);
  const defaultsFor = (t) => ({
    color: 'auto', customColor: '#ff6b35', coords: true, mapLabels: !!t.mapDefault, photoSlot: true, values: {},
    map: !!t.mapDefault, mapStyle: (t.rec && t.rec.mapStyle) || 'epure', mapOpacity: (t.rec && t.rec.mapOpacity) || 100, bg: (t.rec && t.rec.bg) || null,
    showTitle: true, showSub: true, subtitle: null, title: null, act: null, order: null, enabled: null, border: 'none', mock: 'noir',
  });
  const cfgOf = (t, all = cfgs) => ({ ...defaultsFor(t), ...poOmit(all[t.id], PO_SHARED_KEYS), ...(all._shared || {}) });
  const tpl = POSTER_TEMPLATES.find((t) => t.id === tplId && poOpen(t.id)) || POSTER_TEMPLATES[0];
  const cfg = cfgOf(tpl);
  const setCfg = (patch) => setCfgs((all) => {
    const cur = cfgOf(tpl, all);
    const pv = typeof patch === 'function' ? patch(cur) : patch;
    return {
      ...all,
      [tpl.id]: { ...(all[tpl.id] || {}), ...poOmit(pv, PO_SHARED_KEYS) },
      _shared: { ...(all._shared || {}), ...poPick(pv, PO_SHARED_KEYS) },
    };
  });
  // Liste des infos = métriques de l'activité + infos propres au modèle (activité, GPS…)
  const ownOrder = (c) => (c.order && c.act === actId ? c.order : null);
  const orderOf = (c, t = tpl) => {
    const ok = [...act.avail, ...(t.infos || [])];
    const base = (ownOrder(c) || orderFor(act)).filter((k) => ok.includes(k));
    return [...base, ...ok.filter((k) => !base.includes(k))];
  };
  const enabledOf = (c, t = tpl) => {
    const s = new Set(c.enabled && c.act === actId ? c.enabled : act.metrics);
    (t.infos || []).forEach((k) => { if (!(ownOrder(c) || []).includes(k)) s.add(k); }); // affichées par défaut
    return s;
  };
  const rec = tpl.rec || { colors: [], mapStyle: 'epure', mapOpacity: 100 };
  // Accès « à plat » pour l'interface
  const { color, customColor, coords, mapLabels, mapStyle, mapOpacity, showTitle, showSub, subtitle, border, mock } = cfg;
  const showMap = cfg.map, bgColor = cfg.bg;
  const photoOn = !tpl.photoSlot || cfg.photoSlot !== false;
  const order = orderOf(cfg), enabled = enabledOf(cfg);
  const metrics = order.filter((k) => enabled.has(k));
  const customOn = color !== 'auto' && !SHARE_COLORS.some((c) => c.value === color);
  const setColor = (v) => setCfg({ color: v });
  const setCustomColor = (v) => setCfg({ customColor: v });
  const setCoords = (f) => setCfg((c) => ({ coords: f(c.coords) }));
  const setMapLabels = (f) => setCfg((c) => ({ mapLabels: f(c.mapLabels) }));
  const setShowMap = (f) => setCfg((c) => ({ map: f(c.map) }));
  const setMapStyle = (v) => setCfg({ mapStyle: v });
  const setMapOpacity = (v) => setCfg({ mapOpacity: v });
  const setBgColor = (v) => setCfg({ bg: v });
  const setShowTitle = (f) => setCfg((c) => ({ showTitle: f(c.showTitle) }));
  const setShowSub = (f) => setCfg((c) => ({ showSub: f(c.showSub) }));
  const setSubtitle = (v) => setCfg({ subtitle: v });
  const setTplTitle = (v) => setCfg({ title: v });
  const setBorder = (v) => setCfg({ border: v });
  const setMock = (v) => setCfg({ mock: v });
  const setOrder = (f) => setCfg((c) => ({ act: actId, order: f(orderOf(c)), enabled: [...enabledOf(c)] }));
  const toggleMetric = (k) => setCfg((c) => { const n = enabledOf(c); if (n.has(k)) n.delete(k); else n.add(k); return { act: actId, order: orderOf(c), enabled: [...n] }; });
  const tplTitle = cfg.title != null ? cfg.title : title;
  const fmt = POSTER_FORMATS.find((f) => f.id === fmtId) || POSTER_FORMATS[1];
  const ratio = fmt.mm[1] / fmt.mm[0];
  const exp = poExportSize(fmt);

  const agg = usePoMemo(() => poAggregate(routes, act), [routes, actId]);
  const defaultSub = usePoMemo(() => {
    const bits = [];
    if (routes.length > 1) bits.push(`${routes.length} étapes`);
    if (agg.dateLabel) bits.push(agg.dateLabel);
    return bits.join(' · ');
  }, [routes.length, agg.dateLabel]);

  const infoX = usePoMemo(() => ({ activity: act.label, start: routes[0] && routes[0].coords[0] }), [act, routes]);
  // Données de rendu d'un modèle avec SES réglages
  const dataFor = (t) => {
    const c = cfgOf(t);
    const ord = orderOf(c, t), en = enabledOf(c, t);
    const ttl = c.title != null ? c.title : title;
    return {
      routes, agg, color: c.color, coords: c.coords, activityLabel: act.label,
      title: c.showTitle ? (ttl.trim() || initialTitle || 'Mon aventure') : '',
      subtitle: c.showSub ? (c.subtitle == null ? defaultSub : c.subtitle) : '',
      stats: poStats(agg, ord.filter((k) => en.has(k)), infoX).map((st) => (c.values && c.values[st.key] ? { ...st, value: c.values[st.key], unit: '' } : st)),
      photoSlot: c.photoSlot,
      photos: t.photoSlot && c.photoSlot === false ? [] : photos, bgPhoto: bgPhoto && bgPhoto.img, showMap: c.map, mapStyle: c.mapStyle, mapOpacity: c.mapOpacity / 100,
      mapLabels: c.mapLabels, bg: c.bg, preview: true,
    };
  };
  const data = usePoMemo(() => dataFor(tpl), [cfgs, tplId, routes, agg, title, defaultSub, photos, bgPhoto, actId]);
  const stageMock = step === 3 ? mock : 'none'; // aperçu en direct du cadre

  const token = usePoRef(0);
  usePoEffect(() => {
    const my = ++token.current;
    const t = setTimeout(async () => {
      await storyFontsReady();
      if (my !== token.current) return;
      const c = previewRef.current;
      if (c) {
        const pw = 1000; c.width = pw; c.height = Math.round(pw * ratio);
        let sl = null;
        await renderPoster(c, tpl, { ...data, onSlot: (r) => { sl = { l: r.x / c.width, t: r.y / c.height, w: r.w / c.width, h: r.h / c.height }; } }, fmt, border, pw / PO_W);
        if (my === token.current) setSlot(sl);
      }
      if (my !== token.current) return;
      setReady(true);
      for (const tp of POSTER_TEMPLATES) {
        const tc = thumbRefs.current[tp.id];
        if (tc && my === token.current) {
          tc.width = 240; tc.height = Math.round(240 * ratio);
          await renderPoster(tc, tp, dataFor(tp), fmt, 'none', 240 / PO_W);
        }
      }
    }, 80);
    return () => clearTimeout(t);
  }, [data, tplId, fmtId, border, cfgs]);

  const addPhotos = async (files) => {
    const list = (await Promise.all([...files].slice(0, 4).map(readImageFile))).filter(Boolean);
    if (!list.length) return;
    setPhotos((p) => [...p, ...list].slice(0, 4));
  };
  const setBg = async (file) => {
    const p = await readImageFile(file);
    if (p) { setBgPhoto(p); if (!tpl.photoBg && poOpen('photo')) setTplId('photo'); }
  };

  const exportCanvas = async () => {
    const c = document.createElement('canvas');
    c.width = exp.w; c.height = exp.h;
    await storyFontsReady();
    await renderPoster(c, tpl, { ...data, preview: false }, fmt, border, exp.w / PO_W);
    return c;
  };
  const fileName = () => {
    const slug = (data.title || 'aventure').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return `printrace-${slug || 'aventure'}-${fmt.id}`;
  };
  const doDownload = async () => {
    setBusy(true);
    try {
      const c = await exportCanvas();
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = fileName() + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      onToast && onToast(`Poster ${fmt.name} téléchargé (${exp.w} × ${exp.h} px)`);
    } catch (e) { onToast && onToast('Export impossible : ' + e.message); }
    setBusy(false);
  };
  // Versions enregistrées (design d'un modèle + format), réouvrables
  const saveVersion = () => {
    const v = { id: Date.now(), at: Date.now(), tplId, fmtId, actId, cfg: { ...(cfgs[tplId] || {}), ...(cfgs._shared || {}) }, name: `${tpl.name} · ${fmt.name}` };
    setVersions((vs) => [v, ...vs].slice(0, 12));
    onToast && onToast('Version enregistrée');
  };
  const openVersion = (v) => {
    setCfgs((all) => ({ ...all, [v.tplId]: poOmit(v.cfg, PO_SHARED_KEYS), _shared: { ...(all._shared || {}), ...poPick(v.cfg, PO_SHARED_KEYS) } }));
    if (poOpen(v.tplId)) setTplId(v.tplId); setFmtId(v.fmtId); if (v.actId) setActId(v.actId);
    onToast && onToast('Version restaurée');
  };
  const saveBlob = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  // SVG vectoriel (carte, tracé, textes en vecteurs, polices intégrées)
  const doDownloadSvg = async () => {
    setBusy(true);
    try {
      await storyFontsReady();
      const svg = await renderPosterSvg(tpl, { ...data, preview: false }, fmt, border);
      saveBlob(new Blob([svg], { type: 'image/svg+xml' }), fileName() + '.svg');
      onToast && onToast(`SVG vectoriel ${fmt.name} téléchargé`);
    } catch (e) { onToast && onToast('Export SVG impossible : ' + e.message); }
    setBusy(false);
  };
  // Formule « fichier numérique » : PNG 300 dpi + SVG
  const doGetFiles = async () => { await doDownload(); await doDownloadSvg(); };
  // Impression : page au format exact, sans marge (→ « Enregistrer en PDF »)
  const doPrint = async () => {
    const win = window.open('', '_blank');
    if (!win) { onToast && onToast('Autorise les fenêtres pop-up pour imprimer'); return; }
    win.document.write('<p style="font-family:system-ui;color:#666;padding:24px">Préparation du poster…</p>');
    setBusy(true);
    try {
      const c = await exportCanvas();
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
      const url = URL.createObjectURL(blob);
      win.document.open();
      win.document.write(`<!doctype html><html><head><title>${(data.title || 'Poster').replace(/</g, '')}</title><style>@page{size:${fmt.mm[0]}mm ${fmt.mm[1]}mm;margin:0}html,body{margin:0;background:#888}img{display:block;width:${fmt.mm[0]}mm;height:${fmt.mm[1]}mm;margin:0 auto}@media screen{img{width:auto;height:96vh;margin:2vh auto;box-shadow:0 10px 40px rgba(0,0,0,.4)}}</style></head><body><img src="${url}" onload="setTimeout(function(){print()},250)"></body></html>`);
      win.document.close();
    } catch (e) { try { win.close(); } catch (er) {} onToast && onToast('Impression impossible : ' + e.message); }
    setBusy(false);
  };

  const chip = (on) => `rounded-lg px-2.5 h-9 text-[12.5px] font-medium transition-all ${on ? 'bg-white text-neutral-900 shadow-sm' : 'bg-white/[0.05] text-neutral-300 hover:bg-white/[0.1] hover:text-white'}`;
  const inputCls = 'w-full h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] outline-none placeholder:text-neutral-500 focus:border-white/30 focus:bg-white/[0.06] transition-colors';
  const ms = PO_MOCK_STYLE[stageMock];
  const metricValues = usePoMemo(() => {
    const m = {}; poStats(agg, order, infoX).forEach((st) => { m[st.key] = st.value + (st.unit ? ' ' + st.unit : ''); }); return m;
  }, [agg, order, infoX]);
  // Valeur saisie à la main (double-clic dans la liste) ; vide = valeur calculée
  const setMetricValue = (k, v) => setCfg((c) => { const vals = { ...(c.values || {}) }; if (v && v.trim()) vals[k] = v.trim(); else delete vals[k]; return { values: vals }; });

  return (
    <div className={`flex-1 min-h-0 flex ${isMobile ? 'flex-col overflow-y-auto sb-scroll' : ''}`}>
      {/* Modèles */}
      <div className={isMobile ? 'order-2 shrink-0 pt-4 pb-2 border-t border-white/[0.06]' : 'w-[236px] shrink-0 overflow-y-auto sb-scroll px-4 py-5 border-r border-white/[0.06]'}>
        <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 mb-3 ${isMobile ? 'px-4' : ''}`}>Modèles</div>
        <div className={isMobile ? 'flex gap-3 overflow-x-auto sb-scroll pb-2 px-4 snap-x' : 'grid grid-cols-2 gap-x-3 gap-y-4'}>
          {POSTER_TEMPLATES.map((t) => {
            const sel = t.id === tpl.id, locked = !poOpen(t.id);
            return (
              <button key={t.id} onClick={() => !locked && setTplId(t.id)} disabled={locked} title={locked ? 'Bientôt disponible' : undefined}
                className={`text-left group ${locked ? 'cursor-not-allowed' : ''} ${isMobile ? 'w-[92px] shrink-0 snap-start' : ''}`}>
                <div className={`relative rounded-[6px] overflow-hidden transition-all bg-neutral-800 ${sel ? 'ring-2 ring-white ring-offset-[3px] ring-offset-neutral-950' : locked ? 'ring-1 ring-white/[0.06]' : 'ring-1 ring-white/10 group-hover:ring-white/40 group-hover:-translate-y-0.5'}`}
                  style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, boxShadow: sel ? '0 10px 30px -10px rgba(0,0,0,0.8)' : undefined }}>
                  <canvas ref={(el) => { thumbRefs.current[t.id] = el; }} width={240} height={340} className={`block w-full h-full ${locked ? 'opacity-30 grayscale' : ''}`} />
                  {locked && (
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="w-8 h-8 rounded-full grid place-items-center bg-black/70 text-white/80 ring-1 ring-white/15 backdrop-blur"><I.Lock size={14} /></span>
                    </span>
                  )}
                  {t.photoBg && !locked && <span title="Photo de fond" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full grid place-items-center bg-black/60 text-white backdrop-blur"><I.ImagePlus size={11} /></span>}
                  {!locked && <span title={`Jusqu'à ${t.maxPhotos} photos du voyage`} className="absolute top-1.5 left-1.5 h-5 px-1.5 rounded-full flex items-center gap-1 bg-black/60 text-white text-[10px] font-semibold tabular-nums backdrop-blur">
                    <I.Camera size={10} /> {t.maxPhotos}
                  </span>}
                </div>
                <div className="mt-2 px-0.5 leading-tight">
                  <div className={`text-[12.5px] font-medium truncate ${sel ? 'text-white' : locked ? 'text-neutral-500' : 'text-neutral-300'}`}>{t.name}</div>
                  {!isMobile && <div className="text-[10.5px] text-neutral-500">{locked ? 'Bientôt' : t.kind}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scène : le poster (au mur si un cadre est choisi) */}
      <div className={`min-w-0 relative flex flex-col items-center justify-center ${isMobile ? 'order-1 shrink-0 px-5 pt-5 pb-4' : 'flex-1 px-10 py-8'}`}
        style={{ ...(isMobile ? { height: 'min(64vh, 620px)' } : {}), background: stageMock !== 'none' ? 'radial-gradient(ellipse at 50% 30%, #ebe6de 0%, #d8d1c6 65%, #c9c1b4 100%)' : 'radial-gradient(ellipse at 50% 40%, #1d1d1f 0%, #0b0b0c 75%)' }}>
        <div className="relative min-h-0 flex-1 w-full grid place-items-center">
          <div className="relative h-full max-w-full" style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, maxHeight: '100%' }}>
            <div className="absolute inset-0" style={ms ? {
              padding: '3.2%', background: ms.border,
              boxShadow: `0 40px 70px -24px rgba(0,0,0,0.5), 0 14px 26px -12px rgba(0,0,0,0.35)${ms.shadow ? ', ' + ms.shadow : ''}`,
            } : { boxShadow: '0 30px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)' }}>
              <div className="relative w-full h-full overflow-hidden" style={ms ? { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' } : undefined}>
                <canvas ref={previewRef} width={1000} height={1414} className="block w-full h-full" />
                {!ready && <div className="absolute inset-0 grid place-items-center text-[12px] text-neutral-400 bg-neutral-900">Préparation…</div>}
                {step === 1 && tpl.photoSlot && cfg.photoSlot !== false && !photos.length && ready && slot && (
                  <button onClick={() => photosRef.current && photosRef.current.click()}
                    style={{ left: `${(slot.l + slot.w / 2) * 100}%`, top: `${(slot.t + slot.h * 0.82) * 100}%`, transform: 'translate(-50%, -50%)' }}
                    className="absolute whitespace-nowrap flex items-center gap-1.5 rounded-full pl-2.5 pr-3 h-7 text-[11.5px] font-medium bg-black/55 text-white/90 ring-1 ring-white/20 backdrop-blur hover:bg-black/70 transition-colors">
                    <I.ImagePlus size={13} /> Ajouter une photo
                  </button>
                )}
                {tpl.photoBg && !bgPhoto && ready && (
                  <button onClick={() => bgRef.current && bgRef.current.click()}
                    className="absolute left-1/2 top-[28%] -translate-x-1/2 flex items-center gap-2 rounded-full pl-3.5 pr-4 h-10 text-[13px] font-semibold bg-white text-neutral-900 shadow-xl hover:scale-[1.03] transition-transform">
                    <I.ImagePlus size={16} /> Ajouter ta photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={`mt-4 text-[11.5px] tabular-nums ${stageMock !== 'none' ? 'text-neutral-600' : 'text-neutral-500'}`}>
          {fmt.name}{fmt.sub !== 'cm' ? ` · ${fmt.sub}` : ' cm'} · {exp.w} × {exp.h} px · {exp.dpi} dpi{stageMock !== 'none' ? ' · cadre en aperçu' : ''}
        </div>
      </div>

      {/* Inspecteur */}
      <div className={isMobile ? 'order-3 flex flex-col border-t border-white/[0.06]' : 'w-[340px] shrink-0 flex flex-col border-l border-white/[0.06] bg-white/[0.015]'}>
        <PoStepper step={step} setStep={setStep} />
        <div className={isMobile ? '' : 'flex-1 overflow-y-auto sb-scroll'}>
          <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setBg(e.target.files[0]); e.target.value = ''; }} />
          <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
          {step === 1 && (<>
          {routeTools}

          <StudioSection title="Activité">
            <div className="relative">
              <button onClick={() => setActOpen((v) => !v)}
                className={`w-full h-10 flex items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${actOpen ? 'bg-white/[0.12]' : 'bg-white/[0.06] hover:bg-white/[0.1]'}`}>
                {(() => { const Ico = I[act.icon] || I.Route; return <Ico size={16} />; })()}
                <span className="flex-1 text-left truncate">{act.label}</span>
                <span className="text-neutral-400 transition-transform" style={{ transform: actOpen ? 'rotate(180deg)' : 'none' }}><I.ChevronDown size={14} /></span>
              </button>
              {actOpen && <div className="fixed inset-0 z-10" onClick={() => setActOpen(false)}></div>}
              {actOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl bg-neutral-900 ring-1 ring-white/10 shadow-2xl p-1 animate-menu">
                  {PO_ACTIVITIES.map((a) => {
                    const Ico = I[a.icon] || I.Route;
                    const on = a.id === actId;
                    return (
                      <button key={a.id} onClick={() => { setActId(a.id); setActOpen(false); }}
                        className={`w-full h-9 flex items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] text-left ${on ? 'bg-white/[0.1] text-white' : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white'}`}>
                        <Ico size={15} /> <span className="flex-1">{a.label}</span>
                        {on && <I.Check size={13} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </StudioSection>

          <StudioSection title="Textes">
            <div className="flex flex-col gap-2">
              <ShareFieldRow dark label="Titre" on={showTitle} onToggle={() => setShowTitle((v) => !v)} />
              {showTitle && <input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder={initialTitle || 'Titre du poster'} maxLength={80} className={inputCls} />}
              <ShareFieldRow dark label="Sous-titre" on={showSub} onToggle={() => setShowSub((v) => !v)} />
              {showSub && <input value={subtitle == null ? defaultSub : subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex. Bretagne · été 2026" maxLength={80} className={inputCls} />}
              <ShareFieldRow dark label="Coordonnées GPS" on={coords} onToggle={() => setCoords((v) => !v)} />
            </div>
          </StudioSection>

          <StudioSection title="Infos affichées" aside={<span className="text-[11px] text-neutral-500">{metrics.length}</span>}>
            <div className="text-[11px] text-neutral-500 mb-2">Glisse pour réordonner, double-clique une valeur pour la modifier.</div>
            <MetricsList order={order} setOrder={setOrder} enabled={enabled} onToggle={toggleMetric} values={metricValues} overrides={cfg.values || {}} onEdit={setMetricValue} />
            <p className="mt-2.5 text-[11px] text-neutral-500 leading-snug">Proposées selon l'activité. Les durées sans GPS sont estimées pour {act.label.toLowerCase()}.</p>
          </StudioSection>

          <StudioSection title="Photo" aside={photoOn ? <span className="text-[11px] text-neutral-500">{Math.min(photos.length, tpl.maxPhotos)}/{tpl.maxPhotos}</span> : <span className="text-[11px] text-neutral-500">Non</span>}>
            {tpl.photoBg && (<>
            <div className="text-[12.5px] font-medium text-neutral-200 mb-2">Photo de fond</div>
            {bgPhoto ? (
              <div className="flex items-center gap-3 rounded-lg p-2 bg-white/[0.04]">
                <img src={bgPhoto.url} alt="" className="w-12 h-12 rounded-md object-cover" />
                <div className="flex-1 min-w-0 text-[12px] text-neutral-400">Photo de fond du poster</div>
                <button onClick={() => bgRef.current.click()} className="text-[12px] font-medium text-blue-400 hover:text-blue-300 px-1">Changer</button>
                <button onClick={() => setBgPhoto(null)} aria-label="Retirer" className="w-8 h-8 grid place-items-center rounded-md text-neutral-400 hover:text-white hover:bg-white/10"><I.Trash size={14} /></button>
              </div>
            ) : (
              <button onClick={() => bgRef.current.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setBg(e.dataTransfer.files[0]); }}
                className="w-full h-16 rounded-lg border border-dashed border-white/15 text-[12.5px] text-neutral-300 flex items-center justify-center gap-2 hover:border-white/35 hover:bg-white/[0.03] transition-colors">
                <I.ImagePlus size={16} /> Choisir ou glisser une photo
              </button>
            )}
            </>)}
            {tpl.photoSlot && (
              <div className="-mx-2 mb-1">
                <ShareFieldRow dark label="Photo sur le poster" on={photoOn} onToggle={() => setCfg((c) => ({ photoSlot: c.photoSlot === false }))} />
              </div>
            )}
            {photoOn && (<>
            {tpl.photoSlot && !photos.length && <p className="mb-3 text-[11px] text-neutral-500 leading-snug">Un emplacement photo est réservé sur le poster : ajoute ta photo ou désactive-le.</p>}
            <div className={`text-[12.5px] font-medium text-neutral-200 mb-2 ${tpl.photoBg ? 'mt-4' : ''}`}>Photos du voyage</div>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden group">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label="Retirer"
                    className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-full bg-black/65 text-white opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><I.X size={12} /></button>
                </div>
              ))}
              {photos.length < 4 && (
                <button onClick={() => photosRef.current.click()}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); addPhotos(e.dataTransfer.files); }}
                  className="aspect-square rounded-md border border-dashed border-white/15 grid place-items-center text-neutral-400 hover:text-white hover:border-white/35 transition-colors" aria-label="Ajouter des photos">
                  <I.Plus size={18} />
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-neutral-500 leading-snug">
              Le modèle <span className="text-neutral-300">{tpl.name}</span> affiche jusqu'à {tpl.maxPhotos} photo{tpl.maxPhotos > 1 ? 's' : ''}.
              {photos.length > tpl.maxPhotos && <span className="text-amber-400"> {photos.length - tpl.maxPhotos} non affichée{photos.length - tpl.maxPhotos > 1 ? 's' : ''} ici.</span>}
            </p>
            </>)}
          </StudioSection>


          <div className="p-5 pt-4" style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' } : undefined}>
            <button onClick={() => { setStep(2); }} disabled={!routes.length}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-neutral-900 bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors">
              Suivant : la carte <I.ChevronRight size={17} />
            </button>
          </div>
          </>)}

          {step === 2 && (<>
          <StudioSection title="Couleur du tracé">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="relative">
                <button title="Couleur du modèle" onClick={() => setColor('auto')}
                  className={`h-7 px-2.5 mr-0.5 rounded-full text-[11.5px] font-semibold bg-white/[0.06] ${color === 'auto' ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}>Auto</button>
                <RecStar />
              </span>
              {poRecFirst(SHARE_COLORS.filter((c) => c.value !== 'routes'), (c) => rec.colors.includes(c.value)).sort((a, b) => (rec.colors.includes(a.value) && rec.colors.includes(b.value) ? rec.colors.indexOf(a.value) - rec.colors.indexOf(b.value) : 0)).map((c) => (
                <span key={c.value} className="relative">
                  <button title={c.label + (rec.colors.includes(c.value) ? ' · recommandé' : '')} onClick={() => setColor(c.value)}
                    className={`block w-7 h-7 rounded-full transition-transform hover:scale-110 ${color === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}
                    style={{ background: c.value }} />
                  {rec.colors.includes(c.value) && <RecStar />}
                </span>
              ))}
              {/* Couleur personnalisée : sélecteur natif sous la pastille arc-en-ciel */}
              <label title="Choisir ma couleur"
                className={`relative w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110 overflow-hidden ${customOn ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}
                style={{ background: customOn ? color : 'conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ec4899,#ef4444)' }}>
                <input type="color" value={customOn ? color : customColor} onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </label>
            </div>
            <p className="mt-2.5 text-[11px] text-neutral-500 flex items-center gap-1.5"><RecDot /> Recommandé pour l’impression avec {tpl.name}</p>
          </StudioSection>

          {tpl.bgs && (
            <StudioSection title="Couleur de fond">
              <div className="flex flex-wrap items-center gap-2">
                {poRecFirst(tpl.bgs, (b) => b.hex === rec.bg).map((b) => (
                  <span key={b.hex} className="relative">
                    <button title={b.name} onClick={() => setBgColor(b.hex)}
                      className={`block w-8 h-8 rounded-lg transition-transform hover:scale-110 ${bgColor === b.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}
                      style={{ background: b.hex }} />
                    {rec.bg === b.hex && <RecStar />}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-neutral-500 leading-snug">Teintes sombres uniquement : le blanc et le tracé ressortent nettement à l’impression.</p>
            </StudioSection>
          )}


          <StudioSection title="Carte">
            {/* Indépendant de la carte : les villes peuvent s'afficher seules */}
            <div className="-mx-2">
              <ShareFieldRow dark label="Nom des villes" on={mapLabels} onToggle={() => setMapLabels((v) => !v)} />
            </div>
            <div className="-mx-2">
              <ShareFieldRow dark label="Carte derrière le tracé" on={showMap} onToggle={() => setShowMap((v) => !v)} />
            </div>
            {!showMap && rec.map && <p className="text-[11px] text-neutral-500 flex items-center gap-1.5"><RecDot /> Recommandée sur ce modèle</p>}
            {showMap && (
              <>
                {tpl.id !== 'satellite' ? (
                  <>
                    <div className="text-[12.5px] font-medium text-neutral-200 mt-3 mb-2">Style de carte</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {poRecFirst(PM_STYLES, (m) => m.id === rec.mapStyle).map((m) => (
                        <button key={m.id} onClick={() => setMapStyle(m.id)} title={m.id === rec.mapStyle ? 'Recommandé' : undefined}
                          className={`${chip(m.id === mapStyle)} flex items-center justify-center gap-1.5`}>
                          {m.name}{m.id === rec.mapStyle && <RecDot />}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-500 leading-snug">
                      {mapStyle === 'epure' ? 'Littoral, plans d’eau et grands axes.' : mapStyle === 'routes' ? 'Réseau routier détaillé, rivières et villages.' : 'Forêts, rivières, sentiers et sommets.'} Carte vectorielle aux couleurs du modèle.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-neutral-500 leading-snug">Imagerie satellite (photo aérienne) avec noms de lieux vectoriels.</p>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <span className="text-[12.5px] font-medium text-neutral-200 w-16">Opacité</span>
                  <input type="range" min={15} max={100} step={5} value={mapOpacity} onChange={(e) => setMapOpacity(Number(e.target.value))} className="flex-1 accent-white" />
                  <span className="text-[12px] tabular-nums text-neutral-400 w-10 text-right">{mapOpacity} %</span>
                </div>
                <div className="mt-1 text-[11px] text-neutral-500 flex items-center gap-1.5">
                  <RecDot /> Recommandé : {rec.mapOpacity} %
                  {mapOpacity !== rec.mapOpacity && <button onClick={() => setMapOpacity(rec.mapOpacity)} className="ml-1 text-neutral-300 hover:text-white underline underline-offset-2">rétablir</button>}
                </div>
              </>
            )}

          </StudioSection>

          <div className="p-5 pt-4" style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' } : undefined}>
            <button onClick={() => { setStep(3); if (mock === 'none') setMock('noir'); }} disabled={!routes.length}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-neutral-900 bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors">
              Suivant : le cadre <I.ChevronRight size={17} />
            </button>
          </div>
          </>)}

          {step === 3 && (
          <div className="pb-6" style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' } : undefined}>
            <div className="px-5 pt-5 pb-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 mb-2.5">Format</div>
              <div className="grid grid-cols-3 gap-1.5">
                {POSTER_FORMATS.map((f) => (
                  <button key={f.id} onClick={() => setFmtId(f.id)} className={`${chip(f.id === fmtId)} h-auto py-2 flex flex-col items-center leading-tight`}>
                    <span>{f.name}</span><span className="text-[10px] opacity-60 mt-0.5">{f.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          <StudioSection title="Liseré & bordure">
            <div className="grid grid-cols-2 gap-1.5">
              {POSTER_BORDERS.map((b) => <button key={b.id} onClick={() => setBorder(b.id)} className={chip(b.id === border)}>{b.name}</button>)}
            </div>
            <p className="mt-2 text-[11px] text-neutral-500 leading-snug">Imprimée avec le poster (fichier et tirage).</p>
          </StudioSection>
            <StudioSection title="Cadre">
            <p className="-mt-1 mb-3 text-[11px] text-neutral-500 leading-snug">Aperçu en direct au mur. Le cadre est livré avec le tirage encadré.</p>
              <div className="flex gap-2.5">
                {POSTER_MOCKUPS.map((m) => (
                  <button key={m.id} onClick={() => setMock(m.id)} title={m.name} className="flex flex-col items-center gap-1.5">
                    <span className={`w-10 h-10 rounded-lg grid place-items-center ${mock === m.id ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}
                      style={{ background: m.id === 'none' ? 'transparent' : m.swatch }}>
                      {m.id === 'none' ? <I.X size={14} /> : <span className="w-5 h-6 rounded-[2px] bg-neutral-100"></span>}
                    </span>
                    <span className={`text-[10.5px] ${mock === m.id ? 'text-white' : 'text-neutral-500'}`}>{m.id === 'none' ? 'Sans cadre' : m.name}</span>
                  </button>
                ))}
              </div>
            </StudioSection>
            <div className="px-5 pt-5">
              <div className="text-[18px] font-semibold tracking-tight">Imprimez votre tracé</div>
              <div className="text-[12.5px] text-neutral-400 mt-0.5 mb-3">{tpl.name} · {fmt.name}{fmt.sub !== 'cm' ? ` (${fmt.sub})` : ' cm'}</div>
            </div>
            <div className="px-5 flex flex-col gap-2.5">
              {[
                { id: 'file', icon: 'Download', title: 'Fichier numérique HD', desc: 'PNG 300 dpi + SVG vectoriel, à imprimer où tu veux', price: '3,99 €' },
                { id: 'print', icon: 'Poster', title: 'Tirage encadré', desc: 'Papier d’art, livré avec le cadre de ton choix', price: 'Bientôt' },
              ].map((o) => {
                const on = offer === o.id; const Ico = I[o.icon];
                return (
                  <button key={o.id} onClick={() => { setOffer(o.id); if (o.id === 'print' && mock === 'none') setMock('noir'); }}
                    className={`text-left rounded-xl p-3.5 flex items-start gap-3 transition-all ${on ? 'bg-white/[0.08] ring-2 ring-white' : 'bg-white/[0.03] ring-1 ring-white/10 hover:ring-white/25'}`}>
                    <span className={`mt-0.5 w-4 h-4 rounded-full shrink-0 grid place-items-center border-2 ${on ? 'border-white' : 'border-neutral-600'}`}>{on && <span className="w-2 h-2 rounded-full bg-white"></span>}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 text-[13.5px] font-semibold"><Ico size={15} /> {o.title}</span>
                      <span className="block text-[12px] text-neutral-400 mt-0.5 leading-snug">{o.desc}</span>
                    </span>
                    <span className={`text-[14px] font-semibold tabular-nums whitespace-nowrap ${o.id === 'print' ? 'text-neutral-500 text-[12px] mt-0.5' : ''}`}>{o.price}</span>
                  </button>
                );
              })}
            </div>

            {offer === 'file' && (
              <div className="px-5 mt-5">
                <ul className="flex flex-col gap-2 text-[12.5px] text-neutral-300">
                  <li className="flex items-center gap-2"><I.Check size={13} /> PNG {exp.w} × {exp.h} px · {exp.dpi} dpi</li>
                  <li className="flex items-center gap-2"><I.Check size={13} /> SVG vectoriel : carte, tracé et textes nets à toute taille</li>
                  <li className="flex items-center gap-2"><I.Check size={13} /> Polices intégrées, prêt pour l’imprimeur</li>
                </ul>
                <button onClick={doGetFiles} disabled={busy || !routes.length}
                  className="mt-5 w-full h-12 flex items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-neutral-900 bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors">
                  <I.Download size={16} /> {busy ? 'Préparation des fichiers…' : 'Télécharger · 3,99 €'}
                </button>
                <p className="mt-2 text-[11px] text-neutral-500 text-center">Version démo : le paiement n’est pas encore activé.</p>
                <button onClick={doPrint} disabled={busy || !routes.length} className="mt-3 w-full text-[12.5px] text-neutral-400 hover:text-white">
                  ou imprimer chez moi (PDF)
                </button>
              </div>
            )}

            {offer === 'print' && (
              <div className="mt-2">
                <div className="px-5 pt-4">
                  <button disabled className="w-full h-12 rounded-xl text-[14px] font-semibold bg-white/[0.08] text-neutral-400 cursor-not-allowed">
                    Commander le tirage · bientôt disponible
                  </button>
                </div>
              </div>
            )}

            {/* Enregistrer ma version */}
            <div className="mx-5 mt-6 pt-5 border-t border-white/[0.07]">
              <button onClick={saveVersion}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-neutral-100 bg-white/[0.06] hover:bg-white/[0.1] transition-colors">
                <I.Check size={14} /> Enregistrer ma version
              </button>
              <p className="mt-2 text-[11px] text-neutral-500 leading-snug">Chaque modèle garde ses propres réglages, enregistrés automatiquement sur cet appareil.</p>
              {versions.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 mb-2">Mes versions</div>
                  <div className="flex flex-col gap-1">
                    {versions.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 rounded-lg px-2.5 h-10 bg-white/[0.03] hover:bg-white/[0.06]">
                        <button onClick={() => openVersion(v)} className="flex-1 min-w-0 text-left">
                          <div className="text-[12.5px] font-medium truncate">{v.name}</div>
                          <div className="text-[10.5px] text-neutral-500">{new Date(v.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        </button>
                        <button onClick={() => setVersions((vs) => vs.filter((x) => x.id !== v.id))} aria-label="Supprimer" className="w-7 h-7 grid place-items-center rounded-md text-neutral-500 hover:text-white hover:bg-white/10"><I.Trash size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PosterPane, POSTER_TEMPLATES, POSTER_FORMATS, renderPoster, StudioSection, readImageFile });
