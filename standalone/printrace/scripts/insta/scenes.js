// Scènes d'intérieur dessinées au canvas : un poster Printrace encadré dans un décor.
// window.drawScene(id, posterImg) -> canvas 1080 × 1350 (format post Instagram 4:5)
(function () {
  const W = 1080, H = 1350;
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rad(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  // Mur : teinte + lumière (radiale) + grain fin
  function wall(ctx, base, light, lx = 0.5, ly = 0.15, h = H) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = rad(ctx, W * lx, h * ly, 0, W * 1.1, [[0, light], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, 'rgba(0,0,0,0.08)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.12)']]); ctx.fillRect(0, 0, W, h);
  }
  function grain(ctx, a = 0.05) {
    const id = ctx.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 255 * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(id, 0, 0);
  }
  function vignette(ctx, a = 0.35) {
    ctx.fillStyle = rad(ctx, W / 2, H * 0.45, W * 0.35, W * 0.95, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${a})`]]); ctx.fillRect(0, 0, W, H);
  }
  // Ombre portée douce (plusieurs couches)
  function softShadow(ctx, x, y, w, h, { dx = 0, dy = 18, blur = 40, a = 0.35, r = 2 } = {}) {
    ctx.save();
    [[blur, a], [blur / 3, a * 0.6]].forEach(([b, al]) => {
      ctx.shadowColor = `rgba(0,0,0,${al})`; ctx.shadowBlur = b; ctx.shadowOffsetX = dx; ctx.shadowOffsetY = dy * (b === blur ? 1 : 0.4);
      ctx.fillStyle = '#000'; rr(ctx, x, y, w, h, r); ctx.fill();
    });
    ctx.restore();
  }
  // Cadre : bois, noir, alu ; passe-partout optionnel ; reflet de vitre
  function frame(ctx, img, x, y, w, { kind = 'black', bar = 22, mat = 0, matColor = '#f4f1ea', shadow = {}, light = 'tl' } = {}) {
    const pw = w - 2 * bar - 2 * mat, ph = pw * img.height / img.width;
    const h = ph + 2 * bar + 2 * mat;
    softShadow(ctx, x, y, w, h, shadow);
    // Moulure
    const fills = {
      black: lin(ctx, x, y, x + w, y + h, [[0, '#2a2a2a'], [0.5, '#141414'], [1, '#0b0b0b']]),
      oak: lin(ctx, x, y, x + w, y + h, [[0, '#d9b98b'], [0.45, '#c39a68'], [1, '#a77d4d']]),
      walnut: lin(ctx, x, y, x + w, y + h, [[0, '#6b4a33'], [0.5, '#523625'], [1, '#3b2619']]),
      white: lin(ctx, x, y, x + w, y + h, [[0, '#fbfbf9'], [1, '#e2e0da']]),
      alu: lin(ctx, x, y, x + w, y + h, [[0, '#e8eaed'], [0.35, '#a3a9b0'], [0.6, '#dfe2e6'], [1, '#8f959c']]),
    };
    ctx.fillStyle = fills[kind]; ctx.fillRect(x, y, w, h);
    if (kind === 'oak' || kind === 'walnut') { // veinage
      ctx.save(); ctx.globalAlpha = kind === 'oak' ? 0.12 : 0.18; ctx.strokeStyle = kind === 'oak' ? '#7a5530' : '#21140c'; ctx.lineWidth = 1;
      for (let i = 0; i < 70; i++) { const yy = y + rnd() * h; ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + rnd() * 6 - 3, x + w * 0.7, yy + rnd() * 6 - 3, x + w, yy + rnd() * 4 - 2); ctx.stroke(); }
      ctx.restore();
    }
    // Biseaux : arêtes claires en haut/gauche, sombres en bas/droite
    ctx.save();
    const edge = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill(); };
    const ix = x + bar, iy = y + bar, iw = w - 2 * bar, ih = h - 2 * bar;
    edge([[x, y], [x + w, y], [ix + iw, iy], [ix, iy]], 'rgba(255,255,255,0.10)');
    edge([[x, y], [ix, iy], [ix, iy + ih], [x, y + h]], 'rgba(255,255,255,0.05)');
    edge([[x + w, y], [x + w, y + h], [ix + iw, iy + ih], [ix + iw, iy]], 'rgba(0,0,0,0.12)');
    edge([[x, y + h], [ix, iy + ih], [ix + iw, iy + ih], [x + w, y + h]], 'rgba(0,0,0,0.18)');
    ctx.restore();
    // Passe-partout
    if (mat) { ctx.fillStyle = matColor; ctx.fillRect(ix, iy, iw, ih); ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(ix, iy, iw, 4); }
    ctx.drawImage(img, ix + mat, iy + mat, pw, ph);
    // Ombre intérieure de la moulure
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.strokeStyle = '#000'; ctx.lineWidth = 8; ctx.strokeRect(ix - 4, iy - 4, iw + 8, ih + 8);
    // Reflet de vitre en diagonale
    const g = light === 'tr' ? lin(ctx, ix + iw, iy, ix, iy + ih, [[0, 'rgba(255,255,255,0.16)'], [0.3, 'rgba(255,255,255,0.04)'], [0.42, 'rgba(255,255,255,0)']])
      : lin(ctx, ix, iy, ix + iw, iy + ih, [[0, 'rgba(255,255,255,0.14)'], [0.3, 'rgba(255,255,255,0.035)'], [0.42, 'rgba(255,255,255,0)']]);
    ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, ih);
    ctx.restore();
    return { x, y, w, h };
  }
  // Plante en pot : feuilles en ellipses
  function plant(ctx, cx, base, s = 1, { pot = '#e8e2d6', leaf = ['#4f6b45', '#3a5333', '#62804f'] } = {}) {
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, len = (120 + rnd() * 160) * s;
      const sx = cx + (rnd() - 0.5) * 20 * s, sy = base - 150 * s;
      const ex = sx + Math.cos(a) * len, ey = sy + Math.sin(a) * len;
      ctx.strokeStyle = '#3d4a30'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx, (sy + ey) / 2, ex, ey); ctx.stroke();
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = leaf[i % 3];
      ctx.beginPath(); ctx.ellipse(0, 0, 22 * s, 52 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(0, -48 * s); ctx.lineTo(0, 48 * s); ctx.stroke();
      ctx.restore();
    }
    softShadow(ctx, cx - 85 * s, base - 170 * s, 170 * s, 170 * s, { dy: 10, blur: 30, a: 0.3, r: 18 * s });
    ctx.fillStyle = lin(ctx, cx - 90 * s, 0, cx + 90 * s, 0, [[0, pot], [0.6, pot], [1, 'rgba(0,0,0,0.25)']]);
    ctx.beginPath(); ctx.moveTo(cx - 90 * s, base - 170 * s); ctx.lineTo(cx + 90 * s, base - 170 * s); ctx.lineTo(cx + 72 * s, base); ctx.lineTo(cx - 72 * s, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(cx - 72 * s, base - 4, 144 * s, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(cx - 90 * s, base - 170 * s, 180 * s, 10 * s);
    ctx.restore();
  }
  // Sol en parquet
  function floor(ctx, y, c1, c2) {
    ctx.fillStyle = lin(ctx, 0, y, 0, H, [[0, c1], [1, c2]]); ctx.fillRect(0, y, W, H - y);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#000';
    for (let i = 0; i < 14; i++) { const x = -400 + i * 140; ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * 0.35, y); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y, W, 3);
  }
  // Ombre de fenêtre (rayons de soleil sur le mur)
  function windowLight(ctx, x, y, a = 0.16, angle = -0.35) {
    ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, angle, 1, 0, 0); ctx.filter = 'blur(10px)';
    ctx.fillStyle = `rgba(255,236,200,${a})`;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) ctx.fillRect(c * 170, r * 230, 150, 210);
    ctx.restore(); ctx.filter = 'none';
  }

  const scenes = {
    // Salon : mur grège, canapé terracotta, lampe
    living(ctx, img) {
      wall(ctx, '#cfc4b6', 'rgba(255,248,236,0.55)', 0.45, 0.1);
      floor(ctx, 1150, '#8a6a4c', '#5e4530');
      windowLight(ctx, 690, 160, 0.13);
      frame(ctx, img, 300, 120, 480, { kind: 'black', bar: 16, shadow: { dx: 10, dy: 24, blur: 46, a: 0.38 } });
      // Canapé
      softShadow(ctx, 80, 860, 920, 320, { dy: 30, blur: 60, a: 0.4, r: 40 });
      ctx.fillStyle = lin(ctx, 0, 820, 0, 1180, [[0, '#b8664a'], [1, '#8f4a33']]); rr(ctx, 80, 830, 920, 220, 50); ctx.fill();
      ctx.fillStyle = lin(ctx, 0, 980, 0, 1180, [[0, '#a8573d'], [1, '#7c3d29']]); rr(ctx, 50, 980, 980, 190, 44); ctx.fill();
      [[90, 1], [540, 1]].forEach(([x]) => { ctx.fillStyle = 'rgba(255,255,255,0.07)'; rr(ctx, x + 20, 1000, 430, 70, 30); ctx.fill(); });
      ctx.fillStyle = '#e9dfcf'; ctx.save(); ctx.translate(250, 900); ctx.rotate(-0.12); rr(ctx, -95, -75, 190, 150, 34); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#3e4a3c'; ctx.save(); ctx.translate(820, 905); ctx.rotate(0.1); rr(ctx, -90, -70, 180, 140, 32); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#2a1b12'; [[110, 1170], [950, 1170]].forEach(([x, y]) => ctx.fillRect(x, y, 16, 40));
      // Lampe sur pied
      ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(1010, 1220); ctx.lineTo(1010, 420); ctx.quadraticCurveTo(1010, 330, 930, 330); ctx.stroke();
      ctx.fillStyle = rad(ctx, 930, 380, 10, 260, [[0, 'rgba(255,228,170,0.35)'], [1, 'rgba(255,228,170,0)']]); ctx.fillRect(650, 250, 430, 400);
      ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(880, 300); ctx.lineTo(980, 300); ctx.lineTo(1000, 370); ctx.lineTo(860, 370); ctx.closePath(); ctx.fill();
      plant(ctx, 40, 1160, 0.9);
      vignette(ctx, 0.3);
    },
    // Entrée : mur sauge, console, médaille accrochée au cadre
    hallway(ctx, img) {
      wall(ctx, '#9aa592', 'rgba(255,255,240,0.4)', 0.4, 0.12);
      floor(ctx, 1210, '#cbbfae', '#a89a86');
      windowLight(ctx, 150, 220, 0.12, 0.3);
      const f = frame(ctx, img, 300, 150, 480, { kind: 'black', bar: 12, mat: 34, matColor: '#f3f0e8', shadow: { dx: -8, dy: 22, blur: 44, a: 0.34 }, light: 'tr' });
      // Médaille sur le coin du cadre
      const mx = f.x + f.w - 24, my = f.y + 6;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
      ctx.strokeStyle = '#2f6bd6'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(mx - 40, my - 4); ctx.lineTo(mx + 6, my + 210); ctx.stroke();
      ctx.strokeStyle = '#d63a3a'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(mx + 40, my - 4); ctx.lineTo(mx + 6, my + 210); ctx.stroke();
      ctx.fillStyle = rad(ctx, mx - 6, my + 250, 6, 70, [[0, '#ffe9a6'], [0.5, '#d9a93a'], [1, '#9c7316']]); ctx.beginPath(); ctx.arc(mx + 6, my + 262, 62, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(120,80,10,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx + 6, my + 262, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(110,72,8,0.8)'; ctx.font = 'bold 30px Montserrat, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('42', mx + 6, my + 274);
      // Console
      softShadow(ctx, 190, 1000, 700, 40, { dy: 16, blur: 30, a: 0.35 });
      ctx.fillStyle = lin(ctx, 0, 1000, 0, 1040, [[0, '#d2b58c'], [1, '#a98457']]); ctx.fillRect(190, 1000, 700, 40);
      ctx.fillStyle = '#2b2b2b'; [[220], [850]].forEach(([x]) => ctx.fillRect(x, 1040, 12, 180));
      // Objets : clés, bol, livres
      ctx.fillStyle = '#efe9df'; ctx.beginPath(); ctx.ellipse(330, 990, 80, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(330, 986, 62, 12, 0, 0, Math.PI * 2); ctx.fill();
      [['#2d3a4a', 40], ['#c8a27a', 34], ['#e6e1d6', 30]].forEach(([c, hh], i) => { ctx.fillStyle = c; ctx.fillRect(640, 1000 - 30 * (i + 1) + (40 - hh), 200 - i * 14, hh - 4); });
      plant(ctx, 980, 1230, 0.8, { pot: '#d8cfc0' });
      vignette(ctx, 0.28);
    },
    // Chambre : mur lin, tête de lit en chêne, coussins
    bedroom(ctx, img) {
      wall(ctx, '#e6dfd4', 'rgba(255,255,255,0.5)', 0.55, 0.05);
      frame(ctx, img, 310, 90, 460, { kind: 'oak', bar: 18, shadow: { dy: 22, blur: 40, a: 0.3 } });
      // Tête de lit
      softShadow(ctx, 60, 760, 960, 260, { dy: 18, blur: 40, a: 0.3, r: 18 });
      ctx.fillStyle = lin(ctx, 0, 760, 0, 1020, [[0, '#c9a477'], [1, '#a9834f']]); rr(ctx, 60, 760, 960, 260, 18); ctx.fill();
      ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#6b4a2a'; for (let x = 100; x < 1020; x += 80) { ctx.beginPath(); ctx.moveTo(x, 770); ctx.lineTo(x, 1015); ctx.stroke(); } ctx.restore();
      // Lit
      ctx.fillStyle = lin(ctx, 0, 940, 0, H, [[0, '#f4f1ec'], [1, '#d8d3ca']]); rr(ctx, 30, 940, 1020, 520, 30); ctx.fill();
      [[150, '#efe9df'], [560, '#efe9df']].forEach(([x, c]) => { softShadow(ctx, x, 880, 370, 140, { dy: 10, blur: 24, a: 0.2, r: 40 }); ctx.fillStyle = c; rr(ctx, x, 880, 370, 140, 40); ctx.fill(); });
      ctx.fillStyle = '#5d6f86'; rr(ctx, 410, 930, 260, 110, 30); ctx.fill();
      ctx.fillStyle = lin(ctx, 0, 1080, 0, H, [[0, '#8fa0b5'], [1, '#6d7f96']]); rr(ctx, 30, 1100, 1020, 400, 20); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(60, 1140 + i * 46); ctx.bezierCurveTo(300, 1130 + i * 46, 700, 1160 + i * 46, 1030, 1140 + i * 46); ctx.stroke(); }
      // Applique murale
      ctx.fillStyle = rad(ctx, 960, 520, 10, 300, [[0, 'rgba(255,220,160,0.4)'], [1, 'rgba(255,220,160,0)']]); ctx.fillRect(650, 220, 430, 600);
      ctx.fillStyle = '#1e1e1e'; ctx.fillRect(955, 470, 10, 60); ctx.fillStyle = '#efe6d3'; ctx.beginPath(); ctx.arc(960, 470, 34, Math.PI, 0); ctx.fill();
      vignette(ctx, 0.25);
    },
    // Garage : béton, étagère, casque, spot
    garage(ctx, img) {
      wall(ctx, '#7c7b78', 'rgba(255,240,215,0.5)', 0.5, 0.0);
      // Texture béton : taches + trous de banche
      ctx.save(); for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rnd() * 0.04})`; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 20 + rnd() * 120, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 2; [450, 900].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; [[180, 225], [540, 225], [900, 225], [180, 675], [900, 675]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); });
      frame(ctx, img, 300, 130, 480, { kind: 'black', bar: 18, shadow: { dy: 26, blur: 46, a: 0.5 } });
      // Spot au plafond
      ctx.fillStyle = rad(ctx, 540, -60, 20, 760, [[0, 'rgba(255,236,200,0.38)'], [1, 'rgba(255,236,200,0)']]); ctx.fillRect(0, 0, W, 900);
      // Étagère métal + casque + gants
      softShadow(ctx, 120, 1000, 840, 22, { dy: 14, blur: 26, a: 0.45 });
      ctx.fillStyle = lin(ctx, 0, 1000, 0, 1022, [[0, '#3a3a3a'], [1, '#1d1d1d']]); ctx.fillRect(120, 1000, 840, 22);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
      ctx.fillStyle = rad(ctx, 290, 860, 10, 170, [[0, '#d24a3c'], [0.7, '#9a2a20'], [1, '#5c140f']]); ctx.beginPath(); ctx.ellipse(320, 900, 150, 110, 0, Math.PI, 0); ctx.lineTo(470, 1000); ctx.lineTo(170, 1000); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(20,20,24,0.9)'; ctx.beginPath(); ctx.ellipse(370, 930, 92, 44, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(340, 915, 50, 14, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b241f'; rr(ctx, 680, 940, 170, 60, 20); ctx.fill(); ctx.fillStyle = '#3a312a'; rr(ctx, 700, 900, 130, 60, 20); ctx.fill();
      // Sol béton
      ctx.fillStyle = lin(ctx, 0, 1180, 0, H, [[0, '#4f4e4b'], [1, '#2f2e2c']]); ctx.fillRect(0, 1180, W, H - 1180);
      vignette(ctx, 0.45);
    },
    // Scandinave : mur blanc cassé, buffet en chêne, vase et branche, lumière de fenêtre
    scandi(ctx, img) {
      wall(ctx, '#ecebe7', 'rgba(255,255,255,0.6)', 0.7, 0.1);
      windowLight(ctx, 620, 120, 0.18, -0.4);
      frame(ctx, img, 290, 190, 460, { kind: 'oak', bar: 14, mat: 40, matColor: '#fbfaf7', shadow: { dx: -12, dy: 22, blur: 40, a: 0.28 } });
      // Buffet
      softShadow(ctx, 110, 990, 860, 300, { dy: 20, blur: 50, a: 0.3 });
      ctx.fillStyle = lin(ctx, 0, 990, 0, 1290, [[0, '#d7b98e'], [1, '#b8955f']]); ctx.fillRect(110, 990, 860, 300);
      ctx.strokeStyle = 'rgba(90,60,25,0.35)'; ctx.lineWidth = 3; [325, 540, 755].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 1010); ctx.lineTo(x, 1270); ctx.stroke(); });
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(110, 990, 860, 6);
      ctx.fillStyle = '#1f1f1f'; [[140], [920]].forEach(([x]) => ctx.fillRect(x, 1290, 14, 70));
      // Vase + branche
      ctx.strokeStyle = '#5a4632'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(860, 900); ctx.bezierCurveTo(850, 760, 900, 640, 960, 560); ctx.stroke();
      for (let i = 0; i < 18; i++) { const t = i / 18, px = 860 + (960 - 860) * t + (rnd() - 0.5) * 30, py = 900 - 340 * t; ctx.fillStyle = i % 2 ? '#7d8f6a' : '#94a57f'; ctx.beginPath(); ctx.ellipse(px + (i % 2 ? 22 : -22), py, 9, 20, i % 2 ? 0.8 : -0.8, 0, Math.PI * 2); ctx.fill(); }
      softShadow(ctx, 800, 870, 120, 120, { dy: 8, blur: 20, a: 0.25, r: 60 });
      ctx.fillStyle = rad(ctx, 840, 900, 10, 90, [[0, '#f4efe6'], [1, '#cfc6b6']]); ctx.beginPath(); ctx.ellipse(860, 935, 60, 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(838, 860, 44, 40);
      // Livres + bougie
      [['#c7553f', 28], ['#e8e1d3', 22], ['#3d4d5c', 26]].forEach(([c, hh], i) => { ctx.fillStyle = c; ctx.fillRect(170 + i * 6, 990 - (i + 1) * 26, 220 - i * 18, hh - 2); });
      ctx.fillStyle = '#f6f2ea'; ctx.fillRect(420, 900, 50, 90);
      ctx.fillStyle = floorColor('#e2d8c6'); ctx.fillRect(0, 1290, W, H - 1290);
      vignette(ctx, 0.2);
    },
    // Bureau : poster posé contre le mur, ordinateur, tasse
    desk(ctx, img) {
      wall(ctx, '#c5a184', 'rgba(255,240,225,0.45)', 0.3, 0.1);
      // Plateau
      const top = 980;
      // Poster appuyé (légère perspective : on le dessine tel quel, bas posé sur le bureau)
      const w = 470, ph = (w - 32) * img.height / img.width + 32;
      frame(ctx, img, 470, top - ph + 6, w, { kind: 'white', bar: 16, shadow: { dx: 16, dy: 14, blur: 34, a: 0.35 } });
      ctx.fillStyle = lin(ctx, 0, top, 0, H, [[0, '#e7dccb'], [0.04, '#d9c9b0'], [1, '#b8a283']]); ctx.fillRect(0, top, W, H - top);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(470, top, w, 8);
      // Ordinateur portable
      softShadow(ctx, 60, 1050, 420, 30, { dy: 14, blur: 28, a: 0.4 });
      ctx.fillStyle = lin(ctx, 60, 0, 480, 0, [[0, '#c9ccd1'], [1, '#9da2a8']]); ctx.beginPath(); ctx.moveTo(90, 1050); ctx.lineTo(450, 1050); ctx.lineTo(490, 1090); ctx.lineTo(50, 1090); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b2d31'; ctx.beginPath(); ctx.moveTo(110, 1050); ctx.lineTo(430, 1050); ctx.lineTo(400, 790); ctx.lineTo(140, 790); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lin(ctx, 0, 800, 0, 1040, [[0, '#1f3550'], [1, '#2d6aa8']]); ctx.beginPath(); ctx.moveTo(126, 1036); ctx.lineTo(414, 1036); ctx.lineTo(388, 804); ctx.lineTo(152, 804); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(200, 990); ctx.bezierCurveTo(240, 900, 300, 960, 340, 850); ctx.stroke();
      // Tasse
      softShadow(ctx, 860, 1060, 110, 120, { dy: 10, blur: 20, a: 0.3, r: 14 });
      ctx.fillStyle = lin(ctx, 860, 0, 970, 0, [[0, '#f5f2ec'], [1, '#cfc9be']]); rr(ctx, 860, 1060, 110, 120, 14); ctx.fill();
      ctx.strokeStyle = '#ddd7cc'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(975, 1115, 30, -1.2, 1.2); ctx.stroke();
      ctx.fillStyle = '#4a2f1d'; ctx.beginPath(); ctx.ellipse(915, 1066, 48, 9, 0, 0, Math.PI * 2); ctx.fill();
      // Carnet + crayon
      ctx.save(); ctx.translate(640, 1180); ctx.rotate(-0.1); ctx.fillStyle = '#2f4a3a'; rr(ctx, -110, -60, 220, 140, 6); ctx.fill(); ctx.fillStyle = '#f3c84b'; ctx.fillRect(-140, 100, 260, 10); ctx.restore();
      plant(ctx, 1010, top + 4, 0.7, { pot: '#7d4f38' });
      vignette(ctx, 0.3);
    },
    // À plat sur le parquet : déballage (tube kraft, ruban)
    flatlay(ctx, img) {
      ctx.fillStyle = '#b48a5e'; ctx.fillRect(0, 0, W, H);
      ctx.save(); for (let i = 0; i < 9; i++) { const x = i * 130; ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(x, 0, 128, H); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 128, 0, 2, H); }
      ctx.globalAlpha = 0.14; ctx.strokeStyle = '#5b3a1c'; for (let i = 0; i < 160; i++) { const x = rnd() * W, y = rnd() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 4, y + 80, x - 4, y + 160, x + 2, y + 260); ctx.stroke(); } ctx.restore();
      ctx.fillStyle = rad(ctx, 300, 200, 0, 1200, [[0, 'rgba(255,240,215,0.35)'], [1, 'rgba(0,0,0,0.2)']]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(560, 640); ctx.rotate(-0.06);
      frame(ctx, img, -310, -440, 620, { kind: 'walnut', bar: 22, shadow: { dx: 8, dy: 12, blur: 30, a: 0.45 } });
      ctx.restore();
      // Tube kraft
      ctx.save(); ctx.translate(140, 1150); ctx.rotate(-0.85);
      softShadow(ctx, -40, -350, 90, 700, { dx: 10, dy: 10, blur: 24, a: 0.45, r: 45 });
      ctx.fillStyle = lin(ctx, -45, 0, 45, 0, [[0, '#8e6a43'], [0.4, '#c49a68'], [1, '#7a5a37']]); rr(ctx, -45, -350, 90, 700, 44); ctx.fill();
      ctx.fillStyle = '#111'; rr(ctx, -45, -350, 90, 60, 20); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'italic 800 28px Montserrat, sans-serif'; ctx.save(); ctx.rotate(Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,20,20,0.75)'; ctx.fillText('Printrace', 30, 12); ctx.restore();
      ctx.restore();
      // Ruban et ciseaux suggérés : un rouleau
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(960, 1210, 78, 78, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9e1d2'; ctx.beginPath(); ctx.arc(950, 1200, 76, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#b48a5e'; ctx.beginPath(); ctx.arc(950, 1200, 38, 0, Math.PI * 2); ctx.fill();
      vignette(ctx, 0.35);
    },
    // Café : mur de briques, cadre noyer, applique
    brick(ctx, img) {
      ctx.fillStyle = '#7d3e2c'; ctx.fillRect(0, 0, W, H);
      const bh = 46, bw = 132;
      for (let r = 0; r * bh < H; r++) for (let c = -1; c * bw < W + bw; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh, t = rnd();
        ctx.fillStyle = `rgb(${150 + t * 40 | 0},${70 + t * 25 | 0},${50 + t * 18 | 0})`; ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`; ctx.fillRect(x + 3, y + 3 + (bh - 6) * 0.6, bw - 6, (bh - 6) * 0.4);
      }
      ctx.fillStyle = 'rgba(214,200,185,0.35)'; ctx.fillRect(0, 0, W, H); // joints clairs / patine
      ctx.fillStyle = rad(ctx, 540, 60, 0, 900, [[0, 'rgba(255,225,170,0.35)'], [1, 'rgba(20,10,5,0.55)']]); ctx.fillRect(0, 0, W, H);
      frame(ctx, img, 310, 190, 460, { kind: 'walnut', bar: 20, mat: 30, matColor: '#f5f1e8', shadow: { dy: 26, blur: 44, a: 0.5 } });
      // Applique
      ctx.fillStyle = '#151515'; ctx.fillRect(520, 40, 40, 16); ctx.fillRect(536, 40, 8, 70);
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.moveTo(490, 150); ctx.lineTo(590, 150); ctx.lineTo(565, 105); ctx.lineTo(515, 105); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,180,0.9)'; ctx.beginPath(); ctx.ellipse(540, 150, 50, 7, 0, 0, Math.PI * 2); ctx.fill();
      // Banquette + table
      ctx.fillStyle = lin(ctx, 0, 1080, 0, H, [[0, '#2f3b33'], [1, '#1d241f']]); rr(ctx, -20, 1080, W + 40, 320, 30); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = 20; x < W; x += 180) { rr(ctx, x, 1100, 160, 120, 20); ctx.fill(); }
      softShadow(ctx, 380, 1200, 320, 26, { dy: 10, blur: 20, a: 0.5 });
      ctx.fillStyle = '#d9d2c5'; ctx.beginPath(); ctx.ellipse(540, 1210, 170, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5f2ec'; rr(ctx, 600, 1150, 56, 56, 8); ctx.fill(); ctx.fillStyle = '#4a2f1d'; ctx.beginPath(); ctx.ellipse(628, 1154, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
      vignette(ctx, 0.4);
    },
    // Pièce sombre : mur anthracite, fauteuil cuir, spot
    moody(ctx, img) {
      wall(ctx, '#2e2f31', 'rgba(255,230,190,0.22)', 0.5, 0.15);
      ctx.fillStyle = rad(ctx, 540, 200, 0, 620, [[0, 'rgba(255,232,195,0.28)'], [1, 'rgba(255,232,195,0)']]); ctx.fillRect(0, 0, W, 1000);
      frame(ctx, img, 320, 140, 440, { kind: 'oak', bar: 18, shadow: { dy: 28, blur: 50, a: 0.6 } });
      floor(ctx, 1170, '#3b2c22', '#1f1712');
      // Fauteuil cuir
      softShadow(ctx, 600, 880, 420, 330, { dy: 26, blur: 50, a: 0.6, r: 60 });
      ctx.fillStyle = lin(ctx, 600, 0, 1020, 0, [[0, '#9a5a32'], [0.5, '#7a4221'], [1, '#4e2812']]); rr(ctx, 620, 820, 380, 300, 70); ctx.fill();
      ctx.fillStyle = lin(ctx, 0, 980, 0, 1180, [[0, '#8a4e2a'], [1, '#5a3016']]); rr(ctx, 600, 980, 420, 170, 50); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,180,0.12)'; rr(ctx, 650, 840, 300, 40, 20); ctx.fill();
      ctx.fillStyle = '#121212'; [[640], [970]].forEach(([x]) => ctx.fillRect(x, 1150, 14, 50));
      // Guéridon + verre
      ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.ellipse(250, 1010, 130, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(244, 1010, 12, 190);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.ellipse(250, 1006, 120, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,120,40,0.75)'; rr(ctx, 220, 950, 50, 56, 6); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(220, 930, 50, 76);
      plant(ctx, 60, 1190, 0.85, { pot: '#1b1b1b', leaf: ['#33452c', '#28381f', '#41573a'] });
      vignette(ctx, 0.5);
    },
  };
  function floorColor(c) { return c; }

  window.drawScene = function (id, img, s = 7) {
    seed = s * 7919;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    scenes[id](ctx, img);
    grain(ctx, 0.035);
    return cv;
  };
})();
