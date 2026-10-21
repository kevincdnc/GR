// Printrace — import d'un tracé : fichier (GPX, FIT…), lien Strava, sources.
// Même structure que le panneau d'import de Routdoor, en composants du design system.

const { useState: usePtiState, useEffect: usePtiEffect } = React;

const PT_FORMATS = 'GPX · FIT · TCX · KML / KMZ · GeoJSON · IGC';
const ptRes = (id, path) => ((window.__resources || {})[id] || path);

// Champ « lien Strava » + parcours guidé quand le relais Strava n'est pas branché
function PtStravaLink({ onFiles, autoRef, compact }) {
  const [value, setValue] = usePtiState('');
  const [ref, setRef] = usePtiState(null);     // lien validé
  const [busy, setBusy] = usePtiState(false);
  const [error, setError] = usePtiState('');
  const parsed = ptParseStrava(value);
  const api = !!ptStravaApi();

  const submit = async (r = parsed) => {
    setError('');
    if (!r || r.kind === 'invalid') { setError("Ce lien n'est pas une activité Strava."); return; }
    if (r.kind === 'short') { setError("Lien raccourci : ouvre-le, puis copie l'adresse complète de l'activité (strava.com/activities/…)."); return; }
    setRef(r);
    if (!api) return; // parcours guidé : export depuis le compte Strava
    setBusy(true);
    try {
      const f = await ptFetchStravaGpx(r);
      if (f) { await onFiles([f], { source: 'strava', sourceRef: ptStravaUrl(r) }); setValue(''); setRef(null); }
    } catch (e) { setError(e.message || 'Import Strava impossible.'); }
    setBusy(false);
  };
  // Retour de l'autorisation Strava (#strava=activity:123) : l'import reprend
  usePtiEffect(() => { if (autoRef) { setValue(ptStravaUrl(autoRef)); submit(autoRef); } }, [autoRef && autoRef.id]);

  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { setValue(t.trim()); setError(''); setRef(null); } } catch (e) {}
  };

  return (
    <div>
      <UiInput icon={<img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="18" height="18" className="rounded-[4px] shrink-0" />}
        value={value} onChange={(e) => { setValue(e.target.value); setError(''); setRef(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="https://www.strava.com/activities/…" invalid={!!error} aria-label="Lien d'activité Strava"
        action={value
          ? <UiButton size="sm" variant="strava" loading={busy} onClick={() => submit()}>Importer</UiButton>
          : <UiButton size="sm" onClick={paste}>Coller</UiButton>} />
      {error && <p className="mt-1.5 text-[11.5px] text-red-300 leading-snug">{error}</p>}
      {!error && !ref && !compact && <UiHint className="mt-1.5">Colle le lien d'une de tes activités ou d'un itinéraire Strava.</UiHint>}

      {ref && !api && (
        <div className="mt-3 rounded-xl bg-[#fc4c02]/[0.07] ring-1 ring-[#fc4c02]/25 p-3.5 ds-fade-up">
          <div className="flex items-center gap-2.5">
            <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="26" height="26" className="rounded-md" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white">{ref.kind === 'route' ? 'Itinéraire' : 'Activité'} Strava n° {ref.id}</div>
              <a href={ptStravaUrl(ref)} target="_blank" rel="noopener" className="text-[11.5px] text-neutral-400 hover:text-white">Voir sur Strava ↗</a>
            </div>
          </div>
          <ol className="mt-3 flex flex-col gap-2.5">
            <li className="flex gap-2.5">
              <span className="w-5 h-5 shrink-0 rounded-full grid place-items-center text-[10.5px] font-semibold bg-white text-neutral-900">1</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-neutral-200">Télécharge le fichier GPX depuis ton compte Strava</div>
                <a href={ptStravaExportUrl(ref)} target="_blank" rel="noopener"
                  className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold text-white bg-[#fc4c02] hover:brightness-110">
                  <I.Download size={14} /> Télécharger le GPX
                </a>
              </div>
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 shrink-0 rounded-full grid place-items-center text-[10.5px] font-semibold ring-1 ring-white/25 text-white">2</span>
              <div className="flex-1 min-w-0 text-[12.5px] text-neutral-200">Dépose le fichier ici (ou dans la zone au-dessus) : il est importé tout de suite.</div>
            </li>
          </ol>
          <UiDropzone size="sm" accept={TRACK_ACCEPT} title="Déposer le GPX Strava" action="choisir le fichier" className="mt-3"
            onFiles={(fs) => onFiles(fs, { source: 'strava', sourceRef: ptStravaUrl(ref) }).then(() => { setRef(null); setValue(''); })} />
          <UiHint className="mt-2.5">Strava ne laisse exporter que les activités du compte connecté. L'import direct depuis le lien arrive avec la connexion Strava.</UiHint>
        </div>
      )}
    </div>
  );
}

// Panneau d'import complet (latéral sur ordinateur, plein écran sur mobile)
function PtImportPanel({ onClose, onFiles, busy, isMobile, stravaRef }) {
  const sources = [
    { key: 'komoot', label: 'Komoot', logo: ptRes('komootLogoGray', 'assets/komoot-gray.svg') },
    { key: 'garmin', label: 'Garmin Connect', logo: ptRes('garminLogoGray', 'assets/garmin-gray.svg') },
  ];
  return (
    <div className={isMobile ? 'fixed inset-0 z-[3500] bg-neutral-950 flex flex-col animate-menu' : 'absolute inset-y-0 left-0 z-30 w-[420px] max-w-full bg-[#0d0d0e] border-r border-white/[0.07] shadow-[24px_0_60px_-20px_rgba(0,0,0,0.7)] flex flex-col animate-menu'}>
      <div className="shrink-0 flex items-start gap-3 px-5 pt-5 pb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-[19px] font-semibold tracking-tight text-white">Importer un tracé</h2>
          <p className="text-[12.5px] text-neutral-400 mt-0.5">Glisse ton fichier ou colle un lien Strava</p>
        </div>
        <UiIconButton icon="X" label="Fermer" onClick={onClose} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto sb-scroll px-5 pb-6">
        <UiDropzone accept={TRACK_ACCEPT} onFiles={(fs) => onFiles(fs)} busy={busy} formats={PT_FORMATS} title="Glisse tes fichiers ici" action="parcours tes fichiers" />

        <UiEyebrow className="mt-6 mb-2.5">Lien Strava</UiEyebrow>
        <PtStravaLink onFiles={onFiles} autoRef={stravaRef} />

        <UiEyebrow className="mt-6 mb-2.5">Sources compatibles</UiEyebrow>
        <div className="flex flex-col gap-1.5">
          {sources.map((s) => (
            <UiSourceRow key={s.key} logo={s.logo} label={s.label} sub="Export GPX ou FIT depuis l'application" action={<UiBadge>Bientôt</UiBadge>} />
          ))}
          {ptRoutdoorUrl() && (
            <UiSourceRow logo={<span className="w-[30px] h-[30px] rounded-md grid place-items-center bg-white text-neutral-900 shrink-0"><I.Route size={16} /></span>}
              label="Routdoor" sub="Crée ou modifie ton itinéraire, puis « Envoyer sur Printrace »"
              action={<a href={ptRoutdoorUrl()} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-100">Ouvrir <I.ExternalLink size={13} /></a>} />
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PtImportPanel, PtStravaLink, PT_FORMATS });
