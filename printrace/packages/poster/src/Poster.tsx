// <Poster> : l'unique moteur de rendu. L'éditeur (aperçu), les vignettes et
// l'export d'impression (Chromium headless) affichent exactement ce composant.
//
// Le poster est toujours mis en page à sa taille physique (pixels CSS à 96 dpi)
// puis réduit à l'écran : la carte a la même généralisation et les libellés la
// même taille relative dans l'aperçu et sur le tirage.
//
// Couches, de bas en haut : fond de page → fond du modèle → carte MapLibre
// (raster) → dessin SVG (tracé, textes, chiffres : vectoriel dans le PDF).
import type { Activity } from '@printrace/core'
import { useEffect, useId, useMemo, useState } from 'react'
import { ensureFonts } from './fonts.ts'
import { CSS_PX_PER_MM, pageGeometry } from './formats.ts'
import { type Box, fitProjection, mapViewFor } from './geo.ts'
import { MapLayer } from './map/MapLayer.tsx'
import { MAP_ATTRIBUTION, MAP_BACKGROUND } from './map/styles.ts'
import type { MapStyleId, PosterSpec } from './spec.ts'
import { getTemplate } from './templates/index.ts'
import type { PosterTemplate, TemplateInput } from './templates/types.ts'
import { formatCoords, formatStat } from './values.ts'

export interface PosterProps {
  activity: Activity
  spec: PosterSpec
  /** preview : aperçu interactif · thumb : vignette sans carte · print : export */
  mode: 'preview' | 'thumb' | 'print'
  /** Largeur affichée (px écran) en preview / thumb */
  displayWidth?: number
  /** Résolution de la carte en mode print */
  dpi?: number
  /** Inclure le fond perdu (export PDF) */
  withBleed?: boolean
  /** Garde la mise en page avec carte mais n'affiche que sa couleur de fond (aperçus hors ligne) */
  noMap?: boolean
  onReady?: (info: { mapOk: boolean }) => void
}

const TRACK_SCALE = { fine: 0.6, normal: 1, bold: 1.6 } as const
const BORDER_INSET = { none: 0, fine: 0, margin: 55, passepartout: 95 } as const

export function resolveMapStyle(spec: PosterSpec, t: PosterTemplate): MapStyleId {
  return spec.map.style === 'auto' ? t.defaults.map : spec.map.style
}

/** Rectangle du modèle dans la page (unités de page), selon la bordure imprimée. */
function artRect(spec: PosterSpec, W: number, H: number): Box {
  const m = BORDER_INSET[spec.border]
  // la marge du bas est un peu plus grande, comme un tirage d'art
  return { x: m, y: m, w: W - 2 * m, h: H - m - m * (spec.border === 'none' || spec.border === 'fine' ? 1 : 1.25) }
}

