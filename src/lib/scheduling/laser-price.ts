// Laser hair-removal turno PRICE engine (Etapa 2, línea firmada 273-278: "cálculo
// automático del valor total"). It reuses the CLINIC'S EXISTING per-zone laser
// prices — the same ones the bot cotizador uses — from quoting_config engine
// 'laser' (panel editor: Autogestión → Cotizadores → Láser), with the generated
// LASER_DEFAULT as fallback. No new price table: prices stay in ONE place.
//
// The only glue needed is a bridge between the two independent zone catalogs:
//   - the DURATION engine (and the turno's stored `laserZones`) use slug keys per
//     sex, e.g. 'axilas', 'piernas-completas', sex 'mujer' | 'varon';
//   - the PRICE config uses the cotizador keys, e.g. 'AXI_MUJ', 'AXI_HOM',
//     'PIERNAS_MUJ', gender 'mujer' | 'hombre'.
// LASER_PRICE_KEY_BY_ZONE maps each duration slug (per sex) to its price key. A
// zona with no price counterpart is reported as `unpriced` (shown as "sin precio"),
// never silently dropped.
//
// The total is computed over the NORMALIZED zona set (same normalization the
// duration engine applies: replacements + inclusions), so a contained zona is
// never double-charged, exactly like the suggested duration. Prices are summed at
// list value; the efectivo (cash) discount applies ONLY to the grand total, like
// the bot's quoteLaser.

import type { LaserRulesJson } from '@/lib/data/quoting-defaults'
import { LASER_DEFAULT } from '@/lib/data/quoting-defaults'
import { fetchQuotingConfig, type LaserRulesConfig } from '@/lib/data/quoting-config'
import { computeLaserDuration, type LaserDurationConfig, type LaserSex } from './laser-duration'

// duration slug (per sex) → cotizador price key. Every default zona is mapped;
// keep in sync if a zona is added to laser-duration.ts or to the price catalog.
export const LASER_PRICE_KEY_BY_ZONE: Record<LaserSex, Record<string, string>> = {
  mujer: {
    rostro: 'ROSTRO_MUJ',
    'medio-rostro': 'MEDIO_ROSTRO_MUJ',
    frente: 'FRENTE_MUJ',
    entrecejo: 'ENTRECEJO_MUJ',
    cejas: 'CEJAS_MUJ',
    'cejas-entrecejo': 'CEJAS_ENT_MUJ',
    mejillas: 'MEJILLAS_MUJ',
    patillas: 'PATILLAS_MUJ',
    bozo: 'BOZO_MUJ',
    menton: 'MENTON_MUJ',
    submenton: 'SUBMENTON_MUJ',
    cuello: 'CUELLO_MUJ',
    nuca: 'NUCA_MUJ',
    escote: 'ESCOTE_MUJ',
    mamas: 'MAMAS_MUJ',
    pezones: 'PEZON_MUJ',
    hombros: 'HOMBROS_MUJ',
    axilas: 'AXI_MUJ',
    'brazos-completos': 'BRAZOS_MUJ',
    antebrazos: 'ANTEBR_MUJ',
    manos: 'MANOS_MUJ',
    'dedos-manos': 'DEDOS_MUJ',
    'abdomen-completo': 'ABDOMEN_MUJ',
    'linea-alba': 'LINEA_ALBA_MUJ',
    'espalda-completa': 'ESP_COMP_MUJ',
    'espalda-alta': 'ESP_ALTA_MUJ',
    'espalda-baja': 'ESP_BAJA_MUJ',
    'espalda-superior-hombros': 'ESP_SUP_HOMBROS_MUJ',
    'cavado-simple': 'CAV_SIMPL_MUJ',
    'cavado-completo': 'CAV_COMPL_MUJ',
    'cavado-completo-extendido': 'CAV_COMP_EXT_MUJ',
    'labios-genitales': 'LABIOS_MUJ',
    gluteos: 'GLUTEOS_MUJ',
    'tira-de-cola': 'TIRA_COLA_MUJ',
    cadera: 'CADERA_MUJ',
    'piernas-completas': 'PIERNAS_MUJ',
    'media-pierna-superior': 'MP_SUP_MUJ',
    'media-pierna-inferior': 'MP_INF_MUJ',
    empeine: 'EMPEINE_MUJ',
    pies: 'PIES_MUJ',
  },
  varon: {
    rostro: 'ROSTRO_COMP_HOM',
    cuello: 'CUELLO_HOM',
    barba: 'BARBA_HOM',
    bigote: 'BIGOTE_HOM',
    axilas: 'AXI_HOM',
    'cavado-masculino': 'CAVADO_HOM',
    'tira-de-cola': 'TIRA_HOM',
    gluteos: 'GLUTEOS_HOM',
    'piernas-completas': 'PIERNAS_HOM',
    'media-pierna-superior': 'MPS_HOM',
    'media-pierna-inferior': 'MP_HOM',
    'brazos-completos': 'BRAZOS_HOM',
    antebrazos: 'ANTEBR_HOM',
    'torax-completo': 'TORAX_HOM',
    pecho: 'PECHO_HOM',
    abdomen: 'ABDOMEN_HOM',
    'espalda-completa': 'ESP_COMP_HOM',
    'espalda-baja': 'ESP_BAJA_HOM',
    'espalda-alta': 'ESP_ALTA_HOM',
    'espalda-alta-hombros': 'ESP_ALTA_HOMBROS_HOM',
    'espalda-alta-nuca-cuello': 'ESP_ALTA_NUCA_CUELLO_HOM',
    hombros: 'HOMBROS_HOM',
    empeine: 'EMPEINE_HOM',
    dedos: 'DEDOS_HOM',
    manos: 'MANOS_HOM',
    nuca: 'NUCA_HOM',
    submenton: 'SUB_MENTON_HOM',
    frente: 'FRENTE_HOM',
    orejas: 'OREJAS_HOM',
    pomulos: 'POMULOS_HOM',
  },
}

