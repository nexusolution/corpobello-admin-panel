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

// ── CSV exports (Etapa 4) ─────────────────────────────────────────────────────

export type CsvExport = { headers: string[]; rows: (string | number)[][] }

function embed<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** All patients, export-ready. */
export async function fetchPacientesExport(): Promise<{ data: CsvExport; error: string | null }> {
  const empty = { headers: [], rows: [] }
  if (!isSupabaseConfigured()) return { data: empty, error: null }
  const { data, error } = await getSupabase()
    .from('patients')
    .select('full_name, whatsapp_phone, email, dni, sucursal, status, created_at')
    .order('created_at', { ascending: false })
  if (error) return { data: empty, error: error.message }
  return {
    data: {
      headers: ['Nombre', 'Teléfono', 'Email', 'DNI', 'Sucursal', 'Estado', 'Alta'],
      rows: (data as any[]).map((r) => [
        r.full_name ?? '',
        r.whatsapp_phone ?? '',
        r.email ?? '',
        r.dni ?? '',
        r.sucursal ?? '',
        r.status ?? '',
        fmtDate(r.created_at),
      ]),
    },
    error: null,
  }
}

/** Turnos in [fromIso, toIso], export-ready. */
export async function fetchTurnosExport(
  fromIso: string,
  toIso: string,
): Promise<{ data: CsvExport; error: string | null }> {
  const empty = { headers: [], rows: [] }
  if (!isSupabaseConfigured()) return { data: empty, error: null }
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select(
      'title, starts_at, ends_at, status, sucursal, treatment_slug, charged, patient:patient_id (full_name), professional:professional_id (display_name)',
    )
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .order('starts_at', { ascending: true })
  if (error) return { data: empty, error: error.message }
  return {
    data: {
      headers: ['Inicio', 'Fin', 'Paciente', 'Profesional', 'Tratamiento', 'Sucursal', 'Estado', 'Cobrado'],
      rows: (data as any[]).map((r) => [
        fmtDate(r.starts_at),
        fmtDate(r.ends_at),
        embed<{ full_name: string | null }>(r.patient)?.full_name ?? r.title ?? '',
        embed<{ display_name: string | null }>(r.professional)?.display_name ?? '',
        (r.treatment_slug ?? '').replace(/-/g, ' '),
        r.sucursal ?? '',
        r.status ?? '',
        r.charged ? 'Sí' : 'No',
      ]),
    },
    error: null,
  }
}

/** All leads, export-ready. */
export async function fetchLeadsExport(): Promise<{ data: CsvExport; error: string | null }> {
  const empty = { headers: [], rows: [] }
  if (!isSupabaseConfigured()) return { data: empty, error: null }
  const { data, error } = await getSupabase()
    .from('leads')
    .select('whatsapp_phone, display_name, status, created_at, last_message_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) return { data: empty, error: error.message }
  return {
    data: {
      headers: ['Teléfono', 'Nombre', 'Estado', 'Alta', 'Última actividad'],
      rows: (data as any[]).map((r) => [
        r.whatsapp_phone ?? '',
        r.display_name ?? '',
        r.status ?? '',
        fmtDate(r.created_at),
        fmtDate(r.last_message_at),
      ]),
    },
    error: null,
  }
}
