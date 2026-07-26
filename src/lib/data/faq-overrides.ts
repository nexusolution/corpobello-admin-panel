// Auto-gestión — edit / hide individual FAQ entries per treatment, backed by
// faq_overrides (migration 0014). DIFF storage: a row exists only for an edited
// or hidden entry; the full default catalogue lives in the generated snapshot
// (faq-defaults.ts). The bot overlays the diff fail-open. A field left null on
// the row means "keep the code default", so later code edits still propagate.
// RLS: operators read, only admins write (the Auto-gestión page is AdminGate'd).

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface FaqOverrideRow {
  slug: string
  entryId: string
  shortLabel: string | null
  question: string | null
  answerText: string | null
  active: boolean
}

/** Key a (slug, entryId) pair for the override lookup map. */
export function faqKey(slug: string, entryId: string): string {
  return `${slug}::${entryId}`
}

export async function fetchFaqOverrides(): Promise<{
  data: Map<string, FaqOverrideRow>
  error: string | null
}> {
  const map = new Map<string, FaqOverrideRow>()
  if (!isSupabaseConfigured()) return { data: map, error: null }
  const { data, error } = await getSupabase()
    .from('faq_overrides')
    .select('slug, entry_id, short_label, question, answer_text, active')
  if (error) return { data: map, error: error.message }
  for (const r of data as {
    slug: string
    entry_id: string
    short_label: string | null
    question: string | null
    answer_text: string | null
    active: boolean | null
  }[]) {
    map.set(faqKey(r.slug, r.entry_id), {
      slug: r.slug,
      entryId: r.entry_id,
      shortLabel: r.short_label,
      question: r.question,
      answerText: r.answer_text,
      active: r.active !== false,
    })
  }
  return { data: map, error: null }
}

/**
 * Persist an edited FAQ entry. Pass null for any field that should keep its
 * code default. Returns an error string on failure.
 */
export async function upsertFaqOverride(input: {
  slug: string
  entryId: string
  displayName: string
  shortLabel: string | null
  question: string | null
  answerText: string | null
  active: boolean
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('faq_overrides').upsert(
    {
      slug: input.slug,
      entry_id: input.entryId,
      display_name: input.displayName,
      short_label: input.shortLabel,
      question: input.question,
      answer_text: input.answerText,
      active: input.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug,entry_id' },
  )
  return error ? error.message : null
}

/** Revert an entry to its code default by deleting its override row. */
export async function resetFaqOverride(
  slug: string,
  entryId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('faq_overrides')
    .delete()
    .eq('slug', slug)
    .eq('entry_id', entryId)
  return error ? error.message : null
}

/** The '---'-separated on-disk form of an answer's bubbles. */
export function joinBubbles(bubbles: string[]): string {
  return bubbles.join('\n---\n')
}
