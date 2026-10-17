import { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { MapStyleId } from '../spec.ts'
import { MAP_BACKGROUND, mapStyle } from './styles.ts'

export interface MapLayerProps {
  styleId: Exclude<MapStyleId, 'none'>
  /** Position et taille en pixels CSS « physiques » (96 dpi) dans la page */
  left: number
  top: number
  width: number
  height: number
  center: [number, number]
  zoom: number
  /** Pixels réels par pixel CSS physique (300 dpi → 3,125) */
  density: number
  /** Niveau de détail : la carte est rendue `scale` fois plus grande puis réduite */
  scale: number
  /** Impression : la carte finie est figée en image (fiable pour le PDF) */
  freeze?: boolean
  onReady?: (ok: boolean) => void
}

const MAX_CANVAS = 8192

export function MapLayer(p: MapLayerProps) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const onReady = useRef(p.onReady)
  onReady.current = p.onReady
  const ratio = Math.min(p.density / p.scale, MAX_CANVAS / (p.width * p.scale), MAX_CANVAS / (p.height * p.scale))
  const zoom = p.zoom + Math.log2(p.scale)

  useEffect(() => {
    const el = host.current!
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      if (ok && p.freeze) {
        const img = new Image()
        img.src = m.getCanvas().toDataURL('image/jpeg', 0.95)
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
        img.decode().then(() => {
          el.appendChild(img)
          m.getCanvas().style.visibility = 'hidden'
          onReady.current?.(true)
        })
      } else onReady.current?.(ok)
    }
    const m = new MapLibreMap({
      container: el,
      style: mapStyle(p.styleId, ratio * p.scale),
      center: p.center,
      zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      pixelRatio: ratio,
      maxCanvasSize: [MAX_CANVAS, MAX_CANVAS],
      canvasContextAttributes: { preserveDrawingBuffer: !!p.freeze, antialias: true },
      renderWorldCopies: false,
    })
    map.current = m
    m.once('idle', () => finish(true))
    const timer = setTimeout(() => finish(false), 45_000)
    return () => {
      clearTimeout(timer)
      m.remove()
      map.current = null
    }
    // la vue est mise à jour sans recréer la carte (effet suivant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.styleId, ratio, p.scale, p.freeze, p.width, p.height])

  useEffect(() => {
    map.current?.jumpTo({ center: p.center, zoom })
  }, [p.center[0], p.center[1], zoom])

  return (
    <div
      ref={host}
      style={{
        position: 'absolute',
        left: p.left,
        top: p.top,
        width: p.width * p.scale,
        height: p.height * p.scale,
        transform: `scale(${1 / p.scale})`,
        transformOrigin: '0 0',
        background: MAP_BACKGROUND[p.styleId],
        overflow: 'hidden',
      }}
    />
  )
}
