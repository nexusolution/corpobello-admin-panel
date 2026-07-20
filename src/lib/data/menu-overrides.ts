// Auto-gestión — enable/disable top-level treatments in the bot menu, backed by
// the menu_overrides table (migration 0007). The bot reads inactive slugs
// (fail-open) and drops them from the menu it shows patients. RLS: operators
// read, only admins write — the Auto-gestión page is AdminGate'd.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type MenuOverride = {
  slug: string
  displayName: string
  active: boolean
  sortOrder: number
}

type Row = {
  slug: string
  display_name: string
  active: boolean
  sort_order: number
}

export async function fetchMenuOverrides(): Promise<{
  data: MenuOverride[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('menu_overrides')
    .select('slug, display_name, active, sort_order')
    .order('sort_order', { ascending: true })
  if (error) return { data: [], error: error.message }
  const rows = (data as Row[]).map((r) => ({
    slug: r.slug,
    displayName: r.display_name,
    active: r.active,
    sortOrder: r.sort_order,
  }))
  return { data: rows, error: null }
}

/** Turn a treatment on/off in the bot menu. Returns an error string on failure. */
export async function setTreatmentActive(
  slug: string,
  active: boolean,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('menu_overrides')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('slug', slug)
  return error ? error.message : null
}
