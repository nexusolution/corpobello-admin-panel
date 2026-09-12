// Treatment packs (Fase 2 · Etapa 2 — Andrés' 4x3 / 5x4). A pack ties a patient
// to a treatment with a fixed number of sessions; the counter is derived from
// the linked turnos (a session is "done" only when its turno reaches status
// 'atendido') plus an admin manual_adjustment. Backed by migration 0046.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// ── Pack configuration (which treatments are sold as a pack) ──────────────────

export type TreatmentPackConfig = {
  treatmentSlug: string
  totalSessions: number
  label: string
  active: boolean
}

type ConfigRow = {
  treatment_slug: string
  total_sessions: number
  label: string
  active: boolean
}

function rowToConfig(r: ConfigRow): TreatmentPackConfig {
  return {
    treatmentSlug: r.treatment_slug,
    totalSessions: r.total_sessions,
    label: r.label,
    active: r.active,
  }
}

export async function fetchPackConfigs(): Promise<{
  data: TreatmentPackConfig[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('treatment_pack_configs')
    .select('treatment_slug, total_sessions, label, active')
    .order('treatment_slug', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data as ConfigRow[]).map(rowToConfig), error: null }
}

export async function upsertPackConfig(cfg: TreatmentPackConfig): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('treatment_pack_configs')
    .upsert(
      {
        treatment_slug: cfg.treatmentSlug,
        total_sessions: cfg.totalSessions,
        label: cfg.label,
        active: cfg.active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'treatment_slug' },
    )
  return error ? error.message : null
}

export async function deletePackConfig(treatmentSlug: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('treatment_pack_configs')
    .delete()
    .eq('treatment_slug', treatmentSlug)
  return error ? error.message : null
}

// ── Patient packs ─────────────────────────────────────────────────────────────

export type PackStatus = 'active' | 'completed' | 'cancelled'

export type PatientPack = {
  id: string
  patientId: string
  treatmentSlug: string
  totalSessions: number
  label: string
  status: PackStatus
  manualAdjustment: number
  notes: string | null
  createdAt: string
}

type PackRow = {
  id: string
  patient_id: string
  treatment_slug: string
  total_sessions: number
  label: string
  status: string
  manual_adjustment: number
  notes: string | null
  created_at: string
}

function normalizeStatus(s: string): PackStatus {
  return s === 'completed' || s === 'cancelled' ? s : 'active'
}

function rowToPack(r: PackRow): PatientPack {
  return {
    id: r.id,
    patientId: r.patient_id,
    treatmentSlug: r.treatment_slug,
    totalSessions: r.total_sessions,
    label: r.label,
    status: normalizeStatus(r.status),
    manualAdjustment: r.manual_adjustment,
    notes: r.notes,
    createdAt: r.created_at,
  }
}

const PACK_SELECT =
  'id, patient_id, treatment_slug, total_sessions, label, status, manual_adjustment, notes, created_at'

export async function fetchPatientPacks(patientId: string): Promise<{
  data: PatientPack[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('patient_packs')
    .select(PACK_SELECT)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data as PackRow[]).map(rowToPack), error: null }
}

/** Active packs a patient has for a given treatment (for the turno linker). */
export async function fetchActivePacks(
  patientId: string,
  treatmentSlug: string,
): Promise<PatientPack[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await getSupabase()
    .from('patient_packs')
    .select(PACK_SELECT)
    .eq('patient_id', patientId)
    .eq('treatment_slug', treatmentSlug)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as PackRow[]).map(rowToPack)
}

export type CreatePackInput = {
  patientId: string
  treatmentSlug: string
  totalSessions: number
  label: string
  notes?: string | null
}

export async function createPatientPack(
  input: CreatePackInput,
): Promise<{ data: PatientPack | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: null, error: null }
  const { data, error } = await getSupabase()
    .from('patient_packs')
    .insert({
      patient_id: input.patientId,
      treatment_slug: input.treatmentSlug,
      total_sessions: input.totalSessions,
      label: input.label,
      notes: input.notes ?? null,
    })
    .select(PACK_SELECT)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: rowToPack(data as PackRow), error: null }
}

export type UpdatePackPatch = {
  totalSessions?: number
  label?: string
  status?: PackStatus
  manualAdjustment?: number
  notes?: string | null
}

export async function updatePatientPack(
  id: string,
  patch: UpdatePackPatch,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.totalSessions != null) payload.total_sessions = patch.totalSessions
  if (patch.label != null) payload.label = patch.label
  if (patch.status != null) payload.status = patch.status
  if (patch.manualAdjustment != null) payload.manual_adjustment = patch.manualAdjustment
  if (patch.notes !== undefined) payload.notes = patch.notes
  const { error } = await getSupabase().from('patient_packs').update(payload).eq('id', id)
  return error ? error.message : null
}

export async function deletePatientPack(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('patient_packs').delete().eq('id', id)
  return error ? error.message : null
}

/** id -> {total,label} for every pack, to render "Sesión N/M" on turno cards. */
export async function fetchPackTotals(): Promise<Map<string, { total: number; label: string }>> {
  const out = new Map<string, { total: number; label: string }>()
  if (!isSupabaseConfigured()) return out
  const { data, error } = await getSupabase()
    .from('patient_packs')
    .select('id, total_sessions, label')
  if (error || !data) return out
  for (const r of data as { id: string; total_sessions: number; label: string }[]) {
    out.set(r.id, { total: r.total_sessions, label: r.label })
  }
  return out
}

// ── Pack turnos (history + counter) ───────────────────────────────────────────

export type PackTurno = {
  id: string
  startsAt: string
  status: string
  sucursal: string | null
  title: string
}

/** All turnos linked to a pack, oldest first (drives history + session index). */
export async function fetchPackTurnos(packId: string): Promise<PackTurno[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await getSupabase()
    .from('calendar_events')
    .select('id, starts_at, status, sucursal, title')
    .eq('pack_id', packId)
    .order('starts_at', { ascending: true })
  if (error || !data) return []
  return (data as { id: string; starts_at: string; status: string; sucursal: string | null; title: string }[]).map(
    (r) => ({ id: r.id, startsAt: r.starts_at, status: r.status, sucursal: r.sucursal, title: r.title }),
  )
}

// ── Progress helpers (pure) ───────────────────────────────────────────────────

/** A turno consumes a pack session only when it has been attended. */
export function turnoConsumesSession(status: string): boolean {
  return status === 'atendido'
}

export type PackProgress = {
  done: number
  remaining: number
  /** 1-based number of the next session, or null when the pack is complete. */
  next: number | null
  isComplete: boolean
}

/**
 * done = attended turnos + manual adjustment, clamped to [0, total].
 * `attendedCount` is the number of linked turnos already marked 'atendido'.
 */
export function packProgress(
  totalSessions: number,
  attendedCount: number,
  manualAdjustment: number,
): PackProgress {
  const raw = attendedCount + manualAdjustment
  const done = Math.max(0, Math.min(totalSessions, raw))
  const remaining = Math.max(0, totalSessions - done)
  return {
    done,
    remaining,
    next: remaining > 0 ? done + 1 : null,
    isComplete: remaining === 0,
  }
}
