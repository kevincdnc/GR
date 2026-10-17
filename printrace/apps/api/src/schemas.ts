import { z } from 'zod'

/** Activité reçue du navigateur : bornée pour protéger le moteur de rendu. */
export const ActivitySchema = z.object({
  id: z.string().max(80),
  name: z.string().max(200),
  sport: z.enum(['hike', 'run', 'ride', 'moto', 'ski', 'swim', 'other']),
  source: z.enum(['file', 'strava', 'sample']),
  coords: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180), z.number(), z.number()])).min(2).max(60_000),
  stats: z.object({
    distanceM: z.number().nonnegative(),
    elevationGainM: z.number().nonnegative(),
    elevationLossM: z.number().nonnegative(),
    altMinM: z.number().nullable(),
    altMaxM: z.number().nullable(),
    movingTimeS: z.number().nullable(),
    elapsedTimeS: z.number().nullable(),
    startTime: z.number().nullable(),
  }),
  bounds: z.object({ minLat: z.number(), minLon: z.number(), maxLat: z.number(), maxLon: z.number() }),
})
