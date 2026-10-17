import { type Activity, buildActivity, parseTrack } from '@printrace/core'
import { DEMO, demoSample } from './demo.ts'

export const ACCEPT = '.gpx,.fit,.tcx,.kml,.kmz,.geojson,.json,.igc'

/** Lecture locale : le fichier ne quitte pas le navigateur. */
export async function activityFromFile(file: File): Promise<Activity> {
  const data = new Uint8Array(await file.arrayBuffer())
  return buildActivity(parseTrack(file.name, data), { fileName: file.name, source: 'file' })
}

export async function sampleActivity(): Promise<Activity> {
  if (DEMO) {
    const a = await demoSample()
    if (a) return a
  }
  const name = 'gr34-plouhinec-pointe-du-raz.gpx'
  const data = new Uint8Array(await (await fetch(`/samples/${name}`)).arrayBuffer())
  const a = buildActivity(parseTrack(name, data), { fileName: name, source: 'sample' })
  return { ...a, name: 'GR34 · Pointe du Raz' }
}
