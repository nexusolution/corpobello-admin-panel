'use client'

// Day view = an hour-by-hour schedule TABLE (Andrés 2026-09-16 redesign), not a
// proportional time grid. Rows are the hours (08:00–20:00, expanded to fit any
// turno outside that band); columns are the sucursales that work that day, each
// grouped over the professionals working there (a 2-level header). Each cell holds
// the turno(s) that START in that hour (stacked if several). Clicking a turno opens
// it; clicking an empty cell creates one pre-filled with that hour/sucursal/prof.

import { useEffect, useRef } from 'react'
import type { CalendarEvent } from '@/lib/data/calendar-events'
import { useHorizontalDragScroll } from './use-hscroll'

export interface DayColumn {
  resourceId: string
  resourceTitle: string
  sucursal: string
  sucColor: string
}

interface DayScheduleProps {
  date: Date
  columns: DayColumn[]
  turnos: CalendarEvent[]
  resourceIdFor: (e: CalendarEvent) => string
  // Deep-link from the ficha (Reservas → turno): scroll to this turno's card and
  // flash it briefly, keeping the agenda context (Andrés punto 3). Cleared via
  // onFlashDone once the highlight finishes.
  flashEventId?: string | null
  onFlashDone?: () => void
  onOpenTurno: (e: CalendarEvent) => void
  onCreate: (start: Date, end: Date, sucursal?: string, professionalId?: string) => void
  treatmentColor: (slug: string | null | undefined, name?: string) => string
  treatmentName: (slug?: string | null) => string
  cardBg: (status: string) => string
  sucursalLabel: (s: string) => string
  locale: string
  emptyLabel: string
  newLabel: string
  lunchLabel: string
}

// Midday break: the 13:00–14:00 row shows "ALMUERZO" in every column (unless a
// turno was actually scheduled over lunch) — Andrés 2026-09-16.
const LUNCH_HOUR = 13
// Solid green cobro block on the right of a charged turno (matches the reference).
const PAY_GREEN = '#16a34a'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// Group turnos into clusters that overlap in REAL time (Andrés #13): turnos whose
// intervals intersect go side by side (equal width); non-overlapping ones stack.
function overlapClusters(list: CalendarEvent[]): CalendarEvent[][] {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime())
  const clusters: CalendarEvent[][] = []
  let cur: CalendarEvent[] = []
  let curEnd = -Infinity
  for (const e of sorted) {
    if (cur.length > 0 && e.start.getTime() < curEnd) {
      cur.push(e)
      curEnd = Math.max(curEnd, e.end.getTime())
    } else {
      if (cur.length > 0) clusters.push(cur)
      cur = [e]
      curEnd = e.end.getTime()
    }
  }
  if (cur.length > 0) clusters.push(cur)
  return clusters
}

