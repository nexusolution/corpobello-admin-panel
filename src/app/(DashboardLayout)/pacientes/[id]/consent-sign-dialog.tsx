'use client'

import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  signConsent,
  uploadConsentSignature,
  type Consent,
} from '@/lib/data/consents'
import { generateConsentPdf } from '@/lib/data/consent-pdf'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const CANVAS_W = 460
const CANVAS_H = 160

// SHA-256 hex of a string (Web Crypto) — used for the consent integrity hash.
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Best-effort fetch of the signer's public IP for the audit trail.
async function fetchClientIp(): Promise<string | null> {
  try {
    const res = await fetch('/api/client-ip', { cache: 'no-store' })
    const json = (await res.json()) as { ip?: string }
    return json.ip || null
  } catch {
    return null
  }
}

// Sign a pending consent: patient draws their signature, we store the image,
// mark it firmado, and generate the signed PDF (with the signature embedded).
export function ConsentSignDialog({
  open,
  onClose,
  onSigned,
  consent,
}: {
  open: boolean
  onClose: () => void
  onSigned: () => void
  consent: Consent | null
}) {
  const { t } = useTranslation() as { t: TFn }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset the pad + name each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setSignerName('')
    setHasDrawn(false)
    // Defer so the canvas is mounted.
    const id = window.setTimeout(() => clearPad(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  function ctx(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext('2d') ?? null
  }
  function clearPad() {
    const c = canvasRef.current
    const g = ctx()
    if (!c || !g) return
    g.clearRect(0, 0, c.width, c.height)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, c.width, c.height)
    g.strokeStyle = '#1f2937'
    g.lineWidth = 2
    g.lineCap = 'round'
    g.lineJoin = 'round'
    setHasDrawn(false)
  }
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = ctx()
    if (!g) return
    drawing.current = true
    const p = point(e)
    g.beginPath()
    g.moveTo(p.x, p.y)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const g = ctx()
    if (!g) return
    const p = point(e)
    g.lineTo(p.x, p.y)
    g.stroke()
    if (!hasDrawn) setHasDrawn(true)
  }
  function onUp() {
    drawing.current = false
  }

  async function sign() {
    if (!consent || !signerName.trim() || !hasDrawn) return
    setSaving(true)
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    // Audit trail (Etapa 4): integrity hash of the signed content + signer IP +
    // user agent, captured at sign time. Best-effort — never blocks signing.
    const [documentHash, ip] = await Promise.all([
      sha256Hex(`${consent.id}|${consent.body}|${signerName.trim()}|${dataUrl}`).catch(
        () => null,
      ),
      fetchClientIp(),
    ])
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null
    // Store the signature image (best-effort), then mark signed + build the PDF.
    const { path } = await uploadConsentSignature(consent.id, dataUrl)
    const { error } = await signConsent(consent.id, signerName.trim(), path, {
      documentHash,
      ip,
      userAgent,
    })
    if (error) {
      setSaving(false)
      await Swal.fire({ icon: 'error', title: t('consent.sign.error'), text: error })
      return
    }
    await generateConsentPdf(consent.id, dataUrl)
    setSaving(false)
    onSigned()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className='max-w-xl'>
        <DialogHeader>
          <DialogTitle>{consent?.title ?? t('consent.sign.title')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='max-h-48 overflow-y-auto rounded-md border border-border dark:border-darkborder p-3 text-sm text-dark dark:text-white whitespace-pre-wrap'>
            {consent?.body}
          </div>

          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('consent.sign.name')}</label>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder={t('consent.sign.namePlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          <div>
            <div className='flex items-center justify-between mb-1'>
              <label className='text-xs font-medium text-dark dark:text-white'>{t('consent.sign.signature')}</label>
              <button type='button' onClick={clearPad} className='text-xs text-link dark:text-darklink hover:text-error'>
                {t('consent.sign.clear')}
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              className='w-full rounded-md border border-border dark:border-darkborder touch-none bg-white'
              style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
            />
          </div>
        </div>

        <div className='mt-4 flex items-center justify-end gap-2'>
          <button type='button' onClick={onClose} className='px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
            {t('consent.sign.cancel')}
          </button>
          <button
            type='button'
            onClick={sign}
            disabled={saving || !signerName.trim() || !hasDrawn}
            className='px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors'>
            {saving ? t('consent.sign.saving') : t('consent.sign.confirm')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
