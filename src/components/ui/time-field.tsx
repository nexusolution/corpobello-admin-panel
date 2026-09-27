'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// 24h time picker (Andrés #15). A native <input type=time> renders AM/PM on an
// English-locale machine regardless of lang/UI language, so this control always
// shows/stores HH:MM. Options run at `step` minutes from `min` to `max`; a value
// off that grid still displays correctly on the trigger. It renders only the
// control (no <label>), so callers wrap it with their own label as needed.
export function TimeField({
  value,
  onChange,
  className,
  minMinutes = 6 * 60,
  maxMinutes = 22 * 60,
  step = 5,
  placeholder = '--:--',
  defaultMinutes,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  minMinutes?: number
  maxMinutes?: number
  step?: number
  placeholder?: string
  // When there is no value yet (a new turno), open the list positioned at this
  // minute of the day instead of the earliest option — the day's real availability
  // start, so the secretary doesn't scroll up from 06:00 (Andrés #20).
  defaultMinutes?: number
}) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const options = useMemo(() => {
    const out: { min: number; label: string }[] = []
    for (let m = minMinutes; m <= maxMinutes; m += step) {
      out.push({
        min: m,
        label: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      })
    }
    return out
  }, [minMinutes, maxMinutes, step])
  // On open, position the list: an existing value is CENTERED (editing a 10:00 turno
  // opens at 10:00). With no value (a new turno) but a defaultMinutes hint, position
  // that time near the TOP so the list "starts from" the day's real availability
  // (Andrés #20). Otherwise it stays at the earliest option. Runs on a frame so the
  // popover content is laid out and scrollable first.
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      const cont = listRef.current
      if (!cont) return
      const sel = cont.querySelector<HTMLElement>('[data-selected="true"]')
      if (sel) {
        cont.scrollTop = sel.offsetTop - cont.clientHeight / 2 + sel.clientHeight / 2
        return
      }
      if (defaultMinutes != null) {
        // Snap the hint onto the option grid, clamped to the list's range.
        const snapped = Math.min(
          maxMinutes,
          Math.max(minMinutes, Math.round(defaultMinutes / step) * step),
        )
        const hint = cont.querySelector<HTMLElement>(`[data-min="${snapped}"]`)
        if (hint) cont.scrollTop = hint.offsetTop
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [open, defaultMinutes, minMinutes, maxMinutes, step])

  const trigger =
    'w-full flex items-center justify-between gap-2 text-left rounded-md border border-border dark:border-darkborder bg-background px-2.5 py-2 text-sm text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type='button' className={className ? `${trigger} ${className}` : trigger}>
          <span>{value || placeholder}</span>
          <Icon
            icon='solar:clock-circle-line-duotone'
            height={16}
            width={16}
            className='text-link dark:text-darklink shrink-0'
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-[140px] p-1' align='start'>
        <div ref={listRef} className='max-h-60 overflow-y-auto'>
          {options.map((o) => (
            <button
              key={o.label}
              type='button'
              data-min={o.min}
              data-selected={o.label === value}
              onClick={() => {
                onChange(o.label)
                setOpen(false)
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded text-sm hover:bg-lightprimary text-dark dark:text-white ${o.label === value ? 'bg-lightprimary/60' : ''}`}>
              {o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