export interface LaserPriceLine {
  /** Duration-engine zona key (as stored in the turno). */
  zone: string
  label: string
  /** List price for this zona, or null when the zona has no price counterpart. */
  price: number | null
}

export interface LaserPriceResult {
  /** Sum of the priced zonas at list value. */
  listTotal: number
  /** listTotal minus the cash discount (rounded to the peso). */
  efectivoTotal: number
  /** Cash discount fraction applied to the grand total (e.g. 0.5 = 50%). */
  efectivoDiscount: number
  /** One line per NORMALIZED zona actually charged (with its price or null). */
  lines: LaserPriceLine[]
  /** Normalized zonas that have no price counterpart (shown as "sin precio"). */
  unpriced: string[]
}

/**
 * Suggested total price for a láser turno, over the normalized zona set. Pure and
 * side-effect free. `priceConfig` is the cotizador láser config (DB or defaults);
 * `durationConfig` drives the SAME normalization used for the suggested duration,
 * so price and duration always count the same zonas. Returns an empty result (all
 * zeros) when no valid zona is selected — the caller keeps whatever total was set
 * manually.
 */
export function computeLaserPrice(
  sex: LaserSex,
  selected: readonly string[],
  durationConfig: LaserDurationConfig,
  priceConfig: LaserRulesJson,
): LaserPriceResult {
  const efectivoDiscount = priceConfig.efectivoDiscount ?? 0
  // Normalize exactly like the duration engine (replacements + inclusions), so a
  // zona contained in a larger one is not charged twice.
  const normalized = computeLaserDuration(sex, selected, durationConfig).normalizedZones
  if (normalized.length === 0) {
    return { listTotal: 0, efectivoTotal: 0, efectivoDiscount, lines: [], unpriced: [] }
  }
  const priceByKey = new Map(priceConfig.zones.map((z) => [z.key, z.pricePerSession]))
  const keyMap = LASER_PRICE_KEY_BY_ZONE[sex]
  // A label for each zona from the price catalog when available (fallback to key).
  const labelByPriceKey = new Map(priceConfig.zones.map((z) => [z.key, z.label]))

  const lines: LaserPriceLine[] = []
  const unpriced: string[] = []
  let listTotal = 0
  for (const zone of normalized) {
    const priceKey = keyMap[zone]
    const price = priceKey != null ? priceByKey.get(priceKey) ?? null : null
    if (price == null) unpriced.push(zone)
    else listTotal += price
    lines.push({
      zone,
      label: (priceKey != null ? labelByPriceKey.get(priceKey) : undefined) ?? zone,
      price,
    })
  }
  const efectivoTotal = Math.round(listTotal * (1 - efectivoDiscount))
  return { listTotal, efectivoTotal, efectivoDiscount, lines, unpriced }
}

/**
 * Load the cotizador láser price config from the DB, falling back to the generated
 * defaults (same pattern as fetchLaserDurationConfig). Never throws.
 */
export async function fetchLaserPriceConfig(): Promise<LaserRulesJson> {
  try {
    const { config } = await fetchQuotingConfig<LaserRulesConfig>('laser')
    if (config && Array.isArray(config.zones) && config.zones.length > 0) return config
  } catch {
    // fall through to defaults
  }
  return LASER_DEFAULT
}
