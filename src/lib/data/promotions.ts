// Auto-gestión — promotions CRUD (contract Etapa 1, sección 2), backed by the
// promotions table (migration 0017). The bot reads active promos, date-filters
// them, and applies the winner to its numeric photo-eval auto-quotes (list price
// struck + promo price). RLS: operators read, only admins write.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface Promotion {
  id: string
  name: string
  active: boolean
  scope: 'all' | 'selected'
  treatmentSlugs: string[]
  discountPercent: number
  combinable: boolean
  priority: number
  startsAt: string | null
  endsAt: string | null
}

type Row = {
  id: string
  name: string
  active: boolean
  scope: string
  treatment_slugs: string[] | null
  discount_percent: string | number
  combinable: boolean
  priority: number
  starts_at: string | null
  ends_at: string | null
}

function fromRow(r: Row): Promotion {
  return {
    id: r.id,
    name: r.name,
    active: r.active,
    scope: r.scope === 'selected' ? 'selected' : 'all',
    treatmentSlugs: Array.isArray(r.treatment_slugs) ? r.treatment_slugs : [],
    discountPercent: Number(r.discount_percent),
    combinable: r.combinable,
    priority: r.priority,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
  }
}

export type PromotionInput = Omit<Promotion, 'id'>

function toRow(p: PromotionInput) {
  return {
    name: p.name,
    active: p.active,
    scope: p.scope,
    treatment_slugs: p.scope === 'selected' ? p.treatmentSlugs : [],
    discount_percent: p.discountPercent,
    combinable: p.combinable,
    priority: p.priority,
    starts_at: p.startsAt,
    ends_at: p.endsAt,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchPromotions(): Promise<{
  data: Promotion[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('promotions')
    .select(
      'id, name, active, scope, treatment_slugs, discount_percent, combinable, priority, starts_at, ends_at',
    )
    .order('priority', { ascending: false })
    .order('name', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data as Row[]).map(fromRow), error: null }
}

export async function createPromotion(
  input: PromotionInput,
): Promise<{ promotion: Promotion | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { promotion: null, error: 'not-configured' }
  const { data, error } = await getSupabase()
    .from('promotions')
    .insert(toRow(input))
    .select(
      'id, name, active, scope, treatment_slugs, discount_percent, combinable, priority, starts_at, ends_at',
    )
    .single()
  if (error || !data) return { promotion: null, error: error?.message ?? 'insert-failed' }
  return { promotion: fromRow(data as Row), error: null }
}

export async function updatePromotion(
  id: string,
  input: PromotionInput,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('promotions')
    .update(toRow(input))
    .eq('id', id)
  return error ? error.message : null
}

/** Toggle just the active flag (quick on/off from the list). */
export async function setPromotionActive(
  id: string,
  active: boolean,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('promotions')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
  return error ? error.message : null
}

export async function deletePromotion(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('promotions').delete().eq('id', id)
  return error ? error.message : null
}
