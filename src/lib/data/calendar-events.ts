// Agenda (Fase 2 · Etapa 2) — panel-managed clinic turnos, backed by the
// calendar_events table (migrations 0019 + 0020). RLS: any staff role reads +
// writes. Each event is a turno: patient / treatment / professional / sucursal /
// status (+ a "charged" flag). Colour is derived from the status.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

// One reprogramación: the turno's state BEFORE this move (the 1st entry = the
// turno original) + when/who/why. Stored as a jsonb array on the turno.
export type RescheduleEntry = {
  at: string // ISO timestamp of the reschedule
  by: string | null // actor id
  byName: string | null // actor display name
  fromStart: string // ISO start before the move
  fromEnd: string // ISO end before the move
  fromSucursal: string | null
  fromProfessionalId: string | null
  toStart: string // ISO start after the move
  reason: string | null // motivo, when the user provided one
}

// One treatment line of a turno (línea firmada 269-271: múltiples tratamientos por
// turno). `subtotal` starts at the suggested price (laser: zone calc; others: the
// treatment_prices list value) and stays editable; `discount` is the configurable
// per-line discount. Line total = subtotal − discount. The turno's grand total is
// the (editable) total_amount. The FIRST line's slug is the turno's PRIMARY
// treatment (== treatment_slug) that drives colour/availability/capability/láser.
export type TurnoTreatment = {
  slug: string
  subtotal: number | null
  discount: number | null
}

// The full turno-state machine. Superset of the 10 signed Etapa-2 states (the
// signed set: Consulta, Presupuestado, Pre-reservado, Pendiente de depósito,
// Pendiente de completar depósito, Confirmado, Reprogramado, Atendido, Cancelado,
// No asistió) plus extra operational granularity (confirmado_paciente, en_sala…).
// `sena_parcial` is the signed "Pendiente de completar depósito" (label carries
// the depósito terminology); `pendiente_deposito` is the signed "Pendiente de
// depósito" (a prior deposit from another treatment applies to a new turno).
// Colour follows the status: full event background = estado, per Andrés' scheme.
export const TURNO_STATUSES = [
  'consulta',
  'presupuestado',
  'pre_reserva',
  'reservado',
  'pendiente_deposito',
  'sena_parcial',
  'pendiente',
  'confirmado',
  'confirmado_paciente',
  'reprogramado',
  'reprogramacion_solicitada',
  'en_sala',
  'en_atencion',
  'atendido',
  'ausente',
  'cancelado',
] as const
export type TurnoStatus = (typeof TURNO_STATUSES)[number]

export const STATUS_COLORS: Record<TurnoStatus, string> = {
  consulta: '#38bdf8', // sky — consulta inicial (aún sin presupuesto)
  presupuestado: '#eab308', // gold — presupuestado, sin reservar
  pre_reserva: '#b0bec5', // grey — horario en espera del depósito (auto-reserva)
  reservado: '#7c4dff', // violet — pre-reserva / seña
  pendiente_deposito: '#f59e0b', // amber-fuerte — pendiente de depósito (previo de otro tratamiento)
  sena_parcial: '#ec4899', // pink — seña parcial (falta completar depósito)
  pendiente: '#ffae1f', // amber — a confirmar
  confirmado: '#13deb9', // teal — confirmado
  confirmado_paciente: '#16a34a', // green — confirmado por el paciente (recordatorio)
  reprogramado: '#06b6d4', // cyan — reprogramado
  reprogramacion_solicitada: '#f97316', // orange — pidió reprogramar (recepción gestiona)
  en_sala: '#a855f7', // purple — en sala de espera
  en_atencion: '#5d87ff', // blue — en atención
  atendido: '#22c55e', // green — atendido
  ausente: '#8a94a6', // grey — no-show
  cancelado: '#fa896b', // salmon — cancelado
}

