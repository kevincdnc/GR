// Sidebar: accordion groups + itineraries
// - Eye toggle per item AND per group (group eye toggles all children)
// - Drag & drop to reorder itineraries within/across groups
// - Inline rename, delete, more menu

const { useState, useRef, useEffect } = React;

function Sidebar({
  groups, setGroups, visibleIds, setVisibleIds, hoveredId, setHoveredId,
  selectedId, setSelectedId, multiSel, setMultiSel, dark, accent, density,
  onCreate, onImport, onPoster, onSuggest, onCreateGroup, onDrawZone, onAction, forceCreateMenu,
  view, onViewChange
}) {
  const [drag, setDrag] = useState(null); // {itineraryId, fromGroupId}
  const [dragOver, setDragOver] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const filtered = groups;
  // Onboarding can force the CTA dropdown open.
  const ctaOpen = menuOpen || forceCreateMenu;

  // --- Sélection multiple (Maj+clic : plage, Cmd/Ctrl+clic : ajout/retrait) ---
  const sel = multiSel || new Set();
  const anchorRef = useRef(null);
  const displayedIds = () => groups.flatMap((g) => (g.ungrouped || g.expanded ? g.itineraries.map((it) => it.id) : []));
  const onMultiClick = (id, e) => {
    if (!setMultiSel) return false;
    if (e.shiftKey && anchorRef.current) {
      const ids = displayedIds();
      const a = ids.indexOf(anchorRef.current), b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
        setMultiSel(new Set(e.metaKey || e.ctrlKey ? [...sel, ...range] : range));
        return true;
      }
    }
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const n = new Set(sel);
      if (n.has(id)) n.delete(id); else n.add(id);
      setMultiSel(n);
      anchorRef.current = id;
      return true;
    }
    // Clic simple : point de départ d'une future plage, sélection effacée
    anchorRef.current = id;
    if (sel.size) setMultiSel(new Set());
    return false;
  };
  // Échap vide la sélection ; ids disparus retirés
  useEffect(() => {
    if (!sel.size) return;
    const onKey = (e) => { if (e.key === 'Escape') setMultiSel(new Set()); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sel.size]);
  useEffect(() => {
    if (!sel.size) return;
    const all = new Set(groups.flatMap((g) => g.itineraries.map((it) => it.id)));
    if ([...sel].some((id) => !all.has(id))) setMultiSel(new Set([...sel].filter((id) => all.has(id))));
  }, [groups]);
  const [bulkColorOpen, setBulkColorOpen] = useState(false);
  const bulkRef = useRef(null);
  useEffect(() => {
    if (!bulkColorOpen) return;
    const onDoc = (e) => { if (bulkRef.current && !bulkRef.current.contains(e.target)) setBulkColorOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [bulkColorOpen]);
  const setBulkColor = (key) => {
    setGroups((gs) => gs.map((g) => ({
      ...g,
      itineraries: g.itineraries.map((it) => (sel.has(it.id)
        ? { ...it, color: key, sections: it.sections ? it.sections.map((sec) => ({ ...sec, color: key })) : it.sections }
        : it)),
    })));
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {if (e.key === 'Escape') setMenuOpen(false);};
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const pick = (fn) => () => {setMenuOpen(false);fn && fn();};

  const toggleGroup = (groupId) => {
    setGroups((gs) => gs.map((g) => g.id === groupId ? { ...g, expanded: !g.expanded } : g));
  };

  const toggleItem = (it) => {
    if (!it.sections) {
      setVisibleIds((s) => {
        const next = new Set(s);
        if (next.has(it.id)) next.delete(it.id);else next.add(it.id);
        return next;
      });
      return;
    }
    // composite: toggle all sections at once
    const sids = it.sections.map((s) => s.id);
    const allVisible = sids.every((id) => visibleIds.has(id));
    setVisibleIds((s) => {
      const next = new Set(s);
      if (allVisible) sids.forEach((id) => next.delete(id));else
      sids.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSection = (sid) => {
    setVisibleIds((s) => {
      const next = new Set(s);
      if (next.has(sid)) next.delete(sid);else next.add(sid);
      return next;
    });
  };

  // 'all' | 'some' | 'none' for an itinerary
  const itineraryVisibilityState = (it) => {
    if (!it.sections) return visibleIds.has(it.id) ? 'all' : 'none';
    const sids = it.sections.map((s) => s.id);
    const v = sids.filter((id) => visibleIds.has(id)).length;
    if (v === 0) return 'none';
    if (v === sids.length) return 'all';
    return 'some';
  };

  // All ids that count toward visibility for an itinerary (used by group toggle)
  const itineraryVisibilityIds = (it) => it.sections ? it.sections.map((s) => s.id) : [it.id];

  const toggleGroupVisibility = (group) => {
    const allIds = group.itineraries.flatMap(itineraryVisibilityIds);
    const allVisible = allIds.length > 0 && allIds.every((id) => visibleIds.has(id));
    setVisibleIds((s) => {
      const next = new Set(s);
      if (allVisible) allIds.forEach((id) => next.delete(id));else
      allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const groupVisibilityState = (group) => {
    const allIds = group.itineraries.flatMap(itineraryVisibilityIds);
    if (allIds.length === 0) return 'none';
    const visible = allIds.filter((id) => visibleIds.has(id)).length;
    if (visible === 0) return 'none';
    if (visible === allIds.length) return 'all';
    return 'some';
  };

  // Glisser-déposer : `dragOver` vaut « groupId|index » (point d'insertion)
  // ou « groupId|head » (en-tête de groupe = ajout à la fin).
  const [justDropped, setJustDropped] = useState(null);
  const handleDrop = (targetGroupId, targetIndex) => {
    if (!drag) return;
    const movedId = drag.itineraryId;
    setGroups((gs) => {
      const newGs = gs.map((g) => ({ ...g, itineraries: [...g.itineraries] }));
      let moved = null, srcGroup = null, srcIdx = -1;
      for (const g of newGs) {
        const idx = g.itineraries.findIndex((i) => i.id === movedId);
        if (idx !== -1) { moved = g.itineraries.splice(idx, 1)[0]; srcGroup = g; srcIdx = idx; break; }
      }
      if (!moved) return gs;
      const target = newGs.find((g) => g.id === targetGroupId);
      if (!target) return gs;
      // Même groupe, vers le bas : l'élément retiré décale les index suivants
      let insertAt = target === srcGroup && srcIdx < targetIndex ? targetIndex - 1 : targetIndex;
      insertAt = Math.max(0, Math.min(insertAt, target.itineraries.length));
      target.itineraries.splice(insertAt, 0, moved);
      if (target !== srcGroup) target.expanded = true;
      return newGs;
    });
    setDrag(null);
    setDragOver(null);
    setJustDropped(movedId);
    setTimeout(() => setJustDropped((id) => (id === movedId ? null : id)), 900);
  };
  // Point d'insertion sans effet (juste avant / après l'élément déplacé)
  const isNoopDrop = (groupId, index) => {
    if (!drag) return true;
    const g = groups.find((x) => x.id === groupId);
    if (!g) return true;
    const src = g.itineraries.findIndex((i) => i.id === drag.itineraryId);
    return src !== -1 && (index === src || index === src + 1);
  };
  // Défilement automatique de la liste près des bords pendant un glisser
  const onListDragOver = (e) => {
    if (!drag) return;
    const el = e.currentTarget, r = el.getBoundingClientRect(), EDGE = 48;
    if (e.clientY < r.top + EDGE) el.scrollTop -= Math.ceil((r.top + EDGE - e.clientY) / 4);
    else if (e.clientY > r.bottom - EDGE) el.scrollTop += Math.ceil((e.clientY - (r.bottom - EDGE)) / 4);
  };

  const rowPad = density === 'compact' ? 'py-1.5' : 'py-2.5';
  const grpPad = density === 'compact' ? 'py-1.5' : 'py-2';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className={`px-4 pt-7 pb-5 flex items-center justify-between`}>
        <div className="flex items-center gap-2" style={{ gap: "8px" }}>
          <div className="leading-tight pl-1">
            <RoutdoorLogo dark={dark} height={24} />
          </div>
        </div>
      </div>

      {/* Carte / Statistiques — sous le logo, toute la largeur */}
      {onViewChange && (
        <div className="px-4 pt-1 pb-1.5">
          <div role="tablist" aria-label="Vue" className={`flex p-[3px] rounded-md border ${dark ? 'bg-black/25 border-white/10' : 'bg-white/50 border-neutral-200/70'}`}>
            {[{ value: 'map', label: 'Carte', icon: <I.MapGrid size={14} /> }, { value: 'metrics', label: 'Stats', icon: <I.TrendUp01 size={14} /> }].map((o) => {
              const sel = view === o.value;
              return (
                <button key={o.value} role="tab" aria-selected={sel} onClick={() => onViewChange(o.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-[4px] text-[12.5px] font-medium py-[5px] transition-colors ${sel ? (dark ? 'bg-white/15 text-white' : 'bg-white text-neutral-900 shadow-sm') : (dark ? 'text-neutral-300 hover:text-white hover:bg-white/5' : 'text-neutral-600 hover:text-neutral-900')}`}>
                  {o.icon}{o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section label */}
      <div className="px-4 pt-4 pb-1 flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Mes routes</span>
        <div className="flex items-center gap-0.5">
          <Tooltip dark={dark} label="Nouveau groupe" sub="Ranger vos itinéraires dans un dossier">
            <button
              onClick={onCreateGroup}
              className={`p-1 rounded transition-colors ${dark ? 'text-neutral-300 hover:text-white hover:bg-neutral-800' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}`}>
              
              <I.Plus size={16} strokeWidth="2.4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 sb-scroll" onDragOver={onListDragOver}>
        {filtered.map((group) => {
          const vState = groupVisibilityState(group);
          // Ungrouped bucket — render itineraries directly without a header.
          if (group.ungrouped) {
            return (
              <div key={group.id} className="mb-1">
                {group.itineraries.map((it, idx) =>
                  <ItineraryRow
                    setGroups={setGroups}
                    key={it.id}
                    it={it}
                    idx={idx}
                    groupId={group.id}
                    visState={itineraryVisibilityState(it)}
                    onToggleVisible={() => toggleItem(it)}
                    visibleIds={visibleIds}
                    onToggleSection={toggleSection}
                    selected={selectedId === it.id}
                    onSelect={() => setSelectedId(selectedId === it.id ? null : it.id)}
                    onHover={setHoveredId}
                    hoveredId={hoveredId}
                    onAction={onAction}
                    dark={dark}
                    accent={accent}
                    rowPad={rowPad}
                    drag={drag}
                    setDrag={setDrag}
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                    handleDrop={handleDrop}
                    isNoopDrop={isNoopDrop}
                    isLast={idx === group.itineraries.length - 1}
                    justDropped={justDropped === it.id}
                    multiSelected={sel.has(it.id)}
                    onMultiClick={onMultiClick} />
                )}
                {/* Visual divider between ungrouped and first group */}
                {filtered.length > 1 && (
                  <div className={`mx-2 my-1.5 h-px ${dark ? 'bg-neutral-800' : 'bg-neutral-200'}`}></div>
                )}
              </div>
            );
          }
          return (
            <div key={group.id} className="mb-0.5">
              <GroupHeader
                group={group}
                vState={vState}
                dark={dark}
                accent={accent}
                grpPad={grpPad}
                drag={drag}
                dragOver={dragOver}
                setDragOver={setDragOver}
                handleDrop={handleDrop}
                onToggleExpand={() => toggleGroup(group.id)}
                onToggleVisibility={() => toggleGroupVisibility(group)}
                onSetEmoji={(emoji) => {
                  setGroups((gs) => gs.map((g) => g.id === group.id ? { ...g, emoji: emoji || undefined } : g));
                }}
                onRename={(next) => {
                  setGroups((gs) => gs.map((g) => g.id === group.id ? { ...g, name: next } : g));
                }}
                onDelete={(g) => onAction && onAction('deleteGroup', { group: g })}
                onShare={(g) => onAction && onAction('share', { group: g })}
                onClearNewlyCreated={(gid) => {
                  setGroups((gs) => gs.map((g) => g.id === gid ? { ...g, __newlyCreated: false } : g));
                }} />
              

              {group.expanded &&
              <div className="mt-0.5 mb-1 relative">
                  {group.itineraries.length === 0 ?
                <div
                  onDragOver={(e) => { if (drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== group.id + '|0') setDragOver(group.id + '|0'); } }}
                  onDrop={(e) => { e.preventDefault(); handleDrop(group.id, 0); }}
                  className={`text-[11px] py-2 px-2 rounded-lg border border-dashed transition-colors ${drag && dragOver === group.id + '|0' ? 'border-blue-500/70 bg-blue-500/10 text-blue-400' : drag ? (dark ? 'border-neutral-700 text-neutral-500' : 'border-neutral-300 text-neutral-400') : 'border-transparent ' + (dark ? 'text-neutral-500' : 'text-neutral-400')}`}>
                  {drag ? 'Déposer ici' : 'Aucun itinéraire'}
                </div> :

                group.itineraries.map((it, idx) =>
                <ItineraryRow
                    setGroups={setGroups}
                  key={it.id}
                  it={it}
                  idx={idx}
                  groupId={group.id}
                  visState={itineraryVisibilityState(it)}
                  onToggleVisible={() => toggleItem(it)}
                  visibleIds={visibleIds}
                  onToggleSection={toggleSection}
                  selected={selectedId === it.id}
                  onSelect={() => setSelectedId(selectedId === it.id ? null : it.id)}
                  onHover={setHoveredId}
                  hoveredId={hoveredId}
                  onAction={onAction}
                  dark={dark}
                  accent={accent}
                  rowPad={rowPad}
                  drag={drag}
                  setDrag={setDrag}
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  handleDrop={handleDrop}
                  isNoopDrop={isNoopDrop}
                  isLast={idx === group.itineraries.length - 1}
                  justDropped={justDropped === it.id}
                  multiSelected={sel.has(it.id)}
                  onMultiClick={onMultiClick} />

                )
                }
                </div>
              }
            </div>);

        })}
        {filtered.length === 0 &&
        <EmptyStateIllustration dark={dark} accent={accent} onOpenMenu={() => setMenuOpen(true)} />
        }
      </div>

      {/* Barre d'actions de la sélection multiple */}
      {sel.size > 0 && (
        <div className={`mx-3 mb-2 rounded-lg border p-2.5 animate-menu ${dark ? 'bg-neutral-900/90 border-blue-500/40' : 'bg-white border-blue-300'}`}>
          <div className="flex items-center justify-between px-0.5 mb-2">
            <span className={`text-[12px] font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>
              {sel.size} tracé{sel.size > 1 ? 's' : ''} sélectionné{sel.size > 1 ? 's' : ''}
            </span>
            <button onClick={() => setMultiSel(new Set())} title="Désélectionner (Échap)"
              className={`p-1 rounded transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-500 hover:bg-neutral-100'}`}>
              <I.X size={13} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="relative" ref={bulkRef}>
              <button onClick={() => setBulkColorOpen((o) => !o)}
                className={`w-full flex flex-col items-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${dark ? 'text-neutral-200 hover:bg-white/10' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <span className="w-4 h-4 rounded-full" style={{ background: 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)' }}></span>
                Couleur
              </button>
              {bulkColorOpen && (
                <div className="absolute left-0 bottom-full mb-1.5 z-40 w-[194px] p-2 rounded-md shadow-2xl animate-menu glass-strong">
                  <div className={`text-[10px] font-semibold uppercase tracking-wider px-0.5 pb-1.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Couleur des tracés</div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Object.entries(ROUTE_COLORS).map(([key, c]) => (
                      <button key={key} title={c.name} onClick={() => { setBulkColor(key); setBulkColorOpen(false); }}
                        className="w-6 h-6 rounded-full transition-transform hover:scale-110" style={{ background: c.hex }}></button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => onAction && onAction('mergeItins', { ids: sel })} disabled={sel.size < 2}
              title={sel.size < 2 ? 'Sélectionnez au moins 2 tracés' : 'Enchaîner les tracés sélectionnés en un seul'}
              className={`flex flex-col items-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${dark ? 'text-neutral-200 hover:bg-white/10' : 'text-neutral-700 hover:bg-neutral-100'}`}>
              <I.Merge size={16} />
              Fusionner
            </button>
            <button onClick={() => onAction && onAction('duplicateItins', { ids: sel })}
              className={`flex flex-col items-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${dark ? 'text-neutral-200 hover:bg-white/10' : 'text-neutral-700 hover:bg-neutral-100'}`}>
              <I.Copy size={16} />
              Dupliquer
            </button>
          </div>
        </div>
      )}

      {/* Primary action — dropdown CTA, en bas de la navigation (menu vers le haut) */}
      <div className={`px-4 pt-3 pb-3 relative border-t ${dark ? 'border-neutral-800' : 'border-neutral-200'}`} ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          data-onboard="cta"
          className={`btn-cta-primary w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:shadow active:scale-[0.99] ${menuOpen ? 'shadow-md' : ''}`}
          style={{ background: accent }}
          aria-haspopup="menu"
          aria-expanded={ctaOpen}>
          
          <I.Plus size={16} stroke="white" strokeWidth="2.4" />
          Créer ou importer un itinéraire
          <I.ChevronDown
            size={14}
            stroke="white"
            strokeWidth="2.4"
            className={`ml-0.5 transition-transform ${ctaOpen ? '' : 'rotate-180'}`} />
          
        </button>

        {ctaOpen &&
        <div
          role="menu"
          className={`absolute left-4 right-4 bottom-full mb-1.5 z-30 rounded-md shadow-2xl overflow-hidden origin-bottom animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}>
          
            <MenuItem
            dark={dark} accent={accent}
            icon={<I.Edit size={16} />}
            title="Créer un itinéraire"
            desc="Tracer point par point sur la carte"
            onClick={pick(onCreate)} />
          
            <MenuDivider dark={dark} />
            <MenuItem
            dark={dark} accent={accent}
            icon={<I.Upload size={16} />}
            title="Importer un tracé"
            desc="GPX, FIT, TCX, KML, GeoJSON…"
            onClick={pick(onImport)} />
            {onPoster && <MenuDivider dark={dark} />}
            {onPoster && <MenuItem
            dark={dark} accent={accent}
            icon={<I.Poster size={16} />}
            title="Créer un poster"
            desc="Imprime ton trek, run ou road trip"
            onClick={pick(onPoster)} />}

          
          </div>
        }
      </div>

    </div>);

}

function ItineraryRow({
  it, idx, groupId, visState, onToggleVisible, visibleIds, onToggleSection,
  selected, onSelect, onHover, hoveredId, onAction, setGroups,
  dark, accent, rowPad, drag, setDrag, dragOver, setDragOver, handleDrop, isNoopDrop, isLast, justDropped,
  multiSelected, onMultiClick
}) {
  const Icon = I[ACTIVITIES[it.activity].icon] || I.Route;
  const color = ROUTE_COLORS[it.color].hex;
  const isDragging = drag && drag.itineraryId === it.id;
  // Insertion avant (moitié haute) ou après (moitié basse) cette ligne
  const onRowDragOver = (e) => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    const key = groupId + '|' + (e.clientY < r.top + r.height / 2 ? idx : idx + 1);
    if (dragOver !== key) setDragOver(key);
  };
  const onRowDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const m = /\|(\d+)$/.exec(dragOver || '');
    handleDrop(groupId, m ? Number(m[1]) : idx);
  };
  const lineBefore = !!drag && dragOver === groupId + '|' + idx && !isNoopDrop(groupId, idx);
  const lineAfter = !!drag && isLast && dragOver === groupId + '|' + (idx + 1) && !isNoopDrop(groupId, idx + 1);
  const stats = itineraryStats(it);
  const visible = visState !== 'none';
  const isComposite = stats.isComposite;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // Pastille de couleur + sélecteur de couleur du tracé
  // Survol (depuis la navigation ou depuis le tracé sur la carte)
  const isHovered = !!hoveredId && (hoveredId === it.id || (it.sections || []).some((sec) => sec.id === hoveredId));
  const rowRef = useRef(null);
  useEffect(() => {
    // Tracé survolé sur la carte : on fait apparaître sa ligne dans la navigation
    if (isHovered && rowRef.current && !rowRef.current.matches(':hover')) {
      try { rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }
  }, [isHovered]);
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef(null);
  useEffect(() => {
    if (!colorOpen) return;
    const onDoc = (e) => { if (colorRef.current && !colorRef.current.contains(e.target)) setColorOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setColorOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [colorOpen]);
  const setColor = (key) => {
    setGroups((gs) => gs.map((g) => ({ ...g, itineraries: g.itineraries.map((x) => x.id === it.id ? { ...x, color: key } : x) })));
    setColorOpen(false);
  };
  // Inline rename
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(it.name);
  const renameInputRef = useRef(null);
  useEffect(() => { setRenameDraft(it.name); }, [it.name]);
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);
  const commitRename = () => {
    const next = renameDraft.trim();
    if (next && next !== it.name && onAction) {
      onAction('renameInline', { itinerary: it, name: next, groupId });
    }
    setRenaming(false);
  };
  const cancelRename = () => { setRenameDraft(it.name); setRenaming(false); };

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);};
    const onKey = (e) => {if (e.key === 'Escape') setMenuOpen(false);};
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const EyeIcon = visState === 'all' ? I.Eye : visState === 'some' ? null : I.EyeOff;
  // expanded state only meaningful for composites: clicking the row toggles section list
  const expanded = isComposite && selected;

  const handleRowClick = (e) => {
    if (onMultiClick && onMultiClick(it.id, e)) return;
    if (isComposite) onSelect();
  };

  return (
    <>
      <div onDragOver={onRowDragOver} onDrop={onRowDrop}
        className={`relative rounded-lg transition-all duration-150 ${isDragging ? 'opacity-30 scale-[0.98]' : ''} ${justDropped ? 'drop-flash' : ''}`}>
        {/* Ligne d'insertion */}
        {(lineBefore || lineAfter) && (
          <div className={`absolute left-1 right-1 z-20 pointer-events-none ${lineBefore ? '-top-[3px]' : '-bottom-[3px]'}`}>
            <div className="relative h-[2px] rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)]">
              <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
          </div>
        )}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', it.name); } catch (err) {}
            try { e.dataTransfer.setDragImage(e.currentTarget, 24, e.currentTarget.offsetHeight / 2); } catch (err) {}
            onHover(null);
            // Après la capture de l'image de glisser, sinon le style « fantôme » s'y retrouve
            requestAnimationFrame(() => setDrag({ itineraryId: it.id, fromGroupId: groupId }));
          }}
          onDragEnd={() => {setDrag(null);setDragOver(null);}}
          ref={rowRef}
          onMouseEnter={() => { if (!drag) onHover(it.id); }}
          onMouseLeave={() => onHover(null)}
          onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); /* pas de sélection de texte */ }}
          className={`group relative flex items-center gap-2 ${rowPad} pl-3.5 pr-2 rounded-lg select-none ${isComposite ? 'cursor-pointer' : ''} transition-colors ${multiSelected ? (dark ? 'bg-blue-500/15 ring-1 ring-inset ring-blue-500/60' : 'bg-blue-50 ring-1 ring-inset ring-blue-400') : (dark ? 'hover:bg-neutral-800/70' : 'hover:bg-neutral-100')} ${multiSelected ? '' : isHovered ? (dark ? 'bg-neutral-800/70' : 'bg-neutral-100') : visible ? (dark ? 'bg-neutral-800/40' : 'bg-neutral-50/60') : ''}`}
          onClick={handleRowClick}>
          
          {/* Drag handle */}
          <div className={`opacity-0 group-hover:opacity-100 transition-opacity -ml-1 touch-hidden ${dark ? 'text-neutral-500' : 'text-neutral-400'} cursor-grab active:cursor-grabbing`}>
            <I.Drag size={14} />
          </div>

          {/* Pastille : couleur du tracé, clic = changer la couleur */}
          <div className="relative shrink-0" ref={colorRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setColorOpen((o) => !o); }}
              title="Couleur du tracé"
              aria-label="Changer la couleur du tracé"
              aria-expanded={colorOpen}
              className={`w-5 h-5 grid place-items-center rounded-full transition-colors ${dark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200'}`}>
              <span className="block w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 0 2px ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, opacity: visible ? 1 : 0.5 }}></span>
            </button>
            {colorOpen && (
              <div onClick={(e) => e.stopPropagation()}
                className={`absolute left-0 top-full mt-1.5 z-40 w-[194px] p-2 rounded-md shadow-2xl animate-menu glass-strong`}>
                <div className={`text-[10px] font-semibold uppercase tracking-wider px-0.5 pb-1.5 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Couleur du tracé</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {Object.entries(ROUTE_COLORS).map(([key, c]) => (
                    <button key={key} onClick={() => setColor(key)} title={c.name}
                      className="w-6 h-6 rounded-full grid place-items-center transition-transform hover:scale-110"
                      style={{ background: c.hex, boxShadow: it.color === key ? `0 0 0 2px ${dark ? '#171717' : '#fff'}, 0 0 0 3.5px ${c.hex}` : 'none' }}>
                      {it.color === key && <I.Check size={12} stroke="white" strokeWidth="3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {renaming ? (
                <input
                  ref={renameInputRef}
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                  }}
                  className={`flex-1 min-w-0 text-[13px] font-medium bg-transparent outline-none rounded px-1 py-0.5 ring-1 ${dark ? 'text-white ring-neutral-600 bg-neutral-900' : 'text-neutral-900 ring-neutral-300 bg-white'}`}
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); setRenaming(true); }}
                  title="Double-cliquez pour renommer"
                  className={`text-[13px] font-medium truncate select-none ${visible ? dark ? 'text-white' : 'text-neutral-900' : dark ? 'text-neutral-400' : 'text-neutral-600'}`}
                >{it.name}</span>
              )}
              {isComposite && !renaming &&
              <I.ChevronDown
                size={12}
                className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''} ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />

              }
            </div>
            <div className={`flex items-center gap-1.5 mt-0.5 text-[11px] tabular-nums whitespace-nowrap overflow-hidden ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
              <span>{stats.distance.toFixed(1)} km</span>
              <span className={`w-1 h-1 rounded-full shrink-0 ${dark ? 'bg-neutral-700' : 'bg-neutral-300'}`}></span>
              <span>↑ {fmtAscent(stats.ascent)}</span>
              <span className={`w-1 h-1 rounded-full shrink-0 ${dark ? 'bg-neutral-700' : 'bg-neutral-300'}`}></span>
              <span>{stats.sectionCount} sect.</span>
            </div>
          </div>

          {/* Actions menu (...) — 3-dots BEFORE eye, only visible on hover */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {e.stopPropagation();setMenuOpen((o) => !o);}}
              className={`p-1 rounded transition-all ${menuOpen
                ? (dark ? 'opacity-100 text-neutral-100 bg-neutral-700' : 'opacity-100 text-neutral-900 bg-neutral-200')
                : (dark ? 'opacity-0 group-hover:opacity-100 touch-visible text-neutral-500 hover:text-neutral-100 hover:bg-neutral-700' : 'opacity-0 group-hover:opacity-100 touch-visible text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200')
              }`}
              title="Actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}>
              <I.More size={15} />
            </button>
            {menuOpen &&
            <div
              role="menu"
              className={`absolute right-0 top-full mt-1 z-30 w-52 rounded-lg shadow-2xl overflow-hidden animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}>
              
                <PopItem dark={dark} icon={<I.Edit size={13} />} label="Modifier le tracé"
              onClick={() => {setMenuOpen(false);onAction('edit', { itinerary: it, groupId });}} />
                <PopItem dark={dark} icon={<I.Share size={13} />} label="Partager"
              onClick={() => {setMenuOpen(false);onAction('share', { itinerary: it });}} />
                <PopItem dark={dark} icon={<I.Download size={13} />} label="Exporter en GPX"
              onClick={() => {setMenuOpen(false);onAction('export', { itinerary: it });}} />
                <PopItem dark={dark} icon={<I.Folder size={13} />} label="Déplacer vers…"
              onClick={() => {setMenuOpen(false);onAction('move', { itinerary: it, groupId });}} />
                <PopItem dark={dark} icon={<I.Pin size={13} />} label="Renommer"
              onClick={() => {setMenuOpen(false);onAction('rename', { itinerary: it });}} />
                <div className={`h-px mx-2 my-1 ${dark ? 'bg-neutral-800' : 'bg-neutral-100'}`}></div>
                <PopItem dark={dark} icon={<I.Trash size={13} />} label="Supprimer" danger
              onClick={() => {setMenuOpen(false);onAction('delete', { itinerary: it, groupId });}} />
              </div>
            }
          </div>

          {/* Visibility — always rendered so it stays aligned across rows */}
          <button
            onClick={(e) => {e.stopPropagation();onToggleVisible();}}
            className={`shrink-0 p-1 rounded transition-colors ${dark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200'}`}
            style={{ color: visible ? (dark ? '#d4d4d4' : '#525252') : dark ? '#525252' : '#a3a3a3' }}
            title={visState === 'all' ? 'Masquer de la carte' : 'Afficher sur la carte'}>
            
            {EyeIcon ? <EyeIcon size={15} /> : <EyeMix dark={dark} />}
          </button>
        </div>

        {/* Sections list (composite only, when expanded) */}
        {expanded &&
        <div className="px-2 pb-2 pt-1">
            <div className="ml-1 pl-2.5 relative">
              <div className="absolute left-0 top-1 bottom-1 w-px" style={{ background: color + '55' }}></div>
              {it.sections.map((s) =>
            <SectionRow
              key={s.id}
              section={s}
              parentColor={color}
              visible={visibleIds.has(s.id)}
              onToggle={() => onToggleSection(s.id)}
              onHover={onHover}
              hoveredId={hoveredId}
              onAction={onAction}
              parent={it}
              dark={dark} />

            )}
            </div>
          </div>
        }
      </div>
    </>);

}

function SectionRow({ section, parentColor, visible, onToggle, onHover, hoveredId, onAction, parent, dark }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // Prefer the section's own color when present, falling back to the parent's.
  const sectionColor = section.color ? (ROUTE_COLORS[section.color]?.hex || parentColor) : parentColor;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);};
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div
      onMouseEnter={() => onHover(section.id)}
      onMouseLeave={() => onHover(null)}
      className={`group flex items-center gap-2 pl-2 pr-0 py-1.5 rounded-md transition-colors ${dark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-50'} ${hoveredId === section.id ? (dark ? 'bg-neutral-800/60' : 'bg-neutral-50') : ''}`}>
      
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: visible ? sectionColor : dark ? '#525252' : '#d4d4d4' }}>
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] truncate ${visible ? dark ? 'text-neutral-100' : 'text-neutral-800' : dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{section.name}</div>
        <div className={`flex items-center gap-1.5 mt-px text-[10.5px] tabular-nums ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>
          <span>{section.distance.toFixed(1)} km</span>
          <span className={`w-0.5 h-0.5 rounded-full ${dark ? 'bg-neutral-700' : 'bg-neutral-300'}`}></span>
          <span>↑ {fmtAscent(section.ascent)}</span>
        </div>
      </div>

      {/* Section actions */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {e.stopPropagation();setMenuOpen((o) => !o);}}
          className={`p-1 rounded transition-all opacity-0 group-hover:opacity-100 touch-visible ${dark ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'} ${menuOpen ? 'opacity-100' : ''}`}
          title="Actions">
          
          <I.More size={13} />
        </button>
        {menuOpen &&
        <div
          className={`absolute right-0 top-full mt-1 z-30 w-44 rounded-lg shadow-xl overflow-hidden animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}>
          
            <PopItem dark={dark} icon={<I.Share size={13} />} label="Partager cette section"
          onClick={() => {setMenuOpen(false);onAction('share', { itinerary: parent, section });}} />
            <PopItem dark={dark} icon={<I.Download size={13} />} label="Exporter GPX"
          onClick={() => {setMenuOpen(false);onAction('export', { itinerary: parent, section });}} />
            <PopItem dark={dark} icon={<I.Edit size={13} />} label="Renommer"
          onClick={() => {setMenuOpen(false);onAction('rename', { itinerary: parent, section });}} />
          </div>
        }
      </div>

      <button
        onClick={(e) => {e.stopPropagation();onToggle();}}
        className={`shrink-0 p-1 rounded transition-all ${dark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200'}`}
        style={{ color: visible ? (dark ? '#d4d4d4' : '#525252') : dark ? '#525252' : '#a3a3a3' }}
        title={visible ? 'Masquer cette section' : 'Afficher cette section'}>
        
        {visible ? <I.Eye size={15} /> : <I.EyeOff size={15} />}
      </button>
    </div>);

}

function PopItem({ icon, label, onClick, dark, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition-colors ${danger ? dark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50' : dark ? 'text-neutral-200 hover:bg-neutral-800' : 'text-neutral-800 hover:bg-neutral-50'}`}>
      
      <span className={`shrink-0 ${danger ? '' : dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>);

}

function EyeMix({ dark }) {
  return (
    <div className="relative w-[15px] h-[15px]">
      <I.Eye size={15} />
      <div className={`absolute right-0 bottom-0 w-2 h-2 rounded-full ring-2 ${dark ? 'bg-neutral-200 ring-neutral-900' : 'bg-current ring-white'}`} style={{ background: 'currentColor' }}></div>
    </div>);

}

// Group header — collapsible folder with inline-editable name (double-click).
const COMMON_EMOJIS = [
'🏔️', '⛰️', '🗻', '🏕️', '🌲', '🌳', '🌄', '🌅',
'🥾', '🏃', '🏃‍♀️', '🚴', '🚵', '⛷️', '🏂', '🧗',
'🔥', '⭐', '❤️', '⚡', '✨', '🎯', '🏁', '🏆',
'☀️', '☁️', '🌧️', '❄️', '🌊', '🌀', '🌍', '📍'];

// Icônes proposées pour un groupe (rando, côte, voyage…)
const GROUP_EMOJIS = [
'🚩', '🥾', '🏔️', '⛰️', '🏕️', '⛺', '🌲', '🌿',
'🌊', '🏖️', '🏝️', '⛵', '🐚', '🦀', '🌅', '🌄',
'🧭', '🗺️', '📍', '🏁', '🎯', '🏆', '⭐', '❤️',
'🏃', '🚴', '⛷️', '🧗', '☀️', '🌧️', '❄️', '🔥'];


function GroupHeader({ group, vState, dark, accent, grpPad, drag, dragOver, setDragOver, handleDrop, onToggleExpand, onToggleVisibility, onRename, onSetEmoji, onDelete, onShare, onClearNewlyCreated }) {
  const [editing, setEditing] = useState(false);
  // Icône du groupe : emoji au choix (ou dossier par défaut)
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerRef = useRef(null);
  useEffect(() => {
    if (!iconPickerOpen) return;
    const onDoc = (e) => { if (iconPickerRef.current && !iconPickerRef.current.contains(e.target)) setIconPickerOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setIconPickerOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [iconPickerOpen]);
  const [draft, setDraft] = useState(group.name);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const editRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // If the group was just created via "+ Nouveau groupe", automatically enter
  // edit mode and clear the flag.
  useEffect(() => {
    if (group.__newlyCreated) {
      setEditing(true);
      onClearNewlyCreated && onClearNewlyCreated(group.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.__newlyCreated]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    if (!editing) setEmojiOpen(false);
  }, [editing]);

  // Click outside both input and emoji popover closes editing
  useEffect(() => {
    if (!editing) return;
    const onDoc = (e) => {
      if (editRef.current && editRef.current.contains(e.target)) return;
      commit();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
    // eslint-disable-next-line
  }, [editing, draft]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== group.name) onRename(next);else
    setDraft(group.name);
    setEditing(false);
    setEmojiOpen(false);
  };
  const cancel = () => {
    setDraft(group.name);
    setEditing(false);
    setEmojiOpen(false);
  };

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (!el) {setDraft((d) => d + emoji);return;}
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div
      className={`group flex items-center rounded-lg ${grpPad} px-2 transition-colors ${editing ? '' : 'cursor-pointer'} ${drag && dragOver === group.id + '|head' ? 'ring-2 ring-blue-500/70 ' + (dark ? 'bg-blue-500/10' : 'bg-blue-50') : dark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-100'}`}
      onClick={() => {if (!editing) onToggleExpand();}}
      onDragOver={(e) => {if (drag) {e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== group.id + '|head') setDragOver(group.id + '|head');}}}
      onDrop={(e) => {e.preventDefault();handleDrop(group.id, group.itineraries.length);}}>
      
      <button
        className={`p-0.5 mr-1 transition-transform ${group.expanded ? 'rotate-90' : ''} ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>
        
        <I.ChevronRight size={14} />
      </button>
      <div className="relative mr-2 shrink-0" ref={iconPickerRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setIconPickerOpen((o) => !o); }}
          title="Choisir l'icône du groupe"
          aria-label="Choisir l'icône du groupe"
          className={`w-6 h-6 grid place-items-center rounded-md transition-colors ${iconPickerOpen ? (dark ? 'bg-neutral-700' : 'bg-neutral-200') : (dark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200')} ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          {group.emoji ? <span className="text-[15px] leading-none">{group.emoji}</span> : <I.Folder size={15} />}
        </button>
        {iconPickerOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute z-40 left-0 top-full mt-1 w-[236px] p-1.5 rounded-lg shadow-2xl animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}>
            <div className="flex items-center justify-between px-1.5 py-1">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Icône du groupe</span>
              {group.emoji && (
                <button
                  onClick={() => { onSetEmoji && onSetEmoji(null); setIconPickerOpen(false); }}
                  className={`flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5 transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                  <I.Folder size={12} /> Dossier
                </button>
              )}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {GROUP_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { onSetEmoji && onSetEmoji(e); setIconPickerOpen(false); }}
                  className={`text-[16px] leading-none p-1 rounded-md transition-colors ${group.emoji === e ? (dark ? 'bg-neutral-700' : 'bg-neutral-200') : (dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100')}`}
                  title={e}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {editing ?
      <div ref={editRef} className="relative flex-1 flex items-center min-w-0" onClick={(e) => e.stopPropagation()}>
          <div className={`relative flex-1 flex items-center min-w-0 rounded ring-1 transition-colors ${dark ? 'bg-neutral-900 ring-neutral-600 focus-within:ring-neutral-500' : 'bg-white ring-neutral-300 focus-within:ring-neutral-400'}`}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => {
                if (editRef.current && editRef.current.contains(e.relatedTarget)) return;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {e.preventDefault();commit();} else
                if (e.key === 'Escape') {e.preventDefault();cancel();}
              }}
              className={`flex-1 text-[13px] font-medium bg-transparent outline-none px-1.5 py-0.5 pr-7 min-w-0 ${dark ? 'text-white' : 'text-neutral-900'}`} />
            <button
              ref={emojiBtnRef}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {e.stopPropagation();setEmojiOpen((o) => !o);}}
              className={`absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${emojiOpen ? (dark ? 'text-white' : 'text-neutral-900') : (dark ? 'text-neutral-500 hover:text-neutral-200' : 'text-neutral-400 hover:text-neutral-700')}`}
              title="Ajouter un emoji">
              <I.Smile size={14} />
            </button>
          </div>
          {emojiOpen &&
        <div
          className={`absolute z-40 right-0 top-full mt-1 w-[220px] p-1.5 rounded-md shadow-2xl animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
          onMouseDown={(e) => e.preventDefault()}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-1 ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Emoji</div>
              <div className="grid grid-cols-8 gap-0.5">
                {COMMON_EMOJIS.map((e) =>
            <button
              key={e}
              onClick={(ev) => {ev.stopPropagation();insertEmoji(e);}}
              className={`text-[15px] leading-none p-1 rounded-md transition-colors ${dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}
              title={e}>
              {e}</button>
            )}
              </div>
            </div>
        }
        </div> :

      <span
        className={`flex-1 text-[13px] font-medium truncate select-none transition-opacity ${vState === 'none' ? 'opacity-50' : ''} ${dark ? 'text-neutral-100' : 'text-neutral-800'}`}
        onDoubleClick={(e) => {e.stopPropagation();setEditing(true);}}
        title="Double-cliquez pour renommer">
        {group.name}</span>
      }
      {/* Group actions menu — 3-dots first, only visible on hover */}
      <div className="relative shrink-0 mr-1" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          className={`p-1 rounded transition-all ${menuOpen
            ? (dark ? 'opacity-100 text-neutral-100 bg-neutral-700' : 'opacity-100 text-neutral-900 bg-neutral-200')
            : (dark ? 'opacity-0 group-hover:opacity-100 touch-visible text-neutral-500 hover:text-neutral-100 hover:bg-neutral-700' : 'opacity-0 group-hover:opacity-100 touch-visible text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200')
          }`}
          title="Actions du groupe (renommer, supprimer)"
          aria-haspopup="menu"
          aria-expanded={menuOpen}>
          <I.More size={15} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 top-full mt-1 z-30 w-44 rounded-lg shadow-xl overflow-hidden animate-menu ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}>
            <PopItem dark={dark} icon={<I.Share size={13} />} label="Partager"
              onClick={() => { setMenuOpen(false); onShare && onShare(group); }} />
            <PopItem dark={dark} icon={<I.Edit size={13} />} label="Renommer"
              onClick={() => { setMenuOpen(false); setEditing(true); }} />
            <div className={`h-px mx-2 ${dark ? 'bg-neutral-800' : 'bg-neutral-100'}`}></div>
            <PopItem dark={dark} icon={<I.Trash size={13} />} label="Supprimer le groupe" danger
              onClick={() => { setMenuOpen(false); onDelete && onDelete(group); }} />
          </div>
        )}
      </div>
      {/* Visibility — always visible, aligned */}
      <button
        onClick={(e) => {e.stopPropagation();onToggleVisibility();}}
        className={`shrink-0 p-1 rounded transition-colors ${dark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200'}`}
        title={vState === 'all' ? 'Masquer tout le groupe' : 'Afficher tout le groupe'}
        style={{ color: vState !== 'none' ? (dark ? '#d4d4d4' : '#525252') : (dark ? '#525252' : '#a3a3a3') }}>
        {vState === 'all' ? <I.Eye size={15} /> : vState === 'some' ? <EyeMix dark={dark} /> : <I.EyeOff size={15} />}
      </button>
    </div>);

}

window.Sidebar = Sidebar;
window.Tooltip = Tooltip;

// Empty state for when there are no groups / itineraries yet.
// Shown in place of the groups list — keeps the "Mes routes" header above it.
function EmptyStateIllustration({ dark, accent, onOpenMenu }) {
  return (
    <div className="px-3 pt-10 pb-6 text-center">
      <div className="mx-auto" style={{ maxWidth: 208 }}>
        <div className="mx-auto" style={{ opacity: 0.8, maxWidth: 166 /* 80 % de 208 */ }}>
          <img src={(window.__resources && window.__resources.emptyState) || "assets/empty-state.svg"} alt="" width="100%" style={{ display: 'block' }} aria-hidden="true" />
        </div>

        <div className={`mt-7 text-[14px] font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>
          Aucun itinéraire pour l'instant
        </div>
        <div className={`mt-2 text-[12px] leading-relaxed ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          <button
            onClick={onOpenMenu}
            className="font-medium underline-offset-2 hover:underline transition-colors"
            style={{ color: '#3b82f6' }}
          >Créez</button>
          {' ou '}
          <button
            onClick={onOpenMenu}
            className="font-medium underline-offset-2 hover:underline transition-colors"
            style={{ color: '#3b82f6' }}
          >importez</button>
          {' votre premier itinéraire pour le voir apparaître ici.'}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, title, desc, onClick, dark, accent, badge }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`group w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50'}`}>
      
      <span
        className="w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 transition-colors"
        style={{ background: accent + '18', color: accent }}>
        
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`text-[13px] font-medium ${dark ? 'text-white' : 'text-neutral-900'}`}>{title}</span>
          {badge &&
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded"
            style={{ background: accent + '22', color: accent }}>
            {badge}</span>
          }
        </span>
        <span className={`block text-[11.5px] mt-0.5 leading-snug ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{desc}</span>
      </span>
      <I.ChevronRight size={14} className={`shrink-0 mt-2.5 transition-all opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 ${dark ? 'text-neutral-300' : 'text-neutral-600'}`} />
    </button>);

}

function MenuDivider({ dark }) {
  return <div className={`h-px mx-3 ${dark ? 'bg-neutral-800' : 'bg-neutral-100'}`}></div>;
}

// Custom tooltip — hover-delayed, dark/light aware, supports bottom/top/left/right.
// Uses position: fixed for the popup so it escapes any overflow:hidden ancestor.
function Tooltip({ label, sub, dark, children, delay = 350, side = 'bottom' }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState(null); // { top, left, arrowSide, arrowOffset }
  const wrapRef = useRef(null);
  const tipRef = useRef(null);
  const timer = useRef(null);

  const open = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(true), delay);
  };
  const close = () => {
    clearTimeout(timer.current);
    setShow(false);
  };

  // Compute fixed-position coordinates after the tooltip mounts.
  useEffect(() => {
    if (!show || !tipRef.current || !wrapRef.current) return;
    const PAD = 8;
    const a = wrapRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    let top, left;
    let arrowSide, arrowOffset;
    if (side === 'left') {
      top = a.top + a.height / 2 - t.height / 2;
      left = a.left - t.width - 6;
      arrowSide = 'right';
      arrowOffset = t.height / 2 - 4;
    } else if (side === 'right') {
      top = a.top + a.height / 2 - t.height / 2;
      left = a.right + 6;
      arrowSide = 'left';
      arrowOffset = t.height / 2 - 4;
    } else if (side === 'top') {
      top = a.top - t.height - 6;
      left = a.left + a.width / 2 - t.width / 2;
      arrowSide = 'bottom';
      arrowOffset = t.width / 2 - 4;
    } else {
      // bottom (default)
      top = a.bottom + 6;
      left = a.left + a.width / 2 - t.width / 2;
      arrowSide = 'top';
      arrowOffset = t.width / 2 - 4;
    }
    // Clamp horizontal within viewport for top/bottom
    if (side === 'top' || side === 'bottom') {
      const maxLeft = window.innerWidth - t.width - PAD;
      if (left < PAD) {
        const orig = left;
        left = PAD;
        arrowOffset += orig - left;
      } else if (left > maxLeft) {
        const orig = left;
        left = maxLeft;
        arrowOffset += orig - left;
      }
      arrowOffset = Math.max(8, Math.min(arrowOffset, t.width - 16));
    }
    setPos({ top, left, arrowSide, arrowOffset });
  }, [show, label, sub, side]);

  // Hide if scrolling/resizing while shown
  useEffect(() => {
    if (!show) return;
    const onScroll = () => setShow(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [show]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}>
      {children}
      {show && ReactDOM.createPortal(
        (
        <span
          ref={tipRef}
          role="tooltip"
          style={pos ? { position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 } : { position: 'fixed', visibility: 'hidden', top: 0, left: 0, zIndex: 99999 }}
          className={`pointer-events-none whitespace-nowrap rounded-lg px-2.5 py-1.5 shadow-xl animate-tip-fixed bg-black text-white`}>
          <span className="block text-[11.5px] font-medium leading-tight">{label}</span>
          {sub && <span className="block text-[10.5px] mt-0.5 leading-tight text-neutral-400">{sub}</span>}
          {pos && (
            <span
              className="absolute w-2 h-2 rotate-45 bg-black"
              style={
                pos.arrowSide === 'top'    ? { top: -4, left: pos.arrowOffset } :
                pos.arrowSide === 'bottom' ? { bottom: -4, left: pos.arrowOffset } :
                pos.arrowSide === 'left'   ? { left: -4, top: pos.arrowOffset } :
                                             { right: -4, top: pos.arrowOffset }
              }
              aria-hidden="true">
            </span>
          )}
        </span>
        ), document.body
      )}
    </span>);
}
// Logotype Routdoor (blanc en thème sombre ; les anneaux du tracé sont évidés)
function RoutdoorLogo({ dark, height = 22 }) {
  const hole = dark ? '#000' : '#fff';
  return (
    <svg viewBox="0 0 1237 284" height={height} width={height * 1237 / 284} fill="none" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label="Routdoor" className={`block select-none ${dark ? 'text-white' : 'text-neutral-900'}`}>
      <path d="M1223.27 49.4297H1236.59L1228.14 91.6839H1210.21C1193.05 91.6839 1184.6 98.5982 1180.51 115.5L1165.91 188.228H1120.07L1147.73 49.9419H1178.2L1182.04 64.2827C1193.82 53.7832 1207.14 49.4297 1223.27 49.4297Z" fill={"currentColor"} />
      <path d="M1024.47 192.835C986.314 192.835 957.633 166.971 957.633 129.582C957.633 81.6941 996.558 45.5859 1044.96 45.5859C1083.11 45.5859 1111.8 71.1946 1111.8 108.583C1111.8 156.471 1072.87 192.835 1024.47 192.835ZM1028.82 151.093C1049.82 151.093 1065.96 132.911 1065.96 111.912C1065.96 97.0592 1056.23 87.0719 1040.86 87.0719C1019.61 87.0719 1003.73 105.254 1003.73 126.509C1003.73 141.362 1013.46 151.093 1028.82 151.093Z" fill={"currentColor"} />
      <path d="M857.159 192.835C819.002 192.835 790.32 166.971 790.32 129.582C790.32 81.6941 829.245 45.5859 877.646 45.5859C915.803 45.5859 944.484 71.1946 944.484 108.583C944.484 156.471 905.559 192.835 857.159 192.835ZM861.512 151.093C882.511 151.093 898.645 132.911 898.645 111.912C898.645 97.0592 888.913 87.0719 873.548 87.0719C852.293 87.0719 836.416 105.254 836.416 126.509C836.416 141.362 846.147 151.093 861.512 151.093Z" fill={"currentColor"} />
      <path d="M747.136 0H792.463L754.819 188.223H723.576L719.991 176.699C706.674 186.687 690.797 192.577 674.408 192.577C639.324 192.577 615.508 166.456 615.508 131.372C615.508 83.7401 652.896 45.8394 700.272 45.8394C714.101 45.8394 726.137 50.1929 735.612 57.8755L747.136 0ZM662.372 124.97C662.372 140.847 673.127 151.603 689.517 151.603C709.235 151.603 726.137 134.445 726.137 113.446C726.137 97.5688 715.637 86.5571 698.992 86.5571C679.273 86.5571 662.372 103.971 662.372 124.97Z" fill={"currentColor"} />
      <path d="M608.513 88.6089H573.173C565.234 127.534 564.722 131.119 564.722 133.68C564.722 142.387 570.1 146.997 580.087 146.997H596.989L588.794 188.226H562.929C534.248 188.226 517.346 172.093 517.346 146.484C517.346 138.802 518.627 133.68 527.59 88.6089H501.469L503.774 77.8533L579.063 9.73438H588.538L580.343 49.9399H616.195L608.513 88.6089Z" fill={"currentColor"} />
      <path d="M401.653 192.834C366.057 192.834 343.266 171.066 343.266 140.08C343.266 129.58 345.058 123.178 360.167 49.9375H406.007C391.666 121.898 389.617 129.58 389.617 135.214C389.617 145.97 396.019 151.091 407.543 151.091C420.86 151.091 431.359 140.08 434.432 124.715L449.285 49.9375H495.125L478.735 132.141C471.309 170.554 442.115 192.834 401.653 192.834Z" fill={"currentColor"} />
      <path d="M238.956 192.835C200.799 192.835 172.117 166.971 172.117 129.582C172.117 81.6941 211.042 45.5859 259.443 45.5859C297.599 45.5859 326.281 71.1946 326.281 108.583C326.281 156.471 287.356 192.835 238.956 192.835ZM243.309 151.093C264.308 151.093 280.442 132.911 280.442 111.912C280.442 97.0592 270.71 87.0719 255.345 87.0719C234.09 87.0719 218.213 105.254 218.213 126.509C218.213 141.362 227.944 151.093 243.309 151.093Z" fill={"currentColor"} />
      <path d="M166.712 61.7225C166.712 89.6359 150.579 112.171 126.763 123.695L149.81 188.229H99.3614L80.1549 132.402H58.8998L47.632 188.229H0L35.8521 8.96875H110.629C144.176 8.96875 166.712 30.9922 166.712 61.7225ZM75.2893 50.4547L66.8385 92.7089H90.3984C107.3 92.7089 117.8 80.4168 117.8 66.332C117.8 56.6008 111.397 50.4547 98.8492 50.4547H75.2893Z" fill={"currentColor"} />
      <path d="M848.466 238.656C848.469 238.661 848.473 238.667 848.478 238.673C848.487 238.686 848.499 238.702 848.513 238.721C848.541 238.759 848.579 238.811 848.626 238.874C848.721 239.001 848.854 239.178 849.024 239.4C849.363 239.845 849.85 240.473 850.476 241.254C851.726 242.814 853.537 244.993 855.838 247.542C860.419 252.617 867.039 259.272 875.124 265.446C890.885 277.484 914.574 289.403 939.936 279.759C947.726 276.796 954.576 272.726 960.908 268.579C967.595 264.2 972.921 260.299 979.434 256.279C991.617 248.76 1005.1 242.758 1024.79 242.758L1024.79 224.758C1000.75 224.758 984 232.308 969.98 240.962C963.391 245.029 956.623 249.869 951.047 253.521C945.116 257.404 939.533 260.654 933.538 262.934C917.178 269.155 900.362 262.072 886.05 251.141C879.098 245.831 873.288 240.011 869.199 235.48C867.165 233.227 865.581 231.321 864.521 229.997C863.991 229.336 863.594 228.822 863.337 228.485C863.209 228.317 863.115 228.193 863.059 228.117C863.031 228.08 863.012 228.054 863.002 228.041C862.998 228.035 862.995 228.031 862.994 228.03L862.995 228.032L862.997 228.035C862.989 228.044 862.738 228.23 855.729 233.342C848.457 238.645 848.459 238.648 848.461 238.65C848.462 238.652 848.464 238.654 848.466 238.656Z" fill={"currentColor"} />
      <path d="M855.942 249.985C864.108 249.985 870.727 243.365 870.727 235.2C870.727 227.034 864.108 220.414 855.942 220.414C847.776 220.414 841.156 227.034 841.156 235.2C841.156 243.365 847.776 249.985 855.942 249.985Z" fill={hole} />
      <path d="M855.941 243.985C851.089 243.985 847.156 240.051 847.156 235.199C847.156 230.347 851.09 226.414 855.941 226.414C860.793 226.414 864.727 230.347 864.728 235.199C864.728 240.051 860.794 243.985 855.941 243.985ZM855.941 255.985C867.421 255.985 876.728 246.679 876.728 235.199C876.727 223.72 867.421 214.414 855.941 214.414C844.462 214.414 835.156 223.72 835.156 235.199C835.156 246.679 844.462 255.985 855.941 255.985Z" fill={"currentColor"} />
      <path d="M1022.81 243.798C1030.97 243.798 1037.59 237.178 1037.59 229.012C1037.59 220.846 1030.97 214.227 1022.81 214.227C1014.64 214.227 1008.02 220.846 1008.02 229.012C1008.02 237.178 1014.64 243.798 1022.81 243.798Z" fill={hole} />
      <path d="M1022.81 237.798C1017.96 237.798 1014.02 233.864 1014.02 229.012C1014.02 224.16 1017.96 220.227 1022.81 220.227C1027.66 220.227 1031.59 224.16 1031.59 229.012C1031.59 233.864 1027.66 237.798 1022.81 237.798ZM1022.81 249.798C1034.29 249.798 1043.59 240.491 1043.59 229.012C1043.59 217.532 1034.29 208.227 1022.81 208.227C1011.33 208.227 1002.02 217.532 1002.02 229.012C1002.02 240.491 1011.33 249.798 1022.81 249.798Z" fill={"currentColor"} />
    </svg>
  );
}
