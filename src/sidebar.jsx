// Sidebar: accordion groups + itineraries
// - Eye toggle per item AND per group (group eye toggles all children)
// - Drag & drop to reorder itineraries within/across groups
// - Inline rename, delete, more menu

const { useState, useRef, useEffect } = React;

function Sidebar({
  groups, setGroups, visibleIds, setVisibleIds, hoveredId, setHoveredId,
  selectedId, setSelectedId, dark, accent, density,
  onCreate, onImport, onSuggest, onCreateGroup, onDrawZone, onAction, forceCreateMenu,
  view, onViewChange
}) {
  const [drag, setDrag] = useState(null); // {itineraryId, fromGroupId}
  const [dragOver, setDragOver] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const filtered = groups;
  // Onboarding can force the CTA dropdown open.
  const ctaOpen = menuOpen || forceCreateMenu;

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

  const handleDrop = (targetGroupId, targetIndex) => {
    if (!drag) return;
    setGroups((gs) => {
      // remove from source
      const newGs = gs.map((g) => ({ ...g, itineraries: [...g.itineraries] }));
      let moved = null;
      for (const g of newGs) {
        const idx = g.itineraries.findIndex((i) => i.id === drag.itineraryId);
        if (idx !== -1) {
          moved = g.itineraries.splice(idx, 1)[0];
          break;
        }
      }
      if (!moved) return gs;
      const target = newGs.find((g) => g.id === targetGroupId);
      if (!target) return gs;
      const insertAt = Math.min(targetIndex, target.itineraries.length);
      target.itineraries.splice(insertAt, 0, moved);
      return newGs;
    });
    setDrag(null);
    setDragOver(null);
  };

  const rowPad = density === 'compact' ? 'py-1.5' : 'py-2.5';
  const grpPad = density === 'compact' ? 'py-1.5' : 'py-2';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className={`px-4 pt-5 pb-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2" style={{ gap: "8px" }}>
          <img src={(window.__resources && window.__resources.logoGr) || "assets/logo-gr.svg"} alt="" className="w-8 h-8 shrink-0" draggable="false" />
          <div className="leading-tight">
            <div className="logo-type text-[22px] select-none" aria-label="Trek Studio">
              <span className={dark ? 'text-white' : 'text-neutral-900'}>Trek</span>
              <span className="ml-[0.18em] text-red-600">Studio</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle divider */}
      <div className={`mx-4 mt-2 mb-1 h-px ${dark ? 'bg-neutral-800' : 'bg-neutral-200'}`} />

      {/* Section label */}
      <div className="px-4 pt-2 pb-1 flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>Mes itinéraires</span>
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
      <div className="flex-1 overflow-y-auto px-2 pb-4 sb-scroll">
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
                    handleDrop={handleDrop} />
                )}
                {/* drop zone at the end of ungrouped bucket */}
                {drag &&
                  <div
                    className={`h-2 rounded ${dragOver === group.id + '_end' ? dark ? 'bg-sky-500/40' : 'bg-sky-200' : ''}`}
                    onDragOver={(e) => {e.preventDefault();setDragOver(group.id + '_end');}}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => {e.preventDefault();handleDrop(group.id, group.itineraries.length);}} />
                }
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
                onClearNewlyCreated={(gid) => {
                  setGroups((gs) => gs.map((g) => g.id === gid ? { ...g, __newlyCreated: false } : g));
                }} />
              

              {group.expanded &&
              <div className="pl-1.5 mt-0.5 mb-1 relative">
                  {group.itineraries.length === 0 ?
                <div className={`text-[11px] py-2 px-2 ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>Aucun itinéraire</div> :

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
                  handleDrop={handleDrop} />

                )
                }
                  {/* drop zone at the end of group */}
                  {drag &&
                <div
                  className={`h-2 rounded ${dragOver === group.id + '_end' ? dark ? 'bg-sky-500/40' : 'bg-sky-200' : ''}`}
                  onDragOver={(e) => {e.preventDefault();setDragOver(group.id + '_end');}}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {e.preventDefault();handleDrop(group.id, group.itineraries.length);}} />

                }
                </div>
              }
            </div>);

        })}
        {filtered.length === 0 &&
        <EmptyStateIllustration dark={dark} accent={accent} onOpenMenu={() => setMenuOpen(true)} />
        }
      </div>

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
            title="Importer un GPX"
            desc="Depuis Strava, Garmin, Komoot…"
            onClick={pick(onImport)} />
          
            <MenuDivider dark={dark} />
            <MenuItem
            dark={dark} accent={accent}
            icon={<I.Sparkle size={16} />}
            title="Me suggérer un itinéraire"
            desc="Selon distance, dénivelé et zone"
            onClick={pick(onSuggest)}
            badge="Beta" />
          
          </div>
        }
      </div>

    </div>);

}

