// Statistiques GR34 — tableau triable des étapes + graphiques (km, km effort,
// D+, durée). Même langage visuel que les Paramètres (settings.jsx).
//
// Données : sections de l'itinéraire GR34 (groups) + window.GR34_STAGES
// (calculs du build) + infos saisies (date, durée réelle) gardées dans le
// navigateur, avec gpx/etapes.json (window.GR34_META) comme valeurs de base.

const { useState: useMetState, useMemo: useMetMemo, useEffect: useMetEffect, useRef: useMetRef } = React;

const GR34_META_KEY = 'gr34_meta_v1';

function readGr34LocalMeta() {
  try { return JSON.parse(localStorage.getItem(GR34_META_KEY) || '{}') || {}; } catch (e) { return {}; }
}

// "7h30", "7 h 30", "7:30", "7.5h", "450" (minutes) -> minutes
function parseDurationInput(input) {
  const s = String(input || '').trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  let m = s.match(/^(\d+)\s*(?:h|:)\s*(\d{1,2})?\s*(?:min|m)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  m = s.match(/^(\d+(?:\.\d+)?)\s*h$/);
  if (m) return Math.round(Number(m[1]) * 60);
  m = s.match(/^(\d+)\s*(?:min|m)?$/);
  if (m) return Number(m[1]);
  return null;
}

// Espace insécable « normale » comme séparateur de milliers (l'espace fine
// U+202F de fr-FR est quasi invisible en Barlow)
const fmtNum = (n, d = 1) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202f/g, '\u00a0');

function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Construit les lignes du tableau à partir des étapes GR34 (itinéraires du dépôt)
function useGr34Rows(groups, meta) {
  return useMetMemo(() => {
    // Étapes du dépôt : un itinéraire par fichier GPX
    const stagesIts = groups.flatMap((g) => g.itineraries).filter((x) => x.fromRepo && x.num).sort((a, b) => a.num - b.num);
    const byNum = new Map((window.GR34_STAGES || []).map((st) => [st.num, st]));
    return stagesIts.map((sec) => {
      const st = byNum.get(sec.num) || {};
      const m = meta[String(sec.num)] || {};
      const distance = sec.distance || 0;
      const ascent = sec.ascent || 0;
      const kmEffort = distance + ascent / 100;
      const manual = m.duree ? parseDurationInput(m.duree) : null;
      let durationMin, durationSource;
      if (manual != null) { durationMin = manual; durationSource = 'saisie'; }
      else if (st.gpxMovingMin) { durationMin = st.gpxMovingMin; durationSource = 'gpx'; }
      else { durationMin = estimateDurationMin(distance, ascent, 'hiking'); durationSource = 'estimée'; }
      const h = durationMin / 60;
      return {
        id: sec.id,
        num: sec.num,
        name: sec.name.replace(/^Étape \d+ — /, ''),
        color: sec.color,
        date: m.date || (st.gpxDate ? st.gpxDate.slice(0, 10) : ''),
        duree: m.duree || '',
        distance,
        ascent,
        descent: sec.descent != null ? sec.descent : (st.elevationLoss || 0),
        kmEffort,
        durationMin,
        durationSource,
        speed: h > 0 ? distance / h : 0,
        effortSpeed: h > 0 ? kmEffort / h : 0,
        gainPerKm: distance > 0 ? ascent / distance : 0,
        altMax: st.altMax || 0,
      };
    });
  }, [groups, meta]);
}

