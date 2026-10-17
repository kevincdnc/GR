import { Brand, FitText, Profile, statsRow, Track } from '../primitives.tsx'
import { TEMPLATE_META } from './catalog.ts'
import { defineTemplate } from './types.ts'

// Relief : carte ombrée en haut, bandeau blanc avec titre et chiffres.
const INK = '#161616'
const MUTE = '#6b6b6b'

export default defineTemplate({
  ...TEMPLATE_META.relief,
  layout(i) {
    const M = 80
    const stats = statsRow(i.stats, M, i.W - 2 * M, {
      value: { family: 'display', weight: 600, size: 52, fill: INK },
      label: { family: 'display', weight: 600, size: 13, fill: MUTE, spacing: 0.2, upper: true },
      gap: 10,
      align: 'left',
    })
    const band = 120 + (i.subtitle ? 34 : 0) + 50 + stats.height + 70 + (i.spec.profile ? 70 : 0)
    const mapH = i.H - band
    return {
      M, stats, band, mapH,
      trackBox: { x: 90, y: 90, w: i.W - 180, h: mapH - 180 },
      mapBox: i.mapStyle === 'none' ? null : { x: -i.bleed, y: -i.bleed, w: i.W + 2 * i.bleed, h: mapH + i.bleed },
    }
  },
  render(i, l, proj) {
    const y0 = l.mapH
    let y = y0 + 106
    return (
      <>
        <Track activity={i.activity} proj={proj} color={i.trackColor} width={5 * i.trackScale} casing={{ color: '#fff', width: 2.4 }} markers={i.spec.track.markers} />
        {i.coordsText && <FitText text={i.coordsText} x={i.W - l.M} y={y0 - 24} maxW={i.W / 2} family="mono" weight={400} size={11} fill="#000" opacity={0.55} anchor="end" />}
        {i.attribution && <text x={l.M} y={y0 - 24} fontSize={7} fontFamily="Inter" fill="#000" opacity={0.45}>{i.attribution}</text>}
        <rect x={-i.bleed} y={y0} width={i.W + 2 * i.bleed} height={i.H - y0 + i.bleed} fill="#fff" />
        <rect x={-i.bleed} y={y0} width={i.W + 2 * i.bleed} height={2.5} fill={INK} />
        <FitText text={i.title} x={l.M} y={y} maxW={i.W - 2 * l.M - 200} family="display" weight={700} size={70} fill={INK} />
        {i.subtitle && <FitText text={i.subtitle} x={l.M} y={(y += 38)} maxW={i.W - 2 * l.M} family="sans" weight={400} size={18} fill={MUTE} />}
        {i.spec.text.branding && <Brand x={i.W - l.M} y={y0 + 70} size={13} fill={INK} anchor="end" />}
        {i.spec.profile && <Profile activity={i.activity} x={l.M} y={(y += 40)} w={i.W - 2 * l.M} h={50} fill="rgba(229,72,45,0.14)" stroke={i.trackColor} strokeWidth={1.4} />}
        {l.stats.render(i.H - 66 - l.stats.height)}
      </>
    )
  },
})
