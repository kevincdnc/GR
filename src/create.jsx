// Create itinerary side panel — replaces the sidebar when active.
// Pre-filled name, dropdown for activity (12+ options), live stats from draft.

const { useState: useCreateState, useEffect: useCreateEffect, useRef: useCreateRef } = React;
const Tooltip = window.Tooltip;

function CreatePanel({
  onClose, onSave, groups, dark, accent, onActivityChange,
  draftCoords, draftDistance, draftRouteType, onChangeRouteType, onClearDraft,
  draftSections, activeSectionId, onSetActiveSection, onAddSection, onRemoveSection, onUpdateSection,
  draftPois, onAddPoi, onRemovePoi, onUpdatePoi,
  placingPoi, onStartPlacingPoi, onUpdatePlacingPoi, onStopPlacingPoi,
  poiFiltersActive, onShowAllPois,
  step, onChangeStep,
  defaultName, defaultActivity, defaultGroupId, defaultPrivacy, editingMode,
}) {
  const [name, setName] = useCreateState(defaultName || 'Nouvel itinéraire');
  const [activity, setActivity] = useCreateState(defaultActivity || 'hiking');
  const [groupId, setGroupId] = useCreateState(defaultGroupId || groups[0]?.id || '');
  const [privacy, setPrivacy] = useCreateState(defaultPrivacy || 'private');
  // Report the (initial / restored) activity up so the map's duration estimate
  // uses the same activity as this panel.
  useCreateEffect(() => { onActivityChange && onActivityChange(activity); }, []);
  const setStep = onChangeStep || (() => {});
  const nameRef = useCreateRef(null);
  const activityBtnRef = useCreateRef(null);
  // "Nouveau repère" dropdown
  const [poiMenuOpen, setPoiMenuOpen] = useCreateState(false);
  const poiMenuRef = useCreateRef(null);
  useCreateEffect(() => {
    if (!poiMenuOpen) return;
    const onDoc = (e) => { if (poiMenuRef.current && !poiMenuRef.current.contains(e.target)) setPoiMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [poiMenuOpen]);

  // On mount, focus the Activity field first — it can't be changed once the
  // trace has started, so it should get the user's attention immediately.
  const [activityFocused, setActivityFocused] = useCreateState(false);
  // Once the activity field has been interacted with (opened/closed or changed),
  // move focus to the Nom field for a fast edit flow.
  const focusName = () => {
    setActivityFocused(false);
    setTimeout(() => {
      if (nameRef.current) { nameRef.current.focus(); nameRef.current.select(); }
    }, 60);
  };
  useCreateEffect(() => {
    if (editingMode) return;
    const t = setTimeout(() => {
      if (activityBtnRef.current) {
        activityBtnRef.current.focus();
        setActivityFocused(true);
      }
    }, 120);
    return () => clearTimeout(t);
  }, []);

  // In Free mode groups is empty → groupId is '' but handleSaveNew creates a
  // default group fallback. Don't block save on missing groupId.
  const canSave = name.trim().length > 0 && draftCoords && draftCoords.length >= 2;
  const pointCount = draftCoords ? draftCoords.length : 0;

  const submit = () => {
    if (!canSave) return;
    const isComposite = draftSections && draftSections.filter(s => s.coords && s.coords.length >= 2).length > 1;
    // Build a final coords chain (already de-duplicated by app) + apply outAndBack
    const coords = composeDraftCoords(draftCoords, draftRouteType);
    const distance = totalDistanceKm(coords);
    let sections = null;
    if (isComposite) {
      sections = draftSections
        .filter(s => s.coords && s.coords.length >= 2)
        .map(s => {
          const sCoords = composeDraftCoords(s.coords, draftRouteType);
          return {
            id: s.id,
            name: s.name,
            color: s.color,
            coords: sCoords,
            distance: totalDistanceKm(sCoords),
            ascent: computeElevationStats(sCoords).ascent,
          };
        });
    }
    onSave({
      id: 'i_new_' + Date.now(),
      name: name.trim(),
      activity,
      color: (draftSections && draftSections[0] && draftSections[0].color) || 'sky',
      sections,
      groupId,
      privacy,
      coords,
      distance,
      ascent: computeElevationStats(coords).ascent,
      routeType: draftRouteType,
      pois: (draftPois || []).map((p) => ({ ...p })),
    });
  };

  // Allow the in-map "Valider" button to trigger save
  useCreateEffect(() => {
    const finish = () => submit();
    window.addEventListener('gr:finishDraft', finish);
    return () => window.removeEventListener('gr:finishDraft', finish);
  });

  const labelCls = `text-[12px] font-medium mb-1.5 ${dark ? 'text-neutral-300' : 'text-neutral-700'}`;
  const inputCls = `w-full rounded-lg border outline-none transition-all text-[13px] px-3 py-2.5 ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600' : 'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white'}`;

  return (
    <div className="relative flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onClose}
            className={`-ml-1.5 p-1.5 rounded-lg transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}
          >
            <I.ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className={`font-semibold text-[15px] tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>{editingMode ? 'Modifier l’itinéraire' : 'Nouvel itinéraire'}</div>
            <div className={`text-[11px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{editingMode ? 'Ajustez le tracé puis enregistrez' : 'Tracez votre parcours sur la carte'}</div>
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

      {/* Body — uniform white background; sections separated by thin borders */}
      <div className="flex-1 overflow-y-auto sb-scroll min-h-0">
        {/* Top section — Activity dropdown */}
        <div className={`px-4 pt-2 pb-5 border-b ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200/80'}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className={`text-[12px] font-medium ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}>Activité</label>
            <Tooltip
              dark={dark}
              label="Activité verrouillée pendant le tracé"
              sub="Pour la modifier, effacez les points posés."
              side="right"
            >
              <I.Info size={12} className={dark ? 'text-neutral-500' : 'text-neutral-400'} />
            </Tooltip>
          </div>
          <ActivityDropdown
            value={activity}
            btnRef={activityBtnRef}
            highlight={activityFocused}
            onChange={(a) => { setActivity(a); onActivityChange && onActivityChange(a); focusName(); }}
            onClosed={focusName}
            dark={dark}
            accent={accent}
            disabled={pointCount > 0}
          />
        </div>

        {/* Mid section — secondary fields */}
        <div className={`px-4 pt-4 pb-4 ${dark ? 'bg-neutral-950' : 'bg-white'}`}>
          {/* Tracé — visual stat blocks (above the name) */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-[12px] font-medium ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                Tracé
                {pointCount > 0 && (
                  <span className={`ml-1.5 text-[11px] font-normal tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    · {pointCount} pts
                  </span>
                )}
              </label>
              {pointCount > 0 && (
                <button
                  onClick={onClearDraft}
                  className={`text-[11.5px] font-medium ${dark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-700'}`}>
                  Effacer
                </button>
              )}
            </div>
            {pointCount === 0 ? (
              <div className={`flex items-center gap-2 text-[12px] rounded-lg px-2.5 py-2.5 border ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}>
                <I.Pin size={12} />
                <span>Cliquez sur la carte pour commencer</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  <TraceStat dark={dark} icon={<I.Distance size={13} />} label="Distance" value={(draftDistance || 0).toFixed(1) + ' km'} />
                  <TraceStat dark={dark} icon={<I.TrendingUp size={13} />} label="D+" value={fmtAscent(computeElevationStats(composeDraftCoords(draftCoords || [], draftRouteType)).ascent)} />
                  <TraceStat dark={dark} icon={<I.Clock size={13} />} label="Estimé" value={fmtDuration(estimateDurationMin(draftDistance || 0, computeElevationStats(composeDraftCoords(draftCoords || [], draftRouteType)).ascent, activity))} />
                </div>
                {(draftSections || []).filter((s) => s.coords && s.coords.length >= 2).length > 1 && (
                  <div className={`flex items-center gap-2 mt-1.5 px-1 text-[11px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    <span>{(draftSections || []).filter((s) => s.coords && s.coords.length >= 2).length} sections</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className={labelCls}>Nom <span className="text-rose-500">*</span></label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Boucle des Crêtes"
              className={inputCls}
            />
          </div>

        {/* Group */}
        <div className="mb-4">
          <label className={labelCls}>Ranger dans</label>
          <div className="relative">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={inputCls + ' appearance-none pr-8 cursor-pointer'}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              <option value="__new">+ Nouveau groupe…</option>
            </select>
            <I.ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
          </div>
        </div>

        {/* Sections */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className={`text-[12px] font-medium ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}>Sections</label>
              <Tooltip
                dark={dark}
                label="Sections"
                sub="Votre itinéraire peut contenir une ou plusieurs sections."
                side="right"
              >
                <I.Info size={12} className={dark ? 'text-neutral-500' : 'text-neutral-400'} />
              </Tooltip>
            </div>
            <span className={`text-[10.5px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{(draftSections || []).length}</span>
          </div>
          <div className={`rounded-lg border ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
            {(draftSections || []).map((sec, idx) => (
              <SectionListItem
                key={sec.id}
                section={sec}
                index={idx}
                isLast={idx === draftSections.length - 1}
                active={sec.id === activeSectionId}
                canDelete={draftSections.length > 1 && (idx === draftSections.length - 1 || sec.id === activeSectionId)}
                onActivate={() => onSetActiveSection && onSetActiveSection(sec.id)}
                onRename={(name) => onUpdateSection && onUpdateSection(sec.id, { name })}
                onRecolor={(color) => onUpdateSection && onUpdateSection(sec.id, { color })}
                onDelete={() => onRemoveSection && onRemoveSection(sec.id)}
                dark={dark}
                accent={accent}
              />
            ))}
          </div>
          <button
            onClick={() => onAddSection && onAddSection()}
            className={`mt-1.5 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium rounded-md px-3 py-1.5 border border-dashed transition-colors ${dark ? 'border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900' : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}
          >
            <I.Plus size={13} /> Nouvelle section
          </button>
        </div>

        {/* Repères personnalisés — same accordion-like UX as Sections, with a list
            of placed POIs and a button to start placing a new one. */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className={`text-[12px] font-medium ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}>Repères personnalisés</label>
              <Tooltip
                dark={dark}
                label="Repères personnalisés"
                sub="Placez des marqueurs sur votre tracé pour signaler vos points clés."
                side="right"
              >
                <I.Info size={12} className={dark ? 'text-neutral-500' : 'text-neutral-400'} />
              </Tooltip>
            </div>
            <span className={`text-[10.5px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{(draftPois || []).length}</span>
          </div>
          {(draftPois && draftPois.length > 0) && (
            <div className={`rounded-lg border mb-1.5 ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
              {draftPois.map((p, i) => (
                <PoiListItem
                  key={p.id}
                  poi={p}
                  isLast={i === draftPois.length - 1}
                  dark={dark}
                  accent={accent}
                  onRename={(name) => onUpdatePoi && onUpdatePoi(p.id, { name })}
                  onUpdate={(patch) => onUpdatePoi && onUpdatePoi(p.id, patch)}
                  onRemove={() => onRemovePoi && onRemovePoi(p.id)}
                />
              ))}
            </div>
          )}
          {/* Placement opens a floating card (see below). The inline list +
              "Nouveau repère" dropdown stay here. */}
          <div className="relative" ref={poiMenuRef}>
            <button
              onClick={() => setPoiMenuOpen((o) => !o)}
              className={`w-full flex items-center justify-center gap-1.5 text-[12px] font-medium rounded-md px-3 py-1.5 border border-dashed transition-colors ${dark ? 'border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900' : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}
              aria-haspopup="menu"
              aria-expanded={poiMenuOpen}
            >
              <I.Plus size={13} /> Nouveau repère
              <I.ChevronDown size={13} className={`ml-0.5 transition-transform ${poiMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {poiMenuOpen && (
              <div
                role="menu"
                className={`absolute left-0 right-0 top-full mt-1 z-30 rounded-lg shadow-2xl overflow-hidden animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
              >
                <button
                  role="menuitem"
                  onClick={() => { setPoiMenuOpen(false); onShowAllPois && onShowAllPois(); }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50'}`}
                >
                  <span className="w-7 h-7 rounded-md grid place-items-center shrink-0" style={{ background: accent + '1f', color: accent }}>
                    <I.MarkerPin size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[12.5px] font-medium ${dark ? 'text-white' : 'text-neutral-900'}`}>
                      {poiFiltersActive ? 'Masquer les points d’intérêt' : 'Afficher les points d’intérêt'}
                    </span>
                    <span className={`block text-[11px] leading-snug mt-0.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      Parking, eau, refuges… autour de votre tracé
                    </span>
                  </span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setPoiMenuOpen(false); onStartPlacingPoi && onStartPlacingPoi({ name: '', color: 'blue', icon: 'Pin' }); }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50'}`}
                >
                  <span className="w-7 h-7 rounded-md grid place-items-center shrink-0" style={{ background: accent + '1f', color: accent }}>
                    <I.Plus size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[12.5px] font-medium ${dark ? 'text-white' : 'text-neutral-900'}`}>
                      Ajouter un repère personnalisé
                    </span>
                    <span className={`block text-[11px] leading-snug mt-0.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      Placez votre propre marqueur sur le tracé
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Route type */}
        <div className="mb-4">
          <label className={labelCls}>Type de tracé</label>
          <div className="grid grid-cols-2 gap-1.5">
            <RouteTypeBtn
              dark={dark} accent={accent}
              selected={draftRouteType === 'oneWay'}
              onClick={() => onChangeRouteType('oneWay')}
              icon={<RouteTypeOneWay color={draftRouteType === 'oneWay' ? accent : (dark ? '#64748b' : '#94a3b8')} />}
              label="Aller simple"
            />
            <RouteTypeBtn
              dark={dark} accent={accent}
              selected={draftRouteType === 'outAndBack'}
              onClick={() => onChangeRouteType('outAndBack')}
              icon={<RouteTypeOutBack color={draftRouteType === 'outAndBack' ? accent : (dark ? '#64748b' : '#94a3b8')} />}
              label="Aller-retour"
            />
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
      </div>
      </div>

      {/* Footer / CTA */}
      <div className={`px-4 py-3 border-t ${dark ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-white'}`}>
        <button
          onClick={submit}
          disabled={!canSave}
          className={`btn-cta-primary w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-medium text-white transition-all ${canSave ? 'hover:shadow active:scale-[0.99]' : 'opacity-40 cursor-not-allowed'}`}
          style={{ background: accent }}
          title={!canSave && pointCount < 2 ? 'Posez au moins 2 waypoints sur la carte' : ''}
        >
          <I.Check size={15} stroke="white" strokeWidth="2.4" />
          {editingMode ? 'Enregistrer' : 'Valider mon itinéraire'}
        </button>
      </div>
    </div>
  );
}

function DraftStat({ dark, icon, label, value }) {
  return (
    <div className={`rounded-md p-1.5 ${dark ? 'bg-neutral-800/60' : 'bg-white'}`}>
      <div className={`flex items-center gap-1 text-[9.5px] uppercase tracking-wider font-medium ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
        {icon} <span>{label}</span>
      </div>
      <div className={`text-[12.5px] font-semibold tabular-nums mt-0.5 ${dark ? 'text-white' : 'text-neutral-900'}`}>{value}</div>
    </div>
  );
}

// Section row inside the sections list — inline name edit + per-section color picker.
function SectionListItem({ section, index, isLast, active, canDelete, onActivate, onRename, onRecolor, onDelete, dark, accent }) {
  const [editing, setEditing] = useCreateState(false);
  const [draft, setDraft] = useCreateState(section.name);
  const [colorOpen, setColorOpen] = useCreateState(false);
  const [colorPos, setColorPos] = useCreateState(null);
  const colorRef = useCreateRef(null);
  const btnColorRef = useCreateRef(null);
  const inputRef = useCreateRef(null);

  const openColorPicker = () => {
    if (btnColorRef.current) {
      const r = btnColorRef.current.getBoundingClientRect();
      // Popover is ~150px wide & ~60px tall. Position below the swatch; flip up
      // if it would go off the bottom of the viewport.
      const POP_H = 44;
      const POP_W = 280;
      let top = r.bottom + 6;
      if (top + POP_H > window.innerHeight - 8) top = r.top - POP_H - 6;
      let left = r.left;
      if (left + POP_W > window.innerWidth - 8) left = window.innerWidth - POP_W - 8;
      setColorPos({ top, left });
    }
    setColorOpen((o) => !o);
  };

  useCreateEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useCreateEffect(() => {
    if (!colorOpen) return;
    const onDoc = (e) => {
      // Closing on outside click — but the popover lives in document.body now.
      // Skip clicks inside the swatch's button (which would re-toggle).
      if (colorRef.current && colorRef.current.contains(e.target)) return;
      // The popover root carries data-section-color-popover for detection
      const pop = e.target.closest && e.target.closest('[data-section-color-popover]');
      if (pop) return;
      setColorOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setColorOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [colorOpen]);

  // keep local draft in sync if section.name changes from outside
  useCreateEffect(() => { setDraft(section.name); }, [section.name]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== section.name) onRename && onRename(next);
    else setDraft(section.name);
    setEditing(false);
  };
  const cancel = () => { setDraft(section.name); setEditing(false); };

  const color = ROUTE_COLORS[section.color]?.hex || '#0ea5e9';
  const pts = section.coords ? section.coords.length : 0;

  return (
    <div
      onClick={onActivate}
      className={`group flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors ${!isLast ? (dark ? 'border-b border-neutral-800' : 'border-b border-neutral-100') : ''} ${active ? (dark ? 'bg-neutral-800/70' : 'bg-neutral-50') : (dark ? 'hover:bg-neutral-900' : 'hover:bg-neutral-50/60')}`}
    >
      {/* Color dot + per-section picker */}
      <div className="relative" ref={colorRef}>
        <button
          ref={btnColorRef}
          onClick={(e) => { e.stopPropagation(); openColorPicker(); }}
          title="Changer la couleur"
          className="w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110 grid place-items-center"
          style={{ background: color, boxShadow: active ? `0 0 0 1.5px ${dark ? '#0a0a0a' : '#fff'}, 0 0 0 3px ${color}` : 'none' }}
        ></button>
        {colorOpen && colorPos && ReactDOM.createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            className={`fixed z-[10000] p-2 rounded-md shadow-2xl animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
            style={{ top: colorPos.top, left: colorPos.left }}
          >
            <div className="flex items-center gap-1.5">
              {Object.entries(ROUTE_COLORS).map(([key, c]) => (
                <button
                  key={key}
                  onClick={(e) => { e.stopPropagation(); onRecolor && onRecolor(key); setColorOpen(false); }}
                  className={`w-5 h-5 rounded-full grid place-items-center transition-transform shrink-0 ${section.color === key ? 'scale-110' : 'hover:scale-105'}`}
                  style={{
                    background: c.hex,
                    boxShadow: section.color === key ? `0 0 0 1.5px ${dark ? '#0a0a0a' : '#fff'}, 0 0 0 3px ${c.hex}` : 'none',
                  }}
                  title={c.name}
                >
                  {section.color === key && <I.Check size={9} stroke="white" strokeWidth="3" />}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
      {/* Name (editable) */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
            className={`w-full text-[12.5px] font-medium bg-transparent outline-none rounded px-1 py-0.5 ring-1 ${dark ? 'text-white ring-neutral-600 bg-neutral-900' : 'text-neutral-900 ring-neutral-300 bg-white'}`}
          />
        ) : (
          <div
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Double-cliquez pour renommer"
            className={`text-[12.5px] font-medium truncate select-none ${active ? (dark ? 'text-white' : 'text-neutral-900') : (dark ? 'text-neutral-200' : 'text-neutral-800')}`}
          >{section.name}</div>
        )}
        <div className={`text-[10.5px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
          {pts < 2
            ? (pts === 0 ? 'Aucun point' : '1 point')
            : (() => {
                let km = 0;
                if (typeof L !== 'undefined') {
                  for (let i = 1; i < section.coords.length; i++) {
                    km += L.latLng(section.coords[i - 1]).distanceTo(L.latLng(section.coords[i])) / 1000;
                  }
                }
                const dPlus = computeElevationStats(section.coords).ascent;
                return `${km.toFixed(2)} km · ↑ ${dPlus} m`;
              })()
          }
        </div>
      </div>
      {/* Delete (only available on the last/active section) */}
      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-colors ${dark ? 'text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10' : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50'}`}
          title="Supprimer la section"
        >
          <I.Trash size={12} />
        </button>
      )}
    </div>
  );
}

function RouteTypeBtn({ selected, onClick, icon, label, dark, accent }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-all ${dark ? (selected ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700') : (selected ? 'bg-white border-neutral-300 shadow-sm' : 'bg-white border-neutral-200 hover:border-neutral-300')}`}
      style={selected ? { boxShadow: `0 0 0 2px ${accent}33`, borderColor: accent } : undefined}
    >
      <span className="h-7 grid place-items-center">{icon}</span>
      <span className={`text-[10.5px] font-medium leading-tight text-center ${selected ? (dark ? 'text-white' : 'text-neutral-900') : (dark ? 'text-neutral-400' : 'text-neutral-600')}`}>{label}</span>
    </button>
  );
}

// SVG glyphs for the 3 route types — clean, recognizable
function RouteTypeOneWay({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
      {/* Start pin (left) */}
      <circle cx="6" cy="11" r="3.5" fill={color} />
      <circle cx="6" cy="11" r="1.4" fill="#fff" />
      {/* Line A→B */}
      <path d="M9.5 11 L23 11" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* End pin / arrow (right) */}
      <path d="M22 7 L26 11 L22 15" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function RouteTypeOutBack({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
      {/* Start pin (left) */}
      <circle cx="6" cy="11" r="3.5" fill={color} />
      <circle cx="6" cy="11" r="1.4" fill="#fff" />
      {/* Outbound (top) — solid arrow right */}
      <path d="M9.5 7 L23 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 4 L26 7 L22 10" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Return (bottom) — dashed arrow left */}
      <path d="M26 15 L10 15" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="1 3" />
      <path d="M13 12 L9.5 15 L13 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function RouteTypeLoop({ color }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
      {/* Closed loop */}
      <path
        d="M11 18 C 3 18, 3 4, 16 4 C 29 4, 29 18, 21 18 L 13 18"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow indicating direction near closing point */}
      <path d="M16 15 L 13 18 L 16 21" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Start/end pin */}
      <circle cx="12" cy="18" r="3.5" fill={color} />
      <circle cx="12" cy="18" r="1.4" fill="#fff" />
    </svg>
  );
}

// Custom dropdown for activity selection (handles many options + icons)
function ActivityDropdown({ value, onChange, dark, accent, disabled, btnRef, highlight, onClosed }) {
  const [open, setOpen] = useCreateState(false);
  const ref = useCreateRef(null);
  const [focused, setFocused] = useCreateState(false);
  const wasOpen = useCreateRef(false);
  useCreateEffect(() => {
    if (wasOpen.current && !open) { onClosed && onClosed(); }
    wasOpen.current = open;
  }, [open]);

  useCreateEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled]);

  useCreateEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cur = ACTIVITIES[value];
  const CurIcon = cur ? I[cur.icon] : I.Route;

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className={`w-full flex items-center gap-2 rounded-lg border px-2 py-2 text-[13px] outline-none transition-all ${open ? 'ring-1' : ''} ${disabled ? 'cursor-not-allowed' : ''} ${dark ? (disabled ? 'bg-neutral-900/60 border-neutral-800 text-neutral-300' : 'bg-neutral-900 border-neutral-800 text-neutral-100 hover:border-neutral-700') : (disabled ? 'bg-neutral-100 border-neutral-200 text-neutral-700' : 'bg-white border-neutral-200 text-neutral-900 hover:border-neutral-300')}`}
        style={(open || focused || highlight) ? { boxShadow: `0 0 0 2px ${accent}33`, borderColor: accent } : undefined}
      >
        <span
          className="w-7 h-7 rounded-md grid place-items-center shrink-0"
          style={{ background: accent + '22', color: accent }}
        >
          <CurIcon size={14} />
        </span>
        <span className="flex-1 text-left font-medium">{cur ? cur.label : 'Activité'}</span>
        {disabled
          ? <I.Lock size={13} className={dark ? 'text-neutral-500' : 'text-neutral-400'} />
          : <I.ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''} ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />}
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-1 z-30 rounded-lg shadow-2xl overflow-hidden max-h-72 overflow-y-auto animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
        >
          {Object.entries(ACTIVITIES).map(([key, a]) => {
            const Icon = I[a.icon] || I.Route;
            const sel = value === key;
            return (
              <button
                key={key}
                onClick={() => { onChange(key); setOpen(false); }}
                role="option"
                aria-selected={sel}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-[13px] transition-colors ${sel ? (dark ? 'bg-neutral-800/80' : 'bg-neutral-50') : (dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50')}`}
              >
                <span
                  className="w-6 h-6 rounded grid place-items-center shrink-0"
                  style={{ background: sel ? accent + '22' : (dark ? '#0f172a' : '#f1f5f9'), color: sel ? accent : (dark ? '#94a3b8' : '#64748b') }}
                >
                  <Icon size={13} />
                </span>
                <span className={`flex-1 ${sel ? 'font-medium' : ''} ${dark ? 'text-neutral-100' : 'text-neutral-800'}`}>{a.label}</span>
                {sel && <I.Check size={13} style={{ color: accent }} strokeWidth="2.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepperPill({ index, label, active, done, dark, accent, onClick, disabled }) {
  const bg = active ? accent + '22' : (done ? accent + '14' : (dark ? '#171717' : '#f5f5f5'));
  const fg = active ? accent : (done ? accent : (dark ? '#a3a3a3' : '#737373'));
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      style={{ background: bg }}
    >
      <span
        className="w-4 h-4 rounded-full grid place-items-center text-[10px] font-bold tabular-nums"
        style={{ background: fg, color: '#fff' }}
      >
        {done ? <I.Check size={9} stroke="white" strokeWidth="3.5" /> : index}
      </span>
      <span className="text-[11.5px] font-medium" style={{ color: fg }}>{label}</span>
    </button>
  );
}

// --- POI step --------------------------------------------------------------
// Two modes: 'custom' (user adds named/colored/icon-marked POIs by clicking the
// map) and 'osm' (browse nearby POIs around the route in a 2km radius).
const POI_ICONS = ['Pin', 'Flag', 'Alert', 'Checkpoint', 'Info', 'Medical', 'Accommodation', 'Water', 'Restaurant', 'Parking', 'Camera'];
const POI_ICON_LABELS = {
  Pin: 'Repère', Flag: 'Drapeau', Alert: 'Alerte', Checkpoint: 'Point de contrôle',
  Info: 'Information', Medical: 'Médical', Accommodation: 'Hébergement',
  Water: 'Point d\u2019eau', Restaurant: 'Restaurant', Parking: 'Parking', Camera: 'Point de vue',
};
// Mock OSM-style nearby POIs (would come from a real query in production)
const MOCK_NEARBY = [
  { id: 'osm-1', name: 'Pharmacie du Lac', type: 'pharmacy', distance: 0.4 },
  { id: 'osm-2', name: 'Source du Hameau', type: 'water', distance: 0.8 },
  { id: 'osm-3', name: 'Parking des Crêtes', type: 'parking', distance: 1.2 },
  { id: 'osm-4', name: 'Refuge de la Combe', type: 'accommodation', distance: 1.4 },
  { id: 'osm-5', name: 'Auberge du Col', type: 'restaurant', distance: 1.7 },
  { id: 'osm-6', name: 'Point de vue panoramique', type: 'viewpoint', distance: 1.9 },
];
const POI_TYPE_META = {
  pharmacy: { icon: 'Medical', color: 'rose' },
  water: { icon: 'Water', color: 'sky' },
  parking: { icon: 'Parking', color: 'indigo' },
  accommodation: { icon: 'Accommodation', color: 'amber' },
  restaurant: { icon: 'Restaurant', color: 'orange' },
  viewpoint: { icon: 'Camera', color: 'emerald' },
};

function PoiStep({ dark, accent, pois, onAddPoi, onRemovePoi, onUpdatePoi, placingPoi, onStartPlacingPoi, onUpdatePlacingPoi, onStopPlacingPoi }) {
  const [mode, setMode] = useCreateState(null); // null | 'custom' | 'osm'

  // When user opens "custom" → enter placement mode with a default template.
  // When user closes it → stop placement.
  useCreateEffect(() => {
    if (mode === 'custom') {
      if (!placingPoi) onStartPlacingPoi && onStartPlacingPoi({ name: '', color: 'blue', icon: 'Pin' });
    } else if (placingPoi) {
      onStopPlacingPoi && onStopPlacingPoi();
    }
    // eslint-disable-next-line
  }, [mode]);

  const labelCls = `text-[12px] font-medium mb-1.5 ${dark ? 'text-neutral-300' : 'text-neutral-700'}`;

  return (
    <div className={`px-4 pt-4 pb-6 ${dark ? 'bg-neutral-950' : 'bg-white'}`}>
      {/* Existing POIs list */}
      {pois && pois.length > 0 && (
        <div className="mb-4">
          <label className={labelCls}>Points d'intérêt ajoutés</label>
          <div className={`rounded-lg border ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
            {pois.map((p, i) => (
              <PoiListItem
                key={p.id}
                poi={p}
                isLast={i === pois.length - 1}
                dark={dark}
                accent={accent}
                onRename={(name) => onUpdatePoi && onUpdatePoi(p.id, { name })}
                onUpdate={(patch) => onUpdatePoi && onUpdatePoi(p.id, patch)}
                onRemove={() => onRemovePoi && onRemovePoi(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      <label className={labelCls}>Repères</label>
      <div className="flex flex-col gap-1.5">
        {/* Repère personnalisé — accordion */}
        <ExpandableCard
          dark={dark} accent={accent}
          icon={<I.Flag size={16} />}
          title="Repère personnalisé"
          subtitle="Cliquez sur le tracé pour placer un marqueur."
          open={mode === 'custom'}
          onToggle={() => setMode(mode === 'custom' ? null : 'custom')}
        >
          {placingPoi && (
            <CustomPoiForm
              dark={dark}
              accent={accent}
              template={placingPoi}
              onChange={onUpdatePlacingPoi}
            />
          )}
        </ExpandableCard>

        {/* Points d'intérêt — accordion */}
        <ExpandableCard
          dark={dark} accent={accent}
          icon={<I.Search size={16} />}
          title="Points d'intérêt"
          subtitle="Pharmacies, points d'eau, parkings… dans un rayon de 2 km."
          open={mode === 'osm'}
          onToggle={() => setMode(mode === 'osm' ? null : 'osm')}
        >
          <NearbyPoiList
            dark={dark} accent={accent} pois={pois}
            onPick={(item) => {
              const meta = POI_TYPE_META[item.type] || { icon: 'Pin', color: 'blue' };
              onAddPoi && onAddPoi({
                id: 'poi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                name: item.name, color: meta.color, icon: meta.icon,
                osmType: item.type, type: 'osm',
              });
            }}
          />
        </ExpandableCard>
      </div>

      {(!pois || pois.length === 0) && !mode && (
        <p className={`mt-3 text-[11.5px] leading-relaxed ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
          Cette étape est optionnelle. Validez pour enregistrer votre itinéraire sans points d'intérêt.
        </p>
      )}
    </div>
  );
}

function PoiListItem({ poi, isLast, dark, accent, onRename, onRemove, onUpdate }) {
  const [renaming, setRenaming] = useCreateState(false);
  const [draft, setDraft] = useCreateState(poi.name);
  const [pickerOpen, setPickerOpen] = useCreateState(false);
  const [pickerPos, setPickerPos] = useCreateState(null);
  const inputRef = useCreateRef(null);
  const swatchRef = useCreateRef(null);
  useCreateEffect(() => { setDraft(poi.name); }, [poi.name]);
  useCreateEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const openPicker = () => {
    if (swatchRef.current) {
      const r = swatchRef.current.getBoundingClientRect();
      const POP_W = 200;
      const POP_H = 220;
      let top = r.bottom + 6;
      if (top + POP_H > window.innerHeight - 8) top = r.top - POP_H - 6;
      let left = r.left;
      if (left + POP_W > window.innerWidth - 8) left = window.innerWidth - POP_W - 8;
      setPickerPos({ top, left });
    }
    setPickerOpen((o) => !o);
  };

  useCreateEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      const pop = e.target.closest && e.target.closest('[data-poi-picker]');
      if (pop) return;
      if (swatchRef.current && swatchRef.current.contains(e.target)) return;
      setPickerOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== poi.name) onRename && onRename(next);
    else setDraft(poi.name);
    setRenaming(false);
  };
  const cancel = () => { setDraft(poi.name); setRenaming(false); };
  // Filter-derived POIs (parking, water, …) carry an `iconKey`/`catColor`; resolve
  // their category icon so the list mirrors the map markers. Custom markers use poi.icon.
  const filterMeta = poi.iconKey && (window.POI_FILTER_TYPES || []).find((t) => t.key === poi.iconKey);
  const Ic = filterMeta ? (I[filterMeta.icon] || I.Pin) : (I[poi.icon] || I.Pin);
  const cHex = poi.iconKey ? (poi.catColor || ROUTE_COLORS[poi.color]?.hex || accent) : (ROUTE_COLORS[poi.color]?.hex || accent);

  return (
    <div className={`group flex items-center gap-2.5 px-2.5 py-2 ${!isLast ? (dark ? 'border-b border-neutral-800' : 'border-b border-neutral-100') : ''}`}>
      <button
        ref={swatchRef}
        onClick={openPicker}
        className="w-7 h-7 rounded-full grid place-items-center shrink-0 transition-transform hover:scale-110"
        style={{ background: cHex, color: '#fff' }}
        title="Modifier la couleur et l'icône"
      >
        <Ic size={13} />
      </button>
      {pickerOpen && pickerPos && ReactDOM.createPortal(
        (
          <div
            data-poi-picker
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 9999, width: 200 }}
            className={`p-2 rounded-md shadow-2xl animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
          >
            <div className={`text-[10.5px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Couleur</div>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {Object.entries(ROUTE_COLORS).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => onUpdate && onUpdate({ color: key })}
                  className={`w-5 h-5 rounded-full grid place-items-center transition-transform shrink-0 ${poi.color === key ? 'scale-110' : 'hover:scale-105'}`}
                  style={{
                    background: c.hex,
                    boxShadow: poi.color === key ? `0 0 0 1.5px ${dark ? '#0a0a0a' : '#fff'}, 0 0 0 3px ${c.hex}` : 'none',
                  }}
                  title={c.name}
                >
                  {poi.color === key && <I.Check size={9} stroke="white" strokeWidth="3" />}
                </button>
              ))}
            </div>
            <div className={`text-[10.5px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Icône</div>
            <div className="grid grid-cols-5 gap-1">
              {POI_ICONS.map((key) => {
                const Ii = I[key] || I.Pin;
                const sel = poi.icon === key;
                return (
                  <button
                    key={key}
                    onClick={() => onUpdate && onUpdate({ icon: key })}
                    className={`w-7 h-7 rounded-md grid place-items-center transition-colors ${dark ? (sel ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white') : (sel ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900')}`}
                    style={sel ? { boxShadow: `0 0 0 1.5px ${cHex}` } : undefined}
                    title={POI_ICON_LABELS[key]}
                  >
                    <Ii size={13} />
                  </button>
                );
              })}
            </div>
          </div>
        ),
        document.body
      )}
      {renaming ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          className={`flex-1 min-w-0 text-[12.5px] font-medium bg-transparent outline-none rounded px-1 py-0.5 ring-1 ${dark ? 'text-white ring-neutral-600 bg-neutral-900' : 'text-neutral-900 ring-neutral-300 bg-white'}`}
        />
      ) : (
        <span
          onDoubleClick={(e) => { e.stopPropagation(); setRenaming(true); }}
          title="Double-cliquez pour renommer"
          className={`flex-1 text-[12.5px] font-medium truncate select-none ${dark ? 'text-white' : 'text-neutral-900'}`}
        >{poi.name}</span>
      )}
      <button
        onClick={onRemove}
        className={`p-1 rounded transition-colors ${dark ? 'text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10' : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50'}`}
        title="Supprimer ce point d'intérêt"
      >
        <I.Trash size={13} />
      </button>
    </div>
  );
}

function ExpandableCard({ icon, title, subtitle, open, onToggle, children, dark, accent }) {
  return (
    <div className={`rounded-lg border transition-colors ${dark ? (open ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-900 border-neutral-800') : (open ? 'bg-white border-neutral-300' : 'bg-white border-neutral-200')}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left"
      >
        <span
          className="w-9 h-9 rounded-md grid place-items-center shrink-0"
          style={{ background: accent + '22', color: accent }}
        >
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>{title}</div>
          <div className={`text-[11.5px] mt-0.5 leading-snug ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{subtitle}</div>
        </span>
        <I.ChevronDown size={15} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
      </button>
      {open && (
        <div className={`px-3 pb-3 pt-1 ${dark ? 'border-t border-neutral-800' : 'border-t border-neutral-200/70'}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function CustomPoiForm({ dark, accent, template, onChange }) {
  const name = template?.name || '';
  const color = template?.color || 'blue';
  const icon = template?.icon || 'Pin';
  const labelCls = `text-[12px] font-medium mb-1 ${dark ? 'text-neutral-300' : 'text-neutral-700'}`;
  const inputCls = `w-full rounded-lg border outline-none transition-all text-[13px] px-3 py-2 ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600' : 'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400'}`;
  return (
    <div className="mt-2">
      <div className={`text-[11.5px] mb-3 leading-snug px-2.5 py-2 rounded-md ${dark ? 'bg-neutral-800/60 text-neutral-300' : 'bg-blue-50 text-blue-800'}`}>
        Cliquez sur la carte pour placer ce repère sur votre tracé.
      </div>
      <div className="mb-3">
        <label className={labelCls}>Nom <span className={`text-[10.5px] font-normal ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>(optionnel)</span></label>
        <input value={name} onChange={(e) => onChange && onChange({ name: e.target.value })} placeholder="Ex. Refuge" className={inputCls} />
      </div>
      <div className="mb-3">
        <label className={labelCls}>Couleur</label>
        <div className="flex items-center gap-1.5">
          {Object.entries(ROUTE_COLORS).slice(0, 10).map(([key, c]) => (
            <button
              key={key}
              onClick={() => onChange && onChange({ color: key })}
              className={`w-5 h-5 rounded-full grid place-items-center transition-transform shrink-0 ${color === key ? 'scale-110' : 'hover:scale-105'}`}
              style={{
                background: c.hex,
                boxShadow: color === key ? `0 0 0 1.5px ${dark ? '#0a0a0a' : '#fff'}, 0 0 0 3px ${c.hex}` : 'none',
              }}
              title={c.name}
            >
              {color === key && <I.Check size={9} stroke="white" strokeWidth="3" />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Icône</label>
        <div className="grid grid-cols-4 gap-1.5">
          {POI_ICONS.map((key) => {
            const Ic = I[key] || I.Pin;
            const sel = icon === key;
            return (
              <button
                key={key}
                onClick={() => onChange && onChange({ icon: key })}
                className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] transition-all ${dark ? (sel ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700') : (sel ? 'bg-white border-neutral-300 text-neutral-900' : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300')}`}
                style={sel ? { boxShadow: `0 0 0 2px ${accent}33`, borderColor: accent } : undefined}
                title={POI_ICON_LABELS[key]}
              >
                <Ic size={14} />
                <span className="truncate w-full text-center">{POI_ICON_LABELS[key]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NearbyPoiList({ dark, accent, pois, onPick }) {
  const addedNames = new Set((pois || []).map((p) => p.name));
  const available = MOCK_NEARBY.filter((p) => !addedNames.has(p.name));
  return (
    <div className="mt-2">
      <div className={`text-[11.5px] mb-2 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
        À proximité de votre tracé (2 km)
      </div>
      <div className={`rounded-lg border overflow-hidden ${dark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
        {available.length === 0 ? (
          <div className={`text-[11.5px] py-4 text-center ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Aucun nouveau point d'intérêt à proximité.</div>
        ) : available.map((item, i) => {
          const meta = POI_TYPE_META[item.type] || { icon: 'Pin', color: 'blue' };
          const Ic = I[meta.icon] || I.Pin;
          const cHex = ROUTE_COLORS[meta.color]?.hex || accent;
          return (
            <button
              key={item.id}
              onClick={() => onPick && onPick(item)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors ${i < available.length - 1 ? (dark ? 'border-b border-neutral-800' : 'border-b border-neutral-100') : ''} ${dark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-50'}`}
            >
              <span className="w-7 h-7 rounded-full grid place-items-center shrink-0" style={{ background: cHex, color: '#fff' }}>
                <Ic size={13} />
              </span>
              <span className="flex-1 min-w-0">
                <div className={`text-[12.5px] font-medium truncate ${dark ? 'text-white' : 'text-neutral-900'}`}>{item.name}</div>
                <div className={`text-[10.5px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  {item.distance.toFixed(1)} km du tracé
                </div>
              </span>
              <I.Plus size={13} strokeWidth="2.4" className={dark ? 'text-neutral-500' : 'text-neutral-400'} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TraceStat({ dark, icon, label, value }) {
  return (
    <div className={`rounded-lg border p-2 ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
        {icon} <span>{label}</span>
      </div>
      <div className={`text-[13px] font-semibold tabular-nums mt-0.5 ${dark ? 'text-white' : 'text-neutral-900'}`}>{value}</div>
    </div>
  );
}

window.CreatePanel = CreatePanel;
window.ActivityDropdown = ActivityDropdown;

// Floating, draggable card shown OVER the map while placing a custom marker.
// Closable + movable; the user clicks the map once to drop the marker.
function FloatingPoiCard({ dark, accent, template, onChange, onClose }) {
  const [pos, setPos] = useCreateState({ x: null, y: null });
  const dragRef = useCreateRef(null);
  const startDrag = (e) => {
    const ev = e.touches ? e.touches[0] : e;
    const card = dragRef.current;
    const rect = card.getBoundingClientRect();
    const offX = ev.clientX - rect.left;
    const offY = ev.clientY - rect.top;
    const move = (m) => {
      const mv = m.touches ? m.touches[0] : m;
      setPos({ x: mv.clientX - offX, y: mv.clientY - offY });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };
  const style = pos.x == null
    ? { left: 16, top: 72 }
    : { left: pos.x, top: pos.y };
  return (
    <div
      ref={dragRef}
      className={`absolute z-[650] w-[300px] rounded-xl shadow-2xl overflow-hidden ${dark ? 'bg-neutral-900 border border-neutral-700/60' : 'bg-white border border-neutral-200/80'}`}
      style={style}
    >
      {/* Drag handle / header */}
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        className={`px-3.5 py-2.5 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none ${dark ? 'border-b border-neutral-800' : 'border-b border-neutral-100'}`}
      >
        <I.Drag size={14} className={dark ? 'text-neutral-500' : 'text-neutral-400'} />
        <span className={`flex-1 text-[13px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>Nouveau repère</span>
        <button
          onClick={onClose}
          className={`p-1 -mr-1 rounded transition-colors ${dark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`}
          title="Fermer"
        >
          <I.X size={14} />
        </button>
      </div>
      <div className="px-3.5 pb-3.5">
        <CustomPoiForm dark={dark} accent={accent} template={template} onChange={onChange} />
      </div>
    </div>
  );
}

window.FloatingPoiCard = FloatingPoiCard;
window.CustomPoiForm = CustomPoiForm;
