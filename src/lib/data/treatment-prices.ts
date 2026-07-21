// Auto-gestión — edit per-treatment flat prices, backed by the treatment_prices
// table (migration 0008). The bot applies these to the menu's photoEvalAutoQuote
// before quoting (fail-open). RLS: operators read, admins write.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TreatmentPrice = {
  slug: string
  displayName: string
  listAmount: number
  efectivoAmount: number
  currency: string
}

type Row = {
  slug: string
  display_name: string
  list_amount: string | number
  efectivo_amount: string | number
  currency: string
}

export async function fetchTreatmentPrices(): Promise<{
  data: TreatmentPrice[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('treatment_prices')
    .select('slug, display_name, list_amount, efectivo_amount, currency')
    .order('display_name', { ascending: true })
  if (error) return { data: [], error: error.message }
  const rows = (data as Row[]).map((r) => ({
    slug: r.slug,
    displayName: r.display_name,
    listAmount: Number(r.list_amount),
    efectivoAmount: Number(r.efectivo_amount),
    currency: r.currency,
  }))
  return { data: rows, error: null }
}

/** Persist a price edit. Returns an error string on failure. */
export async function updateTreatmentPrice(
  slug: string,
  listAmount: number,
  efectivoAmount: number,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('treatment_prices')
    .update({
      list_amount: listAmount,
      efectivo_amount: efectivoAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug)
  return error ? error.message : null
}

/** Batch-persist several price edits at once (mass update). Uses upsert on slug
 *  so a single round-trip writes them all. */
export async function bulkUpdateTreatmentPrices(
  rows: TreatmentPrice[],
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  if (rows.length === 0) return null
  const now = new Date().toISOString()
  const payload = rows.map((r) => ({
    slug: r.slug,
    display_name: r.displayName,
    list_amount: r.listAmount,
    efectivo_amount: r.efectivoAmount,
    currency: r.currency,
    updated_at: now,
  }))
  const { error } = await getSupabase()
    .from('treatment_prices')
    .upsert(payload, { onConflict: 'slug' })
  return error ? error.message : null
}

// ---------- Mass-update math ----------

export type Rounding = 'up1000' | 'nearest1000' | 'none'
export type Direction = 'increase' | 'decrease'

/** Apply a percentage change + rounding rule to a single amount. */
export function applyPercent(
  amount: number,
  percent: number,
  direction: Direction,
  rounding: Rounding,
): number {
  const factor = direction === 'increase' ? 1 + percent / 100 : 1 - percent / 100
  const raw = Math.max(0, amount * factor)
  switch (rounding) {
    case 'up1000':
      return Math.ceil(raw / 1000) * 1000
    case 'nearest1000':
      return Math.round(raw / 1000) * 1000
    default:
      return Math.round(raw)
  }
}
