// Agenda (Fase 2 · Etapa 2) — panel-managed clinic turnos, backed by the
// calendar_events table (migrations 0019 + 0020). RLS: any staff role reads +
// writes. Each event is a turno: patient / treatment / professional / sucursal /
// status (+ a "charged" flag). Colour is derived from the status.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

// The full 10-state turno machine (signed Etapa-2 scope). Colour follows the
// status: full event background = estado, per Andrés' agenda scheme.
export const TURNO_STATUSES = [
  'pre_reserva',
  'reservado',
  'sena_parcial',
  'pendiente',
  'confirmado',
  'reprogramado',
  'en_sala',
  'en_atencion',
  'atendido',
  'ausente',
  'cancelado',
] as const
export type TurnoStatus = (typeof TURNO_STATUSES)[number]

export const STATUS_COLORS: Record<TurnoStatus, string> = {
  pre_reserva: '#b0bec5', // grey — horario en espera del depósito (auto-reserva)
  reservado: '#7c4dff', // violet — pre-reserva / seña
  sena_parcial: '#ec4899', // pink — seña parcial (falta completar depósito)
  pendiente: '#ffae1f', // amber — a confirmar
  confirmado: '#13deb9', // teal — confirmado
  reprogramado: '#06b6d4', // cyan — reprogramado
  en_sala: '#a855f7', // purple — en sala de espera
  en_atencion: '#5d87ff', // blue — en atención
  atendido: '#22c55e', // green — atendido
  ausente: '#8a94a6', // grey — no-show
  cancelado: '#fa896b', // salmon — cancelado
}

// One place mapping each status to its i18n label key (reused by the agenda +
// both dashboards, so all 10 states are covered everywhere).
export const STATUS_LABEL_KEY: Record<TurnoStatus, TranslationKey> = {
  pre_reserva: 'agenda.status.preReserva',
  reservado: 'agenda.status.reserved',
  sena_parcial: 'agenda.status.partialDeposit',
  pendiente: 'agenda.status.pending',
  confirmado: 'agenda.status.confirmed',
  reprogramado: 'agenda.status.rescheduled',
  en_sala: 'agenda.status.inRoom',
  en_atencion: 'agenda.status.inSession',
  atendido: 'agenda.status.attended',
  ausente: 'agenda.status.absent',
  cancelado: 'agenda.status.cancelled',
}

export const SUCURSALES = ['caballito', 'merlo', 'moreno'] as const
export type Sucursal = (typeof SUCURSALES)[number]

// A pre-reserva ('reservado') is considered "vencida" once it has gone this long
// without being confirmed. v1 only HIGHLIGHTS these (no auto-cancel) — freeing
// the slot automatically is a deliberate follow-up once the clinic sets the
// policy. Measured from the turno's created_at.
export const PRE_RESERVA_TTL_HOURS = 48

// Shape react-big-calendar consumes directly (start/end are Date objects). The
// extra turno fields ride along for rendering + edit-form repopulation.
export type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  status: TurnoStatus
  charged: boolean
  patientId: string | null
  patientName: string | null
  professionalId: string | null
  sucursal: string | null
  treatmentSlug: string | null
  createdAt: Date
}

type Row = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
  status: string
  charged: boolean
  patient_id: string | null
  professional_id: string | null
  sucursal: string | null
  treatment_slug: string | null
  created_at: string
  patient: { full_name: string | null } | { full_name: string | null }[] | null
}

function normalizeStatus(s: string): TurnoStatus {
  return (TURNO_STATUSES as readonly string[]).includes(s) ? (s as TurnoStatus) : 'pendiente'
}

function embeddedName(rel: Row['patient']): string | null {
  const r = Array.isArray(rel) ? rel[0] : rel
  return r?.full_name?.trim() || null
}

function rowToEvent(r: Row): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
    allDay: r.all_day,
    status: normalizeStatus(r.status),
    charged: r.charged,
    patientId: r.patient_id,
    patientName: embeddedName(r.patient),
    professionalId: r.professional_id,
    sucursal: r.sucursal,
    treatmentSlug: r.treatment_slug,
    createdAt: new Date(r.created_at),
  }
}