export function DaySchedule({
  date,
  columns,
  turnos,
  resourceIdFor,
  flashEventId,
  onFlashDone,
  onOpenTurno,
  onCreate,
  treatmentColor,
  treatmentName,
  cardBg,
  sucursalLabel,
  locale,
  emptyLabel,
  newLabel,
  lunchLabel,
}: DayScheduleProps) {
  // Long, capitalised date header, e.g. "Lunes 5 de octubre de 2026".
  const rawDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  const longDate = rawDate.replace(',', '')
  const headerDate = longDate.charAt(0).toUpperCase() + longDate.slice(1)

  // Subtitle: how many sucursales / professionals work that day.
  const sucSet = new Set(columns.filter((c) => c.sucursal).map((c) => c.sucursal))
  const profCount = columns.filter((c) => c.resourceId.startsWith('sp:')).length
  const nSuc = sucSet.size
  const subtitle = `${nSuc} ${nSuc === 1 ? 'sucursal' : 'sucursales'} · ${profCount} ${
    profCount === 1 ? 'profesional' : 'profesionales'
  }`

  // Header groups: consecutive columns of the same sucursal share a spanning cell.
  const groups: { sucursal: string; sucColor: string; span: number; start: number }[] = []
  columns.forEach((c, i) => {
    const last = groups[groups.length - 1]
    if (last && last.sucursal === c.sucursal) last.span += 1
    else groups.push({ sucursal: c.sucursal, sucColor: c.sucColor, span: 1, start: i })
  })

  // Hour rows: 08–20 by default, widened to include any turno outside that band.
  let startH = 8
  let endH = 20
  for (const e of turnos) {
    const h = e.start.getHours()
    if (h < startH) startH = h
    if (h > endH) endH = h
  }
  const hours: number[] = []
  for (let h = startH; h <= endH; h++) hours.push(h)

  // Turnos bucketed by column id -> start hour.
  const byColHour = new Map<string, Map<number, CalendarEvent[]>>()
  for (const e of turnos) {
    const rid = resourceIdFor(e)
    const h = e.start.getHours()
    let inner = byColHour.get(rid)
    if (!inner) {
      inner = new Map()
      byColHour.set(rid, inner)
    }
    const arr = inner.get(h)
    if (arr) arr.push(e)
    else inner.set(h, [e])
  }

  // Always give each column a readable min width (72px time gutter + 170px/col),
  // so on a phone the day table scrolls horizontally instead of squeezing cards
  // into slivers. On desktop the table is wider than this, so nothing scrolls.
  const minTableWidth = columns.length * 170 + 72

  const scrollRef = useRef<HTMLDivElement>(null)
  useHorizontalDragScroll(scrollRef)

  // Ficha deep-link (punto 3): once the target turno's card is in the DOM, scroll
  // it into view (hour + column) and flash it, then clear the flag.
  useEffect(() => {
    if (!flashEventId) return
    let done = false
    const run = () => {
      if (done) return
      const el = document.querySelector<HTMLElement>(`[data-eventid="${flashEventId}"]`)
      if (!el) return
      done = true
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      el.classList.add('cb-flash')
      window.setTimeout(() => {
        el.classList.remove('cb-flash')
        onFlashDone?.()
      }, 2600)
    }
    // Try now and on the next frame (the card may mount a tick after this runs).
    run()
    const raf = requestAnimationFrame(run)
    const t = window.setTimeout(run, 200)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [flashEventId, onFlashDone])

  const dateAtHour = (h: number) => {
    const d = new Date(date)
    d.setHours(h, 0, 0, 0)
    return d
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card overflow-hidden'>
      <div className='px-4 py-3 border-b border-border dark:border-darkborder'>
        <div className='text-lg font-bold text-dark dark:text-white capitalize'>{headerDate}</div>
        <div className='text-xs text-link dark:text-darklink mt-0.5'>{subtitle}</div>
      </div>

      <div ref={scrollRef} className='overflow-x-auto cb-hscroll'>
        <table
          className='w-full border-collapse'
          style={{ tableLayout: 'fixed', minWidth: minTableWidth }}>
          <colgroup>
            <col style={{ width: 72 }} />
            {columns.map((c) => (
              <col key={c.resourceId} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className='border-b border-border dark:border-darkborder' />
              {groups.map((g) => (
                <th
                  key={`${g.sucursal}-${g.start}`}
                  colSpan={g.span}
                  className={`text-center text-sm font-bold text-dark dark:text-white py-2 border-b border-border dark:border-darkborder ${
                    g.start > 0 ? 'border-l border-border dark:border-darkborder' : ''
                  }`}
                  style={{ backgroundColor: `${g.sucColor}22` }}>
                  {g.sucursal ? sucursalLabel(g.sucursal) : emptyLabel}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((c, i) => {
                const groupStart = groups.some((g) => g.start === i)
                const prof = c.resourceId.startsWith('sp:')
                  ? c.resourceTitle
                  : c.resourceId.startsWith('su:')
                    ? ''
                    : c.resourceTitle
                return (
                  <th
                    key={c.resourceId}
                    className={`text-center text-xs font-semibold text-link dark:text-darklink py-1.5 border-b border-border dark:border-darkborder ${
                      groupStart && i > 0 ? 'border-l border-border dark:border-darkborder' : ''
                    }`}>
                    {prof}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h}>
                <td className='align-top text-right pr-2 pt-2 text-xs text-link dark:text-darklink whitespace-nowrap border-b border-border/60 dark:border-darkborder/60'>
                  {pad2(h)}:00
                </td>
                {columns.map((c, i) => {
                  const groupStart = groups.some((g) => g.start === i)
                  const cell = byColHour.get(c.resourceId)?.get(h) ?? []
                  cell.sort((a, b) => a.start.getTime() - b.start.getTime())
                  return (
                    <td
                      key={c.resourceId}
                      className={`align-top p-1 border-b border-border/60 dark:border-darkborder/60 ${
                        groupStart && i > 0 ? 'border-l border-border dark:border-darkborder' : ''
                      }`}>
                      {cell.length > 0 ? (
                        <div className='space-y-1.5'>
                          {overlapClusters(cell).map((cluster, ci) => (
                            <div key={ci} className='flex items-stretch gap-1.5'>
                              {cluster.map((e) => {
                                const tc = treatmentColor(e.treatmentSlug, treatmentName(e.treatmentSlug))
                                const solo = cluster.length === 1
                                return (
                                  <button
                                    key={e.id}
                                    type='button'
                                    data-eventid={e.id}
                                    onClick={() => onOpenTurno(e)}
                                    className='flex items-stretch flex-1 min-w-0 text-left rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:brightness-[0.98] transition'
                                    style={{ backgroundColor: cardBg(e.status) }}>
                                    {/* Treatment-colour bar (thick) */}
                                    <span className='shrink-0 self-stretch' style={{ width: 8, backgroundColor: tc }} />
                                    <span className='flex-1 min-w-0 py-1.5 px-2.5'>
                                      <span className='flex items-baseline justify-between gap-2'>
                                        <span className='font-bold text-[13px] leading-tight text-black truncate'>
                                          {e.patientName || e.title}
                                        </span>
                                        {solo && (
                                          <span className='shrink-0 text-[11px] font-semibold text-black whitespace-nowrap'>
                                            {fmtTime(e.start)} · {fmtTime(e.end)}
                                          </span>
                                        )}
                                      </span>
                                      {!solo && (
                                        <span className='block text-[11px] font-semibold text-black leading-tight'>
                                          {fmtTime(e.start)} · {fmtTime(e.end)}
                                        </span>
                                      )}
                                      {e.treatmentSlug && (
                                        <span className='block text-[11px] leading-tight truncate mt-0.5 text-black'>
                                          {treatmentName(e.treatmentSlug)}
                                        </span>
                                      )}
                                    </span>
                                    {/* Cobro block: solid green, flush to the edge. */}
                                    {e.charged && (
                                      <span
                                        className='shrink-0 self-stretch flex items-center justify-center text-white font-bold text-lg'
                                        style={{ width: solo ? 44 : 24, backgroundColor: PAY_GREEN }}
                                        title='$'>
                                        $
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      ) : h === LUNCH_HOUR ? (
                        <div className='rounded-md bg-gray-100 dark:bg-white/5 text-link dark:text-darklink text-[11px] font-medium uppercase tracking-wide text-center py-3'>
                          {lunchLabel}
                        </div>
                      ) : (
                        <button
                          type='button'
                          onClick={() => {
                            const start = dateAtHour(h)
                            const end = new Date(start.getTime() + 30 * 60000)
                            const sucursal = c.sucursal || undefined
                            const professionalId = c.resourceId.startsWith('sp:')
                              ? c.resourceId.slice(c.resourceId.indexOf(':', 3) + 1)
                              : undefined
                            onCreate(start, end, sucursal, professionalId)
                          }}
                          aria-label={newLabel}
                          className='w-full min-h-[46px] rounded-md hover:bg-primary/5 transition-colors'
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
