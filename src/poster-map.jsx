// Carte vectorielle des posters : données OpenStreetMap en tuiles vectorielles
// (OpenFreeMap, schéma OpenMapTiles, sans clé), dessinées en tracés vectoriels
// avec la palette de chaque modèle. Le même code dessine sur <canvas> (aperçu,
// PNG 300 dpi) et dans un contexte SVG (canvas2svg) : la carte reste vectorielle
// à l'export, donc nette à toutes les tailles d'impression.

const PM_TILEJSON = 'https://tiles.openfreemap.org/planet';
const PM_MAXZ = 14;

// ---------------------------------------------------------------- décodage MVT
function pmVarint(st) {
  let r = 0, s = 1, b;
  do { b = st.b[st.p++]; r += (b & 0x7f) * s; s *= 128; } while (b & 0x80);
  return r;
}
function pmSkip(st, w) {
  if (w === 0) pmVarint(st);
  else if (w === 1) st.p += 8;
  else if (w === 2) { const n = pmVarint(st); st.p += n; }
  else if (w === 5) st.p += 4;
}
const pmUtf8 = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
function pmString(st) { const n = pmVarint(st); const s = pmUtf8.decode(st.b.subarray(st.p, st.p + n)); st.p += n; return s; }
function pmPacked(st) { const n = pmVarint(st), end = st.p + n, out = []; while (st.p < end) out.push(pmVarint(st)); return out; }
function pmValue(st, end) {
  let v = null;
  while (st.p < end) {
    const key = pmVarint(st), f = key >> 3, w = key & 7;
    if (f === 1) v = pmString(st);
    else if (f === 2) { v = new DataView(st.b.buffer, st.b.byteOffset + st.p, 4).getFloat32(0, true); st.p += 4; }
    else if (f === 3) { v = new DataView(st.b.buffer, st.b.byteOffset + st.p, 8).getFloat64(0, true); st.p += 8; }
    else if (f === 4 || f === 5) v = pmVarint(st);
    else if (f === 6) { const n = pmVarint(st); v = n % 2 ? -(n + 1) / 2 : n / 2; }
    else if (f === 7) v = !!pmVarint(st);
    else pmSkip(st, w);
  }
  return v;
}
function pmGeometry(cmds) {
  const parts = []; let x = 0, y = 0, i = 0, cur = null;
  const zz = (n) => (n >>> 1) ^ -(n & 1);
  while (i < cmds.length) {
    const c = cmds[i++], id = c & 7, n = c >> 3;
    if (id === 1) { for (let k = 0; k < n; k++) { x += zz(cmds[i++]); y += zz(cmds[i++]); cur = [[x, y]]; parts.push(cur); } }
    else if (id === 2) { for (let k = 0; k < n; k++) { x += zz(cmds[i++]); y += zz(cmds[i++]); if (cur) cur.push([x, y]); } }
    else if (id === 7) { if (cur) cur.closed = true; }
  }
  return parts;
}
function pmDecodeTile(u8) {
  const st = { b: u8, p: 0 }, layers = {};
  while (st.p < u8.length) {
    const key = pmVarint(st), f = key >> 3, w = key & 7;
    if (f !== 3 || w !== 2) { pmSkip(st, w); continue; }
    const end = pmVarint(st) + st.p;
    const L = { name: '', extent: 4096, keys: [], values: [], feats: [] };
    while (st.p < end) {
      const k2 = pmVarint(st), f2 = k2 >> 3, w2 = k2 & 7;
      if (f2 === 1) L.name = pmString(st);
      else if (f2 === 2) {
        const fe = pmVarint(st) + st.p, F = { type: 0, tags: [], geom: [] };
        while (st.p < fe) {
          const k3 = pmVarint(st), f3 = k3 >> 3, w3 = k3 & 7;
          if (f3 === 2) F.tags = pmPacked(st);
          else if (f3 === 3) F.type = pmVarint(st);
          else if (f3 === 4) F.geom = pmPacked(st);
          else pmSkip(st, w3);
        }
        L.feats.push(F);
      }
      else if (f2 === 3) L.keys.push(pmString(st));
      else if (f2 === 4) { const ve = pmVarint(st) + st.p; L.values.push(pmValue(st, ve)); st.p = ve; }
      else if (f2 === 5) L.extent = pmVarint(st);
      else pmSkip(st, w2);
    }
    st.p = end;
    L.features = L.feats.map((F) => {
      const props = {};
      for (let i = 0; i + 1 < F.tags.length; i += 2) props[L.keys[F.tags[i]]] = L.values[F.tags[i + 1]];
      return { type: F.type, props, parts: pmGeometry(F.geom) };
    });
    delete L.feats;
    layers[L.name] = L;
  }
  return layers;
}

