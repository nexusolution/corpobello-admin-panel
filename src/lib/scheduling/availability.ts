// Availability engine — a copy of the bot's src/scheduling/availability.ts (the
// two repos can't share code). Keep them in sync. Given a date + sucursal +
// treatment + the rule set, it answers "is it open, and in what window". Pure;
// no IO. Dates are 'YYYY-MM-DD' branch-local day strings; times are
// minutes-from-midnight, branch-local.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday … 6 = Saturday

export type DayPattern =
  | { type: 'weekly'; weekdays: Weekday[] }
  | { type: 'monthly_ordinal'; days: { weekday: Weekday; ordinal: number }[] }
  | { type: 'alternating'; anchorMonday: string; groups: Weekday[][] }
  // Cycle anchored on the Nth weekday of the month (Caballito: 2nd Monday), whose
  // entries run in successive weeks and may spill into the following month — the
  // spilled dates still belong to the anchoring month's cycle (Andrés 2026-09-17).
  // ordinal defaults to 2, anchorWeekday to 1 (Monday). Each entry = a date at
  // `weekOffset` weeks after the anchor's week, on `weekday`.
  | {
      type: 'monthly_cycle'
      ordinal?: number
      anchorWeekday?: Weekday
      entries: { weekOffset: number; weekday: Weekday }[]
    }

export interface AvailabilityRule {
  id: string
  sucursal: string
  // Professional/operator this rule is for. null/undefined = any (generic).
  professionalId?: string | null
  treatmentSlugs: string[]
  treatmentExclude?: string[]
  pattern: DayPattern
  openMin: number
  closeMin: number
  active: boolean
  label?: string
}

export interface AvailabilityExclusion {
  id: string
  sucursal: string
  treatmentSlugs: string[] // treatments BLOCKED; empty = all
  triggerSlugs?: string[] // activity elsewhere that triggers the block; default = same slug
  whenActiveIn: string[]
  active: boolean
  label?: string
}

export interface AvailabilityWindow {
  open: boolean
  openMin?: number
  closeMin?: number
}

function dayOf(dateStr: string): { day: number; weekday: Weekday } {
  const dt = new Date(`${dateStr}T12:00:00.000Z`)
  return { day: dt.getUTCDate(), weekday: dt.getUTCDay() as Weekday }
}

function ordinalInMonth(day: number): number {
  return Math.floor((day - 1) / 7) + 1
}

function isLastWeekdayOfMonth(dateStr: string): boolean {
  const dt = new Date(`${dateStr}T12:00:00.000Z`)
  const month = dt.getUTCMonth()
  dt.setUTCDate(dt.getUTCDate() + 7)
  return dt.getUTCMonth() !== month
}

function mondayOf(dateStr: string): Date {
  const dt = new Date(`${dateStr}T12:00:00.000Z`)
  const wd = dt.getUTCDay()
  const diff = wd === 0 ? -6 : 1 - wd
  dt.setUTCDate(dt.getUTCDate() + diff)
  return dt
}

// The date of the `ordinal`-th `weekday` of a given month (e.g. 2nd Monday).
function nthWeekdayOfMonth(year: number, month0: number, weekday: Weekday, ordinal: number): Date {
  const first = new Date(Date.UTC(year, month0, 1, 12))
  const offset = (weekday - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month0, 1 + offset + (ordinal - 1) * 7, 12))
}

/** Does `dateStr` fall on a day this pattern covers? `isHoliday` (sucursal-scoped)
 *  enables the monthly_cycle feriado exception: if the anchor (2nd Monday) is a
 *  holiday, only the anchor-Monday entry shifts to the previous ordinal (1st
 *  Monday); every other entry still computes from the original anchor (Andrés #10). */
export function matchesPattern(
  dateStr: string,
  pattern: DayPattern,
  isHoliday?: (dateStr: string) => boolean,
): boolean {
  const { day, weekday } = dayOf(dateStr)
  switch (pattern.type) {
    case 'weekly':
      return pattern.weekdays.includes(weekday)
    case 'monthly_ordinal':
      return pattern.days.some((o) => {
        if (o.weekday !== weekday) return false
        return o.ordinal === -1 ? isLastWeekdayOfMonth(dateStr) : ordinalInMonth(day) === o.ordinal
      })
    case 'alternating': {
      const groups = pattern.groups
      if (groups.length === 0) return false
      const anchor = mondayOf(pattern.anchorMonday)
      const wkMonday = mondayOf(dateStr)
      const weeks = Math.round((wkMonday.getTime() - anchor.getTime()) / (7 * 86_400_000))
      const idx = ((weeks % groups.length) + groups.length) % groups.length
      return (groups[idx] ?? []).includes(weekday)
    }
    case 'monthly_cycle': {
      if (!pattern.entries || pattern.entries.length === 0) return false
      const ord = pattern.ordinal ?? 2
      const aw = pattern.anchorWeekday ?? 1
      const dt = new Date(`${dateStr}T12:00:00.000Z`)
      const y = dt.getUTCFullYear()
      const m = dt.getUTCMonth()
      // The date can belong to THIS month's cycle or the PREVIOUS month's cycle
      // (entries with a larger weekOffset spill into the next month).
      const candidates: [number, number][] = [
        [y, m],
        m === 0 ? [y - 1, 11] : [y, m - 1],
      ]
      for (const [cy, cm] of candidates) {
        const anchor = nthWeekdayOfMonth(cy, cm, aw, ord)
        // Feriado exception: if the anchor (e.g. 2nd Monday) is a holiday, the
        // anchor-Monday jornada moves to the previous ordinal (1st Monday). Only
        // that entry shifts; the rest still compute from the original anchor.
        const anchorIsHoliday =
          !!isHoliday && ord > 1 && isHoliday(anchor.toISOString().slice(0, 10))
        for (const e of pattern.entries) {
          const shift = anchorIsHoliday && e.weekOffset === 0 && e.weekday === aw
          const base = shift ? nthWeekdayOfMonth(cy, cm, aw, ord - 1) : anchor
          const dayFromMonday = (e.weekday + 6) % 7 // Mon=0 … Sun=6 (anchor is a Monday)
          const target = new Date(base.getTime())
          target.setUTCDate(base.getUTCDate() + (shift ? 0 : e.weekOffset * 7 + dayFromMonday))
          if (
            target.getUTCFullYear() === dt.getUTCFullYear() &&
            target.getUTCMonth() === dt.getUTCMonth() &&
            target.getUTCDate() === dt.getUTCDate()
          )
            return true
        }
      }
      return false
    }
    default:
      return false
  }
}

