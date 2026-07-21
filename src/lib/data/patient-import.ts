// Patient import (Etapa 1 · E). Parses a CSV export (AgendaPro or Excel saved
// as CSV), maps columns to patient fields, dedupes against existing patients by
// phone, and bulk-inserts. RLS: patients insert is allowed for any operator.
//
// CSV (not native .xlsx) on purpose: it avoids a heavy spreadsheet dependency
// (and SheetJS's npm CVE) in the client-handover repo. Excel → "Save as CSV".

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// ---------- CSV parsing ----------

/** Detect the delimiter from the header line (ES-locale exports often use ';'). */
function detectDelimiter(firstLine: string): ',' | ';' | '\t' {
  const counts: Record<string, number> = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return (best && best[1] > 0 ? best[0] : ',') as ',' | ';' | '\t'
}

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, "" escapes, CRLF. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '') // strip BOM
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delim = detectDelimiter(firstLine)

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c === '\r') {
      // ignore; \n handles the line break
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => r.some((v) => v.trim().length > 0))
}

// ---------- Field mapping ----------

export type TargetField = 'firstName' | 'lastName' | 'phone' | 'email' | 'sucursal'

export const TARGET_FIELDS: TargetField[] = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'sucursal',
]

// Header keywords → target field, for auto-guessing the column mapping.
const HEADER_HINTS: Record<TargetField, string[]> = {
  firstName: ['nombre', 'first', 'name'],
  lastName: ['apellido', 'last', 'surname'],
  phone: ['tel', 'phone', 'celular', 'whatsapp', 'movil', 'móvil'],
  email: ['email', 'mail', 'correo'],
  sucursal: ['sucursal', 'branch', 'sede'],
}

/** Guess a column index for each field from the header row. -1 = unmapped. */
export function guessMapping(headers: string[]): Record<TargetField, number> {
  const norm = headers.map((h) => h.trim().toLowerCase())
  const out = {} as Record<TargetField, number>
  for (const field of TARGET_FIELDS) {
    out[field] = norm.findIndex((h) => HEADER_HINTS[field].some((k) => h.includes(k)))
  }
  return out
}

export function digitsOf(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

function normalizeSucursal(v: string): string | null {
  const s = (v || '').trim().toLowerCase()
  return s === 'caballito' || s === 'merlo' || s === 'moreno' ? s : null
}

export type ParsedPatient = {
  fullName: string
  phone: string
  phoneDigits: string
  email: string
  sucursal: string | null
  status: 'new' | 'duplicate' | 'invalid'
}

/** Build patient records from data rows + a column mapping, flagged for dedup. */
export function buildRecords(
  dataRows: string[][],
  mapping: Record<TargetField, number>,
  existingPhoneDigits: Set<string>,
): ParsedPatient[] {
  const seen = new Set<string>()
  const at = (row: string[], idx: number) => (idx >= 0 ? (row[idx] ?? '').trim() : '')

  return dataRows.map((row) => {
    const first = at(row, mapping.firstName)
    const last = at(row, mapping.lastName)
    const fullName = [first, last].filter(Boolean).join(' ').trim()
    const phone = at(row, mapping.phone)
    const phoneDigits = digitsOf(phone)
    const email = at(row, mapping.email)
    const sucursal = normalizeSucursal(at(row, mapping.sucursal))

    let status: ParsedPatient['status'] = 'new'
    // Need at least a name and a plausible phone (7+ digits) to be importable.
    if (!fullName || phoneDigits.length < 7) {
      status = 'invalid'
    } else if (existingPhoneDigits.has(phoneDigits) || seen.has(phoneDigits)) {
      status = 'duplicate'
    } else {
      seen.add(phoneDigits)
    }

    return { fullName, phone, phoneDigits, email, sucursal, status }
  })
}

// ---------- Supabase ----------

/** Digits-only phone set of every existing patient, for dedup. */
export async function fetchExistingPhoneDigits(): Promise<Set<string>> {
  const set = new Set<string>()
  if (!isSupabaseConfigured()) return set
  const { data, error } = await getSupabase()
    .from('patients')
    .select('whatsapp_phone')
  if (error || !data) return set
  for (const r of data as { whatsapp_phone: string | null }[]) {
    const d = digitsOf(r.whatsapp_phone ?? '')
    if (d) set.add(d)
  }
  return set
}

/** Insert the new (non-duplicate, valid) records. Returns count + error. */
export async function importPatients(
  records: ParsedPatient[],
): Promise<{ inserted: number; error: string | null }> {
  const toInsert = records.filter((r) => r.status === 'new')
  if (toInsert.length === 0) return { inserted: 0, error: null }
  if (!isSupabaseConfigured()) return { inserted: 0, error: 'not-configured' }

  const payload = toInsert.map((r) => ({
    full_name: r.fullName,
    whatsapp_phone: r.phone.trim() || null,
    email: r.email || null,
    sucursal: r.sucursal,
    status: 'nuevo',
  }))
  const { error } = await getSupabase().from('patients').insert(payload)
  return { inserted: error ? 0 : toInsert.length, error: error ? error.message : null }
}
