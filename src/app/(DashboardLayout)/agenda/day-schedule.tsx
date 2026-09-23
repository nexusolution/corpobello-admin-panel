'use client'

// Day view = an hour-by-hour schedule TABLE (Andrés 2026-09-16 redesign), not a
// proportional time grid. Rows are the hours (08:00–20:00, expanded to fit any
// turno outside that band); columns are the sucursales that work that day, each
// grouped over the professionals working there (a 2-level header). Each cell holds
// the turno(s) that START in that hour (stacked if several). Clicking a turno opens
// it; clicking an empty cell creates one pre-filled with that hour/sucursal/prof.

import { useEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '@/lib/data/calendar-events'
import type { LunchWindow } from '@/lib/data/lunch'
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
  // Legacy "Todo el día" turnos on this date: shown in a small top section so they
  // never disappear from Vista Día, though patient turnos are timed now (punto 4).
  allDayTurnos?: CalendarEvent[]
  noTimeLabel?: string
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
  // Row granularity in minutes (5/10/15/20/30/60): every free interval at this
  // step is its own clickable slot (Andrés #14).
  scaleMin: number
  // Editable visible range controls.
  earlierLabel: string
  laterLabel: string
  resetHoursLabel: string
  // Configurable lunch (Andrés punto 5): the lunch window per column, and a click
  // handler to edit/remove it just for this day.
  lunchFor: (col: DayColumn) => LunchWindow | null
  onEditLunch: (col: DayColumn) => void
  // Drag-reschedule (Andrés #19-A): dropping a card onto a cell moves it to that
  // slot (startMin) + column (professional/sucursal); the parent validates + confirms.
  onMoveTurno?: (turnoId: string, target: { startMin: number; sucursal: string | null; professionalId: string | null }) => void
}

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
  allDayTurnos,
  noTimeLabel,
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
  scaleMin,
  earlierLabel,
  laterLabel,
  resetHoursLabel,
  lunchFor,
  onEditLunch,
  onMoveTurno,
}: DayScheduleProps) {
  // Column → professional id (sp:<suc>:<prof> or sp::<prof>); undefined otherwise.
  const profIdOfCol = (c: DayColumn): string | null =>
    c.resourceId.startsWith('sp:') ? c.resourceId.slice(c.resourceId.indexOf(':', 3) + 1) || null : null
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

  const minOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()
  const fmtMin = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
  // Configurable lunch window per column (Andrés punto 5).
  const lunchByCol = new Map(columns.map((c) => [c.resourceId, lunchFor(c)]))

  // Visible range: 08–20 by default, widened to fit any turno, and manually
  // expandable earlier/later (Andrés #14). Scale sets the row granularity.
  const [earlyExtra, setEarlyExtra] = useState(0)
  const [lateExtra, setLateExtra] = useState(0)
  let baseStartH = 8
  let baseEndH = 20
  for (const e of turnos) {
    const sh = e.start.getHours()
    if (sh < baseStartH) baseStartH = sh
    const eh = e.end.getHours() + (e.end.getMinutes() > 0 ? 1 : 0)
    if (eh > baseEndH) baseEndH = eh
  }
  const startH = Math.max(0, baseStartH - earlyExtra)
  const endH = Math.min(24, baseEndH + lateExtra)
  const startMin = startH * 60
  const endMin = endH * 60
  const slots: number[] = []
  for (let m = startMin; m < endMin; m += scaleMin) slots.push(m)

  // Per column: turnos that START in each slot, and the slots merely COVERED by a
  // turno's duration (occupied, not clickable) so long turnos don't leave a
  // "free" gap under themselves.
  const startingByCol = new Map<string, Map<number, CalendarEvent[]>>()
  const occupiedByCol = new Map<string, Set<number>>()
  for (const e of turnos) {
    const rid = resourceIdFor(e)
    const s = minOfDay(e.start)
    const en = minOfDay(e.end)
    const startSlot = startMin + Math.floor((s - startMin) / scaleMin) * scaleMin
    let m1 = startingByCol.get(rid)
    if (!m1) {
      m1 = new Map()
      startingByCol.set(rid, m1)
    }
    const arr = m1.get(startSlot)
    if (arr) arr.push(e)
    else m1.set(startSlot, [e])
    let occ = occupiedByCol.get(rid)
    if (!occ) {
      occ = new Set()
      occupiedByCol.set(rid, occ)
    }
    for (let t = startSlot + scaleMin; t < en; t += scaleMin) occ.add(t)
  }
  const slotH = Math.max(24, Math.round(scaleMin * 1.4))

  // Lunch as ONE continuous block (Andrés punto 4): instead of a grey band per
  // slot, merge each column's consecutive "pure lunch" slots (no turno) into a
  // single rowSpan cell. lunchTopByCol maps the top slot of each run to its span;
  // lunchSkipByCol lists the covered slots to skip so the rowSpan fills them.
  const lunchTopByCol = new Map<string, Map<number, number>>()
  const lunchSkipByCol = new Map<string, Set<number>>()
  for (const c of columns) {
    const lw = lunchByCol.get(c.resourceId)
    if (!lw) continue
    const starting = startingByCol.get(c.resourceId)
    const occ = occupiedByCol.get(c.resourceId)
    const tops = new Map<number, number>()
    const skip = new Set<number>()
    let runTop: number | null = null
    let runLen = 0
    const flush = () => {
      if (runTop != null && runLen > 0) tops.set(runTop, runLen)
      runTop = null
      runLen = 0
    }
    for (const slotMin of slots) {
      const isLunch = slotMin >= lw.startMin && slotMin < lw.endMin
      const hasTurno = (starting?.get(slotMin)?.length ?? 0) > 0 || (occ?.has(slotMin) ?? false)
      if (isLunch && !hasTurno) {
        if (runTop == null) {
          runTop = slotMin
          runLen = 1
        } else {
          runLen++
          skip.add(slotMin)
        }
      } else {
        flush()
      }
    }
    flush()
    lunchTopByCol.set(c.resourceId, tops)
    lunchSkipByCol.set(c.resourceId, skip)
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
      }, 3600)
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

  const dateAtMin = (min: number) => {
    const d = new Date(date)
    d.setHours(Math.floor(min / 60), min % 60, 0, 0)
    return d
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card overflow-hidden'>
      <div className='px-4 py-3 border-b border-border dark:border-darkborder'>
        <div className='text-lg font-bold text-dark dark:text-white capitalize'>{headerDate}</div>
        <div className='text-xs text-link dark:text-darklink mt-0.5'>{subtitle}</div>
      </div>

      {allDayTurnos && allDayTurnos.length > 0 && (
        <div className='px-4 py-2.5 border-b border-border dark:border-darkborder bg-lightwarning/40 dark:bg-lightwarning/10'>
          <div className='text-[11px] font-semibold uppercase tracking-wide text-link dark:text-darklink mb-1.5'>
            {noTimeLabel}
          </div>
          <div className='flex flex-wrap gap-2'>
            {allDayTurnos.map((e) => {
              const tc = treatmentColor(e.treatmentSlug, treatmentName(e.treatmentSlug))
              return (
                <button
                  key={e.id}
                  type='button'
                  data-eventid={e.id}
                  onClick={() => onOpenTurno(e)}
                  className='flex items-center gap-2 rounded-md pl-0 pr-2.5 py-1 text-left overflow-hidden shadow-sm hover:shadow-md hover:brightness-[0.98] transition'
                  style={{ backgroundColor: cardBg(e.status) }}>
                  <span className='self-stretch' style={{ width: 6, backgroundColor: tc }} />
                  <span className='text-[12px] font-semibold text-black truncate max-w-[220px]'>
                    {e.patientName || e.title}
                    {e.treatmentSlug ? ` · ${treatmentName(e.treatmentSlug)}` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className='flex items-center gap-2 px-4 py-2 border-b border-border dark:border-darkborder'>
        <button
          type='button'
          onClick={() => setEarlyExtra((n) => Math.min(baseStartH, n + 1))}
          disabled={startH <= 0}
          className='inline-flex items-center gap-1 text-xs font-medium text-link dark:text-darklink hover:text-primary disabled:opacity-40'>
          <span className='text-sm leading-none'>↑</span>
          {earlierLabel}
        </button>
        <span className='text-border dark:text-darkborder'>·</span>
        <button
          type='button'
          onClick={() => setLateExtra((n) => Math.min(24 - baseEndH, n + 1))}
          disabled={endH >= 24}
          className='inline-flex items-center gap-1 text-xs font-medium text-link dark:text-darklink hover:text-primary disabled:opacity-40'>
          <span className='text-sm leading-none'>↓</span>
          {laterLabel}
        </button>
        {(earlyExtra > 0 || lateExtra > 0) && (
          <button
            type='button'
            onClick={() => {
              setEarlyExtra(0)
              setLateExtra(0)
            }}
            className='ml-auto text-xs font-medium text-primary hover:underline'>
            {resetHoursLabel}
          </button>
        )}
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
            {slots.map((slotMin) => {
              const onHour = slotMin % 60 === 0
              return (
              <tr key={slotMin}>
                <td className={`align-top text-right pr-2 pt-1 whitespace-nowrap border-b border-border/60 dark:border-darkborder/60 ${onHour ? 'text-xs font-semibold text-dark dark:text-white' : 'text-[10px] text-link/70 dark:text-darklink/70'}`}>
                  {fmtMin(slotMin)}
                </td>
                {columns.map((c, i) => {
                  // Covered by a lunch rowSpan above: render no cell at all.
                  if (lunchSkipByCol.get(c.resourceId)?.has(slotMin)) return null
                  const groupStart = groups.some((g) => g.start === i)
                  const cell = (startingByCol.get(c.resourceId)?.get(slotMin) ?? []).slice()
                  cell.sort((a, b) => a.start.getTime() - b.start.getTime())
                  const occupied = occupiedByCol.get(c.resourceId)?.has(slotMin) ?? false
                  const lw = lunchByCol.get(c.resourceId) ?? null
                  const lunchSpan = lunchTopByCol.get(c.resourceId)?.get(slotMin)
                  // A single continuous ALMUERZO block spanning its whole duration
                  // (Andrés punto 4): "ALMUERZO · 13:00 a 14:00", centred, clickable.
                  if (lunchSpan && lw) {
                    const rangeSep = locale === 'es' ? 'a' : 'to'
                    return (
                      <td
                        key={c.resourceId}
                        rowSpan={lunchSpan}
                        style={{ height: slotH * lunchSpan }}
                        className={`align-top p-1 border-b border-border/60 dark:border-darkborder/60 ${
                          groupStart && i > 0 ? 'border-l border-border dark:border-darkborder' : ''
                        }`}>
                        <button
                          type='button'
                          onClick={() => onEditLunch(c)}
                          title={lunchLabel}
                          className='w-full h-full rounded-md bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-link dark:text-darklink text-[11px] font-semibold uppercase tracking-wide text-center flex items-center justify-center transition-colors'
                          style={{ minHeight: slotH * lunchSpan - 8 }}>
                          {lunchLabel} · {fmtMin(lw.startMin)} {rangeSep} {fmtMin(lw.endMin)}
                        </button>
                      </td>
                    )
                  }
                  return (
                    <td
                      key={c.resourceId}
                      style={{ height: slotH }}
                      onDragOver={
                        onMoveTurno
                          ? (ev) => {
                              ev.preventDefault()
                              ev.dataTransfer.dropEffect = 'move'
                            }
                          : undefined
                      }
                      onDrop={
                        onMoveTurno
                          ? (ev) => {
                              ev.preventDefault()
                              const id = ev.dataTransfer.getData('text/plain')
                              if (id)
                                onMoveTurno(id, {
                                  startMin: slotMin,
                                  sucursal: c.sucursal || null,
                                  professionalId: profIdOfCol(c),
                                })
                            }
                          : undefined
                      }
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
                                    draggable={!!onMoveTurno}
                                    onDragStart={(ev) => {
                                      ev.dataTransfer.setData('text/plain', e.id)
                                      ev.dataTransfer.effectAllowed = 'move'
                                    }}
                                    onClick={() => onOpenTurno(e)}
                                    className='flex items-stretch flex-1 min-w-0 text-left rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:brightness-[0.98] transition cursor-grab active:cursor-grabbing'
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
                      ) : occupied ? (
                        // Slot covered by a turno that started earlier: busy, not
                        // clickable (a faint tint distinguishes it from a free slot).
                        <div className='w-full h-full rounded bg-black/[0.03] dark:bg-white/[0.04]' style={{ minHeight: slotH - 8 }} />
                      ) : (
                        <button
                          type='button'
                          onClick={() => {
                            const start = dateAtMin(slotMin)
                            const end = new Date(start.getTime() + scaleMin * 60000)
                            const sucursal = c.sucursal || undefined
                            const professionalId = c.resourceId.startsWith('sp:')
                              ? c.resourceId.slice(c.resourceId.indexOf(':', 3) + 1)
                              : undefined
                            onCreate(start, end, sucursal, professionalId)
                          }}
                          aria-label={newLabel}
                          title={newLabel}
                          className='w-full rounded-md hover:bg-primary/5 transition-colors'
                          style={{ minHeight: slotH - 8 }}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
