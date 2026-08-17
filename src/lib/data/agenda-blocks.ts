// Agenda blocks — feriados / cierres de sucursal / vacaciones (migration 0037).
// professionalId null = whole-branch closure (feriado); set = a professional's
// vacation. sucursal null = all branches.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { getCurrentUserId } from '@/lib/data/calendar-events'

export type AgendaBlock = {
  id: string
  sucursal: string | null
  professionalId: string | null
  professionalName: string | null
  startDate: string
  endDate: string
  reason: string | null
}

export type AgendaBlockDraft = {
  sucursal: string | null
  professionalId: string | null
  startDate: string
  endDate: string
  reason: string | null
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function mapBlock(row: any): AgendaBlock {
  const prof = Array.isArray(row.professional) ? row.professional[0] : row.professional
  return {
    id: row.id,
    sucursal: row.sucursal ?? null,
    professionalId: row.professional_id ?? null,
    professionalName: prof?.display_name?.trim() || null,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason ?? null,
  }
}

/** Current + upcoming blocks (end_date >= today), earliest first. */
export async function fetchAgendaBlocks(): Promise<{ data: AgendaBlock[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('agenda_blocks')
    .select(
      'id, sucursal, professional_id, start_date, end_date, reason, professional:professional_id (display_name)',
    )
    .gte('end_date', todayStr())
    .order('start_date', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data as any[]).map(mapBlock), error: null }
}

export async function createAgendaBlock(
  draft: AgendaBlockDraft,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const createdBy = await getCurrentUserId()
  const { error } = await getSupabase().from('agenda_blocks').insert({
    sucursal: draft.sucursal,
    professional_id: draft.professionalId,
    start_date: draft.startDate,
    end_date: draft.endDate,
    reason: draft.reason,
    ...(createdBy ? { created_by: createdBy } : {}),
  })
  return { error: error ? error.message : null }
}

export async function deleteAgendaBlock(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { error } = await getSupabase().from('agenda_blocks').delete().eq('id', id)
  return { error: error ? error.message : null }
}
