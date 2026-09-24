// Laser hair-removal INTERNAL turno-duration engine (Andrés' spec
// "Tiempos_depilacion_agenda_Etapa_2", 2026-09-24). Pure, no IO. A copy of this
// file lives in the bot (src/scheduling/laser-duration.ts) — keep the two in
// sync, like availability.ts.
//
// Given a sex ('mujer' | 'varon') and the zonas selected by click, it returns the
// minutes to block. Priority (never sum every zona's full time):
//   1. Normalize: dedupe + automatic replacements (equivalent selections become
//      their canonical zona, e.g. dos medias piernas → piernas completas).
//   2. Inclusions: a principal zona that already contains another removes the
//      contained one (it adds no time).
//   3. Fixed combination: if the normalized set matches an exact frequent
//      combination, use that fixed time.
//   4. Formula: otherwise, the longest zona's SOLA time + each other zona's
//      AGREGADA (incremental) time.
// The result is a SUGGESTION — Secretaría/Admin can edit it. Internal times are
// never shown to the patient.

export type LaserSex = 'mujer' | 'varon'

export interface ZoneTime {
  key: string
  label: string
  /** Minutes when this zona is done alone. */
  sola: number
  /** Incremental minutes when this zona accompanies a longer principal zona. */
  agregada: number
}

export interface LaserSexConfig {
  zones: ZoneTime[]
  /** principal already contains `includes` → those add no time when principal is present. */
  inclusions: { principal: string; includes: string[] }[]
  /** If every key in `from` is selected, replace them with the single `to` zona. */
  replacements: { from: string[]; to: string }[]
  /** Exact normalized set → fixed minutes (wins over the formula). */
  fixed: { zones: string[]; minutes: number }[]
}

export interface LaserDurationConfig {
  mujer: LaserSexConfig
  varon: LaserSexConfig
}

