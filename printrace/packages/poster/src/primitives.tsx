// Briques de dessin communes aux modèles (SVG, repère de mise en page).
import type { Activity } from '@printrace/core'
import { FONTS, type FontFamily, measureText, wrapText } from './fonts.ts'
import type { Projection } from './geo.ts'
import type { StatValue } from './values.ts'

interface TextStyle {
  family: FontFamily
  weight: number
  size: number
  fill: string
  /** em */
  spacing?: number
  upper?: boolean
  anchor?: 'start' | 'middle' | 'end'
  opacity?: number
}

const textProps = (s: TextStyle, size = s.size) => ({
  fontFamily: FONTS[s.family],
  fontWeight: s.weight,
  fontSize: size,
  fill: s.fill,
  letterSpacing: s.spacing ? size * s.spacing : undefined,
  textAnchor: s.anchor ?? 'start',
  opacity: s.opacity,
})

/** Taille qui fait tenir `text` sur une ligne de largeur maxW (≤ s.size). */
export function fitSize(text: string, s: TextStyle, maxW: number): number {
  const t = s.upper ? text.toUpperCase() : text
  const w = measureText(t, s.family, s.weight, s.size, s.spacing)
  return w > maxW ? (s.size * maxW) / w : s.size
}

/** Ligne de texte réduite si besoin pour tenir dans maxW ; y = ligne de base. */
export function FitText({ text, x, y, maxW, ...s }: TextStyle & { text: string; x: number; y: number; maxW: number }) {
  if (!text) return null
  const t = s.upper ? text.toUpperCase() : text
  return (
    <text x={x} y={y} {...textProps(s, fitSize(text, s, maxW))}>
      {t}
    </text>
  )
}

/** Paragraphe (lignes coupées aux mots) ; y = haut du bloc. Renvoie aussi sa hauteur. */
export function textBlock(text: string, s: TextStyle & { maxW: number; maxLines: number; lineHeight?: number }) {
  const t = s.upper ? text.toUpperCase() : text
  const lines = text ? wrapText(t, s.family, s.weight, s.size, s.maxW, s.maxLines) : []
  const lh = s.size * (s.lineHeight ?? 1.05)
  return {
    height: lines.length ? (lines.length - 1) * lh + s.size * 0.78 : 0,
    render: (x: number, y: number) => (
      <text x={x} y={y + s.size * 0.78} {...textProps(s)}>
        {lines.map((l, i) => (
          <tspan key={i} x={x} dy={i ? lh : 0}>
            {l}
          </tspan>
        ))}
      </text>
    ),
  }
}

export interface StatsStyle {
  value: TextStyle
  label: TextStyle
  /** écart label → valeur */
  gap: number
  dividers?: string
  align?: 'center' | 'left'
}

/** Rangée de statistiques en colonnes égales ; y = haut du bloc. */
export function statsRow(items: StatValue[], x: number, w: number, st: StatsStyle) {
  const n = items.length
  const colW = n ? w / n : w
  const pad = colW * 0.08
  // même taille de chiffre pour toutes les colonnes
  const unitRatio = 0.42
  let size = st.value.size
  for (const it of items) {
    const vw = measureText(it.value, st.value.family, st.value.weight, size) + (it.unit ? measureText(` ${it.unit}`, st.value.family, st.value.weight, size * unitRatio) : 0)
    if (vw > colW - 2 * pad) size = (size * (colW - 2 * pad)) / vw
  }
  const height = st.label.size + st.gap + size * 0.74
  return {
    height,
    render: (y: number) => (
      <g>
        {items.map((it, i) => {
          const center = st.align !== 'left'
          const cx = center ? x + colW * (i + 0.5) : x + colW * i + (i ? pad : 0)
          const anchor = center ? 'middle' : 'start'
          return (
            <g key={it.key}>
              {st.dividers && i > 0 && <line x1={x + colW * i} x2={x + colW * i} y1={y} y2={y + height} stroke={st.dividers} strokeWidth={1.2} />}
              <text x={cx} y={y + st.label.size * 0.78} {...textProps({ ...st.label, anchor })}>
                {st.label.upper ? it.label.toUpperCase() : it.label}
              </text>
              <text x={cx} y={y + st.label.size + st.gap + size * 0.74} {...textProps({ ...st.value, anchor }, size)}>
                {it.value}
                {it.unit && (
                  <tspan fontSize={size * unitRatio} dx={size * 0.08}>
                    {it.unit}
                  </tspan>
                )}
              </text>
            </g>
          )
        })}
      </g>
    ),
  }
}

