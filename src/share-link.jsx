// Lien de partage et carte intégrable (embed).
//
// Il n'y a pas de serveur : le tracé voyage DANS le lien. Les points sont
// simplifiés (Douglas-Peucker), codés en entiers delta (lat/lng au 1e-5,
// altitude au mètre) en varints, puis compressés (deflate) et passés en base64url.
//   https://…/GR/routdoor/#t=<données>   -> Routdoor ouvre le tracé partagé
//   https://…/GR/embed.html#t=<données>&o=<options>  -> carte intégrable
// Ce fichier est chargé par l'app ET par embed.html (sans React).

(function () {
  const RD_SITE = 'https://kevincdnc.github.io/GR/';

  // Base des liens : le site courant s'il s'agit du vrai site (ou du serveur
  // de dev), sinon le site publié (ex. aperçu hors ligne).
  function siteBase() {
    try {
      const h = location.hostname;
      if (/github\.io$/.test(h) || h === 'localhost' || h === '127.0.0.1') {
        return location.origin + location.pathname.replace(/[^/]*$/, '');
      }
    } catch (e) {}
    return RD_SITE;
  }

  // Racine du site (hub) : les services vivent dans des sous-dossiers
  //   routdoor/ · printrace/ · printrace/studio/ · design-system/
  function siteRoot() {
    return siteBase().replace(/(routdoor|printrace\/studio|printrace|design-system)\/$/, '');
  }
  const routdoorBase = () => siteRoot() + 'routdoor/';

  // ---------------------------------------------------------------- simplification
  function simplify(coords, tolM) {
    const n = coords.length;
    if (n < 3 || tolM <= 0) return coords.slice();
    const lat0 = coords[0][0] * Math.PI / 180;
    const kx = 111320 * Math.cos(lat0), ky = 110540;
    const P = coords.map((c) => [c[1] * kx, c[0] * ky]);
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    const tol2 = tolM * tolM;
    while (stack.length) {
      const [a, b] = stack.pop();
      const [ax, ay] = P[a], [bx, by] = P[b];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let best = -1, bi = -1;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = P[i];
        let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + t * dx - px, ey = ay + t * dy - py;
        const d2 = ex * ex + ey * ey;
        if (d2 > best) { best = d2; bi = i; }
      }
      if (best > tol2 && bi > 0) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
    }
    return coords.filter((_, i) => keep[i]);
  }

  // Simplifie l'ensemble des parties jusqu'à tenir dans `maxPts` points
  function simplifyParts(parts, maxPts) {
    let tol = 1.5, out = parts.map((p) => p.coords);
    const total = () => out.reduce((a, c) => a + c.length, 0);
    for (let k = 0; k < 18; k++) {
      out = parts.map((p) => simplify(p.coords, tol));
      if (total() <= maxPts) break;
      tol *= 1.5;
    }
    return out;
  }

  // ---------------------------------------------------------------- binaire
  function writer() {
    const bytes = [];
    const uv = (n) => { n = Math.floor(n); while (n > 127) { bytes.push((n & 127) | 128); n = Math.floor(n / 128); } bytes.push(n); };
    const sv = (n) => uv(n < 0 ? -2 * n - 1 : 2 * n);
    return { bytes, uv, sv };
  }
  function reader(buf) {
    let i = 0;
    const uv = () => { let n = 0, m = 1, b; do { b = buf[i++]; n += (b & 127) * m; m *= 128; } while (b & 128); return n; };
    const sv = () => { const n = uv(); return n % 2 ? -(n + 1) / 2 : n / 2; };
    return { uv, sv, take: (len) => { const s = buf.subarray(i, i + len); i += len; return s; } };
  }

  const b64u = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  };

  async function pipe(u8, Stream) {
    const s = new Blob([u8]).stream().pipeThrough(new Stream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const canZip = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

  // data = { title, parts: [{ name, color(hex), distance, ascent, descent, durationMin, date, coords }] }
  async function encodeShare(data, maxPts = 2500) {
    const parts = (data.parts || []).filter((p) => p.coords && p.coords.length > 1);
    const geo = simplifyParts(parts, maxPts);
    const head = {
      v: 1, t: data.title || '',
      p: parts.map((p) => ({
        n: p.name || '', c: p.color || '', d: +(p.distance || 0).toFixed(2), a: Math.round(p.ascent || 0),
        e: Math.round(p.descent || 0), m: Math.round(p.durationMin || 0), dt: p.date || '',
      })),
    };
    const w = writer();
    const hb = new TextEncoder().encode(JSON.stringify(head));
    w.uv(hb.length); hb.forEach((b) => w.bytes.push(b));
    geo.forEach((cs) => {
      const hasEle = cs.some((c) => typeof c[2] === 'number');
      w.uv(cs.length); w.uv(hasEle ? 1 : 0);
      let la = 0, ln = 0, el = 0, lastE = 0;
      cs.forEach((c) => {
        const A = Math.round(c[0] * 1e5), B = Math.round(c[1] * 1e5);
        w.sv(A - la); w.sv(B - ln); la = A; ln = B;
        if (hasEle) {
          const E = typeof c[2] === 'number' ? Math.round(c[2]) : lastE;
          w.sv(E - el); el = E; lastE = E;
        }
      });
    });
    const raw = new Uint8Array(w.bytes);
    if (canZip) {
      try { return 'z' + b64u(await pipe(raw, CompressionStream)); } catch (e) {}
    }
    return 'r' + b64u(raw);
  }

  async function decodeShare(str) {
    if (!str) return null;
    let u8 = unb64u(str.slice(1));
    if (str[0] === 'z') u8 = await pipe(u8, DecompressionStream);
    const r = reader(u8);
    const head = JSON.parse(new TextDecoder().decode(r.take(r.uv())));
    const parts = head.p.map((h) => {
      const n = r.uv(), hasEle = r.uv() === 1;
      const coords = [];
      let la = 0, ln = 0, el = 0;
      for (let i = 0; i < n; i++) {
        la += r.sv(); ln += r.sv();
        if (hasEle) { el += r.sv(); coords.push([la / 1e5, ln / 1e5, el]); } else coords.push([la / 1e5, ln / 1e5]);
      }
      return { name: h.n, color: h.c, distance: h.d, ascent: h.a, descent: h.e, durationMin: h.m, date: h.dt, coords };
    });
    return { title: head.t, parts };
  }

  // Lecture de « #t=…&o=… »
  function readHash(hash) {
    const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    let opts = {};
    try { if (q.get('o')) opts = JSON.parse(decodeURIComponent(escape(atob(q.get('o').replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) {}
    return { data: q.get('t'), opts };
  }
  const encOpts = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const shareUrl = (code) => routdoorBase() + '#t=' + code;
  const embedUrl = (code, opts) => siteRoot() + 'embed.html#t=' + code + (opts ? '&o=' + encOpts(opts) : '');

  // ---------------------------------------------------------------- carte intégrable
  const EMBED_LAYERS = {
    relief: { name: 'Relief', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: 'Fond © Esri, HERE, Garmin, FAO, USGS, © OpenStreetMap', max: 19 },
    plan: { name: 'Plan', url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', attr: '© OpenStreetMap France', max: 20, sub: 'abc' },
    ign: { name: 'IGN', url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png', attr: '© IGN – Géoplateforme', max: 19 },
    satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Imagerie © Esri, Maxar', max: 19 },
    sombre: { name: 'Sombre', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: 'Fond © Esri, © OpenStreetMap', max: 16,
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}' },
  };
  const EMBED_DEFAULTS = { theme: 'light', base: 'relief', color: 'routes', title: true, stats: true, profile: true, link: true };

  const CSS = `
.rd-embed{position:relative;isolation:isolate;width:100%;height:100%;overflow:hidden;font-family:Barlow,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#e5e7eb}
.rd-embed.rd-dark{background:#171717}
.rd-embed .rd-map{position:absolute;inset:0}
.rd-embed .rd-card{position:absolute;z-index:500;border-radius:12px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 6px 24px rgba(0,0,0,.18)}
.rd-embed.rd-light .rd-card{background:rgba(255,255,255,.92);color:#111;border:1px solid rgba(0,0,0,.06)}
.rd-embed.rd-dark .rd-card{background:rgba(20,20,20,.84);color:#fff;border:1px solid rgba(255,255,255,.08)}
.rd-embed .rd-head{left:12px;top:12px;max-width:calc(100% - 80px);padding:9px 13px}
.rd-embed .rd-title{font-weight:700;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-embed .rd-sub{font-size:12px;opacity:.62;margin-top:2px}
.rd-embed .rd-bottom{left:12px;right:12px;bottom:12px;padding:10px 14px 10px}
.rd-embed .rd-stats{display:flex;gap:22px;flex-wrap:wrap}
.rd-embed .rd-stat .l{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
.rd-embed .rd-stat .v{font-family:"Barlow Semi Condensed",Barlow,sans-serif;font-weight:700;font-size:20px;line-height:1.15;font-variant-numeric:tabular-nums}
.rd-embed .rd-stat .u{font-size:12px;font-weight:600;opacity:.7;margin-left:2px}
.rd-embed .rd-prof{position:relative;height:78px;margin-top:8px;cursor:crosshair}
.rd-embed .rd-stats + .rd-prof{margin-top:10px}
.rd-embed .rd-prof svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.rd-embed .rd-cursor{position:absolute;top:0;bottom:0;width:1px;background:currentColor;opacity:.5;pointer-events:none;display:none}
.rd-embed .rd-tip{position:absolute;top:-4px;transform:translate(-50%,-100%);font-size:11px;font-weight:600;white-space:nowrap;padding:3px 7px;border-radius:6px;pointer-events:none;display:none;font-variant-numeric:tabular-nums}
.rd-embed.rd-light .rd-tip{background:#111;color:#fff}
.rd-embed.rd-dark .rd-tip{background:#fff;color:#111}
.rd-embed .rd-axis{display:flex;justify-content:space-between;font-size:10px;opacity:.5;margin-top:2px;font-variant-numeric:tabular-nums}
.rd-embed .rd-btns{right:12px;top:12px;display:flex;flex-direction:column;overflow:hidden;padding:0}
.rd-embed .rd-btns button{all:unset;width:34px;height:34px;display:grid;place-items:center;cursor:pointer;font-size:18px;line-height:1}
.rd-embed .rd-btns button+button{border-top:1px solid rgba(127,127,127,.2)}
.rd-embed .rd-btns button:hover{background:rgba(127,127,127,.14)}
.rd-embed .rd-brand{position:absolute;z-index:500;right:12px;font-size:11px;font-weight:600;text-decoration:none;padding:4px 9px;border-radius:999px;display:flex;align-items:center;gap:5px}
.rd-embed.rd-light .rd-brand{background:rgba(255,255,255,.92);color:#111}
.rd-embed.rd-dark .rd-brand{background:rgba(20,20,20,.84);color:#fff}
.rd-embed .rd-brand b{font-family:Unbounded,Barlow,sans-serif;font-weight:800;letter-spacing:-.02em}
.rd-embed .leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.6)!important}
.rd-embed.rd-dark .leaflet-control-attribution{background:rgba(0,0,0,.45)!important;color:#bbb}
.rd-embed.rd-dark .leaflet-control-attribution a{color:#ddd}
.rd-embed .leaflet-container{background:transparent;font-family:inherit}
@media (max-width:460px){.rd-embed .rd-stats{gap:14px}.rd-embed .rd-stat .v{font-size:17px}.rd-embed .rd-prof{height:60px}}
`;
  function injectCss() {
    if (document.getElementById('rd-embed-css')) return;
    const s = document.createElement('style'); s.id = 'rd-embed-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  const fmt = (n, d = 1) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const dur = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60); return h ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hav(a, b) {
    const R = 6371, t = Math.PI / 180, dLa = (b[0] - a[0]) * t, dLn = (b[1] - a[1]) * t;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function dateLabel(parts) {
    const ds = parts.map((p) => p.date).filter(Boolean).sort();
    if (!ds.length) return '';
    const f = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return ds[0] === ds[ds.length - 1] ? f(ds[0]) : `${f(ds[0])} → ${f(ds[ds.length - 1])}`;
  }

  // Monte la carte dans `el`. Renvoie { destroy }.
  function mountEmbed(el, data, options) {
    injectCss();
    const o = { ...EMBED_DEFAULTS, ...(options || {}) };
    const parts = (data.parts || []).filter((p) => p.coords && p.coords.length > 1);
    const dark = o.theme === 'dark';
    const root = document.createElement('div');
    root.className = 'rd-embed ' + (dark ? 'rd-dark' : 'rd-light');
    el.appendChild(root);
    const mapEl = document.createElement('div'); mapEl.className = 'rd-map'; root.appendChild(mapEl);

    const map = L.map(mapEl, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25 });
    map.attributionControl.setPrefix('');
    const def = EMBED_LAYERS[o.base] || EMBED_LAYERS.relief;
    L.tileLayer(def.url, { attribution: def.attr, maxNativeZoom: def.max, maxZoom: 19, ...(def.sub ? { subdomains: def.sub } : {}) }).addTo(map);
    if (def.labels) L.tileLayer(def.labels, { maxNativeZoom: def.max, maxZoom: 19 }).addTo(map);

    const colOf = (p) => (o.color === 'routes' ? (p.color || '#3b82f6') : o.color);
    const bounds = L.latLngBounds([]);
    parts.forEach((p) => {
      const ll = p.coords.map((c) => [c[0], c[1]]);
      ll.forEach((x) => bounds.extend(x));
      L.polyline(ll, { color: dark || o.base === 'satellite' ? '#000' : '#fff', weight: 7, opacity: 0.55, interactive: false }).addTo(map);
      L.polyline(ll, { color: colOf(p), weight: 4, opacity: 1, interactive: false }).addTo(map);
    });
    if (parts.length) {
      const a = parts[0].coords[0], lp = parts[parts.length - 1], b = lp.coords[lp.coords.length - 1];
      L.circleMarker([a[0], a[1]], { radius: 6, color: '#fff', weight: 3, fillColor: '#22c55e', fillOpacity: 1 }).addTo(map);
      L.circleMarker([b[0], b[1]], { radius: 6, color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);
    }

    // Titre
    const nb = parts.length;
    const sum = (k) => parts.reduce((a, p) => a + (p[k] || 0), 0);
    if (o.title) {
      const head = document.createElement('div'); head.className = 'rd-card rd-head';
      const sub = [nb > 1 ? `${nb} étapes` : '', dateLabel(parts)].filter(Boolean).join(' · ');
      head.innerHTML = `<div class="rd-title">${esc(data.title || (parts[0] && parts[0].name) || 'Itinéraire')}</div>${sub ? `<div class="rd-sub">${esc(sub)}</div>` : ''}`;
      root.appendChild(head);
    }

    // Boutons zoom / recentrer
    const btns = document.createElement('div'); btns.className = 'rd-card rd-btns';
    btns.innerHTML = '<button title="Zoomer" data-a="in">+</button><button title="Dézoomer" data-a="out">−</button><button title="Recentrer" data-a="fit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>';
    btns.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'in') map.zoomIn(); else if (b.dataset.a === 'out') map.zoomOut(); else fit(true);
    });
    root.appendChild(btns);

    // Statistiques + profil
    let bottom = null;
    const samples = [];
    if (o.stats || o.profile) {
      bottom = document.createElement('div'); bottom.className = 'rd-card rd-bottom';
      if (o.stats) {
        const st = [['Distance', fmt(sum('distance')), 'km'], ['Dénivelé +', fmt(sum('ascent'), 0), 'm'], ['Dénivelé −', fmt(sum('descent'), 0), 'm']];
        if (sum('durationMin') > 0) st.push(['Durée', dur(sum('durationMin')), '']);
        bottom.insertAdjacentHTML('beforeend', '<div class="rd-stats">' + st.map(([l, v, u]) => `<div class="rd-stat"><div class="l">${l}</div><div class="v">${v}${u ? `<span class="u">${u}</span>` : ''}</div></div>`).join('') + '</div>');
      }
      if (o.profile) {
        let dist = 0;
        parts.forEach((p) => p.coords.forEach((c, i) => {
          if (i) dist += hav(p.coords[i - 1], c);
          else if (samples.length) dist += hav(samples[samples.length - 1].c, c);
          samples.push({ d: dist, e: typeof c[2] === 'number' ? c[2] : null, c });
        }));
        const withE = samples.filter((s) => s.e != null);
        if (withE.length > 2) {
          let lo = Infinity, hi = -Infinity; withE.forEach((s) => { lo = Math.min(lo, s.e); hi = Math.max(hi, s.e); });
          const maxD = dist || 1;
          // Profil rééchantillonné (300 pts) et lissé : lisible même sur un GPS bruité
          const N = 300, sm = [];
          let j = 0;
          for (let k = 0; k <= N; k++) {
            const dd = (k / N) * maxD;
            while (j < withE.length - 2 && withE[j + 1].d < dd) j++;
            const a = withE[j], b = withE[j + 1];
            const t = b.d > a.d ? Math.min(1, Math.max(0, (dd - a.d) / (b.d - a.d))) : 0;
            sm.push({ d: dd, e: a.e + (b.e - a.e) * t });
          }
          const smooth = sm.map((p, i) => { let su = 0, n = 0; for (let q = Math.max(0, i - 3); q <= Math.min(N, i + 3); q++) { su += sm[q].e; n++; } return { d: p.d, e: su / n }; });
          lo = Infinity; hi = -Infinity; smooth.forEach((p) => { lo = Math.min(lo, p.e); hi = Math.max(hi, p.e); });
          const span2 = Math.max(20, hi - lo);
          const pts = smooth.map((p) => [(p.d / maxD) * 1000, 96 - ((p.e - lo) / span2) * 88]);
          const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
          const accent = colOf(parts[0]);
          const prof = document.createElement('div'); prof.className = 'rd-prof';
          prof.innerHTML = `<svg viewBox="0 0 1000 100" preserveAspectRatio="none"><defs><linearGradient id="rdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs><path d="${line}L1000 100L0 100Z" fill="url(#rdg)"/><path d="${line}" fill="none" stroke="${accent}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="rd-cursor"></div><div class="rd-tip"></div>`;
          bottom.appendChild(prof);
          bottom.insertAdjacentHTML('beforeend', `<div class="rd-axis"><span>${fmt(lo, 0)} m – ${fmt(hi, 0)} m</span><span>${fmt(maxD)} km</span></div>`);
          const cur = prof.querySelector('.rd-cursor'), tip = prof.querySelector('.rd-tip');
          let dot = null;
          const move = (clientX) => {
            const r = prof.getBoundingClientRect();
            const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
            const target = f * maxD;
            let lo2 = 0, hi2 = withE.length - 1;
            while (hi2 - lo2 > 1) { const m = (lo2 + hi2) >> 1; if (withE[m].d < target) lo2 = m; else hi2 = m; }
            const s = Math.abs(withE[lo2].d - target) < Math.abs(withE[hi2].d - target) ? withE[lo2] : withE[hi2];
            const x = (s.d / maxD) * r.width;
            cur.style.display = tip.style.display = 'block';
            cur.style.left = x + 'px';
            tip.style.left = Math.max(40, Math.min(r.width - 40, x)) + 'px';
            tip.textContent = `${fmt(s.d)} km · ${fmt(s.e, 0)} m`;
            if (!dot) dot = L.circleMarker([s.c[0], s.c[1]], { radius: 7, color: '#fff', weight: 3, fillColor: accent, fillOpacity: 1 }).addTo(map);
            else dot.setLatLng([s.c[0], s.c[1]]);
          };
          const leave = () => { cur.style.display = tip.style.display = 'none'; if (dot) { map.removeLayer(dot); dot = null; } };
          prof.addEventListener('mousemove', (e) => move(e.clientX));
          prof.addEventListener('mouseleave', leave);
          prof.addEventListener('touchmove', (e) => { e.preventDefault(); move(e.touches[0].clientX); }, { passive: false });
          prof.addEventListener('touchend', leave);
        }
      }
      if (bottom.children.length) root.appendChild(bottom); else bottom = null;
    }

    // Lien vers Routdoor
    if (o.link) {
      const a = document.createElement('a'); a.className = 'rd-brand';
      a.href = o.href || '#'; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = 'Voir sur <b>Routdoor</b> ↗';
      root.appendChild(a);
    }

    const place = () => {
      const bh = bottom ? bottom.offsetHeight + 12 : 0;
      const brand = root.querySelector('.rd-brand');
      if (brand) brand.style.bottom = (bh + 18) + 'px';
      const attr = root.querySelector('.leaflet-bottom');
      if (attr) attr.style.bottom = bh + 'px';
      return bh;
    };
    const fit = (anim) => {
      if (!bounds.isValid()) return;
      const bh = place();
      const top = o.title ? 96 : 28;
      map.fitBounds(bounds, { paddingTopLeft: [28, top], paddingBottomRight: [64, bh + 28], animate: !!anim, maxZoom: 16 });
    };
    map.setView([46.6, 2.5], 5);
    requestAnimationFrame(() => { map.invalidateSize(); fit(false); });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      let first = true;
      ro = new ResizeObserver(() => { map.invalidateSize(); if (first) { first = false; return; } fit(false); });
      ro.observe(root);
    }
    return {
      map,
      destroy() { try { ro && ro.disconnect(); } catch (e) {} try { map.remove(); } catch (e) {} root.remove(); },
    };
  }

  window.RoutdoorLink = {
    encodeShare, decodeShare, readHash, shareUrl, embedUrl, siteBase, siteRoot, routdoorBase, mountEmbed,
    EMBED_LAYERS, EMBED_DEFAULTS, simplify,
  };
})();
