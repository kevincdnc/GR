// Statistiques des activités affichées dans la navigation — tableau triable + graphiques (km, km effort,
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

// Construit les lignes du tableau à partir des itinéraires affichés dans la
// navigation (tous groupes confondus, dans leur ordre). Les étapes du dépôt
// gardent leurs infos de build (durée GPX, alt. max) et leur clé de saisie
// par numéro (compatible gpx/etapes.json) ; les autres sont clés par id.
function useMetricsRows(groups, visibleIds, meta) {
  return useMetMemo(() => {
    const byNum = new Map((window.GR34_STAGES || []).map((st) => [st.num, st]));
    const items = [];
    const selectedGroups = [];
    groups.forEach((g) => {
      let count = 0;
      g.itineraries.forEach((it) => {
        const parts = it.sections && it.sections.length
          ? it.sections.map((sec) => ({ ...sec, color: sec.color || it.color, activity: it.activity, fromRepo: it.fromRepo }))
          : [it];
        parts.forEach((x) => { if (visibleIds.has(x.id)) { items.push({ x, group: g }); count++; } });
      });
      if (count) selectedGroups.push({ id: g.id, name: g.name, icon: g.icon, count });
    });
    const rows = items.map(({ x, group }, i) => {
      const repo = !!(x.fromRepo && x.num);
      const st = (repo && byNum.get(x.num)) || {};
      const metaKey = repo ? String(x.num) : x.id;
      const m = meta[metaKey] || {};
      const needStats = !repo && x.coords && x.coords.length > 1;
      const stats = needStats ? computeElevationStats(x.coords) : null;
      const realEle = needStats && x.coords.every((c) => c.length >= 3 && typeof c[2] === 'number');
      const distance = x.distance || 0;
      const ascent = x.ascent || 0;
      const kmEffort = distance + ascent / 100;
      const manual = m.duree ? parseDurationInput(m.duree) : null;
      let durationMin, durationSource;
      if (manual != null) { durationMin = manual; durationSource = 'saisie'; }
      else if (st.gpxMovingMin || x.movingMin) { durationMin = st.gpxMovingMin || x.movingMin; durationSource = 'gpx'; }
      else { durationMin = estimateDurationMin(distance, ascent, x.activity || 'hiking'); durationSource = 'estimée'; }
      const h = durationMin / 60;
      const pos = i + 1;
      return {
        id: x.id,
        pos,
        num: x.num || 0,
        label: String(x.num || pos),
        metaKey,
        groupName: group.name,
        name: x.name.replace(/^Étape \d+ — /, ''),
        color: ROUTE_COLORS[x.color] ? x.color : 'blue',
        date: m.date || ((st.gpxDate || x.gpxDate) ? (st.gpxDate || x.gpxDate).slice(0, 10) : ''),
        duree: m.duree || '',
        distance,
        ascent,
        descent: x.descent != null ? x.descent : (st.elevationLoss || (realEle ? stats.descent : 0)),
        kmEffort,
        durationMin,
        durationSource,
        // Durée totale (pauses comprises) : horaires du GPX, sinon inconnue
        totalMin: st.gpxTotalMin || x.totalMin || null,
        speed: h > 0 ? distance / h : 0,
        effortSpeed: h > 0 ? kmEffort / h : 0,
        gainPerKm: distance > 0 ? ascent / distance : 0,
        altMax: st.altMax || (realEle ? Math.round(stats.maxAlt) : 0),
      };
    });
    return { rows, selectedGroups };
  }, [groups, visibleIds, meta]);
}

