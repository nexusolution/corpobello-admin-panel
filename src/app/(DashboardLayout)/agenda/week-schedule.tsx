'use client'

// Week view = a Monday–Saturday grid (Andrés 2026-09-16 wireframe). Columns are
// the 6 days; each day is subdivided into LANES = the professionals working that
// day (so simultaneous turnos sit side by side). Rows are the hours (08:00–20:00,
// widened to fit). A 13:00–14:00 ALMUERZO band spans each day. Cards are compact:
// treatment-colour bar, patient (black, bold), treatment (colour), prof · sucursal.
// Clicking a turno opens it; clicking an empty lane creates one pre-filled.

import type { ReactNode } from 'react'
import type { CalendarEvent } from '@/lib/data/calendar-events'
import type { DayColumn } from './day-schedule'

interface WeekScheduleProps {
  days: Date[]
  columnsForDay: (day: Date) => DayColumn[]
  resourceIdFor: (e: CalendarEvent, colIds: Set<string>) => string
  turnos: CalendarEvent[]
  onOpenTurno: (e: CalendarEvent) => void
  onCreate: (start: Date, end: Date, sucursal?: string, professionalId?: string) => void
  treatmentColor: (slug: string | null | undefined, name?: string) => string
  treatmentName: (slug?: string | null) => string
  cardBg: (status: string) => string
  sucursalLabel: (s: string) => string
  sucursalColor: (s: string) => string
  professionalName: (id?: string | null) => string
  locale: string
  lunchLabel: string
  newLabel: string
}

const LUNCH_HOUR = 13
// Solid green cobro block on the right of a charged turno (matches the Day view).
const PAY_GREEN = '#16a34a'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
// ~15% tint of a #rrggbb colour (8-digit hex alpha).
function tintHex(hex: string): string {
  return `${hex}26`
}

