// Shared helpers for mapping raw Supabase rows into the panel's view models.
//
// The bot + Module A schema don't populate every field the UI was prototyped
// with (sucursal isn't on the leads/patients row — it lives in conversation
// state; there are no tags/photo-count columns yet). Rather than inventing
// data, the mappers fall back to neutral values (null sucursal renders as "—",
// zero counts, no tags) so the panel shows what's really there.

export type Sucursal = 'caballito' | 'merlo' | 'moreno'

/** Last 4 digits of a phone, for the privacy-preserving "···1234" display. */
export function phoneLast4(phone: string | null | undefined): string {
  if (!phone) return '----'
  const digits = phone.replace(/\D/g, '')
  return digits.slice(-4).padStart(4, '·')
}

/** Coerce a free-text sucursal to the known set, else null (renders as "—"). */
export function normalizeSucursal(value: unknown): Sucursal | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (v === 'caballito' || v === 'merlo' || v === 'moreno') return v
  return null
}

/** Whole days between `iso` and now. Runs client-side, so `new Date()` is fine. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

/** Fractional hours between `iso` and now (for the Kanban "last activity" line). */
export function hoursSince(iso: string | null | undefined): number {
  if (!iso) return 0
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, (Date.now() - then) / 3_600_000)
}
