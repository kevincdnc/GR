// Printrace — application : navigation (logo, import, mes tracés) + studio poster.
// Construite avec le design system (src/ds/ui.jsx) et le studio partagé avec
// Routdoor (src/poster-share.jsx).

const { useState: usePtState, useEffect: usePtEffect, useMemo: usePtMemo } = React;

// Ligne de la liste « Mes tracés » : case à cocher, couleur, nom, chiffres
function PtTraceRow({ r, onToggle, onRename, onRemove }) {
  const [editing, setEditing] = usePtState(false);
  const srcIcon = r.source === 'strava'
    ? <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="Strava" title="Importé depuis Strava" width="14" height="14" className="rounded-[3px]" />
    : r.source === 'routdoor' ? <span title="Envoyé depuis Routdoor" className="text-neutral-500"><I.Route size={13} /></span> : null;
  return (
    <div className={`group flex items-center gap-2.5 rounded-lg pl-2 pr-1.5 py-2 transition-colors ${r.visible ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'}`}>
      <button onClick={onToggle} role="checkbox" aria-checked={r.visible} aria-label={(r.visible ? 'Masquer ' : 'Afficher ') + r.name} className="shrink-0 p-0.5 -m-0.5">
        <UiCheckbox checked={r.visible} />
      </button>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color || '#3b82f6' }} />
      <div className="flex-1 min-w-0" onDoubleClick={() => setEditing(true)}>
        {editing ? (
          <input autoFocus defaultValue={r.name} maxLength={80}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.name) onRename(v); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
            className="w-full h-6 rounded bg-white/10 px-1.5 -mx-1.5 text-[13px] text-white outline-none ring-1 ring-white/30" />
        ) : (
          <button onClick={onToggle} title="Double-clic pour renommer" className={`block w-full text-left truncate text-[13px] ${r.visible ? 'text-white' : 'text-neutral-400'}`}>{r.name}</button>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] tabular-nums text-neutral-500">
          {srcIcon}<span>{ptKm(r.distance)}</span><span>·</span><span>{ptM(r.ascent)} D+</span>{r.date && <><span>·</span><span>{ptDate(r.date)}</span></>}
        </div>
      </div>
      <UiIconButton icon="Trash" label="Supprimer" size="xs" onClick={onRemove} className="opacity-0 group-hover:opacity-100 focus:opacity-100 touch-visible" />
    </div>
  );
}

// Navigation : logo, import, mes tracés, lien vers Routdoor
function PtNav({ lib, setVisible, setAll, rename, remove, onImport, isMobile, onClose }) {
  const shown = lib.filter((r) => r.visible).length;
  return (
    <aside className={isMobile ? 'fixed inset-0 z-[3400] bg-neutral-950 flex flex-col animate-menu' : 'w-[284px] shrink-0 flex flex-col bg-[#0d0d0e] border-r border-white/[0.07]'}>
      <div className="h-16 shrink-0 flex items-center justify-between px-5">
        <a href="./" className="text-white" aria-label="Printrace — accueil"><UiPrintraceLogo height={21} /></a>
        {isMobile && <UiIconButton icon="X" label="Fermer" onClick={onClose} />}
      </div>
      <div className="px-4 pb-4">
        <UiButton variant="primary" size="md" icon="Upload" block onClick={onImport} className="h-10">Importer un tracé</UiButton>
      </div>
      <UiDivider />
      <div className="px-4 pt-4 pb-2">
        <UiEyebrow aside={lib.length > 1 && (
          <button onClick={() => setAll(shown < lib.length)} className="text-[11px] font-medium text-neutral-400 hover:text-white">
            {shown < lib.length ? 'Tout cocher' : 'Tout décocher'}
          </button>
        )}>Mes tracés {lib.length > 0 && <span className="ml-1 text-neutral-600 tabular-nums">{shown}/{lib.length}</span>}</UiEyebrow>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto sb-scroll px-2.5 pb-3">
        {lib.length ? (
          <div className="flex flex-col gap-0.5">
            {lib.map((r) => (
              <PtTraceRow key={r.id} r={r} onToggle={() => setVisible(r.id, !r.visible)} onRename={(v) => rename(r.id, v)} onRemove={() => remove(r.id)} />
            ))}
          </div>
        ) : (
          <div className="mx-1.5 mt-1 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center">
            <div className="text-[12.5px] text-neutral-300">Aucun tracé pour l'instant</div>
            <UiHint className="mt-1">Importe un fichier GPX ou FIT, ou colle un lien Strava.</UiHint>
          </div>
        )}
        {lib.length > 0 && <UiHint className="px-2 mt-3">Coche les tracés à mettre sur le poster. Double-clic sur un nom pour le renommer.</UiHint>}
      </div>
      {/* Lien avec Routdoor : créer ou modifier un itinéraire */}
      <div className="shrink-0 p-3 border-t border-white/[0.07]" style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' } : undefined}>
        <a href={ptRoutdoorUrl()} target="_blank" rel="noopener"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/[0.03] ring-1 ring-white/[0.07] hover:bg-white/[0.06] transition-colors">
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] text-neutral-500">Créer ou modifier un itinéraire</span>
            <span className="block mt-1"><UiRoutdoorLogo height={13} /></span>
          </span>
          <span className="text-neutral-400"><I.ExternalLink size={14} /></span>
        </a>
      </div>
    </aside>
  );
}

