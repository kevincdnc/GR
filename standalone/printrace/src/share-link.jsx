// Tracés dans le lien (#t=…) : format partagé avec Routdoor.
//
// Il n'y a pas de serveur : le tracé voyage DANS le lien. Les points sont
// simplifiés (Douglas-Peucker), codés en entiers delta (lat/lng au 1e-5,
// altitude au mètre) en varints, puis compressés (deflate) et passés en base64url.
//   <site Printrace>/studio/#t=<données>  -> le studio ouvre les tracés reçus
//                                            (envoyés par le site, ou par Routdoor)
//   <Routdoor>/#t=<données>               -> Routdoor ouvre le tracé (PRINTRACE_CONFIG.routdoorUrl)
// Le nom window.RoutdoorLink est gardé : c'est le même format des deux côtés.

(function () {
  const cfg = () => window.PRINTRACE_CONFIG || {};

  // Dossier de la page courante. Hors d'une page http(s) (pré-rendu au build,
  // aperçu hors ligne) : liens relatifs, résolus par <base> depuis la racine du site.
  function siteBase() {
    try {
      if (/^https?:$/.test(location.protocol)) return location.origin + location.pathname.replace(/[^/]*$/, '');
    } catch (e) {}
    return '';
  }

  // Racine du site Printrace : / · studio/ · login/
  function siteRoot() {
    return siteBase().replace(/(studio|login)\/$/, '');
  }
  // Routdoor est hébergé à part : adresse configurée au build (printrace.config.mjs)
  const routdoorBase = () => cfg().routdoorUrl || '';

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

  const shareUrl = (code) => routdoorBase() + '#t=' + code;

    window.RoutdoorLink = {
    encodeShare, decodeShare, readHash, shareUrl, siteBase, siteRoot, routdoorBase, simplify,
  };
})();
