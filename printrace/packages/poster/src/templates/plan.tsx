import { FONTS } from '../fonts.ts'
import { Brand, FitText, ScaleBar, Track } from '../primitives.tsx'
import { TEMPLATE_META } from './catalog.ts'
import { defineTemplate, fullBleed } from './types.ts'

// Plan technique : grille, double cadre, cartouche, nord et échelle.
const BG = '#103c6b'
const LINE = 'rgba(255,255,255,0.85)'

export default defineTemplate({
  ...TEMPLATE_META.plan,
  layout(i) {
    const M = 46
    const rows = i.stats.length + (i.coordsText ? 1 : 0)
    const cw = i.W * 0.52
    const rh = 50
    const ch = 116 + rows * rh
    const cx = i.W - M - 12 - cw
    const cy = i.H - M - 12 - ch
    return {
      M, cw, rh, ch, cx, cy,
      trackBox: { x: M + 90, y: M + 120, w: i.W - 2 * M - 180, h: cy - M - 200 },
      mapBox: i.mapStyle === 'none' ? null : fullBleed(i),
    }
  },
  render(i, l, proj) {
    const b = fullBleed(i)
    const g = i.W / 48
    const lines = []
    for (let k = Math.ceil(b.x / g); k * g <= b.x + b.w; k++) lines.push(<rect key={`x${k}`} x={k * g} y={b.y} width={1} height={b.h} fill="#fff" opacity={k % 4 ? 0.05 : 0.12} />)
    for (let k = Math.ceil(b.y / g); k * g <= b.y + b.h; k++) lines.push(<rect key={`y${k}`} x={b.x} y={k * g} width={b.w} height={1} fill="#fff" opacity={k % 4 ? 0.05 : 0.12} />)
    const rows = i.stats.map((s) => [s.label, `${s.value}${s.unit ? ` ${s.unit}` : ''}`])
    if (i.coordsText) rows.push(['Départ', i.coordsText.split('  ·  ')[0]])
    const start = i.activity.coords[0]
    return (
      <>
        {i.mapStyle === 'none' && lines}
        <rect x={l.M} y={l.M} width={i.W - 2 * l.M} height={i.H - 2 * l.M} fill="none" stroke={LINE} strokeWidth={3} />
        <rect x={l.M + 12} y={l.M + 12} width={i.W - 2 * l.M - 24} height={i.H - 2 * l.M - 24} fill="none" stroke={LINE} strokeWidth={1} />
        <g strokeDasharray="1.5 9">
          <Track activity={i.activity} proj={proj} color="rgba(255,255,255,0.35)" width={13 * i.trackScale} />
        </g>
        <Track activity={i.activity} proj={proj} color={i.trackColor} width={2.6 * i.trackScale} markers={i.spec.track.markers} markerFill={BG} />
        {/* Nord */}
        <g transform={`translate(${i.W - l.M - 70} ${l.M + 80})`}>
          <path d="M0 -38 L13 16 L0 7 L-13 16 Z" fill="#fff" />
          <text y={42} textAnchor="middle" fontFamily={FONTS.mono} fontWeight={600} fontSize={16} fill="#fff">N</text>
        </g>
        <ScaleBar proj={proj} lat={start[0]} x={l.M + 40} y={l.cy - 40} maxW={220} color="#fff" size={12} />
        {/* Cartouche */}
        <rect x={l.cx} y={l.cy} width={l.cw} height={l.ch} fill={BG} stroke={LINE} strokeWidth={2} />
        <FitText text={i.title || 'Itinéraire'} x={l.cx + 24} y={l.cy + 58} maxW={l.cw - 48} family="mono" weight={600} size={36} fill="#fff" upper spacing={0.04} />
        <FitText text={i.subtitle || ' '} x={l.cx + 24} y={l.cy + 92} maxW={l.cw - 48} family="mono" weight={400} size={14} fill="#fff" opacity={0.65} />
        {rows.map(([k, v], n) => {
          const y = l.cy + 116 + n * l.rh
          return (
            <g key={k}>
              <rect x={l.cx} y={y} width={l.cw} height={1.2} fill="#fff" opacity={0.4} />
              <text x={l.cx + 24} y={y + 32} fontFamily={FONTS.mono} fontSize={14} fill="#fff" opacity={0.65}>{k.toUpperCase()}</text>
              <text x={l.cx + l.cw - 24} y={y + 33} fontFamily={FONTS.mono} fontWeight={600} fontSize={22} fill="#fff" textAnchor="end">{v}</text>
            </g>
          )
        })}
        <rect x={l.cx + l.cw * 0.4} y={l.cy + 116} width={1.2} height={l.ch - 116} fill="#fff" opacity={0.4} />
        {i.spec.text.branding && <Brand x={l.M + 40} y={l.M + 60} size={14} fill="#fff" />}
        {i.attribution && <text x={l.M + 18} y={i.H - l.M - 20} fontSize={7} fontFamily="Inter" fill="#fff" opacity={0.5}>{i.attribution}</text>}
      </>
    )
  },
})
