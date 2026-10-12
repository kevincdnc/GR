import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { stageColor, useChartTheme, type Stage } from '../data'
import { fmt0, fmt1 } from '../lib/format'

interface Props {
  stage: Stage
  hoverIdx: number | null
  onHover: (i: number | null) => void
}

export function ElevationProfile({ stage, hoverIdx, onHover }: Props) {
  const t = useChartTheme()
  const color = stageColor(stage.num, t.dark)
  const data = stage.profile.map((p) => ({ d: p[0], ele: p[1] }))
  const hover = hoverIdx != null ? data[hoverIdx] : null
  // Axe Y : 4 intervalles « ronds » au-dessus de l'altitude max
  const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500]
  const step = steps.find((x) => x * 4 >= stage.altMax * 1.1) ?? 1000
  const yMax = step * 4
  const ticks = [0, step, step * 2, step * 3, yMax]
  const gradId = `grad-${stage.id.replace(/\W/g, '')}`

  return (
    <div className="profile-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          onMouseMove={(s) => onHover(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : null)}
          onMouseLeave={() => onHover(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis
            dataKey="d"
            type="number"
            domain={[0, 'dataMax']}
            tickFormatter={(v) => `${fmt0(v)} km`}
            tick={{ fill: t.textSecondary, fontSize: 12 }}
            stroke={t.axis}
            tickLine={false}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={ticks}
            tickFormatter={(v) => `${v} m`}
            tick={{ fill: t.textSecondary, fontSize: 12 }}
            stroke={t.axis}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: t.textSecondary, strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="viz-tooltip">
                  <div><b>{fmt1(payload[0].payload.d)} km</b></div>
                  <div>Altitude {fmt0(payload[0].payload.ele)} m</div>
                </div>
              ) : null
            }
          />
          {hover && <ReferenceLine x={hover.d} stroke={t.textSecondary} strokeDasharray="3 3" />}
          <Area
            type="monotone"
            dataKey="ele"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
