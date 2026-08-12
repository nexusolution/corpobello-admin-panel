// Generates the signed session-close PDF for a clinical evolution (Etapa 3) and
// stores it in the patient-media bucket, then records pdf_path on the row. Runs
// client-side; jsPDF is dynamically imported so it stays out of the main bundle.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

const MEDIA_BUCKET = 'patient-media'

function embedded<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)
}

// No dashes in output (client rule): slug hyphens become spaces.
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

// Build + store the comprobante PDF. Best-effort; returns the storage path.
export async function generateComprobante(
  evolucionId: string,
): Promise<{ pdfPath: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { pdfPath: null, error: null }
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('evoluciones')
    .select(
      'id, session_date, treatment_slug, notes, signed_at, ' +
        'patient:patient_id (full_name), professional:professional_id (display_name)',
    )
    .eq('id', evolucionId)
    .maybeSingle()
  if (error) return { pdfPath: null, error: error.message }
  if (!data) return { pdfPath: null, error: 'Evolución no encontrada' }
  const row = data as any

  const patientName =
    embedded<{ full_name: string | null }>(row.patient)?.full_name?.trim() || 'Paciente'
  const professionalName =
    embedded<{ display_name: string | null }>(row.professional)?.display_name?.trim() ||
    'Sin asignar'

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 48
  let y = 64

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(45, 53, 71)
  doc.text('Corpo Bello', marginX, y)
  y += 22
  doc.setFontSize(13)
  doc.setTextColor(93, 135, 255)
  doc.text('Comprobante de cierre de sesión', marginX, y)
  y += 12
  doc.setDrawColor(230, 230, 230)
  doc.line(marginX, y, 547, y)
  y += 28

  const field = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(120, 130, 150)
    doc.text(label, marginX, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(45, 53, 71)
    doc.text(value || 'Sin especificar', marginX, y + 16)
    y += 40
  }

  field('Paciente', patientName)
  field('Profesional', professionalName)
  field('Tratamiento', prettySlug(row.treatment_slug))
  field('Fecha de la sesión', formatDate(row.session_date))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(120, 130, 150)
  doc.text('Evolución clínica', marginX, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(45, 53, 71)
  const notes = (row.notes as string | null)?.trim() || 'Sin observaciones registradas.'
  const lines = doc.splitTextToSize(notes, 499) as string[]
  doc.text(lines, marginX, y)
  y += lines.length * 15 + 40

  doc.setDrawColor(200, 200, 200)
  doc.line(marginX, y, marginX + 220, y)
  y += 14
  doc.setFontSize(10)
  doc.setTextColor(120, 130, 150)
  doc.text(`Firma del profesional · ${professionalName}`, marginX, y)
  y += 16
  doc.text(`Sesión cerrada el ${formatDate(row.signed_at)}`, marginX, y)

  const blob = doc.output('blob')
  const path = `evoluciones/${evolucionId}/comprobante.pdf`
  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: true })
  if (upErr) return { pdfPath: null, error: upErr.message }

  const { error: updErr } = await supabase
    .from('evoluciones')
    .update({ pdf_path: path, updated_at: new Date().toISOString() })
    .eq('id', evolucionId)
  if (updErr) return { pdfPath: null, error: updErr.message }

  return { pdfPath: path, error: null }
}
