// Lecture des fichiers de trace, partagée par Routdoor et Printrace.
// S'appuie sur window.GpxLib (lib/gpx.mjs, servi en js/gpx.js).

// Formats de trace acceptés (GPX, FIT, TCX, KML/KMZ, GeoJSON, IGC)
const TRACK_EXTS = (window.GpxLib && window.GpxLib.TRACK_EXTENSIONS) || ['gpx'];
const TRACK_ACCEPT = TRACK_EXTS.map((e) => '.' + e).join(',');
const isTrackFile = (f) => new RegExp('\\.(' + TRACK_EXTS.join('|') + ')$', 'i').test((f && f.name) || '');
const trackExt = (name) => ((String(name || '').match(/\.([a-z0-9]+)$/i) || [])[1] || 'gpx').toUpperCase();

// KMZ = archive ZIP contenant un .kml : lecture du répertoire central puis
// décompression « deflate » native du navigateur (DecompressionStream).
async function unzipFirstKml(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('archive KMZ invalide');
  let p = dv.getUint32(eocd + 16, true);
  const n = dv.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    p += 46 + nlen + xlen + clen;
    if (!/\.kml$/i.test(name)) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = new Uint8Array(buf, start, csize);
    if (method === 0) return dec.decode(data);
    if (method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('KMZ non pris en charge par ce navigateur');
    const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return dec.decode(out);
  }
  throw new Error('aucun .kml dans le KMZ');
}

// Lit n'importe quel fichier de trace et renvoie l'étape analysée
async function readTrackFile(f) {
  const buf = await f.arrayBuffer();
  const data = /\.kmz$/i.test(f.name) ? await unzipFirstKml(buf) : buf;
  const track = window.GpxLib.parseTrack(/\.kmz$/i.test(f.name) ? f.name.replace(/\.kmz$/i, '.kml') : f.name, data);
  return window.GpxLib.buildStageFromTrack(track, f.name);
}

Object.assign(window, { TRACK_EXTS, TRACK_ACCEPT, isTrackFile, trackExt, unzipFirstKml, readTrackFile });