// One place mapping each status to its i18n label key (reused by the agenda +
// both dashboards, so all 10 states are covered everywhere).
export const STATUS_LABEL_KEY: Record<TurnoStatus, TranslationKey> = {
  consulta: 'agenda.status.consulta',
  presupuestado: 'agenda.status.presupuestado',
  pre_reserva: 'agenda.status.preReserva',
  reservado: 'agenda.status.reserved',
  pendiente_deposito: 'agenda.status.pendingDeposit',
  sena_parcial: 'agenda.status.partialDeposit',
  pendiente: 'agenda.status.pending',
  confirmado: 'agenda.status.confirmed',
  confirmado_paciente: 'agenda.status.confirmedByPatient',
  reprogramado: 'agenda.status.rescheduled',
  reprogramacion_solicitada: 'agenda.status.rescheduleRequested',
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
  observaciones: string | null
  packId: string | null
  depositAmount: number | null
  depositDate: string | null
  depositReceived: boolean
  // Valor total del turno (migration 0057): sugerido automáticamente para láser a
  // partir de las zonas, pero editable a mano. NULL = sin total cargado.
  totalAmount: number | null
  // Reprogramación (migration 0059, línea firmada 284): motivo de la última
  // reprogramación + historial de reprogramaciones (la 1ª entrada conserva el turno
  // ORIGINAL: fecha/hora/sucursal/profesional previos). '' / [] cuando nunca se
  // reprogramó.
  rescheduleReason: string | null
  rescheduleHistory: RescheduleEntry[]
  // Tratamientos del turno (migration 0060, línea firmada 269-271). The 1st entry's
  // slug mirrors treatmentSlug (the primary). Empty for legacy turnos → the reader
  // synthesizes a single line from treatmentSlug so the UI is always consistent.
  treatments: TurnoTreatment[]
  // Depilación láser (migration 0055): the sex table used + the zonas selected by
  // click, so the internal duration engine can recompute and a reprogramación
  // keeps the zonas. Empty/null for non-láser turnos.
  laserSex: 'mujer' | 'varon' | null
  laserZones: string[]
  // Zona corporal para tratamientos NO láser (migration 0061, línea firmada 276):
  // dónde se trabaja, cuando corresponde. Independiente de laser_zones.
  bodyZones: string[]
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
  observaciones: string | null
  pack_id: string | null
  deposit_amount: number | string | null
  deposit_date: string | null
  deposit_received: boolean | null
  total_amount: number | string | null
  reschedule_reason: string | null
  reschedule_history: RescheduleEntry[] | null
  treatments: TurnoTreatment[] | null
  laser_sex: string | null
  laser_zones: string[] | null
  body_zones: string[] | null
  created_at: string
  patient: { full_name: string | null } | { full_name: string | null }[] | null
}

function normalizeStatus(s: string): TurnoStatus {
  // Keep the raw stored value so autogestionable/custom statuses (migration 0048)
  // round-trip; only empty falls back. Presentation resolves via the status config.
  return (s ? s : 'pendiente') as TurnoStatus
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
    observaciones: r.observaciones,
    packId: r.pack_id,
    depositAmount: r.deposit_amount == null ? null : Number(r.deposit_amount),
    depositDate: r.deposit_date,
    depositReceived: !!r.deposit_received,
    totalAmount: r.total_amount == null ? null : Number(r.total_amount),
    rescheduleReason: r.reschedule_reason,
    rescheduleHistory: Array.isArray(r.reschedule_history) ? r.reschedule_history : [],
    // Legacy turnos (no treatments[] yet) synthesize a single line from the primary
    // slug so every consumer sees a consistent list.
    treatments:
      Array.isArray(r.treatments) && r.treatments.length > 0
        ? r.treatments
        : r.treatment_slug
          ? [{ slug: r.treatment_slug, subtotal: null, discount: null }]
          : [],
    laserSex: r.laser_sex === 'mujer' || r.laser_sex === 'varon' ? r.laser_sex : null,
    laserZones: r.laser_zones ?? [],
    bodyZones: r.body_zones ?? [],
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
  'id, title, starts_at, ends_at, all_day, status, charged, patient_id, professional_id, sucursal, treatment_slug, observaciones, pack_id, deposit_amount, deposit_date, deposit_received, total_amount, reschedule_reason, reschedule_history, treatments, laser_sex, laser_zones, body_zones, created_at, patient:patient_id (full_name)'

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
  observaciones: string | null
  packId: string | null
  depositAmount: number | null
  depositDate: string | null
  depositReceived: boolean
  totalAmount: number | null
  laserSex: 'mujer' | 'varon' | null
  laserZones: string[]
  // Zona corporal (línea 276). OPTIONAL: a drag/move leaves it undefined so toPayload
  // preserves the column; the dialog sets it.
  bodyZones?: string[]
  // Reprogramación (línea firmada 284). OPTIONAL on purpose: a normal save leaves
  // them undefined so toPayload does NOT touch the columns (history is preserved);
  // only the reschedule flows set them.
  rescheduleReason?: string | null
  rescheduleHistory?: RescheduleEntry[]
  // Tratamientos del turno (línea firmada 269-271). OPTIONAL: a mover/drag that does
  // not touch treatments leaves it undefined so toPayload preserves the column.
  treatments?: TurnoTreatment[]
}

