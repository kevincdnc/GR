// Import GPX side panel — same shape as CreatePanel but file-driven.
// Two states: 1) drop zone, 2) preview after "upload" with stats + form.

const { useState: useImportState, useRef: useImportRef } = React;
const Tooltip = window.Tooltip;

// Realistic fake-parsed GPX presets cycled on each fake upload.
// Each preset includes a centroid (lat/lng) so we can fly the map there
// on save, simulating a real GPX import.
const FAKE_PARSES = [
  { name: 'Tour du Mont Aiguille',    distance: 18.4, ascent: 1240, time: '6h 20', maxAlt: 2086, points: 1842, center: [44.838, 5.554], zoom: 13 },
  { name: 'GR20 — Étape 4',           distance: 14.7, ascent: 1380, time: '5h 50', maxAlt: 2225, points: 1503, center: [42.156, 9.022], zoom: 13 },
  { name: 'Tour des Calanques',       distance: 9.8,  ascent: 540,  time: '3h 30', maxAlt: 425,  points: 1124, center: [43.213, 5.482], zoom: 14 },
  { name: 'Vallée d\u2019Aspe',       distance: 22.5, ascent: 1620, time: '7h 40', maxAlt: 2090, points: 2210, center: [42.892, -0.585], zoom: 12 },
  { name: 'Trail de Chamonix',        distance: 31.2, ascent: 2380, time: '8h 10', maxAlt: 2480, points: 2864, center: [45.929, 6.876], zoom: 12 },
];

