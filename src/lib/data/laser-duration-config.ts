// Configurable láser duration tables (migration 0056). The whole engine config
// (mujer + varon zonas/inclusiones/reemplazos/combinaciones) is stored as one
// JSONB singleton row. Absent row → the built-in PDF defaults. Admins write,
// operators read (RLS). Degrades to defaults when the table is missing.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import {
  defaultLaserDurationConfig,
  type LaserDurationConfig,
} from '@/lib/scheduling/laser-duration'

function isValid(c: unknown): c is LaserDurationConfig {
  const cfg = c as LaserDurationConfig | null
  return (
    !!cfg &&
    !!cfg.mujer &&
    Array.isArray(cfg.mujer.zones) &&
    !!cfg.varon &&
    Array.isArray(cfg.varon.zones)
  )
}

export async function fetchLaserDurationConfig(): Promise<{
  data: LaserDurationConfig
  error: string | null
}> {
  if (!isSupabaseConfigured()) return { data: defaultLaserDurationConfig, error: null }
  const { data, error } = await getSupabase()
    .from('laser_duration_config')
    .select('config')
    .eq('id', 1)
    .maybeSingle()
  if (error) return { data: defaultLaserDurationConfig, error: error.message }
  const cfg = (data as { config?: unknown } | null)?.config
  return { data: isValid(cfg) ? cfg : defaultLaserDurationConfig, error: null }
}

export async function saveLaserDurationConfig(config: LaserDurationConfig): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('laser_duration_config')
    .upsert({ id: 1, config, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return error ? error.message : null
}
