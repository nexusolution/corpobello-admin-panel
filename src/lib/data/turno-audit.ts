// Turno audit trail (Fase 2 · Etapa 2 — Andrés' "quién y cuándo"). Records every
// agenda change with the acting user + timestamp; the patient ficha reads it to
// show turno activity/history. Backed by migration 0047.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TurnoAuditAction =
  | 'created'
  | 'updated'
  | 'rescheduled'
  | 'status_changed'
  | 'deleted'
  | 'forced_closed'

export type TurnoAuditEntry = {
  id: string
  action: string
  detail: string | null
  changedByName: string | null
  createdAt: string
}

export type LogTurnoAuditInput = {
  calendarEventId: string | null
  patientId: string | null
  action: TurnoAuditAction
  detail?: string | null
  /** Actor id + name (snapshot). Passed from the signed-in user in the UI. */
  changedBy?: string | null
  changedByName?: string | null
}

/** Best-effort insert; never throws (an audit failure must not block the turno). */
export async function logTurnoAudit(input: LogTurnoAuditInput): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    let changedBy = input.changedBy ?? null
    if (!changedBy) {
      const { data } = await getSupabase().auth.getUser()
      changedBy = data?.user?.id ?? null
    }
    await getSupabase().from('turno_audit').insert({
      calendar_event_id: input.calendarEventId,
      patient_id: input.patientId,
      action: input.action,
      detail: input.detail ?? null,
      changed_by: changedBy,
      changed_by_name: input.changedByName ?? null,
    })
  } catch {
    // swallow — auditing is best-effort
  }
}

/** Chronological audit for a patient (newest first). */
export async function fetchPatientTurnoAudit(
  patientId: string,
): Promise<{ data: TurnoAuditEntry[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('turno_audit')
    .select('id, action, detail, changed_by_name, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return { data: [], error: error.message }
  return {
    data: (data as {
      id: string
      action: string
      detail: string | null
      changed_by_name: string | null
      created_at: string
    }[]).map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      changedByName: r.changed_by_name,
      createdAt: r.created_at,
    })),
    error: null,
  }
}
