import { Brand, FitText, Profile, statsRow, Track } from '../primitives.tsx'
import { TEMPLATE_META } from './catalog.ts'
import { defineTemplate, fullBleed } from './types.ts'

// Épure : le tracé seul, beaucoup d'air, titre espacé.
const INK = '#1b1b1b'
const MUTE = '#7a756c'

export default defineTemplate({
  ...TEMPLATE_META.epure,
  layout(i) {
    const M = 110
    const stats = statsRow(i.stats, M, i.W - 2 * M, {
      value: { family: 'display', weight: 600, size: 58, fill: INK },
      label: { family: 'display', weight: 600, size: 14, fill: MUTE, spacing: 0.22, upper: true },
      gap: 12,
      dividers: 'rgba(27,27,27,0.14)',
    })
    const footY = i.H - 64
    const statsTop = footY - 80 - stats.height
    const ruleY = statsTop - 50
    const subY = ruleY - 40
    const titleY = i.subtitle ? subY - 44 : ruleY - 46
    const profileH = i.spec.profile ? 70 : 0
    const trackBottom = titleY - 120 - (profileH ? profileH + 50 : 0)
    return {
      M, stats, statsTop, ruleY, subY, titleY, footY, profileH, trackBottom,
      trackBox: { x: M, y: M, w: i.W - 2 * M, h: trackBottom - M },
      mapBox: i.mapStyle === 'none' ? null : fullBleed(i),
    }
  },
  render(i, l, proj) {
    return (
      <>
        <Track activity={i.activity} proj={proj} color={i.trackColor} width={3.2 * i.trackScale} markers={i.spec.track.markers} markerFill="#f4f1ea" />
        {l.profileH > 0 && <Profile activity={i.activity} x={l.M} y={l.trackBottom + 50} w={i.W - 2 * l.M} h={l.profileH} fill="rgba(27,27,27,0.08)" stroke={INK} strokeWidth={1.2} />}
        <FitText text={i.title} x={i.W / 2} y={l.titleY} maxW={i.W - 2 * l.M} family="display" weight={600} size={76} fill={INK} spacing={0.16} upper anchor="middle" />
        <FitText text={i.subtitle} x={i.W / 2} y={l.subY} maxW={i.W - 2 * l.M} family="sans" weight={400} size={18} fill={MUTE} anchor="middle" />
        <rect x={i.W / 2 - 50} y={l.ruleY} width={100} height={1.6} fill="rgba(27,27,27,0.3)" />
        {l.stats.render(l.statsTop)}
        {i.coordsText && <FitText text={i.coordsText} x={l.M} y={l.footY} maxW={i.W / 2} family="mono" weight={400} size={11} fill={MUTE} spacing={0.1} />}
        {i.spec.text.branding && <Brand x={i.W - l.M} y={l.footY} size={13} fill={INK} anchor="end" />}
      </>
    )
  },
})
