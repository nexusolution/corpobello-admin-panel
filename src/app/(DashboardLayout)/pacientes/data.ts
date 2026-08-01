// Live Supabase read for the Pacientes table. Maps `patients` rows (Module A,
// migration 0004) into the panel's Patient view model. Read-only for now —
// create/edit/delete are still local-only in the table UI.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import {
  daysSince,
  normalizeSucursal,
  phoneLast4,
} from '@/lib/data/helpers'
import type { Patient, PatientStatus } from './mock-data'

type PatientRow = {
  id: string
  full_name: string | null
  whatsapp_phone: string | null
  sucursal: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  treatments: { display_name: string | null } | { display_name: string | null }[] | null
}

// The DB patient status is free text (bot/promote-trigger writes 'reservado',
// the default is 'nuevo', operators may set others). Fold it into the four
// buckets the table filters on; anything unrecognised counts as active.
function mapStatus(raw: string | null): PatientStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'en_tratamiento':
    case 'reservado':
      return 'en_tratamiento'
    case 'sin_contacto':
    case 'sin_respuesta':
      return 'sin_contacto'
    case 'archivado':
    case 'cancelado':
      return 'archivado'
    default:
      return 'activo'
  }
}

// PostgREST returns an embedded to-one relation as an object, but typings often
// widen it to an array — accept both shapes.
function treatmentLabel(rel: PatientRow['treatments']): string {
  const row = Array.isArray(rel) ? rel[0] : rel
  return row?.display_name?.trim() || '—'
}

export type PatientsResult = {
  data: Patient[]
  error: string | null
}

export async function fetchPatients(): Promise<PatientsResult> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const { data, error } = await getSupabase()
    .from('patients')
    .select(
      'id, full_name, whatsapp_phone, sucursal, status, created_at, updated_at, treatments:current_treatment_id (display_name)',
    )
    .order('updated_at', { ascending: false })

  if (error) return { data: [], error: error.message }

  const patients: Patient[] = (data as PatientRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name?.trim() || row.whatsapp_phone || 'Sin nombre',
    phoneLast4: phoneLast4(row.whatsapp_phone),
    phoneFull: row.whatsapp_phone ?? '',
    sucursal: normalizeSucursal(row.sucursal),
    mainTreatmentLabel: treatmentLabel(row.treatments),
    status: mapStatus(row.status),
    createdAtDays: daysSince(row.created_at) ?? 0,
    // No visit history in the schema yet — "never" until a visits table lands.
    lastVisitDays: null,
  }))

  return { data: patients, error: null }
}

/** Create a patient manually from the panel. RLS allows operators to insert. */
export async function createPatient(fields: {
  fullName: string
  phone: string
  email: string
  dni?: string
  sucursal: string | null
}): Promise<{ patient: Patient | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { patient: null, error: 'not-configured' }
  const { data, error } = await getSupabase()
    .from('patients')
    .insert({
      full_name: fields.fullName,
      whatsapp_phone: fields.phone.trim() || null,
      email: fields.email.trim() || null,
      dni: fields.dni?.trim() || null,
      sucursal: fields.sucursal,
      status: 'nuevo',
    })
    .select('id, full_name, whatsapp_phone, sucursal, status, created_at')
    .single()
  if (error || !data) return { patient: null, error: error?.message ?? 'insert-failed' }
  const row = data as PatientRow
  return {
    patient: {
      id: row.id,
      fullName: row.full_name?.trim() || row.whatsapp_phone || 'Sin nombre',
      phoneLast4: phoneLast4(row.whatsapp_phone),
      phoneFull: row.whatsapp_phone ?? '',
      sucursal: normalizeSucursal(row.sucursal),
      mainTreatmentLabel: '—',
      status: mapStatus(row.status),
      createdAtDays: daysSince(row.created_at) ?? 0,
      lastVisitDays: null,
    },
    error: null,
  }
}

// ============================================================================
// Patient 360° detail (A1) — pulls the linked lead → conversations → messages
// and quotes, plus internal notes. Reservations are derived from the lead's
// funnel status (there's no bookings table until the agenda stage).
// ============================================================================

export type PatientMessage = {
  id: string
  direction: 'in' | 'out'
  text: string
  createdAt: string
}

export type PatientQuote = {
  id: string
  treatment: string
  amount: number
  currency: string
  createdAt: string
}

export type PatientNote = {
  id: string
  body: string
  author: string
  createdAt: string
}

export type PatientReservation = {
  id: string
  status: string
  createdAt: string
  lastActivity: string | null
}

export type PatientContact = {
  id: string
  fullName: string
  email: string
  dni: string
  phone: string
  sucursal: string | null
  status: PatientStatus
  treatment: string
  createdAt: string
}

export type PatientDetail = {
  contact: PatientContact
  messages: PatientMessage[]
  quotes: PatientQuote[]
  notes: PatientNote[]
  reservations: PatientReservation[]
}

function embedded<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

// Turn a messages.content jsonb blob into display text. Outbound rows store the
// router effect object ({type:'send_text', body}); inbound rows store the raw
// Meta message ({type:'text', text:{body}} or an interactive reply).
function messageText(direction: 'in' | 'out', content: unknown): string {
  const c = (content ?? {}) as Record<string, any>
  if (direction === 'out') {
    if (typeof c.body === 'string') return c.body
    const map: Record<string, string> = {
      send_image: '📷 [imagen]',
      send_buttons: '[botones]',
      send_list: '[lista de opciones]',
      send_more_photos: '📷 [pedido de más fotos]',
    }
    return map[c.type as string] ?? '[mensaje]'
  }
  if (typeof c?.text?.body === 'string') return c.text.body
  const ir = c?.interactive
  if (ir?.button_reply?.title) return ir.button_reply.title
  if (ir?.list_reply?.title) return ir.list_reply.title
  const map: Record<string, string> = {
    image: '📷 [imagen recibida]',
    audio: '🎤 [audio]',
    video: '🎥 [video]',
    document: '📄 [documento]',
  }
  return map[c?.type as string] ?? '[mensaje recibido]'
}

