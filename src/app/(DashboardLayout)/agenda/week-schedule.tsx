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
  cardText?: (status: string) => string
  sucursalLabel: (s: string) => string
  sucursalColor: (s: string) => string
  locale: string
  lunchLabel: string
  newLabel: string
  emptyLabel: string
  // Time-grid granularity in minutes (5/10/15/20/30/60) — drives the proportional
  // grid + card sizing (Andrés #14).
  scaleMin: number
  // Drag-reschedule (Andrés #19-C): dropping a card onto a cell moves it to that
  // day (dateStr) + exact minute (startMin) + subcolumn (professional/sucursal).
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
  cardText,
  sucursalLabel,
  sucursalColor,
  locale,
  lunchLabel,
  newLabel,
  emptyLabel,
  scaleMin,
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

  // Vertical range + proportional geometry (Andrés #14): a fixed pixel height per
  // SCALE slot, so changing the scale really changes the grid, and cards are
  // positioned/sized by their exact minutes (not per whole hour).
  const minOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()
  let startMin = 8 * 60
  let endMin = 20 * 60
  for (const e of turnos) {
    startMin = Math.min(startMin, minOfDay(e.start))
    endMin = Math.max(endMin, minOfDay(e.end))
  }
  startMin = Math.floor(startMin / 60) * 60
  endMin = Math.ceil(endMin / 60) * 60
  const SLOT_PX = 40
  const pxPerMin = SLOT_PX / scaleMin
  const totalPx = Math.max(SLOT_PX, (endMin - startMin) * pxPerMin)
  const slots: number[] = []
  for (let m = startMin; m < endMin; m += scaleMin) slots.push(m)
  const fmtMin = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
  const snapMinute = (clientY: number, rectTop: number) =>
    startMin + Math.max(0, Math.floor((clientY - rectTop) / pxPerMin / scaleMin)) * scaleMin

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

  // Bucket turnos per (dayKey|columnId); layout (lanes) computed per subcolumn.
  const bucket = new Map<string, CalendarEvent[]>()
  for (const e of turnos) {
    const ds = toKey(e.start)
    const f = flat.find((x) => x.ds === ds)
    if (!f) continue
    const rid = resourceIdFor(e, f.colIds)
    const key = `${ds}|${rid}`
    const arr = bucket.get(key)
    if (arr) arr.push(e)
    else bucket.set(key, [e])
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

  const dateAtMin = (day: Date, min: number) => {
    const d = new Date(day)
    d.setHours(Math.floor(min / 60), min % 60, 0, 0)
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

  const DAY_H = 46 // fixed height of the day-header row (row 1)
  const SUB_H = 30 // fixed height of the subcolumn-header row (row 2)

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

  // Row 3: the single proportional body row. Time gutter (col 1) + one relative
  // column per subcolumn with grid lines, a clickable free area, the lunch block
  // and absolutely-positioned cards.
  cells.push(
    <div
      key='gutter-body'
      className='relative sticky left-0 z-10 bg-card border-r border-border dark:border-darkborder'
      style={{ gridColumn: 1, gridRow: 3 }}>
      {slots.map((m, i) => (
        <div
          key={m}
          className={`absolute right-2 whitespace-nowrap ${
            m % 60 === 0 ? 'text-[11px] font-semibold text-dark dark:text-white' : 'text-[9px] text-link/70 dark:text-darklink/70'
          }`}
          style={{ top: i * SLOT_PX - 6 }}>
          {fmtMin(m)}
        </div>
      ))}
    </div>,
  )
  flat.forEach((f) => {
    f.cols.forEach((c, j) => {
      const col = f.startCol + j
      const colTurnos = bucket.get(`${f.ds}|${c.resourceId}`) ?? []
      const layout = computeLayout(colTurnos)
      const lw = lunchFor(f.day, c)
      const profId = profIdOf(c.resourceId) || null
      cells.push(
        <div
          key={`body-${f.ds}-${col}`}
          className={`relative ${
            j === 0 ? 'border-l border-border dark:border-darkborder' : 'border-l border-border/40 dark:border-darkborder/40'
          }`}
          style={{ gridColumn: col, gridRow: 3 }}
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
                    dateStr: f.ds,
                    startMin: snapMinute(ev.clientY, rect.top),
                    sucursal: c.sucursal || null,
                    professionalId: profId,
                  })
                }
              : undefined
          }>
          {slots.map((m, i) => (
            <div
              key={m}
              className='absolute inset-x-0 border-b border-border/50 dark:border-darkborder/40 pointer-events-none'
              style={{ top: i * SLOT_PX, height: SLOT_PX }}
            />
          ))}
          <button
            type='button'
            aria-label={newLabel}
            className='absolute inset-0 w-full h-full hover:bg-primary/5 transition-colors'
            onClick={(ev) => {
              const rect = ev.currentTarget.getBoundingClientRect()
              const min = snapMinute(ev.clientY, rect.top)
              const start = dateAtMin(f.day, min)
              const end = new Date(start.getTime() + scaleMin * 60000)
              onCreate(start, end, c.sucursal || undefined, profId ?? undefined)
            }}
          />
          {lw && (
            <div
              className='absolute inset-x-0.5 z-10 rounded-md bg-gray-100 dark:bg-white/5 text-link dark:text-darklink text-[9px] font-medium uppercase tracking-wide flex items-center justify-center'
              style={{ top: (lw.startMin - startMin) * pxPerMin, height: Math.max(12, (lw.endMin - lw.startMin) * pxPerMin) }}>
              {lunchLabel}
            </div>
          )}
          {colTurnos.map((e) => {
            const lay = layout.get(e.id) ?? { lane: 0, lanes: 1 }
            const top = (minOfDay(e.start) - startMin) * pxPerMin
            const height = Math.max(16, (minOfDay(e.end) - minOfDay(e.start)) * pxPerMin)
            const widthPct = 100 / lay.lanes
            const leftPct = lay.lane * widthPct
            const tc = treatmentColor(e.treatmentSlug, treatmentName(e.treatmentSlug))
            const tall = height >= 42
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
                <span className='shrink-0 self-stretch' style={{ width: 5, backgroundColor: tc }} />
                <span className='flex-1 min-w-0 py-0.5 px-1 overflow-hidden'>
                  <span className='block font-bold text-[10px] leading-tight truncate'>{e.patientName || e.title}</span>
                  {tall && (
                    <span className='block text-[9px] font-semibold leading-tight'>
                      {fmtTime(e.start)} · {fmtTime(e.end)}
                    </span>
                  )}
                  {tall && e.treatmentSlug && (
                    <span className='block text-[9px] leading-tight truncate opacity-90'>
                      {treatmentName(e.treatmentSlug)}
                    </span>
                  )}
                </span>
                {e.charged && (
                  <span
                    className='shrink-0 self-stretch flex items-center justify-center text-white font-bold text-xs'
                    style={{ width: 16, backgroundColor: PAY_GREEN }}
                    title='$'>
                    $
                  </span>
                )}
              </button>
            )
          })}
        </div>,
      )
    })
  })

  // Each subcolumn keeps a readable min width; the week scrolls horizontally when
  // the working professionals across the days exceed the viewport (Andrés #14).
  const SUB_MIN = 150
  const totalSubcols = flat.reduce((n, f) => n + f.cols.length, 0)
  const gridTemplateColumns = `56px repeat(${totalSubcols}, minmax(${SUB_MIN}px, 1fr))`
  const gridTemplateRows = `${DAY_H}px ${SUB_H}px ${totalPx}px`
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