function MetricsContent({ groups, visibleIds, dark, accent, onShowStage }) {
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

  const { rows, selectedGroups } = useMetricsRows(groups, visibleIds || new Set(), meta);
  const [sort, setSort] = useMetState({ key: 'pos', dir: 1 });

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
      totalDur: rows.reduce((a, r) => a + (r.totalMin || 0), 0),
      withTotal: rows.filter((r) => r.totalMin).length,
    };
  }, [rows]);

  const sorted = useMetMemo(() => {
    const arr = rows.slice();
    arr.sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key];
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''), 'fr');
      return c * sort.dir || a.pos - b.pos;
    });
    return arr;
  }, [rows, sort]);

  const onSort = (key) => setSort((s) => s.key === key
    ? { key, dir: -s.dir }
    : { key, dir: ['pos', 'name', 'date'].includes(key) ? 1 : -1 });

  const exportJson = () => {
    const clean = {};
    Object.entries(meta).forEach(([k, v]) => {
      if (!/^\d+$/.test(k)) return; // etapes.json : étapes du dépôt seulement
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
    { key: 'pos', label: '#', num: true },
    { key: 'name', label: 'Activité' },
    { key: 'date', label: 'Date' },
    { key: 'distance', label: 'Distance', num: true },
    { key: 'ascent', label: 'D+', num: true },
    { key: 'descent', label: 'D−', num: true },
    { key: 'kmEffort', label: 'Km effort', num: true, title: 'km + D+/100' },
    { key: 'durationMin', label: 'Durée nette', num: true, title: 'Temps en mouvement (pauses exclues)' },
    { key: 'totalMin', label: 'Durée totale', num: true, title: 'Du départ à l\'arrivée, pauses comprises (horaires du GPX)' },
    { key: 'speed', label: 'Vitesse', num: true, title: 'km/h sur la durée' },
    { key: 'effortSpeed', label: 'Allure effort', num: true, title: 'km effort par heure' },
    { key: 'gainPerKm', label: 'D+/km', num: true },
    { key: 'altMax', label: 'Alt. max', num: true },
  ];

  if (!rows.length) {
    return (
      <div className={`flex flex-col h-full items-center justify-center text-center px-8 glass-backdrop ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>
        <I.EyeOff size={28} />
        <p className={`mt-3 text-[14px] font-medium ${strong}`}>Aucune activité sélectionnée</p>
        <p className="mt-1 text-[13px]">Affiche des itinéraires ou des groupes dans la navigation (icône œil) pour voir leurs statistiques.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full glass-backdrop">
      {/* Top bar */}
      <div className={`px-8 pt-7 pb-5 border-b flex items-end justify-between gap-4 flex-wrap ${dark ? 'border-neutral-800' : 'border-neutral-200/70'}`}>
        <div>
          <div className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>
            {rows.length} activité{rows.length > 1 ? 's' : ''} · {selectedGroups.length} groupe{selectedGroups.length > 1 ? 's' : ''} sélectionné{selectedGroups.length > 1 ? 's' : ''}
          </div>
          <h1 className={`mt-0.5 text-[22px] font-semibold tracking-tight ${strong}`}>Statistiques</h1>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {selectedGroups.map((g) => (
              <span key={g.id} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11.5px] ${dark ? 'border-neutral-800 bg-neutral-900/60 text-neutral-300' : 'border-neutral-200 bg-white text-neutral-700'}`}>
                {g.icon && !/^[A-Za-z]/.test(g.icon) && <span>{g.icon}</span>}
                <span className="font-medium">{g.name}</span>
                <span className={`tabular-nums ${muted}`}>{g.count}</span>
              </span>
            ))}
          </div>
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
            <MetKpi dark={dark} icon={<I.Flag size={14} />} label="Activités" value={String(rows.length)} />
            <MetKpi dark={dark} icon={<I.Distance size={14} />} label="Distance" value={fmtNum(totals.km)} unit="km" sub={`${fmtNum(totals.km / rows.length)} km / activité`} />
            <MetKpi dark={dark} icon={<I.Ruler size={14} />} label="Km effort" value={fmtNum(totals.eff)} unit="km-e" sub={`+${fmtNum(totals.eff - totals.km)} vs distance`} />
            <MetKpi dark={dark} icon={<I.TrendingUp size={14} />} label="Dénivelé +" value={fmtAscent(totals.gain).replace(' m', '')} unit="m" sub={`${Math.round(totals.gain / rows.length)} m / activité`} />
            <MetKpi dark={dark} icon={<I.Clock size={14} />} label="Durée nette" value={fmtDuration(totals.dur)}
              sub={[totals.withTotal ? `${fmtDuration(totals.totalDur)} avec pauses${totals.withTotal < rows.length ? ` (${totals.withTotal}/${rows.length} GPX)` : ''}` : null, totals.estimated ? `${totals.estimated} estimée${totals.estimated > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ') || 'durées réelles'} />
          </div>

          {/* Distance et km effort de chaque sortie */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <MetChartCard dark={dark} title="Distance par sortie" value={fmtNum(totals.km / rows.length)} unit="km en moyenne" sub="- - - moyenne">
              <MetActivityBars dark={dark} rows={rows} field="distance" color="#3b82f6" unit="km" label="Distance" />
            </MetChartCard>
            <MetChartCard dark={dark} title="Km effort par sortie" value={fmtNum(totals.eff / rows.length)} unit="km-e en moyenne" sub="- - - moyenne">
              <MetActivityBars dark={dark} rows={rows} field="kmEffort" color="#f97316" unit="km-e" label="Km effort" />
            </MetChartCard>
          </div>

          {/* Table */}
          <section className={cardCls}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${muted}`}>Activités</h3>
              <span className={`text-[11px] ${muted}`}>Clique sur une colonne pour trier · sur une activité pour la voir sur la carte</span>
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
                          <span className="w-2 h-2 rounded-full" style={{ background: ROUTE_COLORS[r.color].hex }}></span>{r.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => onShowStage && onShowStage(r.id)} title="Voir sur la carte"
                          className={`font-medium hover:underline underline-offset-2 ${strong}`}>{r.name}</button>
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="date" value={r.date} title={fmtDateShort(r.date)} aria-label={`Date de ${r.name}`}
                          onChange={(e) => updateMeta(r.metaKey, { date: e.target.value })}
                          className={`rounded-md border px-1.5 py-1 text-[12px] font-mono bg-transparent ${dark ? 'border-transparent hover:border-neutral-700 text-neutral-300 [color-scheme:dark]' : 'border-transparent hover:border-neutral-200 text-neutral-700'}`} />
                      </td>
                      <MetNum dark={dark}>{fmtNum(r.distance)} km</MetNum>
                      <MetNum dark={dark}>{fmtAscent(r.ascent)}</MetNum>
                      <MetNum dark={dark}>{fmtAscent(r.descent)}</MetNum>
                      <MetNum dark={dark}>{fmtNum(r.kmEffort)}</MetNum>
                      <td className="px-3 py-1.5 text-right"><MetDurationCell row={r} dark={dark} onCommit={(v) => updateMeta(r.metaKey, { duree: v })} /></td>
                      <MetNum dark={dark}>{r.totalMin ? <span title={r.durationSource !== 'estimée' && r.totalMin > r.durationMin ? 'dont ' + fmtDuration(r.totalMin - r.durationMin) + ' de pause' : undefined}>{fmtDuration(r.totalMin)}</span> : <span className={muted}>—</span>}</MetNum>
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
                    <MetNum dark={dark} strong>{totals.withTotal ? <span title={totals.withTotal < rows.length ? `Somme des ${totals.withTotal} activités dont le GPX est horodaté` : undefined}>{fmtDuration(totals.totalDur)}{totals.withTotal < rows.length && <span className={`ml-1 text-[10.5px] font-normal ${muted}`}>({totals.withTotal}/{rows.length})</span>}</span> : '—'}</MetNum>
                    <MetNum dark={dark} strong>{fmtNum(totals.speed)} km/h</MetNum>
                    <MetNum dark={dark} strong>{fmtNum(totals.effortSpeed)} km-e/h</MetNum>
                    <MetNum dark={dark} strong>{Math.round(totals.gainPerKm)} m</MetNum>
                    <MetNum dark={dark} strong>{fmtAscent(totals.altMax)}</MetNum>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className={`px-4 py-3 text-[11px] border-t ${dark ? 'border-neutral-800 text-neutral-500' : 'border-neutral-100 text-neutral-500'}`}>
              Durée nette : temps en mouvement. Saisis-la (ex. <span className="font-mono">7h30</span>), sinon elle vient des horaires du GPX
              (<span className="font-mono">GPX</span>, pauses exclues) ou est estimée comme sur la carte (<span className="font-mono">EST.</span>, rando 4,2 km/h + 1 min / 10 m de D+).
              Durée totale : du premier au dernier point horodaté du GPX, pauses comprises.
              Km effort = km + D+/100.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

function MetKpi({ dark, icon, label, value, unit, sub }) {
  return (
    <div className={`rounded-md border px-4 py-3 ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80'}`}>
      <div className={`flex items-center gap-1.5 text-[11.5px] font-medium ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{icon}{label}</div>
      <div className={`mt-1 font-mono text-[30px] leading-tight font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>
        {value}{unit && <span className={`ml-1 text-[13px] font-semibold ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{unit}</span>}
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
        aria-label={`Durée réelle de ${row.name}`}
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

function MetChartCard({ dark, title, value, unit, sub, legend, children }) {
  return (
    <section className={`rounded-md border p-4 ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200/80'}`}>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${dark ? 'text-neutral-400' : 'text-neutral-500'}`}>{title}</h3>
          {value != null && (
            <div className={`mt-0.5 font-mono text-[20px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>
              {value}{unit && <span className="ml-1 text-[12px] font-semibold text-neutral-500">{unit}</span>}
            </div>
          )}
        </div>
        {sub && <span className={`text-[11px] ${dark ? 'text-neutral-500' : 'text-neutral-500'}`}>{sub}</span>}
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

const MET_W = 520, MET_H = 230, MET_PAD = { l: 58, r: 12, t: 18, b: 26 };

function MetTooltip({ dark, x, y, children }) {
  return (
    <div className="absolute z-10 pointer-events-none animate-tip-fixed"
      style={{ left: `${x * 100}%`, top: y, transform: `translate(${x > 0.7 ? '-100%' : x < 0.3 ? '0' : '-50%'}, -100%)` }}>
      <div className={`rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap bg-black text-white`}>
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

// Une barre par activité (ordre de la navigation) ; valeur au-dessus des
// barres quand il y a la place, détail dans l'info-bulle.
function MetActivityBars({ dark, rows, field, color, unit, label }) {
  const [hover, setHover] = useMetState(null);
  const scale = metNiceScale(Math.max(1, ...rows.map((r) => r[field])));
  const iw = MET_W - MET_PAD.l - MET_PAD.r, ih = MET_H - MET_PAD.t - MET_PAD.b;
  const band = iw / Math.max(1, rows.length);
  const barW = Math.max(3, Math.min(34, band * 0.64));
  const y = (v) => MET_PAD.t + ih - (v / scale.max) * ih;
  const showValues = band >= 26;
  const labelEvery = Math.max(1, Math.ceil(rows.length / 14));
  const avg = rows.length ? rows.reduce((a, r) => a + r[field], 0) / rows.length : 0;
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${MET_W} ${MET_H}`} className="w-full h-auto block" role="img" aria-label={`${label} par activité`}>
        <MetAxes dark={dark} scale={scale} unit={unit} />
        {/* moyenne (sous les barres) */}
        <line x1={MET_PAD.l} x2={MET_W - MET_PAD.r} y1={y(avg)} y2={y(avg)} stroke={dark ? '#e5e5e5' : '#404040'} strokeOpacity="0.45" strokeDasharray="4 4" />
        {rows.map((r, i) => {
          const v = r[field];
          const top = y(v), h = Math.max(0, MET_PAD.t + ih - top);
          const x = MET_PAD.l + band * i + (band - barW) / 2;
          const rr = Math.min(4, h, barW / 2);
          const dim = hover != null && hover !== i;
          return (
            <g key={r.id}>
              <path d={`M${x},${top + h} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + barW - rr} Q${x + barW},${top} ${x + barW},${top + rr} V${top + h} Z`}
                fill={color} opacity={dim ? 0.45 : 1} />
              {showValues && (
                <text x={x + barW / 2} y={top - 5} textAnchor="middle" fontSize="10.5" fill={dark ? '#a3a3a3' : '#525252'} className="font-mono">{Math.round(v)}</text>
              )}
              {(i % labelEvery === 0 || i === rows.length - 1) && (
                <text x={x + barW / 2} y={MET_H - 8} textAnchor="middle" fontSize="10.5" fill={dark ? '#a3a3a3' : '#525252'} className="font-mono">{r.label}</text>
              )}
              <rect x={MET_PAD.l + band * i} y={MET_PAD.t} width={band} height={ih + MET_PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <MetTooltip dark={dark} x={(MET_PAD.l + band * hover + band / 2) / MET_W} y={8}>
          <div className="font-semibold mb-0.5">#{rows[hover].label} {rows[hover].name}</div>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }}></span><span className="opacity-70">{label}</span><span className="ml-auto pl-3 font-mono">{fmtNum(rows[hover][field])} {unit}</span></div>
        </MetTooltip>
      )}
    </div>
  );
}

Object.assign(window, { MetricsContent, parseDurationInput });
