// Operational reports (Etapa 4). Derived from existing data — no new tables.
// First report: hours per professional, from the agenda turnos (calendar_events).

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type ProfessionalHours = {
  professionalId: string
  professionalName: string
  turnos: number
  hours: number // total attended hours in the range
}

// Sum timed turno durations per professional in [fromIso, toIso]. Excludes
// all-day placeholders and cancelled turnos. Grouped + summed client-side.
export async function fetchProfessionalHours(
  fromIso: string,
  toIso: string,
): Promise<{ data: ProfessionalHours[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('professional_id, starts_at, ends_at, professional:professional_id (display_name)')
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .eq('all_day', false)
    .not('professional_id', 'is', null)
    .neq('status', 'cancelado')
  if (error) return { data: [], error: error.message }

  const byPro = new Map<string, ProfessionalHours>()
  for (const row of (data as any[]) ?? []) {
    const id = row.professional_id as string
    const start = new Date(row.starts_at).getTime()
    const end = new Date(row.ends_at).getTime()
    const hours = Number.isFinite(start) && Number.isFinite(end) && end > start
      ? (end - start) / 3_600_000
      : 0
    const prof = Array.isArray(row.professional) ? row.professional[0] : row.professional
    const name = prof?.display_name?.trim() || 'Sin asignar'
    const cur = byPro.get(id) ?? { professionalId: id, professionalName: name, turnos: 0, hours: 0 }
    cur.turnos += 1
    cur.hours += hours
    byPro.set(id, cur)
  }
  const result = [...byPro.values()].sort((a, b) => b.hours - a.hours)
  return { data: result, error: null }
}
