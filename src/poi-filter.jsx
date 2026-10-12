// POI filter button — sits next to the place search.
// Click → popover with toggle list of POI categories. Active filters are
// stored in localStorage and bubbled up via onChange.

const { useState: usePoiState, useEffect: usePoiEffect, useRef: usePoiRef } = React;

// POI icons must match the ones used on the map. Filled variants for the filter list.
const POI_FILTER_TYPES = [
  { key: 'parking',       label: 'Parking',         icon: 'ParkingFill',       color: '#6366f1' },
  { key: 'toilet',        label: 'Toilettes',       icon: 'ToiletFill',        color: '#737373' },
  { key: 'water',         label: "Point d'eau",     icon: 'WaterFill',         color: '#0ea5e9' },
  { key: 'refuge',        label: 'Refuge',          icon: 'AccommodationFill', color: '#f59e0b' },
  { key: 'restaurant',    label: 'Restauration',    icon: 'RestaurantFill',    color: '#f97316' },
  { key: 'pharmacy',      label: 'Pharmacie',       icon: 'MedicalFill',       color: '#f43f5e' },
  { key: 'viewpoint',     label: 'Point de vue',    icon: 'CameraFill',        color: '#10b981' },
  { key: 'shelter',       label: 'Abri',            icon: 'FlagFill',          color: '#8b5cf6' },
];

window.POI_FILTER_TYPES = POI_FILTER_TYPES;

function PoiFilterButton({ dark, accent, active, onChange }) {
  const [open, setOpen] = usePoiState(false);
  const ref = usePoiRef(null);

  usePoiEffect(() => {
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

  const toggle = (key) => {
    const set = new Set(active || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange && onChange(Array.from(set));
  };

  const activeCount = (active || []).length;
  const Tooltip = window.Tooltip;
  const allOn = activeCount === POI_FILTER_TYPES.length;
  const toggleAll = () => {
    onChange && onChange(allOn ? [] : POI_FILTER_TYPES.map((t) => t.key));
  };

  return (
    <div ref={ref} className="relative">
      <Tooltip dark={dark} label="Points d'intérêt" sub="Voir les points d'intérêt à proximité" side="bottom">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center gap-1.5 h-10 px-3 rounded-lg shadow-lg transition-colors ${
          dark ? 'bg-neutral-900 border border-neutral-700/50 text-neutral-200 hover:bg-neutral-800'
               : 'bg-white border border-neutral-200/80 text-neutral-700 hover:bg-neutral-50'
        } ${activeCount > 0 ? 'ring-2' : ''}`}
        style={activeCount > 0 ? { boxShadow: `0 0 0 1.5px ${accent}55, 0 2px 8px rgba(0,0,0,0.1)` } : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <I.MarkerPin size={16} />
        <span className="text-[12.5px] font-medium">Points d'intérêt</span>
        {activeCount > 0 ? (
          <span
            className="ml-0.5 grid place-items-center rounded-full font-semibold tabular-nums"
            style={{ background: accent, color: '#fff', width: 18, height: 18, fontSize: 11, lineHeight: '18px' }}
          >
            {activeCount}
          </span>
        ) : (
          <I.EyeOff size={15} className={`ml-0.5 ${dark ? 'text-neutral-500' : 'text-neutral-400'}`} />
        )}
      </button>
      </Tooltip>
      {open && (
        <div
          role="menu"
          className={`absolute left-0 top-full mt-1.5 z-30 w-[320px] rounded-lg shadow-2xl overflow-hidden animate-menu ${
            dark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white border border-neutral-200'
          }`}
        >
          <div className={`px-3 py-2 ${dark ? 'border-b border-neutral-800' : 'border-b border-neutral-100'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Afficher sur la carte
              </span>
              <span
                role="switch"
                aria-checked={allOn}
                onClick={toggleAll}
                title={allOn ? 'Tout désélectionner' : 'Tout sélectionner'}
                style={{
                  width: 28, height: 16, borderRadius: 999,
                  background: allOn ? accent : (dark ? '#404040' : '#d4d4d4'),
                  position: 'relative', cursor: 'pointer', flexShrink: 0,
                  transition: 'background .15s ease',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: allOn ? 14 : 2,
                  width: 12, height: 12, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left .15s ease',
                }}></span>
              </span>
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto sb-scroll py-1">
            {POI_FILTER_TYPES.map((t) => {
              const isOn = (active || []).includes(t.key);
              const Ic = (window.I && window.I[t.icon]) || (window.I && window.I.Pin) || (() => null);
              return (
                <button
                  key={t.key}
                  onClick={() => toggle(t.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${dark ? 'hover:bg-neutral-800/60' : 'hover:bg-neutral-50'}`}
                >
                  <span
                    className="w-7 h-7 rounded-md grid place-items-center shrink-0"
                    style={{ background: t.color + '22', color: t.color }}
                  >
                    <Ic size={14} />
                  </span>
                  <span className={`flex-1 text-[12.5px] font-medium ${dark ? 'text-neutral-100' : 'text-neutral-800'}`}>{t.label}</span>
                  {/* Toggle */}
                  <span
                    role="switch"
                    aria-checked={isOn}
                    style={{
                      width: 28, height: 16, borderRadius: 999,
                      background: isOn ? accent : (dark ? '#404040' : '#d4d4d4'),
                      position: 'relative',
                      transition: 'background .15s ease',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: 2, left: isOn ? 14 : 2,
                      width: 12, height: 12,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      transition: 'left .15s ease',
                    }}></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

window.PoiFilterButton = PoiFilterButton;