export function Poster({ activity, spec, mode, displayWidth = 400, dpi = 300, withBleed = false, noMap = false, onReady }: PosterProps) {
  const [fontsReady, setFontsReady] = useState(false)
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  useEffect(() => {
    ensureFonts().then(() => setFontsReady(true))
  }, [])

  const template = getTemplate(spec.template)
  const g = pageGeometry(spec.format.size, spec.format.orientation, spec.print.bleedMm)
  const bleedShown = mode === 'print' && withBleed ? g.bleed : 0
  const cssPerUnit = (g.trimMm[0] * CSS_PX_PER_MM) / g.W
  const pageCss = { w: (g.W + 2 * bleedShown) * cssPerUnit, h: (g.H + 2 * bleedShown) * cssPerUnit }
  const zoom = mode === 'print' ? 1 : displayWidth / (g.W * cssPerUnit)
  const css = (v: number) => (v + bleedShown) * cssPerUnit

  const art = artRect(spec, g.W, g.H)
  const s = art.w / 1000
  const mapStyle = resolveMapStyle(spec, template)
  const showMap = mode !== 'thumb' && !noMap && mapStyle !== 'none'

  const built = useMemo(() => {
    if (!fontsReady) return null
    const input: TemplateInput = {
      W: 1000,
      H: art.h / s,
      bleed: spec.border === 'none' || spec.border === 'fine' ? g.bleed / s : 0,
      activity,
      spec,
      title: spec.text.title,
      subtitle: spec.text.subtitle,
      stats: spec.stats.map((k) => formatStat(k, activity, spec)),
      coordsText: spec.text.coords ? formatCoords(activity.coords[0][0], activity.coords[0][1]) : null,
      trackColor: spec.track.color === 'auto' ? template.defaults.track : spec.track.color,
      trackScale: TRACK_SCALE[spec.track.width],
      mapStyle: mode === 'thumb' ? 'none' : mapStyle,
      attribution: MAP_ATTRIBUTION[mapStyle],
      uid,
    }
    const layout = template.layout(input)
    // en vignette, le cadrage reste celui du poster avec carte
    const mapBox = mode === 'thumb' || mapStyle === 'none' ? null : layout.mapBox
    const proj = fitProjection(activity.coords, layout.trackBox, layout.pad ?? 0.04)
    return { input, layout, proj, mapBox, svg: template.render(input, layout, proj) }
  }, [fontsReady, activity, spec, template, mode, mapStyle, uid, art.h, s, g.bleed])

  const map = useMemo(() => {
    if (!built?.mapBox || !showMap) return null
    const mb = built.mapBox
    const box = { x: art.x + mb.x * s, y: art.y + mb.y * s, w: mb.w * s, h: mb.h * s }
    const view = mapViewFor(built.proj, mb, cssPerUnit * s)
    return { box, view }
  }, [built, showMap, art.x, art.y, s, cssPerUnit])

  const [mapOk, setMapOk] = useState<boolean | null>(null)
  useEffect(() => setMapOk(null), [map?.box.w, map?.box.h, mapStyle])
  useEffect(() => {
    if (built && (!map || mapOk !== null)) onReady?.({ mapOk: mapOk ?? true })
  }, [built, map, mapOk, onReady])

  const density = mode === 'print' ? dpi / 96 : Math.max(0.25, Math.round(zoom * (globalThis.devicePixelRatio || 1) * 4) / 4)
  const detail = 2 ** (spec.map.detail * 0.6)
  const pageBg = spec.border === 'margin' ? '#ffffff' : spec.border === 'passepartout' ? '#f6f3ec' : template.background
  const artBleed = spec.border === 'none' || spec.border === 'fine' ? g.bleed : 0
  const vb = `${-bleedShown} ${-bleedShown} ${g.W + 2 * bleedShown} ${g.H + 2 * bleedShown}`
  const ruleColor = template.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'

  const page = (
    <div style={{ position: 'relative', width: pageCss.w, height: pageCss.h, background: pageBg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: css(art.x - artBleed), top: css(art.y - artBleed), width: (art.w + 2 * artBleed) * cssPerUnit, height: (art.h + 2 * artBleed) * cssPerUnit, background: (mode === 'thumb' || noMap) && mapStyle !== 'none' ? MAP_BACKGROUND[mapStyle] : template.background }} />
      {map && (
        <MapLayer
          styleId={mapStyle as Exclude<MapStyleId, 'none'>}
          left={css(map.box.x)}
          top={css(map.box.y)}
          width={map.box.w * cssPerUnit}
          height={map.box.h * cssPerUnit}
          center={map.view.center}
          zoom={map.view.zoom}
          density={density}
          scale={detail}
          freeze={mode === 'print'}
          onReady={setMapOk}
        />
      )}
      {built && (
        <svg viewBox={vb} width={pageCss.w} height={pageCss.h} style={{ position: 'absolute', inset: 0 }} xmlns="http://www.w3.org/2000/svg">
          {/* fond de page autour du modèle (bordure imprimée) */}
          {spec.border !== 'none' && spec.border !== 'fine' && (
            <path fillRule="evenodd" fill={pageBg} d={`M${-g.bleed - 1} ${-g.bleed - 1}H${g.W + g.bleed + 1}V${g.H + g.bleed + 1}H${-g.bleed - 1}Z M${art.x} ${art.y}V${art.y + art.h}H${art.x + art.w}V${art.y}Z`} />
          )}
          <svg x={art.x} y={art.y} width={art.w} height={art.h} viewBox={`0 0 1000 ${art.h / s}`} overflow="visible">
            {built.svg}
          </svg>
          {spec.border !== 'none' && spec.border !== 'fine' && (
            <path fillRule="evenodd" fill={pageBg} d={`M${-g.bleed - 1} ${-g.bleed - 1}H${g.W + g.bleed + 1}V${g.H + g.bleed + 1}H${-g.bleed - 1}Z M${art.x} ${art.y}V${art.y + art.h}H${art.x + art.w}V${art.y}Z`} />
          )}
          {spec.border === 'fine' && <rect x={22} y={22} width={g.W - 44} height={g.H - 44} fill="none" stroke={ruleColor} strokeWidth={1.4} />}
          {spec.border === 'passepartout' && <rect x={art.x - 3} y={art.y - 3} width={art.w + 6} height={art.h + 6} fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth={3} />}
        </svg>
      )}
    </div>
  )

  if (mode === 'print') return page
  return (
    <div style={{ width: pageCss.w * zoom, height: pageCss.h * zoom, overflow: 'hidden' }}>
      <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>{page}</div>
    </div>
  )
}
