'use client'

import { useEffect, type RefObject } from 'react'

// User-friendly horizontal control for a scroll container (Andrés 2026-09-18):
//   · mouse wheel scrolls horizontally when there is no vertical room (or with
//     Shift held), so one wheel sweep moves across the content;
//   · click-and-drag pans left/right; a real click (moved < 6px) still fires, but
//     a drag swallows the trailing click so it never activates the control beneath.
// Pair it with the `.cb-hscroll` class for an always-visible, styled scrollbar.
export function useHorizontalDragScroll(
  ref: RefObject<HTMLElement | null>,
  opts: { drag?: boolean } = {},
) {
  const drag = opts.drag !== false
  useEffect(() => {
    const cont = ref.current
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
    cont.addEventListener('wheel', onWheel, { passive: false })

    let down = false
    let moved = false
    let startX = 0
    let startLeft = 0
    const onDown = (e: PointerEvent) => {
      if (!drag || e.button !== 0) return
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
        const swallow = (ev: MouseEvent) => {
          ev.stopPropagation()
          ev.preventDefault()
          window.removeEventListener('click', swallow, true)
        }
        window.addEventListener('click', swallow, true)
      }
    }
    if (drag) {
      cont.addEventListener('pointerdown', onDown)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', endDrag)
    }

    return () => {
      cont.removeEventListener('wheel', onWheel)
      cont.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [ref, drag])
}
