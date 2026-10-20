// Posters des posts Instagram du site : rendus par le moteur Printrace depuis le site compilé
// (npm run build, dist/ servi sur http://localhost:8099/GR/), puis compose.mjs les met en scène.
// Lancer depuis scripts/insta/ : node posters.mjs '[["p1","roadtrip",null,{},null], ...]'
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8099/GR/printrace/', { waitUntil: 'load' });
await p.waitForFunction(() => typeof SITE_CASES !== 'undefined' && typeof renderPoster === 'function', null, { timeout: 60000 });
await p.waitForTimeout(3000);
// [nom, cas, modèle (null = celui du cas), réglages, bordure]
const list = JSON.parse(process.argv[2]);
for (const [name, cid, tpl, o, border] of list) {
  const url = await p.evaluate(async ([cid, tpl, o, border]) => {
    const c = SITE_CASES.find((x) => x.id === cid);
    await storyFontsReady({ vintage: false });
    const fmt = POSTER_FORMATS[1];
    const pp = sitePosterOf(c, tpl);
    const t = POSTER_TEMPLATES.find((x) => x.id === pp.tpl);
    const w = 1000, h = Math.round(w * fmt.mm[1] / fmt.mm[0]);
    const res = await Promise.all((c.photos || []).map(async (ph) => ph.src ? { src: ph.src } : null));
    const photos = await sitePosterPhotos(c, res);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    await renderPoster(cv, t, sitePosterData(c, siteRoutesOf(c), photos, { tpl, ...o }), fmt, border || pp.border || 'none', w / PO_W);
    return cv.toDataURL('image/png');
  }, [cid, tpl, o || {}, border]);
  writeFileSync(`insta/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('ok', name);
}
await b.close();
