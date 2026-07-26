// Auto-gestión — the tattoo + láser Cotizador config (contract Etapa 1, sección
// 3), backed by quoting_config (migration 0016). The panel edits the FULL rules
// (in the JSON form the bot validates) and upserts it per engine. The bot
// overlays it fail-open (Zod-validated → falls back to code fixtures on any bad
// value). RLS: operators read, only admins write. Starts empty → the editor
// shows the generated defaults (quoting-defaults.ts) until the clinic saves.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { TattooRulesJson, LaserRulesJson } from '@/lib/data/quoting-defaults'

type Engine = 'tattoo' | 'laser'

export async function fetchQuotingConfig<T>(
  engine: Engine,
): Promise<{ config: T | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { config: null, error: null }
  const { data, error } = await getSupabase()
    .from('quoting_config')
    .select('config')
    .eq('engine', engine)
    .maybeSingle()
  if (error) return { config: null, error: error.message }
  return { config: (data?.config as T) ?? null, error: null }
}

export async function saveTattooConfig(
  config: TattooRulesJson,
): Promise<string | null> {
  return saveQuotingConfig('tattoo', config)
}

export async function saveLaserConfig(
  config: LaserRulesJson,
): Promise<string | null> {
  return saveQuotingConfig('laser', config)
}

async function saveQuotingConfig(
  engine: Engine,
  config: TattooRulesJson | LaserRulesJson,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('quoting_config').upsert(
    { engine, config, updated_at: new Date().toISOString() },
    { onConflict: 'engine' },
  )
  return error ? error.message : null
}
