// Which treatments each professional performs (migration 0053) — capability,
// SEPARATE from schedule availability. One row per professional; the absence of a
// row means "performs all". Pure helpers (resolve/toggle/enabled) + Supabase IO.
// RLS: operators read, admins write. Degrades to "all" when the table is missing.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TreatmentMode = 'all' | 'all_except' | 'only' | 'none'

export type ProfessionalTreatments = {
  professionalId: string
  mode: TreatmentMode
  slugs: string[]
}

type Row = {
  professional_id: string
  mode: TreatmentMode
  treatment_slugs: string[] | null
}

function toConfig(r: Row): ProfessionalTreatments {
  return { professionalId: r.professional_id, mode: r.mode, slugs: r.treatment_slugs ?? [] }
}

export async function fetchProfessionalTreatments(): Promise<{
  data: Map<string, ProfessionalTreatments>
  error: string | null
}> {
  const empty = new Map<string, ProfessionalTreatments>()
  if (!isSupabaseConfigured()) return { data: empty, error: null }
  const { data, error } = await getSupabase().from('professional_treatments').select('*')
  if (error) return { data: empty, error: error.message }
  const map = new Map<string, ProfessionalTreatments>()
  for (const r of (data as Row[] | null) ?? []) map.set(r.professional_id, toConfig(r))
  return { data: map, error: null }
}

export async function saveProfessionalTreatments(
  professionalId: string,
  mode: TreatmentMode,
  slugs: string[],
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  // 'all'/'none' carry no slug list; keep the column tidy.
  const cleanSlugs = mode === 'all_except' || mode === 'only' ? slugs : []
  const { error } = await getSupabase()
    .from('professional_treatments')
    .upsert(
      {
        professional_id: professionalId,
        mode,
        treatment_slugs: cleanSlugs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'professional_id' },
    )
  return error ? error.message : null
}

/** Does the professional perform `slug`? No config = performs all (default). Pure. */
export function professionalDoesTreatment(
  cfg: ProfessionalTreatments | undefined,
  slug: string,
): boolean {
  if (!cfg || cfg.mode === 'all') return true
  if (cfg.mode === 'none') return false
  if (cfg.mode === 'all_except') return !cfg.slugs.includes(slug)
  return cfg.slugs.includes(slug) // 'only'
}

/** Professional ids (from `allIds`) enabled for `slug`, per the config map. Pure. */
export function enabledProfessionalIdsFor(
  slug: string,
  allIds: readonly string[],
  configs: Map<string, ProfessionalTreatments>,
): string[] {
  return allIds.filter((id) => professionalDoesTreatment(configs.get(id), slug))
}

/** Reverse-direction edit (Catálogo → treatment → professionals): flip whether a
 *  professional performs `slug`, returning the minimally-changed {mode, slugs}.
 *  Deterministic across all four modes. Pure. */
export function toggleProfessionalTreatment(
  cfg: ProfessionalTreatments | undefined,
  slug: string,
  enabled: boolean,
): { mode: TreatmentMode; slugs: string[] } {
  const mode: TreatmentMode = cfg?.mode ?? 'all'
  const slugs = cfg?.slugs ?? []
  if (professionalDoesTreatment(cfg, slug) === enabled) return { mode, slugs }
  switch (mode) {
    case 'all':
      // Was enabled for everything; the only change is disabling this one.
      return { mode: 'all_except', slugs: [slug] }
    case 'none':
      // Was disabled for everything; enable just this one.
      return { mode: 'only', slugs: [slug] }
    case 'all_except': {
      if (enabled) {
        const next = slugs.filter((s) => s !== slug)
        return next.length === 0 ? { mode: 'all', slugs: [] } : { mode: 'all_except', slugs: next }
      }
      return { mode: 'all_except', slugs: slugs.includes(slug) ? slugs : [...slugs, slug] }
    }
    case 'only': {
      if (enabled) return { mode: 'only', slugs: slugs.includes(slug) ? slugs : [...slugs, slug] }
      const next = slugs.filter((s) => s !== slug)
      return next.length === 0 ? { mode: 'none', slugs: [] } : { mode: 'only', slugs: next }
    }
  }
}
