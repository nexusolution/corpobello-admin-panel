// Panel-side turno duration rule (Andrés 2026-09-07). Mirrors the bot's
// scheduling model (src/scheduling/duration.ts) so a turno created MANUALLY in
// the agenda auto-blocks the right amount of time, editable afterwards.
//
//   · Todos los tratamientos salvo depilación láser: turno habitual 15 min,
//     primera sesión 20 min.
//   · Depilación láser: tiempo fijo de sesión (una sola vez) + tiempo por zona.
//     Las zonas no se seleccionan en la carga manual todavía, así que acá se
//     usa el tiempo base como punto de partida (editable). Los minutos de láser
//     son PLACEHOLDER hasta que Andrés pase la tabla real por zona.

export interface DurationRule {
  // Non-láser habitual turn length.
  standardMinutes: number
  // Extra minutes added on a patient's first session (charla/explicación).
  firstSessionExtraMinutes: number
  // Láser fixed session overhead, counted once (ingreso, camilla, vestirse…).
  // PLACEHOLDER pending Andrés' real table.
  laserBaseMinutes: number
  // Láser first-session extra. PLACEHOLDER.
  laserFirstSessionExtraMinutes: number
}

export const defaultDurationRule: DurationRule = {
  standardMinutes: 15,
  firstSessionExtraMinutes: 5, // 15 → 20 en la primera sesión
  laserBaseMinutes: 20, // PLACEHOLDER (base sin zonas)
  laserFirstSessionExtraMinutes: 10, // PLACEHOLDER
}

// Same heuristic the bot uses: depilación / láser slugs run the base+zona model.
export function isLaserSlug(slug: string): boolean {
  return /laser|láser|depilacion|depilación/.test(slug.toLowerCase())
}

// Suggested minutes to block for a turno of `slug`. `firstSession` bumps the
// duration for the explanatory first visit. Returns 0 for an empty slug so the
// caller can leave the manually-set duration untouched.
export function suggestDurationMinutes(
  slug: string,
  firstSession: boolean,
  rule: DurationRule = defaultDurationRule,
): number {
  if (!slug) return 0
  if (isLaserSlug(slug)) {
    return rule.laserBaseMinutes + (firstSession ? rule.laserFirstSessionExtraMinutes : 0)
  }
  return rule.standardMinutes + (firstSession ? rule.firstSessionExtraMinutes : 0)
}
