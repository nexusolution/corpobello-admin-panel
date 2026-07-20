// Live Supabase read/write for the Kanban board. Maps `leads` rows into the
// panel's Lead view model, and persists drag-and-drop status changes back to
// `leads.status` (RLS: any authenticated operator/admin/profesional).
//
// The bot writes leads.status as: nuevo → en_conversacion → cotizado →
// reservado, plus 'sin_respuesta' (stale sweep) and the legacy default 'new'.
// The board's other columns (comprobante, confirmado, pausado, archivado,
// cancelado) are operator-driven and only get populated by dragging cards.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { hoursSince, normalizeSucursal, phoneLast4 } from '@/lib/data/helpers'
import type { Lead, LeadStatus } from './mock-data'

type LeadRow = {
  id: string
  whatsapp_phone: string | null
  display_name: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  last_message_at: string | null
  treatments: { display_name: string | null } | { display_name: string | null }[] | null
}

const KNOWN_STATUSES: readonly LeadStatus[] = [
  'nuevo',
  'en_conversacion',
  'cotizado',
  'reservado',
  'comprobante',
  'confirmado',
  'sin_respuesta',
  'pausado',
  'archivado',
  'cancelado',
]

// Fold the raw status into a board column. The legacy default 'new' and any
// unrecognised value land in 'nuevo' so no lead silently disappears.
function mapStatus(raw: string | null): LeadStatus {
  const v = (raw ?? '').toLowerCase()
  if (v === 'new') return 'nuevo'
  if (v === 'comprobante_recibido') return 'comprobante'
  return (KNOWN_STATUSES as readonly string[]).includes(v)
    ? (v as LeadStatus)
    : 'nuevo'
}

function treatmentLabel(rel: LeadRow['treatments']): string {
  const row = Array.isArray(rel) ? rel[0] : rel
  return row?.display_name?.trim() || 'Sin tratamiento'
}

export type LeadsResult = {
  data: Lead[]
  error: string | null
}

export async function fetchLeads(): Promise<LeadsResult> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const { data, error } = await getSupabase()
    .from('leads')
    .select(
      'id, whatsapp_phone, display_name, status, metadata, created_at, last_message_at, treatments:current_treatment_id (display_name)',
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) return { data: [], error: error.message }

  const leads: Lead[] = (data as LeadRow[]).map((row) => ({
    id: row.id,
    patientName: row.display_name?.trim() || row.whatsapp_phone || 'Sin nombre',
    phoneLast4: phoneLast4(row.whatsapp_phone),
    phoneFull: row.whatsapp_phone ?? '',
    sucursal: normalizeSucursal(row.metadata?.['sucursal']),
    treatmentLabel: treatmentLabel(row.treatments),
    lastActivityHoursAgo: hoursSince(row.last_message_at ?? row.created_at),
    // No tags/notes/photos columns yet — neutral defaults.
    tags: [],
    notesCount: 0,
    photosCount: 0,
    status: mapStatus(row.status),
  }))

  return { data: leads, error: null }
}

/** Persist a drag-and-drop move. Best-effort; returns an error string on fail. */
export async function persistLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('leads')
    .update({ status })
    .eq('id', id)
  return error ? error.message : null
}
