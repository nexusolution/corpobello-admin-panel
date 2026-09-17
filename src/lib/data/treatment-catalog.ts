// Autogestionable treatment catalog (migration 0051). The panel manages the list
// of treatments here — add / rename / reorder / enable-disable — keyed by the same
// slug the rest of the system uses (colours, prices, availability, turnos). New
// custom treatments become configurable in those sections once they exist here.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TreatmentCatalogItem = {
  slug: string
  label: string
  active: boolean
  sortOrder: number
  durationMin: number | null
  isCustom: boolean
}

type Row = {
  slug: string
  label: string
  active: boolean
  sort_order: number
  duration_min: number | null
  is_custom: boolean
}

function rowToItem(r: Row): TreatmentCatalogItem {
  return {
    slug: r.slug,
    label: r.label,
    active: r.active,
    sortOrder: r.sort_order,
    durationMin: r.duration_min,
    isCustom: r.is_custom,
  }
}

export async function fetchTreatmentCatalog(): Promise<{
  data: TreatmentCatalogItem[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('treatment_catalog')
    .select('slug, label, active, sort_order, duration_min, is_custom')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data as Row[]).map(rowToItem), error: null }
}

/** Bulk import the current code catalog into the table (first-time seed). Existing
 *  rows are left untouched (upsert on slug, ignore duplicates). */
export async function seedTreatmentCatalog(
  items: { slug: string; label: string }[],
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: 'not-configured' }
  if (items.length === 0) return { error: null }
  const rows = items.map((it, i) => ({
    slug: it.slug,
    label: it.label,
    active: true,
    sort_order: i,
    is_custom: false,
  }))
  // onConflict slug + ignoreDuplicates so a re-import never clobbers edits.
  const { error } = await getSupabase()
    .from('treatment_catalog')
    .upsert(rows, { onConflict: 'slug', ignoreDuplicates: true })
  return { error: error ? error.message : null }
}

function slugify(label: string): string {
  return (
    'custom_' +
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  )
}

/** Add a custom treatment. Returns the created slug (or an error). */
export async function addTreatment(
  label: string,
  sortOrder: number,
): Promise<{ slug: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { slug: null, error: 'not-configured' }
  const slug = `${slugify(label)}_${Date.now().toString(36).slice(-4)}`
  const { error } = await getSupabase().from('treatment_catalog').insert({
    slug,
    label: label.trim(),
    active: true,
    sort_order: sortOrder,
    is_custom: true,
  })
  return { slug: error ? null : slug, error: error ? error.message : null }
}

export async function updateTreatment(
  slug: string,
  fields: { label?: string; active?: boolean; sortOrder?: number; durationMin?: number | null },
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: 'not-configured' }
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.label !== undefined) payload.label = fields.label.trim()
  if (fields.active !== undefined) payload.active = fields.active
  if (fields.sortOrder !== undefined) payload.sort_order = fields.sortOrder
  if (fields.durationMin !== undefined) payload.duration_min = fields.durationMin
  const { error } = await getSupabase().from('treatment_catalog').update(payload).eq('slug', slug)
  return { error: error ? error.message : null }
}

/** Persist a new order (list of slugs top-to-bottom). */
export async function reorderTreatments(slugs: string[]): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: 'not-configured' }
  const rows = slugs.map((slug, i) => ({ slug, sort_order: i }))
  // Upsert only touches sort_order; label/active are required on insert but these
  // slugs already exist, so update-in-place via upsert-merge on the PK.
  for (const r of rows) {
    const { error } = await getSupabase()
      .from('treatment_catalog')
      .update({ sort_order: r.sort_order })
      .eq('slug', r.slug)
    if (error) return { error: error.message }
  }
  return { error: null }
}

/** Delete a CUSTOM treatment (imported code ones should be disabled, not deleted). */
export async function deleteTreatment(slug: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: 'not-configured' }
  const { error } = await getSupabase()
    .from('treatment_catalog')
    .delete()
    .eq('slug', slug)
    .eq('is_custom', true)
  return { error: error ? error.message : null }
}
