// Panel-editable per-treatment colours (Fase 2 · Etapa 2 — Andrés). Overlays a
// colour on a treatment slug; the agenda reads it for the treatment circle/dot,
// falling back to the code's category palette when a slug has no row. Migration 0049.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

/** slug -> colour map for every configured treatment colour. */
export async function fetchTreatmentColors(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!isSupabaseConfigured()) return out
  const { data, error } = await getSupabase().from('treatment_colors').select('treatment_slug, color')
  if (error || !data) return out
  for (const r of data as { treatment_slug: string; color: string }[]) out.set(r.treatment_slug, r.color)
  return out
}

export async function saveTreatmentColor(slug: string, color: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('treatment_colors')
    .upsert({ treatment_slug: slug, color, updated_at: new Date().toISOString() }, { onConflict: 'treatment_slug' })
  return error ? error.message : null
}

export async function resetTreatmentColor(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('treatment_colors').delete().eq('treatment_slug', slug)
  return error ? error.message : null
}
