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
