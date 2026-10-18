// Studio poster : affiches imprimables de tes tracés (trek, marathon, road trip
// moto, tour à vélo…). 8 modèles, formats papier (A4 → 50×70), cadres, photos
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
function poStats(agg, keys) {
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
  });
  return out;
}

// ---------------------------------------------------------------- utilitaires de dessin
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
    if (o.sepia) {
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

// ---------------------------------------------------------------- les 8 modèles
const POSTER_TEMPLATES = [
  {
    // Plan technique : grille, cartouche, échelle, nord
    id: 'blueprint', name: 'Plan', kind: 'Technique', dark: true, maxPhotos: 3, mapDefault: true,
    async draw(ctx, d, w, h) {
      const u = w / 1200, bg = '#103c6b', line = 'rgba(255,255,255,0.85)';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      const gs = w / 48;
      for (let i = 0, x = 0; x <= w; i++, x += gs) { ctx.fillStyle = i % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(x, 0, 1.2 * u, h); }
      for (let i = 0, y = 0; y <= h; i++, y += gs) { ctx.fillStyle = i % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(0, y, w, 1.2 * u); }
      const M = 50 * u;
      ctx.strokeStyle = line; ctx.lineWidth = 3 * u; ctx.strokeRect(M, M, w - 2 * M, h - 2 * M);
      ctx.lineWidth = 1.2 * u; ctx.strokeRect(M + 12 * u, M + 12 * u, w - 2 * M - 24 * u, h - 2 * M - 24 * u);
      // Cartouche
      const items = d.stats.map((s) => [s.label, s.value + (s.unit ? ' ' + s.unit : '')]);
      items.push(['Activité', d.activityLabel]);
      if (d.routes[0]) items.push(['Départ', poDms(d.routes[0].coords[0][0], 'N', 'S') + '  ' + poDms(d.routes[0].coords[0][1], 'E', 'O')]);
      const cw = w * 0.5, rh = 50 * u, ch = 112 * u + items.length * rh;
      const cx = w - M - 12 * u - cw, cy = h - M - 12 * u - ch;
      ctx.fillStyle = bg; ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = line; ctx.lineWidth = 2 * u; ctx.strokeRect(cx, cy, cw, ch);
      poLine(ctx, d.title || 'Itinéraire', cx + 26 * u, cy + 60 * u, cw - 52 * u, 44 * u, '#fff', { upper: true, spacing: 0.06 });
      if (d.subtitle) stLabel(ctx, d.subtitle, cx + 26 * u, cy + 94 * u, 16 * u, 'rgba(255,255,255,0.65)');
      items.forEach(([k, v], i) => {
        const y = cy + 112 * u + i * rh;
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx, y, cw, 1.5 * u);
        stLabel(ctx, k, cx + 26 * u, y + 32 * u, 15 * u, 'rgba(255,255,255,0.65)');
        ctx.font = stFont(700, 24 * u, ST_NUM); ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
        ctx.fillText(stWrap(ctx, v, cw * 0.55, 1)[0] || '', cx + cw - 26 * u, y + 34 * u);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx + cw * 0.38, cy + 112 * u, 1.5 * u, ch - 112 * u);
      // Photos punaisées à gauche du cartouche
      const leftX = M + 50 * u, leftW = cx - 40 * u - leftX;
      if (d.photos.length) poPhotos(ctx, d.photos.slice(0, 3), leftX, cy + 70 * u, leftW, ch - 110 * u, { gap: 18 * u, border: 8 * u, rotate: 2, shadow: 18 * u, maxRatio: 1.25, align: 'left', tape: true, u });
      // Tracé
      const proj = stFit(d.routes, { x: M + 110 * u, y: M + 130 * u, w: w - 2 * M - 220 * u, h: cy - M - 230 * u });
      if (d.showMap) {
        // Carte en filigrane : tuiles sombres en « éclaircir » sur le bleu, au-dessus du cartouche
        ctx.save(); ctx.beginPath(); ctx.rect(M + 13 * u, M + 13 * u, w - 2 * M - 26 * u, cy - M - 30 * u); ctx.clip();
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.6;
        await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h: cy }, 'url', d.pr);
        await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h: cy }, 'labels', d.pr);
        ctx.restore();
      }
      ctx.save(); ctx.setLineDash([2 * u, 10 * u]);
      stDrawRoutes(ctx, d.routes, proj, { color: 'rgba(255,255,255,0.35)', width: 18 * u, markers: false });
      ctx.restore();
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffffff'), width: 4 * u, markers: false });
      const ends = d.routes.length ? [d.routes[0].coords[0], d.routes[d.routes.length - 1].coords.slice(-1)[0]] : [];
      ends.forEach((c, i) => {
        const [x, y] = proj.px(c[0], c[1]);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.arc(x, y, 16 * u, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 28 * u, y); ctx.lineTo(x + 28 * u, y); ctx.moveTo(x, y - 28 * u); ctx.lineTo(x, y + 28 * u); ctx.stroke();
        stLabel(ctx, i ? 'B' : 'A', x + 30 * u, y - 22 * u, 18 * u, '#fff');
      });
      // Nord + échelle
      const nx = w - M - 90 * u, ny = M + 100 * u;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(nx, ny - 46 * u); ctx.lineTo(nx + 18 * u, ny + 14 * u); ctx.lineTo(nx, ny + 2 * u); ctx.lineTo(nx - 18 * u, ny + 14 * u); ctx.closePath(); ctx.fill();
      stLabel(ctx, 'N', nx, ny + 50 * u, 20 * u, '#fff', 'center');
      poScaleBar(ctx, d, proj, leftX, cy + 14 * u, Math.min(leftW, w * 0.22), '#fff', u);
      await stDrawLogo(ctx, M + 50 * u, M + 60 * u, 26 * u, '#ffffff');
      if (d.coords && d.routes[0]) stLabel(ctx, poCoords(d), M + 50 * u, M + 120 * u, 14 * u, 'rgba(255,255,255,0.7)');
    },
  },
  {
    // Carte de nuit : fond sombre, tracé lumineux
    id: 'nuit', name: 'Nuit', kind: 'Carte', dark: true, maxPhotos: 3, mapDefault: true,
    async draw(ctx, d, w, h) {
      const u = w / 1200;
      ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, w, h);
      const L = stStatsLayout(ctx, d.stats, w - 220 * u, { maxSize: 70 * u, labelSize: 20 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - 130 * u - L.height;
      const titleY = statsTop - 90 * u;
      const ph = d.photos.length ? 190 * u : 0;
      const photosTop = titleY - 120 * u - ph;
      const mapBottom = ph ? photosTop - 50 * u : titleY - 160 * u;
      const proj = stFit(d.routes, { x: 140 * u, y: 230 * u, w: w - 280 * u, h: mapBottom - 230 * u }, 15);
      if (d.showMap) await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h }, 'url', d.pr);
      if (d.showMap) await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h }, 'labels', d.pr);
      let g = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.2, w / 2, h * 0.5, w * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const fadeTop = (ph ? photosTop : titleY) - 260 * u;
      g = ctx.createLinearGradient(0, fadeTop, 0, h); g.addColorStop(0, 'rgba(10,10,10,0)'); g.addColorStop(0.45, 'rgba(10,10,10,0.85)'); g.addColorStop(1, 'rgba(10,10,10,0.96)');
      ctx.fillStyle = g; ctx.fillRect(0, fadeTop, w, h);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffb648'), width: 7 * u, glow: 30 * u });
      await stDrawLogo(ctx, w / 2, 110 * u, 34 * u, '#ffffff', 'center');
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
    async draw(ctx, d, w, h) {
      const u = w / 1200, M = 100 * u;
      if (d.showMap) { ctx.fillStyle = '#26301f'; ctx.fillRect(0, 0, w, h); }
      else { const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#13202c'); bg.addColorStop(1, '#05080b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 70 * u, labelSize: 20 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - 110 * u - L.height;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, 96 * u, { maxLines: 2 });
      const titleTop = statsTop - 70 * u - (d.subtitle ? 44 * u : 0) - th;
      const ph = d.photos.length ? 170 * u : 0;
      const photosTop = titleTop - 50 * u - ph;
      const proj = stFit(d.routes, { x: 130 * u, y: 160 * u, w: w - 260 * u, h: (ph ? photosTop : titleTop) - 130 * u - 160 * u }, 16);
      if (d.showMap) await stDrawTiles(ctx, 'satellite', proj, { x: 0, y: 0, w, h }, 'url', d.pr);
      const fadeTop = (ph ? photosTop : titleTop) - 300 * u;
      let g = ctx.createLinearGradient(0, fadeTop, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = g; ctx.fillRect(0, fadeTop, w, h);
      g = ctx.createLinearGradient(0, 0, 0, 260 * u); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, 260 * u);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffd23f'), width: 7 * u, casing: 'rgba(0,0,0,0.45)', casingWidth: 3 * u });
      await stDrawLogo(ctx, M, 80 * u, 32 * u, '#ffffff');
      if (d.coords) stLabel(ctx, poCoords(d), w - M, 104 * u, 16 * u, 'rgba(255,255,255,0.75)', 'right');
      if (ph) poPhotos(ctx, d.photos, M, photosTop, w - 2 * M, ph, { gap: 14 * u, border: 6 * u, maxRatio: 1.4, align: 'left' });
      if (d.title) poLines(ctx, d.title, M, titleTop, w - 2 * M, 96 * u, '#ffffff', { maxLines: 2, lh: 1.02 });
      if (d.subtitle) stLabel(ctx, d.subtitle, M, titleTop + th + 34 * u, 22 * u, 'rgba(255,255,255,0.7)');
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, w - 2 * M, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.6)' });
    },
  },
  {
    // Ancienne carte : papier vieilli, rose des vents, cartouche
    id: 'ancienne', name: 'Ancienne carte', kind: 'Vintage', maxPhotos: 3,
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#3a2817', red = '#8e2a1b', paper = '#ead9b5';
      // Papier vieilli
      ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h);
      let g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(255,248,230,0.35)'); g.addColorStop(1, 'rgba(120,80,30,0.38)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      poSpeckle(ctx, 0, 0, w, h, 2600, '#6b4a22', 11);
      [[0.18, 0.22, 0.16], [0.78, 0.7, 0.2], [0.35, 0.86, 0.12]].forEach(([fx, fy, fr]) => {
        const sg = ctx.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, w * fr);
        sg.addColorStop(0, 'rgba(140,95,40,0.10)'); sg.addColorStop(1, 'rgba(140,95,40,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      });
      // Pliures
      ctx.fillStyle = 'rgba(255,250,235,0.35)'; ctx.fillRect(w / 2 - 1.5 * u, 0, 1.5 * u, h); ctx.fillRect(0, h / 2 - 1.5 * u, w, 1.5 * u);
      ctx.fillStyle = 'rgba(90,60,25,0.12)'; ctx.fillRect(w / 2, 0, 2 * u, h); ctx.fillRect(0, h / 2, w, 2 * u);
      // Cadre double + coins
      const M = 48 * u;
      ctx.strokeStyle = ink; ctx.lineWidth = 6 * u; ctx.strokeRect(M, M, w - 2 * M, h - 2 * M);
      ctx.lineWidth = 1.5 * u; ctx.strokeRect(M + 14 * u, M + 14 * u, w - 2 * M - 28 * u, h - 2 * M - 28 * u);
      [[M, M], [w - M, M], [M, h - M], [w - M, h - M]].forEach(([x, y]) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = ink; ctx.fillRect(-11 * u, -11 * u, 22 * u, 22 * u);
        ctx.fillStyle = paper; ctx.fillRect(-5 * u, -5 * u, 10 * u, 10 * u); ctx.restore();
      });
      // Carte
      const mx = M + 44 * u, my = M + 44 * u, mw = w - 2 * mx;
      const mh = h * (d.photos.length ? 0.42 : 0.52);
      const proj = stFit(d.routes, { x: mx + 70 * u, y: my + 70 * u, w: mw - 140 * u, h: mh - 140 * u }, 15);
      ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
      if (d.showMap) await stDrawTiles(ctx, 'topo', proj, { x: mx, y: my, w: mw, h: mh }, 'url', d.pr);
      ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#9a7646'; ctx.fillRect(mx, my, mw, mh);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(234,217,181,0.85)'; ctx.fillRect(mx, my, mw, mh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(234,217,181,0.28)'; ctx.fillRect(mx, my, mw, mh);
      poSpeckle(ctx, mx, my, mw, mh, 900, '#5b3b16', 3);
      // Graticule réel (lat/lng)
      const tl = poUnproj(proj, mx, my), br = poUnproj(proj, mx + mw, my + mh);
      const span = Math.max(br[1] - tl[1], tl[0] - br[0]);
      const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10].find((s) => span / s <= 6) || 10;
      ctx.strokeStyle = 'rgba(58,40,23,0.35)'; ctx.lineWidth = 1.2 * u; ctx.setLineDash([6 * u, 6 * u]);
      ctx.font = poFont(400, 15 * u, PO_FELL, true); ctx.fillStyle = 'rgba(58,40,23,0.8)';
      for (let lng = Math.ceil(tl[1] / step) * step; lng < br[1]; lng += step) {
        const [x] = proj.px(tl[0], lng); ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(x, my + mh); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillText(`${Math.abs(lng).toFixed(step < 0.1 ? 2 : 1)}°${lng >= 0 ? 'E' : 'O'}`, x, my + 22 * u);
      }
      for (let lat = Math.ceil(br[0] / step) * step; lat < tl[0]; lat += step) {
        const [, y] = proj.px(lat, tl[1]); ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx + mw, y); ctx.stroke();
        ctx.textAlign = 'left'; ctx.fillText(`${Math.abs(lat).toFixed(step < 0.1 ? 2 : 1)}°${lat >= 0 ? 'N' : 'S'}`, mx + 10 * u, y - 6 * u);
      }
      ctx.setLineDash([]);
      // Tracé en pointillés + croix d'arrivée
      ctx.save(); ctx.setLineDash([16 * u, 10 * u]);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, red), width: 6 * u, markers: false });
      ctx.restore();
      if (d.routes.length) {
        const a = d.routes[0].coords[0], lr = d.routes[d.routes.length - 1], b = lr.coords[lr.coords.length - 1];
        let [x, y] = proj.px(a[0], a[1]);
        ctx.beginPath(); ctx.arc(x, y, 12 * u, 0, Math.PI * 2); ctx.fillStyle = paper; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = ink; ctx.stroke();
        [x, y] = proj.px(b[0], b[1]);
        ctx.strokeStyle = poCol(d, red); ctx.lineWidth = 7 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 16 * u, y - 16 * u); ctx.lineTo(x + 16 * u, y + 16 * u); ctx.moveTo(x + 16 * u, y - 16 * u); ctx.lineTo(x - 16 * u, y + 16 * u); ctx.stroke();
      }
      // Rose des vents
      const rx = mx + mw - 110 * u, ry = my + 120 * u, R = 74 * u;
      ctx.strokeStyle = ink; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(rx, ry, R * 0.78, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.arc(rx, ry, R * 0.7, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const ang = k * Math.PI / 4 - Math.PI / 2, len = k % 2 ? R * 0.62 : R, wid = k % 2 ? R * 0.1 : R * 0.16;
        [-1, 1].forEach((side) => {
          ctx.beginPath(); ctx.moveTo(rx, ry);
          ctx.lineTo(rx + Math.cos(ang) * len, ry + Math.sin(ang) * len);
          ctx.lineTo(rx + Math.cos(ang + side * Math.PI / 2) * wid, ry + Math.sin(ang + side * Math.PI / 2) * wid);
          ctx.closePath(); ctx.fillStyle = side < 0 ? ink : paper; ctx.fill(); ctx.lineWidth = 1 * u; ctx.strokeStyle = ink; ctx.stroke();
        });
      }
      ctx.font = poFont(400, 30 * u, PO_FELL); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.fillText('N', rx, ry - R - 10 * u);
      ctx.restore();
      ctx.strokeStyle = ink; ctx.lineWidth = 3 * u; ctx.strokeRect(mx, my, mw, mh);
      ctx.lineWidth = 1 * u; ctx.strokeRect(mx + 7 * u, my + 7 * u, mw - 14 * u, mh - 14 * u);
      // Cartouche
      let y = my + mh + 70 * u;
      const cx = w / 2, iw = w - 2 * mx;
      if (d.title) y += poLines(ctx, d.title, cx, y, iw - 60 * u, 96 * u, ink, { family: PO_FELL, weight: 400, maxLines: 2, align: 'center', lh: 1.0 });
      // Ornement
      y += 26 * u;
      ctx.fillStyle = ink; ctx.fillRect(cx - 220 * u, y, 180 * u, 1.5 * u); ctx.fillRect(cx + 40 * u, y, 180 * u, 1.5 * u);
      ctx.save(); ctx.translate(cx, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-8 * u, -8 * u, 16 * u, 16 * u); ctx.restore();
      y += 30 * u;
      const sub = [d.activityLabel, d.subtitle].filter(Boolean).join(' · ');
      if (sub) { poLine(ctx, sub, cx, y + 26 * u, iw, 32 * u, '#5a4126', { family: PO_FELL, weight: 400, italic: true, align: 'center' }); y += 50 * u; }
      // Statistiques : bloc fixe au-dessus de l'échelle ; photos entre les deux
      const stats = d.stats, n = stats.length;
      const by = h - M - 60 * u;
      const sy = by - 170 * u;
      if (d.photos.length) {
        const phh = Math.min(200 * u, sy - 30 * u - (y + 16 * u));
        if (phh > 70 * u) poPhotos(ctx, d.photos, mx + 40 * u, y + 16 * u, iw - 80 * u, phh, { gap: 22 * u, border: 9 * u, borderColor: '#f3e7cc', sepia: true, shadow: 10 * u, rotate: 1.5, maxRatio: 1.35 });
      }
      if (n) {
        const colW = iw / n;
        stats.forEach((s, i) => {
          const x = mx + colW * i + colW / 2;
          poLine(ctx, s.label, x, sy + 20 * u, colW - 20 * u, 24 * u, '#6b4e2e', { family: PO_FELL, weight: 400, italic: true, align: 'center' });
          let sz = 62 * u; ctx.font = poFont(400, sz, PO_FELL);
          const txt = s.value + (s.unit ? ' ' + s.unit : '');
          const tw = ctx.measureText(txt).width; if (tw > colW - 24 * u) sz *= (colW - 24 * u) / tw;
          ctx.font = poFont(400, sz, PO_FELL); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.fillText(txt, x, sy + 20 * u + sz * 1.05);
          if (i) { ctx.save(); ctx.translate(mx + colW * i, sy + 40 * u); ctx.rotate(Math.PI / 4); ctx.fillStyle = ink; ctx.fillRect(-5 * u, -5 * u, 10 * u, 10 * u); ctx.restore(); }
        });
      }
      // Échelle façon carte ancienne + signature
      const s = poScale(d, proj, 260 * u);
      if (s) {
        const seg = s.len / 4;
        for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? paper : ink; ctx.fillRect(mx + 20 * u + k * seg, by, seg, 9 * u); }
        ctx.strokeStyle = ink; ctx.lineWidth = 1.5 * u; ctx.strokeRect(mx + 20 * u, by, s.len, 9 * u);
        ctx.font = poFont(400, 20 * u, PO_FELL, true); ctx.fillStyle = ink; ctx.textAlign = 'left';
        ctx.fillText('Échelle · ' + s.label, mx + 20 * u, by - 12 * u);
      }
      if (d.coords) { ctx.font = poFont(400, 18 * u, PO_FELL, true); ctx.fillStyle = '#5a4126'; ctx.textAlign = 'center'; ctx.fillText(poCoords(d), cx, by + 6 * u); }
      await stDrawLogo(ctx, w - mx - 20 * u, by - 18 * u, 26 * u, ink, 'right');
    },
  },
  {
    // Relief : ombrage du terrain sur papier, typographie éditoriale
    id: 'relief', name: 'Relief', kind: 'Éditorial', maxPhotos: 4,
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#1c1a17', mute = '#7d776c', M = 90 * u;
      ctx.fillStyle = '#f3f0ea'; ctx.fillRect(0, 0, w, h);
      await stDrawLogo(ctx, M, M - 26 * u, 26 * u, ink);
      if (d.coords) stLabel(ctx, poCoords(d), w - M, M - 6 * u, 15 * u, mute, 'right');
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 62 * u, labelSize: 18 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - M - L.height;
      const ruleY = statsTop - 46 * u;
      const subH = d.subtitle ? 50 * u : 0;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, 116 * u, { family: PO_SERIF, maxLines: 2, lh: 1.02 });
      const titleTop = ruleY - 46 * u - subH - th;
      const ph = d.photos.length ? 230 * u : 0;
      const mapTop = M + 30 * u, mapBottom = titleTop - 60 * u - (ph ? ph + 24 * u : 0);
      const mapH = mapBottom - mapTop;
      const proj = stFit(d.routes, { x: M + 80 * u, y: mapTop + 80 * u, w: w - 2 * M - 160 * u, h: mapH - 160 * u }, 15);
      ctx.save(); ctx.beginPath(); ctx.rect(M, mapTop, w - 2 * M, mapH); ctx.clip();
      if (d.showMap) { ctx.fillStyle = '#e6e2d9'; ctx.fillRect(M, mapTop, w - 2 * M, mapH); }
      if (d.showMap) await stDrawTiles(ctx, 'light', proj, { x: M, y: mapTop, w: w - 2 * M, h: mapH }, 'url', d.pr);
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.75;
      if (d.showMap) await stDrawTiles(ctx, 'hillshade', proj, { x: M, y: mapTop, w: w - 2 * M, h: mapH }, 'url', d.pr);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(243,240,234,0.18)'; ctx.fillRect(M, mapTop, w - 2 * M, mapH);
      ctx.globalCompositeOperation = 'source-over';
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
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#161616', mute = '#8a857c', M = 80 * u;
      ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, w, h);
      let y = M + 10 * u;
      stLabel(ctx, [d.activityLabel, d.subtitle].filter(Boolean).join('  ·  '), w / 2, y + 18 * u, 18 * u, mute, 'center');
      y += 44 * u;
      if (d.title) y += poLines(ctx, d.title, w / 2, y, w - 2 * M, 96 * u, ink, { family: PO_SERIF, maxLines: 2, align: 'center', lh: 1.04 });
      y += 40 * u;
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 56 * u, labelSize: 17 * u, cols: Math.min(4, d.stats.length || 1) });
      const footTop = h - M - 60 * u - L.height;
      const n = d.photos.length;
      const phH = n ? (n === 4 ? (footTop - 40 * u - y) * 0.48 : (footTop - 40 * u - y) * 0.34) : 0;
      const mapH = footTop - 40 * u - y - (n ? phH + 22 * u : 0);
      const proj = stFit(d.routes, { x: M + 60 * u, y: y + 60 * u, w: w - 2 * M - 120 * u, h: mapH - 120 * u }, 16);
      ctx.save(); stRoundRect(ctx, M, y, w - 2 * M, mapH, 20 * u); ctx.clip();
      ctx.fillStyle = '#eceae5'; ctx.fillRect(M, y, w - 2 * M, mapH);
      if (d.showMap) await stDrawTiles(ctx, 'light', proj, { x: M, y, w: w - 2 * M, h: mapH }, 'url', d.pr);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, 'routes'), width: 7 * u, casing: '#ffffff', casingWidth: 3 * u });
      ctx.restore();
      if (n) poPhotos(ctx, d.photos, M, y + mapH + 22 * u, w - 2 * M, phH, { gap: 22 * u, radius: 20 * u, grid: true });
      ctx.fillStyle = 'rgba(22,22,22,0.12)'; ctx.fillRect(M, footTop - 10 * u, w - 2 * M, 1.5 * u);
      if (d.stats.length) stDrawStats(ctx, d.stats, M, footTop + 20 * u, w - 2 * M, { layout: L, color: ink, labelColor: mute, dividers: true, dividerColor: 'rgba(22,22,22,0.1)' });
      await stDrawLogo(ctx, w / 2, h - M + 6 * u, 22 * u, ink, 'center');
      if (d.coords) stLabel(ctx, poCoords(d), M, h - M + 24 * u, 14 * u, mute);
    },
  },
  {
    // Photo plein cadre : ta photo en fond, tracé et chiffres par-dessus
    id: 'photo', name: 'Photo', kind: 'Ta photo', photoBg: true, dark: true, maxPhotos: 3,
    async draw(ctx, d, w, h) {
      const u = w / 1200, M = 100 * u;
      poPhotoBg(ctx, d, 0, 0, w, h);
      let g = ctx.createLinearGradient(0, 0, 0, h * 0.4); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.4);
      g = ctx.createLinearGradient(0, h * 0.42, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g; ctx.fillRect(0, h * 0.42, w, h * 0.58);
      await stDrawLogo(ctx, M, 80 * u, 32 * u, '#ffffff');
      if (d.coords) stLabel(ctx, poCoords(d), w - M, 104 * u, 16 * u, 'rgba(255,255,255,0.8)', 'right');
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 72 * u, labelSize: 20 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - 110 * u - L.height;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, 120 * u, { family: PO_SERIF, maxLines: 2, lh: 1.0 });
      const titleTop = statsTop - 70 * u - (d.subtitle ? 50 * u : 0) - th;
      const ph = d.photos.length ? 160 * u : 0;
      const photosTop = titleTop - 50 * u - ph;
      const proj = stFit(d.routes, { x: w * 0.42, y: 170 * u, w: w * 0.5, h: (ph ? photosTop : titleTop) - 120 * u - 170 * u });
      if (d.showMap) {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
        await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h }, 'url', d.pr);
        await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h }, 'labels', d.pr);
        ctx.restore();
      }
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffffff'), width: 6 * u, glow: 16 * u, markers: true });
      if (ph) poPhotos(ctx, d.photos, M, photosTop, w - 2 * M, ph, { gap: 16 * u, border: 7 * u, maxRatio: 1.3, align: 'left', shadow: 16 * u });
      if (d.title) poLines(ctx, d.title, M, titleTop, w - 2 * M, 120 * u, '#ffffff', { family: PO_SERIF, maxLines: 2, lh: 1.0 });
      if (d.subtitle) poLine(ctx, d.subtitle, M, titleTop + th + 40 * u, w - 2 * M, 34 * u, 'rgba(255,255,255,0.85)', { family: PO_SERIF, weight: 400, italic: true });
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(M, statsTop - 34 * u, w - 2 * M, 1.5 * u);
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, w - 2 * M, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.7)' });
    },
  },
  {
    // Photo + carte : photo en haut, carte et chiffres en bas
    id: 'photocarte', name: 'Photo & carte', kind: 'Ta photo', photoBg: true, maxPhotos: 3,
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#171614', mute = '#7f796f', M = 80 * u;
      const pH = Math.round(h * 0.54);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, w, h);
      poPhotoBg(ctx, d, 0, 0, w, pH);
      let g = ctx.createLinearGradient(0, pH * 0.45, 0, pH); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = g; ctx.fillRect(0, pH * 0.45, w, pH * 0.55);
      g = ctx.createLinearGradient(0, 0, 0, 220 * u); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, 220 * u);
      await stDrawLogo(ctx, M, 66 * u, 30 * u, '#ffffff');
      const tw = d.photos.length ? w * 0.5 - M : w - 2 * M; // les tirages occupent la droite
      const tsz = d.photos.length ? 88 * u : 104 * u;
      const th = poLinesHeight(ctx, d.title, tw, tsz, { family: PO_SERIF, maxLines: 3, lh: 1.0 });
      const titleTop = pH - 60 * u - (d.subtitle ? 46 * u : 0) - th;
      if (d.title) poLines(ctx, d.title, M, titleTop, tw, tsz, '#ffffff', { family: PO_SERIF, maxLines: 3, lh: 1.0 });
      if (d.subtitle) poLine(ctx, d.subtitle, M, titleTop + th + 34 * u, tw, 30 * u, 'rgba(255,255,255,0.88)', { family: PO_SERIF, weight: 400, italic: true });
      // Bas : carte + chiffres empilés
      const by = pH + 60 * u, bh = h - by - M;
      const mapW = (w - 2 * M) * 0.58;
      const proj = stFit(d.routes, { x: M + 40 * u, y: by + 40 * u, w: mapW - 80 * u, h: bh - 80 * u }, 16);
      ctx.save(); stRoundRect(ctx, M, by, mapW, bh, 16 * u); ctx.clip();
      ctx.fillStyle = '#e7e3da'; ctx.fillRect(M, by, mapW, bh);
      if (d.showMap) await stDrawTiles(ctx, 'topo', proj, { x: M, y: by, w: mapW, h: bh }, 'url', d.pr);
      ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.75)'; ctx.fillRect(M, by, mapW, bh);
      ctx.globalCompositeOperation = 'source-over';
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#e5482d'), width: 6 * u, casing: '#ffffff', casingWidth: 3 * u });
      ctx.restore();
      const sx = M + mapW + 50 * u, sw = w - M - sx;
      const top = by + 6 * u;
      stLabel(ctx, d.activityLabel, sx, top + 16 * u, 17 * u, mute);
      poStack(ctx, d.stats, sx, top + 40 * u, sw, bh - 40 * u - (d.coords ? 50 * u : 0), { u, rule: 'rgba(23,22,20,0.85)', labelColor: mute, color: ink, maxSize: 84 * u, labelSize: 17 * u });
      if (d.coords) stLabel(ctx, poCoords(d), sx, by + bh - 4 * u, 13 * u, mute);
      // Photos du voyage : tirages posés à cheval sur la photo
      if (d.photos.length) poPhotos(ctx, d.photos.slice(0, 3), w * 0.52, pH - 170 * u, w * 0.48 - M, 200 * u, { gap: 16 * u, border: 9 * u, rotate: 3, shadow: 24 * u, maxRatio: 1.0, align: 'right' });
    },
  },
];

