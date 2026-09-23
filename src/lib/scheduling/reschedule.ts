// Reschedule logic (Andrés punto 19): pure helpers to (1) compute the sucursales
// a professional has COMPATIBLE availability on a date for a treatment, (2) list
// the free start times of a given duration on a date, and (3) validate a single
// move against every rule. Shared by the contextual reschedule calendar and, later,
// the drag-and-drop drops — so both apply exactly the same checks.

import {
  availabilityFor,
  type AvailabilityRule,
  type AvailabilityExclusion,
} from './availability'
import { resolveLunch, type LunchConfig, type LunchOverride } from '@/lib/data/lunch'
import {
  professionalDoesTreatment,
  type ProfessionalTreatments,
} from '@/lib/data/professional-treatments'

export type RescheduleEvent = {
  id: string
  professionalId: string | null
  sucursal: string | null
  start: Date
  end: Date
  status: string
}

export type RescheduleCtx = {
  rules: readonly AvailabilityRule[]
  exclusions: readonly AvailabilityExclusion[]
  lunchConfig: readonly LunchConfig[]
  lunchOverrides: readonly LunchOverride[]
  profTreatments: Map<string, ProfessionalTreatments>
  isSucursalClosed: (dateStr: string, sucursal: string) => boolean
  isHoliday?: (dateStr: string) => boolean
  events: readonly RescheduleEvent[]
}

function minOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10))
  return (h || 0) * 60 + (m || 0)
}

/** Busy intervals [startMin,endMin) that day for this professional (or, when no
 *  professional, this sucursal), excluding `excludeId` and cancelled turnos. */
function busyIntervals(
  dateStr: string,
  sucursal: string,
  professionalId: string | undefined,
  excludeId: string | null,
  ctx: RescheduleCtx,
): [number, number][] {
  const out: [number, number][] = []
  for (const e of ctx.events) {
    if (e.id === excludeId || e.status === 'cancelado') continue
    if (toDateStr(e.start) !== dateStr) continue
    const sameResource = professionalId ? e.professionalId === professionalId : e.sucursal === sucursal
    if (!sameResource) continue
    out.push([minOfDay(e.start), minOfDay(e.end)])
  }
  return out
}

function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && aE > bS
}

/** Does the professional perform this treatment (capability config)? */
export function performsTreatment(
  professionalId: string | undefined,
  treatmentSlug: string,
  ctx: RescheduleCtx,
): boolean {
  if (!professionalId || !treatmentSlug) return true
  return professionalDoesTreatment(ctx.profTreatments.get(professionalId), treatmentSlug)
}

/** Sucursales (from `sucursales`) where this professional has compatible programmed
 *  availability for this treatment on the date — respecting requireOwnRule, the #11
 *  replacement (inside availabilityFor), branch closures and treatment capability. */
export function compatibleSucursalesOn(
  dateStr: string,
  professionalId: string | undefined,
  treatmentSlug: string,
  sucursales: readonly string[],
  ctx: RescheduleCtx,
): string[] {
  if (!performsTreatment(professionalId, treatmentSlug, ctx)) return []
  return sucursales.filter(
    (suc) =>
      !ctx.isSucursalClosed(dateStr, suc) &&
      availabilityFor(dateStr, suc, treatmentSlug, ctx.rules, ctx.exclusions, professionalId, ctx.isHoliday, !!professionalId)
        .open,
  )
}

/** Free start times (HH:MM) on the date, in `sucursal`, for a turno of `durationMin`
 *  minutes: inside the availability window, not over lunch, not overlapping the
 *  professional's other turnos. `step` is the granularity. */
export function availableStartTimes(
  dateStr: string,
  sucursal: string,
  professionalId: string | undefined,
  treatmentSlug: string,
  durationMin: number,
  excludeId: string | null,
  ctx: RescheduleCtx,
  step = 15,
): string[] {
  if (ctx.isSucursalClosed(dateStr, sucursal)) return []
  const win = availabilityFor(
    dateStr,
    sucursal,
    treatmentSlug,
    ctx.rules,
    ctx.exclusions,
    professionalId,
    ctx.isHoliday,
    !!professionalId,
  )
  if (!win.open || win.openMin == null || win.closeMin == null) return []
  const lunch = resolveLunch(sucursal, professionalId ?? null, dateStr, ctx.lunchConfig, ctx.lunchOverrides)
  const busy = busyIntervals(dateStr, sucursal, professionalId, excludeId, ctx)
  const dur = Math.max(5, durationMin)
  const out: string[] = []
  for (let t = win.openMin; t + dur <= win.closeMin; t += step) {
    const end = t + dur
    if (lunch && overlaps(t, end, lunch.startMin, lunch.endMin)) continue
    if (busy.some(([bs, be]) => overlaps(t, end, bs, be))) continue
    out.push(minToHHMM(t))
  }
  return out
}

export type MoveCheck = {
  ok: boolean
  performsTreatment: boolean
  hasAvailability: boolean // programmed availability for prof+suc+date
  fitsWindow: boolean // the full duration fits before closing
  lunchConflict: boolean
  overlap: { name: string; range: string } | null
}

/** Validate a concrete move (drag drop or a chosen slot). Pure. The caller turns
 *  the flags into role-gated messages. `patientNameOf` names an overlapping turno. */
export function validateMove(
  target: {
    dateStr: string
    startMin: number
    durationMin: number
    sucursal: string
    professionalId: string | undefined
    treatmentSlug: string
    excludeId: string | null
  },
  ctx: RescheduleCtx,
  patientNameOf?: (ev: RescheduleEvent) => string,
): MoveCheck {
  const endMin = target.startMin + Math.max(5, target.durationMin)
  const performs = performsTreatment(target.professionalId, target.treatmentSlug, ctx)
  const win = availabilityFor(
    target.dateStr,
    target.sucursal,
    target.treatmentSlug,
    ctx.rules,
    ctx.exclusions,
    target.professionalId,
    ctx.isHoliday,
    !!target.professionalId,
  )
  const hasAvailability = win.open && !ctx.isSucursalClosed(target.dateStr, target.sucursal)
  const fitsWindow = hasAvailability && win.closeMin != null && endMin <= win.closeMin && win.openMin != null && target.startMin >= win.openMin
  const lunch = resolveLunch(
    target.sucursal,
    target.professionalId ?? null,
    target.dateStr,
    ctx.lunchConfig,
    ctx.lunchOverrides,
  )
  const lunchConflict = !!lunch && overlaps(target.startMin, endMin, lunch.startMin, lunch.endMin)
  let overlap: MoveCheck['overlap'] = null
  for (const e of ctx.events) {
    if (e.id === target.excludeId || e.status === 'cancelado') continue
    if (toDateStr(e.start) !== target.dateStr) continue
    const sameResource = target.professionalId
      ? e.professionalId === target.professionalId
      : e.sucursal === target.sucursal
    if (!sameResource) continue
    if (overlaps(target.startMin, endMin, minOfDay(e.start), minOfDay(e.end))) {
      overlap = {
        name: patientNameOf ? patientNameOf(e) : '',
        range: `${minToHHMM(minOfDay(e.start))} a ${minToHHMM(minOfDay(e.end))}`,
      }
      break
    }
  }
  const ok = performs && hasAvailability && fitsWindow && !lunchConflict && !overlap
  return { ok, performsTreatment: performs, hasAvailability, fitsWindow, lunchConflict, overlap }
}
