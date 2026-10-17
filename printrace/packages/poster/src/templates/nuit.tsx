import { Brand, FitText, statsRow, Track } from '../primitives.tsx'
import { TEMPLATE_META } from './catalog.ts'
import { defineTemplate, fullBleed } from './types.ts'

// Carte de nuit : fond sombre, tracé lumineux, grand titre espacé.
export default defineTemplate({
  ...TEMPLATE_META.nuit,
  layout(i) {
    const stats = statsRow(i.stats, 110, i.W - 220, {
      value: { family: 'display', weight: 600, size: 64, fill: '#fff' },
      label: { family: 'display', weight: 600, size: 15, fill: '#fff', spacing: 0.22, upper: true },
      gap: 14,
      dividers: 'rgba(255,255,255,0.18)',
    })
    const statsTop = i.H - (i.coordsText ? 120 : 90) - stats.height
    const titleY = statsTop - (i.subtitle ? 110 : 80)
    return {
      stats,
      statsTop,
      titleY,
      trackBox: { x: 110, y: 190, w: i.W - 220, h: titleY - 150 - 190 },
      mapBox: i.mapStyle === 'none' ? null : fullBleed(i),
    }
  },
  render(i, l, proj) {
    const b = fullBleed(i)
    const fade = l.titleY - 240
    return (
      <>
        <defs>
          <radialGradient id={`${i.uid}v`} cx="50%" cy="42%" r="75%">
            <stop offset="0.35" stopColor="#000" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.6} />
          </radialGradient>
          <linearGradient id={`${i.uid}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d0d0f" stopOpacity={0} />
            <stop offset="0.45" stopColor="#0d0d0f" stopOpacity={0.86} />
            <stop offset="1" stopColor="#0d0d0f" stopOpacity={0.97} />
          </linearGradient>
        </defs>
        <rect {...{ x: b.x, y: b.y, width: b.w, height: b.h }} fill={`url(#${i.uid}v)`} />
        <rect x={b.x} y={fade} width={b.w} height={b.y + b.h - fade} fill={`url(#${i.uid}f)`} />
        <Track activity={i.activity} proj={proj} color={i.trackColor} width={4.2 * i.trackScale} glow markers={i.spec.track.markers} />
        {i.spec.text.branding && <Brand x={i.W / 2} y={110} size={17} fill="#fff" anchor="middle" />}
        <FitText text={i.title} x={i.W / 2} y={l.titleY} maxW={i.W - 200} family="display" weight={700} size={78} fill="#fff" spacing={0.1} upper anchor="middle" />
        <FitText text={i.subtitle} x={i.W / 2} y={l.titleY + 48} maxW={i.W - 260} family="sans" weight={400} size={19} fill="#fff" opacity={0.62} anchor="middle" />
        {l.stats.render(l.statsTop)}
        {i.coordsText && <FitText text={i.coordsText} x={i.W / 2} y={i.H - 58} maxW={i.W - 200} family="mono" weight={400} size={12} fill="#fff" opacity={0.45} spacing={0.12} anchor="middle" />}
        {i.attribution && <text x={i.W - 24} y={i.H - 18} fontSize={7} fontFamily="Inter" fill="#fff" opacity={0.35} textAnchor="end">{i.attribution}</text>}
      </>
    )
  },
})
