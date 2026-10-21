// Printrace — l'app (studio) : du tracé au poster, en 4 étapes. Version grand écran.
//
// Mise en page (inspirée du site) : un panneau flottant à gauche porte les étapes,
// le poster s'affiche en grand à droite, dans son cadre, sous un halo de lumière.
//
//  1. Import : fichier, Strava, Komoot, Routdoor… ; poster de la carte de France sans tracé.
//  2. Modèle : Plan, Nuit, Éditorial, Galerie, et deux avec une photo derrière (Photo, Polaroïd).
//     Barre d'outils au-dessus du poster : couleur, typographie (3 choix vérifiés par
//     modèle), zoom de la carte (3 niveaux), photos, « Enregistrer le modèle ».
//  3. Infos : nom, description, activité, infos affichées (réordonnables).
//  4. Finition : taille, bordure, cadre ; télécharger en HD ou commander.
//
// Même moteur de rendu que l'ancienne version (src/poster-share.jsx).

const { useState: useApState, useEffect: useApEffect, useMemo: useApMemo, useRef: useApRef } = React;

const AP_TRACKS_KEY = 'printrace_app_tracks_v2';
const AP_STATE_KEY = 'printrace_app_state_v2';
const AP_MODELS_KEY = 'printrace_app_models_v2';

// Cases de la grille des modèles, par paires : version sombre à gauche, claire à droite.
// [modèle, mode] (mode : pour les modèles qui existent en sombre et en clair)
const AP_TILES = [['nuit'], ['aube'], ['blueprint', 'dark'], ['blueprint', 'light'], ['releve', 'dark'], ['releve', 'light'],
  ['graphite'], ['relief'], ['photo'], ['galerie'], ['polaroid', 'dark'], ['polaroid', 'light']];
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
  aube: [['modele', 'Moderne'], ['affiche', 'Affiche'], ['classique', 'Classique']],
  graphite: [['modele', 'Technique'], ['classique', 'Classique'], ['affiche', 'Affiche']],
  releve: [['modele', 'Technique'], ['classique', 'Classique'], ['ancienne', 'Ancienne carte']],
  relief: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['ancienne', 'Ancienne carte']],
  galerie: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['affiche', 'Affiche']],
  photo: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['affiche', 'Affiche']],
  polaroid: [['modele', 'Éditorial'], ['moderne', 'Moderne'], ['ancienne', 'Ancienne carte']],
};
// Police « du modèle » (aperçu du bouton) : celle de ses titres
const AP_NATIVE_FONT = { blueprint: ST_TXT, nuit: ST_TXT, aube: ST_TXT, graphite: ST_TXT, releve: ST_TXT, relief: PO_SERIF, galerie: PO_SERIF, photo: PO_SERIF, polaroid: PO_SERIF };
// Zoom de la carte : 0 = cadré sur le tracé, puis deux niveaux plus larges
const AP_ZOOMS = [0, 0.2, 0.45]; // cadré sur le tracé, puis deux niveaux à peine plus larges
// Carte de France (poster d'accueil, sans tracé)
const AP_FRANCE = [[51.1, -4.9], [42.3, 8.3]];
// Photo par défaut des modèles « photo » (remplaçable)
const apDefaultPhoto = () => ptRes('appPhotoDefault', 'assets/site/trek-2.webp');
// Étapes (même écriture que le site : grand chiffre, titre, description)
const AP_STEPS = [
  { name: 'Import', title: 'Importez votre tracé', text: 'Fichier GPX, activité Strava ou tour Komoot.' },
  { name: 'Modèle', title: 'Choisissez votre modèle', text: 'Couleur, typo et zoom : dans la barre du poster.' },
  { name: 'Infos', title: 'Vos infos sur le poster', text: 'Le nom, une description et vos chiffres.' },
  { name: 'Finition', title: 'Imprimez-le', text: 'Taille, bordure et cadre, puis commandez.' },
];
// Cadres (aperçu au mur) : mêmes matières que le site
const AP_FRAMES = [
  { id: 'none', label: 'Sans', swatch: 'transparent' },
  { id: 'noir', label: 'Noir', swatch: '#151515', bg: '#151515' },
  { id: 'argent', label: 'Argent', swatch: 'linear-gradient(135deg,#eceef1,#9ea4ab 45%,#e3e6e9 70%,#8c9299)', bg: 'linear-gradient(135deg,#e6e8eb 0%,#a4aab1 35%,#dfe2e6 60%,#8f959c 100%)' },
  { id: 'bois', label: 'Bois clair', swatch: 'linear-gradient(135deg,#e2c79f,#c39a68 50%,#d8b88a)', bg: 'repeating-linear-gradient(100deg,rgba(120,80,40,0.10) 0 2px,transparent 2px 7px),linear-gradient(135deg,#e0c49a 0%,#c79f6d 40%,#dcbd90 70%,#bb8f5c 100%)' },
  { id: 'blanc', label: 'Blanc', swatch: '#f4f4f2', bg: '#f4f4f2' },
];
const apFrame = (id) => AP_FRAMES.find((f) => f.id === ({ chene: 'bois', alu: 'argent' }[id] || id)) || AP_FRAMES[1];
// Grain très fin (bruit SVG) : adoucit les dégradés du fond
const AP_GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;

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

// Liens Komoot : tour enregistré ou planifié -> identifiant
function apParseKomoot(input) {
  const v = String(input || '').trim();
  if (!v) return null;
  const m = v.match(/komoot\.[a-z.]+\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?tour\/(\d+)/i);
  if (m) return { kind: 'tour', id: m[1] };
  if (/^\d{5,}$/.test(v)) return { kind: 'tour', id: v };
  return { kind: 'invalid' };
}
// Sources par lien : sans relais serveur, parcours guidé (télécharger le GPX puis le déposer)
const AP_LINK_SOURCES = [
  { id: 'strava', name: 'Strava', color: '#fc4c02', logo: ['stravaLogo', 'assets/strava.svg'], placeholder: 'Collez une activité Strava',
    parse: ptParseStrava, exportUrl: ptStravaExportUrl, label: (r) => (r.kind === 'route' ? 'Itinéraire' : 'Activité') + ' Strava n° ' + r.id,
    invalid: 'Ce lien n’est pas une activité Strava.', short: 'Lien raccourci : ouvrez-le puis copiez l’adresse complète (strava.com/activities/…).' },
  { id: 'komoot', name: 'Komoot', color: '#5f9f19', logo: ['komootDark', 'assets/komoot-dark.svg'], placeholder: 'Collez un tour Komoot',
    parse: apParseKomoot, exportUrl: (r) => `https://www.komoot.com/tour/${r.id}/download`, label: (r) => 'Tour Komoot n° ' + r.id,
    invalid: 'Ce lien n’est pas un tour Komoot (komoot.com/tour/…).' },
];

