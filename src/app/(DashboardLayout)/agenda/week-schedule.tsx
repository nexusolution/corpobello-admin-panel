'use client'

// Week view = a Monday–Saturday grid (Andrés 2026-09-16). Columns are the 6 days;
// hours run vertically so the height is constant regardless of turno count. Within
// a day, turnos that share an hour render SIDE BY SIDE with equal width (1 = full
// width, 2 = halves, 3 = thirds …) and a lone turno takes the whole day column —
// i.e. dynamic width by overlap, not fixed per-professional lanes. A 13:00–14:00
// ALMUERZO band spans each day. Cards: treatment-colour bar, patient (black bold),
// treatment (black), prof · sucursal, and a green "$" block when charged.

import type { ReactNode } from 'react'
import type { CalendarEvent } from '@/lib/data/calendar-events'
import type { DayColumn } from './day-schedule'

interface WeekScheduleProps {
  days: Date[]
  columnsForDay: (day: Date) => DayColumn[]
  turnos: CalendarEvent[]
  onOpenTurno: (e: CalendarEvent) => void
  onOpenDay: (day: Date) => void
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
function tintHex(hex: string): string {
  return `${hex}26`
}

export function WeekSchedule({
  days,
  columnsForDay,
  turnos,
  onOpenTurno,
  onOpenDay,
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
  const dayData = days.map((day) => ({ day, ds: toKey(day), cols: columnsForDay(day) }))

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

  // Bucket turnos by dayKey -> start hour (side-by-side within the same hour).
  const buckets = new Map<string, Map<number, CalendarEvent[]>>()
  const lunchTurnos = new Set<string>()
  for (const d of dayData) buckets.set(d.ds, new Map())
  for (const e of turnos) {
    const ds = toKey(e.start)
    const dayBucket = buckets.get(ds)
    if (!dayBucket) continue
    const h = e.start.getHours()
    if (h === LUNCH_HOUR) lunchTurnos.add(ds)
    const arr = dayBucket.get(h)
    if (arr) arr.push(e)
    else dayBucket.set(h, [e])
  }

  const dateAtHour = (day: Date, h: number) => {
    const d = new Date(day)
    d.setHours(h, 0, 0, 0)
    return d
  }
  const dayTitle = (day: Date) => {
    const raw = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' })
      .format(day)
      .replace(',', '')
      .replace('.', '')
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  const daySubtitle = (cols: DayColumn[]) => {
    const sucSet: string[] = []
    for (const c of cols) if (c.sucursal && !sucSet.includes(c.sucursal)) sucSet.push(c.sucursal)
    const profCount = cols.filter((c) => c.resourceId.startsWith('sp:')).length || cols.length
    return {
      text: `${sucSet.map(sucursalLabel).join(' + ')} (${profCount} ${
        profCount === 1 ? 'profesional' : 'profesionales'
      })`,
      sucursales: sucSet,
    }
  }

  const renderCard = (e: CalendarEvent) => {
    const tc = treatmentColor(e.treatmentSlug, treatmentName(e.treatmentSlug))
    const prof = professionalName(e.professionalId)
    const suc = e.sucursal ? sucursalLabel(e.sucursal) : ''
    const meta = [prof, suc].filter(Boolean).join(' · ')
    return (
      <button
        key={e.id}
        type='button'
        onClick={() => onOpenTurno(e)}
        className='flex items-stretch min-w-0 flex-1 text-left rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:brightness-[0.98] transition'
        style={{ backgroundColor: cardBg(e.status) }}>
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
            <span className='block text-[10px] leading-tight truncate text-gray-500 mt-0.5'>{meta}</span>
          )}
        </span>
        {e.charged && (
          <span
            className='shrink-0 self-stretch flex items-center justify-center text-white font-bold text-base'
            style={{ width: 30, backgroundColor: PAY_GREEN }}
            title='$'>
            $
          </span>
        )}
      </button>
    )
  }

  const cells: ReactNode[] = []

  // Corner + day headers (one column per day).
  cells.push(
    <div
      key='corner'
      className='bg-card border-b border-r border-border dark:border-darkborder'
      style={{ gridColumn: 1, gridRow: 1 }}
    />,
  )
  dayData.forEach((d, i) => {
    const sub = daySubtitle(d.cols)
    const dayBg =
      sub.sucursales.length === 0
        ? undefined
        : sub.sucursales.length === 1
          ? tintHex(sucursalColor(sub.sucursales[0]))
          : `linear-gradient(135deg, ${sub.sucursales
              .map((s, k) => {
                const from = Math.round((k * 100) / sub.sucursales.length)
                const to = Math.round(((k + 1) * 100) / sub.sucursales.length)
                return `${tintHex(sucursalColor(s))} ${from}% ${to}%`
              })
              .join(', ')})`
    cells.push(
      <button
        key={`h-${d.ds}`}
        type='button'
        onClick={() => onOpenDay(d.day)}
        title={dayTitle(d.day)}
        className='text-center px-1 py-2 border-b border-l border-border dark:border-darkborder cursor-pointer hover:brightness-95 transition'
        style={{ gridColumn: 2 + i, gridRow: 1, background: dayBg }}>
        <div className='text-sm font-bold text-dark dark:text-white capitalize'>{dayTitle(d.day)}</div>
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
      </button>,
    )
  })

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

  // Body cells: one per (day, hour). Turnos of that hour render side by side.
  for (const h of hours) {
    dayData.forEach((d, i) => {
      const list = (buckets.get(d.ds)?.get(h) ?? []).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
      const isLunch = h === LUNCH_HOUR && !lunchTurnos.has(d.ds)
      cells.push(
        <div
          key={`c-${d.ds}-${h}`}
          className='p-1 border-b border-l border-border/60 dark:border-darkborder/60'
          style={{ gridColumn: 2 + i, gridRow: rowOf(h) }}>
          {isLunch ? (
            <div className='h-full rounded-md bg-gray-100 dark:bg-white/5 text-link dark:text-darklink text-[10px] font-medium uppercase tracking-wide flex items-center justify-center py-2'>
              {lunchLabel}
            </div>
          ) : list.length > 0 ? (
            <div className='flex items-stretch gap-1'>{list.map(renderCard)}</div>
          ) : (
            <button
              type='button'
              onClick={() => {
                const start = dateAtHour(d.day, h)
                const end = new Date(start.getTime() + 30 * 60000)
                onCreate(start, end)
              }}
              aria-label={newLabel}
              className='w-full h-full min-h-[52px] rounded-md hover:bg-primary/5 transition-colors'
            />
          )}
        </div>,
      )
    })
  }

  // Auto-expand a day's column (header + body share the grid column) by its
  // busiest overlap, so many simultaneous turnos stay readable instead of being
  // squeezed into slivers. Quiet days keep the base width; the week still scrolls
  // horizontally when a busy day makes the total exceed the viewport. Andrés #14
  // stays intact: one column per day, quick panorama, click a header for detail.
  const BASE_DAY = 160 // px for a day with at most 1 turno in any hour
  const PER_CARD = 150 // px per side-by-side card on a busy day
  const overlapOf = (ds: string) => {
    let m = 1
    const b = buckets.get(ds)
    if (b) for (const arr of b.values()) if (arr.length > m) m = arr.length
    return m
  }
  const dayMins = dayData.map((d) => {
    const ov = overlapOf(d.ds)
    return ov <= 1 ? BASE_DAY : ov * PER_CARD
  })
  const gridTemplateColumns = `56px ${dayData
    .map((d, i) => `minmax(${dayMins[i]}px, ${Math.max(1, overlapOf(d.ds))}fr)`)
    .join(' ')}`
  const gridTemplateRows = `auto repeat(${hours.length}, minmax(56px, auto))`
  const minWidth = 56 + dayMins.reduce((a, b) => a + b, 0)

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card overflow-x-auto'>
      <div className='grid' style={{ gridTemplateColumns, gridTemplateRows, minWidth }}>
        {cells}
      </div>
    </div>
  )
}
