// Posters imprimables : 10 modèles, formats papier (A4 → 50×70), cadres.
// Même moteur canvas que les stories (story-share.jsx) : un modèle dessine
// dans une zone w×h en unités de dessin (largeur 1200), l'export rééchantillonne
// à ~300 dpi et va chercher des tuiles de carte plus détaillées.

const { useState: usePoState, useEffect: usePoEffect, useMemo: usePoMemo, useRef: usePoRef } = React;

const PO_W = 1200;

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
  { id: 'none', name: 'Aucun' },
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

// ---------------------------------------------------------------- utilitaires
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
// Titre sur une ligne, réduit pour tenir dans maxW ; renvoie la taille utilisée
function poLine(ctx, text, x, y, maxW, size, color, o = {}) {
  const t = o.upper ? String(text || '').toUpperCase() : String(text || '');
  if (!t) return 0;
  const fam = o.family || ST_TXT, wt = o.weight || 700, sp = o.spacing || 0;
  const width = (sz) => { ctx.font = stFont(wt, sz, fam); return ctx.measureText(t).width + sp * sz * Math.max(0, [...t].length - 1); };
  let sz = size; const w0 = width(sz); if (w0 > maxW) sz = sz * maxW / w0;
  ctx.font = stFont(wt, sz, fam); ctx.fillStyle = color;
  if (sp) stSpaced(ctx, t, x, y, sp * sz, o.align || 'left');
  else { ctx.textAlign = o.align || 'left'; ctx.fillText(t, x, y); }
  return sz;
}
// Titre sur plusieurs lignes (taille fixe) ; renvoie la hauteur
function poLines(ctx, text, x, y, maxW, size, color, o = {}) {
  const t = o.upper ? String(text || '').toUpperCase() : String(text || '');
  if (!t) return 0;
  ctx.font = stFont(o.weight || 700, size, o.family || ST_TXT); ctx.fillStyle = color; ctx.textAlign = o.align || 'left';
  const lines = stWrap(ctx, t, maxW, o.maxLines || 3);
  const lh = size * (o.lh || 1.04);
  lines.forEach((l, i) => ctx.fillText(l, x, y + size * 0.82 + i * lh));
  return lines.length * lh;
}
function poLinesHeight(ctx, text, maxW, size, o = {}) {
  const t = o.upper ? String(text || '').toUpperCase() : String(text || '');
  if (!t) return 0;
  ctx.font = stFont(o.weight || 700, size, o.family || ST_TXT);
  return stWrap(ctx, t, maxW, o.maxLines || 3).length * size * (o.lh || 1.04);
}
// Échelle graphique (km) sous une projection Web Mercator
function poScaleBar(ctx, d, proj, x, y, maxW, color) {
  const r = d.routes[0]; if (!r) return;
  const lat = r.coords[0][0];
  const mPerUnit = 156543.03392 * Math.cos(lat * Math.PI / 180) / proj.k;
  const maxM = maxW * mPerUnit;
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const m = steps.filter((s) => s <= maxM).pop() || steps[0];
  const len = m / mPerUnit;
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.fillRect(x, y, len / 2, 6);
  ctx.strokeRect(x, y, len, 6);
  ctx.font = stFont(600, 18, ST_NUM); ctx.textAlign = 'left';
  ctx.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, x + len + 12, y + 8);
}
// Silhouette de montagnes à partir du profil (ou synthétique)
function poRidge(pts, seed, n = 120) {
  const out = [];
  if (pts.length > 2) {
    let lo = Infinity, hi = -Infinity; pts.forEach((p) => { lo = Math.min(lo, p.e); hi = Math.max(hi, p.e); });
    const span = Math.max(30, hi - lo);
    for (let i = 0; i <= n; i++) {
      const p = pts[Math.round(i / n * (pts.length - 1))];
      out.push((p.e - lo) / span);
    }
    return out;
  }
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    out.push(0.5 + 0.25 * Math.sin(x * 7 + seed) + 0.15 * Math.sin(x * 17 + seed * 2.3) + 0.08 * Math.sin(x * 41 + seed));
  }
  return out;
}
function poFillRidge(ctx, vals, x, y, w, h, base, color) {
  ctx.beginPath(); ctx.moveTo(x, base);
  vals.forEach((v, i) => ctx.lineTo(x + (i / (vals.length - 1)) * w, y + h - v * h));
  ctx.lineTo(x + w, base); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function poShift(vals, k) { return vals.map((_, i) => vals[(i + k) % vals.length]); }

// ---------------------------------------------------------------- les 10 modèles
const POSTER_TEMPLATES = [
  {
    // Ligne claire : le tracé seul, beaucoup d'air, titre espacé
    id: 'ligne', name: 'Épure', kind: 'Minimal', ink: '#1b1b1b',
    async draw(ctx, d, w, h) {
      const ink = '#1b1b1b', mute = '#7a756c', u = w / 1200;
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, w, h);
      const M = 110 * u, iw = w - 2 * M;
      const L = stStatsLayout(ctx, d.stats, iw, { maxSize: 64 * u, labelSize: 20 * u, cols: Math.min(4, d.stats.length || 1) });
      const footY = h - M * 0.55;
      const statsTop = footY - 70 * u - L.height;
      const ruleY = statsTop - 56 * u;
      const subY = ruleY - 46 * u;
      const titleY = (d.subtitle ? subY - 44 * u : ruleY - 50 * u);
      const proj = stFit(d.routes, { x: M, y: M, w: iw, h: titleY - 110 * u - 150 * u - M });
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, ink), width: 5 * u, markers: true });
      if (d.title) poLine(ctx, d.title, w / 2, titleY, iw, 92 * u, ink, { upper: true, spacing: 0.16, align: 'center' });
      if (d.subtitle) stLabel(ctx, d.subtitle, w / 2, subY, 22 * u, mute, 'center');
      ctx.fillStyle = 'rgba(27,27,27,0.25)'; ctx.fillRect(w / 2 - 60 * u, ruleY, 120 * u, 2);
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, iw, { layout: L, color: ink, labelColor: mute, dividers: true, dividerColor: 'rgba(27,27,27,0.14)' });
      if (d.coords) stLabel(ctx, poCoords(d), M, footY, 16 * u, mute);
      await stDrawLogo(ctx, w - M, footY - 22 * u, 26 * u, ink, 'right');
    },
  },
  {
    // Carte topographique, bandeau blanc en bas
    id: 'topo', name: 'Topo', kind: 'Carte', ink: '#1b1b1b',
    async draw(ctx, d, w, h) {
      const ink = '#161616', mute = '#6b6b6b', u = w / 1200;
      const band = Math.round(h * 0.25);
      const mapH = h - band;
      ctx.fillStyle = '#eef0ea'; ctx.fillRect(0, 0, w, h);
      const proj = stFit(d.routes, { x: 110 * u, y: 110 * u, w: w - 220 * u, h: mapH - 220 * u }, 16);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, mapH); ctx.clip();
      await stDrawTiles(ctx, 'topo', proj, { x: 0, y: 0, w, h: mapH }, 'url', d.pr);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#e5482d'), width: 8 * u, casing: '#ffffff', casingWidth: 4 * u });
      ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, mapH, w, band);
      ctx.fillStyle = ink; ctx.fillRect(0, mapH, w, 3 * u);
      const M = 90 * u, iw = w - 2 * M;
      let y = mapH + 64 * u;
      if (d.title) { const s = poLine(ctx, d.title, M, y + 60 * u, iw - 240 * u, 76 * u, ink); y += s + 6 * u; }
      if (d.subtitle) { stLabel(ctx, d.subtitle, M, y + 30 * u, 20 * u, mute); }
      await stDrawLogo(ctx, w - M, mapH + 64 * u + 10 * u, 30 * u, ink, 'right');
      const L = stStatsLayout(ctx, d.stats, iw, { maxSize: 56 * u, labelSize: 18 * u, cols: Math.min(5, d.stats.length || 1) });
      if (d.stats.length) stDrawStats(ctx, d.stats, M, h - 60 * u - L.height, iw, { layout: L, align: 'left', color: ink, labelColor: mute });
      if (d.coords) stLabel(ctx, poCoords(d), w - M, mapH - 28 * u, 16 * u, 'rgba(0,0,0,0.55)', 'right');
    },
  },
  {
    // Carte de nuit : fond sombre, tracé lumineux
    id: 'nuit', name: 'Nuit', kind: 'Carte', ink: '#ffffff', dark: true,
    async draw(ctx, d, w, h) {
      const u = w / 1200;
      ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, w, h);
      const L = stStatsLayout(ctx, d.stats, w - 220 * u, { maxSize: 70 * u, labelSize: 20 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - 130 * u - L.height;
      const titleY = statsTop - 90 * u;
      const proj = stFit(d.routes, { x: 140 * u, y: 230 * u, w: w - 280 * u, h: titleY - 160 * u - 230 * u }, 15);
      await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h }, 'url', d.pr);
      await stDrawTiles(ctx, 'dark', proj, { x: 0, y: 0, w, h }, 'labels', d.pr);
      let g = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.2, w / 2, h * 0.5, w * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      g = ctx.createLinearGradient(0, titleY - 260 * u, 0, h); g.addColorStop(0, 'rgba(10,10,10,0)'); g.addColorStop(0.45, 'rgba(10,10,10,0.85)'); g.addColorStop(1, 'rgba(10,10,10,0.96)');
      ctx.fillStyle = g; ctx.fillRect(0, titleY - 260 * u, w, h);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffb648'), width: 7 * u, glow: 30 * u });
      await stDrawLogo(ctx, w / 2, 110 * u, 34 * u, '#ffffff', 'center');
      if (d.title) poLine(ctx, d.title, w / 2, titleY, w - 220 * u, 84 * u, '#ffffff', { upper: true, spacing: 0.1, align: 'center' });
      if (d.subtitle) stLabel(ctx, d.subtitle, w / 2, titleY + 50 * u, 20 * u, 'rgba(255,255,255,0.6)', 'center');
      if (d.stats.length) stDrawStats(ctx, d.stats, 110 * u, statsTop, w - 220 * u, { layout: L, labelColor: 'rgba(255,255,255,0.55)', dividers: true, dividerColor: 'rgba(255,255,255,0.18)' });
      if (d.coords) stLabel(ctx, poCoords(d), w / 2, h - 60 * u, 16 * u, 'rgba(255,255,255,0.45)', 'center');
    },
  },
  {
    // Satellite plein cadre
    id: 'satellite', name: 'Satellite', kind: 'Carte', ink: '#ffffff', dark: true,
    async draw(ctx, d, w, h) {
      const u = w / 1200, M = 100 * u;
      ctx.fillStyle = '#26301f'; ctx.fillRect(0, 0, w, h);
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 70 * u, labelSize: 20 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - 110 * u - L.height;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, 96 * u, { maxLines: 2 });
      const titleTop = statsTop - 70 * u - (d.subtitle ? 44 * u : 0) - th;
      const proj = stFit(d.routes, { x: 130 * u, y: 160 * u, w: w - 260 * u, h: titleTop - 130 * u - 160 * u }, 16);
      await stDrawTiles(ctx, 'satellite', proj, { x: 0, y: 0, w, h }, 'url', d.pr);
      let g = ctx.createLinearGradient(0, titleTop - 300 * u, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = g; ctx.fillRect(0, titleTop - 300 * u, w, h);
      g = ctx.createLinearGradient(0, 0, 0, 260 * u); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, 260 * u);
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#ffd23f'), width: 7 * u, casing: 'rgba(0,0,0,0.45)', casingWidth: 3 * u });
      await stDrawLogo(ctx, M, 80 * u, 32 * u, '#ffffff');
      if (d.coords) stLabel(ctx, poCoords(d), w - M, 104 * u, 16 * u, 'rgba(255,255,255,0.75)', 'right');
      if (d.title) poLines(ctx, d.title, M, titleTop, w - 2 * M, 96 * u, '#ffffff', { maxLines: 2, lh: 1.02 });
      if (d.subtitle) stLabel(ctx, d.subtitle, M, titleTop + th + 34 * u, 22 * u, 'rgba(255,255,255,0.7)');
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, w - 2 * M, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.6)' });
    },
  },
  {
    // Affiche rétro façon parc national : soleil, crêtes, gros titre
    id: 'retro', name: 'Rétro', kind: 'Illustré', ink: '#24392c',
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#24392c', cream = '#f0e4c8';
      ctx.fillStyle = cream; ctx.fillRect(0, 0, w, h);
      const skyH = h * 0.56;
      let g = ctx.createLinearGradient(0, 0, 0, skyH); g.addColorStop(0, '#e9874f'); g.addColorStop(0.6, '#f3b56b'); g.addColorStop(1, '#f7d59a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, skyH);
      // Soleil + tracé en emblème
      const sr = w * 0.24, sx = w / 2, sy = skyH * 0.44;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fillStyle = '#fbe6b4'; ctx.fill();
      const proj = stFit(d.routes, { x: sx - sr * 0.62, y: sy - sr * 0.62, w: sr * 1.24, h: sr * 1.24 });
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, '#b2462e'), width: 6 * u, markers: false });
      // Crêtes (profil réel au premier plan)
      const pts = stProfile(d.routes);
      const near = poRidge(pts, 1.3), mid = poShift(poRidge([], 2.1), 30), far = poShift(poRidge([], 4.7), 60);
      poFillRidge(ctx, far, 0, skyH * 0.5, w, skyH * 0.3, skyH, '#c98a5c');
      poFillRidge(ctx, mid, 0, skyH * 0.62, w, skyH * 0.28, skyH, '#7d8f6a');
      poFillRidge(ctx, near, 0, skyH * 0.7, w, skyH * 0.3, skyH + 2, ink);
      // Cadre intérieur
      ctx.strokeStyle = ink; ctx.lineWidth = 6 * u; ctx.strokeRect(40 * u, 40 * u, w - 80 * u, h - 80 * u);
      const M = 100 * u, iw = w - 2 * M;
      let y = skyH + 70 * u;
      if (d.title) { const s = poLine(ctx, d.title, w / 2, y + 120 * u, iw, 150 * u, ink, { upper: true, family: ST_NUM, spacing: 0.02, align: 'center' }); y += s * 0.85 + 90 * u; }
      if (d.subtitle) { stLabel(ctx, d.subtitle, w / 2, y, 24 * u, '#8a5a3a', 'center'); y += 40 * u; }
      const L = stStatsLayout(ctx, d.stats, iw, { maxSize: 66 * u, labelSize: 20 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - 130 * u - L.height;
      if (d.stats.length) {
        ctx.fillStyle = ink; ctx.fillRect(M, statsTop - 44 * u, iw, 3 * u);
        stDrawStats(ctx, d.stats, M, statsTop, iw, { layout: L, color: ink, labelColor: '#8a5a3a', dividers: true, dividerColor: 'rgba(36,57,44,0.25)' });
      }
      await stDrawLogo(ctx, w / 2, h - 96 * u, 22 * u, ink, 'center');
    },
  },
  {
    // Typographie suisse : bloc rouge, gros chiffres, grille
    id: 'suisse', name: 'Suisse', kind: 'Graphique', ink: '#111111',
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#111', red = '#e2261c';
      ctx.fillStyle = '#f5f4ef'; ctx.fillRect(0, 0, w, h);
      const M = 70 * u;
      const blockH = h * 0.32;
      ctx.fillStyle = red; ctx.fillRect(0, 0, w, blockH);
      await stDrawLogo(ctx, M, M, 30 * u, '#ffffff');
      const titleSize = 112 * u;
      const th = poLinesHeight(ctx, d.title, w - 2 * M, titleSize, { maxLines: 3, lh: 0.96 });
      if (d.title) poLines(ctx, d.title, M, blockH - M - th - (d.subtitle ? 40 * u : 0), w - 2 * M, titleSize, '#ffffff', { maxLines: 3, lh: 0.96 });
      if (d.subtitle) stLabel(ctx, d.subtitle, M, blockH - M + 10 * u, 22 * u, 'rgba(255,255,255,0.85)');
      // Colonne de chiffres à gauche
      const colW = w * 0.36;
      const items = d.stats;
      const top = blockH + M, bottom = h - M;
      const step = items.length ? (bottom - top) / items.length : 0;
      items.forEach((s, i) => {
        const y = top + i * step;
        ctx.fillStyle = ink; ctx.fillRect(M, y, colW - M, 3 * u);
        stLabel(ctx, s.label, M, y + 38 * u, 18 * u, '#666');
        let sz = Math.min(130 * u, step * 0.55); const vw = stValueWidth(ctx, s, sz); if (vw > colW - M - 10 * u) sz *= (colW - M - 10 * u) / vw;
        stValue(ctx, s, M, y + 50 * u + sz * 0.8, sz, ink);
      });
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(colW + 20 * u, top, 2, bottom - top);
      const proj = stFit(d.routes, { x: colW + 80 * u, y: top + 20 * u, w: w - colW - 80 * u - M, h: bottom - top - 80 * u });
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, ink), width: 6 * u, markers: false });
      const a = d.routes[0] && d.routes[0].coords[0];
      if (a) { const [x, y] = proj.px(a[0], a[1]); ctx.beginPath(); ctx.arc(x, y, 14 * u, 0, Math.PI * 2); ctx.fillStyle = red; ctx.fill(); }
      if (d.coords) stLabel(ctx, poCoords(d), w - M, h - M + 10 * u, 16 * u, '#777', 'right');
    },
  },
  {
    // Plan technique : grille, cartouche, échelle, nord
    id: 'blueprint', name: 'Plan', kind: 'Graphique', ink: '#ffffff', dark: true,
    async draw(ctx, d, w, h) {
      const u = w / 1200, bg = '#103c6b', line = 'rgba(255,255,255,0.85)';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x <= w; x += w / 48) { ctx.fillStyle = Math.round(x / (w / 48)) % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(x, 0, 1.2, h); }
      for (let y = 0; y <= h; y += w / 48) { ctx.fillStyle = Math.round(y / (w / 48)) % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(0, y, w, 1.2); }
      const M = 50 * u;
      ctx.strokeStyle = line; ctx.lineWidth = 3 * u; ctx.strokeRect(M, M, w - 2 * M, h - 2 * M);
      ctx.lineWidth = 1.2 * u; ctx.strokeRect(M + 12 * u, M + 12 * u, w - 2 * M - 24 * u, h - 2 * M - 24 * u);
      // Cartouche
      const rows = d.stats.length + 1;
      const cw = w * 0.5, rh = 54 * u, ch = 110 * u + rows * rh;
      const cx = w - M - 12 * u - cw, cy = h - M - 12 * u - ch;
      ctx.fillStyle = bg; ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = line; ctx.lineWidth = 2 * u; ctx.strokeRect(cx, cy, cw, ch);
      poLine(ctx, d.title || 'Itinéraire', cx + 26 * u, cy + 62 * u, cw - 52 * u, 44 * u, '#fff', { upper: true, spacing: 0.06 });
      stLabel(ctx, d.subtitle || ' ', cx + 26 * u, cy + 94 * u, 16 * u, 'rgba(255,255,255,0.65)');
      const items = d.stats.map((s) => [s.label, s.value + (s.unit ? ' ' + s.unit : '')]);
      items.push(['Départ', d.routes[0] ? poDms(d.routes[0].coords[0][0], 'N', 'S') : '—']);
      items.forEach(([k, v], i) => {
        const y = cy + 110 * u + i * rh;
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx, y, cw, 1.5 * u);
        stLabel(ctx, k, cx + 26 * u, y + 34 * u, 16 * u, 'rgba(255,255,255,0.65)');
        ctx.font = stFont(700, 26 * u, ST_NUM); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(v, cx + cw - 26 * u, y + 36 * u);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx + cw * 0.42, cy + 110 * u, 1.5 * u, ch - 110 * u);
      // Tracé
      const proj = stFit(d.routes, { x: M + 110 * u, y: M + 130 * u, w: w - 2 * M - 220 * u, h: cy - M - 230 * u });
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
        if (d.coords) stLabel(ctx, `${i ? 'B' : 'A'}  ${poDms(c[0], 'N', 'S')} ${poDms(c[1], 'E', 'O')}`, x + 34 * u, y - 24 * u, 14 * u, 'rgba(255,255,255,0.85)');
        else stLabel(ctx, i ? 'B' : 'A', x + 30 * u, y - 22 * u, 18 * u, '#fff');
      });
      // Nord + échelle
      const nx = w - M - 90 * u, ny = M + 100 * u;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(nx, ny - 46 * u); ctx.lineTo(nx + 18 * u, ny + 14 * u); ctx.lineTo(nx, ny + 2 * u); ctx.lineTo(nx - 18 * u, ny + 14 * u); ctx.closePath(); ctx.fill();
      stLabel(ctx, 'N', nx, ny + 50 * u, 20 * u, '#fff', 'center');
      poScaleBar(ctx, d, proj, M + 50 * u, h - M - 70 * u, w * 0.22, '#fff');
      await stDrawLogo(ctx, M + 50 * u, M + 60 * u, 26 * u, '#ffffff');
    },
  },
  {
    // Carnet de route : tracé + liste des étapes
    id: 'carnet', name: 'Carnet', kind: 'Trek', ink: '#2b2622',
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#2b2622', mute = '#8b8174';
      ctx.fillStyle = '#f7f2e7'; ctx.fillRect(0, 0, w, h);
      const M = 100 * u, iw = w - 2 * M;
      await stDrawLogo(ctx, M, M - 10 * u, 24 * u, ink);
      if (d.subtitle) stLabel(ctx, d.subtitle, w - M, M + 10 * u, 18 * u, mute, 'right');
      let y = M + 70 * u;
      if (d.title) y += poLines(ctx, d.title, M, y, iw, 84 * u, ink, { maxLines: 2 }) + 20 * u;
      ctx.fillStyle = ink; ctx.fillRect(M, y, iw, 3 * u); y += 40 * u;
      const routes = d.routes;
      const n = routes.length;
      const cols = n > 12 ? 2 : 1;
      const perCol = Math.ceil(n / cols);
      const listRowH = Math.min(58 * u, (h * 0.42) / Math.max(1, perCol));
      const listH = perCol * listRowH + 90 * u;
      const mapH = h - M - listH - y - 30 * u;
      const proj = stFit(routes, { x: M + 30 * u, y, w: iw - 60 * u, h: mapH });
      stDrawRoutes(ctx, routes, proj, { color: poCol(d, 'routes'), width: 6 * u, casing: '#ffffff', casingWidth: 3 * u });
      // numéros d'étapes sur la carte
      if (n > 1 && n <= 40) routes.forEach((r, i) => {
        const c = r.coords[Math.floor(r.coords.length / 2)]; const [x, yy] = proj.px(c[0], c[1]);
        ctx.beginPath(); ctx.arc(x, yy, 15 * u, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 2 * u; ctx.strokeStyle = ink; ctx.stroke();
        ctx.fillStyle = ink; ctx.font = stFont(700, 15 * u, ST_NUM); ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, yy + 5 * u);
      });
      let ly = h - M - listH + 30 * u;
      const colW = iw / cols, fs = Math.min(24 * u, listRowH * 0.46);
      routes.forEach((r, i) => {
        const c = Math.floor(i / perCol), row = i % perCol;
        const x = M + c * colW, yy = ly + row * listRowH;
        ctx.fillStyle = 'rgba(43,38,34,0.12)'; ctx.fillRect(x, yy + listRowH - 1, colW - (cols > 1 ? 30 * u : 0), 1);
        ctx.beginPath(); ctx.arc(x + 12 * u, yy + listRowH / 2, 9 * u, 0, Math.PI * 2); ctx.fillStyle = d.color === 'auto' || d.color === 'routes' ? r.color : d.color; ctx.fill();
        ctx.fillStyle = mute; ctx.font = stFont(700, fs, ST_NUM); ctx.textAlign = 'left';
        ctx.fillText(String(i + 1).padStart(2, '0'), x + 34 * u, yy + listRowH / 2 + fs * 0.36);
        const right = x + colW - (cols > 1 ? 30 * u : 0);
        ctx.font = stFont(600, fs * 0.92, ST_NUM); ctx.textAlign = 'right'; ctx.fillStyle = ink;
        const km = `${stNum(r.distance)} km  ·  ${stNum(r.ascent, 0)} m`;
        ctx.fillText(km, right, yy + listRowH / 2 + fs * 0.36);
        const kmW = ctx.measureText(km).width;
        ctx.font = stFont(500, fs, ST_TXT); ctx.textAlign = 'left';
        ctx.fillText(stWrap(ctx, r.name || `Étape ${i + 1}`, right - kmW - 30 * u - (x + 80 * u), 1)[0] || '', x + 80 * u, yy + listRowH / 2 + fs * 0.36);
      });
      const tY = h - M - 20 * u;
      ctx.fillStyle = ink; ctx.fillRect(M, tY - 52 * u, iw, 2 * u);
      const tot = d.stats.map((s) => `${s.label.toUpperCase()}  ${s.value}${s.unit ? ' ' + s.unit : ''}`).join('    ');
      poLine(ctx, tot, M, tY, iw, 22 * u, ink, { family: ST_NUM, weight: 700 });
      if (d.coords) stLabel(ctx, poCoords(d), w - M, h - M + 40 * u, 14 * u, mute, 'right');
    },
  },
  {
    // Mosaïque : une vignette par étape
    id: 'mosaique', name: 'Mosaïque', kind: 'Trek', ink: '#1b1b1b',
    async draw(ctx, d, w, h) {
      const u = w / 1200, ink = '#1b1b1b', mute = '#8a857c';
      ctx.fillStyle = '#efebe3'; ctx.fillRect(0, 0, w, h);
      const M = 90 * u, iw = w - 2 * M;
      let y = M;
      if (d.title) { const s = poLine(ctx, d.title, M, y + 80 * u, iw, 96 * u, ink, { upper: true, family: ST_NUM }); y += s + 10 * u; }
      if (d.subtitle) { stLabel(ctx, d.subtitle, M, y + 22 * u, 20 * u, mute); y += 40 * u; }
      y += 30 * u;
      const L = stStatsLayout(ctx, d.stats, iw, { maxSize: 60 * u, labelSize: 18 * u, cols: Math.min(5, d.stats.length || 1) });
      const footH = L.height + 110 * u;
      const routes = d.routes, n = routes.length;
      const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : n <= 30 ? 5 : 6;
      const rows = Math.ceil(n / cols);
      const gap = 18 * u;
      const gh = h - footH - y;
      const cw = (iw - gap * (cols - 1)) / cols, ch = (gh - gap * (rows - 1)) / rows;
      routes.forEach((r, i) => {
        const c = i % cols, rr = Math.floor(i / cols);
        const x = M + c * (cw + gap), yy = y + rr * (ch + gap);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, yy, cw, ch);
        const lab = Math.min(30 * u, ch * 0.16);
        const proj = stFit([r], { x: x + cw * 0.14, y: yy + ch * 0.1, w: cw * 0.72, h: ch * 0.9 - lab * 2.2 });
        const col = d.color === 'auto' || d.color === 'routes' ? (d.color === 'routes' ? r.color : ink) : d.color;
        stDrawRoutes(ctx, [r], proj, { color: col, width: Math.max(2, 4 * u * Math.min(1, cw / (300 * u))), markers: false });
        ctx.font = stFont(700, lab * 0.8, ST_NUM); ctx.fillStyle = ink; ctx.textAlign = 'left';
        ctx.fillText(String(i + 1).padStart(2, '0'), x + lab * 0.6, yy + ch - lab * 0.7);
        ctx.font = stFont(600, lab * 0.62, ST_NUM); ctx.fillStyle = mute; ctx.textAlign = 'right';
        ctx.fillText(`${stNum(r.distance)} km`, x + cw - lab * 0.6, yy + ch - lab * 0.7);
      });
      ctx.fillStyle = ink; ctx.fillRect(M, h - footH + 30 * u, iw, 3 * u);
      if (d.stats.length) stDrawStats(ctx, d.stats, M, h - footH + 64 * u, iw, { layout: L, align: 'left', color: ink, labelColor: mute });
      await stDrawLogo(ctx, w - M, M - 6 * u, 24 * u, ink, 'right');
    },
  },
  {
    // Profil d'altitude géant
    id: 'altitude', name: 'Altitude', kind: 'Graphique', ink: '#ffffff', dark: true,
    async draw(ctx, d, w, h) {
      const u = w / 1200, M = 100 * u;
      const g0 = ctx.createLinearGradient(0, 0, 0, h); g0.addColorStop(0, '#0d1b2c'); g0.addColorStop(1, '#16273d');
      ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h);
      const accent = poOne(d, '#5eead4');
      await stDrawLogo(ctx, M, M - 10 * u, 28 * u, '#ffffff');
      let y = M + 70 * u;
      if (d.title) y += poLines(ctx, d.title, M, y, w - 2 * M, 92 * u, '#ffffff', { maxLines: 2 });
      if (d.subtitle) { stLabel(ctx, d.subtitle, M, y + 34 * u, 20 * u, 'rgba(255,255,255,0.6)'); y += 50 * u; }
      const L = stStatsLayout(ctx, d.stats, w - 2 * M, { maxSize: 64 * u, labelSize: 18 * u, cols: Math.min(4, d.stats.length || 1) });
      const statsTop = h - M - L.height;
      const pBottom = statsTop - 90 * u, pTop = pBottom - h * 0.24;
      const proj = stFit(d.routes, { x: M + 60 * u, y: y + 60 * u, w: w - 2 * M - 120 * u, h: pTop - 120 * u - y - 60 * u });
      stDrawRoutes(ctx, d.routes, proj, { color: poCol(d, accent), width: 6 * u, glow: 18 * u });
      const pts = stProfile(d.routes);
      if (pts.length > 1) {
        const maxD = pts[pts.length - 1].d || 1;
        let lo = Infinity, hi = -Infinity; pts.forEach((p) => { lo = Math.min(lo, p.e); hi = Math.max(hi, p.e); });
        const span = Math.max(30, hi - lo);
        const X = (dd) => M + (dd / maxD) * (w - 2 * M), Y = (e) => pBottom - ((e - lo) / span) * (pBottom - pTop);
        // graduations
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for (let k = 0; k <= 4; k++) ctx.fillRect(M, pTop + k * (pBottom - pTop) / 4, w - 2 * M, 1.2 * u);
        ctx.beginPath(); ctx.moveTo(M, pBottom); pts.forEach((p) => ctx.lineTo(X(p.d), Y(p.e))); ctx.lineTo(w - M, pBottom); ctx.closePath();
        const fg = ctx.createLinearGradient(0, pTop, 0, pBottom); fg.addColorStop(0, accent + 'cc'); fg.addColorStop(1, accent + '10');
        ctx.fillStyle = fg; ctx.fill();
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p.d), Y(p.e)) : ctx.moveTo(X(p.d), Y(p.e))));
        ctx.strokeStyle = accent; ctx.lineWidth = 4 * u; ctx.lineJoin = 'round'; ctx.stroke();
        stLabel(ctx, `${Math.round(hi)} m`, M, pTop - 20 * u, 18 * u, 'rgba(255,255,255,0.6)');
        stLabel(ctx, `${Math.round(lo)} m`, M, pBottom + 34 * u, 18 * u, 'rgba(255,255,255,0.6)');
        stLabel(ctx, `${stNum(maxD)} km`, w - M, pBottom + 34 * u, 18 * u, 'rgba(255,255,255,0.6)', 'right');
      }
      if (d.stats.length) stDrawStats(ctx, d.stats, M, statsTop, w - 2 * M, { layout: L, align: 'left', labelColor: 'rgba(255,255,255,0.55)' });
      if (d.coords) stLabel(ctx, poCoords(d), w - M, M + 6 * u, 15 * u, 'rgba(255,255,255,0.5)', 'right');
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
  const dd = { ...d, pr: scale };
  try {
    if (border === 'marge' || border === 'passe') {
      const m = border === 'passe' ? W * 0.085 : W * 0.035;
      ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(m, m); ctx.beginPath(); ctx.rect(0, 0, W - 2 * m, H - 2 * m); ctx.clip();
      await tpl.draw(ctx, dd, W - 2 * m, H - 2 * m);
      ctx.restore();
      if (border === 'passe') {
        // biseau du passe-partout
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

// ---------------------------------------------------------------- panneau
function PosterPane({ allRoutes, routes, included, setIncluded, agg, title, setTitle, initialTitle, dark, isMobile, onToast }) {
  const [tplId, setTplId] = usePoState('ligne');
  const [fmtId, setFmtId] = usePoState('a3');
  const [border, setBorder] = usePoState('none');
  const [mock, setMock] = usePoState('noir');
  const [color, setColor] = usePoState('auto');
  const [coords, setCoords] = usePoState(true);
  const [show, setShow] = usePoState({ distance: true, ascent: true, duration: true, descent: false, speed: false, title: true, date: true });
  const defaultSub = usePoMemo(() => {
    const bits = [];
    if (routes.length > 1) bits.push(`${routes.length} étapes`);
    if (agg.dateLabel) bits.push(agg.dateLabel);
    return bits.join(' · ');
  }, [routes.length, agg.dateLabel]);
  const [subtitle, setSubtitle] = usePoState(null);
  const [busy, setBusy] = usePoState(false);
  const [ready, setReady] = usePoState(false);
  const previewRef = usePoRef(null);
  const thumbRefs = usePoRef({});
  const tpl = POSTER_TEMPLATES.find((t) => t.id === tplId) || POSTER_TEMPLATES[0];
  const fmt = POSTER_FORMATS.find((f) => f.id === fmtId) || POSTER_FORMATS[1];
  const ratio = fmt.mm[1] / fmt.mm[0];
  const exp = poExportSize(fmt);

  const data = usePoMemo(() => ({
    routes, agg, show, color, coords,
    title: show.title ? (title.trim() || initialTitle || 'Ma randonnée') : '',
    subtitle: show.date ? (subtitle == null ? defaultSub : subtitle) : '',
    stats: shareStats(agg, show),
  }), [routes, agg, show, color, coords, title, subtitle, defaultSub]);

  const token = usePoRef(0);
  usePoEffect(() => {
    const my = ++token.current;
    const t = setTimeout(async () => {
      await storyFontsReady();
      if (my !== token.current) return;
      const c = previewRef.current;
      if (c) {
        const pw = 900; c.width = pw; c.height = Math.round(pw * ratio);
        await renderPoster(c, tpl, data, fmt, border, pw / PO_W);
      }
      if (my !== token.current) return;
      setReady(true);
      for (const tp of POSTER_TEMPLATES) {
        const tc = thumbRefs.current[tp.id];
        if (tc && my === token.current) {
          tc.width = 220; tc.height = Math.round(220 * ratio);
          await renderPoster(tc, tp, data, fmt, 'none', 220 / PO_W);
        }
      }
    }, 80);
    return () => clearTimeout(t);
  }, [data, tplId, fmtId, border]);

  const exportCanvas = async () => {
    const c = document.createElement('canvas');
    c.width = exp.w; c.height = exp.h;
    await storyFontsReady();
    await renderPoster(c, tpl, data, fmt, border, exp.w / PO_W);
    return c;
  };
  const fileName = () => {
    const slug = (data.title || 'trek').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return `routdoor-poster-${slug || 'trek'}-${fmt.id}.png`;
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

  const label = dark ? 'text-neutral-400' : 'text-neutral-500';
  const sectionTitle = `text-[10.5px] font-semibold uppercase tracking-wider mb-2 ${label}`;
  const sep = dark ? 'border-white/10' : 'border-neutral-200';
  const chip = (on) => `rounded-md px-2.5 h-8 text-[12px] font-medium transition-colors ${on ? 'bg-blue-500 text-white' : (dark ? 'bg-white/[0.06] hover:bg-white/[0.12]' : 'bg-neutral-100 hover:bg-neutral-200')}`;
  const inputCls = `w-full h-9 rounded-md border px-2.5 text-[12.5px] outline-none ${dark ? 'border-neutral-700 bg-neutral-900/70 focus:border-neutral-500' : 'border-neutral-200 bg-white focus:border-neutral-400'}`;
  const ms = PO_MOCK_STYLE[mock];

  return (
    <div className={`flex-1 min-h-0 flex ${isMobile ? 'flex-col overflow-y-auto sb-scroll' : ''}`}>
      {/* Modèles */}
      <div className={isMobile ? `order-2 shrink-0 px-3 pt-3 pb-1 border-t ${sep}` : `w-[248px] shrink-0 overflow-y-auto sb-scroll p-4 border-r ${sep}`}>
        <div className={sectionTitle}>Modèles</div>
        <div className={isMobile ? 'flex gap-2.5 overflow-x-auto sb-scroll pb-2 -mx-3 px-3 snap-x' : 'grid grid-cols-2 gap-2.5'}>
          {POSTER_TEMPLATES.map((t) => {
            const sel = t.id === tplId;
            return (
              <button key={t.id} onClick={() => setTplId(t.id)} className={`text-left group ${isMobile ? 'w-[84px] shrink-0 snap-start' : ''}`}>
                <div className={`relative rounded-md overflow-hidden transition-all bg-neutral-800 ${sel ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : (dark ? 'ring-1 ring-white/10 group-hover:ring-white/30' : 'ring-1 ring-neutral-200')}`}
                  style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}` }}>
                  <canvas ref={(el) => { thumbRefs.current[t.id] = el; }} width={220} height={311} className="block w-full h-full" />
                </div>
                <div className="flex items-center justify-between mt-1.5 px-0.5">
                  <span className={`text-[12px] font-medium truncate ${sel ? 'text-blue-400' : ''}`}>{t.name}</span>
                  {!isMobile && <span className={`text-[9.5px] uppercase tracking-wider ${label}`}>{t.kind}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Aperçu sur un mur */}
      <div className={`min-w-0 flex flex-col items-center justify-center gap-3 relative ${isMobile ? 'order-1 shrink-0 px-3 pt-3 pb-2' : 'flex-1 p-6'}`}
        style={{ ...(isMobile ? { height: 'min(62vh, 640px)' } : {}), ...(mock !== 'none' ? { background: 'radial-gradient(ellipse at 50% 35%, #ece8e1 0%, #d9d3c9 70%, #cfc8bc 100%)' } : {}) }}>
        <div className="relative min-h-0 flex-1 w-full grid place-items-center">
          <div className="relative h-full max-w-full" style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, maxHeight: '100%' }}>
            <div className="absolute inset-0" style={ms ? {
              padding: '3.2%', background: ms.border,
              boxShadow: `0 30px 60px -20px rgba(0,0,0,0.45), 0 12px 24px -12px rgba(0,0,0,0.35)${ms.shadow ? ', ' + ms.shadow : ''}`,
            } : { boxShadow: '0 20px 50px -12px rgba(0,0,0,0.55)' }}>
              <div className="relative w-full h-full overflow-hidden" style={ms ? { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' } : undefined}>
                <canvas ref={previewRef} width={900} height={1273} className="block w-full h-full" />
                {!ready && <div className="absolute inset-0 grid place-items-center text-[12px] text-neutral-400 bg-neutral-900">Préparation…</div>}
              </div>
            </div>
          </div>
        </div>
        <div className={`text-[11px] ${mock !== 'none' ? 'text-neutral-600' : label}`}>
          {fmt.name} {fmt.sub !== 'cm' ? `· ${fmt.sub}` : 'cm'} · export {exp.w} × {exp.h} px ({exp.dpi} dpi){mock !== 'none' ? ' · cadre en aperçu seulement' : ''}
        </div>
      </div>

      {/* Options */}
      <div className={isMobile ? `order-3 flex flex-col border-t ${sep}` : `w-[300px] shrink-0 flex flex-col border-l ${sep}`}>
        <div className={isMobile ? 'p-4 flex flex-col gap-5' : 'flex-1 overflow-y-auto sb-scroll p-4 flex flex-col gap-5'}>
          <div>
            <div className={sectionTitle}>Format</div>
            <div className="grid grid-cols-3 gap-1.5">
              {POSTER_FORMATS.map((f) => (
                <button key={f.id} onClick={() => setFmtId(f.id)} className={`${chip(f.id === fmtId)} h-auto py-1.5 flex flex-col items-center leading-tight`}>
                  <span>{f.name}</span><span className="text-[9.5px] opacity-70">{f.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className={sectionTitle}>Bordure imprimée</div>
            <div className="grid grid-cols-2 gap-1.5">
              {POSTER_BORDERS.map((b) => <button key={b.id} onClick={() => setBorder(b.id)} className={chip(b.id === border)}>{b.name}</button>)}
            </div>
          </div>

          <div>
            <div className={sectionTitle}>Cadre (aperçu au mur)</div>
            <div className="flex gap-2">
              {POSTER_MOCKUPS.map((m) => (
                <button key={m.id} onClick={() => setMock(m.id)} title={m.name} className="flex flex-col items-center gap-1">
                  <span className={`w-9 h-9 rounded-md grid place-items-center ${mock === m.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : 'ring-1 ring-white/15'}`}
                    style={{ background: m.id === 'none' ? 'transparent' : m.swatch }}>
                    {m.id === 'none' ? <I.X size={14} /> : <span className="w-5 h-5 rounded-[2px] bg-neutral-200/90"></span>}
                  </span>
                  <span className={`text-[10.5px] ${mock === m.id ? 'text-blue-400' : label}`}>{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className={sectionTitle + ' !mb-0'}>Textes</div>
            <ShareFieldRow dark={dark} label="Titre" on={!!show.title} onToggle={() => setShow((s) => ({ ...s, title: !s.title }))} />
            {show.title && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={initialTitle || 'Titre du poster'} maxLength={80} className={inputCls} />}
            <ShareFieldRow dark={dark} label="Sous-titre" on={!!show.date} onToggle={() => setShow((s) => ({ ...s, date: !s.date }))} />
            {show.date && <input value={subtitle == null ? defaultSub : subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex. Bretagne · été 2026" maxLength={80} className={inputCls} />}
            <ShareFieldRow dark={dark} label="Coordonnées GPS" on={coords} onToggle={() => setCoords((v) => !v)} />
          </div>

          <ShareRoutesPicker allRoutes={allRoutes} included={included} setIncluded={setIncluded} dark={dark} sectionTitle={sectionTitle} label={label} />

          <div>
            <div className={sectionTitle}>Statistiques</div>
            <div className="flex flex-col gap-0.5 -mx-1">
              {SHARE_FIELDS.filter((f) => !['title', 'date'].includes(f.key)).map((f) => (
                <ShareFieldRow key={f.key} dark={dark} label={f.label} on={!!show[f.key]} onToggle={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))} />
              ))}
            </div>
          </div>

          <div>
            <div className={sectionTitle}>Couleur du tracé</div>
            <div className="flex flex-wrap gap-2">
              <button title="Couleur du modèle" onClick={() => setColor('auto')}
                className={`h-8 px-3 rounded-full text-[11.5px] font-medium ${color === 'auto' ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : 'ring-1 ring-white/15'} ${dark ? 'bg-white/[0.06]' : 'bg-neutral-100'}`}>Auto</button>
              {SHARE_COLORS.map((c) => (
                <button key={c.value} title={c.label} onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-105 ${color === c.value ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : 'ring-1 ring-white/15'}`}
                  style={{ background: c.value === 'routes' ? 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)' : c.value }} />
              ))}
            </div>
          </div>
        </div>

        <div className={`p-4 border-t flex flex-col gap-2 ${sep} ${isMobile ? `sticky bottom-0 z-10 ${dark ? 'bg-neutral-900' : 'bg-white'}` : ''}`}
          style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' } : undefined}>
          <button onClick={doDownload} disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50">
            <I.Download size={15} /> {busy ? 'Export en cours…' : `Télécharger en HD (${exp.dpi} dpi)`}
          </button>
          <button onClick={doPrint} disabled={busy}
            className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-medium disabled:opacity-50 ${dark ? 'bg-white/10 hover:bg-white/15' : 'bg-neutral-100 hover:bg-neutral-200'}`}>
            Imprimer · PDF
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PosterPane, POSTER_TEMPLATES, POSTER_FORMATS, renderPoster });
