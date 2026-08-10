// Auto-gestión / Agenda — per-sucursal weekly opening hours, backed by the
// sucursal_hours table (migration 0021). RLS: any staff reads, admin writes.
// weekday follows JS getDay(): 0 = Sunday … 6 = Saturday.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export const SUCURSALES = ['caballito', 'merlo', 'moreno'] as const
export type Sucursal = (typeof SUCURSALES)[number]

// Display order Monday → Sunday (weekday numbers in JS getDay convention).
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export type DayHours = {
  weekday: number
  isOpen: boolean
  open: string // 'HH:MM'
  close: string // 'HH:MM'
}

// Sensible starting template when a branch has no saved hours yet:
// Mon–Fri 09–19, Sat 09–14, Sun closed.
function defaultDay(weekday: number): DayHours {
  if (weekday === 0) return { weekday, isOpen: false, open: '09:00', close: '19:00' }
  if (weekday === 6) return { weekday, isOpen: true, open: '09:00', close: '14:00' }
  return { weekday, isOpen: true, open: '09:00', close: '19:00' }
}

function toHHMM(t: string | null): string {
  // Postgres `time` comes back as 'HH:MM:SS' — trim to 'HH:MM'.
  return t ? t.slice(0, 5) : ''
}

type Row = {
  weekday: number
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

/** Fetch a branch's 7-day schedule, filling defaults for any missing weekday. */
export async function fetchSucursalHours(sucursal: Sucursal): Promise<DayHours[]> {
  const byDay = new Map<number, DayHours>()
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from('sucursal_hours')
      .select('weekday, is_open, open_time, close_time')
      .eq('sucursal', sucursal)
    for (const r of (data as Row[] | null) ?? []) {
      byDay.set(r.weekday, {
        weekday: r.weekday,
        isOpen: r.is_open,
        open: toHHMM(r.open_time) || '09:00',
        close: toHHMM(r.close_time) || '19:00',
      })
    }
  }
  return WEEKDAY_ORDER.map((wd) => byDay.get(wd) ?? defaultDay(wd))
}

/** Upsert a branch's full weekly schedule (7 rows) in one round-trip. */
export async function saveSucursalHours(
  sucursal: Sucursal,
  days: DayHours[],
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const now = new Date().toISOString()
  const payload = days.map((d) => ({
    sucursal,
    weekday: d.weekday,
    is_open: d.isOpen,
    open_time: d.isOpen ? d.open : null,
    close_time: d.isOpen ? d.close : null,
    updated_at: now,
  }))
  const { error } = await getSupabase()
    .from('sucursal_hours')
    .upsert(payload, { onConflict: 'sucursal,weekday' })
  return error ? error.message : null
}