function MetricsContent({ groups, dark, accent, onShowStage }) {
  const [localMeta, setLocalMeta] = useMetState(readGr34LocalMeta);
  useMetEffect(() => {
    try { localStorage.setItem(GR34_META_KEY, JSON.stringify(localMeta)); } catch (e) {}
  }, [localMeta]);
  const meta = useMetMemo(() => {
    const base = window.GR34_META || {};
    const out = {};
    new Set([...Object.keys(base), ...Object.keys(localMeta)]).forEach((k) => { out[k] = { ...(base[k] || {}), ...(localMeta[k] || {}) }; });
    return out;
  }, [localMeta]);
  const updateMeta = (num, patch) => setLocalMeta((prev) => ({ ...prev, [num]: { ...(prev[num] || {}), ...patch } }));

  const rows = useGr34Rows(groups, meta);
  const [sort, setSort] = useMetState({ key: 'num', dir: 1 });

  const totals = useMetMemo(() => {
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    const km = sum('distance'), eff = sum('kmEffort'), gain = sum('ascent'), loss = sum('descent'), dur = sum('durationMin');
    return {
      km, eff, gain, loss, dur,
      speed: dur ? km / (dur / 60) : 0,
      effortSpeed: dur ? eff / (dur / 60) : 0,
      gainPerKm: km ? gain / km : 0,
      altMax: rows.reduce((a, r) => Math.max(a, r.altMax), 0),
      estimated: rows.filter((r) => r.durationSource === 'estimée').length,
    };
  }, [rows]);

  const sorted = useMetMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key];
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'fr');
      return c * sort.dir || a.num - b.num;
    });
    return arr;
  }, [rows, sort]);

  const onSort = (key) => setSort((s) => s.key === key
    ? { key, dir: -s.dir }
    : { key, dir: ['num', 'name', 'date'].includes(key) ? 1 : -1 });

  const exportJson = () => {
    const clean = {};
    Object.entries(meta).forEach(([k, v]) => {
      const e = {};
      Object.entries(v).forEach(([kk, vv]) => { if (vv) e[kk] = vv; });
      if (Object.keys(e).length) clean[k] = e;
    });
    const blob = new Blob([JSON.stringify(clean, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'etapes.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const muted = dark ? 'text-neutral-500' : 'text-neutral-500';
  const strong = dark ? 'text-white' : 'text-neutral-900';
  const cardCls = `rounded-md border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80'}`;

  const cols = [
    { key: 'num', label: '#', num: true },
    { key: 'name', label: 'Étape' },
    { key: 'date', label: 'Date' },
    { key: 'distance', label: 'Distance', num: true },
    { key: 'ascent', label: 'D+', num: true },
    { key: 'descent', label: 'D−', num: true },
    { key: 'kmEffort', label: 'Km effort', num: true, title: 'km + D+/100' },
    { key: 'durationMin', label: 'Durée', num: true },
    { key: 'speed', label: 'Vitesse', num: true, title: 'km/h sur la durée' },
    { key: 'effortSpeed', label: 'Allure effort', num: true, title: 'km effort par heure' },
    { key: 'gainPerKm', label: 'D+/km', num: true },
    { key: 'altMax', label: 'Alt. max', num: true },
  ];

  if (!rows.length) {
    return (
      <div className={`flex flex-col h-full items-center justify-center glass-backdrop ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
        <I.FileGpx size={28} />
        <p className="mt-3 text-[13px]">Aucune étape GR34. Ajoute tes fichiers .gpx dans le dossier <span className="font-mono">gpx/</span> du dépôt.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full glass-backdrop">
      {/* Top bar */}
      <div className={`px-8 pt-7 pb-5 border-b flex items-end justify-between gap-4 flex-wrap ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
        <div>
          <div className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>GR34 · Sentier des douaniers</div>
          <h1 className={`mt-0.5 text-[22px] font-semibold tracking-tight ${strong}`}>Statistiques</h1>
        </div>
        <button
          onClick={exportJson}
          title="Télécharger gpx/etapes.json (dates et durées) pour le versionner avec les GPX"
          className={`flex items-center gap-1.5 text-[12px] font-medium rounded-md px-3 py-1.5 border transition-colors ${dark ? 'border-neutral-800 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 text-neutral-700 bg-white hover:bg-neutral-100'}`}
        >
          <I.Download size={14} /> Exporter etapes.json
        </button>
      </div>

      <div className="flex-1 overflow-y-auto sb-scroll">
        <div className="max-w-6xl mx-auto px-8 py-7 flex flex-col gap-6">
          {/* KPIs */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <MetKpi dark={dark} icon={<I.Flag size={14} />} label="Étapes" value={String(rows.length)} />
            <MetKpi dark={dark} icon={<I.Distance size={14} />} label="Distance" value={fmtNum(totals.km)} unit="km" sub={`${fmtNum(totals.km / rows.length)} km / étape`} />
            <MetKpi dark={dark} icon={<I.Ruler size={14} />} label="Km effort" value={fmtNum(totals.eff)} unit="km-e" sub={`+${fmtNum(totals.eff - totals.km)} vs distance`} />
            <MetKpi dark={dark} icon={<I.TrendingUp size={14} />} label="Dénivelé +" value={fmtAscent(totals.gain).replace(' m', '')} unit="m" sub={`${Math.round(totals.gain / rows.length)} m / étape`} />
            <MetKpi dark={dark} icon={<I.Clock size={14} />} label="Durée" value={fmtDuration(totals.dur)}
              sub={totals.estimated ? `dont ${totals.estimated} estimée${totals.estimated > 1 ? 's' : ''}` : 'durées réelles'} />
          </div>

          {/* Table */}
          <section className={cardCls}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${muted}`}>Étapes</h3>
              <span className={`text-[11px] ${muted}`}>Clique sur une colonne pour trier · sur une étape pour la voir sur la carte</span>
            </div>
            <div className="overflow-x-auto sb-scroll">
              <table className="w-full text-[12px] whitespace-nowrap">
                <thead>
                  <tr className={`border-b ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
                    {cols.map((c) => {
                      const active = sort.key === c.key;
                      return (
                        <th key={c.key} title={c.title} className={`px-2.5 py-2 font-medium ${c.num ? 'text-right' : 'text-left'}`}
                          aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                          <button onClick={() => onSort(c.key)}
                            className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider transition-colors ${active ? (dark ? 'text-white' : 'text-neutral-900') : (dark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-500 hover:text-neutral-800')}`}>
                            {c.label}
                            {active
                              ? (sort.dir === 1 ? <I.ChevronUp size={12} /> : <I.ChevronDown size={12} />)
                              : <span className="opacity-0"><I.ChevronDown size={12} /></span>}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id}
                      className={`border-b last:border-b-0 transition-colors ${dark ? 'border-neutral-800/70 hover:bg-neutral-800/40' : 'border-neutral-100 hover:bg-neutral-50'}`}>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex items-center gap-2 font-mono ${strong}`}>
                          <span className="w-2 h-2 rounded-full" style={{ background: ROUTE_COLORS[r.color].hex }}></span>{r.num}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => onShowStage && onShowStage(r.id)} title="Voir sur la carte"
                          className={`font-medium hover:underline underline-offset-2 ${strong}`}>{r.name}</button>
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="date" value={r.date} title={fmtDateShort(r.date)} aria-label={`Date de l'étape ${r.num}`}
                          onChange={(e) => updateMeta(r.num, { date: e.target.value })}
                          className={`rounded-md border px-1.5 py-1 text-[12px] font-mono bg-transparent ${dark ? 'border-transparent hover:border-neutral-700 text-neutral-300 [color-scheme:dark]' : 'border-transparent hover:border-neutral-200 text-neutral-700'}`} />
                      </td>
                      <MetNum dark={dark}>{fmtNum(r.distance)} km</MetNum>
                      <MetNum dark={dark}>{fmtAscent(r.ascent)}</MetNum>
                      <MetNum dark={dark}>{fmtAscent(r.descent)}</MetNum>
                      <MetNum dark={dark}>{fmtNum(r.kmEffort)}</MetNum>
                      <td className="px-3 py-1.5 text-right"><MetDurationCell row={r} dark={dark} onCommit={(v) => updateMeta(r.num, { duree: v })} /></td>
                      <MetNum dark={dark}>{fmtNum(r.speed)} km/h</MetNum>
                      <MetNum dark={dark}>{fmtNum(r.effortSpeed)} km-e/h</MetNum>
                      <MetNum dark={dark}>{Math.round(r.gainPerKm)} m</MetNum>
                      <MetNum dark={dark}>{fmtAscent(r.altMax)}</MetNum>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 font-semibold ${dark ? 'border-neutral-800 text-white' : 'border-neutral-200 text-neutral-900'}`}>
                    <td></td>
                    <td className="px-3 py-2.5">Total</td>
                    <td></td>
                    <MetNum dark={dark} strong>{fmtNum(totals.km)} km</MetNum>
                    <MetNum dark={dark} strong>{fmtAscent(totals.gain)}</MetNum>
                    <MetNum dark={dark} strong>{fmtAscent(totals.loss)}</MetNum>
                    <MetNum dark={dark} strong>{fmtNum(totals.eff)}</MetNum>
                    <MetNum dark={dark} strong>{fmtDuration(totals.dur)}</MetNum>
                    <MetNum dark={dark} strong>{fmtNum(totals.speed)} km/h</MetNum>
                    <MetNum dark={dark} strong>{fmtNum(totals.effortSpeed)} km-e/h</MetNum>
                    <MetNum dark={dark} strong>{Math.round(totals.gainPerKm)} m</MetNum>
                    <MetNum dark={dark} strong>{fmtAscent(totals.altMax)}</MetNum>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className={`px-4 py-3 text-[11px] border-t ${dark ? 'border-neutral-800 text-neutral-500' : 'border-neutral-100 text-neutral-500'}`}>
              Durée : saisis ta durée réelle (ex. <span className="font-mono">7h30</span>). Sinon elle vient des horaires du GPX
              (<span className="font-mono">GPX</span>) ou est estimée comme sur la carte (<span className="font-mono">EST.</span>, rando 4,2 km/h + 1 min / 10 m de D+).
              Km effort = km + D+/100.
            </p>
          </section>

          {/* Charts */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
            <MetChartCard dark={dark} title="Distance et km effort par étape"
              legend={[{ label: 'Distance', color: '#3b82f6' }, { label: 'Km effort', color: '#f97316' }]}>
              <MetBarChart dark={dark} rows={rows} unit="km"
                series={[
                  { key: 'distance', label: 'Distance', color: '#3b82f6', fmt: (v) => fmtNum(v) + ' km' },
                  { key: 'kmEffort', label: 'Km effort', color: '#f97316', fmt: (v) => fmtNum(v) + ' km-e' },
                ]} />
            </MetChartCard>
            <MetChartCard dark={dark} title="Cumul : distance et km effort"
              legend={[{ label: 'Distance cumulée', color: '#3b82f6' }, { label: 'Km effort cumulés', color: '#f97316' }]}>
              <MetCumulChart dark={dark} rows={rows} />
            </MetChartCard>
            <MetChartCard dark={dark} title="Dénivelé positif par étape">
              <MetBarChart dark={dark} rows={rows} unit="m" byStageColor labels
                series={[{ key: 'ascent', label: 'D+', fmt: (v) => fmtAscent(v) }]} />
            </MetChartCard>
            <MetChartCard dark={dark} title="Durée par étape">
              <MetBarChart dark={dark} rows={rows} unit="h" byStageColor labels
                series={[{ key: 'durationMin', label: 'Durée', scale: 1 / 60, fmt: (v, r) => fmtDuration(v * 60) + (r.durationSource === 'estimée' ? ' (estimée)' : '') }]} />
            </MetChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetKpi({ dark, icon, label, value, unit, sub }) {
  return (
    <div className={`rounded-md border px-4 py-3 ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80'}`}>
      <div className={`flex items-center gap-1.5 text-[11.5px] ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{icon}{label}</div>
      <div className={`mt-1 font-mono text-[22px] font-medium tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>
        {value}{unit && <span className={`ml-1 text-[12px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{unit}</span>}
      </div>
      {sub && <div className={`text-[11px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{sub}</div>}
    </div>
  );
}

function MetNum({ children, dark, strong }) {
  return <td className={`px-2.5 py-2 text-right font-mono ${strong ? '' : (dark ? 'text-neutral-300' : 'text-neutral-700')}`}>{children}</td>;
}

function MetDurationCell({ row, dark, onCommit }) {
  const [draft, setDraft] = useMetState(null);
  const cancelled = useMetRef(false);
  const display = row.durationSource === 'saisie' ? fmtDuration(row.durationMin) : '';
  const invalid = draft != null && draft.trim() !== '' && parseDurationInput(draft) == null;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {row.durationSource !== 'saisie' && (
        <span className={`text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${row.durationSource === 'gpx'
          ? (dark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
          : (dark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-500')}`}>
          {row.durationSource === 'gpx' ? 'GPX' : 'Est.'}
        </span>
      )}
      <input
        value={draft != null ? draft : display}
        placeholder={fmtDuration(row.durationMin)}
        aria-label={`Durée réelle de l'étape ${row.num}`}
        onFocus={() => setDraft(display)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!cancelled.current && draft != null && !invalid) onCommit(draft.trim());
          cancelled.current = false;
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') { cancelled.current = true; e.target.blur(); }
        }}
        className={`w-[78px] text-right font-mono text-[12.5px] rounded-md border px-1.5 py-1 bg-transparent transition-colors ${invalid
          ? 'border-rose-400'
          : (dark ? 'border-transparent hover:border-neutral-700 focus:border-neutral-600 text-neutral-200 placeholder:text-neutral-400' : 'border-transparent hover:border-neutral-200 focus:border-neutral-300 text-neutral-900 placeholder:text-neutral-500')}`}
      />
    </span>
  );
}

function MetChartCard({ dark, title, legend, children }) {
  return (
    <section className={`rounded-md border p-4 ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80'}`}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h3 className={`text-[13px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>{title}</h3>
        {legend && (
          <div className="flex items-center gap-3">
            {legend.map((l) => (
              <span key={l.label} className={`flex items-center gap-1.5 text-[11px] ${dark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: l.color }}></span>{l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

// Graduations « rondes » : 4 intervalles au-dessus du max
function metNiceScale(max) {
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((s) => s * 4 >= max * 1.05) || Math.ceil(max / 4);
  return { max: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
}

const MET_W = 520, MET_H = 230, MET_PAD = { l: 44, r: 12, t: 18, b: 26 };

function MetTooltip({ dark, x, y, children }) {
  return (
    <div className="absolute z-10 pointer-events-none animate-tip-fixed"
      style={{ left: `${x * 100}%`, top: y, transform: `translate(${x > 0.7 ? '-100%' : x < 0.3 ? '0' : '-50%'}, -100%)` }}>
      <div className={`rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap ${dark ? 'bg-neutral-800 text-neutral-100 border border-neutral-700' : 'bg-neutral-900 text-white'}`}>
        {children}
      </div>
    </div>
  );
}

function MetAxes({ dark, scale, unit }) {
  const ih = MET_H - MET_PAD.t - MET_PAD.b;
  return scale.ticks.map((t) => {
    const y = MET_PAD.t + ih - (t / scale.max) * ih;
    return (
      <g key={t}>
        <line x1={MET_PAD.l} x2={MET_W - MET_PAD.r} y1={y} y2={y} stroke={dark ? '#262626' : '#f0f0f0'} />
        <text x={MET_PAD.l - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fill={dark ? '#737373' : '#a3a3a3'} className="font-mono">
          {fmtNum(t, t % 1 ? 1 : 0)}{t === scale.max ? ' ' + unit : ''}
        </text>
      </g>
    );
  });
}

function MetBarChart({ dark, rows, series, unit, byStageColor, labels }) {
  const [hover, setHover] = useMetState(null);
  const val = (r, s) => r[s.key] * (s.scale || 1);
  const scale = metNiceScale(Math.max(1e-6, ...rows.flatMap((r) => series.map((s) => val(r, s)))));
  const iw = MET_W - MET_PAD.l - MET_PAD.r, ih = MET_H - MET_PAD.t - MET_PAD.b;
  const band = iw / rows.length;
  const gap = 2;
  const barW = Math.min(30, (band * 0.62 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v) => MET_PAD.t + ih - (v / scale.max) * ih;
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${MET_W} ${MET_H}`} className="w-full h-auto block" role="img" aria-label={series.map((s) => s.label).join(', ') + ' par étape'}>
        <MetAxes dark={dark} scale={scale} unit={unit} />
        {rows.map((r, i) => {
          const x0 = MET_PAD.l + band * i + (band - groupW) / 2;
          return (
            <g key={r.id}>
              {hover === i && <rect x={MET_PAD.l + band * i + 2} y={MET_PAD.t} width={band - 4} height={ih} rx="6" fill={dark ? '#ffffff0a' : '#0000000a'} />}
              {series.map((s, si) => {
                const v = val(r, s);
                const top = y(v), h = Math.max(0, MET_PAD.t + ih - top);
                const color = byStageColor ? ROUTE_COLORS[r.color].hex : s.color;
                const x = x0 + si * (barW + gap);
                const rr = Math.min(4, h, barW / 2);
                return (
                  <g key={s.key}>
                    <path d={`M${x},${top + h} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + barW - rr} Q${x + barW},${top} ${x + barW},${top + rr} V${top + h} Z`} fill={color} />
                    {labels && (
                      <text x={x + barW / 2} y={top - 5} textAnchor="middle" fontSize="10.5" fill={dark ? '#a3a3a3' : '#525252'} className="font-mono">
                        {unit === 'h' ? fmtDuration(v * 60) : Math.round(v)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={MET_PAD.l + band * i + band / 2} y={MET_H - 8} textAnchor="middle" fontSize="11" fill={dark ? '#a3a3a3' : '#525252'} className="font-mono">#{r.num}</text>
              <rect x={MET_PAD.l + band * i} y={MET_PAD.t} width={band} height={ih + MET_PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <MetTooltip dark={dark} x={(MET_PAD.l + band * hover + band / 2) / MET_W} y={8}>
          <div className="font-semibold mb-0.5">#{rows[hover].num} {rows[hover].name}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: byStageColor ? ROUTE_COLORS[rows[hover].color].hex : s.color }}></span>
              <span className="opacity-70">{s.label}</span>
              <span className="ml-auto pl-3 font-mono">{s.fmt(val(rows[hover], s), rows[hover])}</span>
            </div>
          ))}
        </MetTooltip>
      )}
    </div>
  );
}

function MetCumulChart({ dark, rows }) {
  const [hover, setHover] = useMetState(null);
  const pts = [];
  let km = 0, eff = 0, gain = 0;
  rows.forEach((r) => { km += r.distance; eff += r.kmEffort; gain += r.ascent; pts.push({ r, km, eff, gain }); });
  const scale = metNiceScale(Math.max(1, eff));
  const iw = MET_W - MET_PAD.l - MET_PAD.r - 66, ih = MET_H - MET_PAD.t - MET_PAD.b;
  const x = (i) => MET_PAD.l + 14 + (pts.length > 1 ? (i / (pts.length - 1)) * (iw - 14) : iw / 2);
  const y = (v) => MET_PAD.t + ih - (v / scale.max) * ih;
  const line = (k) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[k])}`).join(' ');
  const series = [{ k: 'km', color: '#3b82f6', unit: 'km' }, { k: 'eff', color: '#f97316', unit: 'km-e' }];
  const last = pts[pts.length - 1];
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${MET_W} ${MET_H}`} className="w-full h-auto block" role="img" aria-label="Distance et km effort cumulés">
        <MetAxes dark={dark} scale={scale} unit="km" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={MET_PAD.t} y2={MET_PAD.t + ih} stroke={dark ? '#525252' : '#d4d4d4'} strokeDasharray="3 3" />}
        {series.map((s) => (
          <g key={s.k}>
            <path d={line(s.k)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p[s.k])} r={hover === i ? 5 : 3.5} fill={dark ? '#0a0a0a' : '#fff'} stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        ))}
        {last && series.map((s, si) => (
          <text key={s.k} x={x(pts.length - 1) + 9} y={y(last[s.k]) + (si === 0 ? 10 : -2)} fontSize="11" fontWeight="600" fill={dark ? '#e5e5e5' : '#171717'} className="font-mono">
            {Math.round(last[s.k])} {s.unit}
          </text>
        ))}
        {pts.map((p, i) => (
          <g key={p.r.id}>
            <text x={x(i)} y={MET_H - 8} textAnchor="middle" fontSize="11" fill={dark ? '#a3a3a3' : '#525252'} className="font-mono">#{p.r.num}</text>
            <rect x={x(i) - (iw / Math.max(1, pts.length - 1)) / 2} y={MET_PAD.t} width={iw / Math.max(1, pts.length - 1)} height={ih + MET_PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
      </svg>
      {hover != null && (
        <MetTooltip dark={dark} x={x(hover) / MET_W} y={8}>
          <div className="font-semibold mb-0.5">Après l'étape #{pts[hover].r.num}</div>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3b82f6' }}></span><span className="opacity-70">Distance</span><span className="ml-auto pl-3 font-mono">{fmtNum(pts[hover].km)} km</span></div>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#f97316' }}></span><span className="opacity-70">Km effort</span><span className="ml-auto pl-3 font-mono">{fmtNum(pts[hover].eff)} km-e</span></div>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full opacity-0"></span><span className="opacity-70">D+</span><span className="ml-auto pl-3 font-mono">{fmtAscent(pts[hover].gain)}</span></div>
        </MetTooltip>
      )}
    </div>
  );
}

Object.assign(window, { MetricsContent, parseDurationInput });
