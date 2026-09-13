// Global, panel-editable settings (migration 0036 app_settings). Key/value
// store the bot reads at runtime. First use: the pre-reserva hold TTL (minutes).

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export const PRE_RESERVA_HOLD_KEY = 'auto_reserva_hold_minutes'

// Lead-recovery inactivity window (hours): a lead with no activity for longer
// than this shows up in Recuperación (and, once automated, triggers follow-up).
// Panel-editable; signed default 22h.
export const RECOVERY_STALE_HOURS_KEY = 'recovery_stale_hours'
export const RECOVERY_STALE_HOURS_DEFAULT = 22

/** Read a numeric setting, falling back when absent/unconfigured. */
export async function fetchAppSettingNumber(
  key: string,
  fallback: number,
): Promise<number> {
  if (!isSupabaseConfigured()) return fallback
  const { data, error } = await getSupabase()
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return fallback
  const n = typeof data.value === 'number' ? data.value : Number(data.value)
  return Number.isFinite(n) ? n : fallback
}

/** Upsert a setting value (jsonb). Admin-only via RLS. */
export async function saveAppSetting(
  key: string,
  value: unknown,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null }
  const { error } = await getSupabase()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return { error: error ? error.message : null }
}
