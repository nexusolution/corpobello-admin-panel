'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'

// A lightweight, styled tooltip that follows the mouse — a friendlier replacement
// for the native `title=""` popup on agenda cards / month dots (Andrés 2026-09-28).
// Driven imperatively via a ref so hovering a card never re-renders the (big)
// calendar: only this tiny component updates. Render one instance per view and call
// `ref.current.show(text, event)` / `.hide()` from the card's mouse handlers.
export type CursorTooltipHandle = {
  show: (text: string, e: { clientX: number; clientY: number }) => void
  hide: () => void
}

export const CursorTooltip = forwardRef<CursorTooltipHandle>(function CursorTooltip(_props, ref) {
  const [state, setState] = useState<{ text: string; x: number; y: number } | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      show: (text, e) => {
        if (!text) return
        const vw = typeof window !== 'undefined' ? window.innerWidth : 9999
        const vh = typeof window !== 'undefined' ? window.innerHeight : 9999
        // Offset from the cursor, clamped so it never runs off the viewport edges.
        const x = Math.max(8, Math.min(e.clientX + 14, vw - 300))
        const y = Math.max(8, Math.min(e.clientY + 18, vh - 60))
        setState({ text, x, y })
      },
      hide: () => setState(null),
    }),
    [],
  )

  if (!state) return null
  return (
    <div
      className='pointer-events-none fixed z-[9999] max-w-[280px] rounded-md bg-[#2a3547] px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg ring-1 ring-black/10'
      style={{ left: state.x, top: state.y }}>
      {state.text}
    </div>
  )
})
