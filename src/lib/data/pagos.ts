// Payments / caja del día (Etapa 4, migration 0032 `pagos`). Reception records
// each cobro; the caja view aggregates them by day + method.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { getCurrentUserId } from '@/lib/data/calendar-events'

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago' | 'otro'
export const PAYMENT_METHODS: PaymentMethod[] = [
  'efectivo',
  'transferencia',
  'tarjeta',
  'mercadopago',
  'otro',
]

export type Pago = {
  id: string
  amount: number
  currency: string
  method: PaymentMethod
  sucursal: string | null
  patientId: string | null
  patientName: string | null
  professionalId: string | null
  professionalName: string | null
  treatmentSlug: string | null
  notes: string | null
  paidAt: string
}

export type PagoDraft = {
  amount: number
  method: PaymentMethod
  currency?: string
  sucursal?: string | null
  patientId?: string | null
  professionalId?: string | null
  treatmentSlug?: string | null
  notes?: string | null
  paidAt?: string
}

function embed<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)
}

function mapPago(row: any): Pago {
  return {
    id: row.id,
    amount: Number(row.amount) || 0,
    currency: row.currency ?? 'ARS',
    method: (PAYMENT_METHODS as string[]).includes(row.method) ? row.method : 'otro',
    sucursal: row.sucursal ?? null,
    patientId: row.patient_id ?? null,
    patientName: embed<{ full_name: string | null }>(row.patient)?.full_name?.trim() || null,
    professionalId: row.professional_id ?? null,
    professionalName:
      embed<{ display_name: string | null }>(row.professional)?.display_name?.trim() || null,
    treatmentSlug: row.treatment_slug ?? null,
    notes: row.notes ?? null,
    paidAt: row.paid_at,
  }
}

/** Payments in [fromIso, toIso], newest first, with patient + professional names. */
export async function fetchPagos(
  fromIso: string,
  toIso: string,
): Promise<{ data: Pago[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('pagos')
    .select(
      'id, amount, currency, method, sucursal, patient_id, professional_id, treatment_slug, notes, paid_at, patient:patient_id (full_name), professional:professional_id (display_name)',
    )
    .gte('paid_at', fromIso)
    .lte('paid_at', toIso)
    .order('paid_at', { ascending: false })
  if (error) return { data: [], error: error.message }
  return { data: (data as any[]).map(mapPago), error: null }
}

/** Record a payment (created_by = current user). */
export async function recordPago(draft: PagoDraft): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const uid = await getCurrentUserId()
  const { error } = await getSupabase().from('pagos').insert({
    amount: draft.amount,
    currency: draft.currency ?? 'ARS',
    method: draft.method,
    sucursal: draft.sucursal ?? null,
    patient_id: draft.patientId ?? null,
    professional_id: draft.professionalId ?? null,
    treatment_slug: draft.treatmentSlug ?? null,
    notes: draft.notes ?? null,
    ...(draft.paidAt && { paid_at: draft.paidAt }),
    created_by: uid,
  })
  return { error: error ? error.message : null }
}

export async function deletePago(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { error } = await getSupabase().from('pagos').delete().eq('id', id)
  return { error: error ? error.message : null }
}