// Accueil sans tracé : import direct (fichier ou lien Strava)
function PtWelcome({ onFiles, busy, isMobile }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto sb-scroll grid place-items-center px-5 py-10" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1c1c1f 0%, #0a0a0b 70%)' }}>
      <div className="w-full max-w-[680px] ds-fade-up">
        <UiEmptyState icon="Poster" title="Imprime ton aventure"
          body="Trek, marathon, road trip moto, tour à vélo… Importe ton tracé et transforme-le en poster vectoriel, prêt à encadrer." />
        <div className={`mt-8 grid gap-3 text-left ${isMobile ? 'grid-cols-1' : 'grid-cols-[1.15fr_1fr]'}`}>
          <UiDropzone accept={TRACK_ACCEPT} onFiles={(fs) => onFiles(fs)} busy={busy} formats="GPX · FIT · TCX · KML · GeoJSON" title="Importer un fichier" action="parcours tes fichiers" />
          <UiCard className="p-4 flex flex-col">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
              <img src={ptRes('stravaLogo', 'assets/strava.svg')} alt="" width="20" height="20" className="rounded-[4px]" /> Depuis Strava
            </div>
            <UiHint className="mt-1 mb-3">Colle le lien de ton activité, on s'occupe du reste.</UiHint>
            <div className="mt-auto"><PtStravaLink onFiles={onFiles} compact /></div>
          </UiCard>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-[12.5px] text-neutral-500">
          Pas encore de tracé ?
          <a href={ptRoutdoorUrl()} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-neutral-200 hover:text-white font-medium">Dessine-le sur Routdoor <I.ExternalLink size={12} /></a>
        </div>
      </div>
    </div>
  );
}