export async function fetchPatientDetail(
  id: string,
): Promise<{ data: PatientDetail | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: null, error: null }
  const supabase = getSupabase()

  // Patient row + internal notes only need the id — fetch in parallel.
  const [patientRes, notesRes] = await Promise.all([
    supabase
      .from('patients')
      .select(
        'id, full_name, whatsapp_phone, email, dni, sucursal, status, created_at, treatments:current_treatment_id (display_name)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('patient_notes')
      .select('id, body, created_at, author:author_id (display_name)')
      .eq('patient_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (patientRes.error) return { data: null, error: patientRes.error.message }
  const p = patientRes.data as any
  if (!p) return { data: null, error: null }

  // Linked leads → conversations → messages + quotes.
  const leadsRes = await supabase
    .from('leads')
    .select('id, status, created_at, last_message_at')
    .eq('patient_id', id)
  const leads = (leadsRes.data as any[]) ?? []
  const leadIds = leads.map((l) => l.id)

  let messages: PatientMessage[] = []
  let quotes: PatientQuote[] = []
  if (leadIds.length > 0) {
    const convRes = await supabase
      .from('conversations')
      .select('id')
      .in('lead_id', leadIds)
    const convIds = ((convRes.data as any[]) ?? []).map((c) => c.id)
    if (convIds.length > 0) {
      const [msgRes, quoteRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id, direction, content, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('quotes')
          .select('id, total_amount, currency, created_at, treatments:treatment_id (display_name)')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false }),
      ])
      messages = ((msgRes.data as any[]) ?? []).map((m) => ({
        id: m.id,
        direction: m.direction,
        text: messageText(m.direction, m.content),
        createdAt: m.created_at,
      }))
      quotes = ((quoteRes.data as any[]) ?? []).map((q) => ({
        id: q.id,
        treatment: embedded<{ display_name: string | null }>(q.treatments)?.display_name?.trim() || '—',
        amount: Number(q.total_amount) || 0,
        currency: q.currency ?? 'ARS',
        createdAt: q.created_at,
      }))
    }
  }

  const notes: PatientNote[] = ((notesRes.data as any[]) ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    author: embedded<{ display_name: string | null }>(n.author)?.display_name?.trim() || 'Equipo',
    createdAt: n.created_at,
  }))

  const reservations: PatientReservation[] = leads.map((l) => ({
    id: l.id,
    status: l.status ?? 'nuevo',
    createdAt: l.created_at,
    lastActivity: l.last_message_at,
  }))

  const contact: PatientContact = {
    id: p.id,
    fullName: p.full_name?.trim() || p.whatsapp_phone || 'Sin nombre',
    email: p.email ?? '',
    dni: p.dni ?? '',
    phone: p.whatsapp_phone ?? '',
    sucursal: normalizeSucursal(p.sucursal),
    status: mapStatus(p.status),
    treatment: treatmentLabel(p.treatments),
    createdAt: p.created_at ?? '',
  }

  return { data: { contact, messages, quotes, notes, reservations }, error: null }
}

/** Append an internal note (author enforced to the signed-in user by RLS). */
export async function addPatientNote(
  patientId: string,
  body: string,
): Promise<{ note: PatientNote | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { note: null, error: 'not-configured' }
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { note: null, error: 'no-session' }

  const { data, error } = await supabase
    .from('patient_notes')
    .insert({ patient_id: patientId, author_id: user.id, body })
    .select('id, body, created_at, author:author_id (display_name)')
    .single()

  if (error || !data) return { note: null, error: error?.message ?? 'insert-failed' }
  const row = data as any
  return {
    note: {
      id: row.id,
      body: row.body,
      author: embedded<{ display_name: string | null }>(row.author)?.display_name?.trim() || 'Equipo',
      createdAt: row.created_at,
    },
    error: null,
  }
}

/**
 * Update the list-level fields of a patient (name, phone, sucursal). Full
 * contact editing (incl. email) lives on the detail page via
 * updatePatientContact. Returns an error string on failure.
 */
export async function updatePatient(
  id: string,
  fields: { fullName: string; phone: string; sucursal: string | null },
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('patients')
    .update({
      full_name: fields.fullName,
      whatsapp_phone: fields.phone.trim() || null,
      sucursal: fields.sucursal,
    })
    .eq('id', id)
  return error ? error.message : null
}

/**
 * Delete a patient. Admin-only (RLS policy patients_delete). We `.select()` the
 * deleted row so we can tell a real deletion (1 row) from an RLS no-op (0 rows,
 * which PostgREST reports as success) — e.g. a non-admin trying to delete. A
 * lingering lead no longer blocks this once migration 0015 is applied (the FK
 * is ON DELETE SET NULL). Returns null on success, else an error string.
 */
export async function deletePatient(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await getSupabase()
    .from('patients')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) return error.message
  if (!data || data.length === 0) return 'not-deleted'
  return null
}

/** Persist editable contact fields (name + email + DNI) on the patient row. */
export async function updatePatientContact(
  id: string,
  fields: { fullName: string; email: string; dni?: string },
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('patients')
    .update({
      full_name: fields.fullName,
      email: fields.email || null,
      ...(fields.dni !== undefined && { dni: fields.dni.trim() || null }),
    })
    .eq('id', id)
  return error ? error.message : null
}
