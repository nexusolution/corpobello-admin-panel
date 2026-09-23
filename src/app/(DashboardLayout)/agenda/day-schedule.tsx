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
  // Text colour for cards, so it adapts to the theme (dark cards need light text).
  cardText?: (status: string) => string
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
  cardText,
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

  // Turnos grouped by column, plus a per-column overlap layout: each turno gets a
  // lane index and the total number of lanes in its overlap cluster, so overlapping
  // turnos render side by side with even widths (Andrés #13/#14).
  const turnosByCol = new Map<string, CalendarEvent[]>()
  for (const e of turnos) {
    const rid = resourceIdFor(e)
    const arr = turnosByCol.get(rid)
    if (arr) arr.push(e)
    else turnosByCol.set(rid, [e])
  }
  function computeLayout(list: CalendarEvent[]): Map<string, { lane: number; lanes: number }> {
    const out = new Map<string, { lane: number; lanes: number }>()
    const sorted = [...list].sort(
      (a, b) => minOfDay(a.start) - minOfDay(b.start) || minOfDay(a.end) - minOfDay(b.end),
    )
    let cluster: CalendarEvent[] = []
    let clusterEnd = -Infinity
    const flush = () => {
      if (cluster.length === 0) return
      const laneEnds: number[] = []
      const laneOf = new Map<string, number>()
      for (const e of cluster) {
        let idx = laneEnds.findIndex((end) => end <= minOfDay(e.start))
        if (idx === -1) {
          idx = laneEnds.length
          laneEnds.push(minOfDay(e.end))
        } else laneEnds[idx] = minOfDay(e.end)
        laneOf.set(e.id, idx)
      }
      for (const e of cluster) out.set(e.id, { lane: laneOf.get(e.id) ?? 0, lanes: laneEnds.length })
      cluster = []
      clusterEnd = -Infinity
    }
    for (const e of sorted) {
      if (cluster.length > 0 && minOfDay(e.start) < clusterEnd) {
        cluster.push(e)
        clusterEnd = Math.max(clusterEnd, minOfDay(e.end))
      } else {
        flush()
        cluster = [e]
        clusterEnd = minOfDay(e.end)
      }
    }
    flush()
    return out
  }

  // Pixel geometry (Andrés #14): a fixed pixel height per SCALE slot, so a finer
  // scale zooms in and every card is positioned/sized by its exact minutes. The
  // scale therefore really changes the grid precision.
  const SLOT_PX = 44
  const GUTTER = 60
  const pxPerMin = SLOT_PX / scaleMin
  const totalPx = Math.max(SLOT_PX, (endMin - startMin) * pxPerMin)
  const gridTemplate = `${GUTTER}px repeat(${columns.length}, minmax(170px, 1fr))`
  const minGridWidth = GUTTER + columns.length * 170
  // Snap a pointer Y (relative to a column) to the start minute of its scale slot.
  const snapMinute = (clientY: number, rectTop: number) => {
    const y = clientY - rectTop
    return startMin + Math.max(0, Math.floor(y / pxPerMin / scaleMin)) * scaleMin
  }

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
                  style={{ backgroundColor: cardBg(e.status), color: cardText?.(e.status) ?? '#000' }}>
                  <span className='self-stretch' style={{ width: 6, backgroundColor: tc }} />
                  <span className='text-[12px] font-semibold truncate max-w-[220px]'>
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
        <div style={{ minWidth: minGridWidth }}>
          {/* Sucursal group header */}
          <div className='grid border-b border-border dark:border-darkborder' style={{ gridTemplateColumns: gridTemplate }}>
            <div />
            {groups.map((g) => (
              <div
                key={`${g.sucursal}-${g.start}`}
                className={`text-center text-sm font-bold text-dark dark:text-white py-2 ${
                  g.start > 0 ? 'border-l border-border dark:border-darkborder' : ''
                }`}
                style={{ gridColumn: `span ${g.span}`, backgroundColor: `${g.sucColor}22` }}>
                {g.sucursal ? sucursalLabel(g.sucursal) : emptyLabel}
              </div>
            ))}
          </div>
          {/* Professional header */}
          <div className='grid border-b border-border dark:border-darkborder' style={{ gridTemplateColumns: gridTemplate }}>
            <div />
            {columns.map((c, i) => {
              const groupStart = groups.some((g) => g.start === i)
              const prof = c.resourceId.startsWith('sp:') ? c.resourceTitle : c.resourceId.startsWith('su:') ? '' : c.resourceTitle
              return (
                <div
                  key={c.resourceId}
                  className={`text-center text-xs font-semibold text-link dark:text-darklink py-1.5 ${
                    groupStart && i > 0 ? 'border-l border-border dark:border-darkborder' : ''
                  }`}>
                  {prof}
                </div>
              )
            })}
          </div>
          {/* Proportional time grid: cards positioned/sized by exact minutes. */}
          <div className='grid' style={{ gridTemplateColumns: gridTemplate, height: totalPx }}>
            {/* Time gutter with a label per scale slot. */}
            <div className='relative'>
              {slots.map((m, i2) => (
                <div
                  key={m}
                  className={`absolute right-2 whitespace-nowrap ${
                    m % 60 === 0 ? 'text-xs font-semibold text-dark dark:text-white' : 'text-[10px] text-link/70 dark:text-darklink/70'
                  }`}
                  style={{ top: i2 * SLOT_PX - 6 }}>
                  {fmtMin(m)}
                </div>
              ))}
            </div>
            {/* One column per professional/sucursal. */}
            {columns.map((c, i) => {
              const groupStart = groups.some((g) => g.start === i)
              const lw = lunchByCol.get(c.resourceId) ?? null
              const colTurnos = turnosByCol.get(c.resourceId) ?? []
              const layout = computeLayout(colTurnos)
              const profId = profIdOfCol(c)
              return (
                <div
                  key={c.resourceId}
                  className={`relative ${groupStart && i > 0 ? 'border-l border-border dark:border-darkborder' : ''}`}
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
                          if (!id) return
                          const rect = ev.currentTarget.getBoundingClientRect()
                          onMoveTurno(id, {
                            startMin: snapMinute(ev.clientY, rect.top),
                            sucursal: c.sucursal || null,
                            professionalId: profId,
                          })
                        }
                      : undefined
                  }>
                  {/* Grid lines (one per scale slot). */}
                  {slots.map((m, i2) => (
                    <div
                      key={m}
                      className='absolute inset-x-0 border-b border-border/50 dark:border-darkborder/40 pointer-events-none'
                      style={{ top: i2 * SLOT_PX, height: SLOT_PX }}
                    />
                  ))}
                  {/* Clickable free area → Nuevo turno snapped to the scale slot. */}
                  <button
                    type='button'
                    aria-label={newLabel}
                    title={newLabel}
                    className='absolute inset-0 w-full h-full hover:bg-primary/5 transition-colors'
                    onClick={(ev) => {
                      const rect = ev.currentTarget.getBoundingClientRect()
                      const min = snapMinute(ev.clientY, rect.top)
                      const start = dateAtMin(min)
                      const end = new Date(start.getTime() + scaleMin * 60000)
                      onCreate(start, end, c.sucursal || undefined, profId ?? undefined)
                    }}
                  />
                  {/* Lunch block, positioned by its exact window. */}
                  {lw && (
                    <button
                      type='button'
                      onClick={() => onEditLunch(c)}
                      title={lunchLabel}
                      className='absolute inset-x-1 z-10 rounded-md bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-link dark:text-darklink text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center text-center px-1 transition-colors'
                      style={{
                        top: (lw.startMin - startMin) * pxPerMin,
                        height: Math.max(14, (lw.endMin - lw.startMin) * pxPerMin),
                      }}>
                      {lunchLabel} · {fmtMin(lw.startMin)} {locale === 'es' ? 'a' : 'to'} {fmtMin(lw.endMin)}
                    </button>
                  )}
                  {/* Cards: exact top/height by minute, lane-split for overlaps. */}
                  {colTurnos.map((e) => {
                    const lay = layout.get(e.id) ?? { lane: 0, lanes: 1 }
                    const top = (minOfDay(e.start) - startMin) * pxPerMin
                    const height = Math.max(16, (minOfDay(e.end) - minOfDay(e.start)) * pxPerMin)
                    const widthPct = 100 / lay.lanes
                    const leftPct = lay.lane * widthPct
                    const tc = treatmentColor(e.treatmentSlug, treatmentName(e.treatmentSlug))
                    const tall = height >= 44
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
                        onClick={(ev) => {
                          ev.stopPropagation()
                          onOpenTurno(e)
                        }}
                        className='absolute z-20 flex items-stretch text-left rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:brightness-[0.98] transition cursor-grab active:cursor-grabbing'
                        style={{
                          top,
                          height,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          backgroundColor: cardBg(e.status),
                          color: cardText?.(e.status) ?? '#000',
                        }}>
                        <span className='shrink-0 self-stretch' style={{ width: 6, backgroundColor: tc }} />
                        <span className='flex-1 min-w-0 py-0.5 px-2 overflow-hidden'>
                          <span className='block font-bold text-[12px] leading-tight truncate'>
                            {e.patientName || e.title}
                          </span>
                          {tall && (
                            <span className='block text-[10px] font-semibold leading-tight'>
                              {fmtTime(e.start)} · {fmtTime(e.end)}
                            </span>
                          )}
                          {tall && e.treatmentSlug && (
                            <span className='block text-[10px] leading-tight truncate opacity-90'>
                              {treatmentName(e.treatmentSlug)}
                            </span>
                          )}
                        </span>
                        {e.charged && (
                          <span
                            className='shrink-0 self-stretch flex items-center justify-center text-white font-bold'
                            style={{ width: 20, backgroundColor: PAY_GREEN }}
                            title='$'>
                            $
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
