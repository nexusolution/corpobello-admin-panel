// Auto-gestión — availability rules & cross-sucursal exclusions, backed by
// availability_rules / availability_exclusions (migration 0040). Feeds the
// availability engine (@/lib/scheduling/availability). RLS: operators read,
// admins write.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type {
  AvailabilityExclusion,
  AvailabilityRule,
  DayPattern,
} from '@/lib/scheduling/availability'

type RuleRow = {
  id: string
  sucursal: string
  professional_id: string | null
  treatment_slugs: string[] | null
  treatment_exclude: string[] | null
  pattern: DayPattern
  open_min: number
  close_min: number
  active: boolean
  label: string | null
}

type ExclusionRow = {
  id: string
  sucursal: string
  treatment_slugs: string[] | null
  when_active_in: string[] | null
  active: boolean
  label: string | null
}

function toRule(r: RuleRow): AvailabilityRule {
  return {
    id: r.id,
    sucursal: r.sucursal,
    professionalId: r.professional_id,
    treatmentSlugs: r.treatment_slugs ?? [],
    treatmentExclude: r.treatment_exclude ?? [],
    pattern: r.pattern,
    openMin: r.open_min,
    closeMin: r.close_min,
    active: r.active,
    label: r.label ?? undefined,
  }
}

function toExclusion(r: ExclusionRow): AvailabilityExclusion {
  return {
    id: r.id,
    sucursal: r.sucursal,
    treatmentSlugs: r.treatment_slugs ?? [],
    whenActiveIn: r.when_active_in ?? [],
    active: r.active,
    label: r.label ?? undefined,
  }
}

export async function fetchAvailability(): Promise<{
  rules: AvailabilityRule[]
  exclusions: AvailabilityExclusion[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { rules: [], exclusions: [], error: null }
  const sb = getSupabase()
  const [rulesRes, exclRes] = await Promise.all([
    sb.from('availability_rules').select('*'),
    sb.from('availability_exclusions').select('*'),
  ])
  const error = rulesRes.error?.message ?? exclRes.error?.message ?? null
  return {
    rules: ((rulesRes.data as RuleRow[] | null) ?? []).map(toRule),
    exclusions: ((exclRes.data as ExclusionRow[] | null) ?? []).map(toExclusion),
    error,
  }
}

/** Insert or update a rule. Omit `id` (or pass a falsy one) to create. */
export async function saveRule(rule: AvailabilityRule): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const payload: Record<string, unknown> = {
    sucursal: rule.sucursal,
    professional_id: rule.professionalId ?? null,
    treatment_slugs: rule.treatmentSlugs,
    treatment_exclude: rule.treatmentExclude ?? [],
    pattern: rule.pattern,
    open_min: rule.openMin,
    close_min: rule.closeMin,
    active: rule.active,
    label: rule.label ?? null,
    updated_at: new Date().toISOString(),
  }
  if (rule.id) payload.id = rule.id
  const { error } = await getSupabase()
    .from('availability_rules')
    .upsert(payload, { onConflict: 'id' })
  return error ? error.message : null
}

export async function deleteRule(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('availability_rules').delete().eq('id', id)
  return error ? error.message : null
}

export async function saveExclusion(ex: AvailabilityExclusion): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const payload: Record<string, unknown> = {
    sucursal: ex.sucursal,
    treatment_slugs: ex.treatmentSlugs,
    when_active_in: ex.whenActiveIn,
    active: ex.active,
    label: ex.label ?? null,
    updated_at: new Date().toISOString(),
  }
  if (ex.id) payload.id = ex.id
  const { error } = await getSupabase()
    .from('availability_exclusions')
    .upsert(payload, { onConflict: 'id' })
  return error ? error.message : null
}

export async function deleteExclusion(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('availability_exclusions').delete().eq('id', id)
  return error ? error.message : null
}
