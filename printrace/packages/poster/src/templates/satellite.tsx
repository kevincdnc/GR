import { Brand, FitText, statsRow, textBlock, Track } from '../primitives.tsx'
import { TEMPLATE_META } from './catalog.ts'
import { defineTemplate, fullBleed } from './types.ts'

// Satellite plein cadre, titre massif en bas à gauche.
export default defineTemplate({
  ...TEMPLATE_META.satellite,
  layout(i) {
    const M = 90
    const stats = statsRow(i.stats, M, i.W - 2 * M, {
      value: { family: 'display', weight: 600, size: 62, fill: '#fff' },
      label: { family: 'display', weight: 600, size: 14, fill: '#fff', spacing: 0.2, upper: true, opacity: 0.7 },
      gap: 12,
      align: 'left',
    })
    const title = textBlock(i.title.toUpperCase(), { family: 'poster', weight: 400, size: 104, fill: '#fff', maxW: i.W - 2 * M, maxLines: 2, lineHeight: 1.02 })
    const statsTop = i.H - 90 - stats.height
    const subH = i.subtitle ? 44 : 0
    const titleTop = statsTop - 70 - subH - title.height
    return {
      M, stats, statsTop, title, titleTop,
      trackBox: { x: 120, y: 160, w: i.W - 240, h: titleTop - 110 - 160 },
      mapBox: i.mapStyle === 'none' ? null : fullBleed(i),
    }
  },
  render(i, l, proj) {
    const b = fullBleed(i)
    const fade = l.titleTop - 280
    return (
      <>
        <defs>
          <linearGradient id={`${i.uid}b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity={0} />
            <stop offset="0.4" stopColor="#000" stopOpacity={0.55} />
            <stop offset="1" stopColor="#000" stopOpacity={0.9} />
          </linearGradient>
          <linearGradient id={`${i.uid}t`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity={0.55} />
            <stop offset="1" stopColor="#000" stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect x={b.x} y={fade} width={b.w} height={b.y + b.h - fade} fill={`url(#${i.uid}b)`} />
        <rect x={b.x} y={b.y} width={b.w} height={240} fill={`url(#${i.uid}t)`} />
        <Track activity={i.activity} proj={proj} color={i.trackColor} width={4.5 * i.trackScale} casing={{ color: 'rgba(0,0,0,0.45)', width: 2 }} markers={i.spec.track.markers} />
        {i.spec.text.branding && <Brand x={l.M} y={96} size={15} fill="#fff" />}
        {i.coordsText && <FitText text={i.coordsText} x={i.W - l.M} y={96} maxW={i.W / 2} family="mono" weight={400} size={11} fill="#fff" opacity={0.75} anchor="end" />}
        {l.title.render(l.M, l.titleTop)}
        {i.subtitle && <FitText text={i.subtitle} x={l.M} y={l.titleTop + l.title.height + 40} maxW={i.W - 2 * l.M} family="sans" weight={500} size={20} fill="#fff" opacity={0.75} />}
        {l.stats.render(l.statsTop)}
        {i.attribution && <text x={i.W - 24} y={i.H - 18} fontSize={7} fontFamily="Inter" fill="#fff" opacity={0.45} textAnchor="end">{i.attribution}</text>}
      </>
    )
  },
})
