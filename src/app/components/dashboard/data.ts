// Live counts for the dashboard funnel (TopCards). Everything here derives from
// the bot's real output: `leads.status` (the funnel stages it advances) and the
// number of promoted `patients`. Panels that need data models we don't have yet
// (agenda turnos, deposits ledger, consents, stock) stay on their mock copy.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { fetchCalendarEvents } from '@/lib/data/calendar-events'
import { fetchPagos } from '@/lib/data/pagos'

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

// ---------- Today's summary (greeting header + WelcomeBanner cards) ----------
// Real figures for today, replacing the old hardcoded dashboard samples
// (Andrés 2026-10-02). Derived from today's calendar_events + today's pagos.

export type TodaySummary = {
  scheduled: number // non-cancelled turnos today
  attended: number
  cancellations: number
  pending: number
  confirmed: number
  dailyIncomeCash: number // sum of today's efectivo pagos
  pendingCharges: number // today's non-cancelled turnos total not yet charged
  professionalsCount: number // distinct professionals with a turno today
  sucursales: string[] // distinct sucursal slugs with a turno today
  perTreatment: Record<string, number> // slug -> count (non-cancelled), for the workload card
  myScheduled: number // turnos today for the given professional (profesional view)
  mySucursal: string | null // that professional's sucursal today
}

const EMPTY_TODAY: TodaySummary = {
  scheduled: 0,
  attended: 0,
  cancellations: 0,
  pending: 0,
  confirmed: 0,
  dailyIncomeCash: 0,
  pendingCharges: 0,
  professionalsCount: 0,
  sucursales: [],
  perTreatment: {},
  myScheduled: 0,
  mySucursal: null,
}

export async function fetchTodaySummary(
  professionalId?: string | null,
): Promise<TodaySummary> {
  if (!isSupabaseConfigured()) return EMPTY_TODAY
  const now = new Date()
  const startIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
  const endIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
  const todayStart = new Date(startIso)
  const todayEnd = new Date(endIso)

  const [eventsRes, pagosRes] = await Promise.all([
    fetchCalendarEvents(),
    fetchPagos(startIso, endIso),
  ])

  const todays = (eventsRes.data ?? []).filter((e) => e.start <= todayEnd && e.end >= todayStart)
  const active = todays.filter((e) => e.status !== 'cancelado')

  const perTreatment: Record<string, number> = {}
  const pros = new Set<string>()
  const sucs = new Set<string>()
  for (const e of active) {
    if (e.treatmentSlug) perTreatment[e.treatmentSlug] = (perTreatment[e.treatmentSlug] ?? 0) + 1
    if (e.professionalId) pros.add(e.professionalId)
    if (e.sucursal) sucs.add(e.sucursal)
  }

  const dailyIncomeCash = (pagosRes.data ?? [])
    .filter((p) => p.method === 'efectivo')
    .reduce((sum, p) => sum + p.amount, 0)
  const pendingCharges = active
    .filter((e) => !e.charged)
    .reduce((sum, e) => sum + (e.totalAmount ?? 0), 0)

  const mine = professionalId ? active.filter((e) => e.professionalId === professionalId) : []

  return {
    scheduled: active.length,
    attended: todays.filter((e) => e.status === 'atendido').length,
    cancellations: todays.filter((e) => e.status === 'cancelado').length,
    pending: todays.filter((e) => e.status === 'pendiente').length,
    confirmed: todays.filter((e) => e.status === 'confirmado').length,
    dailyIncomeCash,
    pendingCharges,
    professionalsCount: pros.size,
    sucursales: [...sucs],
    perTreatment,
    myScheduled: mine.length,
    mySucursal: mine.find((e) => e.sucursal)?.sucursal ?? null,
  }
}