/** Chemin SVG du tracé projeté (points trop proches fusionnés). */
export function trackPath(a: Activity, proj: Projection, minStep = 0.4): string {
  let d = ''
  let lx = NaN
  let ly = NaN
  const last = a.coords.length - 1
  a.coords.forEach((c, i) => {
    const [x, y] = proj.px(c[0], c[1])
    if (i && i !== last && Math.abs(x - lx) < minStep && Math.abs(y - ly) < minStep) return
    d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
    lx = x
    ly = y
  })
  return d
}

export function Track({
  activity,
  proj,
  color,
  width,
  casing,
  glow,
  markers,
  markerFill,
}: {
  activity: Activity
  proj: Projection
  color: string
  width: number
  casing?: { color: string; width: number }
  /** halo lumineux, vectoriel (traits superposés, pas de filtre raster) */
  glow?: boolean
  markers?: boolean
  markerFill?: string
}) {
  const d = trackPath(activity, proj)
  const line = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const start = activity.coords[0]
  const end = activity.coords[activity.coords.length - 1]
  const [sx, sy] = proj.px(start[0], start[1])
  const [ex, ey] = proj.px(end[0], end[1])
  const r = Math.max(width * 1.6, 4)
  return (
    <g>
      {glow &&
        [
          [9, 0.05],
          [6, 0.08],
          [3.6, 0.14],
          [2, 0.3],
        ].map(([k, o]) => <path key={k} d={d} {...line} stroke={color} strokeOpacity={o} strokeWidth={width * k} />)}
      {casing && <path d={d} {...line} stroke={casing.color} strokeWidth={width + casing.width * 2} />}
      <path d={d} {...line} stroke={color} strokeWidth={width} />
      {markers && (
        <>
          <circle cx={sx} cy={sy} r={r} fill={markerFill ?? '#fff'} stroke={color} strokeWidth={width * 0.6} />
          {Math.hypot(ex - sx, ey - sy) > r * 2 && <circle cx={ex} cy={ey} r={r} fill={color} stroke={markerFill ?? '#fff'} strokeWidth={width * 0.6} />}
        </>
      )}
    </g>
  )
}

/** Profil altimétrique (aire + ligne) dans la boîte donnée. */
export function Profile({ activity, x, y, w, h, fill, stroke, strokeWidth = 1.5 }: { activity: Activity; x: number; y: number; w: number; h: number; fill: string; stroke?: string; strokeWidth?: number }) {
  const c = activity.coords
  const total = c[c.length - 1][3] || 1
  let lo = Infinity
  let hi = -Infinity
  for (const p of c) {
    lo = Math.min(lo, p[2])
    hi = Math.max(hi, p[2])
  }
  const span = Math.max(hi - lo, 30)
  const step = Math.max(1, Math.floor(c.length / 600))
  let line = ''
  for (let i = 0; i < c.length; i += step) line += `${line ? 'L' : 'M'}${(x + (c[i][3] / total) * w).toFixed(2)} ${(y + h - ((c[i][2] - lo) / span) * h).toFixed(2)}`
  line += `L${x + w} ${(y + h - ((c[c.length - 1][2] - lo) / span) * h).toFixed(2)}`
  return (
    <g>
      <path d={`${line}L${x + w} ${y + h}L${x} ${y + h}Z`} fill={fill} />
      {stroke && <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />}
    </g>
  )
}

/** Signature discrète en bas d'affiche */
export function Brand({ x, y, size, fill, anchor = 'start' }: { x: number; y: number; size: number; fill: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} fontFamily={FONTS.display} fontWeight={700} fontSize={size} letterSpacing={size * 0.28} fill={fill} textAnchor={anchor}>
      PRINTRACE
    </text>
  )
}

/** Barre d'échelle (km) */
export function ScaleBar({ proj, lat, x, y, maxW, color, size }: { proj: Projection; lat: number; x: number; y: number; maxW: number; color: string; size: number }) {
  const mPer = proj.metersPerUnit(lat)
  const steps = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]
  const m = steps.filter((s) => s / mPer <= maxW).pop() ?? steps[0]
  const len = m / mPer
  const hh = size * 0.4
  return (
    <g>
      <rect x={x} y={y} width={len / 2} height={hh} fill={color} />
      <rect x={x} y={y} width={len} height={hh} fill="none" stroke={color} strokeWidth={1.2} />
      <text x={x + len + size * 0.6} y={y + hh} fontFamily={FONTS.mono} fontSize={size} fill={color}>
        {m >= 1000 ? `${m / 1000} km` : `${m} m`}
      </text>
    </g>
  )
}
