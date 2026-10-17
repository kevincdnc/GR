/** Point brut lu dans un fichier : altitude (m) et heure (ms epoch) facultatives. */
export interface TrackPoint {
  lat: number
  lon: number
  ele: number | null
  time: number | null
}

export type Sport = 'hike' | 'run' | 'ride' | 'moto' | 'ski' | 'swim' | 'other'

/** Trace lue, avant calculs. */
export interface RawTrack {
  name: string | null
  points: TrackPoint[]
  sport?: Sport
}

export interface TrackStats {
  distanceM: number
  elevationGainM: number
  elevationLossM: number
  altMinM: number | null
  altMaxM: number | null
  /** Temps en mouvement (s), si la trace est horodatée. */
  movingTimeS: number | null
  /** Durée totale (s), pauses comprises. */
  elapsedTimeS: number | null
  startTime: number | null
}

/**
 * Activité prête à être mise en page : c'est l'unique entrée « données » du
 * moteur de poster. Les points sont simplifiés (≈ 0,5 m) et portent l'altitude lissée.
 */
export interface Activity {
  id: string
  name: string
  sport: Sport
  source: 'file' | 'strava' | 'sample'
  /** [lat, lon, altitude lissée m, distance cumulée m] */
  coords: [number, number, number, number][]
  stats: TrackStats
  bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number }
}
