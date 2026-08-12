// Live Supabase read/write for informed consents (Etapa 4). This module covers
// the editable templates (0031 consent_templates); the signed consent instances
// (0030 consents) are added in the next step. RLS: staff read templates, admin
// writes them.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

const MEDIA_BUCKET = 'patient-media'
const SIGNED_URL_TTL_SECONDS = 60 * 60

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

// ── Signed consent instances (0030 consents) ──────────────────────────────────

export type ConsentStatus = 'pendiente' | 'firmado'

export type Consent = {
  id: string
  patientId: string
  professionalId: string | null
  professionalName: string | null
  treatmentSlug: string | null
  title: string
  body: string
  status: ConsentStatus
  signerName: string | null
  signedAt: string | null
  pdfPath: string | null
  pdfUrl: string | null // signed URL when a PDF exists
  createdAt: string
}

export type ConsentDraft = {
  patientId: string
  title: string
  body: string
  treatmentSlug?: string | null
  professionalId?: string | null
}

function mapConsent(row: any): Consent {
  const prof = Array.isArray(row.professional) ? row.professional[0] : row.professional
  return {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id ?? null,
    professionalName: prof?.display_name?.trim() || null,
    treatmentSlug: row.treatment_slug ?? null,
    title: row.title,
    body: row.body,
    status: row.status === 'firmado' ? 'firmado' : 'pendiente',
    signerName: row.signer_name ?? null,
    signedAt: row.signed_at ?? null,
    pdfPath: row.pdf_path ?? null,
    pdfUrl: null,
    createdAt: row.created_at,
  }
}

/** A patient's consents, newest first, with signed-PDF URLs resolved. */
export async function fetchPatientConsents(
  patientId: string,
): Promise<{ data: Consent[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('consents')
    .select(
      'id, patient_id, professional_id, treatment_slug, title, body, status, signer_name, signed_at, pdf_path, created_at, professional:professional_id (display_name)',
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) return { data: [], error: error.message }
  const rows = (data as any[]).map(mapConsent)

  // Sign the PDFs (best-effort).
  const paths = rows.map((r) => r.pdfPath).filter((p): p is string => !!p)
  if (paths.length > 0) {
    try {
      const { data: signed } = await getSupabase().storage
        .from(MEDIA_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      const urlByPath = new Map<string, string>()
      for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl)
      for (const r of rows) r.pdfUrl = r.pdfPath ? (urlByPath.get(r.pdfPath) ?? null) : null
    } catch {
      // leave pdfUrl null
    }
  }
  return { data: rows, error: null }
}

/** Create a pending consent (text snapshotted from a template). */
export async function createConsent(
  draft: ConsentDraft,
): Promise<{ id: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { id: null, error: null }
  const { data, error } = await getSupabase()
    .from('consents')
    .insert({
      patient_id: draft.patientId,
      title: draft.title,
      body: draft.body,
      treatment_slug: draft.treatmentSlug ?? null,
      professional_id: draft.professionalId ?? null,
      status: 'pendiente',
    })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  return { id: (data as { id: string }).id, error: null }
}

/** Mark a consent as signed (status firmado + signer + timestamp). The PDF is
 *  generated by the caller afterwards. */
export async function signConsent(
  id: string,
  signerName: string,
  signaturePath?: string | null,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { error } = await getSupabase()
    .from('consents')
    .update({
      status: 'firmado',
      signer_name: signerName,
      signature_path: signaturePath ?? null,
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return { error: error ? error.message : null }
}

export async function deleteConsent(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { error } = await getSupabase().from('consents').delete().eq('id', id)
  return { error: error ? error.message : null }
}