// A 'reservado' turno past the TTL (measured from creation) = vencida.
export function isExpiredReserva(e: CalendarEvent, now: Date = new Date()): boolean {
  if (e.status !== 'reservado') return false
  return now.getTime() - e.createdAt.getTime() > PRE_RESERVA_TTL_HOURS * 3600_000
}

/**
 * Auto-cancel pre-reservas that sat in 'reservado' past the TTL (frees the
 * slot). One batch UPDATE, scoped by RLS (admin/operador → all; profesional →
 * their own). Returns how many were cancelled. Called lazily on agenda load.
 */
export async function autoCancelExpiredReservas(): Promise<{
  cancelled: number
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { cancelled: 0, error: null }
  const cutoff = new Date(Date.now() - PRE_RESERVA_TTL_HOURS * 3600_000).toISOString()
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .update({
      status: 'cancelado',
      color: STATUS_COLORS.cancelado,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'reservado')
    .lt('created_at', cutoff)
    .select('id')
  if (error) return { cancelled: 0, error: error.message }
  return { cancelled: (data as { id: string }[] | null)?.length ?? 0, error: null }
}

const SELECT =
  'id, title, starts_at, ends_at, all_day, status, charged, patient_id, professional_id, sucursal, treatment_slug, created_at, patient:patient_id (full_name)'

export async function fetchCalendarEvents(): Promise<{
  data: CalendarEvent[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select(SELECT)
    .order('starts_at', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data as Row[]).map(rowToEvent), error: null }
}

export type CalendarEventInput = {
  title: string
  start: Date
  end: Date
  allDay: boolean
  status: TurnoStatus
  charged: boolean
  patientId: string | null
  professionalId: string | null
  sucursal: string | null
  treatmentSlug: string | null
}

function toPayload(input: CalendarEventInput) {
  return {
    title: input.title,
    starts_at: input.start.toISOString(),
    ends_at: input.end.toISOString(),
    all_day: input.allDay,
    status: input.status,
    charged: input.charged,
    patient_id: input.patientId,
    professional_id: input.professionalId,
    sucursal: input.sucursal,
    treatment_slug: input.treatmentSlug,
    color: STATUS_COLORS[input.status],
  }
}

/** Insert a new turno. Returns the created event or an error string. */
export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<{ data: CalendarEvent | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: null, error: null }
  const { data: userData } = await getSupabase().auth.getUser()
  const createdBy = userData?.user?.id ?? null
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .insert({ ...toPayload(input), created_by: createdBy })
    .select(SELECT)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: rowToEvent(data as Row), error: null }
}

/** Update an existing turno. Returns an error string on failure. */
export async function updateCalendarEvent(
  id: string,
  input: CalendarEventInput,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('calendar_events')
    .update({ ...toPayload(input), updated_at: new Date().toISOString() })
    .eq('id', id)
  return error ? error.message : null
}

/** Delete a turno. Returns an error string on failure. */
export async function deleteCalendarEvent(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('calendar_events').delete().eq('id', id)
  return error ? error.message : null
}

// ── Lookups for the turno form ────────────────────────────────────────────────

/** The signed-in user's id (== app_users.id == a turno's professional_id). */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await getSupabase().auth.getUser()
  return data?.user?.id ?? null
}

export type PatientOption = { id: string; name: string }

/** Search patients by name (ilike). Empty query returns the first 20 by name. */
export async function searchPatients(query: string): Promise<PatientOption[]> {
  if (!isSupabaseConfigured()) return []
  const q = query.trim()
  let req = getSupabase()
    .from('patients')
    .select('id, full_name, whatsapp_phone')
    .order('full_name', { ascending: true })
    .limit(20)
  if (q) req = req.ilike('full_name', `%${q}%`)
  const { data, error } = await req
  if (error || !data) return []
  return (data as { id: string; full_name: string | null; whatsapp_phone: string | null }[]).map(
    (r) => ({ id: r.id, name: r.full_name?.trim() || r.whatsapp_phone || 'Sin nombre' }),
  )
}
