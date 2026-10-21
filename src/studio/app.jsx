// Printrace — l'app (studio) : du tracé au poster, en 4 étapes.
//
//  1. Import : barre de gauche (fichier, Strava, Komoot, Routdoor…) ; au centre,
//     un poster avec la carte de France, sans tracé.
//  2. Modèle : 6 modèles (Plan, Nuit, Éditorial, Galerie, et deux avec une photo
//     derrière : Photo, Polaroïd). La barre d'outils apparaît au-dessus du poster :
//     couleur du tracé, typographie (3 choix vérifiés par modèle), zoom de la carte
//     (3 niveaux), photos, et « Enregistrer ce modèle ».
//  3. Infos : nom, description, activité, infos affichées (réordonnables).
//  4. Impression : format, bordure, cadre ; télécharger en HD ou commander.
//
// Même moteur de rendu que l'ancienne version (src/poster-share.jsx).

const { useState: useApState, useEffect: useApEffect, useMemo: useApMemo, useRef: useApRef } = React;

const AP_TRACKS_KEY = 'printrace_app_tracks_v2';
const AP_STATE_KEY = 'printrace_app_state_v2';
const AP_MODELS_KEY = 'printrace_app_models_v2';

// Modèles proposés (dans l'ordre de la grille)
const AP_TEMPLATES = ['blueprint', 'nuit', 'relief', 'galerie', 'photo', 'polaroid'];
// Typographies des titres : 3 choix par modèle, testés sur chaque mise en page
const AP_FONTS = {
  modele: null,
  moderne: ST_TXT,
  classique: PO_SERIF,
  affiche: '"Unbounded", Barlow, system-ui, sans-serif',
  ancienne: PO_FELL,
};
const AP_FONT_CHOICES = {
  blueprint: [['modele', 'Technique'], ['affiche', 'Affiche'], ['classique', 'Classique']],
  nuit: [['modele', 'Moderne'], ['affiche', 'Affiche'], ['classique', 'Classique']],
  relief: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['ancienne', 'Ancienne carte']],
  galerie: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['affiche', 'Affiche']],
  photo: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['affiche', 'Affiche']],
  polaroid: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['ancienne', 'Ancienne carte']],
};
const AP_FONT_PREVIEW = { modele: null, moderne: ST_TXT, classique: PO_SERIF, affiche: AP_FONTS.affiche, ancienne: PO_FELL };
// Police « du modèle » (aperçu du bouton) : celle de ses titres
const AP_NATIVE_FONT = { blueprint: ST_TXT, nuit: ST_TXT, relief: PO_SERIF, galerie: PO_SERIF, photo: PO_SERIF, polaroid: PO_SERIF };
// Zoom de la carte : 0 = cadré sur le tracé, puis deux niveaux plus larges
const AP_ZOOMS = [0, 0.7, 1.8];
// Carte de France (poster d'accueil, sans tracé)
const AP_FRANCE = [[51.1, -4.9], [42.3, 8.3]];
// Photo par défaut des modèles « photo » (remplaçable)
const apDefaultPhoto = () => ptRes('appPhotoDefault', 'assets/site/trek-2.webp');
const AP_STEPS = ['Import', 'Modèle', 'Infos', 'Impression'];

const apTpl = (id) => POSTER_TEMPLATES.find((t) => t.id === id) || POSTER_TEMPLATES[0];
const apLoad = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } };
const apSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const apKm = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('fr-FR') + ' km';

// Tracé « fantôme » : cadre la carte (France vide, zoom arrière) sans être dessiné
function apGhost(a, b) {
  return { id: 'ghost', ghost: true, name: '', color: '#ffffff', coords: [[a[0], a[1], 0], [b[0], b[1], 0]], distance: 0, ascent: 0, descent: 0, durationMin: 0, durationReal: true, altMax: null };
}
// Emprise élargie autour des tracés (niveau de zoom > 0)
function apZoomGhost(routes, k) {
  if (!k) return null;
  let a = 90, b = 180, c = -90, d = -180;
  routes.forEach((r) => r.coords.forEach((p) => { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }));
  const dl = Math.max(c - a, 0.02) * k, dn = Math.max(d - b, 0.02) * k;
  return apGhost([c + dl / 2, b - dn / 2], [a - dl / 2, d + dn / 2]);
}

// Lien Komoot : tour enregistré ou planifié -> identifiant
function apParseKomoot(input) {
  const v = String(input || '').trim();
  if (!v) return null;
  const m = v.match(/komoot\.[a-z.]+\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?tour\/(\d+)/i);
  if (m) return { id: m[1] };
  if (/^\d{5,}$/.test(v)) return { id: v };
  return { invalid: true };
}

