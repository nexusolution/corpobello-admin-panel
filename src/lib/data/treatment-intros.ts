// Auto-gestión — edit the intro text (premium positioning copy shown before a
// treatment's flow), backed by treatment_intros (migration 0013). Each message
// bubble is separated by a line containing only '---'. The bot splits on those
// and overrides the menu item's introText (fail-open). RLS: operators read,
// admins write.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TreatmentIntro = {
  slug: string
  displayName: string
  introText: string
}

type Row = {
  slug: string
  display_name: string
  intro_text: string
}

export async function fetchTreatmentIntros(): Promise<{
  data: TreatmentIntro[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('treatment_intros')
    .select('slug, display_name, intro_text')
    .order('display_name', { ascending: true })
  if (error) return { data: [], error: error.message }
  const rows = (data as Row[]).map((r) => ({
    slug: r.slug,
    displayName: r.display_name,
    introText: r.intro_text,
  }))
  return { data: rows, error: null }
}

/** Persist an edited intro text. Returns an error string on failure. */
export async function updateTreatmentIntro(
  slug: string,
  introText: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('treatment_intros')
    .update({ intro_text: introText, updated_at: new Date().toISOString() })
    .eq('slug', slug)
  return error ? error.message : null
}
