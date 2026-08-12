// Generates the signed consent PDF (with the drawn signature embedded) and
// stores it in the patient-media bucket, then records pdf_path on the consent.
// Client-side; jsPDF is dynamically imported.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

const MEDIA_BUCKET = 'patient-media'

function embedded<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)
}

function prettySlug(slug: string | null): string {
  if (!slug) return ''
  const spaced = slug.replace(/-/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Build + store the signed consent PDF. `signatureDataUrl` is the PNG data URL
// drawn on the signature pad (embedded in the PDF). Best-effort.
export async function generateConsentPdf(
  consentId: string,
  signatureDataUrl?: string,
): Promise<{ pdfPath: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { pdfPath: null, error: null }
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('consents')
    .select(
      'id, title, body, treatment_slug, signer_name, signed_at, ' +
        'patient:patient_id (full_name), professional:professional_id (display_name)',
    )
    .eq('id', consentId)
    .maybeSingle()
  if (error) return { pdfPath: null, error: error.message }
  if (!data) return { pdfPath: null, error: 'Consentimiento no encontrado' }
  const row = data as any

  const patientName =
    embedded<{ full_name: string | null }>(row.patient)?.full_name?.trim() || 'Paciente'
  const professionalName =
    embedded<{ display_name: string | null }>(row.professional)?.display_name?.trim() || 'Sin asignar'

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 48
  const pageBottom = 800
  let y = 64

  const ensureSpace = (needed: number) => {
    if (y + needed > pageBottom) {
      doc.addPage()
      y = 64
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(45, 53, 71)
  doc.text('Corpo Bello', marginX, y)
  y += 20
  doc.setFontSize(13)
  doc.setTextColor(93, 135, 255)
  doc.text('Consentimiento informado', marginX, y)
  y += 12
  doc.setDrawColor(230, 230, 230)
  doc.line(marginX, y, 547, y)
  y += 24

  const field = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(120, 130, 150)
    doc.text(label, marginX, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(45, 53, 71)
    doc.text(value || 'Sin especificar', marginX, y + 14)
    y += 34
  }

  field('Paciente', patientName)
  field('Profesional', professionalName)
  if (row.treatment_slug) field('Tratamiento', prettySlug(row.treatment_slug))

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(45, 53, 71)
  const titleLines = doc.splitTextToSize(row.title as string, 499) as string[]
  ensureSpace(titleLines.length * 16 + 8)
  doc.text(titleLines, marginX, y)
  y += titleLines.length * 16 + 8

  // Body (paginated)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(60, 68, 84)
  const bodyLines = doc.splitTextToSize(row.body as string, 499) as string[]
  for (const line of bodyLines) {
    ensureSpace(14)
    doc.text(line, marginX, y)
    y += 14
  }
  y += 20

  // Signature block
  ensureSpace(140)
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', marginX, y, 180, 70)
    } catch {
      // ignore a bad image
    }
    y += 74
  }
  doc.setDrawColor(200, 200, 200)
  doc.line(marginX, y, marginX + 220, y)
  y += 14
  doc.setFontSize(10)
  doc.setTextColor(120, 130, 150)
  doc.text(`Firma del paciente · ${row.signer_name || patientName}`, marginX, y)
  y += 15
  doc.text(`Firmado el ${formatDate(row.signed_at)}`, marginX, y)

  const blob = doc.output('blob')
  const path = `consents/${consentId}/consentimiento.pdf`
  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: true })
  if (upErr) return { pdfPath: null, error: upErr.message }

  const { error: updErr } = await supabase
    .from('consents')
    .update({ pdf_path: path, updated_at: new Date().toISOString() })
    .eq('id', consentId)
  if (updErr) return { pdfPath: null, error: updErr.message }

  return { pdfPath: path, error: null }
}