// ---------------------------------------------------------------- barre de gauche (import)
function ApKomootLink({ onFiles }) {
  const [value, setValue] = useApState('');
  const [ref, setRef] = useApState(null);
  const [error, setError] = useApState('');
  const submit = () => {
    const r = apParseKomoot(value);
    if (!r || r.invalid) { setError('Ce lien n’est pas un tour Komoot (komoot.com/tour/…).'); return; }
    setError(''); setRef(r);
  };
  return (
    <div>
      <UiInput icon={<img src={ptRes('komootLogo', 'assets/komoot.svg')} alt="" width="18" height="18" className="rounded-[4px] shrink-0" />}
        value={value} onChange={(e) => { setValue(e.target.value); setError(''); setRef(null); }} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="https://www.komoot.com/tour/…" invalid={!!error} aria-label="Lien de tour Komoot"
        action={<UiButton size="sm" onClick={submit} className="!bg-[#5f9f19] !text-white hover:!brightness-110">Importer</UiButton>} />
      {error && <p className="mt-1.5 text-[11.5px] text-red-300 leading-snug">{error}</p>}
      {ref && (
        <div className="mt-3 rounded-xl bg-[#5f9f19]/[0.08] ring-1 ring-[#5f9f19]/30 p-3.5 ds-fade-up">
          <div className="text-[12.5px] text-neutral-200 leading-snug">Téléchargez le GPX du tour n° {ref.id} depuis votre compte Komoot, puis déposez-le ici.</div>
          <a href={`https://www.komoot.com/tour/${ref.id}/download`} target="_blank" rel="noopener"
            className="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold text-white bg-[#5f9f19] hover:brightness-110"><I.Download size={14} /> Télécharger le GPX</a>
          <UiDropzone size="sm" accept={TRACK_ACCEPT} title="Déposer le GPX Komoot" action="choisir le fichier" className="mt-3"
            onFiles={(fs) => onFiles(fs, { source: 'komoot' }).then(() => { setRef(null); setValue(''); })} />
        </div>
      )}
    </div>
  );
}

