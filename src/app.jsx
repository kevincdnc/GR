// Main app — composes Sidebar + Map + CreatePanel + Tweaks

const { useState: useAppState, useEffect: useAppEffect, useMemo: useAppMemo } = React;
const { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakColor, TweakRadio, SettingsPanel, SettingsContent, Tooltip, SharePanel } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accent": "#3b82f6",
  "density": "comfy",
  "showLegend": true,
  "sidebarOnRight": false
} /*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [groups, setGroups] = useAppState(SEED_GROUPS);
  // Pro/Free toggle: switching to Pro hydrates the demo seed groups; switching
  // back to Free wipes them so the user lands on the empty state again.
  // Initial 'pro' is set further below — we hydrate once the state exists.
  const hydratePlan = (nextPlan) => {
    if (nextPlan === 'pro') {
      // Deep clone so editing the data doesn't mutate the seed
      setGroups(JSON.parse(JSON.stringify(PRO_SEED_GROUPS)));
      // Show a couple of routes visible by default
      setVisibleIds(new Set(['i_douaniers', 'i_baie']));
      // Hide the geolocation prompt when on Pro
      setLocationPrompt('declined');
      setUserLocation(null);
    } else {
      setGroups([]);
      setVisibleIds(new Set());
      // Don't auto-prompt for geolocation on Free; the locate button does that.
      setLocationPrompt('declined');
      setUserLocation(null);
    }
    setSelectedId(null);
  };
  const [visibleIds, setVisibleIds] = useAppState(new Set(['i_douaniers', 'i_baie']));
  const [hoveredId, setHoveredId] = useAppState(null);
  const [selectedId, setSelectedId] = useAppState(null);
  const [creating, setCreating] = useAppState(false);
  const [creatingStep, setCreatingStep] = useAppState('trace'); // 'trace' | 'poi'
  const [draftActivity, setDraftActivity] = useAppState('hiking'); // mirrors create-panel activity for map duration
  // Draft is now a list of sections; one section is the default.
  const [draftSections, setDraftSections] = useAppState([
    { id: 'sec_default', name: 'Section 1', color: 'blue', coords: [] }
  ]);
  const [draftPois, setDraftPois] = useAppState([]); // [{ id, name, color, icon, latlng, type, osmType? }]
  const [placingPoi, setPlacingPoi] = useAppState(null); // { name, color, icon } template
  const addPoi = (poi) => {
    let pp = poi;
    // Assign a latlng if missing (OSM POIs from the nearby list arrive without one).
    if (!pp.latlng && draftCoords && draftCoords.length > 0) {
      const hash = (pp.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const idx = Math.max(0, Math.min(draftCoords.length - 1, hash % draftCoords.length));
      pp = { ...pp, latlng: draftCoords[idx] };
    }
    setDraftPois((p) => [...p, pp]);
  };
  const removePoi = (id) => setDraftPois((p) => p.filter((x) => x.id !== id));
  // Active section color (hex) — used to ring filter POIs attached to the route.
  const activeSectionColorHex = () => {
    const s = draftSections.find((x) => x.id === activeSectionId) || draftSections[0];
    return (ROUTE_COLORS[s && s.color] && ROUTE_COLORS[s.color].hex) || '#3b82f6';
  };
  const toggleFilterPoi = (poi) => {
    setDraftPois((p) => {
      const exists = p.find((x) => x.fromFilterId && x.fromFilterId === poi.fromFilterId);
      if (exists) return p.filter((x) => x.fromFilterId !== poi.fromFilterId);
      return [...p, {
        ...poi,
        id: 'poi_' + (poi.fromFilterId || Date.now()),
        ringColor: activeSectionColorHex(),
      }];
    });
  };
  const updatePoi = (id, patch) => setDraftPois((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));
  const startPlacingPoi = (tpl) => setPlacingPoi({ name: '', color: 'blue', icon: 'Pin', ...(tpl || {}) });
  const updatePlacingPoi = (patch) => setPlacingPoi((p) => p ? { ...p, ...patch } : p);
  const stopPlacingPoi = () => setPlacingPoi(null);

  // Snap a clicked latlng to the closest point on the draft route.
  const snapToDraft = (latlng) => {
    if (!latlng || !draftCoords || draftCoords.length < 2) return latlng;
    let bestPt = latlng; let bestD = Infinity;
    for (let i = 0; i < draftCoords.length - 1; i++) {
      const a = draftCoords[i]; const b = draftCoords[i + 1];
      // Linear projection in lat/lng space (good enough for short ranges)
      const dx = b[1] - a[1]; const dy = b[0] - a[0];
      const len2 = dx * dx + dy * dy;
      let t = len2 === 0 ? 0 : ((latlng[1] - a[1]) * dx + (latlng[0] - a[0]) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a[1] + t * dx; const py = a[0] + t * dy;
      const dist2 = (px - latlng[1]) ** 2 + (py - latlng[0]) ** 2;
      if (dist2 < bestD) { bestD = dist2; bestPt = [py, px]; }
    }
    // Magnet only kicks in when the click is VERY close to the route (~80m).
    // Beyond that, drop the marker exactly where the user clicked (off-route OK).
    const SNAP_DEG = 0.0008;
    if (bestD > SNAP_DEG * SNAP_DEG) return latlng;
    return bestPt;
  };

  // Single click handler that routes between tracing and POI placement.
  const handleMapClick = (latlng) => {
    if (placingPoi) {
      const snapped = snapToDraft(latlng);
      const name = (placingPoi.name && placingPoi.name.trim())
        ? placingPoi.name.trim()
        : `Repère ${draftPois.length + 1}`;
      addPoi({
        id: 'poi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name,
        color: placingPoi.color || 'blue',
        icon: placingPoi.icon || 'Pin',
        latlng: snapped,
        type: 'custom',
        ringColor: '#3b82f6',
      });
      // Keep the floating card open so the user can add another marker;
      // just clear the name field for the next one.
      setPlacingPoi((p) => p ? { ...p, name: '' } : p);
      return;
    }
    if (creatingStep === 'trace') addPointToActiveSection(latlng);
  };
  const [activeSectionId, setActiveSectionId] = useAppState('sec_default');
  const [draftRouteType, setDraftRouteType] = useAppState('oneWay');
  const [createCounter, setCreateCounter] = useAppState(1);
  const [editingItinerary, setEditingItinerary] = useAppState(null);
  // Geolocation prompt: never auto-shown. It only appears when the user
  // explicitly requests it (e.g. clicking the locate button in the map controls).
  const [locationPrompt, setLocationPrompt] = useAppState('declined'); // 'pending' | 'accepted' | 'declined'
  const [userLocation, setUserLocation] = useAppState(null);
  const [settingsOpen, setSettingsOpen] = useAppState(false);
  const [settingsTab, setSettingsTab] = useAppState('account');
  const [plan, setPlan] = useAppState('pro'); // 'free' | 'pro'
  // Guided onboarding (2 steps). Shows whenever the Free plan is active. 0 = off.
  const [onboardStep, setOnboardStep] = useAppState(1);
  const endTour = () => {
    setOnboardStep(0);
  };
  // Live-measured rect of the element the current tour step points at.
  const [tourAnchor, setTourAnchor] = useAppState(null);
  useAppEffect(() => {
    if (onboardStep === 0) { setTourAnchor(null); return; }
    const sel = onboardStep === 1 ? '[data-onboard="locate"]' : '[data-onboard="cta"]';
    const measure = () => {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        setTourAnchor({ left: r.left, top: r.top, width: r.width, height: r.height });
      }
    };
    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 220);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', measure); };
  }, [onboardStep]);

  // Hydrate seed data on first mount based on initial plan
  useAppEffect(() => {
    hydratePlan(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mapInstance, setMapInstance] = useAppState(null);
  const [poiFilters, setPoiFilters] = useAppState([]);

  const [importing, setImporting] = useAppState(false);
  const [importPreview, setImportPreview] = useAppState(null); // { coords, name, color, activity, distance, ascent, center, zoom }
  const [toast, setToast] = useAppState(null);
  const [confirm, setConfirm] = useAppState(null); // { title, body, confirmLabel, onConfirm }
  const [sharingItinerary, setSharingItinerary] = useAppState(null);

  const dark = !!t.dark;

  useAppEffect(() => {
    document.body.style.background = dark ? '#020617' : '#f8fafc';
  }, [dark]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // Pool of route paths to assign to newly-added itineraries so they show on the map.
  const FAKE_PATHS = [
  'M280,520 C340,500 400,480 460,460 S560,420 620,400 700,360 760,340',
  'M180,640 C260,600 340,560 420,520 S560,460 640,420 760,360 820,340',
  'M340,700 C400,660 460,620 520,580 S620,520 680,480 780,420 860,400',
  'M440,440 C480,420 530,400 580,400 S660,420 700,460 720,520 690,560 630,580 570,560 540,520 510,470 440,440'];

  const pickPath = () => FAKE_PATHS[Math.floor(Math.random() * FAKE_PATHS.length)];

  // Flatten section coords (deduplicate junctions where section[n][0] == section[n-1].last)
  const draftCoords = useAppMemo(() => {
    const out = [];
    draftSections.forEach((s, i) => {
      s.coords.forEach((c, j) => {
        if (i > 0 && j === 0) {
          const lastSeen = out[out.length - 1];
          if (lastSeen && lastSeen[0] === c[0] && lastSeen[1] === c[1]) return;
        }
        out.push(c);
      });
    });
    return out;
  }, [draftSections]);

  // Effective preview coords + distance based on route type
  const effectiveDraftCoords = useAppMemo(
    () => composeDraftCoords(draftCoords, draftRouteType),
    [draftCoords, draftRouteType]
  );
  const draftDistance = useAppMemo(
    () => totalDistanceKm(effectiveDraftCoords),
    [effectiveDraftCoords]
  );

  // Helpers for the section editor
  const addSection = () => {
    const newId = 'sec_' + Date.now();
    setDraftSections((secs) => {
      const usedColors = new Set(secs.map((s) => s.color));
      // Prefer 'blue' (brand primary), then walk the palette for unused colors.
      const palette = ['blue', ...Object.keys(ROUTE_COLORS).filter((k) => k !== 'blue')];
      const nextColor = palette.find((c) => !usedColors.has(c)) || palette[secs.length % palette.length];
      return [...secs, { id: newId, name: `Section ${secs.length + 1}`, color: nextColor, coords: [] }];
    });
    setActiveSectionId(newId);
  };
  const removeSection = (id) => {
    setDraftSections((secs) => {
      if (secs.length <= 1) return secs;
      const next = secs.filter((s) => s.id !== id);
      if (activeSectionId === id) {
        const last = next[next.length - 1];
        if (last) setActiveSectionId(last.id);
      }
      return next;
    });
  };
  const updateSection = (id, patch) => {
    setDraftSections((secs) => secs.map((s) => s.id === id ? { ...s, ...patch } : s));
  };
  const addPointToActiveSection = (latlng) => {
    setDraftSections((secs) => secs.map((s, i) => {
      if (s.id !== activeSectionId) return s;
      // Continuity: if active section is empty AND there's a previous section,
      // seed with the previous section's last point so the trace stays connected.
      if (s.coords.length === 0) {
        const myIdx = secs.findIndex((x) => x.id === activeSectionId);
        if (myIdx > 0) {
          const prev = secs[myIdx - 1];
          const lastOfPrev = prev.coords[prev.coords.length - 1];
          if (lastOfPrev) return { ...s, coords: [lastOfPrev, latlng] };
        }
      }
      return { ...s, coords: [...s.coords, latlng] };
    }));
  };
  const undoLastPoint = () => {
    setDraftSections((secs) => secs.map((s) => s.id === activeSectionId ? { ...s, coords: s.coords.slice(0, -1) } : s));
  };
  const clearDraft = () => {
    setDraftSections([{ id: 'sec_default', name: 'Section 1', color: 'blue', coords: [] }]);
    setActiveSectionId('sec_default');
    setDraftPois([]);
  };

  const startCreate = () => {
    setEditingItinerary(null);
    clearDraft();
    setDraftRouteType('oneWay');
    setCreatingStep('trace');
    setCreating(true);
  };
  const cancelCreate = () => {
    clearDraft();
    setEditingItinerary(null);
    setCreatingStep('trace');
    setPlacingPoi(null);
    setCreating(false);
  };

  const handleSaveNew = (data) => {
    // Editing existing itinerary?
    if (editingItinerary) {
      setGroups((gs) => gs.map((g) => ({
        ...g,
        itineraries: g.itineraries.map((it) => {
          if (it.id !== editingItinerary.id) return it;
          return {
            ...it,
            name: data.name,
            activity: data.activity,
            color: data.color,
            distance: data.distance || 0,
            ascent: data.ascent || 0,
            routeType: data.routeType,
            coords: data.coords,
            path: undefined,
            sections: data.sections || undefined,
            pois: (data.pois && data.pois.length) ? data.pois : undefined,
          };
        }),
      })));
      // Move to a different group if it changed
      if (data.groupId && data.groupId !== editingItinerary.groupId) {
        setGroups((gs) => {
          const newGs = gs.map((g) => ({ ...g, itineraries: [...g.itineraries] }));
          let moved = null;
          for (const g of newGs) {
            const i = g.itineraries.findIndex((x) => x.id === editingItinerary.id);
            if (i !== -1) { moved = g.itineraries.splice(i, 1)[0]; break; }
          }
          const target = newGs.find((g) => g.id === data.groupId);
          if (moved && target) target.itineraries.push(moved);
          return newGs;
        });
      }
      setVisibleIds((s) => new Set([...s, editingItinerary.id]));
      setEditingItinerary(null);
      clearDraft();
      setCreating(false);
      showToast(`« ${data.name} » mis à jour.`);
      return;
    }
    setGroups((gs) => {
      const target = gs.find((g) => g.id === data.groupId);
      const newItinerary = {
        id: data.id,
        name: data.name,
        activity: data.activity,
        color: data.color,
        distance: data.distance || 0,
        ascent: data.ascent || 0,
        time: '—',
        difficulty: '—',
        coords: data.coords,
        routeType: data.routeType,
        sections: data.sections || undefined,
        pois: (data.pois && data.pois.length) ? data.pois : undefined,
      };
      if (target) {
        return gs.map((g) => g.id === data.groupId ?
        { ...g, expanded: true, itineraries: [...g.itineraries, newItinerary] } :
        g);
      }
      // No matching group — create a default one (handles the Free-mode case
      // where the user has no groups yet).
      return [...gs, {
        id: 'g_default_' + Date.now(),
        name: 'Mes itinéraires',
        icon: 'Folder',
        expanded: true,
        itineraries: [newItinerary],
      }];
    });
    setVisibleIds((s) => {
      const next = new Set([...s, data.id]);
      if (data.sections && data.sections.length) {
        data.sections.forEach((sec) => next.add(sec.id));
      }
      return next;
    });
    setCreating(false);
    clearDraft();
    setCreateCounter((n) => n + 1);
    showToast(`« ${data.name} » créé.`);
  };

  const handleSaveImport = (data) => {
    // Ensure an "Import GPX" group exists; create it if this is the first GPX.
    const IMPORT_GROUP_NAME = 'Import GPX';
    let targetGroupId = data.groupId;
    const importGroupExists = groups.some((g) => g.name === IMPORT_GROUP_NAME);
    let createdGroupId = null;
    if (!importGroupExists) {
      createdGroupId = 'g_import_' + Date.now();
      setGroups((gs) => [
        { id: createdGroupId, name: IMPORT_GROUP_NAME, icon: 'FileGpx', expanded: true, itineraries: [] },
        ...gs,
      ]);
      targetGroupId = createdGroupId;
    } else {
      // If the user picked a group from the dropdown, respect that.
      // Otherwise, default to the existing Import GPX group.
      const importGroup = groups.find((g) => g.name === IMPORT_GROUP_NAME);
      if (!targetGroupId || !groups.find((g) => g.id === targetGroupId)) {
        targetGroupId = importGroup.id;
      }
    }

    const newItin = {
      id: data.id,
      name: data.name,
      activity: data.activity,
      color: data.color,
      distance: data.distance,
      ascent: data.ascent,
      time: data.time,
      difficulty: '—',
      coords: data.coords,
    };
    // Use a function to update groups; if we just created the group it might
    // not be in `groups` yet — patch via a fresh map that includes it.
    setGroups((gs) => {
      let arr = gs;
      // If we just added a new "Import GPX" group above, it'll be in the next
      // state, but setGroups calls are batched so we read it here.
      const target = arr.find((g) => g.id === targetGroupId)
        || arr.find((g) => g.name === IMPORT_GROUP_NAME);
      if (target) {
        return arr.map((g) => g.id === target.id
          ? { ...g, expanded: true, itineraries: [...g.itineraries, newItin] }
          : g);
      }
      // Fallback: prepend a fresh import group containing the itin.
      return [
        { id: targetGroupId || ('g_import_' + Date.now()), name: IMPORT_GROUP_NAME, icon: 'FileGpx', expanded: true, itineraries: [newItin] },
        ...arr,
      ];
    });

    // Reset import preview on save too
    setImportPreview(null);
    setVisibleIds((s) => new Set([...s, data.id]));
    setImporting(false);
    showToast(`« ${data.name} » importé avec succès.`);
    if (data.center && mapInstance) {
      try { mapInstance.flyTo(data.center, data.zoom || 13, { duration: 0.9 }); } catch (e) {}
    }
  };

  const handleCreateGroup = () => {
    // Prepend a new untitled group at the top of the list and immediately
    // enter inline-edit on its name so the user can rename without opening a
    // prompt. We tag it with `__newlyCreated: true` so the sidebar can pick it
    // up on next render and switch its header into edit mode.
    const id = 'g_new_' + Date.now();
    setGroups((gs) => [
      { id, name: 'Nouveau groupe', icon: 'Folder', expanded: true, itineraries: [], __newlyCreated: true },
      ...gs,
    ]);
  };

  // Itinerary / section action dispatcher (share / export / move / rename / delete / edit)
  const handleAction = (action, payload) => {
    const { itinerary, section, groupId } = payload || {};
    const target = section ? section.name : itinerary.name;
    if (action === 'edit') {
      // Reopen the create panel pre-filled from this itinerary's data
      // Use the parent itinerary's coords (or rebuild from path samples).
      let coords = itinerary.coords;
      if (!coords && itinerary.path) coords = samplePathToLatLng(itinerary.path, 100);
      // Edit existing: seed draft sections from the itinerary (composite or simple).
      setEditingItinerary({ id: itinerary.id, groupId, source: itinerary });
      if (itinerary.sections && itinerary.sections.length) {
        const secs = itinerary.sections.map((s, i) => ({
          id: s.id || ('sec_' + i),
          name: s.name || ('Section ' + (i + 1)),
          color: s.color || itinerary.color || 'blue',
          coords: s.coords || (s.path ? samplePathToLatLng(s.path, 60) : []),
        }));
        setDraftSections(secs);
        setActiveSectionId(secs[secs.length - 1].id);
      } else {
        const coords = itinerary.coords || (itinerary.path ? samplePathToLatLng(itinerary.path, 60) : []);
        setDraftSections([{ id: 'sec_default', name: 'Section 1', color: itinerary.color || 'blue', coords }]);
        setActiveSectionId('sec_default');
      }
      setDraftRouteType(itinerary.routeType || 'oneWay');
      // Re-hydrate saved POIs so they show in the editor and persist on re-save.
      setDraftPois((itinerary.pois && itinerary.pois.length) ? itinerary.pois.map((p) => ({ ...p })) : []);
      setCreating(true);
      // Hide it from the map while editing
      setVisibleIds((s) => {
        const n = new Set(s);
        n.delete(itinerary.id);
        if (itinerary.sections) itinerary.sections.forEach((sec) => n.delete(sec.id));
        return n;
      });
      return;
    }
    if (action === 'share') {
      setSharingItinerary(section ? { ...itinerary, name: itinerary.name + ' · ' + section.name } : itinerary);
      return;
    } else if (action === 'export') {
      showToast(`Export GPX : ${target}`);
    } else if (action === 'deleteGroup') {
      const group = payload && payload.group;
      if (!group) return;
      const count = group.itineraries.length;
      setConfirm({
        title: `Supprimer « ${group.name} » ?`,
        body: count > 0
          ? `Les ${count} itinéraire${count > 1 ? 's' : ''} de ce groupe ne ${count > 1 ? 'seront' : 'sera'} pas supprimé${count > 1 ? 's' : ''} : ${count > 1 ? 'ils resteront visibles' : 'il restera visible'} dans la liste, sans groupe.`
          : 'Le groupe sera définitivement supprimé.',
        confirmLabel: 'Supprimer le groupe',
        onConfirm: () => {
          // Move all itineraries into a virtual "ungrouped" bucket (kept at top
          // of the sidebar list, no header). Create it if missing.
          const UNGROUPED_ID = '__ungrouped';
          setGroups((gs) => {
            const sourceGroup = gs.find((g) => g.id === group.id);
            const itinsToMove = sourceGroup ? sourceGroup.itineraries : [];
            const existingUngrouped = gs.find((g) => g.id === UNGROUPED_ID);
            const withoutGroup = gs.filter((g) => g.id !== group.id);
            if (itinsToMove.length === 0) {
              return withoutGroup;
            }
            if (existingUngrouped) {
              return withoutGroup.map((g) => g.id === UNGROUPED_ID
                ? { ...g, itineraries: [...g.itineraries, ...itinsToMove] }
                : g);
            }
            // Prepend the ungrouped bucket so it renders at the top
            return [
              { id: UNGROUPED_ID, name: '', icon: null, expanded: true, ungrouped: true, itineraries: itinsToMove },
              ...withoutGroup,
            ];
          });
          showToast(`Groupe « ${group.name} » supprimé.`);
          setConfirm(null);
        },
      });
      return;
    } else if (action === 'renameInline') {
      // Direct rename from sidebar inline editor (no prompt)
      const next = (payload && payload.name) ? String(payload.name).trim() : '';
      if (!next) return;
      setGroups((gs) => gs.map((g) => ({
        ...g,
        itineraries: g.itineraries.map((it) => it.id === itinerary.id ? { ...it, name: next } : it),
      })));
    } else if (action === 'rename') {
      const next = window.prompt('Nouveau nom ?', section ? section.name : itinerary.name);
      if (!next) return;
      setGroups((gs) => gs.map((g) => ({
        ...g,
        itineraries: g.itineraries.map((it) => {
          if (it.id !== itinerary.id) return it;
          if (section) {
            return { ...it, sections: it.sections.map((s) => s.id === section.id ? { ...s, name: next } : s) };
          }
          return { ...it, name: next };
        }),
      })));
      showToast(`Renommé : ${next}`);
    } else if (action === 'move') {
      const choices = groups.filter((g) => g.id !== groupId);
      if (choices.length === 0) { showToast('Aucun autre groupe disponible.'); return; }
      const list = choices.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
      const ans = window.prompt(`Déplacer "${itinerary.name}" vers :\n\n${list}\n\nEntrez le numéro :`);
      const idx = parseInt(ans, 10) - 1;
      if (isNaN(idx) || !choices[idx]) return;
      const tgt = choices[idx];
      setGroups((gs) => {
        const newGs = gs.map((g) => ({ ...g, itineraries: [...g.itineraries] }));
        let moved = null;
        for (const g of newGs) {
          const i = g.itineraries.findIndex((x) => x.id === itinerary.id);
          if (i !== -1) { moved = g.itineraries.splice(i, 1)[0]; break; }
        }
        const t = newGs.find((g) => g.id === tgt.id);
        if (moved && t) t.itineraries.push(moved);
        return newGs;
      });
      showToast(`Déplacé vers : ${tgt.name}`);
    } else if (action === 'delete') {
      if (section) {
        setConfirm({
          title: 'Supprimer cette section ?',
          body: `« ${section.name} » sera définitivement supprimée. Cette action est irréversible.`,
          confirmLabel: 'Supprimer',
          onConfirm: () => {
            setGroups((gs) => gs.map((g) => ({
              ...g,
              itineraries: g.itineraries.map((it) => it.id === itinerary.id
                ? { ...it, sections: it.sections.filter((s) => s.id !== section.id) }
                : it),
            })));
            setVisibleIds((s) => { const n = new Set(s); n.delete(section.id); return n; });
            showToast('Section supprimée.');
            setConfirm(null);
          },
        });
      } else {
        setConfirm({
          title: 'Supprimer cet itinéraire ?',
          body: `« ${itinerary.name} » sera définitivement supprimé. Cette action est irréversible.`,
          confirmLabel: 'Supprimer',
          onConfirm: () => {
            setGroups((gs) => gs.map((g) => ({
              ...g,
              itineraries: g.itineraries.filter((x) => x.id !== itinerary.id),
            })));
            setVisibleIds((s) => {
              const n = new Set(s);
              n.delete(itinerary.id);
              if (itinerary.sections) itinerary.sections.forEach((sec) => n.delete(sec.id));
              return n;
            });
            if (selectedId === itinerary.id) setSelectedId(null);
            showToast(`"${itinerary.name}" supprimé.`);
            setConfirm(null);
          },
        });
      }
    }
  };

  const sidebarSide = t.sidebarOnRight ? 'right' : 'left';

  return (
    <div className={`fixed inset-0 flex ${dark ? 'dark' : ''}`} style={{ background: dark ? '#020617' : '#f8fafc' }}>
      {/* Sidebar (or create panel) */}
      <aside
        className={`relative shrink-0 w-[340px] flex flex-col z-[1000] transition-colors ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'} ${sidebarSide === 'right' ? 'order-2 border-l' : 'border-r'}`}>
        
        {settingsOpen ?
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          dark={dark}
          accent={t.accent}
          tab={settingsTab}
          onTabChange={setSettingsTab} /> :
        creating ?
        <CreatePanel
          onClose={cancelCreate}
          onSave={handleSaveNew}
          onActivityChange={setDraftActivity}
          groups={groups}
          dark={dark}
          accent={t.accent}
          defaultName={editingItinerary ? editingItinerary.source.name : `Nouvel itinéraire ${createCounter}`}
          defaultActivity={editingItinerary?.source.activity}
          defaultGroupId={editingItinerary?.groupId}
          defaultPrivacy={editingItinerary?.source.privacy}
          editingMode={!!editingItinerary}
          draftSections={draftSections}
          activeSectionId={activeSectionId}
          onSetActiveSection={setActiveSectionId}
          onAddSection={addSection}
          onRemoveSection={removeSection}
          onUpdateSection={updateSection}
          draftPois={draftPois}
          onAddPoi={(poi) => addPoi({ ...poi, latlng: poi.latlng || null })}
          onRemovePoi={removePoi}
          onUpdatePoi={updatePoi}
          placingPoi={placingPoi}
          onStartPlacingPoi={startPlacingPoi}
          onUpdatePlacingPoi={updatePlacingPoi}
          onStopPlacingPoi={stopPlacingPoi}
          poiFiltersActive={(poiFilters && poiFilters.length > 0)}
          onShowAllPois={() => {
            const all = (window.POI_FILTER_TYPES || []).map((t) => t.key);
            const isAllOn = poiFilters && poiFilters.length === all.length;
            setPoiFilters(isAllOn ? [] : all);
          }}
          step={creatingStep}
          onChangeStep={setCreatingStep}
          draftCoords={draftCoords}
          draftDistance={draftDistance}
          draftRouteType={draftRouteType}
          onChangeRouteType={setDraftRouteType}
          onClearDraft={clearDraft} /> :

        importing ?
        <ImportPanel
          onClose={() => { setImporting(false); setImportPreview(null); }}
          onSave={handleSaveImport}
          onPreview={(p) => {
            setImportPreview({
              id: 'i_imp_preview',
              name: p.name,
              color: 'emerald',
              activity: 'hiking',
              coords: p.coords,
              distance: p.distance,
              ascent: p.ascent,
              center: p.center,
              zoom: p.zoom,
            });
            if (mapInstance && p.center) {
              try { mapInstance.flyTo(p.center, p.zoom || 13, { duration: 0.9 }); } catch (e) {}
            }
          }}
          onColorChange={(c) => setImportPreview((prev) => prev ? { ...prev, color: c } : prev)}
          groups={groups}
          dark={dark}
          accent={t.accent} /> :


        <Sidebar
          groups={groups}
          setGroups={setGroups}
          visibleIds={visibleIds}
          setVisibleIds={setVisibleIds}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          dark={dark}
          accent={t.accent}
          density={t.density}
          onCreate={() => { endTour(); startCreate(); }}
          onImport={() => { endTour(); setImporting(true); }}
          onSuggest={() => { endTour(); showToast('Suggestion d’itinéraire — bientôt disponible.'); }}
          onCreateGroup={handleCreateGroup}
          onDrawZone={() => showToast('Outil zones — bientôt disponible.')}
          onAction={handleAction}
          forceCreateMenu={onboardStep === 2} />

        }

        {/* Bottom utility bar */}
        {!creating && !importing && !settingsOpen &&
        <div className={`px-3 py-2 border-t flex items-center justify-between ${dark ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-white'}`}>
            <div className="flex items-center gap-1.5">
              <Tooltip dark={dark} label="Vincent R." sub="vincent@mountaya.com · Admin" side="top">
                <button
                  onClick={() => { setSettingsTab('account'); setSettingsOpen(true); }}
                  className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold transition-shadow hover:shadow ${dark ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}>
                  VR
                </button>
              </Tooltip>
              <Tooltip
                dark={dark}
                label={plan === 'pro' ? 'Plan Pro' : 'Plan Free'}
                sub={plan === 'pro' ? 'Cliquez pour passer en Free' : 'Cliquez pour passer en Pro'}
                side="top"
              >
                <button
                  onClick={() => setPlan((p) => {
                    const next = p === 'pro' ? 'free' : 'pro';
                    hydratePlan(next);
                    // Restart the guided tour every time we enter Free.
                    setOnboardStep(next === 'free' ? 1 : 0);
                    return next;
                  })}
                  className={`text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors ${plan === 'pro'
                    ? (dark ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' : 'bg-blue-100 text-blue-700 hover:bg-blue-200')
                    : (dark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')
                  }`}
                >
                  {plan === 'pro' ? 'Pro' : 'Free'}
                </button>
              </Tooltip>
            </div>
            <div className="flex items-center gap-0.5">
              <Tooltip dark={dark} label="Statut" sub="Tous les systèmes opérationnels" side="top">
                <a
                  href="https://status.mountaya.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Statut des services"
                  className={`p-1.5 rounded-md transition-colors flex items-center ${dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}>
                  <span
                    className="block w-2 h-2 rounded-full"
                    style={{ background: '#22c55e', boxShadow: '0 0 0 3px ' + (dark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.22)') }}
                  ></span>
                </a>
              </Tooltip>
              <Tooltip dark={dark} label="Documentation" sub="Guides et référence API" side="top">
                <a
                  href="https://docs.mountaya.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-1.5 rounded-md transition-colors flex ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                  <I.Book size={16} />
                </a>
              </Tooltip>
              <Tooltip dark={dark} label="Slack community" sub="Rejoindre la communauté Mountaya" side="top">
                <a
                  href="https://mountaya.slack.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-1.5 rounded-md transition-colors flex ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                  <I.Slack size={16} />
                </a>
              </Tooltip>
              <Tooltip dark={dark} label="Paramètres" sub="Compte, organisation, API" side="top">
                <button
                  onClick={() => { setSettingsTab('account'); setSettingsOpen(true); }}
                  className={`p-1.5 rounded-md transition-colors ${dark ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                  <I.Settings size={16} />
                </button>
              </Tooltip>
            </div>
          </div>
        }
      </aside>

      {/* Main area: Settings content takes over when in settings mode, otherwise show map */}
      <main className="relative flex-1 min-w-0">
        {settingsOpen ? (
          <SettingsContent tab={settingsTab} dark={dark} accent={t.accent} />
        ) : (
          <>
            {/* Top-left place search + POI filter */}
            <div className="absolute top-4 left-4 z-[500] flex items-center gap-2">
              <PlaceSearch map={mapInstance} dark={dark} accent={t.accent} />
              <PoiFilterButton
                dark={dark}
                accent={t.accent}
                active={poiFilters}
                onChange={setPoiFilters}
              />
            </div>

            {/* Floating, draggable custom-marker card (over the map) */}
            {creating && placingPoi && window.FloatingPoiCard && (
              <window.FloatingPoiCard
                dark={dark}
                accent={t.accent}
                template={placingPoi}
                onChange={updatePlacingPoi}
                onClose={stopPlacingPoi}
              />
            )}

        <MapView
          groups={groups}
          visibleIds={visibleIds}
          hoveredId={hoveredId}
          importPreview={importing ? importPreview : null}
          accent={t.accent}
          dark={dark}
          showLegend={t.showLegend}
          creating={creating}
          poiFilters={poiFilters}
          onToggleFilterPoi={toggleFilterPoi}
          draftPois={draftPois}
          placingPoi={placingPoi}
          draftSections={draftSections}
          activeSectionId={activeSectionId}
          draftCoords={draftCoords}
          draftRouteType={draftRouteType}
          draftDistance={draftDistance}
          draftActivity={draftActivity}
          locationPrompt={locationPrompt}
          userLocation={userLocation}
          onAcceptLocation={() => {
            // Fake-accept geolocation: drop the user on Quimper (Bretagne)
            const quimper = [47.997, -4.103];
            setUserLocation(quimper);
            setLocationPrompt('accepted');
            if (mapInstance) {
              try { mapInstance.flyTo(quimper, 13, { duration: 0.9 }); } catch (e) {}
            }
          }}
          onDeclineLocation={() => setLocationPrompt('declined')}
          onRequestLocation={() => setLocationPrompt('pending')}
          onMapReady={setMapInstance}
          onAction={handleAction}
          onMapClick={handleMapClick}
          onUndo={undoLastPoint}
          onClearDraft={clearDraft}
          onAddSection={addSection}
          onFinish={() => {
            // Trigger the same submit as the bottom CTA via a small focus dance:
            // we dispatch a custom event the CreatePanel listens to, or just call save.
            window.dispatchEvent(new CustomEvent('mountaya:finishDraft'));
          }}
          onToggleVisible={(id) => {
            setVisibleIds((s) => {
              const next = new Set(s);
              next.delete(id);
              return next;
            });
          }} />
        

        {/* Empty state when no routes visible */}
        {visibleIds.size === 0 && !creating &&
        <div className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-2xl px-5 py-4 shadow-xl backdrop-blur ${dark ? 'bg-neutral-900/80 text-neutral-200 border border-neutral-700/60' : 'bg-white/90 text-neutral-700 border border-neutral-200/80'}`}>
            <div className="flex items-center gap-3">
              <I.Eye size={18} className={dark ? 'text-neutral-400' : 'text-neutral-500'} />
              <span className="text-[13px]">Cliquez sur un itinéraire pour l'afficher.</span>
            </div>
          </div>
        }

        {/* Confirmation modal (delete actions) */}
        {confirm && (
          <div className="absolute inset-0 z-[800] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 backdrop-blur-[1px]"
              style={{ background: 'rgba(15,15,15,0.32)' }}
              onClick={() => setConfirm(null)}
            ></div>
            <div
              className={`relative w-[400px] max-w-full rounded-xl shadow-2xl overflow-hidden animate-tip-fixed ${dark ? 'bg-neutral-900 border border-neutral-700/60 text-neutral-100' : 'bg-white border border-neutral-200/80 text-neutral-900'}`}
            >
              <div className="px-6 pt-5 pb-5">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${dark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
                    <I.Trash size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>
                      {confirm.title}
                    </h3>
                    <p className={`mt-1.5 text-[12.5px] leading-relaxed ${dark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      {confirm.body}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2.5 mt-5">
                  <button
                    onClick={() => setConfirm(null)}
                    className={`flex-1 rounded-md px-3 py-2.5 text-[12.5px] font-medium border transition-colors ${dark ? 'border-neutral-800 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirm.onConfirm}
                    className="btn-cta-primary flex-1 rounded-md px-3 py-2.5 text-[12.5px] font-medium text-white shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                    style={{ background: '#dc2626' }}
                  >
                    <I.Trash size={13} />
                    {confirm.confirmLabel || 'Supprimer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast &&
        <div className="absolute left-1/2 bottom-6 -translate-x-1/2 z-20 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-[13px] font-medium animate-in" style={{ background: t.accent, color: '#fff' }}>
            <I.Check size={15} stroke="white" strokeWidth="2.5" />
            {toast}
          </div>
        }

        {/* First-visit guided onboarding (2 steps) */}
        {onboardStep > 0 && plan === 'free' && visibleIds.size === 0 && !creating && !importing && !settingsOpen && !sharingItinerary && (() => {
          const vw = (typeof window !== 'undefined' && window.innerWidth) || 1440;
          const onRight = tourAnchor && tourAnchor.left > vw / 2;
          // Align the card's icon/arrow row (~30px from its top) with the
          // vertical center of the highlighted button, rather than centering
          // the whole card on it.
          const ARROW_OFFSET = 30;
          const anchorMidY = tourAnchor ? tourAnchor.top + tourAnchor.height / 2 : 0;
          const cardPos = !tourAnchor ? { left: '50%', top: '40%', transform: 'translate(-50%,-50%)' }
            : onRight
              ? { right: vw - tourAnchor.left + 16, top: anchorMidY - ARROW_OFFSET }
              : { left: tourAnchor.left + tourAnchor.width + 16, top: anchorMidY - ARROW_OFFSET };
          const arrowSide = onRight ? 'right' : 'left';
          return (
          <div className="fixed inset-0 z-[1200]" style={{ pointerEvents: 'none' }}>
            {/* spotlight: dims the page except a ringed hole around the target.
                The overlay does NOT capture clicks, so the highlighted control
                (e.g. the CTA dropdown options) stays directly clickable. */}
            {tourAnchor && (
              <div
                className="absolute"
                style={{
                  left: tourAnchor.left - 7, top: tourAnchor.top - 7,
                  width: tourAnchor.width + 14, height: tourAnchor.height + 14,
                  borderRadius: 14,
                  boxShadow: '0 0 0 3px rgba(59,130,246,0.95), 0 0 0 9999px rgba(10,12,20,0.42)',
                  pointerEvents: 'none',
                  animation: 'onboardRing 1.8s ease-out infinite',
                }}
              ></div>
            )}
            {onboardStep === 1 && (
              <div className="absolute" style={{ ...cardPos, pointerEvents: 'auto' }}>
                <OnboardCard
                  dark={dark} step={1} arrow={arrowSide}
                  icon={<I.LocateArrow size={20} />}
                  title="Activez votre localisation"
                  body="Autorisez la géolocalisation pour centrer la carte autour de vous et démarrer un itinéraire à proximité."
                  onSkip={endTour}
                  onNext={() => setOnboardStep(2)}
                  nextLabel="Suivant" />
              </div>
            )}
            {onboardStep === 2 && (
              <div className="absolute" style={{ ...cardPos, pointerEvents: 'auto' }}>
                <OnboardCard
                  dark={dark} step={2} arrow={arrowSide}
                  icon={<I.Plus size={20} />}
                  title="Créez ou importez un itinéraire"
                  body="Tracez un parcours point par point, importez un fichier GPX depuis Strava, Garmin ou Komoot, ou laissez Mountaya vous suggérer un itinéraire."
                  onSkip={endTour}
                  onBack={() => setOnboardStep(1)}
                  onNext={endTour}
                  nextLabel="C'est parti" />
              </div>
            )}
          </div>
          );
        })()}

        {/* Share panel — overlays the map (blurred) instead of replacing it */}
        {sharingItinerary && (
          <SharePanel
            itinerary={sharingItinerary}
            dark={dark}
            accent={t.accent}
            plan={plan}
            onClose={() => setSharingItinerary(null)}
          />
        )}
          </>
        )}
      </main>

      {/* Tweaks panel */}
      <TweaksPanel title="Réglages design">
        <TweakSection label="Apparence" />
        <TweakToggle label="Mode sombre" value={t.dark} onChange={(v) => setTweak('dark', v)} />
        <TweakColor
          label="Couleur d'accent"
          value={t.accent}
          options={['#3b82f6', '#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899']}
          onChange={(v) => setTweak('accent', v)} />
        
        <TweakRadio
          label="Densité"
          value={t.density}
          options={['compact', 'comfy']}
          onChange={(v) => setTweak('density', v)} />
        
        <TweakSection label="Carte" />
        <TweakToggle label="Légende live" value={t.showLegend} onChange={(v) => setTweak('showLegend', v)} />
        <TweakToggle label="Sidebar à droite" value={t.sidebarOnRight} onChange={(v) => setTweak('sidebarOnRight', v)} />
      </TweaksPanel>
    </div>);

}

function OnboardCard({ dark, step, arrow, icon, title, body, onSkip, onBack, onNext, nextLabel }) {
  return (
    <div
      className={`relative w-[300px] rounded-xl shadow-2xl overflow-hidden ${dark ? 'bg-neutral-900 border border-neutral-700/60' : 'bg-white border border-neutral-200/80'}`}
    >
      {/* arrow pointer */}
      <span
        className={`absolute w-3 h-3 rotate-45 ${dark ? 'bg-neutral-900 border-neutral-700/60' : 'bg-white border-neutral-200/80'}`}
        style={arrow === 'right'
          ? { right: -6, top: 30, marginTop: -6, borderRight: '1px solid', borderTop: '1px solid', borderColor: dark ? 'rgba(64,64,64,0.6)' : 'rgba(229,229,229,0.8)' }
          : { left: -6, top: 30, marginTop: -6, borderLeft: '1px solid', borderBottom: '1px solid', borderColor: dark ? 'rgba(64,64,64,0.6)' : 'rgba(229,229,229,0.8)' }}
      ></span>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: '#3b82f622', color: '#3b82f6' }}>
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#3b82f6' }}>Étape {step}/2</span>
              <button onClick={onSkip} className={`p-0.5 rounded transition-colors ${dark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`} aria-label="Fermer">
                <I.X size={14} />
              </button>
            </div>
            <h3 className={`mt-0.5 text-[14px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>{title}</h3>
          </div>
        </div>
        <p className={`mt-2 text-[12px] leading-relaxed ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{body}</p>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          {/* step dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2].map((s) => (
              <span key={s} className="rounded-full transition-all" style={{ width: s === step ? 16 : 6, height: 6, background: s === step ? '#3b82f6' : (dark ? '#404040' : '#d4d4d4') }}></span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className={`text-[12px] font-medium rounded-md px-2.5 py-1.5 transition-colors ${dark ? 'text-neutral-200 hover:bg-neutral-800' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                Retour
              </button>
            )}
            <button onClick={onNext} className="btn-cta-primary text-[12px] font-semibold text-white rounded-md px-3 py-1.5" style={{ background: '#3b82f6' }}>
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);