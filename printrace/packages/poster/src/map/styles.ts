// Styles de fond de carte. Les styles vectoriels sont dessinés pour l'affiche
// (pas de POI, hiérarchie routière discrète, libellés sobres) sur les tuiles
// OpenMapTiles d'OpenFreeMap (libres, usage commercial autorisé, attribution
// OSM requise). Vectoriel = libellés nets à toutes les résolutions d'impression.
import type { StyleSpecification } from 'maplibre-gl'
import type { MapStyleId } from '../spec.ts'

/** Fournisseurs : à surcharger (clé MapTiler, serveur maison…) via configureTiles(). */
export const TILES = {
  vector: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  terrarium: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  // Imagerie : vérifier la licence du fournisseur pour la vente de tirages.
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}
export function configureTiles(over: Partial<typeof TILES>) {
  Object.assign(TILES, over)
}

export const MAP_ATTRIBUTION: Record<MapStyleId, string> = {
  none: '',
  nuit: '© OpenStreetMap · OpenMapTiles · OpenFreeMap',
  papier: '© OpenStreetMap · OpenMapTiles · OpenFreeMap',
  encre: '© OpenStreetMap · OpenMapTiles · OpenFreeMap',
  relief: '© OpenStreetMap · OpenMapTiles · OpenFreeMap · Mapzen Terrain',
  satellite: '© Esri, Maxar, Earthstar Geographics',
}

interface Palette {
  bg: string
  water: string
  park: string
  wood: string
  urban: string
  major: string
  road: string
  minor: string
  path: string
  rail: string
  boundary: string
  label: string
  halo: string
  labels: boolean
  hillshade?: { shadow: string; highlight: string; accent: string; strength: number }
}

const PALETTES: Record<'nuit' | 'papier' | 'relief' | 'encre', Palette> = {
  nuit: {
    bg: '#16171a', water: '#0c0e12', park: '#1a1d1b', wood: '#1b1e1b', urban: '#1c1d21',
    major: '#3a3b40', road: '#2e2f34', minor: '#25262a', path: '#2a2b2f', rail: '#2a2b2f',
    boundary: '#4a4b52', label: '#8d8f96', halo: '#16171a', labels: true,
  },
  papier: {
    bg: '#f3efe6', water: '#c8d7dc', park: '#e3e6d2', wood: '#dde2cb', urban: '#ebe5d8',
    major: '#d4c8b0', road: '#ddd3c1', minor: '#e6ddcd', path: '#cfc3ad', rail: '#d6cdbd',
    boundary: '#b9ad98', label: '#6f685c', halo: '#f3efe6', labels: true,
  },
  relief: {
    bg: '#f1eee5', water: '#bcd2dc', park: '#e0e5cd', wood: '#d6dfc2', urban: '#e8e2d4',
    major: '#d9cbb0', road: '#e2d7c3', minor: '#e8e0d0', path: '#cbbfa8', rail: '#d6cdbd',
    boundary: '#b3a892', label: '#5d574c', halo: '#f1eee5', labels: true,
    hillshade: { shadow: '#5b5546', highlight: '#ffffff', accent: '#8a826f', strength: 0.55 },
  },
  encre: {
    bg: '#fbfaf7', water: '#e9e8e3', park: '#f4f3ee', wood: '#f1f0ea', urban: '#f6f5f1',
    major: '#d7d5cf', road: '#e1dfd9', minor: '#e9e7e2', path: '#e1dfd9', rail: '#e1dfd9',
    boundary: '#d0cec8', label: '#9a978f', halo: '#fbfaf7', labels: false,
  },
}

// Expressions MapLibre (typage volontairement lâche : la spec est validée à l'exécution)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expr = any
const name: Expr = ['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']]
const z = (pairs: number[]): Expr => ['interpolate', ['exponential', 1.6], ['zoom'], ...pairs]

function vectorStyle(p: Palette): StyleSpecification {
  const roadsOf = (classes: string[]): Expr => ['match', ['get', 'class'], classes, true, false]
  const style: StyleSpecification = {
    version: 8,
    glyphs: TILES.glyphs,
    sources: { omt: { type: 'vector', url: TILES.vector } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': p.bg } },
      { id: 'urban', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial'], true, false], paint: { 'fill-color': p.urban } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false], paint: { 'fill-color': p.wood } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': p.park } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': p.water } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': p.water, 'line-width': z([8, 0.5, 14, 2]) } },
    ] as StyleSpecification['layers'],
  }
  if (p.hillshade) {
    style.sources.dem = { type: 'raster-dem', tiles: [TILES.terrarium], encoding: 'terrarium', tileSize: 256, maxzoom: 14 }
    style.layers.push({
      id: 'hillshade', type: 'hillshade', source: 'dem',
      paint: {
        'hillshade-shadow-color': p.hillshade.shadow,
        'hillshade-highlight-color': p.hillshade.highlight,
        'hillshade-accent-color': p.hillshade.accent,
        'hillshade-exaggeration': p.hillshade.strength,
      },
    })
  }
  style.layers.push(
    { id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12, filter: roadsOf(['path', 'track']), paint: { 'line-color': p.path, 'line-width': z([12, 0.5, 16, 1.2]), 'line-dasharray': [2, 1.5] } },
    { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadsOf(['rail']), paint: { 'line-color': p.rail, 'line-width': z([8, 0.5, 14, 1.2]) } },
    { id: 'minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11, filter: roadsOf(['minor', 'service']), paint: { 'line-color': p.minor, 'line-width': z([11, 0.4, 16, 3]) } },
    { id: 'road', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadsOf(['secondary', 'tertiary']), paint: { 'line-color': p.road, 'line-width': z([7, 0.4, 16, 5]) } },
    { id: 'major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadsOf(['motorway', 'trunk', 'primary']), paint: { 'line-color': p.major, 'line-width': z([5, 0.5, 16, 7]) } },
    { id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 4], paint: { 'line-color': p.boundary, 'line-width': 0.8, 'line-dasharray': [3, 2] } },
  )
  if (p.labels) {
    style.layers.push({
      id: 'places', type: 'symbol', source: 'omt', 'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
      layout: {
        'text-field': name,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'class'], 'city', 14, 'town', 12, 10.5],
        'text-letter-spacing': 0.04,
        'text-padding': 6,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.4 },
    })
  }
  return style
}

/**
 * Style MapLibre d'un fond. `pixelRatio` sert à l'imagerie raster : on demande
 * des tuiles d'un niveau plus fin pour qu'elles restent nettes à 300 dpi.
 */
export function mapStyle(id: Exclude<MapStyleId, 'none'>, pixelRatio = 1): StyleSpecification {
  if (id === 'satellite') {
    const tileSize = Math.max(64, Math.min(256, Math.round(256 / Math.max(1, pixelRatio))))
    return {
      version: 8,
      sources: { sat: { type: 'raster', tiles: [TILES.satellite], tileSize, maxzoom: 19 } },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#26301f' } },
        { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 0 } },
      ],
    }
  }
  return vectorStyle(PALETTES[id])
}

/** Couleur de fond (pendant le chargement, vignettes, échec réseau) */
export const MAP_BACKGROUND: Record<MapStyleId, string> = {
  none: 'transparent',
  nuit: PALETTES.nuit.bg,
  papier: PALETTES.papier.bg,
  relief: PALETTES.relief.bg,
  encre: PALETTES.encre.bg,
  satellite: '#26301f',
}