// ---------------------------------------------------------------- éléments du panneau
// En-tête d'étape : grand chiffre italique discret, titre, description (comme le site)
function ApStepHead({ n }) {
  const st = AP_STEPS[n - 1];
  return (
    <div>
      <span aria-hidden="true" className="block font-display italic font-extrabold leading-[0.9] tracking-[-0.04em] text-[40px] select-none"
        style={{ backgroundImage: 'linear-gradient(180deg, #353535 0%, #1b1b1b 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', paddingRight: '0.08em' }}>
        0{n}
      </span>
      <h2 className="mt-2.5 font-display italic font-bold tracking-[-0.02em] leading-[1.15] text-[20px] text-white">{st.title}</h2>
      {/* Une seule ligne de description par étape */}
      <p className="mt-2.5 text-[14px] leading-[1.5] text-neutral-400 truncate">{st.text}</p>
    </div>
  );
}
const apBlock = 'rounded-2xl bg-white/[0.025] ring-1 ring-white/[0.07] px-4 pt-3.5 pb-4';
const apEyebrow = 'text-[11.5px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

// Étape 1 : import (mêmes champs que le site)
function ApImport({ tracks, onFiles, busy, onRemove, onClear }) {
  const fileRef = useApRef(null);
  const [over, setOver] = useApState(false);
  const [links, setLinks] = useApState({ strava: '', komoot: '' });
  const [guided, setGuided] = useApState({});
  const [error, setError] = useApState({ src: '', msg: '' });
  const [linkBusy, setLinkBusy] = useApState('');
  const pickSrc = useApRef('file');
  // Une fois un tracé importé, les champs d'import se replient (« Ajouter un tracé » les rouvre)
  const [adding, setAdding] = useApState(false);
  const count = useApRef(tracks.length);
  useApEffect(() => { if (tracks.length > count.current) setAdding(false); count.current = tracks.length; }, [tracks.length]);
  const showFields = !tracks.length || adding;
  const pick = (src = 'file') => { pickSrc.current = src; fileRef.current && fileRef.current.click(); };
  const submit = async (src) => {
    setError({ src: '', msg: '' });
    const r = src.parse(links[src.id]);
    if (!r || r.kind === 'invalid') { setError({ src: src.id, msg: src.invalid }); return; }
    if (r.kind === 'short') { setError({ src: src.id, msg: src.short }); return; }
    if (src.id === 'strava' && ptStravaApi()) {
      setLinkBusy('strava');
      try { const f = await ptFetchStravaGpx(r); if (f) await onFiles([f], { source: 'strava', sourceRef: ptStravaUrl(r) }); } catch (e) { setError({ src: 'strava', msg: e.message || 'Import Strava impossible.' }); }
      setLinkBusy('');
      return;
    }
    setGuided((g) => ({ ...g, [src.id]: r }));
  };
  return (
    <div className="flex flex-col gap-3">
      <input ref={fileRef} type="file" multiple accept={TRACK_ACCEPT} className="hidden" onChange={(e) => {
        const src = pickSrc.current; pickSrc.current = 'file';
        onFiles(e.target.files, src === 'file' ? {} : { source: src }).then(() => { if (src !== 'file') { setGuided((g) => ({ ...g, [src]: null })); setLinks((l) => ({ ...l, [src]: '' })); } });
        e.target.value = '';
      }} />
      {/* Tracés importés */}
      {tracks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={apEyebrow}>Vos tracés · {tracks.length}</span>
            <button onClick={onClear} className="text-[12px] text-neutral-500 hover:text-white">Tout retirer</button>
          </div>
          <ul className="rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
            {tracks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 pl-3.5 pr-2 h-14">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color || '#3b82f6' }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-medium text-white truncate">{t.name}</span>
                  <span className="block text-[11.5px] text-neutral-500 tabular-nums">{apKm(t.distance || 0)}{t.ascent ? ' · ' + Math.round(t.ascent).toLocaleString('fr-FR') + ' m D+' : ''}</span>
                </span>
                <UiIconButton icon="X" label={'Retirer ' + t.name} size="sm" onClick={() => onRemove(t.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {tracks.length > 0 && (
        <button onClick={() => setAdding((v) => !v)}
          className="h-11 rounded-xl flex items-center justify-center gap-2 text-[13px] font-medium text-neutral-300 ring-1 ring-white/[0.1] hover:bg-white/[0.05] hover:text-white transition-colors">
          {adding ? <><I.X size={14} /> Fermer l’import</> : <><I.Plus size={15} /> Ajouter un tracé</>}
        </button>
      )}
      {showFields && (<>
      {/* Fichier */}
      <button onClick={() => pick()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onFiles(e.dataTransfer.files); }}
        className={`group w-full h-[84px] rounded-[20px] border-[1.5px] border-dashed flex items-center gap-4 px-4 text-left transition-all ${over ? 'border-white bg-white/[0.08] scale-[1.01]' : 'border-white/25 bg-white/[0.03] hover:border-white/50 hover:bg-white/[0.05]'}`}>
        <span className={`w-12 h-12 shrink-0 rounded-[10px] grid place-items-center ring-1 transition-colors ${over ? 'bg-white text-neutral-900 ring-white' : 'bg-white/[0.07] text-white ring-white/10 group-hover:bg-white group-hover:text-neutral-900'}`}>
          {busy ? <UiSpinner size={18} /> : <I.Upload size={19} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-white leading-snug">{busy ? 'Lecture…' : over ? 'Déposez vos tracés' : tracks.length ? 'Ajoutez d’autres tracés' : 'Importez votre tracé'}</span>
          <span className="block text-[12.5px] text-neutral-500 mt-1.5 leading-none tracking-[0.03em]">GPX · FIT · TCX · KML</span>
        </span>
        <span className="shrink-0 w-[88px] h-10 rounded-lg grid place-items-center text-[13px] font-semibold text-neutral-100 bg-white/[0.08] group-hover:bg-white/[0.14] transition-colors">Parcourir</span>
      </button>
      {/* Strava, Komoot */}
      {AP_LINK_SOURCES.map((src) => {
        const g = guided[src.id], bad = error.src === src.id && error.msg && links[src.id];
        return (
          <div key={src.id} style={{ '--src': src.color }}>
            <label className={`h-[76px] flex items-center gap-3 pl-4 pr-3.5 rounded-[20px] cursor-text bg-white/[0.03] ring-1 transition-colors hover:bg-white/[0.05] focus-within:bg-white/[0.05] ${bad ? 'ring-red-400/60' : 'ring-white/[0.14] hover:ring-white/25 focus-within:ring-2 focus-within:ring-[color:var(--src)]'}`}>
              <img src={ptRes(src.logo[0], src.logo[1])} alt="" width="28" height="28" className="w-7 h-7 rounded-[7px] shrink-0" />
              <input value={links[src.id]} onChange={(e) => { const v = e.target.value; setLinks((l) => ({ ...l, [src.id]: v })); setError({ src: '', msg: '' }); setGuided((x) => ({ ...x, [src.id]: null })); }}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(src); }} placeholder={src.placeholder} aria-label={'Lien ' + src.name} inputMode="url"
                style={{ outline: 'none', caretColor: src.color }} className="flex-1 min-w-0 h-full bg-transparent text-[14px] text-white placeholder:text-neutral-500" />
              <button onClick={(e) => { e.preventDefault(); submit(src); }} disabled={linkBusy === src.id}
                className="w-[84px] h-10 shrink-0 rounded-lg grid place-items-center text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-70" style={{ background: src.color }}>
                {linkBusy === src.id ? <UiSpinner size={16} /> : 'Importer'}
              </button>
            </label>
            {error.msg && error.src === src.id && <p className="mt-2 text-[12.5px] text-red-300">{error.msg}</p>}
            {g && (
              <div className="mt-2 rounded-2xl p-4 ds-fade-up" style={{ background: src.color + '12', boxShadow: `inset 0 0 0 1px ${src.color}40` }}>
                <div className="text-[13.5px] font-semibold text-white">{src.label(g)}</div>
                <p className="text-[12.5px] text-neutral-300 mt-0.5 leading-snug">Téléchargez le GPX depuis votre compte {src.name}, puis déposez-le ici.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={src.exportUrl(g)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold text-white hover:brightness-110" style={{ background: src.color }}><I.Download size={15} /> Télécharger le GPX</a>
                  <UiButton icon="Upload" onClick={() => pick(src.id)}>Déposer le fichier</UiButton>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </>)}
    </div>
  );
}

// ---------------------------------------------------------------- barre d'outils (au-dessus du poster)
function ApPopover({ open, onClose, children }) {
  useApEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full mt-2 z-50 left-1/2 -translate-x-1/2 rounded-2xl bg-[#141415] ring-1 ring-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-3 animate-menu">{children}</div>
    </>
  );
}
function ApToolbar({ tpl, cfg, setCfg, trackColor, photos, bgPhoto, maxPhotos, onPhoto, onRemovePhoto, onRemoveBg, onSaveModel }) {
  const photosCount = photos.length;
  const [open, setOpen] = useApState('');
  const rec = { colors: [], ...poRec(tpl, cfg.mode) };
  const colors = [...rec.colors, ...SHARE_COLORS.map((c) => c.value).filter((v) => v !== 'routes' && !rec.colors.includes(v))];
  const cur = cfg.color === 'auto' ? null : cfg.color;
  // Couleur réellement dessinée sur le poster (en « Auto » : celle du modèle, ou du tracé)
  const shown = cur || (rec.route === 'routes' ? trackColor : rec.route) || null;
  const fonts = AP_FONT_CHOICES[tpl.id] || AP_FONT_CHOICES.blueprint;
  const fontName = (fonts.find(([k]) => k === cfg.font) || fonts[0])[1];
  const btn = (on) => `h-10 rounded-full flex items-center gap-2 px-3.5 text-[13px] font-medium transition-colors ${on ? 'bg-white/[0.12] text-white' : 'text-neutral-300 hover:bg-white/[0.07] hover:text-white'}`;
  const sep = <span className="w-px h-5 bg-white/10" />;
  return (
    <div className="relative z-20 inline-flex items-center gap-0.5 rounded-full bg-[#121212]/80 backdrop-blur-xl ring-1 ring-white/[0.09] shadow-[0_16px_40px_-14px_rgba(0,0,0,0.9)] p-1">
      <div className="relative">
        <button onClick={() => setOpen(open === 'color' ? '' : 'color')} className={btn(open === 'color')}>
          <span className="w-4 h-4 rounded-full ring-1 ring-white/30" style={{ background: shown || 'conic-gradient(#fc5200,#facc15,#3b82f6,#ffffff,#fc5200)' }} /> Couleur
        </button>
        <ApPopover open={open === 'color'} onClose={() => setOpen('')}>
          {tpl.modes && (<>
            <div className={apEyebrow + ' mb-2.5'}>Ambiance</div>
            <div className="inline-flex rounded-full bg-white/[0.05] ring-1 ring-white/10 p-0.5 mb-4">
              {Object.entries(tpl.modes).map(([k, m]) => (
                <button key={k} onClick={() => setCfg({ mode: k, color: 'auto' })}
                  className={`h-7 px-3.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${poMode(tpl, cfg.mode) === k ? 'bg-white text-neutral-900' : 'text-neutral-300 hover:text-white'}`}>
                  {k === 'light' ? <I.Sun size={12} /> : <I.Moon size={12} />} {m.label}
                </button>
              ))}
            </div>
          </>)}
          <div className={apEyebrow + ' mb-2.5'}>Couleur du tracé</div>
          <div className="flex items-center gap-1.5 w-max">
            <button onClick={() => setCfg({ color: 'auto' })} className={`h-7 px-2.5 rounded-full text-[11.5px] font-semibold bg-white/[0.06] ${cfg.color === 'auto' ? 'ring-2 ring-white' : 'ring-1 ring-white/15'}`}>Auto</button>
            {colors.map((c) => (
              <span key={c} className="relative">
                <button onClick={() => setCfg({ color: c })} title={rec.colors.includes(c) ? 'Recommandé pour ce modèle' : undefined}
                  className={`block w-7 h-7 rounded-full transition-transform hover:scale-110 ${cfg.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141415]' : 'ring-1 ring-white/15'}`} style={{ background: c }} />
                {rec.colors.includes(c) && <UiRecDot floating />}
              </span>
            ))}
            <label title="Ma couleur" className="relative w-7 h-7 rounded-full cursor-pointer overflow-hidden ring-1 ring-white/15" style={{ background: 'conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ec4899,#ef4444)' }}>
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(shown || '') ? shown : '#ff6b35'} onChange={(e) => setCfg({ color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
          {tpl.bgs && (<>
            <div className={apEyebrow + ' mt-4 mb-2.5'}>{rec.bgLabel || 'Couleur de fond'}</div>
            <div className="flex items-center gap-1.5 w-max">
              {tpl.bgs.map((b) => {
                const on = (cfg.bg || rec.bg) === b.hex;
                return (
                  <span key={b.hex} className="relative">
                    <button onClick={() => setCfg({ bg: b.hex === rec.bg ? null : b.hex })} title={b.name}
                      className={`block w-7 h-7 rounded-lg transition-transform hover:scale-110 ${on ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141415]' : 'ring-1 ring-white/15'}`} style={{ background: b.hex }} />
                    {b.hex === rec.bg && <UiRecDot floating />}
                  </span>
                );
              })}
            </div>
          </>)}
          <p className="mt-2.5 text-[11.5px] text-neutral-500 flex items-center gap-1.5"><UiRecDot /> Recommandé pour l’impression</p>
        </ApPopover>
      </div>
      {sep}
      <div className="relative">
        <button onClick={() => setOpen(open === 'font' ? '' : 'font')} className={btn(open === 'font')}>
          <span className="text-[15px] font-semibold leading-none" style={{ fontFamily: AP_FONTS[cfg.font] || AP_NATIVE_FONT[tpl.id] }}>Aa</span> {fontName}
        </button>
        <ApPopover open={open === 'font'} onClose={() => setOpen('')}>
          <div className={apEyebrow + ' mb-2'}>Typographie du titre</div>
          <div className="flex flex-col gap-1 w-[230px]">
            {fonts.map(([k, name]) => (
              <button key={k} onClick={() => { setCfg({ font: k }); setOpen(''); }}
                className={`flex items-center gap-3 rounded-xl px-2.5 h-12 text-left transition-colors ${cfg.font === k ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]'}`}>
                <span className="text-[20px] w-10 text-white" style={{ fontFamily: AP_FONTS[k] || AP_NATIVE_FONT[tpl.id], fontWeight: k === 'ancienne' ? 400 : 700 }}>Aa</span>
                <span className="flex-1 text-[13px] text-neutral-200">{name}</span>
                {cfg.font === k && <I.Check size={14} />}
              </button>
            ))}
          </div>
        </ApPopover>
      </div>
      {sep}
      <div className="flex items-center gap-1 px-1.5">
        <UiIconButton icon="Minus" label="Dézoomer la carte" size="sm" className="!rounded-full" disabled={cfg.zoom >= AP_ZOOMS.length - 1} onClick={() => setCfg({ zoom: Math.min(AP_ZOOMS.length - 1, cfg.zoom + 1) })} />
        <span className="flex items-center gap-1" title="Zoom de la carte">
          {AP_ZOOMS.map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${AP_ZOOMS.length - 1 - i === cfg.zoom ? 'bg-white' : 'bg-white/25'}`} />)}
        </span>
        <UiIconButton icon="Plus" label="Zoomer sur le tracé" size="sm" className="!rounded-full" disabled={cfg.zoom <= 0} onClick={() => setCfg({ zoom: Math.max(0, cfg.zoom - 1) })} />
      </div>
      {tpl.id !== 'aube' && (
        <button onClick={() => setCfg({ labels: cfg.labels !== true })} aria-pressed={cfg.labels === true}
          title={cfg.labels === true ? 'Masquer les villes' : 'Afficher les villes sur la carte'} className={btn(false) + ' !pl-2.5'}>
          <span className={`relative w-7 h-4 rounded-full transition-colors ${cfg.labels === true ? 'bg-[#3b82f6]' : 'bg-white/15'}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${cfg.labels === true ? 'left-3.5' : 'left-0.5'}`} />
          </span>
          Villes
        </button>
      )}
      {sep}
      <div className="relative">
        {/* Sans photo : ouvre directement le sélecteur ; sinon menu pour en ajouter ou en retirer */}
        <button onClick={() => { if (tpl.photoBg ? bgPhoto : photosCount) setOpen(open === 'photo' ? '' : 'photo'); else onPhoto(); }}
          className={btn(open === 'photo')} disabled={!tpl.photoBg && !maxPhotos}>
          <I.ImagePlus size={16} /> {tpl.photoBg ? 'Photo' : 'Photos'}
          {!tpl.photoBg && photosCount > 0 && <span className="text-[11.5px] tabular-nums text-neutral-400">{Math.min(photosCount, maxPhotos)}/{maxPhotos}</span>}
        </button>
        <ApPopover open={open === 'photo'} onClose={() => setOpen('')}>
          <div className="w-[264px]">
            <div className={apEyebrow + ' mb-2.5'}>{tpl.photoBg ? 'Photo de fond' : 'Photos du poster'}</div>
            {tpl.photoBg ? (bgPhoto && (
              <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10 aspect-[4/3]">
                <img src={bgPhoto.url} alt="" className="w-full h-full object-cover" />
              </div>
            )) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.slice(0, maxPhotos).map((ph, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden ring-1 ring-white/10">
                    <img src={ph.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => { onRemovePhoto(i); if (photosCount <= 1) setOpen(''); }} title="Retirer cette photo" aria-label="Retirer cette photo"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full grid place-items-center bg-black/70 text-white backdrop-blur hover:bg-red-500 transition-colors"><I.X size={12} /></button>
                  </div>
                ))}
                {photosCount < maxPhotos && (
                  <button onClick={() => { setOpen(''); onPhoto(); }} title="Ajouter une photo"
                    className="aspect-square rounded-lg grid place-items-center border border-dashed border-white/20 text-neutral-400 hover:text-white hover:border-white/40 transition-colors"><I.Plus size={16} /></button>
                )}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              {tpl.photoBg
                ? <button onClick={() => { setOpen(''); onPhoto(); }} className="h-8 px-3 rounded-full text-[12px] font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-white">Remplacer</button>
                : <span className="text-[11.5px] text-neutral-500">{Math.min(photosCount, maxPhotos)} sur {maxPhotos}</span>}
              <button onClick={() => { setOpen(''); tpl.photoBg ? onRemoveBg() : photos.forEach(() => onRemovePhoto(0)); }}
                className="h-8 px-3 rounded-full text-[12px] font-semibold text-red-300 hover:bg-red-500/15 flex items-center gap-1.5"><I.Trash size={13} /> {tpl.photoBg ? 'Retirer la photo' : 'Tout retirer'}</button>
            </div>
          </div>
        </ApPopover>
      </div>
      {sep}
      <button onClick={onSaveModel} className={btn(false)} title="Enregistrer le modèle : style, couleur, typo, zoom et finition">
        <I.Folder size={15} /> Enregistrer
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- app
function PrintraceStudio() {
  const [tracks, setTracks] = useApState(() => apLoad(AP_TRACKS_KEY, []));
  const saved = useApMemo(() => apLoad(AP_STATE_KEY, {}), []);
  const [step, setStep] = useApState(() => (tracks.length ? Math.max(2, saved.step || 2) : 1));
  const [cfg, setCfgState] = useApState(() => {
    const c = { tplId: 'nuit', color: 'auto', bg: null, mode: null, font: 'modele', zoom: 0, title: null, subtitle: null, actId: null,
      order: null, enabled: null, values: {}, fmtId: 'a3', border: 'none', mock: 'noir', ...(saved.cfg || {}) };
    return { ...c, zoom: Math.min(c.zoom || 0, AP_ZOOMS.length - 1) }; // niveaux de zoom d'une version précédente
  });
  const setCfg = (p) => setCfgState((c) => ({ ...c, ...(typeof p === 'function' ? p(c) : p) }));
  const [models, setModels] = useApState(() => apLoad(AP_MODELS_KEY, []));
  const [photos, setPhotos] = useApState([]);     // photos du voyage (poster)
  const [bgPhoto, setBgPhoto] = useApState(null); // photo de fond (modèles « photo »)
  const [busy, setBusy] = useApState(false);
  const [exporting, setExporting] = useApState(''); // '' | 'pdf' | 'png' | 'svg'
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
  // Arrivée depuis le site ou Routdoor (#t=…) : on passe directement au choix du modèle
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
      setStep(2);
    }).catch(() => showToast('Ce lien de tracé est incomplet'));
  }, []);
  const removeTrack = (id) => setTracks((l) => { const n = l.filter((t) => t.id !== id); if (!n.length) setStep(1); return n; });

  // ---- données du poster
  const has = tracks.length > 0;
  const tpl = apTpl(cfg.tplId);
  const actId = cfg.actId || poActivityOf(tracks);
  const act = poActivity(actId);
  const fmt = POSTER_FORMATS.find((f) => f.id === cfg.fmtId) || POSTER_FORMATS[1];
  const frame = apFrame(cfg.mock);
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

  const dataFor = (t, m) => {
    // m : mode imposé (vignette) ; sinon celui choisi pour le modèle en cours, ou le mode par défaut
    const mode = m !== undefined ? poMode(t, m) : t.id === cfg.tplId ? poMode(t, cfg.mode) : poMode(t, null);
    const rec = poRec(t, mode);
    const routes = has ? [...tracks, ...[apZoomGhost(tracks, AP_ZOOMS[cfg.zoom])].filter(Boolean)] : [apGhost(AP_FRANCE[0], AP_FRANCE[1])];
    const stats = has ? poStats(agg, order.filter((k) => enabled.has(k)), infoX).map((st) => (cfg.values[st.key] ? { ...st, value: cfg.values[st.key], unit: '' } : st)) : [];
    return {
      routes, agg: agg || {}, color: cfg.color, coords: has, activityLabel: has ? act.label : '',
      title: (cfg.title != null && cfg.title.trim()) || defaultTitle, subtitle: cfg.subtitle != null ? cfg.subtitle : defaultSub,
      stats, photoSlot: false, photos: t.photoBg ? [] : photos, bgPhoto: (bgPhoto && bgPhoto.img) || defaultBg,
      showMap: has ? !!rec.map : true, mapStyle: rec.mapStyle || 'epure', mapOpacity: (rec.mapOpacity || 100) / 100,
      mapLabels: cfg.labels === true, bg: (t.bgs && cfg.bg) || rec.bg || null, preview: true,
      titleFont: AP_FONTS[cfg.font] || null, mode,
    };
  };

  // ---- loupe sur l'aperçu : maintenir le clic agrandit (×2,5) la zone sous le curseur,
  // on l'explore en bougeant ; relâcher revient à 100 %. Ctrl/⌘ + molette ou pincement :
  // zoom progressif autour du curseur, qui revient aussi à 100 % dès qu'on arrête.
  const [view, setView] = useApState({ z: 1, x: 0, y: 0 });
  const [holding, setHolding] = useApState(false);
  const stageRef = useApRef(null), boxRef = useApRef(null), viewRef = useApRef(view), wheelT = useApRef(0);
  viewRef.current = view;
  const AP_LOUPE = 2.5;
  // Zoom z centré sur le point de l'écran (cx, cy) : ce point reste sous le curseur
  const lookAt = (z, cx, cy) => {
    const b = boxRef.current; if (!b) return;
    const r = b.getBoundingClientRect(), v = viewRef.current;
    // centre du poster sans transformation
    const ox = r.left + r.width / 2 - v.x, oy = r.top + r.height / 2 - v.y;
    const sx = cx - ox, sy = cy - oy;
    setView({ z, x: sx * (1 - z), y: sy * (1 - z) });
  };
  const reset = () => setView({ z: 1, x: 0, y: 0 });
  useApEffect(() => {
    const st = stageRef.current; if (!st) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      lookAt(Math.max(1, Math.min(3, viewRef.current.z * Math.exp(-e.deltaY * 0.01))), e.clientX, e.clientY);
      clearTimeout(wheelT.current);
      wheelT.current = setTimeout(reset, 450); // fin du pincement : retour à 100 %
    };
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => st.removeEventListener('wheel', onWheel);
  }, []);
  const overPoster = (e) => { const b = boxRef.current; if (!b) return false; const r = b.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  const stageHandlers = {
    onPointerDown: (e) => { if (e.button !== 0 || !overPoster(e)) return; e.currentTarget.setPointerCapture(e.pointerId); setHolding(true); lookAt(AP_LOUPE, e.clientX, e.clientY); },
    onPointerMove: (e) => { if (holding) lookAt(AP_LOUPE, e.clientX, e.clientY); },
    onPointerUp: () => { if (holding) { setHolding(false); reset(); } },
    onPointerCancel: () => { setHolding(false); reset(); },
  };

  // ---- rendu : aperçu, puis vignettes des modèles (étape 2), hors écran puis copiés
  const token = useApRef(0);
  useApEffect(() => {
    const my = ++token.current;
    const t = setTimeout(async () => {
      await storyFontsReady();
      if (my !== token.current) return;
      const c = previewRef.current;
      if (c) {
        const pw = 1700, off = document.createElement('canvas'); // assez fin pour la loupe
        off.width = pw; off.height = Math.round(pw * fmt.mm[1] / fmt.mm[0]);
        await renderPoster(off, tpl, dataFor(tpl), fmt, cfg.border, pw / PO_W);
        if (my !== token.current) return;
        c.width = off.width; c.height = off.height; c.getContext('2d').drawImage(off, 0, 0);
        setReady(true);
      }
      if (step !== 2) return;
      for (const [id, mode] of AP_TILES) {
        const tc = thumbRefs.current[id + ':' + (mode || '')];
        if (!tc || my !== token.current) continue;
        const off = document.createElement('canvas');
        off.width = 260; off.height = Math.round(260 * fmt.mm[1] / fmt.mm[0]);
        await renderPoster(off, apTpl(id), dataFor(apTpl(id), mode || null), fmt, 'none', 260 / PO_W);
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
  const fontsOf = AP_FONT_CHOICES[tpl.id] || AP_FONT_CHOICES.blueprint;
  const saveModel = () => {
    const m = { id: Date.now(), name: `${tpl.name} · ${(fontsOf.find(([k]) => k === cfg.font) || fontsOf[0])[1]}`, tplId: cfg.tplId, color: cfg.color, bg: cfg.bg || null, mode: cfg.mode || null, labels: cfg.labels === true, font: cfg.font, zoom: cfg.zoom, border: cfg.border, mock: cfg.mock, fmtId: cfg.fmtId };
    setModels((ms) => [m, ...ms].slice(0, 8));
    showToast('Modèle enregistré : retrouvez-le à l’étape 2');
  };
  const applyModel = (m) => setCfg({ tplId: m.tplId, color: m.color, bg: m.bg || null, mode: m.mode || null, labels: m.labels === true, font: m.font, zoom: Math.min(m.zoom || 0, AP_ZOOMS.length - 1), border: m.border, mock: m.mock, fmtId: m.fmtId });
  const setOrder = (f) => setCfg(() => ({ order: f(order), enabled: [...enabled] }));
  const toggleMetric = (k) => setCfg(() => { const n = new Set(enabled); if (n.has(k)) n.delete(k); else n.add(k); return { order, enabled: [...n] }; });
  const setMetricValue = (k, v) => setCfg((c) => { const vals = { ...c.values }; if (v && v.trim()) vals[k] = v.trim(); else delete vals[k]; return { values: vals }; });

  const exp = apPrintSize(fmt, 0);
  const download = async (kind) => {
    setExporting(kind);
    try {
      const data = dataFor(tpl);
      const slug = (data.title || 'aventure').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      const name = `printrace-${slug || 'aventure'}-${fmt.id}`;
      if (kind === 'pdf') { const z = await apExportPdf(tpl, data, fmt, cfg.border, name); showToast(`PDF d’impression ${fmt.name} prêt (${z.dpi} dpi, fond perdu ${AP_BLEED_MM} mm)`); }
      if (kind === 'png') { const z = await apExportPng(tpl, data, fmt, cfg.border, name); showToast(`PNG ${fmt.name} téléchargé (${z.w} × ${z.h} px)`); }
      if (kind === 'svg') { await apExportSvg(tpl, data, fmt, cfg.border, name); showToast(`SVG vectoriel ${fmt.name} téléchargé`); }
    } catch (e) { showToast('Export impossible : ' + e.message); }
    setExporting('');
  };

  // Dépôt d'un fichier n'importe où (tracé, ou photo une fois le tracé importé)
  const [dropping, setDropping] = useApState(false);
  const dropProps = {
    onDragOver: (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } },
    onDragLeave: (e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) setDropping(false); },
    onDrop: (e) => { setDropping(false); const fs = [...e.dataTransfer.files]; if (fs.some(isTrackFile)) { e.preventDefault(); importFiles(fs); } else if (has && fs.some((f) => /^image\//.test(f.type))) { e.preventDefault(); onPhotoFiles(fs); } },
  };

  const framed = frame.id !== 'none';
  const tplFonts = fontsOf;
  const go = (n) => setStep(Math.max(1, Math.min(4, n)));
  const canNext = step < 4 && has;
  const nextLabel = ['', 'Choisir mon modèle', 'Mes infos', 'Finition et impression'][step];

  return (
    <div className="h-full relative overflow-hidden font-site bg-[#1b1b1d] text-white" style={{ overflow: 'clip' }} {...dropProps}>
      {/* Fond : grille fine qui s'estompe, grain léger */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '32px 32px', backgroundPosition: 'center top',
        maskImage: 'linear-gradient(to bottom, #000 0, rgba(0,0,0,0.6) 200px, transparent 520px)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0, rgba(0,0,0,0.6) 200px, transparent 520px)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: AP_GRAIN }} />

      {/* Poster en grand, à droite du panneau */}
      <main className="absolute inset-y-0 right-0 left-[476px] flex flex-col items-center">
        <div className="shrink-0 h-[84px] flex items-end justify-center pb-3">
          {has && step >= 2 && (
            <ApToolbar tpl={tpl} cfg={cfg} setCfg={setCfg} trackColor={has ? tracks[0].color : null} photos={photos} bgPhoto={bgPhoto} maxPhotos={tpl.maxPhotos || 0}
              onPhoto={() => photoInput.current && photoInput.current.click()} onSaveModel={saveModel}
              onRemovePhoto={(i) => setPhotos((l) => l.filter((_, j) => j !== i))} onRemoveBg={() => setBgPhoto(null)} />
          )}
          {!has && <span className="text-[13px] text-neutral-500 pb-2">Votre tracé apparaîtra sur cette carte</span>}
        </div>
        <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPhotoFiles(e.target.files); e.target.value = ''; }} />
        <div ref={stageRef} {...stageHandlers}
          className={`relative flex-1 min-h-0 w-full px-16 py-9 grid place-items-center select-none ${holding ? 'cursor-none' : ''}`} style={{ containerType: 'size', touchAction: 'none' }}>
          <div ref={boxRef} className="relative" style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}`, width: `min(100cqw, calc(100cqh * ${fmt.mm[0] / fmt.mm[1]}))`,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, transformOrigin: 'center', transition: holding && view.z > 1 ? 'transform .08s linear' : 'transform .3s cubic-bezier(.2,.8,.2,1)', cursor: holding ? 'none' : 'zoom-in', zIndex: view.z > 1 ? 10 : undefined }}>
            {/* Halo doux et large derrière le poster */}
            <div aria-hidden="true" className="pointer-events-none absolute -inset-x-[90%] -top-[45%] -bottom-[40%] -z-10" style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.11) 22%, rgba(255,255,255,0.065) 42%, rgba(255,255,255,0.03) 64%, rgba(255,255,255,0.01) 84%, rgba(255,255,255,0) 100%)' }} />
            {/* Cadre (ou poster seul) */}
            <div className={`absolute inset-0 transition-[padding,box-shadow] duration-500 ${framed ? 'p-[3.2%] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.95),0_20px_40px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(0,0,0,0.25)]' : 'p-0 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]'}`}
              style={{ background: frame.bg || 'transparent' }}>
              <canvas ref={previewRef} width={1100} height={1556} className={`block w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ boxShadow: framed ? 'inset 0 2px 6px rgba(0,0,0,0.35)' : 'none' }} />
              {!ready && <div className={`absolute ${framed ? 'inset-[3.2%]' : 'inset-0'} grid place-items-center bg-neutral-900`}><UiSpinner size={20} className="text-neutral-500" /></div>}
              {/* Spot de galerie et reflet du verre (sous cadre) */}
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-500 ${framed ? '' : 'opacity-0'}`} style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35) 50%, transparent)' }} />
              <div className={`pointer-events-none absolute inset-[3.2%] transition-opacity duration-500 ${framed ? '' : 'opacity-0'}`} style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 28%, transparent 45%)' }} />
            </div>
          </div>
        </div>
        {/* Progression (comme le site) : à droite du poster, cliquable */}
        <nav aria-label="Étapes" className="hidden min-[1400px]:block absolute right-8 top-1/2 -translate-y-1/2">
          <ol className="flex flex-col gap-4">
            {AP_STEPS.map((s, i) => {
              const n = i + 1, on = n === step, ok = n === 1 || has;
              return (
                <li key={n}>
                  <button onClick={() => ok && go(n)} disabled={!ok} aria-current={on ? 'step' : undefined} className="group flex items-center gap-3 text-left disabled:cursor-not-allowed">
                    <span className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-[12.5px] font-semibold tabular-nums transition-colors duration-300 ${on ? 'bg-white/[0.12] text-neutral-100 ring-1 ring-white/25' : ok ? 'bg-white/[0.04] text-neutral-500 ring-1 ring-white/15 group-hover:text-neutral-200 group-hover:ring-white/30' : 'bg-white/[0.02] text-neutral-700 ring-1 ring-white/[0.07]'}`}>{n}</span>
                    <span className={`text-[14px] whitespace-nowrap transition-colors duration-300 ${on ? 'text-neutral-200 font-medium' : ok ? 'text-neutral-500 group-hover:text-neutral-300' : 'text-neutral-700'}`}>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        {/* Aide de la loupe */}
        <div className={`absolute right-6 bottom-6 z-20 inline-flex items-center gap-2 rounded-full bg-[#121212]/80 backdrop-blur ring-1 ring-white/[0.09] px-3.5 h-9 text-[12px] text-neutral-400 transition-opacity ${holding ? 'opacity-0' : ''}`}>
          <I.ZoomIn size={14} /> Maintenez le clic sur le poster pour zoomer
        </div>
        {/* Fiche du poster : modèle, format, cadre */}
        <div className="shrink-0 h-[72px] flex items-start justify-center pt-2">
          <span className="inline-flex items-stretch text-[11.5px] leading-none opacity-80">
            <span className="inline-flex items-center gap-1.5 px-2.5 h-6 text-neutral-400">
              <span className={`w-1.5 h-1.5 rounded-full ${has ? 'bg-emerald-400/80' : 'bg-neutral-500'}`} />{has ? 'Votre poster' : 'Aperçu'}
            </span>
            {[['Modèle', tpl.name], ['Format', fmt.name], ['Cadre', frame.label, frame]].map(([k, v, f]) => (
              <span key={k} className="inline-flex items-center gap-1.5 px-2.5 h-6 border-l border-white/[0.08] whitespace-nowrap">
                <span className="text-neutral-600">{k}</span>
                {f && <span className={`w-2.5 h-2.5 rounded-[3px] ${f.id === 'none' ? 'border border-dashed border-white/40' : 'ring-1 ring-white/20'}`} style={{ background: f.swatch }} />}
                <span className="font-medium text-neutral-400">{v}</span>
              </span>
            ))}
          </span>
        </div>
      </main>

      {/* Panneau flottant à gauche : les étapes */}
      <aside className="absolute left-5 top-5 bottom-5 w-[436px] z-30 flex flex-col rounded-[26px] bg-[#0f0f10]/90 backdrop-blur-xl ring-1 ring-white/[0.08] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.9)]">
        <div className="shrink-0 flex items-center justify-between px-8 h-[68px]">
          <a href={window.RoutdoorLink ? window.RoutdoorLink.siteRoot() : './'} aria-label="Printrace" className="relative top-1 text-white"><UiPrintraceLogo height={22} /></a>
        </div>
        {/* Stepper : revenir à l'import (ou à toute étape déjà ouverte) */}
        <nav aria-label="Étapes" className="shrink-0 mx-8 mb-1 flex items-center gap-1">
          {AP_STEPS.map((s, i) => {
            const n = i + 1, on = n === step, ok = n === 1 || has;
            return (
              <React.Fragment key={n}>
                {i > 0 && <span className={`flex-1 h-px ${n <= step ? 'bg-white/25' : 'bg-white/[0.08]'}`} />}
                <button onClick={() => ok && go(n)} disabled={!ok} aria-current={on ? 'step' : undefined}
                  className={`flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full text-[12px] font-medium transition-colors disabled:cursor-not-allowed ${on ? 'text-white' : ok ? 'text-neutral-400 hover:text-white' : 'text-neutral-600'}`}>
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold tabular-nums ${on ? 'bg-white text-neutral-900' : ok ? 'bg-white/[0.06] ring-1 ring-white/15' : 'ring-1 ring-white/[0.08]'}`}>{n}</span>
                  {s.name}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="h-px mx-8 mt-2 bg-white/[0.06]" />

        <div key={step} className="flex-1 min-h-0 overflow-y-auto sb-scroll px-8 py-6 ds-fade-up">
          <ApStepHead n={step} />
          <div className="mt-6">
            {step === 1 && <ApImport tracks={tracks} onFiles={importFiles} busy={busy} onRemove={removeTrack} onClear={() => { setTracks([]); setStep(1); }} />}

            {step === 2 && (<>
              {models.length > 0 && (
                <div className={apBlock + ' mb-5'}>
                  <div className={apEyebrow + ' mb-2'}>Mes modèles</div>
                  <div className="flex flex-col gap-1">
                    {models.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 rounded-xl pl-3 pr-1 h-10 hover:bg-white/[0.05]">
                        <button onClick={() => applyModel(m)} className="flex-1 min-w-0 text-left text-[13px] text-neutral-200 truncate">{m.name}</button>
                        <UiIconButton icon="Trash" label="Supprimer ce modèle" size="xs" onClick={() => setModels((l) => l.filter((x) => x.id !== m.id))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {models.length > 0 && <div className={apEyebrow + ' mb-2.5'}>Modèles Printrace</div>}
              <div className="grid grid-cols-2 gap-3">
                {AP_TILES.map(([id, mode]) => {
                  const t = apTpl(id), key = id + ':' + (mode || '');
                  const on = id === cfg.tplId && (!mode || poMode(t, cfg.mode) === mode);
                  const pick = () => {
                    if (id !== cfg.tplId) setCfg({ tplId: id, color: 'auto', font: 'modele', bg: null, mode: mode || null });
                    else if (!on) setCfg({ mode, color: 'auto' }); // même modèle : on passe de sombre à clair
                  };
                  return (
                    <button key={key} onClick={pick}
                      className={`text-left group rounded-2xl px-5 pt-5 pb-3.5 transition-all ${on ? 'bg-white/[0.07] ring-2 ring-white' : 'bg-white/[0.025] ring-1 ring-white/[0.07] hover:bg-white/[0.05] hover:ring-white/20'}`}>
                      <div className={`relative mx-auto w-[82%] rounded-[4px] overflow-hidden bg-neutral-800 shadow-[0_14px_28px_-12px_rgba(0,0,0,0.9)] transition-transform ${on ? '' : 'group-hover:-translate-y-0.5'}`}
                        style={{ aspectRatio: `${fmt.mm[0]} / ${fmt.mm[1]}` }}>
                        <canvas ref={(el) => { thumbRefs.current[key] = el; }} width={260} height={368} className="block w-full h-full" />
                        {t.photoBg && <span title="Avec votre photo" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full grid place-items-center bg-black/60 text-white backdrop-blur"><I.ImagePlus size={10} /></span>}
                      </div>
                      <div className="mt-3.5 flex items-baseline justify-between gap-2">
                        <span className={`text-[13.5px] font-medium ${on ? 'text-white' : 'text-neutral-300'}`}>{t.name}</span>
                        <span className="text-[11px] text-neutral-500">{mode ? t.modes[mode].label : t.photoBg ? 'Votre photo' : t.kind}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>)}

            {step === 3 && (<>
              <div className={apBlock}>
                <div className={apEyebrow}>Textes</div>
                <input value={cfg.title != null ? cfg.title : defaultTitle} onChange={(e) => setCfg({ title: e.target.value })} maxLength={60} aria-label="Nom"
                  className="mt-2.5 w-full h-11 rounded-xl bg-white/[0.05] ring-1 ring-white/10 focus:ring-white/30 outline-none px-3.5 text-[14px] text-white placeholder:text-neutral-500" />
                <input value={cfg.subtitle != null ? cfg.subtitle : defaultSub} onChange={(e) => setCfg({ subtitle: e.target.value })} placeholder="Description, ex. Bretagne · été 2026" maxLength={80} aria-label="Description"
                  className="mt-2 w-full h-11 rounded-xl bg-white/[0.05] ring-1 ring-white/10 focus:ring-white/30 outline-none px-3.5 text-[14px] text-white placeholder:text-neutral-500" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] text-neutral-400">Activité</span>
                  <select value={actId} onChange={(e) => setCfg({ actId: e.target.value, order: null, enabled: null })}
                    className="h-9 rounded-lg bg-white/[0.05] ring-1 ring-white/10 outline-none px-2.5 text-[13px] text-white">
                    {PO_ACTIVITIES.map((a) => <option key={a.id} value={a.id} className="bg-neutral-900">{a.label}</option>)}
                  </select>
                </div>
              </div>
              <div className={apBlock + ' mt-3'}>
                <div className="flex items-center justify-between mb-1">
                  <span className={apEyebrow}>Infos affichées</span>
                  <span className="text-[11.5px] text-neutral-500">{order.filter((k) => enabled.has(k)).length}</span>
                </div>
                <p className="text-[11.5px] text-neutral-500 mb-2.5">Glissez pour réordonner, double-cliquez une valeur pour la modifier.</p>
                <MetricsList order={order} setOrder={setOrder} enabled={enabled} onToggle={toggleMetric} values={metricValues} overrides={cfg.values} onEdit={setMetricValue} />
              </div>
            </>)}

            {step === 4 && (<>
              <div className={apBlock}>
                <div className={apEyebrow}>Taille</div>
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {POSTER_FORMATS.map((f) => (
                    <button key={f.id} onClick={() => setCfg({ fmtId: f.id })}
                      className={`rounded-xl py-2 flex flex-col items-center leading-tight text-[13px] font-medium transition-colors ${f.id === cfg.fmtId ? 'bg-white text-neutral-900' : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'}`}>
                      <span>{f.name}</span><span className="text-[10.5px] opacity-60 mt-0.5">{f.sub}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-[13px] text-neutral-400">Bordure</span>
                  <div className="inline-flex rounded-lg bg-white/[0.04] ring-1 ring-white/10 p-0.5">
                    {POSTER_BORDERS.map((b) => (
                      <button key={b.id} onClick={() => setCfg({ border: b.id })}
                        className={`h-7 px-2 rounded-md text-[12px] font-medium transition-colors ${cfg.border === b.id ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white'}`}>{b.id === 'marge' ? 'Marge' : b.name}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 text-[13px] text-neutral-400">Cadre</div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {AP_FRAMES.map((f) => {
                    const on = frame.id === f.id;
                    return (
                      <button key={f.id} onClick={() => setCfg({ mock: f.id })}
                        className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 ring-1 transition-colors ${on ? 'bg-white/[0.07] ring-white/35' : 'ring-white/[0.08] hover:bg-white/[0.04]'}`}>
                        <span className={`w-6 h-6 rounded-[5px] ${f.id === 'none' ? 'border border-dashed border-white/30' : 'ring-1 ring-black/40'}`} style={{ background: f.swatch }} />
                        <span className={`text-[11px] ${on ? 'text-white' : 'text-neutral-500'}`}>{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-white/[0.025] ring-1 ring-white/[0.07] px-4 py-3 text-[12.5px] text-neutral-400 flex items-center justify-between gap-3">
                <span><span className="text-white font-medium">{tpl.name} · {fmt.name}</span> {fmt.sub !== 'cm' ? `(${fmt.sub})` : 'cm'}</span>
                <span className="tabular-nums">{exp.dpi} dpi · PDF</span>
              </div>
              {/* Commander : CTA principal (bleu, comme le site) ; télécharger : secondaire */}
              <button onClick={() => setOrdered(true)}
                className="group relative mt-4 w-full overflow-hidden rounded-2xl pl-5 pr-3.5 py-4 flex items-center gap-4 text-left text-white ring-1 ring-inset ring-white/15 shadow-[0_22px_50px_-20px_rgba(37,99,235,0.85),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-px transition-[transform,box-shadow] duration-200"
                style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }}>
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-[450%] transition-transform duration-700 ease-out" />
                <span className="relative flex-1 min-w-0">
                  <span className="block text-[16px] font-semibold leading-tight">Commander le poster</span>
                  <span className="block mt-1 text-[12.5px] text-blue-100/80 leading-snug">Tirage {fmt.name}{framed ? ', cadre ' + frame.label.toLowerCase() : ''}, livré chez vous</span>
                </span>
                <span className="relative w-10 h-10 shrink-0 rounded-full bg-white text-blue-600 grid place-items-center shadow-[0_4px_12px_rgba(15,23,42,0.25)] transition-transform group-hover:translate-x-0.5"><I.ChevronRight size={18} /></span>
              </button>
              {ordered && <p className="mt-2.5 text-[12.5px] text-neutral-400 leading-snug ds-fade-up">La commande de tirages arrive bientôt. En attendant, téléchargez le fichier HD et imprimez-le où vous voulez.</p>}
              <button onClick={() => download('pdf')} disabled={!!exporting}
                className="mt-2.5 w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-semibold text-neutral-900 bg-white hover:bg-neutral-200 transition-colors disabled:opacity-60">
                {exporting === 'pdf' ? <UiSpinner size={16} /> : <I.Download size={16} />} Télécharger le PDF d’impression
              </button>
              <div className="mt-2 flex items-center justify-center gap-1 text-[12.5px] text-neutral-500">
                ou
                <button onClick={() => download('png')} disabled={!!exporting} className="px-1.5 py-1 rounded-md text-neutral-300 hover:text-white hover:bg-white/[0.06] inline-flex items-center gap-1.5">{exporting === 'png' && <UiSpinner size={12} />}PNG 300 dpi</button>
                ·
                <button onClick={() => download('svg')} disabled={!!exporting} className="px-1.5 py-1 rounded-md text-neutral-300 hover:text-white hover:bg-white/[0.06] inline-flex items-center gap-1.5">{exporting === 'svg' && <UiSpinner size={12} />}SVG vectoriel</button>
              </div>
              {/* Qualité d'impression : ce que contient le fichier */}
              <ul className="mt-4 flex flex-col gap-2 text-[12.5px] text-neutral-400 leading-snug">
                <li className="flex gap-2"><I.Check size={14} className="mt-[2px] shrink-0 text-emerald-400" /> {exp.dpi} dpi au format exact : {exp.w} × {exp.h} px pour un {fmt.name}</li>
                <li className="flex gap-2"><I.Check size={14} className="mt-[2px] shrink-0 text-emerald-400" /> Fond perdu de {AP_BLEED_MM} mm et format fini inscrit dans le PDF, comme l’attendent les imprimeurs</li>
                <li className="flex gap-2"><I.Check size={14} className="mt-[2px] shrink-0 text-emerald-400" /> Carte et tracé redessinés en haute définition ; SVG 100 % vectoriel, polices intégrées</li>
              </ul>
            </>)}
          </div>
        </div>

        {/* Navigation entre les étapes */}
        <div className="shrink-0 flex items-center gap-2 px-8 py-4 border-t border-white/[0.06]">
          {step > 1 && <button onClick={() => go(step - 1)} className="h-11 px-4 rounded-xl text-[13.5px] font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors">Retour</button>}
          {step < 4 && (
            <button onClick={() => go(step + 1)} disabled={!canNext}
              className="ml-auto h-11 pl-5 pr-4 rounded-xl flex items-center gap-2 text-[14px] font-semibold text-white ring-1 ring-inset ring-white/15 shadow-[0_14px_32px_-14px_rgba(37,99,235,0.9),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-110 hover:-translate-y-px transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }}>
              {nextLabel} <I.ChevronRight size={17} />
            </button>
          )}
          {step === 4 && <span className="ml-auto text-[12px] text-neutral-500 truncate">{user ? user.email : 'Mode test (sans compte)'}</span>}
        </div>
      </aside>

      {dropping && (
        <div className="fixed inset-0 z-[3600] grid place-items-center bg-neutral-950/80 backdrop-blur-sm pointer-events-none">
          <div className="rounded-3xl border-2 border-dashed border-white/40 px-14 py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full grid place-items-center bg-white text-neutral-900 mb-3"><I.Upload size={20} /></div>
            <div className="text-[17px] font-semibold">{has ? 'Déposez un tracé ou une photo' : 'Déposez votre tracé'}</div>
            <div className="text-[12.5px] text-neutral-400 mt-1">GPX · FIT · TCX · KML</div>
          </div>
        </div>
      )}
      {toast}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrintraceStudio />);
