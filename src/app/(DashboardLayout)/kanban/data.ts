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
    sucursal:
      normalizeSucursal(metaReservationSucursal(row.metadata)) ??
      normalizeSucursal(row.metadata?.['sucursal']),
    treatmentLabel: metaTreatmentName(row.metadata) || treatmentLabel(row.treatments),
    lastActivityHoursAgo: hoursSince(row.last_message_at ?? row.created_at),
    // No tags/notes/photos columns yet — neutral defaults.
    tags: [],
    notesCount: 0,
    photosCount: 0,
    status: mapStatus(row.status),
    ...(metaQuote(row.metadata) && { quote: metaQuote(row.metadata)! }),
    ...(metaReservation(row.metadata) && {
      reservation: metaReservation(row.metadata)!,
    }),
  }))

  return { data: leads, error: null }
}

// ---------------------------------------------------------------------------
// leads.metadata snapshot readers (written by the bot — treatment / quote /
// reservation the patient reached; see the bot's lead-snapshot module). All
// defensive: any missing/malformed shape returns undefined so the card falls
// back to its "empty" state.
// ---------------------------------------------------------------------------

type Meta = Record<string, unknown> | null | undefined

function metaObj(meta: Meta, key: string): Record<string, unknown> | undefined {
  const v = (meta ?? {})[key]
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
}

function metaTreatmentName(meta: Meta): string {
  const t = metaObj(meta, 'treatment')
  return typeof t?.['name'] === 'string' ? (t['name'] as string).trim() : ''
}

function metaReservationSucursal(meta: Meta): unknown {
  return metaObj(meta, 'reservation')?.['sucursal']
}

function metaQuote(meta: Meta): Lead['quote'] | undefined {
  const q = metaObj(meta, 'quote')
  if (!q || typeof q['listAmount'] !== 'number') return undefined
  const currency = q['currency'] === 'USD' ? 'USD' : 'ARS'
  return {
    listAmount: q['listAmount'] as number,
    ...(typeof q['efectivoAmount'] === 'number' && {
      efectivoAmount: q['efectivoAmount'] as number,
    }),
    currency,
    sentAtHoursAgo: hoursSince(
      typeof q['sentAt'] === 'string' ? (q['sentAt'] as string) : null,
    ),
  }
}

function metaReservation(meta: Meta): Lead['reservation'] | undefined {
  const r = metaObj(meta, 'reservation')
  if (!r) return undefined
  return {
    slot: 'A coordinar',
    sucursal: normalizeSucursal(r['sucursal']),
    depositAmount: typeof r['senaAmount'] === 'number' ? (r['senaAmount'] as number) : 0,
    depositCurrency: 'ARS',
    comprobanteStatus: r['comprobante'] === 'received' ? 'received' : 'pending',
  }
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

// ---------------------------------------------------------------------------
// Per-user Kanban column colours (migration 0027 · user_preferences). Stored
// against the signed-in user (RLS: user_id = auth.uid()), so a chosen colour is
// private to that user and follows their account across devices. Best-effort:
// on any failure the board just falls back to the default column colours.
// ---------------------------------------------------------------------------

const COLUMN_COLORS_PREF_KEY = 'kanban_column_colors'

type ColumnColors = Partial<Record<LeadStatus, string>>

async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getUser()
  return data.user?.id ?? null
}

/** The signed-in user's saved column colours, or {} when none/unavailable. */
export async function fetchColumnColors(): Promise<ColumnColors> {
  if (!isSupabaseConfigured()) return {}
  const uid = await currentUserId()
  if (!uid) return {}
  const { data, error } = await getSupabase()
    .from('user_preferences')
    .select('value')
    .eq('user_id', uid)
    .eq('key', COLUMN_COLORS_PREF_KEY)
    .maybeSingle()
  if (error || !data) return {}
  return (data.value as ColumnColors) ?? {}
}

/** Upsert the signed-in user's column colours. Best-effort (no throw). */
export async function saveColumnColors(colors: ColumnColors): Promise<void> {
  if (!isSupabaseConfigured()) return
  const uid = await currentUserId()
  if (!uid) return
  await getSupabase()
    .from('user_preferences')
    .upsert(
      {
        user_id: uid,
        key: COLUMN_COLORS_PREF_KEY,
        value: colors,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    )
}