// Rendu complet : cadre (bordure) + modèle. `scale` = px canvas par unité.
async function renderPoster(canvas, tpl, d, fmt, border, scale) {
  const ctx = canvas.getContext('2d');
  const W = PO_W, H = poHeight(fmt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (!d.routes.length) return;
  const dd = { ...d, pr: scale, photos: (d.photos || []).slice(0, tpl.maxPhotos || 4), showMap: d.showMap != null ? d.showMap : !!tpl.mapDefault };
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

// Liste des infos : interrupteur, valeur, réordonnable au glisser (souris et tactile)
function MetricsList({ order, setOrder, enabled, onToggle, values }) {
  const listRef = usePoRef(null);
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
            <button onClick={() => onToggle(k)} className="flex-1 min-w-0 h-full flex items-center gap-3 text-left">
              <span className={`flex-1 min-w-0 truncate text-[13px] ${on ? 'text-white' : 'text-neutral-500'}`}>{PO_METRICS[k]}</span>
              <span className={`text-[12px] tabular-nums whitespace-nowrap ${on ? 'text-neutral-300' : 'text-neutral-600'}`}>{values[k] || '—'}</span>
              <StorySwitch on={on} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PosterPane({ allRoutes, routes, included, setIncluded, title, setTitle, initialTitle, dark, isMobile, onToast, routeTools }) {
  const [tplId, setTplId] = usePoState('nuit');
  const [fmtId, setFmtId] = usePoState('a3');
  const [border, setBorder] = usePoState('none');
  const [mock, setMock] = usePoState('noir');
  const [color, setColor] = usePoState('auto');
  const [customColor, setCustomColor] = usePoState('#ff6b35');
  const customOn = color !== 'auto' && !SHARE_COLORS.some((c) => c.value === color);
  const [coords, setCoords] = usePoState(true);
  const [mapPref, setMapPref] = usePoState({}); // choix par modèle
  const [actOpen, setActOpen] = usePoState(false);
  const [actId, setActId] = usePoState(() => poActivityOf(allRoutes));
  const act = poActivity(actId);
  // Infos : ordre (réorganisable) + infos activées
  const orderFor = (a) => [...a.metrics, ...a.avail.filter((k) => !a.metrics.includes(k))];
  const [order, setOrder] = usePoState(() => orderFor(poActivity(poActivityOf(allRoutes))));
  const [enabled, setEnabled] = usePoState(() => new Set(poActivity(poActivityOf(allRoutes)).metrics));
  const firstAct = usePoRef(true);
  usePoEffect(() => {
    if (firstAct.current) { firstAct.current = false; return; }
    setOrder(orderFor(act)); setEnabled(new Set(act.metrics));
  }, [actId]);
  const metrics = usePoMemo(() => order.filter((k) => enabled.has(k)), [order, enabled]);
  const [showTitle, setShowTitle] = usePoState(true);
  const [showSub, setShowSub] = usePoState(true);
  const [subtitle, setSubtitle] = usePoState(null);
  const [bgPhoto, setBgPhoto] = usePoState(null);
  const [photos, setPhotos] = usePoState([]);
  const [busy, setBusy] = usePoState(false);
  const [ready, setReady] = usePoState(false);
  const previewRef = usePoRef(null);
  const thumbRefs = usePoRef({});
  const bgRef = usePoRef(null);
  const photosRef = usePoRef(null);
  const tpl = POSTER_TEMPLATES.find((t) => t.id === tplId) || POSTER_TEMPLATES[0];
  // Fond de carte : activé par défaut sur les 2 premiers modèles, modifiable sur tous
  const showMap = mapPref[tplId] != null ? mapPref[tplId] : !!tpl.mapDefault;
  const setShowMap = (f) => setMapPref((m) => ({ ...m, [tplId]: f(showMap) }));
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

  const data = usePoMemo(() => ({
    routes, agg, color, coords, activityLabel: act.label,
    title: showTitle ? (title.trim() || initialTitle || 'Mon aventure') : '',
    subtitle: showSub ? (subtitle == null ? defaultSub : subtitle) : '',
    stats: poStats(agg, metrics),
    photos, bgPhoto: bgPhoto && bgPhoto.img, showMap,
  }), [routes, agg, color, coords, title, subtitle, defaultSub, showTitle, showSub, metrics, photos, bgPhoto, actId, showMap]);

  const token = usePoRef(0);
  usePoEffect(() => {
    const my = ++token.current;
    const t = setTimeout(async () => {
      await storyFontsReady();
      if (my !== token.current) return;
      const c = previewRef.current;
      if (c) {
        const pw = 1000; c.width = pw; c.height = Math.round(pw * ratio);
        await renderPoster(c, tpl, data, fmt, border, pw / PO_W);
      }
      if (my !== token.current) return;
      setReady(true);
      for (const tp of POSTER_TEMPLATES) {
        const tc = thumbRefs.current[tp.id];
        if (tc && my === token.current) {
          tc.width = 240; tc.height = Math.round(240 * ratio);
          await renderPoster(tc, tp, { ...data, showMap: mapPref[tp.id] != null ? mapPref[tp.id] : !!tp.mapDefault }, fmt, 'none', 240 / PO_W);
        }
      }
    }, 80);
    return () => clearTimeout(t);
  }, [data, tplId, fmtId, border, mapPref]);

  const addPhotos = async (files) => {
    const list = (await Promise.all([...files].slice(0, 4).map(readImageFile))).filter(Boolean);
    if (!list.length) return;
    setPhotos((p) => [...p, ...list].slice(0, 4));
  };
  const setBg = async (file) => {
    const p = await readImageFile(file);
    if (p) { setBgPhoto(p); if (!tpl.photoBg) setTplId('photo'); }
  };

  const exportCanvas = async () => {
    const c = document.createElement('canvas');
    c.width = exp.w; c.height = exp.h;
    await storyFontsReady();
    await renderPoster(c, tpl, data, fmt, border, exp.w / PO_W);
    return c;
  };
  const fileName = () => {
    const slug = (data.title || 'aventure').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return `routdoor-poster-${slug || 'aventure'}-${fmt.id}.png`;
  };
  const doDownload = async () => {
    setBusy(true);
    try {
      const c = await exportCanvas();
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      onToast && onToast(`Poster ${fmt.name} téléchargé (${exp.w} × ${exp.h} px)`);
    } catch (e) { onToast && onToast('Export impossible : ' + e.message); }
    setBusy(false);
  };
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
  const ms = PO_MOCK_STYLE[mock];
  const toggleMetric = (k) => setEnabled((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const metricValues = usePoMemo(() => {
    const m = {}; poStats(agg, order).forEach((st) => { m[st.key] = st.value + (st.unit ? ' ' + st.unit : ''); }); return m;
  }, [agg, order]);

  return (
    <div className={`flex-1 min-h-0 flex ${isMobile ? 'flex-col overflow-y-auto sb-scroll' : ''}`}>
      {/* Modèles */}
      <div className={isMobile ? 'order-2 shrink-0 pt-4 pb-2 border-t border-white/[0.06]' : 'w-[236px] shrink-0 overflow-y-auto sb-scroll px-4 py-5 border-r border-white/[0.06]'}>
        <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 mb-3 ${isMobile ? 'px-4' : ''}`}>Modèles</div>
        <div className={isMobile ? 'flex gap-3 overflow-x-auto sb-scroll pb-2 px-4 snap-x' : 'grid grid-cols-2 gap-x-3 gap-y-4'}>
          {POSTER_TEMPLATES.map((t) => {
            const sel = t.id === tplId;
            return (
              <button key={t.id} onClick={() => setTplId(t.id)} className={`text-left group ${isMobile ? 'w-[92px] shrink-0 snap-start' : ''}`}>
                <div className={`relative rounded-[6px] overflow-hidden transition-all bg-neutral-800 ${sel ? 'ring-2 ring-white ring-offset-[3px] ring-offset-neutral-950' : 'ring-1 ring-white/10 group-hover:ring-white/40 group-hover:-translate-y-0.5'}`}
                  style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, boxShadow: sel ? '0 10px 30px -10px rgba(0,0,0,0.8)' : undefined }}>
                  <canvas ref={(el) => { thumbRefs.current[t.id] = el; }} width={240} height={340} className="block w-full h-full" />
                  {t.photoBg && <span title="Photo de fond" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full grid place-items-center bg-black/60 text-white backdrop-blur"><I.ImagePlus size={11} /></span>}
                  <span title={`Jusqu'à ${t.maxPhotos} photos du voyage`} className="absolute top-1.5 left-1.5 h-5 px-1.5 rounded-full flex items-center gap-1 bg-black/60 text-white text-[10px] font-semibold tabular-nums backdrop-blur">
                    <I.Camera size={10} /> {t.maxPhotos}
                  </span>
                </div>
                <div className="mt-2 px-0.5 leading-tight">
                  <div className={`text-[12.5px] font-medium truncate ${sel ? 'text-white' : 'text-neutral-300'}`}>{t.name}</div>
                  {!isMobile && <div className="text-[10.5px] text-neutral-500">{t.kind}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scène : le poster (au mur si un cadre est choisi) */}
      <div className={`min-w-0 relative flex flex-col items-center justify-center ${isMobile ? 'order-1 shrink-0 px-5 pt-5 pb-4' : 'flex-1 px-10 py-8'}`}
        style={{ ...(isMobile ? { height: 'min(64vh, 620px)' } : {}), background: mock !== 'none' ? 'radial-gradient(ellipse at 50% 30%, #ebe6de 0%, #d8d1c6 65%, #c9c1b4 100%)' : 'radial-gradient(ellipse at 50% 40%, #1d1d1f 0%, #0b0b0c 75%)' }}>
        <div className="relative min-h-0 flex-1 w-full grid place-items-center">
          <div className="relative h-full max-w-full" style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, maxHeight: '100%' }}>
            <div className="absolute inset-0" style={ms ? {
              padding: '3.2%', background: ms.border,
              boxShadow: `0 40px 70px -24px rgba(0,0,0,0.5), 0 14px 26px -12px rgba(0,0,0,0.35)${ms.shadow ? ', ' + ms.shadow : ''}`,
            } : { boxShadow: '0 30px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)' }}>
              <div className="relative w-full h-full overflow-hidden" style={ms ? { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' } : undefined}>
                <canvas ref={previewRef} width={1000} height={1414} className="block w-full h-full" />
                {!ready && <div className="absolute inset-0 grid place-items-center text-[12px] text-neutral-400 bg-neutral-900">Préparation…</div>}
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
        <div className={`mt-4 text-[11.5px] tabular-nums ${mock !== 'none' ? 'text-neutral-600' : 'text-neutral-500'}`}>
          {fmt.name}{fmt.sub !== 'cm' ? ` · ${fmt.sub}` : ' cm'} · {exp.w} × {exp.h} px · {exp.dpi} dpi{mock !== 'none' ? ' · cadre en aperçu' : ''}
        </div>
      </div>

      {/* Inspecteur */}
      <div className={isMobile ? 'order-3 flex flex-col border-t border-white/[0.06]' : 'w-[340px] shrink-0 flex flex-col border-l border-white/[0.06] bg-white/[0.015]'}>
        <div className={isMobile ? '' : 'flex-1 overflow-y-auto sb-scroll'}>
          {routeTools}

          <StudioSection title="Activité et infos" aside={<span className="text-[11px] text-neutral-500">{metrics.length}</span>}>
            <div className="relative mb-3">
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12.5px] font-medium text-neutral-200">Infos affichées</span>
              <span className="text-[11px] text-neutral-500">Glisse pour réordonner</span>
            </div>
            <MetricsList order={order} setOrder={setOrder} enabled={enabled} onToggle={toggleMetric} values={metricValues} />
            <p className="mt-2.5 text-[11px] text-neutral-500 leading-snug">Proposées selon l'activité. Les durées sans GPS sont estimées pour {act.label.toLowerCase()}.</p>
          </StudioSection>

          <StudioSection title="Couleur du tracé">
            <div className="flex flex-wrap items-center gap-1.5">
              <button title="Couleur du modèle" onClick={() => setColor('auto')}
                className={`h-7 px-2.5 mr-0.5 rounded-full text-[11.5px] font-semibold bg-white/[0.06] ${color === 'auto' ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}>Auto</button>
              {SHARE_COLORS.filter((c) => c.value !== 'routes').map((c) => (
                <button key={c.value} title={c.label} onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${color === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}
                  style={{ background: c.value }} />
              ))}
              {/* Couleur personnalisée : sélecteur natif sous la pastille arc-en-ciel */}
              <label title="Choisir ma couleur"
                className={`relative w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110 overflow-hidden ${customOn ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}
                style={{ background: customOn ? color : 'conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ec4899,#ef4444)' }}>
                <input type="color" value={customOn ? color : customColor} onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </label>
            </div>
          </StudioSection>

          <StudioSection title="Textes">
            <div className="flex flex-col gap-2">
              <ShareFieldRow dark label="Titre" on={showTitle} onToggle={() => setShowTitle((v) => !v)} />
              {showTitle && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={initialTitle || 'Titre du poster'} maxLength={80} className={inputCls} />}
              <ShareFieldRow dark label="Sous-titre" on={showSub} onToggle={() => setShowSub((v) => !v)} />
              {showSub && <input value={subtitle == null ? defaultSub : subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex. Bretagne · été 2026" maxLength={80} className={inputCls} />}
              <ShareFieldRow dark label="Coordonnées GPS" on={coords} onToggle={() => setCoords((v) => !v)} />
            </div>
          </StudioSection>

          <StudioSection title="Photos" aside={<span className="text-[11px] text-neutral-500">{Math.min(photos.length, tpl.maxPhotos)}/{tpl.maxPhotos}</span>}>
            <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setBg(e.target.files[0]); e.target.value = ''; }} />
            <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
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
          </StudioSection>

          <StudioSection title="Format">
            <div className="grid grid-cols-3 gap-1.5">
              {POSTER_FORMATS.map((f) => (
                <button key={f.id} onClick={() => setFmtId(f.id)} className={`${chip(f.id === fmtId)} h-auto py-2 flex flex-col items-center leading-tight`}>
                  <span>{f.name}</span><span className="text-[10px] opacity-60 mt-0.5">{f.sub}</span>
                </button>
              ))}
            </div>
          </StudioSection>

          <StudioSection title="Style">
            <div className="-mx-2 mb-1">
              <ShareFieldRow dark label="Carte derrière le tracé" on={showMap} onToggle={() => setShowMap((v) => !v)} />
            </div>
            <div className="text-[12.5px] font-medium text-neutral-200 mt-3 mb-2">Bordure imprimée</div>
            <div className="grid grid-cols-2 gap-1.5">
              {POSTER_BORDERS.map((b) => <button key={b.id} onClick={() => setBorder(b.id)} className={chip(b.id === border)}>{b.name}</button>)}
            </div>
            <div className="text-[12.5px] font-medium text-neutral-200 mt-4 mb-2">Cadre (aperçu au mur)</div>
            <div className="flex gap-2.5">
              {POSTER_MOCKUPS.map((m) => (
                <button key={m.id} onClick={() => setMock(m.id)} title={m.name} className="flex flex-col items-center gap-1.5">
                  <span className={`w-10 h-10 rounded-lg grid place-items-center ${mock === m.id ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-white/15'}`}
                    style={{ background: m.id === 'none' ? 'transparent' : m.swatch }}>
                    {m.id === 'none' ? <I.X size={14} /> : <span className="w-5 h-6 rounded-[2px] bg-neutral-100"></span>}
                  </span>
                  <span className={`text-[10.5px] ${mock === m.id ? 'text-white' : 'text-neutral-500'}`}>{m.name}</span>
                </button>
              ))}
            </div>
          </StudioSection>

          <div className="p-5 pt-4 flex flex-col gap-2" style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' } : undefined}>
          <button onClick={doDownload} disabled={busy || !routes.length}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-lg text-[13.5px] font-semibold text-neutral-900 bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors">
            <I.Download size={16} /> {busy ? 'Export en cours…' : `Télécharger en HD · ${exp.dpi} dpi`}
          </button>
          <button onClick={doPrint} disabled={busy || !routes.length}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-neutral-200 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors">
            Imprimer · PDF
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PosterPane, POSTER_TEMPLATES, POSTER_FORMATS, renderPoster, StudioSection, readImageFile });
