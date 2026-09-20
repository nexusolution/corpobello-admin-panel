// Configurable lunch break (migration 0052). Habitual lunch per sucursal +
// professional + weekday, plus per-day overrides (move/resize/remove for one date
// without touching the habitual config). Times are minutes-from-midnight,
// branch-local. Pure resolution in resolveLunch; IO via Supabase. RLS: operators
// read (+ write overrides), admins write config.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type LunchConfig = {
  id: string
  sucursal: string
  professionalId: string | null // null = whole sucursal
  weekday: number // 0=Sun … 6=Sat
  startMin: number
  endMin: number
  active: boolean
}

export type LunchOverride = {
  id: string
  sucursal: string
  professionalId: string | null
  day: string // YYYY-MM-DD
  removed: boolean
  startMin: number | null
  endMin: number | null
}

export type LunchWindow = { startMin: number; endMin: number }

type ConfigRow = {
  id: string
  sucursal: string
  professional_id: string | null
  weekday: number
  start_min: number
  end_min: number
  active: boolean
}
type OverrideRow = {
  id: string
  sucursal: string
  professional_id: string | null
  day: string
  removed: boolean
  start_min: number | null
  end_min: number | null
}

function toConfig(r: ConfigRow): LunchConfig {
  return {
    id: r.id,
    sucursal: r.sucursal,
    professionalId: r.professional_id,
    weekday: r.weekday,
    startMin: r.start_min,
    endMin: r.end_min,
    active: r.active,
  }
}
function toOverride(r: OverrideRow): LunchOverride {
  return {
    id: r.id,
    sucursal: r.sucursal,
    professionalId: r.professional_id,
    day: r.day,
    removed: r.removed,
    startMin: r.start_min,
    endMin: r.end_min,
  }
}

export async function fetchLunch(): Promise<{
  config: LunchConfig[]
  overrides: LunchOverride[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { config: [], overrides: [], error: null }
  const sb = getSupabase()
  const [cfgRes, ovRes] = await Promise.all([
    sb.from('lunch_config').select('*'),
    sb.from('lunch_overrides').select('*'),
  ])
  const error = cfgRes.error?.message ?? ovRes.error?.message ?? null
  return {
    config: ((cfgRes.data as ConfigRow[] | null) ?? []).map(toConfig),
    overrides: ((ovRes.data as OverrideRow[] | null) ?? []).map(toOverride),
    error,
  }
}

// Prefer a professional-specific row over a sucursal-wide (null) one.
function pick<T extends { professionalId: string | null }>(rows: T[], pid: string | null): T | undefined {
  return rows.find((r) => r.professionalId === pid) ?? rows.find((r) => r.professionalId === null)
}

function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00.000Z`).getUTCDay()
}

/** The lunch window for (sucursal, professional, date), or null if none:
 *  a per-day override wins (removed → none; times → those); else the habitual
 *  config for that weekday (a professional-specific row overrides a sucursal-wide
 *  one; an inactive matching row means "no lunch"). Pure — pass loaded data. */
export function resolveLunch(
  sucursal: string,
  professionalId: string | null | undefined,
  dateStr: string,
  config: readonly LunchConfig[],
  overrides: readonly LunchOverride[],
): LunchWindow | null {
  const pid = professionalId ?? null
  const ov = pick(
    overrides.filter((o) => o.sucursal === sucursal && o.day === dateStr),
    pid,
  )
  if (ov) {
    if (ov.removed) return null
    if (ov.startMin != null && ov.endMin != null) return { startMin: ov.startMin, endMin: ov.endMin }
  }
  const wd = weekdayOf(dateStr)
  const cfg = pick(
    config.filter((c) => c.sucursal === sucursal && c.weekday === wd),
    pid,
  )
  if (cfg) return cfg.active ? { startMin: cfg.startMin, endMin: cfg.endMin } : null
  return null
}

export async function saveLunchConfig(
  row: Omit<LunchConfig, 'id'> & { id?: string },
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const payload: Record<string, unknown> = {
    sucursal: row.sucursal,
    professional_id: row.professionalId,
    weekday: row.weekday,
    start_min: row.startMin,
    end_min: row.endMin,
    active: row.active,
    updated_at: new Date().toISOString(),
  }
  if (row.id) payload.id = row.id
  const { error } = await getSupabase().from('lunch_config').upsert(payload, { onConflict: 'id' })
  return error ? error.message : null
}

export async function deleteLunchConfig(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('lunch_config').delete().eq('id', id)
  return error ? error.message : null
}

/** Upsert the override for (sucursal, professional, day): removes any existing one
 *  first (single override per scope+day), then inserts the new state. */
export async function saveLunchOverride(row: {
  sucursal: string
  professionalId: string | null
  day: string
  removed: boolean
  startMin: number | null
  endMin: number | null
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const sb = getSupabase()
  let del = sb.from('lunch_overrides').delete().eq('sucursal', row.sucursal).eq('day', row.day)
  del = row.professionalId == null ? del.is('professional_id', null) : del.eq('professional_id', row.professionalId)
  await del
  const { error } = await sb.from('lunch_overrides').insert({
    sucursal: row.sucursal,
    professional_id: row.professionalId,
    day: row.day,
    removed: row.removed,
    start_min: row.startMin,
    end_min: row.endMin,
  })
  return error ? error.message : null
}
