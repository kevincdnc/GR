// Routdoor -> Printrace : les tracés partent dans le lien (#t=…, même format
// que le partage) et Printrace les ajoute à sa bibliothèque à l'ouverture.

const PRINTRACE_PATH = 'printrace/studio/';
const printraceBase = () => (window.RoutdoorLink ? window.RoutdoorLink.siteRoot() : '../') + PRINTRACE_PATH;

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

// Export GPX d'un groupe : tous ses tracés fusionnés en un seul (une trace, un segment), dans l'ordre du groupe
function exportGroupGpx(parts, title, toast) {
  const routes = resolveShareRoutes(parts || []);
  if (!routes.length) { toast && toast('Aucun tracé à exporter dans ce groupe.'); return; }
  const esc = (v) => String(v || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const pts = routes.flatMap((r) => r.coords).map((c) => `<trkpt lat="${(+c[0]).toFixed(6)}" lon="${(+c[1]).toFixed(6)}">${typeof c[2] === 'number' ? `<ele>${Math.round(c[2] * 10) / 10}</ele>` : ''}</trkpt>`);
  const name = esc(title || 'Groupe');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Routdoor" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${name}</name><desc>${routes.length} tracés fusionnés : ${esc(routes.map((r) => r.name).join(', '))}</desc></metadata>\n<trk><name>${name}</name><trkseg>\n${pts.join('\n')}\n</trkseg></trk>\n</gpx>\n`;
  const slug = String(title || 'groupe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'groupe';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' })); a.download = slug + '.gpx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast && toast(routes.length > 1 ? `GPX exporté : ${routes.length} tracés fusionnés` : 'GPX exporté');
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
