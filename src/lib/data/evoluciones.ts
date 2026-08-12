// Live Supabase read/write for clinical evolution records (Etapa 3, migration
// 0028 `evoluciones`). One row per attended session. RLS scopes a profesional to
// their own rows at the DB level; these helpers add no client-side scoping.
//
// Session photos + the signed PDF land in later steps; this module covers the
// core record (create as draft, edit, close with signature).

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type EvolucionStatus = 'borrador' | 'cerrada'

export type Evolucion = {
  id: string
  patientId: string
  patientName: string | null
  professionalId: string | null
  professionalName: string | null
  calendarEventId: string | null
  treatmentSlug: string | null
  sessionDate: string // ISO
  notes: string | null
  status: EvolucionStatus
  signedAt: string | null
  pdfPath: string | null
  nextFollowup: string | null // 'YYYY-MM-DD'
  createdAt: string
}

export type EvolucionDraft = {
  patientId: string
  professionalId?: string | null
  calendarEventId?: string | null
  treatmentSlug?: string | null
  sessionDate?: string
  notes?: string | null
  nextFollowup?: string | null
}

const SELECT =
  'id, patient_id, professional_id, calendar_event_id, treatment_slug, session_date, ' +
  'notes, status, signed_at, pdf_path, next_followup, created_at, ' +
  'patient:patient_id (full_name), professional:professional_id (display_name)'

function embedded<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)
}

function mapRow(row: any): Evolucion {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName:
      embedded<{ full_name: string | null }>(row.patient)?.full_name?.trim() || null,
    professionalId: row.professional_id ?? null,
    professionalName:
      embedded<{ display_name: string | null }>(row.professional)?.display_name?.trim() ||
      null,
    calendarEventId: row.calendar_event_id ?? null,
    treatmentSlug: row.treatment_slug ?? null,
    sessionDate: row.session_date,
    notes: row.notes ?? null,
    status: row.status === 'cerrada' ? 'cerrada' : 'borrador',
    signedAt: row.signed_at ?? null,
    pdfPath: row.pdf_path ?? null,
    nextFollowup: row.next_followup ?? null,
    createdAt: row.created_at,
  }
}

type Result<T> = { data: T; error: string | null }

/** A patient's clinical history, newest session first (for the ficha tab). */
export async function fetchPatientEvoluciones(
  patientId: string,
): Promise<Result<Evolucion[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('evoluciones')
    .select(SELECT)
    .eq('patient_id', patientId)
    .order('session_date', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data as any[]).map(mapRow), error: null }
}

/** Worklist for /fichas. RLS returns only the profesional's own rows; admin/
 *  operador get all. Newest first. */
export async function fetchEvoluciones(): Promise<Result<Evolucion[]>> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('evoluciones')
    .select(SELECT)
    .order('session_date', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data as any[]).map(mapRow), error: null }
}

/** Create a draft evolution. Returns the new id (or null on failure). */
export async function createEvolucion(
  draft: EvolucionDraft,
): Promise<{ id: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { id: null, error: null }
  const { data, error } = await getSupabase()
    .from('evoluciones')
    .insert({
      patient_id: draft.patientId,
      professional_id: draft.professionalId ?? null,
      calendar_event_id: draft.calendarEventId ?? null,
      treatment_slug: draft.treatmentSlug ?? null,
      ...(draft.sessionDate && { session_date: draft.sessionDate }),
      notes: draft.notes ?? null,
      next_followup: draft.nextFollowup ?? null,
      status: 'borrador',
    })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  return { id: (data as { id: string }).id, error: null }
}

/** Edit a draft evolution's clinical fields. */
export async function updateEvolucion(
  id: string,
  patch: Partial<EvolucionDraft>,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.notes !== undefined) body.notes = patch.notes
  if (patch.treatmentSlug !== undefined) body.treatment_slug = patch.treatmentSlug
  if (patch.professionalId !== undefined) body.professional_id = patch.professionalId
  if (patch.calendarEventId !== undefined) body.calendar_event_id = patch.calendarEventId
  if (patch.sessionDate !== undefined) body.session_date = patch.sessionDate
  if (patch.nextFollowup !== undefined) body.next_followup = patch.nextFollowup
  const { error } = await getSupabase().from('evoluciones').update(body).eq('id', id)
  return { error: error ? error.message : null }
}

/** Sign + close a session: status 'cerrada' + signature by the current user.
 *  The PDF comprobante is generated in a later step. */
export async function closeEvolucion(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { data: userData } = await getSupabase().auth.getUser()
  const uid = userData.user?.id ?? null
  const { error } = await getSupabase()
    .from('evoluciones')
    .update({
      status: 'cerrada',
      signed_at: new Date().toISOString(),
      signed_by: uid,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return { error: error ? error.message : null }
}
