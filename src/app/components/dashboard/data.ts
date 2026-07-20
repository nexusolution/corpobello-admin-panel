// Live counts for the dashboard funnel (TopCards). Everything here derives from
// the bot's real output: `leads.status` (the funnel stages it advances) and the
// number of promoted `patients`. Panels that need data models we don't have yet
// (agenda turnos, deposits ledger, consents, stock) stay on their mock copy.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// Funnel-card key → the raw leads.status values that feed it. The bot writes
// nuevo/en_conversacion/cotizado/reservado/sin_respuesta (+ legacy 'new');
// comprobante/confirmado are operator-set on the Kanban. 'attended' has no lead
// status — it's the count of promoted patients (people who reserved).
const STATUS_BUCKETS: Record<string, readonly string[]> = {
  new: ['nuevo', 'new'],
  awaitingPhoto: ['en_conversacion'],
  quoteSent: ['cotizado'],
  awaitingDeposit: ['reservado'],
  preReservation: ['comprobante', 'comprobante_recibido'],
  confirmed: ['confirmado'],
  followUp: ['sin_respuesta'],
}

export type FunnelCounts = Record<string, number>

export type FunnelResult = {
  counts: FunnelCounts
  error: string | null
}

export async function fetchFunnelCounts(): Promise<FunnelResult> {
  const zero: FunnelCounts = {
    new: 0,
    awaitingPhoto: 0,
    quoteSent: 0,
    awaitingDeposit: 0,
    preReservation: 0,
    confirmed: 0,
    attended: 0,
    followUp: 0,
  }
  if (!isSupabaseConfigured()) return { counts: zero, error: null }

  const supabase = getSupabase()

  const [leadsRes, patientsRes] = await Promise.all([
    supabase.from('leads').select('status'),
    supabase.from('patients').select('id', { count: 'exact', head: true }),
  ])

  if (leadsRes.error) return { counts: zero, error: leadsRes.error.message }

  const counts: FunnelCounts = { ...zero }
  for (const row of (leadsRes.data as { status: string | null }[]) ?? []) {
    const status = (row.status ?? '').toLowerCase()
    for (const [key, values] of Object.entries(STATUS_BUCKETS)) {
      if (values.includes(status)) {
        counts[key] += 1
        break
      }
    }
  }
  // 'attended' = promoted patients (head count, not affected by leadsRes error).
  counts.attended = patientsRes.count ?? 0

  return { counts, error: null }
}