export function WeekSchedule({
  days,
  columnsForDay,
  resourceIdFor,
  turnos,
  onOpenTurno,
  onCreate,
  treatmentColor,
  treatmentName,
  cardBg,
  sucursalLabel,
  sucursalColor,
  professionalName,
  locale,
  lunchLabel,
  newLabel,
}: WeekScheduleProps) {
  // Per-day columns (lanes) + flat lane list with grid positions.
  const dayData = days.map((day) => {
    const cols = columnsForDay(day)
    return { day, ds: toKey(day), cols, colIds: new Set(cols.map((c) => c.resourceId)) }
  })

  type Lane = { ds: string; day: Date; col: DayColumn; gridCol: number }
  const lanes: Lane[] = []
  const headers: { day: Date; ds: string; startCol: number; span: number; cols: DayColumn[] }[] = []
  let cursor = 2 // column 1 is the time gutter
  for (const d of dayData) {
    const startCol = cursor
    for (const col of d.cols) {
      lanes.push({ ds: d.ds, day: d.day, col, gridCol: cursor })
      cursor += 1
    }
    headers.push({ day: d.day, ds: d.ds, startCol, span: d.cols.length, cols: d.cols })
  }
  const laneCount = cursor - 2

  // Hour rows: 08–20 by default, widened to include turnos outside that band.
  let startH = 8
  let endH = 20
  for (const e of turnos) {
    const h = e.start.getHours()
    if (h < startH) startH = h
    if (h > endH) endH = h
  }
  const hours: number[] = []
  for (let h = startH; h <= endH; h++) hours.push(h)
  const rowOf = (h: number) => 2 + hours.indexOf(h)

  // Bucket turnos: dayKey -> resourceId -> hour -> events.
  const buckets = new Map<string, Map<string, Map<number, CalendarEvent[]>>>()
  const lunchTurnos = new Set<string>() // dayKeys that have a turno during lunch
  for (const d of dayData) buckets.set(d.ds, new Map())
  for (const e of turnos) {
    const ds = toKey(e.start)
    const dayBucket = buckets.get(ds)
    if (!dayBucket) continue
    const day = dayData.find((x) => x.ds === ds)
    if (!day) continue
    const rid = resourceIdFor(e, day.colIds)
    const h = e.start.getHours()
    if (h === LUNCH_HOUR) lunchTurnos.add(ds)
    let byRes = dayBucket.get(rid)
    if (!byRes) {
      byRes = new Map()
      dayBucket.set(rid, byRes)
    }
    const arr = byRes.get(h)
    if (arr) arr.push(e)
    else byRes.set(h, [e])
  }

  const dateAtHour = (day: Date, h: number) => {
    const d = new Date(day)
    d.setHours(h, 0, 0, 0)
    return d
  }
  const dayTitle = (day: Date) => {
    const raw = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })
      .format(day)
      .replace(',', '')
      .replace('.', '')
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  const daySubtitle = (cols: DayColumn[]) => {
    const sucSet: string[] = []
    for (const c of cols) if (c.sucursal && !sucSet.includes(c.sucursal)) sucSet.push(c.sucursal)
    const profCount = cols.filter((c) => c.resourceId.startsWith('sp:')).length || cols.length
    const sucText = sucSet.map(sucursalLabel).join(' + ')
    return {
      text: `${sucText} (${profCount} ${profCount === 1 ? 'profesional' : 'profesionales'})`,
      sucursales: sucSet,
    }
  }

  const cells: ReactNode[] = []

  // Corner + day headers.
  cells.push(
    <div
      key='corner'
      className='sticky top-0 z-10 bg-card border-b border-r border-border dark:border-darkborder'
      style={{ gridColumn: 1, gridRow: 1 }}
    />,
  )
  for (const hd of headers) {
    const sub = daySubtitle(hd.cols)
    // Tint the header with the day's sucursal colour(s) — a solid light tint for
    // one sede, a split gradient for several (Andrés 2026-09-16).
    const dayBg =
      sub.sucursales.length === 0
        ? undefined
        : sub.sucursales.length === 1
          ? tintHex(sucursalColor(sub.sucursales[0]))
          : `linear-gradient(135deg, ${sub.sucursales
              .map((s, i) => {
                const from = Math.round((i * 100) / sub.sucursales.length)
                const to = Math.round(((i + 1) * 100) / sub.sucursales.length)
                return `${tintHex(sucursalColor(s))} ${from}% ${to}%`
              })
              .join(', ')})`
    cells.push(
      <div
        key={`h-${hd.ds}`}
        className='sticky top-0 z-10 text-center px-1 py-2 border-b border-l border-border dark:border-darkborder'
        style={{
          gridColumn: `${hd.startCol} / span ${Math.max(1, hd.span)}`,
          gridRow: 1,
          background: dayBg,
        }}>
        <div className='text-sm font-bold text-dark dark:text-white capitalize'>{dayTitle(hd.day)}</div>
        <div className='text-[11px] text-link dark:text-darklink leading-tight'>{sub.text}</div>
        {sub.sucursales.length >= 2 && (
          <div className='mt-0.5 flex items-center justify-center gap-2 flex-wrap'>
            {sub.sucursales.map((s) => (
              <span key={s} className='inline-flex items-center gap-1 text-[10px] text-link dark:text-darklink'>
                <span className='h-2 w-2 rounded-full' style={{ backgroundColor: sucursalColor(s) }} />
                {sucursalLabel(s)}
              </span>
            ))}
          </div>
        )}
      </div>,
    )
  }

  // Time gutter labels.
  for (const h of hours) {
    cells.push(
      <div
        key={`t-${h}`}
        className='text-right pr-2 pt-1 text-[11px] text-link dark:text-darklink border-b border-border/60 dark:border-darkborder/60 whitespace-nowrap'
        style={{ gridColumn: 1, gridRow: rowOf(h) }}>
        <div className='font-medium'>{pad2(h)}:00</div>
        <div className='opacity-60'>{pad2(h)}:30</div>
      </div>,
    )
  }

  // Body cells.
  for (const h of hours) {
    for (const hd of headers) {
      const dayBucket = buckets.get(hd.ds)
      const isLunch = h === LUNCH_HOUR && !lunchTurnos.has(hd.ds)
      if (isLunch) {
        // One ALMUERZO band spanning the whole day's lanes.
        cells.push(
          <div
            key={`lunch-${hd.ds}`}
            className='p-1 border-b border-l border-border/60 dark:border-darkborder/60'
            style={{ gridColumn: `${hd.startCol} / span ${Math.max(1, hd.span)}`, gridRow: rowOf(h) }}>
            <div className='h-full rounded-md bg-gray-100 dark:bg-white/5 text-link dark:text-darklink text-[10px] font-medium uppercase tracking-wide flex items-center justify-center py-2'>
              {lunchLabel}
            </div>
          </div>,
        )
        continue
      }
      // Otherwise one cell per lane.
      hd.cols.forEach((col, li) => {
        const lane = lanes.find((l) => l.ds === hd.ds && l.col.resourceId === col.resourceId)
        const gridCol = lane ? lane.gridCol : hd.startCol + li
        const list = (dayBucket?.get(col.resourceId)?.get(h) ?? []).slice()
        list.sort((a, b) => a.start.getTime() - b.start.getTime())
        cells.push(
          <div
            key={`c-${hd.ds}-${col.resourceId}-${h}`}
            className={`p-1 border-b border-border/60 dark:border-darkborder/60 ${
              li === 0 ? 'border-l border-border dark:border-darkborder' : 'border-l border-border/40 dark:border-darkborder/40'
            }`}
            style={{ gridColumn: gridCol, gridRow: rowOf(h) }}>
            {list.length > 0 ? (
              list.map((e) => {
                const tc = treatmentColor(e.treatmentSlug, treatmentName(e.treatmentSlug))
                const prof = professionalName(e.professionalId)
                const suc = e.sucursal ? sucursalLabel(e.sucursal) : ''
                const meta = [prof, suc].filter(Boolean).join(' · ')
                return (
                  <button
                    key={e.id}
                    type='button'
                    onClick={() => onOpenTurno(e)}
                    className='flex items-stretch w-full text-left rounded-lg mb-1.5 last:mb-0 overflow-hidden shadow-sm hover:shadow-md hover:brightness-[0.98] transition'
                    style={{ backgroundColor: cardBg(e.status) }}>
                    {/* Treatment-colour bar (thick), same as the Day view. */}
                    <span className='shrink-0 self-stretch' style={{ width: 8, backgroundColor: tc }} />
                    <span className='flex-1 min-w-0 py-1.5 px-2'>
                      <span className='flex items-baseline justify-between gap-1.5'>
                        <span className='font-bold text-[12px] leading-tight text-black truncate'>
                          {e.patientName || e.title}
                        </span>
                        <span className='shrink-0 text-[10px] font-semibold text-black whitespace-nowrap'>
                          {fmtTime(e.start)} · {fmtTime(e.end)}
                        </span>
                      </span>
                      {e.treatmentSlug && (
                        <span className='block text-[11px] leading-tight truncate mt-0.5 text-black'>
                          {treatmentName(e.treatmentSlug)}
                        </span>
                      )}
                      {meta && (
                        <span className='block text-[10px] leading-tight truncate text-gray-500 mt-0.5'>
                          {meta}
                        </span>
                      )}
                    </span>
                    {/* Cobro block: solid green, flush to the edge (Day-view style). */}
                    {e.charged && (
                      <span
                        className='shrink-0 self-stretch flex items-center justify-center text-white font-bold text-sm'
                        style={{ width: 26, backgroundColor: PAY_GREEN }}
                        title='$'>
                        $
                      </span>
                    )}
                  </button>
                )
              })
            ) : (
              <button
                type='button'
                onClick={() => {
                  const start = dateAtHour(hd.day, h)
                  const end = new Date(start.getTime() + 30 * 60000)
                  const sucursal = col.sucursal || undefined
                  const professionalId = col.resourceId.startsWith('sp:')
                    ? col.resourceId.slice(col.resourceId.indexOf(':', 3) + 1)
                    : undefined
                  onCreate(start, end, sucursal, professionalId)
                }}
                aria-label={newLabel}
                className='w-full h-full min-h-[52px] rounded-md hover:bg-primary/5 transition-colors'
              />
            )}
          </div>,
        )
      })
    }
  }

  const gridTemplateColumns = `56px repeat(${Math.max(1, laneCount)}, minmax(120px, 1fr))`
  const gridTemplateRows = `auto repeat(${hours.length}, minmax(56px, auto))`
  const minWidth = 56 + Math.max(1, laneCount) * 120

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card overflow-x-auto'>
      <div className='grid' style={{ gridTemplateColumns, gridTemplateRows, minWidth }}>
        {cells}
      </div>
    </div>
  )
}