function PrintraceApp() {
  const isMobile = useIsMobile();
  const [lib, setLib] = usePtState(ptLoad);
  const [busy, setBusy] = usePtState(false);
  const [importOpen, setImportOpen] = usePtState(false);
  const [navOpen, setNavOpen] = usePtState(false);
  const [stravaRef, setStravaRef] = usePtState(null);
  // Titre du projet (ex. nom du groupe envoyé par Routdoor), utilisé quand plusieurs tracés sont cochés
  const [projectTitle, setProjectTitle] = usePtState(() => { try { return localStorage.getItem('printrace_title') || ''; } catch (e) { return ''; } });
  usePtEffect(() => { try { localStorage.setItem('printrace_title', projectTitle); } catch (e) {} }, [projectTitle]);
  const [toast, showToast] = useUiToast();

  // Enregistrement local (navigateur)
  usePtEffect(() => { if (!ptSave(lib) && lib.length) showToast('Stockage du navigateur plein : supprime quelques tracés.'); }, [lib]);

  // Ajoute des tracés : les nouveaux sont affichés seuls sur le poster
  const addTraces = (items, label) => {
    setLib((prev) => {
      const fresh = [], again = new Set();
      items.forEach((it, i) => {
        const dup = prev.find((p) => ptSame(p, it));
        if (dup) again.add(dup.id); else fresh.push({ ...it, color: it.color || ptNextColor(prev, fresh.length) });
      });
      return [...fresh, ...prev.map((p) => ({ ...p, visible: again.has(p.id) }))];
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
    if (!ok.length) { showToast('Impossible de lire ce fichier.'); return; }
    const items = ok.map((r) => ptFromStage(r.st, r.f.name, extra));
    addTraces(items, items.length > 1 ? `${items.length} tracés importés` : `« ${items[0].name} » importé`);
    setImportOpen(false); setNavOpen(false);
  };

  // Arrivée depuis Routdoor (#t=…) ou retour de l'autorisation Strava (#strava=…)
  usePtEffect(() => {
    // Session ouverte par le relais Strava (#…&ss=…)
    const ss = location.hash.match(/[#&]ss=([a-f0-9]+)/);
    if (ss) { try { localStorage.setItem(PT_STRAVA_SESSION, ss[1]); } catch (e) {} }
    const m = location.hash.match(/strava=(activity|route):(\d+)/);
    if (m) { setStravaRef({ kind: m[1], id: m[2] }); setImportOpen(true); history.replaceState(null, '', location.pathname + location.search); return; }
    ptReadInbox().then((d) => {
      if (!d) return;
      history.replaceState(null, '', location.pathname + location.search);
      if (d.title) setProjectTitle(d.title);
      const site = d.from === 'site';
      const items = d.parts.map((p) => ptFromShared(p, { activity: d.activity, source: site ? (d.source || 'file') : 'routdoor' }));
      addTraces(items, d.parts.length > 1 ? `${d.parts.length} tracés ${site ? 'importés' : 'reçus de Routdoor'}` : `« ${d.parts[0].name} » ${site ? 'importé' : 'reçu de Routdoor'}`);
    }).catch(() => showToast('Ce lien de tracé est incomplet.'));
  }, []);

  // Dépôt d'un fichier n'importe où dans la page
  const [dropping, setDropping] = usePtState(false);
  const dropProps = {
    onDragOver: (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } },
    onDragLeave: (e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) setDropping(false); },
    onDrop: (e) => { setDropping(false); const fs = [...e.dataTransfer.files]; if (fs.some(isTrackFile)) { e.preventDefault(); importFiles(fs); } },
  };

  const setVisible = (id, v) => setLib((l) => l.map((r) => (r.id === id ? { ...r, visible: v } : r)));
  const setAll = (v) => setLib((l) => l.map((r) => ({ ...r, visible: v })));
  const rename = (id, name) => setLib((l) => l.map((r) => (r.id === id ? { ...r, name } : r)));
  const remove = (id) => {
    const r = lib.find((x) => x.id === id);
    setLib((l) => l.filter((x) => x.id !== id));
    showToast(`« ${r ? r.name : 'Tracé'} » supprimé`);
  };

  const routes = usePtMemo(() => lib.filter((r) => r.visible), [lib]);
  const included = usePtMemo(() => new Set(routes.map((r) => r.id)), [routes]);
  const title = routes.length === 1 ? routes[0].name : projectTitle;
  const nav = <PtNav lib={lib} setVisible={setVisible} setAll={setAll} rename={rename} remove={remove} isMobile={isMobile}
    onImport={() => { setNavOpen(false); setImportOpen(true); }} onClose={() => setNavOpen(false)} />;

  let main;
  if (!lib.length) main = <PtWelcome onFiles={importFiles} busy={busy} isMobile={isMobile} />;
  else if (!routes.length) {
    main = (
      <div className="flex-1 grid place-items-center px-6" style={{ background: 'radial-gradient(ellipse at 50% 40%, #3a3a3e 0%, #2a2a2d 55%, #1f1f22 100%)' }}>
        <UiEmptyState icon="Route" title="Aucun tracé coché" body="Coche un ou plusieurs tracés dans « Mes tracés » pour composer ton poster.">
          <div className="mt-6 flex justify-center gap-2">
            <UiButton variant="primary" onClick={() => setAll(true)}>Tout cocher</UiButton>
            {isMobile && <UiButton onClick={() => setNavOpen(true)}>Mes tracés</UiButton>}
          </div>
        </UiEmptyState>
      </div>
    );
  } else {
    main = <PosterPane allRoutes={routes} routes={routes} included={included} setIncluded={() => {}} title={title} setTitle={() => {}}
      initialTitle={title || 'Mon aventure'} dark isMobile={isMobile} onToast={showToast} routeTools={null} storeId="app" />;
  }

  return (
    <div className="h-full flex bg-neutral-950 text-white" {...dropProps}>
      {!isMobile && nav}
      <main className="relative flex-1 min-w-0 flex flex-col">
        {isMobile && (
          <header className="shrink-0 h-14 flex items-center gap-2 px-3 border-b border-white/[0.07]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <UiPrintraceLogo height={19} className="ml-1 mr-auto" />
            {lib.length > 0 && <UiButton size="sm" icon="Route" onClick={() => setNavOpen(true)}>Mes tracés <span className="tabular-nums text-neutral-400">{routes.length}/{lib.length}</span></UiButton>}
            <UiIconButton icon="Upload" label="Importer un tracé" variant="secondary" size="sm" onClick={() => setImportOpen(true)} />
          </header>
        )}
        {main}
        {importOpen && <PtImportPanel onClose={() => setImportOpen(false)} onFiles={importFiles} busy={busy} isMobile={isMobile} stravaRef={stravaRef} />}
      </main>
      {isMobile && navOpen && nav}
      {dropping && (
        <div className="fixed inset-0 z-[3600] grid place-items-center bg-neutral-950/80 backdrop-blur-sm pointer-events-none">
          <div className="rounded-3xl border-2 border-dashed border-white/40 px-14 py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full grid place-items-center bg-white text-neutral-900 mb-3"><I.Upload size={20} /></div>
            <div className="text-[17px] font-semibold">Dépose ton tracé</div>
            <div className="text-[12.5px] text-neutral-400 mt-1">{PT_FORMATS}</div>
          </div>
        </div>
      )}
      {toast}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrintraceApp />);
