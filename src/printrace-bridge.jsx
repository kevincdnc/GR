// Routdoor -> Printrace : les tracés partent dans le lien (#t=…, même format
// que le partage) et Printrace les ajoute à sa bibliothèque à l'ouverture.

// Studio de production (printrace.app, dépôt kevincdnc/printrace) : il lit le lien #t=… au même format
const PRINTRACE_STUDIO = 'https://printrace.app/studio/';
const printraceBase = () => PRINTRACE_STUDIO;

// parts : tracés Routdoor (sharePartsOf) ; resolved = déjà au format du studio
async function sendToPrintrace(parts, title, toast, resolved = false) {
  const routes = resolved ? (parts || []) : resolveShareRoutes(parts || []);
  if (!routes.length) { toast && toast('Affiche au moins un tracé pour l’envoyer sur Printrace.'); return; }
  // Onglet ouvert tout de suite (sinon bloqué par le navigateur), rempli après l'encodage
  let win = null;
  try { win = window.open('', '_blank'); } catch (e) {}
  try {
    const code = await window.RoutdoorLink.encodeShare({
      title,
      parts: routes.map((r) => ({
        name: r.name, color: r.color, distance: r.distance, ascent: r.ascent, descent: r.descent,
        durationMin: r.durationReal ? r.durationMin : 0, date: r.date, coords: r.coords,
      })),
    }, 6000);
    const url = printraceBase() + '#t=' + code;
    if (win) { win.opener = null; win.location.href = url; } else window.location.href = url;
    toast && toast(routes.length > 1 ? `${routes.length} tracés envoyés sur Printrace` : `« ${routes[0].name} » envoyé sur Printrace`);
  } catch (e) {
    if (win) win.close();
    toast && toast('Envoi impossible : ' + (e.message || 'erreur'));
  }
}

// Export GPX d'un groupe : une trace (<trk>) par tracé, dans l'ordre du chemin (chaque étape enchaînée à celle
// qui part le plus près de son arrivée), sans ligne droite entre deux étapes. Les chiffres de Routdoor
// (distance, D+, D−, durée, date) sont joints à chaque trace (<extensions>), relus par Printrace.
function rdChainOrder(routes) {
  const d = (a, b) => stHaversine(a, b);
  const S = (r) => r.coords[0], E = (r) => r.coords[r.coords.length - 1];
  // Départ : le tracé dont le début ne prolonge aucun autre (le plus loin de toutes les arrivées)
  const lone = (r) => Math.min(Infinity, ...routes.filter((q) => q !== r).map((q) => d(E(q), S(r))));
  let cur = routes.reduce((b, r) => (lone(r) > lone(b) ? r : b), routes[0]);
  const out = [cur], left = new Set(routes.filter((r) => r !== cur));
  while (left.size) {
    let best = null, bd = Infinity;
    left.forEach((r) => { const k = d(E(cur), S(r)); if (k < bd) { bd = k; best = r; } });
    out.push(best); left.delete(best); cur = best;
  }
  return out;
}
function exportGroupGpx(parts, title, toast) {
  const found = resolveShareRoutes(parts || []);
  if (!found.length) { toast && toast('Aucun tracé à exporter dans ce groupe.'); return; }
  const routes = rdChainOrder(found);
  const esc = (v) => String(v || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const pt = (c) => `<trkpt lat="${(+c[0]).toFixed(6)}" lon="${(+c[1]).toFixed(6)}">${typeof c[2] === 'number' ? `<ele>${Math.round(c[2] * 10) / 10}</ele>` : ''}</trkpt>`;
  const trk = (r) => `<trk><name>${esc(r.name)}</name><extensions><rd:stats distanceKm="${(+r.distance || 0).toFixed(2)}" ascentM="${Math.round(r.ascent || 0)}" descentM="${Math.round(r.descent || 0)}" durationMin="${Math.round(r.durationMin || 0)}" durationReal="${r.durationReal ? 1 : 0}" date="${esc(r.date)}" activity="${esc(r.activity)}"/></extensions><trkseg>\n${r.coords.map(pt).join('\n')}\n</trkseg></trk>`;
  const name = esc(title || 'Groupe');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Routdoor" xmlns="http://www.topografix.com/GPX/1/1" xmlns:rd="https://routdoor.app/gpx/1">\n<metadata><name>${name}</name><desc>${routes.length} tracés : ${esc(routes.map((r) => r.name).join(', '))}</desc></metadata>\n${routes.map(trk).join('\n')}\n</gpx>\n`;
  const slug = String(title || 'groupe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'groupe';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' })); a.download = slug + '.gpx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast && toast(routes.length > 1 ? `GPX exporté : ${routes.length} tracés, dans l’ordre du chemin` : 'GPX exporté');
}

// Onglet « Poster » du studio Routdoor : les posters se font sur Printrace
function PrintraceHandoff({ routes, title, onToast }) {
  const [busy, setBusy] = React.useState(false);
  const send = async () => { setBusy(true); await sendToPrintrace(routes, title, onToast, true); setBusy(false); };
  return (
    <div className="flex-1 min-h-0 overflow-y-auto sb-scroll grid place-items-center px-5 py-10" style={{ background: 'radial-gradient(ellipse at 50% 40%, #1d1d20 0%, #0a0a0b 75%)' }}>
      <div className="w-full max-w-[480px] text-center ds-fade-up">
        <div className="inline-flex text-white mb-6"><UiPrintraceLogo height={30} /></div>
        <h1 className="text-[26px] font-semibold tracking-tight">Tes posters se créent sur Printrace</h1>
        <p className="mt-2 text-[14px] text-neutral-400 leading-relaxed">
          Envoie {routes.length > 1 ? `ces ${routes.length} tracés` : 'ce tracé'} sur Printrace : modèles de poster, carte vectorielle, export HD et tirage encadré.
        </p>
        <UiButton variant="primary" size="lg" iconRight="ExternalLink" onClick={send} loading={busy} className="mt-7 min-w-[260px]">Envoyer sur Printrace</UiButton>
        <UiHint className="mt-3">Printrace s'ouvre dans un nouvel onglet avec tes tracés.</UiHint>
      </div>
    </div>
  );
}

Object.assign(window, { sendToPrintrace, PrintraceHandoff, printraceBase });
