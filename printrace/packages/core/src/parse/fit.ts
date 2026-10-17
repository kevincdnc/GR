import type { RawTrack, Sport, TrackPoint } from '../types.ts'

const FIT_EPOCH = 631065600 // 1989-12-31T00:00:00Z
// Valeurs du champ sport (message 12 / 18)
const FIT_SPORTS: Record<number, Sport> = { 1: 'run', 2: 'ride', 5: 'swim', 11: 'hike', 12: 'ski', 13: 'ski', 17: 'hike', 22: 'moto' }

export function isFit(bytes: Uint8Array): boolean {
  return bytes.length > 12 && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === '.FIT'
}

/** FIT (Garmin, Wahoo, Coros, Suunto…) : messages « record » (position, altitude, heure). */
export function parseFit(input: ArrayBuffer | Uint8Array): RawTrack {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (!isFit(bytes)) throw new Error('Fichier FIT invalide')
  const headerSize = dv.getUint8(0)
  const end = Math.min(dv.byteLength, headerSize + dv.getUint32(4, true))
  const defs: Record<number, { global: number; le: boolean; fields: { num: number; size: number; base: number }[]; devSize: number }> = {}
  const points: TrackPoint[] = []
  let name: string | null = null
  let sport: Sport | undefined
  let pos = headerSize
  let lastTs: number | null = null
  const read = (off: number, size: number, base: number, le: boolean): number | string | null => {
    const t = base & 0x1f
    if (t === 7) {
      const out: number[] = []
      for (let i = 0; i < size; i++) {
        const c = dv.getUint8(off + i)
        if (!c) break
        out.push(c)
      }
      return new TextDecoder('utf-8').decode(new Uint8Array(out))
    }
    if (size === 1) return t === 1 ? dv.getInt8(off) : dv.getUint8(off)
    if (size === 2) return t === 3 ? dv.getInt16(off, le) : dv.getUint16(off, le)
    if (size === 4) return t === 5 ? dv.getInt32(off, le) : dv.getUint32(off, le)
    return null
  }
  while (pos < end) {
    const h = dv.getUint8(pos++)
    let local: number
    let compressedTs: number | null = null
    if (h & 0x80) {
      local = (h >> 5) & 0x3
      const off = h & 0x1f
      if (lastTs != null) {
        compressedTs = (lastTs & ~0x1f) + off
        if (off < (lastTs & 0x1f)) compressedTs += 0x20
      }
    } else if (h & 0x40) {
      local = h & 0x0f
      const hasDev = h & 0x20
      const le = dv.getUint8(pos + 1) === 0
      const global = dv.getUint16(pos + 2, le)
      const n = dv.getUint8(pos + 4)
      pos += 5
      const fields = []
      for (let i = 0; i < n; i++) {
        fields.push({ num: dv.getUint8(pos), size: dv.getUint8(pos + 1), base: dv.getUint8(pos + 2) })
        pos += 3
      }
      let devSize = 0
      if (hasDev) {
        const nd = dv.getUint8(pos++)
        for (let i = 0; i < nd; i++) {
          devSize += dv.getUint8(pos + 1)
          pos += 3
        }
      }
      defs[local] = { global, le, fields, devSize }
      continue
    } else {
      local = h & 0x0f
    }
    const def = defs[local]
    if (!def) throw new Error('FIT : définition manquante')
    const v: Record<number, number | string | null> = {}
    for (const f of def.fields) {
      v[f.num] = read(pos, f.size, f.base, def.le)
      pos += f.size
    }
    pos += def.devSize
    const ts = v[253]
    if (typeof ts === 'number' && ts !== 0xffffffff) lastTs = ts
    else if (compressedTs != null) {
      lastTs = compressedTs
      v[253] = compressedTs
    }
    if (def.global === 20) {
      const la = v[0] as number | null
      const lo = v[1] as number | null
      if (la == null || lo == null || la === 0x7fffffff || lo === 0x7fffffff) continue
      let ele: number | null = null
      const enh = v[78] as number | null
      const alt = v[2] as number | null
      if (enh != null && enh !== 0xffffffff) ele = enh / 5 - 500
      else if (alt != null && alt !== 0xffff) ele = alt / 5 - 500
      const t = v[253] as number | null
      points.push({ lat: la * (180 / 2 ** 31), lon: lo * (180 / 2 ** 31), ele, time: t != null ? (t + FIT_EPOCH) * 1000 : null })
    } else if ((def.global === 12 || def.global === 18) && typeof v[def.global === 12 ? 0 : 5] === 'number') {
      sport ??= FIT_SPORTS[v[def.global === 12 ? 0 : 5] as number]
    } else if (def.global === 31 && typeof v[5] === 'string' && v[5]) {
      name = v[5]
    }
  }
  return { name, points, sport }
}