function ImportPanel({ onClose, onSave, onPreview, onColorChange, groups, dark, accent }) {
  const [stage, setStage] = useImportState('drop'); // drop | parsing | preview
  const [parsed, setParsed] = useImportState(null);
  const [name, setName] = useImportState('');
  const [activity, setActivity] = useImportState('hiking');
  // Default the group to the existing "Import GPX" group if present,
  // otherwise to a sentinel value that handleSaveImport understands.
  const initialGroupId = (groups.find((g) => g.name === 'Import GPX') || {}).id || '__import_gpx';
  const [groupId, setGroupId] = useImportState(initialGroupId);
  const [color, setColor] = useImportState('emerald');
  const [privacy, setPrivacy] = useImportState('private');
  const [dragOver, setDragOver] = useImportState(false);
  const [filename, setFilename] = useImportState('');
  const inputRef = useImportRef(null);

  const [progress, setProgress] = useImportState(0);

  // Build a fake meandering path of ~140 points around the parsed centroid so
  // the preview itinerary has a visible track on the map.
  const buildFakeCoords = (center, distanceKm) => {
    if (!center) return null;
    const N = 140;
    const out = [];
    const radDeg = (distanceKm || 10) / 111 / 4; // crude scale: 1° ~ 111km
    let lat = center[0], lng = center[1];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      // base meander
      lat = center[0] + Math.sin(t * Math.PI * 2.3) * radDeg * (1 + 0.2 * Math.cos(t * 7));
      lng = center[1] + (t - 0.5) * radDeg * 2 + Math.cos(t * Math.PI * 1.8) * radDeg * 0.6;
      // small jitter for realism (deterministic)
      lat += Math.sin(t * 31) * radDeg * 0.04;
      lng += Math.cos(t * 29) * radDeg * 0.04;
      out.push([lat, lng]);
    }
    return out;
  };

  const fakeUpload = (fname) => {
    setFilename(fname);
    setStage('parsing');
    setProgress(0);
    const PARSE_MS = 2400; // visible loading
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / PARSE_MS);
      // Ease-out cubic for a natural finish
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(Math.round(eased * 100));
      if (p < 1) requestAnimationFrame(tick);
      else {
        const pick = FAKE_PARSES[Math.floor(Math.random() * FAKE_PARSES.length)];
        const coords = buildFakeCoords(pick.center, pick.distance);
        const enriched = { ...pick, coords };
        setParsed(enriched);
        setName(pick.name);
        // best-guess activity by elevation profile
        if (pick.ascent > 1500) setActivity('hiking');
        else if (pick.ascent > 800) setActivity('hiking');
        else if (pick.distance > 25) setActivity('cycling');
        setStage('preview');
        // Notify the parent (so the map can show the preview track and fly to it)
        if (onPreview) onPreview(enriched);
      }
    };
    requestAnimationFrame(tick);
  };

  // Vrai fichier GPX : lu et analysé dans le navigateur (lib/gpx.mjs), avec la
  // même barre de progression que le prototype.
  const [importError, setImportError] = useImportState(null);
  const handleFile = (f) => {
    if (!f) return;
    if (!window.GpxLib || typeof f.text !== 'function') { fakeUpload(f.name || 'parcours.gpx'); return; }
    setImportError(null);
    setFilename(f.name);
    setStage('parsing');
    setProgress(0);
    const start = Date.now();
    f.text().then((xml) => {
      const st = window.GpxLib.buildStage(xml, f.name);
      const lats = st.coords.map((c) => c[0]);
      const lngs = st.coords.map((c) => c[1]);
      const center = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
      const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
      const zoom = Math.max(8, Math.min(15, Math.round(Math.log2(360 / Math.max(span, 1e-4))) - 1));
      const parsedReal = {
        name: st.to ? st.from + ' → ' + st.to : st.from,
        distance: st.distanceKm,
        ascent: st.elevationGain,
        time: fmtDuration(st.gpxMovingMin || estimateDurationMin(st.distanceKm, st.elevationGain, 'hiking')),
        maxAlt: st.altMax,
        points: st.coords.length,
        center, zoom,
        coords: st.coords,
      };
      const finish = () => {
        setProgress(100);
        setParsed(parsedReal);
        setName(parsedReal.name);
        setStage('preview');
        if (onPreview) onPreview(parsedReal);
      };
      const tick = () => {
        const p = Math.min(1, (Date.now() - start) / 700);
        setProgress(Math.round((1 - Math.pow(1 - p, 3)) * 100));
        if (p < 1) requestAnimationFrame(tick); else finish();
      };
      requestAnimationFrame(tick);
    }).catch((e) => {
      setStage('drop');
      setImportError('Fichier illisible : ' + (e && e.message ? e.message : 'GPX invalide'));
    });
  };

  const canSave = name.trim().length > 0 && groupId && parsed;

  const submit = () => {
    if (!canSave) return;
    onSave({
      id: 'i_imp_' + Date.now(),
      name: name.trim(),
      activity,
      color,
      groupId,
      privacy,
      distance: parsed.distance,
      ascent: parsed.ascent,
      time: parsed.time,
      coords: parsed.coords,
      center: parsed.center,
      zoom: parsed.zoom,
    });
  };

  const labelCls = `text-[12px] font-medium mb-1.5 ${dark ? 'text-neutral-300' : 'text-neutral-700'}`;
  const inputCls = `w-full rounded-lg border outline-none transition-all text-[13px] px-3 py-2.5 ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600' : 'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white'}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-4 pt-5 pb-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onClose}
            className={`-ml-1.5 p-1.5 rounded-lg transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}
          >
            <I.ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className={`font-semibold text-[15px] tracking-tight truncate ${dark ? 'text-white' : 'text-neutral-900'}`}>Importer un GPX</div>
            <div className={`text-[11px] truncate ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
              {stage === 'drop' && 'Glissez votre fichier ou choisissez-le'}
              {stage === 'parsing' && 'Analyse du fichier…'}
              {stage === 'preview' && 'Fichier prêt à importer'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`}
          title="Fermer"
        >
          <I.X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sb-scroll">
        {stage === 'drop' && (
          <DropZone
            dark={dark}
            accent={accent}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onFile={handleFile}
            onPick={() => inputRef.current?.click()}
          />
        )}
        {stage === 'drop' && importError && (
          <p className={`mt-3 text-[12px] rounded-md px-3 py-2 ${dark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>{importError}</p>
        )}

        {stage === 'parsing' && (
          <Parsing dark={dark} accent={accent} filename={filename} progress={progress} />
        )}

        {stage === 'preview' && (
          <>
            {/* File card */}
            <div className={`mb-4 rounded-xl border p-3 flex items-center gap-3 ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
              <div
                className="w-10 h-10 rounded-lg grid place-items-center shrink-0 text-[10.5px] font-bold tracking-wider"
                style={{ background: accent + '22', color: accent }}
              >
                GPX
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-medium truncate ${dark ? 'text-white' : 'text-neutral-900'}`}>{filename}</div>
                <div className={`text-[11px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{parsed.points.toLocaleString('fr-FR')} points · analysé</div>
              </div>
              <button
                onClick={() => { setStage('drop'); setParsed(null); setFilename(''); }}
                className={`p-1.5 rounded-md ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'}`}
                title="Remplacer"
              >
                <I.X size={14} />
              </button>
            </div>

            {/* Stats grid */}
            <div className={`grid grid-cols-3 gap-1.5 mb-4`}>
              <Stat dark={dark} icon={<I.Distance size={13} />} label="Distance" value={parsed.distance.toFixed(1) + ' km'} />
              <Stat dark={dark} icon={<I.TrendingUp size={13} />} label="D+" value={fmtAscent(parsed.ascent)} />
              <Stat dark={dark} icon={<I.Clock size={13} />} label="Estimé" value={parsed.time} />
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className={labelCls}>Nom <span className="text-rose-500">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>

            {/* Activity — dropdown (auto-detected, with subtle pill) */}
            <div className="mb-4">
              <div className={labelCls}>
                Activité
                <span className={`ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${dark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500'}`}>
                  <I.Sparkle size={10} /> détecté
                </span>
              </div>
              {(window.ActivityDropdown) ? (
                <window.ActivityDropdown value={activity} onChange={setActivity} dark={dark} accent={accent} />
              ) : (
                <select value={activity} onChange={(e) => setActivity(e.target.value)} className={inputCls + ' appearance-none pr-8'}>
                  {Object.entries(ACTIVITIES).map(([key, a]) => <option key={key} value={key}>{a.label}</option>)}
                </select>
              )}
            </div>

            {/* Group — default to "Import GPX" (auto-created on save if missing) */}
            <div className="mb-4">
              <label className={labelCls}>Ranger dans</label>
              <div className="relative">
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls + ' appearance-none pr-8'}>
                  {!groups.some((g) => g.name === 'Import GPX') && (
                    <option value="__import_gpx">Import GPX (nouveau groupe)</option>
                  )}
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <I.ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
              </div>
            </div>

            {/* Color */}
            <div className="mb-4">
              <div className={labelCls}>Couleur sur la carte</div>
              <div className="flex items-center justify-between gap-1">
                {Object.entries(ROUTE_COLORS).slice(0, 10).map(([key, c]) => (
                  <button
                    key={key}
                    onClick={() => { setColor(key); onColorChange && onColorChange(key); }}
                    className={`w-6 h-6 rounded-full grid place-items-center transition-transform shrink-0 ${color === key ? 'scale-110' : 'hover:scale-105'}`}
                    style={{
                      background: c.hex,
                      boxShadow: color === key ? `0 0 0 1.5px ${dark ? '#0f172a' : '#fff'}, 0 0 0 3px ${c.hex}` : 'none',
                    }}
                    title={c.name}
                  >
                    {color === key && <I.Check size={11} stroke="white" strokeWidth="3" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy */}
            <div className="mb-4">
              <div className={labelCls}>Confidentialité</div>
              <div className={`flex rounded-lg p-0.5 border ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-neutral-100 border-neutral-200'}`}>
                <button
                  onClick={() => setPrivacy('private')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-all ${privacy === 'private' ? (dark ? 'bg-neutral-800 text-white shadow-sm' : 'bg-white text-neutral-900 shadow-sm') : (dark ? 'text-neutral-400' : 'text-neutral-600')}`}
                >
                  <I.Lock size={13} /> Privé
                </button>
                <button
                  onClick={() => setPrivacy('public')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-all ${privacy === 'public' ? (dark ? 'bg-neutral-800 text-white shadow-sm' : 'bg-white text-neutral-900 shadow-sm') : (dark ? 'text-neutral-400' : 'text-neutral-600')}`}
                >
                  <I.Globe size={13} /> Public
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />

      {/* Footer / CTA */}
      {stage === 'preview' && (
        <div className={`px-4 py-3 border-t ${dark ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-white'}`}>
          <button
            onClick={submit}
            disabled={!canSave}
            className={`btn-cta-primary w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white transition-all ${canSave ? 'hover:shadow active:scale-[0.99]' : 'opacity-40 cursor-not-allowed'}`}
            style={{ background: accent }}
          >
            <I.Download size={15} stroke="white" strokeWidth="2.4" />
            Importer l'itinéraire
          </button>
        </div>
      )}
    </div>
  );
}

function DropZone({ dark, accent, dragOver, setDragOver, onFile, onPick }) {
  return (
    <div className="mt-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={onPick}
        className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer ${dragOver ? 'scale-[1.01]' : ''} ${dark ? (dragOver ? 'border-sky-500 bg-neutral-900/80' : 'border-neutral-700 hover:border-neutral-600 bg-neutral-900/40') : (dragOver ? 'border-sky-400 bg-sky-50' : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50/60')}`}
        style={dragOver ? { borderColor: accent, background: accent + '0d' } : undefined}
      >
        <div className="px-6 py-10 text-center">
          <div
            className="mx-auto w-12 h-12 rounded-xl grid place-items-center mb-3"
            style={{ background: accent + '22', color: accent }}
          >
            <I.Upload size={22} />
          </div>
          <div className={`text-[14px] font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>
            Glissez votre fichier ici
          </div>
          <div className={`text-[12px] mt-1 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            ou <span style={{ color: accent }} className="font-medium underline-offset-2 hover:underline">parcourez vos fichiers</span>
          </div>
          <div className={`mt-4 inline-flex items-center gap-1.5 text-[10px] tabular-nums px-2 py-1 rounded-md ${dark ? 'bg-neutral-800 text-neutral-400' : 'bg-white text-neutral-500 border border-neutral-200'}`}>
            <I.FileGpx size={11} />
            .gpx jusqu'à 10 Mo
          </div>
        </div>
      </div>

      {/* Service connectors (Strava / Komoot / Garmin) */}
      <ServiceConnectors dark={dark} accent={accent} onPickGpx={onFile} />
    </div>
  );
}

// --- Strava / Komoot / Garmin connectors ----------------------------------
// Each service has a "not connected" state (clicking opens a fake auth modal)
// and a "connected" state (clicking expands a dropdown of GPX tracks sorted
// by date desc; clicking a track triggers the same fake-upload flow).
function ServiceConnectors({ dark, accent, onPickGpx }) {
  const [connections, setConnections] = useImportState(() => ({
    strava: false, komoot: false, garmin: false,
  }));
  const [openService, setOpenService] = useImportState(null); // service shown in the tracks modal
  const [authPrompt, setAuthPrompt] = useImportState(null);   // service key being authed

  const R = (window.__resources || {});
  const services = [
    { key: 'strava', label: 'Strava', color: '#fc4c02', logo: R.stravaLogo || 'assets/strava.svg', logoGray: R.stravaLogoGray || 'assets/strava-gray.svg' },
    { key: 'komoot', label: 'Komoot', color: '#6aaf17', logo: R.komootLogo || 'assets/komoot.svg', logoGray: R.komootLogoGray || 'assets/komoot-gray.svg' },
    { key: 'garmin', label: 'Garmin', color: '#111111', logo: R.garminLogo || 'assets/garmin.svg', logoGray: R.garminLogoGray || 'assets/garmin-gray.svg' },
  ];

  // Mock GPX tracks per service (~30 each), generated deterministically and
  // sorted by date desc. Seeded names give a realistic feel.
  const TRACKS = useImportRef(null);
  if (!TRACKS.current) {
    const NAMES = {
      strava: ['Trail des Crêtes', 'Tour du Lac d\u2019Annecy', 'Boucle Mont-Blanc', 'Sortie longue dimanche', 'Fractionné piste', 'Col de la Forclaz', 'Montée du Semnoz', 'Footing récup', 'Tempo run', 'Sortie club', 'Cap vers le lac', 'Sentier des Aravis', 'Boucle du Fier', 'Sunrise run', 'Côte 2000', 'Trail nocturne', 'Tour de la Tournette', 'Plateau des Glières', 'Run urbain', 'Sortie vélo route', 'Gravel forêt', 'Sortie VTT', 'Bord de Loire', 'Crête de Bornes', 'Marathon prépa', 'Sortie tranquille', 'Dénivelé +', 'Sortie pluie', 'Trail express', 'Boucle des cascades', 'Sentier panoramique', 'Tour de chauffe'],
      komoot: ['GR20 — Étape 4', 'Vallée d\u2019Aspe', 'Calanques de Marseille', 'Tour des Écrins', 'Sentier Cathare', 'Mont Ventoux', 'Gorges du Verdon', 'Cirque de Gavarnie', 'Lac de Sainte-Croix', 'Massif de la Chartreuse', 'Vercors traversée', 'Pic du Midi', 'Brèche de Roland', 'Tour du Queyras', 'Mercantour sauvage', 'Sentier du littoral', 'Cap Corse', 'Vanoise glaciers', 'Plateau d\u2019Emparis', 'Aiguilles Rouges', 'Col du Galibier', 'Lac Blanc', 'Refuge du Goûter', 'Balcon de Belledonne', 'Tour du Beaufortain', 'Sixt-Fer-à-Cheval', 'Cascade du Rouget', 'Désert de Platé', 'Pointe Percée', 'Lac d\u2019Anterne', 'Col d\u2019Anterne'],
      garmin: ['Marathon de Paris', 'Trail des Templiers', 'Échappée matinale', 'Semi de Boulogne', '10 km club', 'Sortie seuil', 'VMA courte', 'Récupération active', 'Long run 30k', 'Sortie côtes', 'Run commute', 'Piste 400m', 'Trail blanc', 'Boucle parc', 'Sortie tempo', 'Fartlek', 'Sortie groupe', 'Prépa marathon', 'Run découverte', 'Tour du plan d\u2019eau', 'Montée sèche', 'Sortie vélo', 'Home trainer', 'Brick session', 'Natation lac', 'Triathlon S', 'Sortie longue', 'Trail des loups', 'Course nature', 'Cross country', 'Sortie matinale', 'Run sunset'],
    };
    const SERVICE_KEYS = ['strava', 'komoot', 'garmin'];
    const out = {};
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    SERVICE_KEYS.forEach((key) => {
      const list = NAMES[key].map((name, i) => {
        const daysAgo = Math.floor(rnd() * 540) + i; // spread over ~1.5y
        const d = new Date(2025, 10, 30);
        d.setDate(d.getDate() - daysAgo);
        const distance = +(3 + rnd() * 75).toFixed(1);
        const ascent = Math.round(rnd() * rnd() * 3200);
        return { id: key[0] + i, name, date: d.toISOString().slice(0, 10), distance, ascent };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));
      out[key] = list;
    });
    TRACKS.current = out;
  }
  const TRACKS_DATA = TRACKS.current;

  const fakeConnect = (key) => {
    setAuthPrompt(null);
    setConnections((c) => ({ ...c, [key]: true }));
    setOpenService(key);
  };

  return (
    <div className="mt-4">
      <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
        <span>Sources compatibles</span>
        <span className="normal-case tracking-normal font-normal">
          <Tooltip dark={dark} label="Importez vos activités en 1 clic" side="right">
            <I.Info size={11} className={dark ? 'text-neutral-500' : 'text-neutral-400'} />
          </Tooltip>
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {services.map((svc) => {
          const isConnected = connections[svc.key];
          return (
            <div key={svc.key}>
              <button
                onClick={() => {
                  if (!isConnected) { setAuthPrompt(svc.key); return; }
                  setOpenService(svc.key);
                }}
                className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors text-left ${dark ? 'bg-neutral-900 border border-neutral-800 hover:border-neutral-700' : 'bg-white border border-neutral-200 hover:border-neutral-300'}`}
              >
                <img
                  src={isConnected ? svc.logo : (svc.logoGray || svc.logo)}
                  alt={svc.label}
                  width="28"
                  height="28"
                  draggable="false"
                  style={{ borderRadius: 4, display: 'block', flexShrink: 0 }}
                />
                <span className={`flex-1 text-[12.5px] font-medium ${dark ? 'text-white' : 'text-neutral-900'}`}>
                  {svc.label}
                </span>
                {isConnected ? (
                  <span className="flex items-center gap-1.5">
                    <span className={`text-[10.5px] font-semibold tabular-nums ${dark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {TRACKS_DATA[svc.key].length} GPX
                    </span>
                    <I.Link size={13} style={{ color: svc.color }} />
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded ${dark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-700'}`}
                  >
                    <I.Link size={11} /> Connecter
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Tracks modal — search + sortable list of the provider's GPX */}
      {openService && (
        <TracksModal
          dark={dark}
          accent={accent}
          service={services.find((s) => s.key === openService)}
          tracks={TRACKS_DATA[openService]}
          onClose={() => setOpenService(null)}
          onPick={(tr) => { setOpenService(null); onPickGpx && onPickGpx({ name: tr.name + '.gpx' }); }}
        />
      )}

      {/* Auth modal — fake OAuth-like confirmation */}
      {authPrompt && (
        <AuthModal
          dark={dark}
          service={services.find((s) => s.key === authPrompt)}
          onCancel={() => setAuthPrompt(null)}
          onConnect={() => fakeConnect(authPrompt)}
        />
      )}
    </div>
  );
}

function TracksModal({ dark, accent, service, tracks, onClose, onPick }) {
  const [query, setQuery] = useImportState('');
  const [sortBy, setSortBy] = useImportState('date'); // 'name' | 'date'
  const [sortDir, setSortDir] = useImportState('desc'); // 'asc' | 'desc'
  if (!service) return null;

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const filtered = tracks
    .filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'fr');
      else cmp = new Date(a.date) - new Date(b.date);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortHeader = ({ label, k, align }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider transition-colors ${align === 'right' ? 'justify-end ml-auto' : ''} ${dark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800'}`}
    >
      <span>{label}</span>
      <span className="flex flex-col -space-y-1" style={{ lineHeight: 0 }}>
        <I.ChevronUp size={9} className={sortBy === k && sortDir === 'asc' ? '' : 'opacity-30'} style={sortBy === k && sortDir === 'asc' ? { color: accent } : undefined} />
        <I.ChevronDown size={9} className={sortBy === k && sortDir === 'desc' ? '' : 'opacity-30'} style={sortBy === k && sortDir === 'desc' ? { color: accent } : undefined} />
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[820] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15,15,15,0.34)' }}
        onClick={onClose}
      ></div>
      <div className={`relative w-[520px] max-w-full rounded-xl shadow-2xl overflow-hidden flex flex-col ${dark ? 'bg-neutral-900 border border-neutral-700/60' : 'bg-white border border-neutral-200/80'}`} style={{ height: '70vh', maxHeight: 640 }}>
        {/* Header */}
        <div className={`px-5 pt-4 pb-3 flex items-center gap-3 border-b ${dark ? 'border-neutral-800' : 'border-neutral-100'}`}>
          <img src={service.logo} alt={service.label} width="30" height="30" draggable="false" style={{ borderRadius: 4, display: 'block', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <h3 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>
              Vos activités {service.label}
            </h3>
            <div className={`text-[11.5px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{tracks.length} parcours disponibles</div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md transition-colors ${dark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`}
            title="Fermer"
          >
            <I.X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <div className={`relative flex items-center rounded-lg border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
            <I.Search size={15} className={`absolute left-3 ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un parcours…"
              autoFocus
              className={`w-full bg-transparent outline-none text-[13px] pl-9 pr-3 py-2.5 ${dark ? 'text-neutral-100 placeholder:text-neutral-500' : 'text-neutral-900 placeholder:text-neutral-400'}`}
            />
          </div>
        </div>

        {/* Column headers */}
        <div className={`px-5 py-2 grid items-center gap-3 border-b ${dark ? 'border-neutral-800' : 'border-neutral-100'}`} style={{ gridTemplateColumns: '1fr auto auto' }}>
          <SortHeader label="Nom" k="name" />
          <div className="w-24 text-right"><SortHeader label="Date" k="date" align="right" /></div>
          <div className="w-20 text-right text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: dark ? '#a3a3a3' : '#737373' }}>Distance</div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto sb-scroll">
          {filtered.length === 0 ? (
            <div className={`px-5 py-10 text-center text-[12.5px] ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Aucun parcours ne correspond à « {query} »
            </div>
          ) : filtered.map((tr) => (
            <button
              key={tr.id}
              onClick={() => onPick(tr)}
              className={`w-full px-5 py-2.5 grid items-center gap-3 text-left transition-colors group ${dark ? 'hover:bg-neutral-800/50' : 'hover:bg-neutral-50'}`}
              style={{ gridTemplateColumns: '1fr auto auto' }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: service.color }}></span>
                <span className="min-w-0">
                  <span className={`block text-[13px] font-medium truncate ${dark ? 'text-neutral-100' : 'text-neutral-900'}`}>{tr.name}</span>
                  <span className={`block text-[10.5px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>↑ {tr.ascent} m</span>
                </span>
              </span>
              <span className={`w-24 text-right text-[11.5px] tabular-nums ${dark ? 'text-neutral-400' : 'text-neutral-600'}`}>{fmtDate(tr.date)}</span>
              <span className={`w-20 text-right text-[12.5px] font-semibold tabular-nums ${dark ? 'text-white' : 'text-neutral-900'}`}>{tr.distance.toFixed(1)} km</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthModal({ dark, service, onCancel, onConnect }) {
  if (!service) return null;
  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15,15,15,0.32)' }}
        onClick={onCancel}
      ></div>
      <div className={`relative w-[400px] max-w-full rounded-xl shadow-2xl overflow-hidden ${dark ? 'bg-neutral-900 border border-neutral-700/60' : 'bg-white border border-neutral-200/80'}`}>
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <img
              src={service.logo}
              alt={service.label}
              width="40"
              height="40"
              draggable="false"
              style={{ borderRadius: 4, display: 'block', flexShrink: 0 }}
            />
            <div className="flex-1 min-w-0">
              <h3 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>
                Connecter votre compte {service.label}
              </h3>
              <p className={`mt-1.5 text-[12.5px] leading-relaxed ${dark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                GR planner pourra accéder à vos activités {service.label} pour les importer en quelques clics.
                Vous pourrez révoquer l'accès à tout moment.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 mt-5">
            <button
              onClick={onCancel}
              className={`flex-1 rounded-md px-3 py-2.5 text-[12.5px] font-medium border transition-colors whitespace-nowrap ${dark ? 'border-neutral-800 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
            >
              Annuler
            </button>
            <button
              onClick={onConnect}
              className="btn-cta-primary flex-1 rounded-md px-3 py-2.5 text-[12.5px] font-medium text-white shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
              style={{ background: service.color }}
            >
              Continuer avec {service.label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Format ISO date as "12 sept. 2024"
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) { return iso; }
}

function Parsing({ dark, accent, filename, progress }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress || 0)));
  const SIZE = 116;
  const STROKE = 8;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  return (
    <div className="mt-2">
      <div className={`rounded-2xl border p-7 text-center ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200'}`}>
        <div
          className="mx-auto relative grid place-items-center"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            {/* Track */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              fill="none"
              stroke={dark ? '#262626' : '#e5e5e5'}
              strokeWidth={STROKE}
            />
            {/* Progress */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              fill="none"
              stroke={accent}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset .12s linear' }}
            />
          </svg>
          {/* % label centered */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={`text-[22px] font-semibold tabular-nums leading-none ${dark ? 'text-white' : 'text-neutral-900'}`}
            >
              {pct}<span className="text-[13px] font-medium ml-0.5" style={{ color: accent }}>%</span>
            </div>
            <div className={`mt-1 text-[10.5px] font-medium uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
              {pct < 100 ? 'Analyse' : 'Terminé'}
            </div>
          </div>
        </div>
        <div className={`mt-4 text-[13px] font-medium truncate ${dark ? 'text-white' : 'text-neutral-900'}`}>{filename}</div>
        <div className={`text-[11px] mt-1 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
          Extraction des waypoints et du profil d'altitude…
        </div>
      </div>
    </div>
  );
}

function Stat({ dark, icon, label, value }) {
  return (
    <div className={`rounded-lg border p-2 ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
        {icon} <span>{label}</span>
      </div>
      <div className={`text-[13px] font-semibold tabular-nums mt-0.5 ${dark ? 'text-white' : 'text-neutral-900'}`}>{value}</div>
    </div>
  );
}

window.ImportPanel = ImportPanel;