function ApSidebar({ tracks, onFiles, busy, onRemove, onClear, user }) {
  const root = window.RoutdoorLink ? window.RoutdoorLink.siteRoot() : '../../';
  const soon = (icon, label, sub) => (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/[0.02] ring-1 ring-white/[0.06]">
      <span className="w-[30px] h-[30px] rounded-md grid place-items-center bg-white/[0.06] text-neutral-400 shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-neutral-300">{label}</span>
        <span className="block text-[11px] text-neutral-500 truncate">{sub}</span>
      </span>
      <UiBadge>Bientôt</UiBadge>
    </div>
  );
  return (
    <aside className="lg:w-[320px] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/[0.07] bg-[#0c0c0d] lg:h-full">
      <div className="shrink-0 h-16 flex items-center px-5 border-b border-white/[0.06]">
        <a href={root + 'printrace/'} aria-label="Printrace" className="text-white"><UiPrintraceLogo height={22} /></a>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto sb-scroll px-5 py-5">
        <h1 className="text-[17px] font-semibold tracking-tight">Importez votre tracé</h1>
        <p className="mt-1 text-[12.5px] text-neutral-400 leading-snug">Un ou plusieurs tracés : ils s’affichent tout de suite sur le poster.</p>

        <UiDropzone className="mt-4" size="sm" accept={TRACK_ACCEPT} onFiles={(fs) => onFiles(fs)} busy={busy} title="Fichier GPX, FIT, TCX, KML…" action="parcourir" />

        <UiEyebrow className="mt-5 mb-2">Strava</UiEyebrow>
        <PtStravaLink onFiles={onFiles} compact />
        <UiEyebrow className="mt-5 mb-2">Komoot</UiEyebrow>
        <ApKomootLink onFiles={onFiles} />

        <UiEyebrow className="mt-5 mb-2">Autres sources</UiEyebrow>
        <div className="flex flex-col gap-1.5">
          {soon(<I.MarkerPin size={15} />, 'Itinéraire Google Maps', 'Collez le lien d’un itinéraire')}
          {soon(<I.Camera size={15} />, 'Depuis une capture d’écran', 'Une capture d’itinéraire ou de carte')}
        </div>
        <a href={root + 'routdoor/'} target="_blank" rel="noopener"
          className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.1] hover:bg-white/[0.07] transition-colors">
          <span className="w-[30px] h-[30px] rounded-md grid place-items-center bg-white text-neutral-900 shrink-0"><I.Route size={16} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-white">Créer mon tracé dans Routdoor</span>
            <span className="block text-[11px] text-neutral-500">Puis « Envoyer sur Printrace »</span>
          </span>
          <I.ExternalLink size={14} className="text-neutral-400" />
        </a>

        {tracks.length > 0 && (
          <div className="mt-6">
            <UiEyebrow aside={<button onClick={onClear} className="text-[11px] text-neutral-500 hover:text-white normal-case tracking-normal font-normal">Tout retirer</button>} className="mb-2">
              Vos tracés · {tracks.length}
            </UiEyebrow>
            <ul className="rounded-xl ring-1 ring-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
              {tracks.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 pl-3 pr-1.5 h-12 bg-white/[0.02]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color || '#3b82f6' }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium text-white truncate">{t.name}</span>
                    <span className="block text-[11px] text-neutral-500 tabular-nums">{apKm(t.distance || 0)}</span>
                  </span>
                  <UiIconButton icon="X" label={'Retirer ' + t.name} size="xs" onClick={() => onRemove(t.id)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="shrink-0 hidden lg:flex items-center gap-2.5 px-5 h-14 border-t border-white/[0.06] text-[12px] text-neutral-500">
        <span className="w-7 h-7 rounded-full grid place-items-center bg-white/[0.08] text-neutral-200 text-[11px] font-semibold uppercase">{((user && (user.name || user.email)) || 'i')[0]}</span>
        <span className="flex-1 min-w-0 truncate">{user ? user.email : 'Mode test (sans compte)'}</span>
        <a href={root + 'printrace/v1/'} className="hover:text-white whitespace-nowrap">v-1</a>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- barre d'outils (au-dessus du poster)
function ApPopover({ open, onClose, children, align = 'center' }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute top-full mt-2 z-50 rounded-xl bg-[#141416] ring-1 ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-3 animate-menu ${align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>{children}</div>
    </>
  );
}

function ApToolbar({ tpl, cfg, setCfg, photosCount, maxPhotos, onPhoto, onSaveModel }) {
  const [open, setOpen] = useApState('');
  const rec = tpl.rec || { colors: [] };
  const colors = [...rec.colors, ...SHARE_COLORS.map((c) => c.value).filter((v) => v !== 'routes' && !rec.colors.includes(v))];
  const cur = cfg.color === 'auto' ? null : cfg.color;
  const fonts = AP_FONT_CHOICES[tpl.id] || AP_FONT_CHOICES.blueprint;
  const fontName = (fonts.find(([k]) => k === cfg.font) || fonts[0])[1];
  const btn = (on) => `h-9 rounded-lg flex items-center gap-2 px-2.5 text-[12.5px] font-medium transition-colors ${on ? 'bg-white/[0.12] text-white' : 'text-neutral-300 hover:bg-white/[0.07] hover:text-white'}`;
  const sep = <span className="w-px h-5 bg-white/10 mx-0.5" />;
  return (
    <div className="relative z-20 inline-flex items-center gap-0.5 rounded-xl bg-[#141416]/90 backdrop-blur ring-1 ring-white/10 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] p-1">
      {/* Couleur du tracé */}
      <div className="relative">
        <button onClick={() => setOpen(open === 'color' ? '' : 'color')} className={btn(open === 'color')} title="Couleur du tracé">
          <span className="w-4 h-4 rounded-full ring-1 ring-white/30" style={{ background: cur || 'conic-gradient(#fc5200,#facc15,#3b82f6,#ffffff,#fc5200)' }} />
          <span className="hidden sm:inline">Couleur</span>
        </button>
        <ApPopover open={open === 'color'} onClose={() => setOpen('')} align="left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 mb-2">Couleur du tracé</div>
          <div className="flex items-center gap-1.5 w-max">
            <button onClick={() => setCfg({ color: 'auto' })} className={`h-7 px-2.5 rounded-full text-[11.5px] font-semibold bg-white/[0.06] ${cfg.color === 'auto' ? 'ring-2 ring-white' : 'ring-1 ring-white/15'}`}>Auto</button>
            {colors.map((c) => (
              <span key={c} className="relative">
                <button onClick={() => setCfg({ color: c })} title={rec.colors.includes(c) ? 'Recommandé pour ce modèle' : undefined}
                  className={`block w-7 h-7 rounded-full transition-transform hover:scale-110 ${cfg.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141416]' : 'ring-1 ring-white/15'}`} style={{ background: c }} />
                {rec.colors.includes(c) && <UiRecDot floating />}
              </span>
            ))}
            <label title="Ma couleur" className="relative w-7 h-7 rounded-full cursor-pointer overflow-hidden ring-1 ring-white/15" style={{ background: 'conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ec4899,#ef4444)' }}>
              <input type="color" value={cur || '#ff6b35'} onChange={(e) => setCfg({ color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
          <p className="mt-2.5 text-[11px] text-neutral-500 flex items-center gap-1.5"><UiRecDot /> Recommandé pour l’impression</p>
        </ApPopover>
      </div>
      {sep}
      {/* Typographie */}
      <div className="relative">
        <button onClick={() => setOpen(open === 'font' ? '' : 'font')} className={btn(open === 'font')} title="Typographie">
          <span className="text-[15px] font-semibold leading-none" style={{ fontFamily: AP_FONT_PREVIEW[cfg.font] || AP_NATIVE_FONT[tpl.id] }}>Aa</span>
          <span className="hidden sm:inline">{fontName}</span>
        </button>
        <ApPopover open={open === 'font'} onClose={() => setOpen('')}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 mb-2">Typographie du titre</div>
          <div className="flex flex-col gap-1 w-[220px]">
            {fonts.map(([k, name]) => (
              <button key={k} onClick={() => { setCfg({ font: k }); setOpen(''); }}
                className={`flex items-center gap-3 rounded-lg px-2.5 h-11 text-left transition-colors ${cfg.font === k ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]'}`}>
                <span className="text-[19px] w-10 text-white" style={{ fontFamily: AP_FONT_PREVIEW[k] || AP_NATIVE_FONT[tpl.id], fontWeight: k === 'ancienne' ? 400 : 700 }}>Aa</span>
                <span className="flex-1 text-[12.5px] text-neutral-200">{name}</span>
                {cfg.font === k && <I.Check size={14} />}
              </button>
            ))}
          </div>
        </ApPopover>
      </div>
      {sep}
      {/* Zoom de la carte : 3 niveaux */}
      <div className="flex items-center gap-1 px-1" title="Zoom de la carte">
        <UiIconButton icon="Minus" label="Dézoomer la carte" size="sm" disabled={cfg.zoom >= AP_ZOOMS.length - 1} onClick={() => setCfg({ zoom: Math.min(AP_ZOOMS.length - 1, cfg.zoom + 1) })} />
        <span className="flex items-center gap-1">
          {AP_ZOOMS.map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${AP_ZOOMS.length - 1 - i === cfg.zoom ? 'bg-white' : 'bg-white/25'}`} />)}
        </span>
        <UiIconButton icon="Plus" label="Zoomer sur le tracé" size="sm" disabled={cfg.zoom <= 0} onClick={() => setCfg({ zoom: Math.max(0, cfg.zoom - 1) })} />
      </div>
      {sep}
      {/* Photos */}
      <button onClick={onPhoto} className={btn(false)} title={tpl.photoBg ? 'Changer la photo de fond' : 'Ajouter des photos'} disabled={!tpl.photoBg && !maxPhotos}>
        <I.ImagePlus size={16} />
        <span className="hidden sm:inline">{tpl.photoBg ? 'Photo' : 'Photos'}</span>
        {!tpl.photoBg && photosCount > 0 && <span className="text-[11px] tabular-nums text-neutral-400">{Math.min(photosCount, maxPhotos)}/{maxPhotos}</span>}
      </button>
      {sep}
      <button onClick={onSaveModel} className={btn(false)} title="Enregistrer ce modèle (style, couleur, typo, zoom) pour le réutiliser">
        <I.Folder size={15} /><span className="hidden xl:inline">Enregistrer le modèle</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- app
function PrintraceStudio() {
  const [tracks, setTracks] = useApState(() => apLoad(AP_TRACKS_KEY, []));
  const saved = useApMemo(() => apLoad(AP_STATE_KEY, {}), []);
  const [step, setStep] = useApState(() => (tracks.length ? Math.max(2, saved.step || 2) : 1));
  const [cfg, setCfgState] = useApState(() => ({
    tplId: 'blueprint', color: 'auto', font: 'modele', zoom: 0, title: null, subtitle: null, actId: null,
    order: null, enabled: null, values: {}, fmtId: 'a3', border: 'none', mock: 'noir', ...(saved.cfg || {}),
  }));
  const setCfg = (p) => setCfgState((c) => ({ ...c, ...(typeof p === 'function' ? p(c) : p) }));
  const [models, setModels] = useApState(() => apLoad(AP_MODELS_KEY, []));
  const [photos, setPhotos] = useApState([]);     // photos du voyage (poster)
  const [bgPhoto, setBgPhoto] = useApState(null); // photo de fond (modèles « photo »)
  const [busy, setBusy] = useApState(false);
  const [exporting, setExporting] = useApState(false);
  const [ordered, setOrdered] = useApState(false);
  const [ready, setReady] = useApState(false);
  const [toast, showToast] = useUiToast();
  const user = useApMemo(() => (typeof ptAuthUser === 'function' ? ptAuthUser() : null), []);
  const previewRef = useApRef(null), thumbRefs = useApRef({}), photoInput = useApRef(null);

  useApEffect(() => { if (!apSave(AP_TRACKS_KEY, tracks) && tracks.length) showToast('Stockage du navigateur plein'); }, [tracks]);
  useApEffect(() => { apSave(AP_STATE_KEY, { step, cfg }); }, [step, cfg]);
  useApEffect(() => { apSave(AP_MODELS_KEY, models); }, [models]);

  // Photo de fond par défaut (modèles « photo »), en attendant la vôtre
  const [defaultBg, setDefaultBg] = useApState(null);
  useApEffect(() => { const im = new Image(); im.onload = () => setDefaultBg(im); im.src = apDefaultPhoto(); }, []);

  // Ajout de tracés : fichiers, liens, envoi du site ou de Routdoor
  const addTracks = (items, label) => {
    setTracks((prev) => {
      const fresh = items.filter((it) => !prev.some((p) => ptSame(p, it))).map((it, i) => ({ ...it, color: it.color || ptNextColor(prev, i) }));
      return [...prev, ...fresh];
    });
    showToast(label);
    setStep((s) => (s < 2 ? 2 : s));
  };
  const importFiles = async (fileList, extra = {}) => {
    const files = [...(fileList || [])].filter(isTrackFile);
    if (!files.length) { showToast('Formats acceptés : GPX, FIT, TCX, KML, GeoJSON, IGC'); return; }
    setBusy(true);
    const res = await Promise.all(files.map((f) => readTrackFile(f).then((st) => ({ f, st })).catch(() => ({ f, st: null }))));
    setBusy(false);
    const ok = res.filter((r) => r.st && r.st.coords && r.st.coords.length > 1);
    if (!ok.length) { showToast('Impossible de lire ce fichier'); return; }
    const items = ok.map((r) => ptFromStage(r.st, r.f.name, extra));
    addTracks(items, items.length > 1 ? `${items.length} tracés importés` : `« ${items[0].name} » importé`);
  };
  // Arrivée depuis le site ou Routdoor (#t=…)
  useApEffect(() => {
    ptReadInbox().then((d) => {
      if (!d) return;
      history.replaceState(null, '', location.pathname + location.search);
      const site = d.from === 'site';
      const items = d.parts.map((p) => ptFromShared(p, { activity: d.activity, source: site ? (d.source || 'file') : 'routdoor' }));
      if (d.title) setCfg({ title: d.title });
      // Activité du site (road trip, moto, course…) : reprise si le studio la connaît
      if (d.activity) setCfg({ actId: PO_ACTIVITIES.some((x) => x.id === d.activity) ? d.activity : poActivityOf([{ activity: d.activity }]) });
      addTracks(items, items.length > 1 ? `${items.length} tracés reçus` : `« ${items[0].name} » reçu`);
    }).catch(() => showToast('Ce lien de tracé est incomplet'));
  }, []);
  const removeTrack = (id) => setTracks((l) => { const n = l.filter((t) => t.id !== id); if (!n.length) setStep(1); return n; });

  // ---- données du poster
  const has = tracks.length > 0;
  const tpl = apTpl(cfg.tplId);
  const actId = cfg.actId || poActivityOf(tracks);
  const act = poActivity(actId);
  const fmt = POSTER_FORMATS.find((f) => f.id === cfg.fmtId) || POSTER_FORMATS[1];
  const agg = useApMemo(() => (has ? poAggregate(tracks, act) : null), [tracks, actId]);
  const allKeys = useApMemo(() => [...act.avail, 'start'], [actId]);
  const order = useApMemo(() => {
    const base = (cfg.order || [...act.metrics, ...act.avail.filter((k) => !act.metrics.includes(k))]).filter((k) => allKeys.includes(k));
    return [...base, ...allKeys.filter((k) => !base.includes(k))];
  }, [cfg.order, actId]);
  const enabled = useApMemo(() => new Set(cfg.enabled || act.metrics), [cfg.enabled, actId]);
  const defaultTitle = tracks.length === 1 ? tracks[0].name : tracks.length ? 'Mon aventure' : 'Votre aventure';
  const defaultSub = useApMemo(() => {
    if (!has) return 'Importez votre tracé pour commencer';
    const bits = [];
    if (tracks.length > 1) bits.push(`${tracks.length} étapes`);
    if (agg && agg.dateLabel) bits.push(agg.dateLabel);
    return bits.join(' · ');
  }, [has, tracks.length, agg]);
  const infoX = useApMemo(() => ({ activity: act.label, start: has ? tracks[0].coords[0] : null }), [act, tracks]);
  const metricValues = useApMemo(() => {
    const m = {}; if (agg) poStats(agg, order, infoX).forEach((st) => { m[st.key] = st.value + (st.unit ? ' ' + st.unit : ''); }); return m;
  }, [agg, order, infoX]);

  const dataFor = (t) => {
    const rec = t.rec || {};
    const routes = has ? [...tracks, ...[apZoomGhost(tracks, AP_ZOOMS[cfg.zoom])].filter(Boolean)] : [apGhost(AP_FRANCE[0], AP_FRANCE[1])];
    const stats = has ? poStats(agg, order.filter((k) => enabled.has(k)), infoX).map((st) => (cfg.values[st.key] ? { ...st, value: cfg.values[st.key], unit: '' } : st)) : [];
    return {
      routes, agg: agg || {}, color: cfg.color, coords: has, activityLabel: has ? act.label : '',
      title: (cfg.title != null && cfg.title.trim()) || defaultTitle, subtitle: cfg.subtitle != null ? cfg.subtitle : defaultSub,
      stats, photoSlot: false, photos: t.photoBg ? [] : photos, bgPhoto: (bgPhoto && bgPhoto.img) || defaultBg,
      showMap: has ? !!rec.map : true, mapStyle: rec.mapStyle || 'epure', mapOpacity: (rec.mapOpacity || 100) / 100,
      mapLabels: true, bg: rec.bg || null, preview: true,
      titleFont: AP_FONTS[cfg.font] || null,
    };
  };

  // ---- rendu : aperçu, puis vignettes des modèles (étape 2), l'un après l'autre
  const token = useApRef(0);
  useApEffect(() => {
    const my = ++token.current;
    const t = setTimeout(async () => {
      await storyFontsReady();
      if (my !== token.current) return;
      const c = previewRef.current;
      if (c) {
        // Rendu hors écran puis copie : deux rendus qui se chevauchent ne se mélangent jamais
        const pw = 1000, off = document.createElement('canvas');
        off.width = pw; off.height = Math.round(pw * fmt.mm[1] / fmt.mm[0]);
        await renderPoster(off, tpl, dataFor(tpl), fmt, step >= 4 ? cfg.border : 'none', pw / PO_W);
        if (my !== token.current) return;
        c.width = off.width; c.height = off.height; c.getContext('2d').drawImage(off, 0, 0);
        setReady(true);
      }
      if (step !== 2) return;
      for (const id of AP_TEMPLATES) {
        const tc = thumbRefs.current[id];
        if (!tc || my !== token.current) continue;
        const off = document.createElement('canvas');
        off.width = 240; off.height = Math.round(240 * fmt.mm[1] / fmt.mm[0]);
        await renderPoster(off, apTpl(id), dataFor(apTpl(id)), fmt, 'none', 240 / PO_W);
        if (my !== token.current) return;
        tc.width = off.width; tc.height = off.height; tc.getContext('2d').drawImage(off, 0, 0);
      }
    }, 80);
    return () => clearTimeout(t);
  }, [tracks, cfg, photos, bgPhoto, defaultBg, step]);

  // ---- actions
  const onPhotoFiles = async (files) => {
    const list = (await Promise.all([...files].slice(0, 4).map(readImageFile))).filter(Boolean);
    if (!list.length) return;
    if (tpl.photoBg) { setBgPhoto(list[0]); showToast('Photo de fond ajoutée'); }
    else { setPhotos((p) => [...p, ...list].slice(0, 4)); showToast(list.length > 1 ? `${list.length} photos ajoutées` : 'Photo ajoutée'); }
  };
  const saveModel = () => {
    const m = { id: Date.now(), name: `${tpl.name} · ${(AP_FONT_CHOICES[tpl.id].find(([k]) => k === cfg.font) || AP_FONT_CHOICES[tpl.id][0])[1]}`, tplId: cfg.tplId, color: cfg.color, font: cfg.font, zoom: cfg.zoom, border: cfg.border, mock: cfg.mock, fmtId: cfg.fmtId };
    setModels((ms) => [m, ...ms].slice(0, 8));
    showToast('Modèle enregistré : retrouvez-le à l’étape « Modèle »');
  };
  const applyModel = (m) => setCfg({ tplId: m.tplId, color: m.color, font: m.font, zoom: m.zoom, border: m.border, mock: m.mock, fmtId: m.fmtId });
  const setOrder = (f) => setCfg((c) => ({ order: f(order), enabled: [...enabled] }));
  const toggleMetric = (k) => setCfg(() => { const n = new Set(enabled); if (n.has(k)) n.delete(k); else n.add(k); return { order, enabled: [...n] }; });
  const setMetricValue = (k, v) => setCfg((c) => { const vals = { ...c.values }; if (v && v.trim()) vals[k] = v.trim(); else delete vals[k]; return { values: vals }; });

  const exp = poExportSize(fmt);
  const download = async () => {
    setExporting(true);
    try {
      await storyFontsReady();
      const c = document.createElement('canvas'); c.width = exp.w; c.height = exp.h;
      await renderPoster(c, tpl, { ...dataFor(tpl), preview: false }, fmt, cfg.border, exp.w / PO_W);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      const slug = (dataFor(tpl).title || 'aventure').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `printrace-${slug || 'aventure'}-${fmt.id}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      showToast(`Poster ${fmt.name} téléchargé (${exp.w} × ${exp.h} px)`);
    } catch (e) { showToast('Export impossible : ' + e.message); }
    setExporting(false);
  };

  // Dépôt d'un fichier n'importe où
  const [dropping, setDropping] = useApState(false);
  const dropProps = {
    onDragOver: (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } },
    onDragLeave: (e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) setDropping(false); },
    onDrop: (e) => { setDropping(false); const fs = [...e.dataTransfer.files]; if (fs.some(isTrackFile)) { e.preventDefault(); importFiles(fs); } else if (has && fs.some((f) => /^image\//.test(f.type))) { e.preventDefault(); onPhotoFiles(fs); } },
  };

  const ms = step >= 4 ? PO_MOCK_STYLE[cfg.mock] : null;

  return (
    <div className="h-full flex flex-col lg:flex-row bg-neutral-950 text-white overflow-y-auto lg:overflow-hidden" {...dropProps}>
      <ApSidebar tracks={tracks} onFiles={importFiles} busy={busy} onRemove={removeTrack} onClear={() => { setTracks([]); setStep(1); }} user={user} />

      {/* Scène : barre d'outils + poster */}
      <main className="relative flex-1 min-w-0 flex flex-col min-h-[78vh] lg:min-h-0"
        style={{ background: ms ? 'radial-gradient(ellipse at 50% 30%, #ebe6de 0%, #d8d1c6 65%, #c9c1b4 100%)' : 'radial-gradient(ellipse at 50% 40%, #2e2e32 0%, #212124 55%, #18181a 100%)' }}>
        <div className="shrink-0 h-16 flex items-center justify-center px-4">
          {has && step >= 2 && step <= 3 && (
            <ApToolbar tpl={tpl} cfg={cfg} setCfg={setCfg} photosCount={photos.length} maxPhotos={tpl.maxPhotos || 0}
              onPhoto={() => photoInput.current && photoInput.current.click()} onSaveModel={saveModel} />
          )}
          {!has && <span className="text-[12.5px] text-neutral-500">Votre tracé apparaîtra sur cette carte</span>}
        </div>
        <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPhotoFiles(e.target.files); e.target.value = ''; }} />
        <div className="relative flex-1 min-h-0 px-6 lg:px-10 pb-4 grid place-items-center" style={{ containerType: 'size' }}>
          <div className="relative" style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, width: `min(100cqw, calc(100cqh * ${fmt.mm[0] / fmt.mm[1]}))` }}>
            <div className="absolute inset-0 transition-[padding] duration-300" style={ms ? {
              padding: '3.2%', background: ms.border,
              boxShadow: `0 40px 70px -24px rgba(0,0,0,0.5), 0 14px 26px -12px rgba(0,0,0,0.35)${ms.shadow ? ', ' + ms.shadow : ''}`,
            } : { boxShadow: '0 30px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)' }}>
              <div className="relative w-full h-full overflow-hidden" style={ms ? { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' } : undefined}>
                <canvas ref={previewRef} width={1000} height={1414} className="block w-full h-full" />
                {!ready && <div className="absolute inset-0 grid place-items-center text-[12px] text-neutral-400 bg-neutral-900"><UiSpinner size={18} /></div>}
              </div>
            </div>
          </div>
        </div>
        <div className={`shrink-0 pb-4 text-center text-[11.5px] tabular-nums ${ms ? 'text-neutral-600' : 'text-neutral-500'}`}>
          {tpl.name} · {fmt.name}{fmt.sub !== 'cm' ? ` · ${fmt.sub}` : ' cm'}
        </div>
      </main>

      {/* Panneau de droite : étapes 2 à 4 */}
      {has && (
        <aside className="lg:w-[360px] shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l border-white/[0.07] bg-[#0c0c0d] lg:h-full">
          <UiStepper steps={AP_STEPS.slice(1)} step={step - 1} onStep={(n) => setStep(n + 1)} className="shrink-0 px-4 h-14 border-b border-white/[0.06]" />
          <div className="flex-1 min-h-0 overflow-y-auto sb-scroll p-5">
            {step === 2 && (<>
              <h2 className="text-[17px] font-semibold tracking-tight">Choisissez votre modèle</h2>
              <p className="mt-1 text-[12.5px] text-neutral-400">Les deux derniers mettent votre photo en fond.</p>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                {AP_TEMPLATES.map((id) => {
                  const t = apTpl(id), on = id === cfg.tplId;
                  return (
                    <button key={id} onClick={() => setCfg({ tplId: id, color: 'auto', font: 'modele' })} className="text-left group">
                      <div className={`relative rounded-[6px] overflow-hidden bg-neutral-800 transition-all ${on ? 'ring-2 ring-white ring-offset-[3px] ring-offset-[#0c0c0d]' : 'ring-1 ring-white/10 group-hover:ring-white/40 group-hover:-translate-y-0.5'}`}
                        style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}` }}>
                        <canvas ref={(el) => { thumbRefs.current[id] = el; }} width={240} height={340} className="block w-full h-full" />
                        {t.photoBg && <span title="Avec votre photo" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full grid place-items-center bg-black/60 text-white backdrop-blur"><I.ImagePlus size={11} /></span>}
                      </div>
                      <div className="mt-2 px-0.5">
                        <div className={`text-[12.5px] font-medium ${on ? 'text-white' : 'text-neutral-300'}`}>{t.name}</div>
                        <div className="text-[10.5px] text-neutral-500">{t.photoBg ? 'Avec votre photo' : t.kind}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {models.length > 0 && (
                <div className="mt-6">
                  <UiEyebrow className="mb-2">Mes modèles</UiEyebrow>
                  <div className="flex flex-col gap-1">
                    {models.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 rounded-lg pl-3 pr-1 h-10 bg-white/[0.03] hover:bg-white/[0.06]">
                        <button onClick={() => applyModel(m)} className="flex-1 min-w-0 text-left text-[12.5px] font-medium truncate">{m.name}</button>
                        <UiIconButton icon="Trash" label="Supprimer ce modèle" size="xs" onClick={() => setModels((l) => l.filter((x) => x.id !== m.id))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <UiButton variant="primary" size="lg" block iconRight="ChevronRight" className="mt-6" onClick={() => setStep(3)}>Suivant : les infos</UiButton>
            </>)}

            {step === 3 && (<>
              <h2 className="text-[17px] font-semibold tracking-tight">Vos infos sur le poster</h2>
              <label className="block mt-4">
                <UiLabel>Nom</UiLabel>
                <input value={cfg.title != null ? cfg.title : defaultTitle} onChange={(e) => setCfg({ title: e.target.value })} maxLength={60} className={uiInputCls} />
              </label>
              <label className="block mt-3">
                <UiLabel>Description</UiLabel>
                <input value={cfg.subtitle != null ? cfg.subtitle : defaultSub} onChange={(e) => setCfg({ subtitle: e.target.value })} placeholder="Ex. Bretagne · été 2026" maxLength={80} className={uiInputCls} />
              </label>
              <label className="block mt-3">
                <UiLabel>Activité</UiLabel>
                <select value={actId} onChange={(e) => setCfg({ actId: e.target.value, order: null, enabled: null })} className={uiInputCls + ' appearance-none'}>
                  {PO_ACTIVITIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </label>
              <div className="mt-5">
                <UiLabel aside={<span className="text-[11px] text-neutral-500">{order.filter((k) => enabled.has(k)).length} affichées</span>}>Infos</UiLabel>
                <p className="text-[11px] text-neutral-500 mb-2">Glissez pour réordonner, double-cliquez une valeur pour la modifier (durée…).</p>
                <MetricsList order={order} setOrder={setOrder} enabled={enabled} onToggle={toggleMetric} values={metricValues} overrides={cfg.values} onEdit={setMetricValue} />
              </div>
              <UiButton variant="primary" size="lg" block iconRight="ChevronRight" className="mt-6" onClick={() => setStep(4)}>Suivant : l’impression</UiButton>
            </>)}

            {step === 4 && (<>
              <h2 className="text-[17px] font-semibold tracking-tight">Format et finition</h2>
              <UiLabel className="mt-4">Taille</UiLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {POSTER_FORMATS.map((f) => (
                  <button key={f.id} onClick={() => setCfg({ fmtId: f.id })} className={`${uiChipCls(f.id === cfg.fmtId)} h-auto py-2 flex flex-col items-center leading-tight`}>
                    <span>{f.name}</span><span className="text-[10px] opacity-60 mt-0.5">{f.sub}</span>
                  </button>
                ))}
              </div>
              <UiLabel className="mt-5">Bordure</UiLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {POSTER_BORDERS.map((b) => <button key={b.id} onClick={() => setCfg({ border: b.id })} className={uiChipCls(b.id === cfg.border)}>{b.name}</button>)}
              </div>
              <UiLabel className="mt-5">Cadre</UiLabel>
              <div className="flex gap-2.5 flex-wrap">
                {POSTER_MOCKUPS.map((m) => (
                  <button key={m.id} onClick={() => setCfg({ mock: m.id })} className="flex flex-col items-center gap-1.5">
                    <span className={`w-11 h-11 rounded-lg grid place-items-center ${cfg.mock === m.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0c0c0d]' : 'ring-1 ring-white/15'}`}
                      style={{ background: m.id === 'none' ? 'transparent' : m.swatch }}>
                      {m.id === 'none' ? <I.X size={14} /> : <span className="w-5 h-6 rounded-[2px] bg-neutral-100" />}
                    </span>
                    <span className={`text-[10.5px] ${cfg.mock === m.id ? 'text-white' : 'text-neutral-500'}`}>{m.id === 'none' ? 'Sans' : m.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-white/[0.03] ring-1 ring-white/[0.07] p-3.5 text-[12px] text-neutral-400 leading-relaxed">
                <div className="text-[13px] font-semibold text-white">{tpl.name} · {fmt.name}{fmt.sub !== 'cm' ? ` (${fmt.sub})` : ' cm'}</div>
                Fichier {exp.w} × {exp.h} px · {exp.dpi} dpi
              </div>
              <UiButton variant="primary" size="lg" block icon="Download" loading={exporting} className="mt-4" onClick={download}>Télécharger en HD</UiButton>
              <button onClick={() => setOrdered(true)}
                className="mt-2.5 w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold text-white ring-1 ring-inset ring-white/15 hover:brightness-110 transition"
                style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }}>
                <I.Poster size={16} /> Commander le poster
              </button>
              {ordered && (
                <p className="mt-2.5 text-[12px] text-neutral-400 leading-snug text-center ds-fade-up">La commande de tirages arrive bientôt. En attendant, téléchargez le fichier HD et imprimez-le où vous voulez.</p>
              )}
            </>)}
          </div>
        </aside>
      )}

      {dropping && (
        <div className="fixed inset-0 z-[3600] grid place-items-center bg-neutral-950/80 backdrop-blur-sm pointer-events-none">
          <div className="rounded-3xl border-2 border-dashed border-white/40 px-14 py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full grid place-items-center bg-white text-neutral-900 mb-3"><I.Upload size={20} /></div>
            <div className="text-[17px] font-semibold">Déposez votre tracé</div>
            <div className="text-[12.5px] text-neutral-400 mt-1">{PT_FORMATS}</div>
          </div>
        </div>
      )}
      {toast}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrintraceStudio />);