// ---------------------------------------------------------------- tuiles
let pmTemplateP = null;
function pmTileTemplate() {
  if (!pmTemplateP) {
    pmTemplateP = fetch(PM_TILEJSON).then((r) => r.json()).then((j) => (j.tiles && j.tiles[0]) || null)
      .catch(() => null).then((t) => { if (!t) pmTemplateP = null; return t; });
  }
  return pmTemplateP;
}
const pmCache = new Map();
async function pmGunzip(u8) {
  if (u8[0] !== 0x1f || u8[1] !== 0x8b || typeof DecompressionStream === 'undefined') return u8;
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function pmTile(z, x, y) {
  const k = z + '/' + x + '/' + y;
  if (pmCache.has(k)) return pmCache.get(k);
  const p = pmTileTemplate().then((tpl) => {
    if (!tpl) return null;
    return fetch(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then(async (ab) => (ab ? pmDecodeTile(await pmGunzip(new Uint8Array(ab))) : null));
  }).catch(() => null);
  p.then((v) => { if (!v) pmCache.delete(k); });
  pmCache.set(k, p);
  return p;
}

// ---------------------------------------------------------------- styles de carte
const PM_STYLES = [
  { id: 'epure', name: 'Épurée' },
  { id: 'routes', name: 'Routes' },
  { id: 'nature', name: 'Nature' },
  { id: 'gravure', name: 'Gravure' },
];
const PM_ROADS = {
  motorway: 2.6, trunk: 2.2, primary: 1.8, secondary: 1.4, tertiary: 1.1,
  minor: 0.75, service: 0.5, track: 0.7, path: 0.6,
};
const PM_STYLE_DEF = {
  epure: { roads: ['motorway', 'trunk', 'primary'], landcover: false, waterway: false, places: ['city', 'town'], peaks: false, maxLabels: 10 },
  routes: { roads: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'], landcover: false, waterway: true, places: ['city', 'town', 'village'], peaks: false, maxLabels: 16 },
  // Gravure : eau hachurée, routes fines, peu de noms (cartes marines anciennes)
  gravure: { roads: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], landcover: false, waterway: true, places: ['city', 'town'], peaks: false, maxLabels: 8, hatch: true },
  nature: { roads: ['motorway', 'trunk', 'primary', 'secondary', 'track', 'path'], landcover: true, waterway: true, places: ['city', 'town', 'village'], peaks: true, maxLabels: 16 },
};
const PM_PLACE_RANK = { city: 0, town: 1, village: 2, hamlet: 3, suburb: 2 };

// ---------------------------------------------------------------- géométrie
// Segment [a,b] coupe-t-il le rectangle r ? (Liang–Barsky)
function pmSegHitsRect(ax, ay, bx, by, r) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const p = [-dx, dx, -dy, dy], q = [ax - r.x0, r.x1 - ax, ay - r.y0, r.y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}
function pmRouteSegments(routes, proj, minStep) {
  const segs = [];
  routes.forEach((r) => {
    let px = null;
    r.coords.forEach((c) => {
      const p = proj.px(c[0], c[1]);
      if (!px) { px = p; return; }
      if (Math.abs(p[0] - px[0]) + Math.abs(p[1] - px[1]) < minStep) return;
      segs.push([px[0], px[1], p[0], p[1], Math.min(px[0], p[0]), Math.max(px[0], p[0]), Math.min(px[1], p[1]), Math.max(px[1], p[1])]);
      px = p;
    });
  });
  return segs;
}
function pmRectHitsRoute(r, segs) {
  for (const s of segs) {
    if (s[5] < r.x0 || s[4] > r.x1 || s[7] < r.y0 || s[6] > r.y1) continue;
    if (pmSegHitsRect(s[0], s[1], s[2], s[3], r)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- dessin
// o = { proj, rect: {x,y,w,h}, clip?: fn(ctx) (forme), pal, style, opacity, labels, routes, labelRect, u }
async function pmDrawMap(ctx, o) {
  const { proj, rect, pal } = o;
  const u = o.u || 1;
  const def = PM_STYLE_DEF[o.style] || PM_STYLE_DEF.epure;
  // Zone en coordonnées monde (256 unités = le monde à z0)
  const wx0 = (rect.x - proj.ox) / proj.k, wx1 = (rect.x + rect.w - proj.ox) / proj.k;
  const wy0 = Math.max(0, (rect.y - proj.oy) / proj.k), wy1 = Math.min(256, (rect.y + rect.h - proj.oy) / proj.k);
  let tz = Math.max(0, Math.min(PM_MAXZ, Math.round(proj.z + 0.6)));
  let n, tx0, tx1, ty0, ty1;
  for (;;) {
    n = 2 ** tz; const ts = 256 / n;
    tx0 = Math.floor(wx0 / ts); tx1 = Math.floor(wx1 / ts); ty0 = Math.floor(wy0 / ts); ty1 = Math.min(n - 1, Math.floor(wy1 / ts));
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= 36 || tz === 0) break;
    tz--;
  }
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const wx = ((tx % n) + n) % n;
    jobs.push(pmTile(tz, wx, ty).then((t) => ({ t, tx, ty })));
  }
  const tiles = (await Promise.all(jobs)).filter((j) => j.t);
  if (!tiles.length) return false;
  const tsz = (256 / n) * proj.k; // taille d'une tuile en unités de dessin

  // Géométrie (eau, côtes, routes…) et noms de lieux sont indépendants
  if (o.geometry !== false) {
  // Dessin dans un calque : opacité de groupe (pas de surimpression aux croisements)
  const op = o.opacity == null ? 1 : o.opacity;
  let target = ctx, layer = null;
  if (ctx.__isSvg) { ctx.save(); if (op < 1) ctx.__currentElement.setAttribute('opacity', String(op)); }
  else if (op < 1 && ctx.canvas && ctx.getTransform) {
    layer = document.createElement('canvas'); layer.width = ctx.canvas.width; layer.height = ctx.canvas.height;
    target = layer.getContext('2d'); target.setTransform(ctx.getTransform());
  } else ctx.save();
  const g = target;
  g.save();
  if (o.clip) o.clip(g); else { g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); }
  g.clip();
  if (pal.land) { g.fillStyle = pal.land; g.fillRect(rect.x, rect.y, rect.w, rect.h); }

  // Passe par calque thématique, tuile par tuile (chaque tuile découpée à ses bords)
  const pass = (fn) => tiles.forEach(({ t, tx, ty }) => {
    const ox = tx * tsz + proj.ox, oy = ty * tsz + proj.oy;
    if (ox > rect.x + rect.w || oy > rect.y + rect.h || ox + tsz < rect.x || oy + tsz < rect.y) return;
    g.save(); g.beginPath(); g.rect(ox, oy, tsz, tsz); g.clip();
    fn(t, ox, oy);
    g.restore();
  });
  const pathOf = (F, L, ox, oy, close) => {
    const s = tsz / (L.extent || 4096);
    g.beginPath();
    F.parts.forEach((ring) => {
      ring.forEach((p, i) => { const x = ox + p[0] * s, y = oy + p[1] * s; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      if (close) g.closePath();
    });
  };
  const fillLayer = (name, filter, color) => pass((t, ox, oy) => {
    const L = t[name]; if (!L) return;
    g.fillStyle = color; g.beginPath();
    const s = tsz / (L.extent || 4096);
    let any = false;
    L.features.forEach((F) => {
      if (F.type !== 3 || (filter && !filter(F.props))) return;
      any = true;
      F.parts.forEach((ring) => { ring.forEach((p, i) => { const x = ox + p[0] * s, y = oy + p[1] * s; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); });
    });
    if (any) g.fill();
  });

  // 1. Végétation (Nature)
  if (def.landcover && pal.wood) {
    fillLayer('landcover', (p) => p.class === 'wood' || p.class === 'forest', pal.wood);
    if (pal.park) fillLayer('park', null, pal.park);
  }
  // 2. Eau + trait de côte
  if (pal.water) fillLayer('water', null, pal.water);
  // Hachures horizontales dans l'eau (style Gravure)
  if (def.hatch && pal.hatch) pass((t, ox, oy) => {
    const L = t.water; if (!L) return;
    const s = tsz / (L.extent || 4096);
    g.save(); g.beginPath();
    let any = false;
    L.features.forEach((F) => { if (F.type !== 3) return; any = true; F.parts.forEach((ring) => { ring.forEach((p, i) => { const x = ox + p[0] * s, y = oy + p[1] * s; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); }); });
    if (any) {
      g.clip();
      const gap = (pal.hatchGap || 5) * u, y0 = Math.floor((oy - rect.y) / gap) * gap + rect.y; // lignes alignées d'une tuile à l'autre
      g.fillStyle = pal.hatch;
      for (let y = y0; y < oy + tsz; y += gap) g.fillRect(ox, y, tsz, (pal.hatchWidth || 0.7) * u);
    }
    g.restore();
  });
  if (pal.coast) pass((t, ox, oy) => {
    const L = t.water; if (!L) return;
    g.strokeStyle = pal.coast; g.lineWidth = (pal.coastWidth || 1) * u; g.lineJoin = 'round';
    L.features.forEach((F) => { if (F.type === 3) { pathOf(F, L, ox, oy, true); g.stroke(); } });
  });
  // 3. Cours d'eau
  if (def.waterway && pal.waterway) pass((t, ox, oy) => {
    const L = t.waterway; if (!L) return;
    g.strokeStyle = pal.waterway; g.lineCap = 'round'; g.lineJoin = 'round';
    L.features.forEach((F) => {
      if (F.type !== 2) return;
      g.lineWidth = (F.props.class === 'river' ? 1.4 : 0.7) * u;
      pathOf(F, L, ox, oy, false); g.stroke();
    });
  });
  // 4. Routes et chemins (du plus fin au plus gros)
  const order = pal.road ? ['path', 'track', 'service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway'].filter((c) => def.roads.includes(c)) : [];
  order.forEach((cls) => pass((t, ox, oy) => {
    const L = t.transportation; if (!L) return;
    const major = ['motorway', 'trunk', 'primary'].includes(cls);
    const dashed = cls === 'path' || cls === 'track';
    g.strokeStyle = major ? (pal.roadMajor || pal.road) : dashed ? (pal.path || pal.road) : pal.road;
    g.lineWidth = PM_ROADS[cls] * u * (pal.roadScale || 1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (dashed && g.setLineDash) g.setLineDash([3 * u, 3 * u]);
    L.features.forEach((F) => {
      if (F.type !== 2 || F.props.class !== cls || F.props.brunnel === 'tunnel') return;
      pathOf(F, L, ox, oy, false); g.stroke();
    });
    if (dashed && g.setLineDash) g.setLineDash([]);
  }));
  g.restore();
  if (layer) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = op; ctx.drawImage(layer, 0, 0); ctx.restore(); }
  else ctx.restore();
  }

  // 5. Noms de lieux (pleine opacité) : jamais sur le tracé, sans chevauchement
  if (o.labels !== false && pal.label) {
    const g = ctx;
    g.save(); g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
    const lr = o.labelRect || rect;
    const segs = pmRouteSegments(o.routes || [], proj, 2 * u);
    const cands = [];
    const seen = new Set();
    tiles.forEach(({ t, tx, ty }) => {
      const s = tsz / 4096;
      const take = (L, kind) => {
        if (!L) return;
        const sc = tsz / (L.extent || 4096);
        L.features.forEach((F) => {
          if (F.type !== 1 || !F.parts[0]) return;
          const name = F.props['name:latin'] || F.props.name;
          if (!name) return;
          const cls = kind === 'peak' ? 'peak' : F.props.class;
          if (kind === 'place' && !def.places.includes(cls)) return;
          const key = kind + ':' + name;
          if (seen.has(key)) return;
          const [px, py] = F.parts[0][0];
          const x = tx * tsz + proj.ox + px * sc, y = ty * tsz + proj.oy + py * sc;
          if (x < lr.x || x > lr.x + lr.w || y < lr.y || y > lr.y + lr.h) return;
          seen.add(key);
          const rank = kind === 'peak' ? 2.5 : (PM_PLACE_RANK[cls] != null ? PM_PLACE_RANK[cls] : 4);
          cands.push({ name, cls, x, y, score: rank * 100 + (F.props.rank || 0), ele: F.props.ele });
        });
      };
      take(t.place, 'place');
      if (def.peaks) take(t.mountain_peak, 'peak');
    });
    cands.sort((a, b) => a.score - b.score);
    const avoid = o.avoid || [];
    const placed = [...avoid];
    const lab = pal.label;
    const sizeOf = (c) => (c.cls === 'city' ? 19 : c.cls === 'town' ? 15.5 : c.cls === 'peak' ? 12.5 : 12.5) * u * (lab.scale || 1);
    for (const c of cands) {
      if (placed.length - avoid.length >= def.maxLabels) break;
      const size = sizeOf(c);
      const text = lab.upper && c.cls !== 'peak' ? c.name.toUpperCase() : c.name + (c.cls === 'peak' && c.ele ? ` ${Math.round(c.ele)} m` : '');
      g.font = poFont(lab.weight || 600, size, lab.family || ST_TXT, lab.italic || c.cls === 'peak');
      const sp = lab.upper && c.cls !== 'peak' ? size * (lab.spacing != null ? lab.spacing : 0.12) : 0;
      const tw = g.measureText(text).width + sp * Math.max(0, text.length - 1);
      const dot = c.cls === 'peak' ? 4.5 * u : (c.cls === 'city' || c.cls === 'town') ? 3.2 * u : 2.4 * u;
      // à droite du point, sinon à gauche
      let placedBox = null;
      for (const side of [1, -1]) {
        const x0 = side > 0 ? c.x + dot + 5 * u : c.x - dot - 5 * u - tw;
        const box = { x0: x0 - 3 * u, x1: x0 + tw + 3 * u, y0: c.y - size * 0.75, y1: c.y + size * 0.45 };
        if (box.x0 < lr.x || box.x1 > lr.x + lr.w || box.y0 < lr.y || box.y1 > lr.y + lr.h) continue;
        const pad = { x0: Math.min(box.x0, c.x - dot) - 6 * u, x1: Math.max(box.x1, c.x + dot) + 6 * u, y0: box.y0 - 6 * u, y1: box.y1 + 6 * u };
        if (pmRectHitsRoute(pad, segs)) continue;
        if (placed.some((b) => !(pad.x1 < b.x0 || pad.x0 > b.x1 || pad.y1 < b.y0 || pad.y0 > b.y1))) continue;
        placedBox = { ...pad, tx: x0, side };
        break;
      }
      if (!placedBox) continue;
      placed.push(placedBox);
      // Point (ou triangle pour un sommet)
      g.fillStyle = lab.dot || lab.color; g.strokeStyle = lab.halo; g.lineWidth = 1.6 * u;
      g.beginPath();
      if (c.cls === 'peak') { g.moveTo(c.x, c.y - dot); g.lineTo(c.x + dot, c.y + dot * 0.7); g.lineTo(c.x - dot, c.y + dot * 0.7); g.closePath(); }
      else g.arc(c.x, c.y, dot, 0, Math.PI * 2);
      if (lab.halo) g.stroke();
      g.fill();
      // Texte avec liseré (halo) pour la lisibilité
      const drawText = (stroke) => {
        let cx = placedBox.tx;
        g.textAlign = 'left';
        if (!sp) { if (stroke) g.strokeText(text, cx, c.y + size * 0.32); else g.fillText(text, cx, c.y + size * 0.32); return; }
        for (const ch of text) {
          if (stroke) g.strokeText(ch, cx, c.y + size * 0.32); else g.fillText(ch, cx, c.y + size * 0.32);
          cx += g.measureText(ch).width + sp;
        }
      };
      if (lab.halo) { g.strokeStyle = lab.halo; g.lineWidth = (lab.haloWidth || 3) * u; g.lineJoin = 'round'; drawText(true); }
      g.fillStyle = lab.color; drawText(false);
    }
    g.restore();
  }
  return true;
}

// ---------------------------------------------------------------- export SVG
// canvas2svg ne gère pas setLineDash : on l'ajoute (dash conservés en SVG).
(function patchC2S() {
  const C = window.C2S; if (!C || C.prototype.__dashPatched) return;
  C.prototype.__dashPatched = true;
  C.prototype.setLineDash = function (a) { this.__dash = (a || []).slice(); };
  C.prototype.getLineDash = function () { return this.__dash || []; };
  const stroke = C.prototype.stroke, save = C.prototype.save, restore = C.prototype.restore;
  C.prototype.stroke = function () { stroke.call(this); if (this.__dash && this.__dash.length && this.__currentElement) this.__currentElement.setAttribute('stroke-dasharray', this.__dash.join(' ')); };
  C.prototype.save = function () { (this.__dashStack = this.__dashStack || []).push(this.__dash); save.call(this); };
  // clip() oublie d'écrire le chemin courant dans le <clipPath> (découpes vides)
  const clip = C.prototype.clip;
  C.prototype.clip = function () { if (this.__currentElement && this.__currentElement.nodeName === 'path') this.__applyCurrentDefaultPath(); clip.call(this); };
  // drawImage place mal les images (transform posé sur un groupe vide) : version directe x/y
  C.prototype.drawImage = function (img, a1, a2, a3, a4, a5, a6, a7, a8) {
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (arguments.length === 3) { dx = a1; dy = a2; dw = sw; dh = sh; }
    else if (arguments.length === 5) { dx = a1; dy = a2; dw = a3; dh = a4; }
    else { sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8; }
    let src = img;
    if (sx || sy || sw !== img.width || sh !== img.height) {
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh));
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); src = c;
    }
    const href = src.nodeName === 'CANVAS' ? src.toDataURL('image/png') : (src.getAttribute('src') || src.src);
    const el = this.__document.createElementNS('http://www.w3.org/2000/svg', 'image');
    el.setAttribute('x', dx); el.setAttribute('y', dy); el.setAttribute('width', dw); el.setAttribute('height', dh);
    el.setAttribute('preserveAspectRatio', 'none');
    if (this.globalAlpha != null && this.globalAlpha < 1) el.setAttribute('opacity', this.globalAlpha);
    el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
    this.__closestGroupOrSvg().appendChild(el);
  };
  C.prototype.restore = function () { restore.call(this); this.__dash = (this.__dashStack || []).pop(); };
})();

async function pmFontFaceCss(svgText) {
  const out = [];
  const seen = new Set();
  for (const sheet of [...document.styleSheets]) {
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const r of [...rules]) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      const fam = r.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
      if (!fam || !svgText.includes(fam)) continue;
      const m = /url\(["']?([^"')]+)["']?\)/.exec(r.style.getPropertyValue('src')); if (!m) continue;
      const k = fam + r.style.fontWeight + r.style.fontStyle; if (seen.has(k)) continue; seen.add(k);
      let data = m[1];
      if (!/^data:/.test(data)) {
        try {
          const blob = await (await fetch(new URL(data, sheet.href || location.href))).blob();
          data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
        } catch (e) { continue; }
      }
      out.push(`@font-face{font-family:'${fam}';font-style:${r.style.fontStyle || 'normal'};font-weight:${r.style.fontWeight || 400};src:url(${data}) format('woff2');}`);
    }
  }
  return out.join('\n');
}

Object.assign(window, { pmDrawMap, pmDecodeTile, pmFontFaceCss, PM_STYLES });
