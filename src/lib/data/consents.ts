// Live Supabase read/write for informed consents (Etapa 4). This module covers
// the editable templates (0031 consent_templates); the signed consent instances
// (0030 consents) are added in the next step. RLS: staff read templates, admin
// writes them.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type ConsentTemplate = {
  id: string
  title: string
  body: string
  treatmentSlug: string | null
  active: boolean
  createdAt: string
}

export type ConsentTemplateDraft = {
  title: string
  body: string
  treatmentSlug?: string | null
  active?: boolean
}

function mapTemplate(row: any): ConsentTemplate {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    treatmentSlug: row.treatment_slug ?? null,
    active: row.active !== false,
    createdAt: row.created_at,
  }
}

/** All templates (admin editor). Pass activeOnly for the consent-creation picker. */
export async function fetchConsentTemplates(
  activeOnly = false,
): Promise<{ data: ConsentTemplate[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  let q = getSupabase()
    .from('consent_templates')
    .select('id, title, body, treatment_slug, active, created_at')
    .order('title', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) return { data: [], error: error.message }
  return { data: (data as any[]).map(mapTemplate), error: null }
}

export async function createConsentTemplate(
  draft: ConsentTemplateDraft,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { error } = await getSupabase().from('consent_templates').insert({
    title: draft.title,
    body: draft.body,
    treatment_slug: draft.treatmentSlug ?? null,
    active: draft.active ?? true,
  })
  return { error: error ? error.message : null }
}

export async function updateConsentTemplate(
  id: string,
  draft: Partial<ConsentTemplateDraft>,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (draft.title !== undefined) body.title = draft.title
  if (draft.body !== undefined) body.body = draft.body
  if (draft.treatmentSlug !== undefined) body.treatment_slug = draft.treatmentSlug
  if (draft.active !== undefined) body.active = draft.active
  const { error } = await getSupabase().from('consent_templates').update(body).eq('id', id)
  return { error: error ? error.message : null }
}

export async function deleteConsentTemplate(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { error } = await getSupabase().from('consent_templates').delete().eq('id', id)
  return { error: error ? error.message : null }
}
