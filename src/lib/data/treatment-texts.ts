// Auto-gestión — edit the customQuoteBody (quote text) of the treatments whose
// price lives in prose, backed by treatment_texts (migration 0009). The bot
// overrides the menu item's customQuoteBody before quoting (fail-open). RLS:
// operators read, admins write.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TreatmentText = {
  slug: string
  displayName: string
  customQuoteBody: string
}

type Row = {
  slug: string
  display_name: string
  custom_quote_body: string
}

export async function fetchTreatmentTexts(): Promise<{
  data: TreatmentText[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('treatment_texts')
    .select('slug, display_name, custom_quote_body')
    .order('display_name', { ascending: true })
  if (error) return { data: [], error: error.message }
  const rows = (data as Row[]).map((r) => ({
    slug: r.slug,
    displayName: r.display_name,
    customQuoteBody: r.custom_quote_body,
  }))
  return { data: rows, error: null }
}

/** Persist an edited quote text. Returns an error string on failure. */
export async function updateTreatmentText(
  slug: string,
  customQuoteBody: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('treatment_texts')
    .update({ custom_quote_body: customQuoteBody, updated_at: new Date().toISOString() })
    .eq('slug', slug)
  return error ? error.message : null
}
