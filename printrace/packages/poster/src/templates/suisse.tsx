import { measureText } from '../fonts.ts'
import { Brand, FitText, textBlock, Track } from '../primitives.tsx'
import { TEMPLATE_META } from './catalog.ts'
import { defineTemplate, fullBleed } from './types.ts'

// Typographie suisse : bloc rouge, colonne de grands chiffres, grille stricte.
const INK = '#111111'
const RED = '#e2261c'

export default defineTemplate({
  ...TEMPLATE_META.suisse,
  layout(i) {
    const M = 64
    const blockH = i.H * 0.3
    const title = textBlock(i.title, { family: 'sans', weight: 800, size: 96, fill: '#fff', maxW: i.W - 2 * M, maxLines: 3, lineHeight: 0.98, spacing: -0.02 })
    const colW = i.W * 0.36
    const top = blockH + M
    const bottom = i.H - M - 30
    return {
      M, blockH, title, colW, top, bottom,
      trackBox: { x: colW + 70, y: top + 10, w: i.W - colW - 70 - M, h: bottom - top - 20 },
      mapBox: i.mapStyle === 'none' ? null : { x: colW + 20, y: blockH, w: i.W - colW - 20 + i.bleed, h: i.H - blockH + i.bleed },
    }
  },
  render(i, l, proj) {
    const b = fullBleed(i)
    const step = i.stats.length ? (l.bottom - l.top) / i.stats.length : 0
    const start = i.activity.coords[0]
    const [sx, sy] = proj.px(start[0], start[1])
    const subY = l.blockH - l.M + 6
    return (
      <>
        <rect x={b.x} y={b.y} width={b.w} height={l.blockH - b.y} fill={RED} />
        {i.spec.text.branding && <Brand x={l.M} y={l.M + 14} size={14} fill="#fff" />}
        {l.title.render(l.M, l.blockH - l.M - l.title.height - (i.subtitle ? 44 : 0))}
        {i.subtitle && <FitText text={i.subtitle} x={l.M} y={subY} maxW={i.W - 2 * l.M} family="sans" weight={500} size={19} fill="#fff" opacity={0.88} />}
        {i.stats.map((s, k) => {
          const y = l.top + k * step
          const maxW = l.colW - l.M - 10
          let size = Math.min(118, step * 0.52)
          const w = measureText(s.value, 'sans', 800, size, -0.03) + (s.unit ? measureText(` ${s.unit}`, 'sans', 600, size * 0.3) : 0)
          if (w > maxW) size *= maxW / w
          return (
            <g key={s.key}>
              <rect x={l.M} y={y} width={l.colW - l.M} height={2.5} fill={INK} />
              <text x={l.M} y={y + 32} fontFamily="Inter" fontWeight={500} fontSize={15} fill="#666">{s.label}</text>
              <text x={l.M} y={y + 44 + size * 0.76} fontFamily="Inter" fontWeight={800} fontSize={size} letterSpacing={-0.03 * size} fill={INK}>
                {s.value}
                {s.unit && <tspan fontSize={size * 0.3} fontWeight={600} dx={size * 0.08}>{s.unit}</tspan>}
              </text>
            </g>
          )
        })}
        <rect x={l.colW + 20} y={l.top} width={1.5} height={l.bottom - l.top} fill="rgba(0,0,0,0.14)" />
        <Track activity={i.activity} proj={proj} color={i.trackColor} width={3.6 * i.trackScale} />
        {i.spec.track.markers && <circle cx={sx} cy={sy} r={11} fill={RED} />}
        {i.coordsText && <FitText text={i.coordsText} x={i.W - l.M} y={i.H - l.M + 10} maxW={i.W / 2} family="mono" weight={400} size={11} fill="#777" anchor="end" />}
      </>
    )
  },
})
