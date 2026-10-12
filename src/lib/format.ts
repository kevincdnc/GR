const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export const fmtKm = (n: number) => `${nf1.format(n)} km`
export const fmtM = (n: number) => `${nf0.format(n)} m`
export const fmt1 = (n: number) => nf1.format(n)
export const fmt0 = (n: number) => nf0.format(n)

export function fmtDuration(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (m === 60) return `${h + 1} h 00`
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** Accepte "7h30", "7 h 30", "7:30", "7.5h", "450" (minutes), "450min". */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.')
  if (!s) return null
  let m = s.match(/^(\d+)\s*(?:h|:)\s*(\d{1,2})?\s*(?:min|m)?$/)
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0)
  m = s.match(/^(\d+(?:\.\d+)?)\s*h$/)
  if (m) return Math.round(Number(m[1]) * 60)
  m = s.match(/^(\d+)\s*(?:min|m)?$/)
  if (m) return Number(m[1])
  return null
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
