// Panel-editable turno status config (Fase 2 · Etapa 2 — Andrés' autogestionable
// states). Overlays label/colour/active/order on the code's status keys and lets
// admins add custom states. Backed by migration 0048. The agenda reads this for
// labels, colours and the status picker; code/bot logic still keys off status_key.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export type TurnoStatusConfig = {
  statusKey: string
  label: string
  color: string
  active: boolean
  sortOrder: number
  isCustom: boolean
}

type Row = {
  status_key: string
  label: string
  color: string
  active: boolean
  sort_order: number
  is_custom: boolean
}

function rowToConfig(r: Row): TurnoStatusConfig {
  return {
    statusKey: r.status_key,
    label: r.label,
    color: r.color,
    active: r.active,
    sortOrder: r.sort_order,
    isCustom: r.is_custom,
  }
}

export async function fetchTurnoStatusConfig(): Promise<{
  data: TurnoStatusConfig[]
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: [], error: null }
  const { data, error } = await getSupabase()
    .from('turno_status_config')
    .select('status_key, label, color, active, sort_order, is_custom')
    .order('sort_order', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data as Row[]).map(rowToConfig), error: null }
}

export async function upsertTurnoStatus(cfg: TurnoStatusConfig): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('turno_status_config')
    .upsert(
      {
        status_key: cfg.statusKey,
        label: cfg.label,
        color: cfg.color,
        active: cfg.active,
        sort_order: cfg.sortOrder,
        is_custom: cfg.isCustom,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'status_key' },
    )
  return error ? error.message : null
}

/** Delete a CUSTOM status (built-in ones can only be disabled, not deleted). */
export async function deleteTurnoStatus(statusKey: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('turno_status_config')
    .delete()
    .eq('status_key', statusKey)
    .eq('is_custom', true)
  return error ? error.message : null
}

/** Make a URL/DB-safe key from a label (for custom statuses). */
export function slugifyStatusKey(label: string): string {
  return (
    'custom_' +
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40)
  )
}
