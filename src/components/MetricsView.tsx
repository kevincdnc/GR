import { useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { stageColor, useChartTheme, type ChartTheme, type Stage, type StageMeta } from '../data'
import { fmt0, fmt1, fmtDate, fmtDuration, fmtKm, fmtM, parseDuration } from '../lib/format'

type SortKey =
  | 'num'
  | 'name'
  | 'date'
  | 'distanceKm'
  | 'elevationGain'
  | 'elevationLoss'
  | 'kmEffort'
  | 'durationMin'
  | 'speed'
  | 'effortSpeed'
  | 'gainPerKm'
  | 'altMax'

interface Col {
  key: SortKey
  label: string
  title?: string
  num?: boolean
  render: (s: Stage) => React.ReactNode
}

interface Props {
  stages: Stage[]
  pace: number
  setPace: (v: number) => void
  update: (num: number, patch: StageMeta) => void
  exportJson: () => void
}

export function MetricsView({ stages, pace, setPace, update, exportJson }: Props) {
  const t = useChartTheme()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'num', dir: 1 })

  const totals = useMemo(() => {
    const km = stages.reduce((a, s) => a + s.distanceKm, 0)
    const gain = stages.reduce((a, s) => a + s.elevationGain, 0)
    const loss = stages.reduce((a, s) => a + s.elevationLoss, 0)
    const eff = stages.reduce((a, s) => a + s.kmEffort, 0)
    const dur = stages.reduce((a, s) => a + s.durationMin, 0)
    const n = stages.length || 1
    return {
      km,
      gain,
      loss,
      eff,
      dur,
      altMax: Math.max(0, ...stages.map((s) => s.altMax)),
      speed: dur ? km / (dur / 60) : 0,
      effortSpeed: dur ? eff / (dur / 60) : 0,
      gainPerKm: km ? gain / km : 0,
      avgKm: km / n,
      avgGain: gain / n,
      estimated: stages.filter((s) => s.durationSource === 'estimée').length,
    }
  }, [stages])

  const sorted = useMemo(() => {
    const arr = stages.slice()
    arr.sort((a, b) => {
      const va = a[sort.key] ?? ''
      const vb = b[sort.key] ?? ''
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr')
      return c * sort.dir || a.num - b.num
    })
    return arr
  }, [stages, sort])

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'num' || key === 'name' || key === 'date' ? 1 : -1 }))

  const cols: Col[] = [
    { key: 'num', label: '#', num: true, render: (s) => <span className="num-cell"><span className="swatch" style={{ background: stageColor(s.num) }} />{s.num}</span> },
    { key: 'name', label: 'Étape', render: (s) => <span className="name-cell">{s.name}</span> },
    {
      key: 'date',
      label: 'Date',
      render: (s) => (
        <input
          className="cell-input"
          type="date"
          value={s.date ?? ''}
          aria-label={`Date de l'étape ${s.num}`}
          title={fmtDate(s.date)}
          onChange={(e) => update(s.num, { date: e.target.value })}
        />
      ),
    },
    { key: 'distanceKm', label: 'Distance', num: true, render: (s) => fmtKm(s.distanceKm) },
    { key: 'elevationGain', label: 'D+', num: true, render: (s) => fmtM(s.elevationGain) },
    { key: 'elevationLoss', label: 'D−', num: true, render: (s) => fmtM(s.elevationLoss) },
    { key: 'kmEffort', label: 'Km effort', title: 'km + D+/100', num: true, render: (s) => fmt1(s.kmEffort) },
    { key: 'durationMin', label: 'Durée', num: true, render: (s) => <DurationCell stage={s} update={update} /> },
    { key: 'speed', label: 'Vitesse', title: 'km/h (distance / durée)', num: true, render: (s) => `${fmt1(s.speed)} km/h` },
    { key: 'effortSpeed', label: 'Allure effort', title: 'km effort / heure', num: true, render: (s) => `${fmt1(s.effortSpeed)} km-e/h` },
    { key: 'gainPerKm', label: 'D+/km', title: 'mètres de D+ par km', num: true, render: (s) => `${fmt0(s.gainPerKm)} m` },
    { key: 'altMax', label: 'Alt. max', num: true, render: (s) => fmtM(s.altMax) },
  ]

  const chartData = useMemo(() => {
    let cKm = 0
    let cEff = 0
    let cGain = 0
    return stages.map((s) => {
      cKm += s.distanceKm
      cEff += s.kmEffort
      cGain += s.elevationGain
      return {
        label: `#${s.num}`,
        name: s.name,
        km: s.distanceKm,
        eff: s.kmEffort,
        gain: s.elevationGain,
        dur: s.durationMin / 60,
        durSource: s.durationSource,
        cKm,
        cEff,
        cGain,
      }
    })
  }, [stages])

  return (
    <div className="metrics">
      <section className="kpis" aria-label="Totaux">
        <Kpi label="Étapes" value={String(stages.length)} />
        <Kpi label="Distance" value={fmt1(totals.km)} unit="km" sub={`${fmt1(totals.avgKm)} km / étape`} />
        <Kpi label="Km effort" value={fmt1(totals.eff)} unit="km-e" sub={`+${fmt1(totals.eff - totals.km)} vs distance`} />
        <Kpi label="Dénivelé +" value={fmt0(totals.gain)} unit="m" sub={`${fmt0(totals.avgGain)} m / étape`} />
        <Kpi
          label="Durée"
          value={fmtDuration(totals.dur)}
          sub={totals.estimated ? `dont ${totals.estimated} étape${totals.estimated > 1 ? 's' : ''} estimée${totals.estimated > 1 ? 's' : ''}` : 'durées réelles'}
        />
      </section>

      <section className="card">
        <header className="card__head">
          <h2>Étapes</h2>
          <div className="toolbar">
            <label className="pace">
              Allure d'estimation
              <input
                type="number"
                min={1}
                max={10}
                step={0.1}
                value={pace}
                onChange={(e) => setPace(Number(e.target.value))}
              />
              km effort/h
            </label>
            <button type="button" className="btn" onClick={exportJson} title="Télécharger gpx/etapes.json pour le versionner avec tes GPX">
              Exporter etapes.json
            </button>
          </div>
        </header>
        <div className="table-scroll">
          <table className="stages-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={c.num ? 'is-num' : ''}
                    aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    title={c.title}
                  >
                    <button type="button" onClick={() => onSort(c.key)}>
                      {c.label}
                      <span className="sort-ind" aria-hidden="true">
                        {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id}>
                  {cols.map((c) => (
                    <td key={c.key} className={c.num ? 'is-num' : ''}>
                      {c.render(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>Total</td>
                <td />
                <td className="is-num">{fmtKm(totals.km)}</td>
                <td className="is-num">{fmtM(totals.gain)}</td>
                <td className="is-num">{fmtM(totals.loss)}</td>
                <td className="is-num">{fmt1(totals.eff)}</td>
                <td className="is-num">{fmtDuration(totals.dur)}</td>
                <td className="is-num">{fmt1(totals.speed)} km/h</td>
                <td className="is-num">{fmt1(totals.effortSpeed)} km-e/h</td>
                <td className="is-num">{fmt0(totals.gainPerKm)} m</td>
                <td className="is-num">{fmtM(totals.altMax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="hint">
          Clique sur un en-tête pour trier. Durée : saisis ta durée réelle (ex. <code>7h30</code>) ; sinon elle vient des horodatages
          du GPX ou est estimée à partir des km effort et de l'allure ci-dessus. Km effort = km + D+/100.
        </p>
      </section>

      <div className="charts">
        <ChartCard title="Distance et km effort par étape" t={t}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: t.textSecondary, fontSize: 12 }} stroke={t.axis} tickLine={false} />
            <YAxis tickFormatter={(v) => `${v}`} unit=" km" tick={{ fill: t.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip cursor={{ fill: t.grid, opacity: 0.6 }} content={<StageTooltip rows={[['km', 'Distance', (v) => fmtKm(v)], ['eff', 'Km effort', (v) => `${fmt1(v)} km-e`]]} t={t} />} />
            <Legend wrapperStyle={{ color: t.textSecondary, fontSize: 13 }} iconType="circle" iconSize={8} />
            <Bar dataKey="km" name="Distance (km)" fill={t.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar dataKey="eff" name="Km effort" fill={t.s2} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Cumul : distance et km effort" t={t}>
          <LineChart data={chartData} margin={{ top: 8, right: 84, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: t.textSecondary, fontSize: 12 }} stroke={t.axis} tickLine={false} />
            <YAxis unit=" km" tick={{ fill: t.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              cursor={{ stroke: t.textSecondary, strokeWidth: 1 }}
              content={<StageTooltip rows={[['cKm', 'Distance cumulée', (v) => fmtKm(v)], ['cEff', 'Km effort cumulés', (v) => `${fmt1(v)} km-e`], ['cGain', 'D+ cumulé', (v) => fmtM(v)]]} t={t} />}
            />
            <Legend wrapperStyle={{ color: t.textSecondary, fontSize: 13 }} iconType="circle" iconSize={8} />
            <Line type="monotone" dataKey="cKm" name="Distance cumulée" stroke={t.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: t.surface }} activeDot={{ r: 6 }}>
              <LabelList dataKey="cKm" content={<EndLabel last={chartData.length - 1} color={t.text} fmt={(v: number) => `${fmt0(v)} km`} />} />
            </Line>
            <Line type="monotone" dataKey="cEff" name="Km effort cumulés" stroke={t.s2} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: t.surface }} activeDot={{ r: 6 }}>
              <LabelList dataKey="cEff" content={<EndLabel last={chartData.length - 1} color={t.text} fmt={(v: number) => `${fmt0(v)} km-e`} />} />
            </Line>
          </LineChart>
        </ChartCard>

        <ChartCard title="Dénivelé positif par étape" t={t}>
          <BarChart data={chartData} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: t.textSecondary, fontSize: 12 }} stroke={t.axis} tickLine={false} />
            <YAxis unit=" m" tick={{ fill: t.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip cursor={{ fill: t.grid, opacity: 0.6 }} content={<StageTooltip rows={[['gain', 'D+', (v) => fmtM(v)]]} t={t} />} />
            <Bar dataKey="gain" name="D+" fill={t.s3} radius={[4, 4, 0, 0]} maxBarSize={44}>
              <LabelList dataKey="gain" position="top" fill={t.textSecondary} fontSize={12} formatter={(v: number) => `${fmt0(v)} m`} />
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Durée par étape" t={t}>
          <BarChart data={chartData} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: t.textSecondary, fontSize: 12 }} stroke={t.axis} tickLine={false} />
            <YAxis unit=" h" tick={{ fill: t.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.6 }}
              content={<StageTooltip rows={[['dur', 'Durée', (v, p) => `${fmtDuration(v * 60)}${p.durSource === 'estimée' ? ' (estimée)' : ''}`]]} t={t} />}
            />
            <Bar dataKey="dur" name="Durée" fill={t.dark ? '#9085e9' : '#6250d6'} radius={[4, 4, 0, 0]} maxBarSize={44}>
              <LabelList dataKey="dur" position="top" fill={t.textSecondary} fontSize={12} formatter={(v: number) => fmtDuration(v * 60)} />
            </Bar>
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}

/* ---------- Sous-composants ---------- */

function Kpi({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">
        {value}
        {unit && <span className="kpi__unit"> {unit}</span>}
      </div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; t: ChartTheme; children: React.ReactElement }) {
  return (
    <section className="card chart-card">
      <h2>{title}</h2>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  )
}

type Row = [key: string, label: string, fmt: (v: number, payload: Record<string, unknown>) => string]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StageTooltip({ active, payload, rows, t }: { active?: boolean; payload?: any[]; rows: Row[]; t: ChartTheme }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="viz-tooltip">
      <div>
        <b>{p.label}</b> {p.name}
      </div>
      {rows.map(([k, label, f]) => {
        const series = payload.find((x) => x.dataKey === k)
        return (
          <div key={k} className="viz-tooltip__row">
            {series && <span className="swatch" style={{ background: series.color ?? series.fill ?? t.s1 }} />}
            <span>{label}</span>
            <b>{f(p[k], p)}</b>
          </div>
        )
      })}
    </div>
  )
}

// Étiquette directe uniquement sur le dernier point de chaque série
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EndLabel(props: any) {
  const { x, y, index, value, last, color, fmt } = props
  if (index !== last) return null
  return (
    <text x={x + 8} y={y} dy={4} fill={color} fontSize={12} fontWeight={600}>
      {fmt(value)}
    </text>
  )
}

function DurationCell({ stage, update }: { stage: Stage; update: (num: number, patch: StageMeta) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  const display = stage.durationSource === 'saisie' ? fmtDuration(stage.durationMin) : ''
  const invalid = draft != null && draft.trim() !== '' && parseDuration(draft) == null
  return (
    <span className="duration-cell">
      <input
        className={`cell-input cell-input--dur ${invalid ? 'is-invalid' : ''}`}
        value={draft ?? display}
        placeholder={fmtDuration(stage.durationMin)}
        aria-label={`Durée réelle de l'étape ${stage.num}`}
        onFocus={() => setDraft(display)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!cancelled.current && draft != null && !invalid) update(stage.num, { duree: draft.trim() })
          cancelled.current = false
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            cancelled.current = true
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {stage.durationSource !== 'saisie' && <span className={`badge badge--${stage.durationSource}`}>{stage.durationSource === 'gpx' ? 'GPX' : 'est.'}</span>}
    </span>
  )
}