// When `professionalId` is given, only that professional's rules plus generic
// (null-professional) rules match; when omitted, any professional's rules match.
function ruleApplies(
  rule: AvailabilityRule,
  sucursal: string,
  slug: string,
  professionalId?: string,
): boolean {
  if (!rule.active || rule.sucursal !== sucursal) return false
  if (rule.treatmentSlugs.length > 0 && !rule.treatmentSlugs.includes(slug)) return false
  if (rule.treatmentExclude && rule.treatmentExclude.includes(slug)) return false
  if (professionalId && rule.professionalId != null && rule.professionalId !== professionalId) {
    return false
  }
  return true
}

export function openWindowsFor(
  dateStr: string,
  sucursal: string,
  slug: string,
  rules: readonly AvailabilityRule[],
  professionalId?: string,
  isHoliday?: (dateStr: string) => boolean,
): { openMin: number; closeMin: number }[] {
  return rules
    .filter(
      (r) => ruleApplies(r, sucursal, slug, professionalId) && matchesPattern(dateStr, r.pattern, isHoliday),
    )
    .map((r) => ({ openMin: r.openMin, closeMin: r.closeMin }))
}

export function isTreatmentActive(
  dateStr: string,
  sucursal: string,
  slug: string,
  rules: readonly AvailabilityRule[],
  professionalId?: string,
  isHoliday?: (dateStr: string) => boolean,
): boolean {
  return openWindowsFor(dateStr, sucursal, slug, rules, professionalId, isHoliday).length > 0
}

/** Distinct professional ids (non-generic) scheduled for a treatment that day. */
export function professionalsFor(
  dateStr: string,
  sucursal: string,
  slug: string,
  rules: readonly AvailabilityRule[],
  isHoliday?: (dateStr: string) => boolean,
): string[] {
  const set = new Set<string>()
  for (const r of rules) {
    if (ruleApplies(r, sucursal, slug) && matchesPattern(dateStr, r.pattern, isHoliday) && r.professionalId) {
      set.add(r.professionalId)
    }
  }
  return [...set]
}

/** Full availability for one treatment on one date, after exclusions. */
export function availabilityFor(
  dateStr: string,
  sucursal: string,
  slug: string,
  rules: readonly AvailabilityRule[],
  exclusions: readonly AvailabilityExclusion[] = [],
  professionalId?: string,
  isHoliday?: (dateStr: string) => boolean,
): AvailabilityWindow {
  const windows = openWindowsFor(dateStr, sucursal, slug, rules, professionalId, isHoliday)
  if (windows.length === 0) return { open: false }

  for (const ex of exclusions) {
    if (!ex.active || ex.sucursal !== sucursal) continue
    if (ex.treatmentSlugs.length > 0 && !ex.treatmentSlugs.includes(slug)) continue
    const triggers =
      ex.triggerSlugs && ex.triggerSlugs.length > 0
        ? ex.triggerSlugs
        : ex.treatmentSlugs.length > 0
          ? ex.treatmentSlugs
          : [slug]
    const blockedElsewhere = ex.whenActiveIn.some((other) =>
      triggers.some((ts) => isTreatmentActive(dateStr, other, ts, rules)),
    )
    if (blockedElsewhere) return { open: false }
  }

  const openMin = Math.min(...windows.map((w) => w.openMin))
  const closeMin = Math.max(...windows.map((w) => w.closeMin))
  return { open: true, openMin, closeMin }
}

/**
 * Union across a set of treatments (panel-only helper): the sucursal is "open"
 * on the date if ANY of `slugs` is open; the window is the widest of those. Used
 * for calendar shading when no single treatment is in focus. With an empty slug
 * list it reports open with no window (so shading never hides an all-branch view
 * when the catalog hasn't loaded yet).
 */
export function anyTreatmentAvailability(
  dateStr: string,
  sucursal: string,
  slugs: readonly string[],
  rules: readonly AvailabilityRule[],
  exclusions: readonly AvailabilityExclusion[] = [],
): AvailabilityWindow {
  if (slugs.length === 0) return { open: true }
  let openMin = Number.POSITIVE_INFINITY
  let closeMin = Number.NEGATIVE_INFINITY
  let open = false
  for (const slug of slugs) {
    const w = availabilityFor(dateStr, sucursal, slug, rules, exclusions)
    if (w.open) {
      open = true
      openMin = Math.min(openMin, w.openMin ?? openMin)
      closeMin = Math.max(closeMin, w.closeMin ?? closeMin)
    }
  }
  return open ? { open: true, openMin, closeMin } : { open: false }
}
