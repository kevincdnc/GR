// Printrace — fichiers d'impression.
//
// PDF « imprimeur » : 300 dpi au format exact, fond perdu de 3 mm tout autour
// (prolongement des bords du poster), TrimBox / BleedBox renseignées : le format
// fini est lu directement par les logiciels des imprimeurs. Le PDF est construit
// ici, sans bibliothèque : une page, une image JPEG (qualité 95 %).
// PNG 300 dpi et SVG vectoriel (carte, tracé et textes en vecteurs) en complément.

const AP_BLEED_MM = 3;
const apIsSafari = () => /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

// Taille de l'image : 300 dpi, réduite seulement si le navigateur limite les grands canvas
function apPrintSize(fmt, bleedMm = 0) {
  const maxArea = apIsSafari() ? 16.7e6 : 140e6, maxSide = apIsSafari() ? 8192 : 16000;
  const at = (dpi) => ({ dpi, w: Math.round((fmt.mm[0] + 2 * bleedMm) / 25.4 * dpi), h: Math.round((fmt.mm[1] + 2 * bleedMm) / 25.4 * dpi) });
  let s = at(300);
  const k = Math.min(1, Math.sqrt(maxArea / (s.w * s.h)), maxSide / Math.max(s.w, s.h));
  if (k < 1) s = at(Math.floor(300 * k));
  return { ...s, bleed: Math.round(bleedMm / 25.4 * s.dpi) };
}

// Fond perdu : le poster au centre, ses bords prolongés de `b` pixels tout autour
function apWithBleed(src, b) {
  if (!b) return src;
  const w = src.width, h = src.height, c = document.createElement('canvas');
  c.width = w + 2 * b; c.height = h + 2 * b;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, b, b);
  g.drawImage(src, 0, 0, w, 1, b, 0, w, b);            // haut
  g.drawImage(src, 0, h - 1, w, 1, b, h + b, w, b);     // bas
  g.drawImage(src, 0, 0, 1, h, 0, b, b, h);             // gauche
  g.drawImage(src, w - 1, 0, 1, h, w + b, b, b, h);     // droite
  [[0, 0, 0, 0], [w - 1, 0, w + b, 0], [0, h - 1, 0, h + b], [w - 1, h - 1, w + b, h + b]]
    .forEach(([sx, sy, dx, dy]) => g.drawImage(src, sx, sy, 1, 1, dx, dy, b, b)); // coins
  return c;
}

// PDF d'une page contenant une image JPEG. mm : format de la page avec fond perdu ;
// trimMm : format fini (centré). Renvoie un Blob application/pdf.
function apJpegToPdf(jpeg, imgW, imgH, mm, trimMm, title) {
  const pt = (v) => (v / 25.4 * 72).toFixed(3);
  const W = pt(mm[0]), H = pt(mm[1]);
  const bx = pt((mm[0] - trimMm[0]) / 2), by = pt((mm[1] - trimMm[1]) / 2);
  const tx = pt((mm[0] + trimMm[0]) / 2), ty = pt((mm[1] + trimMm[1]) / 2);
  const enc = new TextEncoder();
  const parts = [], offsets = [];
  let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  const esc = (s) => String(s || '').replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '');
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /BleedBox [0 0 ${W} ${H}] /TrimBox [${bx} ${by} ${tx} ${ty}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream'); });
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  obj(6, () => push(`<< /Title (${esc(title)}) /Creator (Printrace) /Producer (Printrace) >>`));
  const xref = len;
  push(`xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((n) => String(offsets[n]).padStart(10, '0') + ' 00000 n \n').join('')}`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

function apSaveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Rendu du poster au format fini, à la résolution d'impression
async function apRenderPrint(tpl, data, fmt, border, size) {
  await storyFontsReady();
  const w = size.w - 2 * size.bleed, h = size.h - 2 * size.bleed;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  await renderPoster(c, tpl, { ...data, preview: false }, fmt, border, w / PO_W);
  return c;
}

async function apExportPdf(tpl, data, fmt, border, name) {
  const size = apPrintSize(fmt, AP_BLEED_MM);
  const page = apWithBleed(await apRenderPrint(tpl, data, fmt, border, size), size.bleed);
  const blob = await new Promise((res) => page.toBlob(res, 'image/jpeg', 0.95));
  if (!blob) throw new Error('image trop grande pour ce navigateur');
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = apJpegToPdf(jpeg, page.width, page.height, [fmt.mm[0] + 2 * AP_BLEED_MM, fmt.mm[1] + 2 * AP_BLEED_MM], fmt.mm, data.title);
  apSaveBlob(pdf, name + '.pdf');
  return size;
}
async function apExportPng(tpl, data, fmt, border, name) {
  const size = apPrintSize(fmt, 0);
  const c = await apRenderPrint(tpl, data, fmt, border, size);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  if (!blob) throw new Error('image trop grande pour ce navigateur');
  apSaveBlob(blob, name + '.png');
  return size;
}
async function apExportSvg(tpl, data, fmt, border, name) {
  await storyFontsReady();
  const svg = await renderPosterSvg(tpl, { ...data, preview: false }, fmt, border);
  apSaveBlob(new Blob([svg], { type: 'image/svg+xml' }), name + '.svg');
}

Object.assign(window, { AP_BLEED_MM, apPrintSize, apExportPdf, apExportPng, apExportSvg });
