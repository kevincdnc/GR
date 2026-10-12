// Map place-search via Nominatim (OpenStreetMap) — debounced autocomplete.
// Click a result → flyTo on the map, drop a temporary marker.

const { useState: usePsState, useEffect: usePsEffect, useRef: usePsRef } = React;

function PlaceSearch({ map, dark, accent }) {
  const [q, setQ] = usePsState('');
  const [results, setResults] = usePsState([]);
  const [loading, setLoading] = usePsState(false);
  const [open, setOpen] = usePsState(false);
  const [focused, setFocused] = usePsState(false);
  const [hoverIdx, setHoverIdx] = usePsState(-1);
  const wrapRef = usePsRef(null);
  const debTimer = usePsRef(null);
  const markerRef = usePsRef(null);
  const abortRef = usePsRef(null);

  // Outside click closes dropdown
  usePsEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Debounced query
  usePsEffect(() => {
    if (!focused) return;
    clearTimeout(debTimer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debTimer.current = setTimeout(async () => {
      try {
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=fr&q=${encodeURIComponent(q.trim())}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (e.name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(debTimer.current);
  }, [q, focused]);

  const select = (r) => {
    if (!map) return;
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (r.boundingbox && r.boundingbox.length === 4) {
      const b = r.boundingbox.map(parseFloat);
      try {
        map.flyToBounds([[b[0], b[2]], [b[1], b[3]]], { padding: [80, 80], duration: 0.8, maxZoom: 14 });
      } catch (e) {
        map.flyTo([lat, lon], 12, { duration: 0.8 });
      }
    } else {
      map.flyTo([lat, lon], 13, { duration: 0.8 });
    }

    // Drop a temporary marker
    if (markerRef.current) { try { markerRef.current.remove(); } catch (e) {} }
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:22px;height:28px;position:relative;">
        <svg viewBox="0 0 22 28" width="22" height="28" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <path d="M11 0C5 0 0 4.7 0 10.5 0 18 11 28 11 28s11-10 11-17.5C22 4.7 17 0 11 0Z" fill="${accent}"/>
          <circle cx="11" cy="10.5" r="4" fill="white"/>
        </svg>
      </div>`,
      iconSize: [22, 28],
      iconAnchor: [11, 28],
    });
    const m = L.marker([lat, lon], { icon, interactive: false }).addTo(map);
    markerRef.current = m;
    setTimeout(() => {
      if (markerRef.current === m) { try { m.remove(); markerRef.current = null; } catch (e) {} }
    }, 6000);

    setOpen(false);
    setFocused(false);
    setQ(formatShortLabel(r));
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (results[hoverIdx]) { e.preventDefault(); select(results[hoverIdx]); }
      else if (results[0]) { e.preventDefault(); select(results[0]); }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setFocused(false);
      e.currentTarget.blur();
    }
  };

  return (
    <div ref={wrapRef} className="relative w-80 max-w-[calc(100vw-380px)]">
      <div
        className={`relative flex items-center rounded-lg shadow-lg backdrop-blur transition-colors ${dark ? 'bg-neutral-900/85 border border-neutral-700/60 focus-within:border-neutral-600' : 'bg-white/95 border border-neutral-200/80 focus-within:border-neutral-300'}`}
      >
        {loading ? (
          <span className={`absolute left-3 w-[15px] h-[15px] rounded-full border-2 animate-spin ${dark ? 'border-neutral-700 border-t-neutral-300' : 'border-neutral-200 border-t-neutral-500'}`} style={{ animationDuration: '0.8s' }}></span>
        ) : (
          <I.Search size={15} className={`absolute left-3 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`} />
        )}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHoverIdx(-1); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un lieu, une ville…"
          className={`bg-transparent outline-none text-[13px] pl-9 pr-9 py-2 w-full rounded-lg ${dark ? 'text-neutral-100 placeholder:text-neutral-500' : 'text-neutral-900 placeholder:text-neutral-400'}`}
        />
        {q && (
          <button
            onClick={() => { setQ(''); setResults([]); setOpen(false); }}
            className={`absolute right-2 p-1 rounded-lg ${dark ? 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'}`}
            title="Effacer"
          >
            <I.X size={13} />
          </button>
        )}
      </div>

      {open && focused && q.trim().length >= 2 && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 rounded-lg shadow-2xl overflow-hidden animate-menu max-h-80 overflow-y-auto sb-scroll ${dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'}`}
        >
          {loading && results.length === 0 && (
            <div className={`px-3 py-3 text-[12px] ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Recherche…</div>
          )}
          {!loading && results.length === 0 && (
            <div className={`px-3 py-3 text-[12px] ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>Aucun résultat</div>
          )}
          {results.map((r, i) => {
            const Icon = pickResultIcon(r);
            return (
              <button
                key={r.place_id}
                onMouseEnter={() => setHoverIdx(i)}
                onClick={() => select(r)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${hoverIdx === i ? (dark ? 'bg-neutral-800' : 'bg-neutral-50') : ''} ${dark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50'}`}
              >
                <span
                  className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
                  style={{ background: accent + '18', color: accent }}
                >
                  <Icon size={14} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[12.5px] font-medium truncate ${dark ? 'text-white' : 'text-neutral-900'}`}>{formatShortLabel(r)}</span>
                  <span className={`block text-[11px] truncate ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{formatContext(r)}</span>
                </span>
              </button>
            );
          })}
          <div className={`px-3 py-1.5 text-[9.5px] ${dark ? 'text-neutral-500 border-t border-neutral-800' : 'text-neutral-400 border-t border-neutral-100'}`}>
            Données © OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}

function formatShortLabel(r) {
  // Prefer the most specific local name
  const a = r.address || {};
  return a.city || a.town || a.village || a.hamlet || a.municipality
    || a.attraction || a.peak || a.mountain || a.natural || a.tourism
    || r.name || (r.display_name || '').split(',')[0];
}

function formatContext(r) {
  const a = r.address || {};
  const parts = [a.county || a.state_district, a.state, a.country].filter(Boolean);
  return parts.join(' · ');
}

function pickResultIcon(r) {
  const cls = (r.class || '') + '/' + (r.type || '');
  if (/peak|mountain|natural/.test(cls)) return I.Mountain;
  if (/water|lake|river|bay|coastline/.test(cls)) return I.Wave || I.Globe;
  if (/city|town|village|hamlet|administrative/.test(cls)) return I.Pin;
  if (/tourism|attraction|park/.test(cls)) return I.Compass;
  return I.Pin;
}

window.PlaceSearch = PlaceSearch;