function ItineraryRow({
  it, idx, groupId, visState, onToggleVisible, visibleIds, onToggleSection,
  selected, onSelect, onHover, hoveredId, onAction, setGroups,
  dark, accent, rowPad, drag, setDrag, dragOver, setDragOver, handleDrop
}) {
  const Icon = I[ACTIVITIES[it.activity].icon] || I.Route;
  const color = ROUTE_COLORS[it.color].hex;
  const isDragging = drag && drag.itineraryId === it.id;
  const dropKey = groupId + '_' + idx;
  const stats = itineraryStats(it);
  const visible = visState !== 'none';
  const isComposite = stats.isComposite;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // Pastille de couleur + sélecteur de couleur du tracé
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

  const handleRowClick = () => {
    if (isComposite) onSelect();
  };

  return (
    <>
      {/* Drop zone above */}
      {drag &&
      <div
        className={`h-1 rounded transition-colors ${dragOver === dropKey ? dark ? 'bg-sky-500/40' : 'bg-sky-200' : ''}`}
        onDragOver={(e) => {e.preventDefault();setDragOver(dropKey);}}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => {e.preventDefault();handleDrop(groupId, idx);}} />

      }
      <div className={`rounded-lg transition-all ${isDragging ? 'opacity-40' : ''}`}>
        <div
          draggable
          onDragStart={(e) => {
            setDrag({ itineraryId: it.id, fromGroupId: groupId });
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => {setDrag(null);setDragOver(null);}}
          onMouseEnter={() => onHover(it.id)}
          onMouseLeave={() => onHover(null)}
          className={`group relative flex items-center gap-2 ${rowPad} px-2 rounded-lg ${isComposite ? 'cursor-pointer' : ''} transition-colors ${dark ? 'hover:bg-neutral-800/70' : 'hover:bg-neutral-100'} ${visible ? dark ? 'bg-neutral-800/40' : 'bg-neutral-50/60' : ''}`}
          onClick={handleRowClick}>
          
          {/* Drag handle */}
          <div className={`opacity-0 group-hover:opacity-100 transition-opacity -ml-1 ${dark ? 'text-neutral-500' : 'text-neutral-400'} cursor-grab active:cursor-grabbing`}>
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
                : (dark ? 'opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-100 hover:bg-neutral-700' : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200')
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
      className={`group flex items-center gap-2 pl-2 pr-0 py-1.5 rounded-md transition-colors ${dark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-50'}`}>
      
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
          className={`p-1 rounded transition-all opacity-0 group-hover:opacity-100 ${dark ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200'} ${menuOpen ? 'opacity-100' : ''}`}
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


function GroupHeader({ group, vState, dark, accent, grpPad, drag, dragOver, setDragOver, handleDrop, onToggleExpand, onToggleVisibility, onRename, onSetEmoji, onDelete, onClearNewlyCreated }) {
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
      className={`group flex items-center rounded-lg ${grpPad} px-2 transition-colors ${editing ? '' : 'cursor-pointer'} ${dragOver === group.id + '_head' ? dark ? 'bg-neutral-800/80' : 'bg-sky-50' : dark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-100'}`}
      onClick={() => {if (!editing) onToggleExpand();}}
      onDragOver={(e) => {if (drag) {e.preventDefault();setDragOver(group.id + '_head');}}}
      onDragLeave={() => setDragOver(null)}
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
            : (dark ? 'opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-100 hover:bg-neutral-700' : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200')
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
// Shown in place of the groups list — keeps the "Mes itinéraires" header above it.
function EmptyStateIllustration({ dark, accent, onOpenMenu }) {
  return (
    <div className="px-3 pt-10 pb-6 text-center">
      <div className="mx-auto" style={{ maxWidth: 208 }}>
        <div style={{ opacity: 0.8 }}>
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
          className={`pointer-events-none whitespace-nowrap rounded-lg px-2.5 py-1.5 shadow-xl animate-tip-fixed ${dark ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-900 text-white'}`}>
          <span className="block text-[11.5px] font-medium leading-tight">{label}</span>
          {sub && <span className={`block text-[10.5px] mt-0.5 leading-tight ${dark ? 'text-neutral-500' : 'text-neutral-400'}`}>{sub}</span>}
          {pos && (
            <span
              className={`absolute w-2 h-2 rotate-45 ${dark ? 'bg-neutral-100' : 'bg-neutral-900'}`}
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