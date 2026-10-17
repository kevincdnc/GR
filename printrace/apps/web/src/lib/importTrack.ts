import { type Activity, buildActivity, parseTrack } from '@printrace/core'
import sample from './sample-activity.json'

export const ACCEPT = '.gpx,.fit,.tcx,.kml,.kmz,.geojson,.json,.igc'

/** Lecture locale : le fichier ne quitte pas le navigateur. */
export async function activityFromFile(file: File): Promise<Activity> {
  const data = new Uint8Array(await file.arrayBuffer())
  return buildActivity(parseTrack(file.name, data), { fileName: file.name, source: 'file' })
}

/** Étape GR34 Plouhinec → Pointe du Raz, précalculée (scripts/make-sample.ts) */
export const SAMPLE_ACTIVITY = sample as unknown as Activity

export async function sampleActivity(): Promise<Activity> {
  return SAMPLE_ACTIVITY
}