function toPayload(input: CalendarEventInput) {
  const payload: Record<string, unknown> = {
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
    observaciones: input.observaciones,
    pack_id: input.packId,
    deposit_amount: input.depositAmount,
    deposit_date: input.depositDate,
    deposit_received: input.depositReceived,
    total_amount: input.totalAmount,
    laser_sex: input.laserSex,
    laser_zones: input.laserZones,
    color: STATUS_COLORS[input.status] ?? '#8a94a6',
  }
  // Reprogramación: only touch these columns when the caller sets them (a reschedule
  // flow), so a normal edit-save never wipes the history (línea firmada 284).
  if (input.rescheduleReason !== undefined) payload.reschedule_reason = input.rescheduleReason
  if (input.rescheduleHistory !== undefined) payload.reschedule_history = input.rescheduleHistory
  // Tratamientos: only when provided (the dialog), so a drag/move preserves them.
  // Keep the primary treatment_slug in sync with the first line.
  if (input.treatments !== undefined) {
    payload.treatments = input.treatments
    if (input.treatments.length > 0) payload.treatment_slug = input.treatments[0]!.slug
  }
  // Zona corporal: only when provided (the dialog), so a drag/move preserves it.
  if (input.bodyZones !== undefined) payload.body_zones = input.bodyZones
  return payload
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

export type PatientOption = { id: string; name: string; dni: string | null }

/** Search patients by name (ilike). Empty query returns the first 20 by name. */
export async function searchPatients(query: string): Promise<PatientOption[]> {
  if (!isSupabaseConfigured()) return []
  const q = query.trim()
  let req = getSupabase()
    .from('patients')
    .select('id, full_name, whatsapp_phone, dni')
    .order('full_name', { ascending: true })
    .limit(20)
  if (q) {
    // Match the name, and (when the query has digits) the DNI too — Andrés
    // 2026-09-17: DNI is more reliable than a possibly-misspelled name.
    const digits = q.replace(/\D/g, '')
    const parts = [`full_name.ilike.%${q}%`]
    if (digits.length >= 3) parts.push(`dni.ilike.%${digits}%`)
    req = req.or(parts.join(','))
  }
  const { data, error } = await req
  if (error || !data) return []
  return (
    data as { id: string; full_name: string | null; whatsapp_phone: string | null; dni: string | null }[]
  ).map((r) => ({ id: r.id, name: r.full_name?.trim() || r.whatsapp_phone || 'Sin nombre', dni: r.dni }))
}

// Basic patient fields shown when a turno is opened from the agenda.
export type PatientBasics = {
  id: string
  fullName: string
  dni: string | null
  email: string | null
  phone: string | null
  birthdate: string | null
  sucursal: string | null
  status: string | null
}

export async function fetchPatientBasics(id: string): Promise<PatientBasics | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await getSupabase()
    .from('patients')
    .select('id, full_name, whatsapp_phone, email, dni, birthdate, sucursal, status')
    .eq('id', id)
    .single<{
      id: string
      full_name: string | null
      whatsapp_phone: string | null
      email: string | null
      dni: string | null
      birthdate: string | null
      sucursal: string | null
      status: string | null
    }>()
  if (!data) return null
  return {
    id: data.id,
    fullName: data.full_name?.trim() || data.whatsapp_phone || 'Sin nombre',
    dni: data.dni,
    email: data.email,
    phone: data.whatsapp_phone,
    birthdate: data.birthdate,
    sucursal: data.sucursal,
    status: data.status,
  }
}
