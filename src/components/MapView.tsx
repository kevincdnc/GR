import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Polyline,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { stageColor, type Stage } from '../data'
import { fmtDuration, fmtKm, fmtM } from '../lib/format'
import { ElevationProfile } from './ElevationProfile'

/* ---------- Fonds de carte ---------- */

const IGN = (layer: string, format: 'png' | 'jpeg') =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/${format}`

interface BaseLayer {
  id: string
  name: string
  url: string
  attribution: string
  maxNativeZoom: number
  subdomains?: string
}

const BASE_LAYERS: BaseLayer[] = [
  {
    id: 'ign-plan',
    name: 'IGN Plan',
    url: IGN('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'png'),
    attribution: '&copy; <a href="https://www.ign.fr/">IGN</a> – Géoplateforme',
    maxNativeZoom: 19,
  },
  {
    id: 'ign-ortho',
    name: 'IGN Photos aériennes',
    url: IGN('ORTHOIMAGERY.ORTHOPHOTOS', 'jpeg'),
    attribution: '&copy; <a href="https://www.ign.fr/">IGN</a> – Géoplateforme',
    maxNativeZoom: 19,
  },
  {
    id: 'opentopo',
    name: 'OpenTopoMap (relief)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Données &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxNativeZoom: 17,
    subdomains: 'abc',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  {
    id: 'cyclosm',
    name: 'CyclOSM (sentiers)',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution:
      '<a href="https://www.cyclosm.org">CyclOSM</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 20,
    subdomains: 'abc',
  },
  {
    id: 'esri-sat',
    name: 'Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
]

const MAX_ZOOM = 21
const LAYER_KEY = 'gr34.baselayer.v1'

function savedLayer(): string {
  try {
    return localStorage.getItem(LAYER_KEY) ?? BASE_LAYERS[0].id
  } catch {
    return BASE_LAYERS[0].id
  }
}

/* ---------- Contrôleurs internes ---------- */

function FitTo({ bounds, trigger }: { bounds: L.LatLngBoundsExpression | null; trigger: unknown }) {
  const map = useMap()
  useEffect(() => {
    if (!bounds) return
    // On attend que le panneau profil ait (dés)affiché pour recalculer la taille de la carte
    const id = setTimeout(() => {
      map.invalidateSize()
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6 })
    }, 60)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])
  return null
}

function StatusBar() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  const [pos, setPos] = useState<L.LatLng | null>(null)
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    mousemove: (e) => setPos(e.latlng),
    mouseout: () => setPos(null),
    baselayerchange: (e) => {
      const layer = BASE_LAYERS.find((b) => b.name === e.name)
      if (layer) {
        try {
          localStorage.setItem(LAYER_KEY, layer.id)
        } catch {
          /* ignore */
        }
      }
    },
  })
  return (
    <div className="map-status">
      <span>Zoom {zoom.toFixed(2).replace(/\.?0+$/, '')}</span>
      {pos && (
        <span>
          {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
        </span>
      )}
    </div>
  )
}

function MapButtons({ onOverview, containerRef }: { onOverview: () => void; containerRef: React.RefObject<HTMLDivElement> }) {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const [me, setMe] = useState<{ latlng: L.LatLng; acc: number } | null>(null)

  useMapEvents({
    locationfound: (e) => {
      setLocating(false)
      setMe({ latlng: e.latlng, acc: e.accuracy })
    },
    locationerror: () => setLocating(false),
  })

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current)
      L.DomEvent.disableScrollPropagation(ref.current)
    }
  }, [])

  return (
    <>
      <div className="map-buttons leaflet-bar" ref={ref}>
        <button type="button" title="Vue d'ensemble du GR" aria-label="Vue d'ensemble" onClick={onOverview}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          title="Me localiser"
          aria-label="Me localiser"
          className={locating ? 'is-busy' : ''}
          onClick={() => {
            setLocating(true)
            map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true })
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <button
          type="button"
          title="Plein écran"
          aria-label="Plein écran"
          onClick={() => {
            const el = containerRef.current
            if (!el) return
            if (document.fullscreenElement) document.exitFullscreen()
            else el.requestFullscreen?.().then(() => setTimeout(() => map.invalidateSize(), 150))
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 3h7v2H5v5H3zM21 3v7h-2V5h-5V3zM3 21v-7h2v5h5v2zM21 21h-7v-2h5v-5h2z" fill="currentColor" />
          </svg>
        </button>
      </div>
      {me && (
        <>
          <CircleMarker center={me.latlng} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }}>
            <Tooltip>Vous êtes ici (± {Math.round(me.acc)} m)</Tooltip>
          </CircleMarker>
        </>
      )}
    </>
  )
}

/* ---------- Vue principale ---------- */

export function MapView({ stages }: { stages: Stage[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [fitTick, setFitTick] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialLayer = useMemo(savedLayer, [])

  const selected = stages.find((s) => s.id === selectedId) ?? null
  const visible = stages.filter((s) => !hidden.has(s.id))

  const allBounds = useMemo(() => {
    if (!stages.length) return null
    const b = L.latLngBounds(stages[0].bounds)
    for (const s of stages) b.extend(s.bounds)
    return b
  }, [stages])

  const fitBounds = selected ? L.latLngBounds(selected.bounds) : allBounds

  const select = (id: string | null) => {
    setSelectedId((cur) => (cur === id ? cur : id))
    setHoverIdx(null)
    setFitTick((t) => t + 1)
  }

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Survol de la trace -> point le plus proche du profil
  const onTrackHover = (s: Stage, latlng: L.LatLng) => {
    if (s.id !== selectedId) return
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < s.profile.length; i++) {
      const p = s.profile[i]
      const d = (p[2] - latlng.lat) ** 2 + ((p[3] - latlng.lng) * Math.cos((latlng.lat * Math.PI) / 180)) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    setHoverIdx(best)
  }

  const hoverPoint = selected && hoverIdx != null ? selected.profile[hoverIdx] : null

  const totalKm = stages.reduce((a, s) => a + s.distanceKm, 0)

  return (
    <div className="map-layout">
      <aside className="stage-list" aria-label="Étapes">
        <div className="stage-list__head">
          <button type="button" className={`chip ${selected ? '' : 'is-active'}`} onClick={() => select(null)}>
            Tout le GR · {fmtKm(totalKm)}
          </button>
        </div>
        <ul>
          {stages.map((s) => {
            const isHidden = hidden.has(s.id)
            return (
              <li key={s.id} className={`stage-item ${s.id === selectedId ? 'is-selected' : ''} ${isHidden ? 'is-hidden' : ''}`}>
                <label className="stage-item__toggle" title={isHidden ? 'Afficher' : 'Masquer'}>
                  <input type="checkbox" checked={!isHidden} onChange={() => toggle(s.id)} />
                  <span className="swatch" style={{ background: stageColor(s.num) }} />
                </label>
                <button type="button" className="stage-item__main" onClick={() => select(s.id)}>
                  <span className="stage-item__title">
                    <b>#{s.num}</b> {s.name}
                  </span>
                  <span className="stage-item__meta">
                    {fmtKm(s.distanceKm)} · D+ {fmtM(s.elevationGain)} · {fmtDuration(s.durationMin)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {!stages.length && <p className="empty">Aucun GPX trouvé. Dépose tes fichiers dans le dossier <code>gpx/</code>.</p>}
      </aside>

      <div className="map-col">
        <div className="map-wrap" ref={containerRef}>
          <MapContainer
            className="map"
            bounds={allBounds ?? L.latLngBounds([47.7, -4.8], [48.1, -3.6])}
            boundsOptions={{ padding: [30, 30] }}
            maxZoom={MAX_ZOOM}
            zoomSnap={0.25}
            zoomDelta={0.5}
            wheelPxPerZoomLevel={90}
            preferCanvas={false}
          >
            <LayersControl position="topright">
              {BASE_LAYERS.map((b) => (
                <LayersControl.BaseLayer key={b.id} name={b.name} checked={b.id === initialLayer}>
                  <TileLayer
                    url={b.url}
                    attribution={b.attribution}
                    maxZoom={MAX_ZOOM}
                    maxNativeZoom={b.maxNativeZoom}
                    {...(b.subdomains ? { subdomains: b.subdomains } : {})}
                  />
                </LayersControl.BaseLayer>
              ))}
            </LayersControl>
            <ScaleControl position="bottomleft" imperial={false} />
            <StatusBar />
            <MapButtons onOverview={() => select(null)} containerRef={containerRef} />
            <FitTo bounds={fitBounds} trigger={fitTick} />

            {visible.map((s) => {
              const isSel = s.id === selectedId
              const dim = selected && !isSel
              const color = stageColor(s.num)
              return (
                <Fragment key={s.id + (isSel ? '-sel' : '')}>
                  <Polyline
                    positions={s.track}
                    pathOptions={{ color: '#ffffff', weight: isSel ? 10 : 7, opacity: dim ? 0.35 : 0.9, lineCap: 'round', lineJoin: 'round' }}
                    interactive={false}
                  />
                  <Polyline
                    positions={s.track}
                    pathOptions={{ color, weight: isSel ? 5 : 4, opacity: dim ? 0.45 : 1, lineCap: 'round', lineJoin: 'round' }}
                    eventHandlers={{
                      click: () => select(s.id),
                      mousemove: (e) => onTrackHover(s, e.latlng),
                    }}
                  >
                    {!isSel && (
                      <Tooltip sticky>
                        <b>#{s.num}</b> {s.name}
                        <br />
                        {fmtKm(s.distanceKm)} · D+ {fmtM(s.elevationGain)} · {s.kmEffort.toFixed(1)} km effort
                      </Tooltip>
                    )}
                  </Polyline>
                  {(isSel || !selected) && (
                    <>
                      <CircleMarker
                        center={s.track[0]}
                        radius={6}
                        pathOptions={{ color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 }}
                      >
                        <Tooltip direction="top">
                          Départ #{s.num} · {s.from}
                        </Tooltip>
                      </CircleMarker>
                      <CircleMarker
                        center={s.track[s.track.length - 1]}
                        radius={6}
                        pathOptions={{ color, weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}
                      >
                        <Tooltip direction="top">
                          Arrivée #{s.num} · {s.to || s.from}
                        </Tooltip>
                      </CircleMarker>
                    </>
                  )}
                </Fragment>
              )
            })}

            {hoverPoint && (
              <CircleMarker
                center={[hoverPoint[2], hoverPoint[3]]}
                radius={8}
                pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0b0b0b', fillOpacity: 1 }}
                interactive={false}
              />
            )}
          </MapContainer>
        </div>

        {selected && (
          <section className="profile-panel" aria-label={`Profil de l'étape ${selected.num}`}>
            <header className="profile-panel__head">
              <h2>
                <span className="swatch" style={{ background: stageColor(selected.num) }} />#{selected.num} {selected.name}
              </h2>
              <dl className="inline-stats">
                <div><dt>Distance</dt><dd>{fmtKm(selected.distanceKm)}</dd></div>
                <div><dt>D+</dt><dd>{fmtM(selected.elevationGain)}</dd></div>
                <div><dt>D−</dt><dd>{fmtM(selected.elevationLoss)}</dd></div>
                <div><dt>Km effort</dt><dd>{selected.kmEffort.toFixed(1).replace('.', ',')}</dd></div>
                <div><dt>Durée</dt><dd>{fmtDuration(selected.durationMin)}{selected.durationSource === 'estimée' ? ' (est.)' : ''}</dd></div>
                <div><dt>Alt. max</dt><dd>{fmtM(selected.altMax)}</dd></div>
              </dl>
              <button type="button" className="close" aria-label="Fermer le profil" onClick={() => select(null)}>
                ×
              </button>
            </header>
            <ElevationProfile stage={selected} hoverIdx={hoverIdx} onHover={setHoverIdx} />
          </section>
        )}
      </div>
    </div>
  )
}
