'use client'

// Week view = a Monday–Saturday grid (Andrés 2026-09-16). Columns are the 6 days;
// hours run vertically so the height is constant regardless of turno count. Within
// a day, turnos that share an hour render SIDE BY SIDE with equal width (1 = full
// width, 2 = halves, 3 = thirds …) and a lone turno takes the whole day column —
// i.e. dynamic width by overlap, not fixed per-professional lanes. A 13:00–14:00
// ALMUERZO band spans each day. Cards: treatment-colour bar, patient (black bold),
// treatment (black), prof · sucursal, and a green "$" block when charged.

import { useEffect, useRef, type ReactNode } from 'react'
import type { CalendarEvent } from '@/lib/data/calendar-events'
import type { LunchWindow } from '@/lib/data/lunch'
import type { DayColumn } from './day-schedule'

interface WeekScheduleProps {
  days: Date[]
  // The selected day, centered horizontally when the week loads/changes.
  focusDate?: Date
  columnsForDay: (day: Date) => DayColumn[]
  // Map a turno to its column id within a given day's column set (same hybrid
  // resolver the Day view uses), so each day can split into professional subcolumns.
  resourceIdFor: (e: CalendarEvent, colIds: Set<string>) => string
  // Configurable lunch window per (day, subcolumn) — Andrés punto 5.
  lunchFor: (day: Date, col: DayColumn) => LunchWindow | null
  turnos: CalendarEvent[]
  onOpenTurno: (e: CalendarEvent) => void
  onOpenDay: (day: Date) => void
  onCreate: (start: Date, end: Date, sucursal?: string, professionalId?: string) => void
  treatmentColor: (slug: string | null | undefined, name?: string) => string
  treatmentName: (slug?: string | null) => string
  cardBg: (status: string) => string
  sucursalLabel: (s: string) => string
  sucursalColor: (s: string) => string
  locale: string
  lunchLabel: string
  newLabel: string
  emptyLabel: string
  // Drag-reschedule (Andrés #19-C): dropping a card onto a cell moves it to that
  // day (dateStr) + hour (startMin) + subcolumn (professional/sucursal).
  onMoveTurno?: (
    turnoId: string,
    target: { dateStr: string; startMin: number; sucursal: string | null; professionalId: string | null },
  ) => void
}

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
  focusDate,
  columnsForDay,
  resourceIdFor,
  lunchFor,
  turnos,
  onOpenTurno,
  onOpenDay,
  onCreate,
  treatmentColor,
  treatmentName,
  cardBg,
  sucursalLabel,
  sucursalColor,
  locale,
  lunchLabel,
  newLabel,
  emptyLabel,
  onMoveTurno,
}: WeekScheduleProps) {
  const dayData = days.map((day) => ({ day, ds: toKey(day), cols: columnsForDay(day) }))

  // Center the selected day horizontally when the week (or the selected day)
  // changes, so on load you land on the relevant day instead of at Monday with
  // a busy Saturday hidden off to the right. Column widths depend on the turnos,
  // which can arrive AFTER the first paint and expand a busy day, so we re-center
  // whenever the grid resizes (via ResizeObserver) until the user scrolls — then
  // we stop, to never fight them.
  const scrollRef = useRef<HTMLDivElement>(null)
  const focusKey = focusDate ? toKey(focusDate) : ''
  const weekKey = dayData[0]?.ds ?? ''
  useEffect(() => {
    const cont = scrollRef.current
    if (!cont) return
    const target = focusKey || weekKey
    const center = () => {
      const el = cont.querySelector<HTMLElement>(`[data-daycol="${target}"]`)
      if (!el) return
      const GUTTER = 56 // the pinned time column on the left
      const contRect = cont.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const elCenterInContent = elRect.left - contRect.left + cont.scrollLeft + elRect.width / 2
      const desired = elCenterInContent - GUTTER / 2 - cont.clientWidth / 2
      cont.scrollLeft = Math.max(0, desired)
    }
    center()
    const raf = requestAnimationFrame(center)
    const inner = cont.firstElementChild
    const ro = typeof ResizeObserver !== 'undefined' && inner ? new ResizeObserver(center) : null
    ro?.observe(inner as Element)
    const stop = () => ro?.disconnect()
    cont.addEventListener('pointerdown', stop, { once: true })
    cont.addEventListener('wheel', stop, { once: true, passive: true })
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      cont.removeEventListener('pointerdown', stop)
      cont.removeEventListener('wheel', stop)
    }
  }, [focusKey, weekKey])

  // Make the horizontal scroll controllable beyond dragging the thin scrollbar:
  //   · mouse wheel scrolls horizontally when there is no vertical room (or with
  //     Shift held), so a single wheel moves across the week;
  //   · click-and-drag anywhere pans the week; a real click (moved < 6px) still
  //     opens/creates a turno — a drag suppresses the trailing click so it never
  //     fires the button underneath.
  useEffect(() => {
    const cont = scrollRef.current
    if (!cont) return

    const onWheel = (e: WheelEvent) => {
      if (cont.scrollWidth <= cont.clientWidth) return
      const canV = cont.scrollHeight > cont.clientHeight
      if (!e.shiftKey && canV) return
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (d === 0) return
      cont.scrollLeft += d
      e.preventDefault()
    }

    let down = false
    let moved = false
    let startX = 0
    let startLeft = 0
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      down = true
      moved = false
      startX = e.clientX
      startLeft = cont.scrollLeft
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) < 6) return
      moved = true
      cont.style.cursor = 'grabbing'
      cont.style.userSelect = 'none'
      cont.scrollLeft = startLeft - dx
    }
    const endDrag = () => {
      if (!down) return
      down = false
      cont.style.cursor = ''
      cont.style.userSelect = ''
      if (moved) {
        // Swallow the click that follows a drag so it does not open/create a turno.
        const swallow = (ev: MouseEvent) => {
          ev.stopPropagation()
          ev.preventDefault()
          window.removeEventListener('click', swallow, true)
        }
        window.addEventListener('click', swallow, true)
      }
    }

    cont.addEventListener('wheel', onWheel, { passive: false })
    cont.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endDrag)
    return () => {
      cont.removeEventListener('wheel', onWheel)
      cont.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [])

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

  // Per day, split into a subcolumn per WORKING (professional · sucursal), like the
  // Day view (Andrés #14). A day with nobody working still gets one placeholder
  // column so all six days show. Flatten to grid columns with their start index.
  type Flat = {
    day: Date
    ds: string
    cols: DayColumn[]
    startCol: number // 1-based grid column of its first subcolumn (col 1 = gutter)
    colIds: Set<string>
  }
  const flat: Flat[] = []
  let colIdx = 2
  for (const d of dayData) {
    const cols = d.cols.length
      ? d.cols
      : [{ resourceId: 'none', resourceTitle: emptyLabel, sucursal: '', sucColor: '#94a3b8' }]
    flat.push({ day: d.day, ds: d.ds, cols, startCol: colIdx, colIds: new Set(cols.map((c) => c.resourceId)) })
    colIdx += cols.length
  }

  // Bucket turnos: dayKey → columnId → start hour → turnos.
  const buckets = new Map<string, Map<string, Map<number, CalendarEvent[]>>>()
  for (const f of flat) buckets.set(f.ds, new Map())
  for (const e of turnos) {
    const ds = toKey(e.start)
    const f = flat.find((x) => x.ds === ds)
    if (!f) continue
    const rid = resourceIdFor(e, f.colIds)
    const dayB = buckets.get(ds)!
    let colB = dayB.get(rid)
    if (!colB) {
      colB = new Map()
      dayB.set(rid, colB)
    }
    const h = e.start.getHours()
    const arr = colB.get(h)
    if (arr) arr.push(e)
    else colB.set(h, [e])
  }

  const dateAtHour = (day: Date, h: number) => {
    const d = new Date(day)
    d.setHours(h, 0, 0, 0)
    return d
  }
  const profIdOf = (rid: string) => (rid.startsWith('sp:') ? rid.slice(rid.indexOf(':', 3) + 1) : undefined)
  const dayTitle = (day: Date) => {
    const raw = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' })
      .format(day)
      .replace(',', '')
      .replace('.', '')
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  const daySucs = (cols: DayColumn[]) => {
    const s: string[] = []
    for (const c of cols) if (c.sucursal && !s.includes(c.sucursal)) s.push(c.sucursal)
    return s
  }

  const renderCard = (e: CalendarEvent) => {
    const tc = treatmentColor(e.treatmentSlug, treatmentName(e.treatmentSlug))
    return (
      <button
        key={e.id}
        type='button'
        draggable={!!onMoveTurno}
        onDragStart={(ev) => {
          ev.dataTransfer.setData('text/plain', e.id)
          ev.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => onOpenTurno(e)}
        className='flex items-stretch min-w-0 flex-1 text-left rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:brightness-[0.98] transition cursor-grab active:cursor-grabbing'
        style={{ backgroundColor: cardBg(e.status) }}>
        <span className='shrink-0 self-stretch' style={{ width: 6, backgroundColor: tc }} />
        <span className='flex-1 min-w-0 py-1 px-1.5'>
          <span className='block font-bold text-[11px] leading-tight text-black truncate'>
            {e.patientName || e.title}
          </span>
          <span className='block text-[10px] font-semibold text-black whitespace-nowrap'>
            {fmtTime(e.start)} · {fmtTime(e.end)}
          </span>
          {e.treatmentSlug && (
            <span className='block text-[10px] leading-tight truncate text-black'>
              {treatmentName(e.treatmentSlug)}
            </span>
          )}
        </span>
        {e.charged && (
          <span
            className='shrink-0 self-stretch flex items-center justify-center text-white font-bold text-sm'
            style={{ width: 22, backgroundColor: PAY_GREEN }}
            title='$'>
            $
          </span>
        )}
      </button>
    )
  }

  const DAY_H = 46 // fixed height of the day-header row (row 1)
  const SUB_H = 30 // fixed height of the subcolumn-header row (row 2)
  const rowOf = (h: number) => 3 + hours.indexOf(h)

  const cells: ReactNode[] = []

  // Corner (spans both header rows).
  cells.push(
    <div
      key='corner'
      className='bg-card border-b border-r border-border dark:border-darkborder sticky left-0 z-40'
      style={{ gridColumn: 1, gridRow: '1 / span 2', top: 0 }}
    />,
  )

  // Row 1: day headers, each spanning its subcolumns; clickable → Day view.
  flat.forEach((f) => {
    const sucs = daySucs(f.cols)
    const tintLayer =
      sucs.length === 0
        ? null
        : sucs.length === 1
          ? `linear-gradient(${tintHex(sucursalColor(sucs[0]))}, ${tintHex(sucursalColor(sucs[0]))})`
          : `linear-gradient(135deg, ${sucs
              .map((s, k) => {
                const from = Math.round((k * 100) / sucs.length)
                const to = Math.round(((k + 1) * 100) / sucs.length)
                return `${tintHex(sucursalColor(s))} ${from}% ${to}%`
              })
              .join(', ')})`
    const dayBg = tintLayer ? `${tintLayer}, var(--card)` : 'var(--card)'
    cells.push(
      <button
        key={`h-${f.ds}`}
        type='button'
        onClick={() => onOpenDay(f.day)}
        title={dayTitle(f.day)}
        data-daycol={f.ds}
        className='text-center px-1 border-b border-l border-border dark:border-darkborder cursor-pointer hover:brightness-95 transition sticky z-20 flex flex-col items-center justify-center'
        style={{ gridColumn: `${f.startCol} / span ${f.cols.length}`, gridRow: 1, top: 0, height: DAY_H, background: dayBg }}>
        <div className='text-sm font-bold text-dark dark:text-white capitalize leading-tight'>{dayTitle(f.day)}</div>
        {sucs.length > 0 && (
          <div className='text-[10px] text-link dark:text-darklink leading-tight'>{sucs.map(sucursalLabel).join(' + ')}</div>
        )}
      </button>,
    )
  })

  // Row 2: subcolumn headers — "profesional · sucursal".
  flat.forEach((f) => {
    f.cols.forEach((c, j) => {
      const col = f.startCol + j
      const prof = c.resourceId.startsWith('sp:') ? c.resourceTitle : c.resourceId === 'none' ? emptyLabel : ''
      const sucTxt = c.sucursal ? sucursalLabel(c.sucursal) : ''
      cells.push(
        <div
          key={`sh-${f.ds}-${col}`}
          className={`px-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-dark dark:text-white border-b border-border dark:border-darkborder bg-card sticky z-20 ${
            j === 0 ? 'border-l border-border dark:border-darkborder' : 'border-l border-border/40 dark:border-darkborder/40'
          }`}
          style={{ gridColumn: col, gridRow: 2, top: DAY_H, height: SUB_H }}>
          {c.sucursal && <span className='h-2 w-2 rounded-full shrink-0' style={{ backgroundColor: c.sucColor }} />}
          <span className='truncate'>
            {prof}
            {prof && sucTxt ? ' · ' : ''}
            <span className='text-link dark:text-darklink font-normal'>{sucTxt}</span>
          </span>
        </div>,
      )
    })
  })

  // Time gutter (col 1).
  for (const h of hours) {
    cells.push(
      <div
        key={`t-${h}`}
        className='text-right pr-2 pt-1 text-[11px] text-link dark:text-darklink border-b border-border/60 dark:border-darkborder/60 whitespace-nowrap sticky left-0 z-10 bg-card'
        style={{ gridColumn: 1, gridRow: rowOf(h) }}>
        <div className='font-medium'>{pad2(h)}:00</div>
        <div className='opacity-60'>{pad2(h)}:30</div>
      </div>,
    )
  }

  // Body: one cell per (subcolumn, hour). Same-professional sobre-turnos side by side.
  for (const h of hours) {
    flat.forEach((f) => {
      f.cols.forEach((c, j) => {
        const col = f.startCol + j
        const list = (buckets.get(f.ds)?.get(c.resourceId)?.get(h) ?? [])
          .slice()
          .sort((a, b) => a.start.getTime() - b.start.getTime())
        const lw = lunchFor(f.day, c)
        const isLunch = !!lw && lw.startMin < (h + 1) * 60 && lw.endMin > h * 60 && list.length === 0
        cells.push(
          <div
            key={`c-${f.ds}-${col}-${h}`}
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
                        dateStr: f.ds,
                        startMin: h * 60,
                        sucursal: c.sucursal || null,
                        professionalId: profIdOf(c.resourceId) || null,
                      })
                  }
                : undefined
            }
            className={`p-1 border-b border-border/60 dark:border-darkborder/60 ${
              j === 0 ? 'border-l border-border dark:border-darkborder' : 'border-l border-border/40 dark:border-darkborder/40'
            }`}
            style={{ gridColumn: col, gridRow: rowOf(h) }}>
            {isLunch ? (
              <div className='h-full rounded-md bg-gray-100 dark:bg-white/5 text-link dark:text-darklink text-[9px] font-medium uppercase tracking-wide flex items-center justify-center py-2'>
                {lunchLabel}
              </div>
            ) : list.length > 0 ? (
              <div className='flex items-stretch gap-1'>{list.map(renderCard)}</div>
            ) : (
              <button
                type='button'
                onClick={() => {
                  const start = dateAtHour(f.day, h)
                  const end = new Date(start.getTime() + 30 * 60000)
                  onCreate(start, end, c.sucursal || undefined, profIdOf(c.resourceId))
                }}
                aria-label={newLabel}
                className='w-full h-full min-h-[52px] rounded-md hover:bg-primary/5 transition-colors'
              />
            )}
          </div>,
        )
      })
    })
  }

  // Each subcolumn keeps a readable min width; the week scrolls horizontally when
  // the working professionals across the days exceed the viewport (Andrés #14).
  const SUB_MIN = 150
  const totalSubcols = flat.reduce((n, f) => n + f.cols.length, 0)
  const gridTemplateColumns = `56px repeat(${totalSubcols}, minmax(${SUB_MIN}px, 1fr))`
  const gridTemplateRows = `${DAY_H}px ${SUB_H}px repeat(${hours.length}, minmax(56px, auto))`
  const minWidth = 56 + totalSubcols * SUB_MIN

  return (
    // Bounded, self-contained scroll box: both scrollbars stay on screen so a wide
    // (many professionals) week is reachable without scrolling the whole page down,
    // while the day + subcolumn headers (top) and the time column (left) stay pinned.
    <div
      ref={scrollRef}
      className='rounded-lg border border-border dark:border-darkborder bg-card overflow-auto max-h-[calc(100vh-210px)] cb-hscroll'>
      <div className='grid' style={{ gridTemplateColumns, gridTemplateRows, minWidth }}>
        {cells}
      </div>
    </div>
  )
}
