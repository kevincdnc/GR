// Met chaque poster dans une scène d'intérieur (scenes.js) -> assets/site/insta/post-N.webp (640 × 800)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
const pairs = [['living','p1'],['hallway','p2'],['bedroom','p3'],['garage','p4'],['scandi','p5'],['desk','p6'],['flatlay','p7'],['brick','p8'],['moody','p9']];
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.setContent('<html><body></body></html>');
await p.addScriptTag({ content: readFileSync('scenes.js', 'utf8') });
for (const [i, [sc, po]] of pairs.entries()) {
  const data = 'data:image/png;base64,' + readFileSync(`insta/${po}.png`).toString('base64');
  const out = await p.evaluate(async ([sc, data, i]) => {
    const img = new Image(); img.src = data; await img.decode();
    const big = drawScene(sc, img, i + 3);
    const sm = document.createElement('canvas'); sm.width = 640; sm.height = 800;
    const c = sm.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(big, 0, 0, 640, 800);
    return [sm.toDataURL('image/webp', 0.82), big.toDataURL('image/jpeg', 0.9)];
  }, [sc, data, i]);
  writeFileSync(`../../assets/site/insta/post-${i + 1}.webp`, Buffer.from(out[0].split(',')[1], 'base64'));
}
await b.close();