export interface LaserDurationResult {
  minutes: number
  method: 'fixed' | 'formula' | 'empty'
  /** The zonas that actually count after normalization + inclusions. */
  normalizedZones: string[]
  /** The principal (longest SOLA) zona, when the formula was used. */
  principal?: string
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

/**
 * Suggested minutes to block for a láser turno. Deterministic and side-effect
 * free. Returns 0 (method 'empty') when no valid zona is selected, so the caller
 * can keep whatever duration was set manually.
 */
export function computeLaserDuration(
  sex: LaserSex,
  selected: readonly string[],
  config: LaserDurationConfig,
): LaserDurationResult {
  const cfg = config[sex]
  const timeOf = new Map(cfg.zones.map((z) => [z.key, z]))
  // Only keep selections that are real zonas for this sex; dedupe.
  let set = new Set(selected.filter((k) => timeOf.has(k)))
  if (set.size === 0) return { minutes: 0, method: 'empty', normalizedZones: [] }

  // 1. Replacements (fixpoint: a replacement never re-introduces a `from`, so it
  //    terminates; the guard is just belt-and-braces).
  for (let i = 0; i < cfg.replacements.length + 2; i++) {
    let changed = false
    for (const r of cfg.replacements) {
      if (r.from.length > 0 && r.from.every((k) => set.has(k)) && timeOf.has(r.to)) {
        for (const k of r.from) set.delete(k)
        set.add(r.to)
        changed = true
      }
    }
    if (!changed) break
  }

  // 2. Inclusions: drop zonas already contained in a present principal.
  for (const inc of cfg.inclusions) {
    if (set.has(inc.principal)) for (const k of inc.includes) set.delete(k)
  }

  const normalizedZones = [...set].sort()

  // 3. Exact fixed combination.
  for (const f of cfg.fixed) {
    if (sameSet(f.zones, normalizedZones)) {
      return { minutes: f.minutes, method: 'fixed', normalizedZones }
    }
  }

  // 4. Formula: longest SOLA as principal + each other zona's AGREGADA.
  let principal = normalizedZones[0]!
  let principalSola = timeOf.get(principal)?.sola ?? 0
  for (const k of normalizedZones) {
    const s = timeOf.get(k)?.sola ?? 0
    if (s > principalSola) {
      principal = k
      principalSola = s
    }
  }
  let minutes = principalSola
  for (const k of normalizedZones) {
    if (k === principal) continue
    minutes += timeOf.get(k)?.agregada ?? 0
  }
  return { minutes, method: 'formula', normalizedZones, principal }
}

// ── Default tables, seeded verbatim from Andrés' PDF (2026-09-24). Configurable
//    from Administración later; these are the starting values. ──────────────────

const MUJER_ZONES: ZoneTime[] = [
  { key: 'rostro', label: 'Rostro', sola: 20, agregada: 15 },
  { key: 'medio-rostro', label: 'Medio rostro', sola: 15, agregada: 10 },
  { key: 'frente', label: 'Frente', sola: 10, agregada: 5 },
  { key: 'entrecejo', label: 'Entrecejo', sola: 10, agregada: 5 },
  { key: 'cejas', label: 'Cejas', sola: 10, agregada: 5 },
  { key: 'cejas-entrecejo', label: 'Cejas + entrecejo', sola: 10, agregada: 5 },
  { key: 'mejillas', label: 'Mejillas', sola: 10, agregada: 5 },
  { key: 'patillas', label: 'Patillas', sola: 10, agregada: 5 },
  { key: 'bozo', label: 'Bozo', sola: 10, agregada: 5 },
  { key: 'menton', label: 'Mentón', sola: 10, agregada: 5 },
  { key: 'submenton', label: 'Submentón', sola: 10, agregada: 5 },
  { key: 'cuello', label: 'Cuello', sola: 15, agregada: 10 },
  { key: 'nuca', label: 'Nuca', sola: 15, agregada: 10 },
  { key: 'escote', label: 'Escote', sola: 15, agregada: 10 },
  { key: 'mamas', label: 'Mamas', sola: 15, agregada: 10 },
  { key: 'pezones', label: 'Pezones', sola: 10, agregada: 5 },
  { key: 'hombros', label: 'Hombros', sola: 15, agregada: 10 },
  { key: 'axilas', label: 'Axilas', sola: 10, agregada: 5 },
  { key: 'brazos-completos', label: 'Brazos completos', sola: 25, agregada: 20 },
  { key: 'antebrazos', label: 'Antebrazos', sola: 20, agregada: 15 },
  { key: 'manos', label: 'Manos', sola: 10, agregada: 5 },
  { key: 'dedos-manos', label: 'Dedos de las manos', sola: 10, agregada: 5 },
  { key: 'abdomen-completo', label: 'Abdomen completo', sola: 20, agregada: 15 },
  { key: 'linea-alba', label: 'Línea alba', sola: 10, agregada: 5 },
  { key: 'espalda-completa', label: 'Espalda completa', sola: 30, agregada: 25 },
  { key: 'espalda-alta', label: 'Espalda alta', sola: 20, agregada: 15 },
  { key: 'espalda-baja', label: 'Espalda baja', sola: 15, agregada: 10 },
  { key: 'espalda-superior-hombros', label: 'Espalda superior + hombros', sola: 25, agregada: 20 },
  { key: 'cavado-simple', label: 'Cavado simple', sola: 10, agregada: 5 },
  { key: 'cavado-completo', label: 'Cavado completo', sola: 15, agregada: 10 },
  { key: 'cavado-completo-extendido', label: 'Cavado completo extendido', sola: 20, agregada: 10 },
  { key: 'labios-genitales', label: 'Labios genitales', sola: 10, agregada: 5 },
  { key: 'gluteos', label: 'Glúteos', sola: 20, agregada: 15 },
  { key: 'tira-de-cola', label: 'Tira de cola', sola: 10, agregada: 5 },
  { key: 'cadera', label: 'Cadera', sola: 15, agregada: 10 },
  { key: 'piernas-completas', label: 'Piernas completas', sola: 40, agregada: 35 },
  { key: 'media-pierna-superior', label: 'Media pierna superior · muslos', sola: 30, agregada: 25 },
  { key: 'media-pierna-inferior', label: 'Media pierna inferior', sola: 30, agregada: 25 },
  { key: 'empeine', label: 'Empeine', sola: 10, agregada: 5 },
  { key: 'pies', label: 'Pies', sola: 10, agregada: 5 },
]

const VARON_ZONES: ZoneTime[] = [
  { key: 'rostro', label: 'Rostro', sola: 25, agregada: 20 },
  { key: 'cuello', label: 'Cuello', sola: 15, agregada: 10 },
  { key: 'barba', label: 'Barba · candado y laterales', sola: 20, agregada: 15 },
  { key: 'bigote', label: 'Bigote', sola: 10, agregada: 5 },
  { key: 'axilas', label: 'Axilas', sola: 10, agregada: 5 },
  { key: 'cavado-masculino', label: 'Cavado completo masculino', sola: 20, agregada: 15 },
  { key: 'tira-de-cola', label: 'Tira de cola', sola: 10, agregada: 5 },
  { key: 'gluteos', label: 'Glúteos', sola: 25, agregada: 20 },
  { key: 'piernas-completas', label: 'Piernas completas', sola: 50, agregada: 45 },
  { key: 'media-pierna-superior', label: 'Media pierna superior', sola: 35, agregada: 30 },
  { key: 'media-pierna-inferior', label: 'Media pierna inferior', sola: 35, agregada: 30 },
  { key: 'brazos-completos', label: 'Brazos completos', sola: 35, agregada: 30 },
  { key: 'antebrazos', label: 'Antebrazos', sola: 25, agregada: 20 },
  { key: 'torax-completo', label: 'Tórax completo', sola: 40, agregada: 35 },
  { key: 'pecho', label: 'Pecho', sola: 25, agregada: 20 },
  { key: 'abdomen', label: 'Abdomen', sola: 25, agregada: 20 },
  { key: 'espalda-completa', label: 'Espalda completa', sola: 40, agregada: 35 },
  { key: 'espalda-baja', label: 'Espalda baja', sola: 20, agregada: 15 },
  { key: 'espalda-alta', label: 'Espalda alta', sola: 30, agregada: 25 },
  { key: 'espalda-alta-hombros', label: 'Espalda alta + hombros', sola: 35, agregada: 30 },
  { key: 'espalda-alta-nuca-cuello', label: 'Espalda alta + nuca + cuello', sola: 45, agregada: 40 },
  { key: 'hombros', label: 'Hombros', sola: 20, agregada: 15 },
  { key: 'empeine', label: 'Empeine', sola: 10, agregada: 5 },
  { key: 'dedos', label: 'Dedos', sola: 10, agregada: 5 },
  { key: 'manos', label: 'Manos', sola: 10, agregada: 5 },
  { key: 'nuca', label: 'Nuca', sola: 15, agregada: 10 },
  { key: 'submenton', label: 'Submentón', sola: 10, agregada: 5 },
  { key: 'frente', label: 'Frente', sola: 10, agregada: 5 },
  { key: 'orejas', label: 'Orejas', sola: 10, agregada: 5 },
  { key: 'pomulos', label: 'Pómulos', sola: 10, agregada: 5 },
]

export const defaultLaserDurationConfig: LaserDurationConfig = {
  mujer: {
    zones: MUJER_ZONES,
    inclusions: [
      { principal: 'rostro', includes: ['medio-rostro', 'frente', 'entrecejo', 'cejas', 'cejas-entrecejo', 'mejillas', 'patillas', 'bozo', 'menton', 'submenton'] },
      { principal: 'cejas-entrecejo', includes: ['cejas', 'entrecejo'] },
      { principal: 'mamas', includes: ['pezones'] },
      { principal: 'brazos-completos', includes: ['antebrazos'] },
      { principal: 'manos', includes: ['dedos-manos'] },
      { principal: 'abdomen-completo', includes: ['linea-alba'] },
      { principal: 'espalda-completa', includes: ['espalda-alta', 'espalda-baja'] },
      { principal: 'cavado-completo', includes: ['cavado-simple'] },
      { principal: 'cavado-completo-extendido', includes: ['cavado-completo', 'cavado-simple', 'labios-genitales'] },
      { principal: 'piernas-completas', includes: ['media-pierna-superior', 'media-pierna-inferior'] },
      { principal: 'pies', includes: ['empeine'] },
    ],
    replacements: [
      { from: ['media-pierna-superior', 'media-pierna-inferior'], to: 'piernas-completas' },
      { from: ['espalda-alta', 'espalda-baja'], to: 'espalda-completa' },
    ],
    fixed: [
      { zones: ['axilas', 'cavado-completo'], minutes: 20 },
      { zones: ['axilas', 'cavado-completo-extendido'], minutes: 25 },
      { zones: ['cavado-completo', 'tira-de-cola'], minutes: 20 },
      { zones: ['cavado-completo-extendido', 'tira-de-cola'], minutes: 25 },
      { zones: ['axilas', 'cavado-completo', 'tira-de-cola'], minutes: 25 },
      { zones: ['axilas', 'cavado-completo-extendido', 'tira-de-cola'], minutes: 30 },
      { zones: ['gluteos', 'tira-de-cola'], minutes: 25 },
      { zones: ['piernas-completas', 'axilas'], minutes: 45 },
      { zones: ['piernas-completas', 'cavado-completo'], minutes: 45 },
      { zones: ['piernas-completas', 'cavado-completo-extendido'], minutes: 45 },
      { zones: ['piernas-completas', 'axilas', 'cavado-completo'], minutes: 50 },
      { zones: ['piernas-completas', 'cavado-completo-extendido', 'tira-de-cola'], minutes: 50 },
    ],
  },
  varon: {
    zones: VARON_ZONES,
    inclusions: [
      { principal: 'rostro', includes: ['barba', 'bigote', 'pomulos', 'frente', 'submenton'] },
      { principal: 'barba', includes: ['bigote'] },
      { principal: 'torax-completo', includes: ['pecho', 'abdomen'] },
      { principal: 'brazos-completos', includes: ['antebrazos'] },
      { principal: 'manos', includes: ['dedos'] },
      { principal: 'espalda-completa', includes: ['espalda-alta', 'espalda-baja'] },
      { principal: 'espalda-alta-hombros', includes: ['espalda-alta', 'hombros'] },
      { principal: 'espalda-alta-nuca-cuello', includes: ['espalda-alta', 'nuca', 'cuello'] },
      { principal: 'piernas-completas', includes: ['media-pierna-superior', 'media-pierna-inferior'] },
    ],
    replacements: [
      { from: ['pecho', 'abdomen'], to: 'torax-completo' },
      { from: ['media-pierna-superior', 'media-pierna-inferior'], to: 'piernas-completas' },
      { from: ['espalda-alta', 'espalda-baja'], to: 'espalda-completa' },
    ],
    fixed: [
      { zones: ['espalda-alta', 'hombros'], minutes: 35 },
      { zones: ['espalda-alta', 'nuca', 'cuello'], minutes: 45 },
      { zones: ['rostro', 'cuello'], minutes: 30 },
      { zones: ['barba', 'cuello'], minutes: 25 },
      { zones: ['axilas', 'cavado-masculino'], minutes: 25 },
      { zones: ['cavado-masculino', 'tira-de-cola'], minutes: 25 },
      { zones: ['cavado-masculino', 'gluteos'], minutes: 35 },
      { zones: ['cavado-masculino', 'gluteos', 'tira-de-cola'], minutes: 40 },
      { zones: ['gluteos', 'tira-de-cola'], minutes: 30 },
      { zones: ['piernas-completas', 'axilas'], minutes: 55 },
      { zones: ['piernas-completas', 'cavado-masculino'], minutes: 50 },
      { zones: ['piernas-completas', 'cavado-masculino', 'tira-de-cola'], minutes: 55 },
      { zones: ['piernas-completas', 'axilas', 'cavado-masculino'], minutes: 55 },
      { zones: ['torax-completo', 'axilas'], minutes: 45 },
      { zones: ['espalda-completa', 'hombros'], minutes: 45 },
      { zones: ['torax-completo', 'espalda-completa'], minutes: 60 },
    ],
  },
}
