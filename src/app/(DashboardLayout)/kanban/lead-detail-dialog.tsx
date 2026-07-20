'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  COLUMNS,
  SUCURSAL_LABELS,
  type ComprobanteStatus,
  type Lead,
  type LeadStatus,
  type Sucursal,
} from './mock-data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// Convert hours-ago to a short relative string. Falls back to days for > 48h.
function relativeTime(hoursAgo: number, t: TFn): string {
  if (hoursAgo < 0.05) return t('kanban.detail.time.now')
  if (hoursAgo < 1) {
    return t('kanban.detail.time.minutesAgo', { n: String(Math.round(hoursAgo * 60)) })
  }
  if (hoursAgo < 48) {
    return t('kanban.detail.time.hoursAgo', { n: String(Math.round(hoursAgo)) })
  }
  return t('kanban.detail.time.daysAgo', { n: String(Math.round(hoursAgo / 24)) })
}

function formatMoney(amount: number, currency: 'ARS' | 'USD'): string {
  if (currency === 'USD') return `USD ${amount.toLocaleString('en-US')}`
  return `$${amount.toLocaleString('es-AR')}`
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  nuevo: 'bg-info',
  en_conversacion: 'bg-warning',
  cotizado: 'bg-secondary',
  reservado: 'bg-primary',
  comprobante: 'bg-purple-500',
  confirmado: 'bg-success',
  sin_respuesta: 'bg-gray-400',
  pausado: 'bg-gray-400',
  archivado: 'bg-gray-400',
  cancelado: 'bg-error',
}

const COMPROBANTE_BADGE: Record<ComprobanteStatus, { className: string; key: TranslationKey }> = {
  pending: { className: 'bg-lightwarning text-warning', key: 'kanban.detail.comprobanteStatus.pending' },
  received: { className: 'bg-lightprimary text-primary', key: 'kanban.detail.comprobanteStatus.received' },
  verified: { className: 'bg-lightsuccess text-success', key: 'kanban.detail.comprobanteStatus.verified' },
}

function SectionTitle({
  icon,
  children,
}: {
  icon: string
  children: React.ReactNode
}) {
  return (
    <h3 className='flex items-center gap-2 text-sm font-semibold text-dark dark:text-white uppercase tracking-wide mb-3'>
      <Icon icon={icon} height={16} width={16} className='text-primary' />
      {children}
    </h3>
  )
}

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  onChangeStatus,
  onArchive,
  onAddNote,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (next: boolean) => void
  onChangeStatus: (id: string, status: LeadStatus) => void
  onArchive: (id: string) => void
  onAddNote: (id: string, text: string) => void
}) {
  const { t } = useTranslation()
  const [noteDraft, setNoteDraft] = useState('')
  const [copied, setCopied] = useState(false)

  // Reset transient UI state every time the dialog opens for a new lead.
  useEffect(() => {
    if (open) {
      setNoteDraft('')
      setCopied(false)
    }
  }, [open, lead?.id])

  if (!lead) return null

  const statusColumn = COLUMNS.find((c) => c.id === lead.status)
  const statusLabel = statusColumn ? t(statusColumn.nameKey) : lead.status

  function copyPhone() {
    if (!lead?.phoneFull) return
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(lead.phoneFull).catch(() => undefined)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function whatsappHref(): string {
    const digits = lead!.phoneFull.replace(/[^\d]/g, '')
    return `https://wa.me/${digits}`
  }

  function handleAddNote() {
    const trimmed = noteDraft.trim()
    if (!trimmed) return
    onAddNote(lead!.id, trimmed)
    setNoteDraft('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='
          !max-w-[100vw] sm:!max-w-2xl
          !w-screen sm:!w-auto
          !h-[100dvh] sm:!h-auto
          !max-h-[100dvh] sm:!max-h-[90vh]
          !rounded-none sm:!rounded-lg
          !left-0 sm:!left-1/2
          !top-0 sm:!top-1/2
          !translate-x-0 sm:!-translate-x-1/2
          !translate-y-0 sm:!-translate-y-1/2
          p-0 overflow-hidden flex flex-col
        '>
        <DialogHeader className='border-b border-border dark:border-darkborder px-6 py-5 shrink-0'>
          <DialogTitle className='text-base text-dark dark:text-white inline-flex items-center gap-2'>
            <Icon icon='solar:user-id-line-duotone' height={20} width={20} className='text-primary' />
            {t('kanban.detail.title')}
          </DialogTitle>
        </DialogHeader>

        <div className='scrollbar-hover overflow-y-auto px-6 py-5 space-y-6 flex-1'>
          {/* ---------- 1. Header — identity + status + last activity ---------- */}
          <section>
            <div className='flex items-start gap-4'>
              <div className='h-14 w-14 rounded-full bg-lightprimary text-primary flex items-center justify-center text-base font-semibold shrink-0'>
                {initials(lead.patientName)}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <h2 className='text-lg font-semibold text-dark dark:text-white'>
                    {lead.patientName}
                  </h2>
                  <span className='inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted/60 dark:bg-darkmuted/40 text-dark dark:text-white'>
                    <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[lead.status]}`} />
                    {statusLabel}
                  </span>
                </div>

                <div className='flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-1 mt-1 text-sm text-link dark:text-darklink'>
                  <button
                    type='button'
                    onClick={copyPhone}
                    aria-label={t('kanban.detail.contactCopy')}
                    className='inline-flex items-center gap-1.5 hover:text-primary transition-colors self-start whitespace-nowrap'>
                    <Icon icon='solar:phone-line-duotone' height={14} width={14} />
                    <span>{lead.phoneFull}</span>
                    <Icon
                      icon={copied ? 'tabler:check' : 'solar:copy-line-duotone'}
                      height={12}
                      width={12}
                      className={copied ? 'text-success' : 'opacity-60'}
                    />
                  </button>
                  <span className='hidden sm:inline text-link/40'>·</span>
                  <span className='inline-flex items-center gap-1'>
                    <Icon icon='solar:map-point-line-duotone' height={14} width={14} />
                    {lead.sucursal ? SUCURSAL_LABELS[lead.sucursal] : '—'}
                  </span>
                </div>

                <div className='flex items-center gap-2 mt-2 flex-wrap'>
                  {lead.tags.map((tag) => (
                    <span
                      key={tag.label}
                      className='px-2 py-0.5 rounded-full text-xs font-medium'
                      style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}>
                      {tag.label}
                    </span>
                  ))}
                  <span
                    title={t('kanban.detail.lastActivity')}
                    className='inline-flex items-center gap-1 text-xs text-link dark:text-darklink ml-auto'>
                    <Icon icon='solar:clock-circle-line-duotone' height={14} width={14} />
                    {relativeTime(lead.lastActivityHoursAgo, t)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- 2. Treatment + Quote ---------- */}
          <section>
            <SectionTitle icon='solar:bill-list-line-duotone'>{t('kanban.detail.section.treatment')}</SectionTitle>
            <div className='rounded-md border border-border dark:border-darkborder p-4'>
              <div className='text-sm font-semibold text-dark dark:text-white'>
                {lead.treatmentLabel}
              </div>
              {lead.quote ? (
                <div className='mt-3 space-y-1.5 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-link dark:text-darklink'>
                      {t('kanban.detail.quote.list')}
                    </span>
                    <span className='text-dark dark:text-white font-medium'>
                      {formatMoney(lead.quote.listAmount, lead.quote.currency)}
                    </span>
                  </div>
                  {lead.quote.efectivoAmount !== undefined && (
                    <div className='flex justify-between'>
                      <span className='text-link dark:text-darklink'>
                        {t('kanban.detail.quote.efectivo')}
                      </span>
                      <span className='text-success font-medium'>
                        {formatMoney(lead.quote.efectivoAmount, lead.quote.currency)}
                      </span>
                    </div>
                  )}
                  <div className='text-xs text-link dark:text-darklink pt-1'>
                    {t('kanban.detail.quote.sent', {
                      time: relativeTime(lead.quote.sentAtHoursAgo, t),
                    })}
                  </div>
                </div>
              ) : (
                <p className='text-sm text-link dark:text-darklink italic mt-2'>
                  {t('kanban.detail.quote.notSent')}
                </p>
              )}
            </div>
          </section>

          {/* ---------- 3. Photos ---------- */}
          <section>
            <SectionTitle icon='solar:gallery-line-duotone'>{t('kanban.detail.section.photos')}</SectionTitle>
            {lead.photos && lead.photos.length > 0 ? (
              <div className='grid grid-cols-3 gap-2'>
                {lead.photos.map((photo, idx) => (
                  <a
                    key={`${photo.url}-${idx}`}
                    href={photo.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='group relative aspect-square rounded-md overflow-hidden border border-border dark:border-darkborder'>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className='h-full w-full object-cover group-hover:scale-105 transition-transform'
                    />
                    <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5'>
                      <span className='text-xs text-white truncate block'>
                        {photo.label}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className='text-sm text-link dark:text-darklink italic'>
                {t('kanban.detail.photos.empty')}
              </p>
            )}
          </section>

          {/* ---------- 4. Conversation summary ---------- */}
          <section>
            <SectionTitle icon='solar:chat-round-line-duotone'>{t('kanban.detail.section.conversation')}</SectionTitle>
            {lead.conversation ? (
              <div className='rounded-md border border-border dark:border-darkborder p-4 space-y-2 text-sm'>
                <div>
                  <span className='text-link dark:text-darklink'>
                    {t('kanban.detail.conversation.stage')}:
                  </span>{' '}
                  <span className='text-dark dark:text-white font-medium'>
                    {lead.conversation.lastStage}
                  </span>
                </div>
                <div>
                  <span className='text-link dark:text-darklink'>
                    {t('kanban.detail.conversation.exchanges')}:
                  </span>{' '}
                  <span className='text-dark dark:text-white font-medium'>
                    {lead.conversation.exchangeCount}
                  </span>
                </div>
                <div>
                  <span className='text-link dark:text-darklink'>
                    {t('kanban.detail.conversation.faqTopics')}:
                  </span>{' '}
                  {lead.conversation.faqTopics.length > 0 ? (
                    <span className='inline-flex flex-wrap gap-1 align-middle'>
                      {lead.conversation.faqTopics.map((topic) => (
                        <span
                          key={topic}
                          className='inline-block px-2 py-0.5 rounded-full text-xs bg-muted/60 dark:bg-darkmuted/40 text-dark dark:text-white'>
                          {topic}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className='text-link dark:text-darklink italic'>
                      {t('kanban.detail.conversation.faqEmpty')}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className='text-sm text-link dark:text-darklink italic'>
                {t('kanban.detail.conversation.empty')}
              </p>
            )}
          </section>

          {/* ---------- 5. Reservation + Comprobante ---------- */}
          {(lead.status === 'reservado' ||
            lead.status === 'comprobante' ||
            lead.status === 'confirmado') && (
            <section>
              <SectionTitle icon='solar:calendar-mark-line-duotone'>{t('kanban.detail.section.reservation')}</SectionTitle>
              {lead.reservation ? (
                <div className='rounded-md border border-border dark:border-darkborder p-4 space-y-3 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-link dark:text-darklink'>
                      {t('kanban.detail.reservation.slot')}
                    </span>
                    <span className='text-dark dark:text-white font-medium'>
                      {lead.reservation.slot} · {SUCURSAL_LABELS[lead.reservation.sucursal]}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-link dark:text-darklink'>
                      {t('kanban.detail.reservation.deposit')}
                    </span>
                    <span className='text-dark dark:text-white font-medium'>
                      {formatMoney(
                        lead.reservation.depositAmount,
                        lead.reservation.depositCurrency
                      )}
                    </span>
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-link dark:text-darklink'>
                      {t('kanban.detail.reservation.comprobante')}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        COMPROBANTE_BADGE[lead.reservation.comprobanteStatus].className
                      }`}>
                      {t(COMPROBANTE_BADGE[lead.reservation.comprobanteStatus].key)}
                    </span>
                  </div>
                  {lead.reservation.comprobanteUrl && (
                    <a
                      href={lead.reservation.comprobanteUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='block rounded-md overflow-hidden border border-border dark:border-darkborder'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lead.reservation.comprobanteUrl}
                        alt='Comprobante'
                        className='h-32 w-full object-cover'
                      />
                    </a>
                  )}
                </div>
              ) : (
                <p className='text-sm text-link dark:text-darklink italic'>
                  {t('kanban.detail.reservation.empty')}
                </p>
              )}
            </section>
          )}

          {/* ---------- 6. Internal notes ---------- */}
          <section>
            <SectionTitle icon='solar:notes-line-duotone'>{t('kanban.detail.section.notes')}</SectionTitle>
            <div className='space-y-2 mb-3'>
              {lead.internalNotes && lead.internalNotes.length > 0 ? (
                lead.internalNotes.map((note, idx) => (
                  <div
                    key={idx}
                    className='rounded-md bg-muted/40 dark:bg-darkmuted/40 p-3 text-sm'>
                    <p className='text-dark dark:text-white'>{note.text}</p>
                    <div className='flex items-center justify-between mt-1.5 text-xs text-link dark:text-darklink'>
                      <span>{note.author}</span>
                      <span>{relativeTime(note.createdAtHoursAgo, t)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-sm text-link dark:text-darklink italic'>
                  {t('kanban.detail.notes.empty')}
                </p>
              )}
            </div>
            <div className='flex gap-2'>
              <input
                type='text'
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddNote()
                  }
                }}
                placeholder={t('kanban.detail.notes.addPlaceholder')}
                className='flex-1 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
              <button
                type='button'
                onClick={handleAddNote}
                disabled={!noteDraft.trim()}
                className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
                {t('kanban.detail.notes.add')}
              </button>
            </div>
          </section>
        </div>

        {/* ---------- 7. Footer actions ---------- */}
        {/* Mobile: secondary actions collapse to icon-only with tooltips,
            WhatsApp keeps its label as the primary CTA. */}
        <div className='border-t border-border dark:border-darkborder px-4 sm:px-6 py-4 flex items-center justify-end gap-2 shrink-0'>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={() => onOpenChange(false)}
                aria-label={t('kanban.detail.actions.close')}
                className='inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-md text-sm font-medium text-dark dark:text-white hover:bg-muted/40 dark:hover:bg-darkmuted/40 transition-colors'>
                <Icon icon='solar:close-circle-line-duotone' height={18} width={18} />
                <span className='hidden sm:inline'>
                  {t('kanban.detail.actions.close')}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent className='sm:hidden'>
              {t('kanban.detail.actions.close')}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={() => onArchive(lead.id)}
                aria-label={t('kanban.detail.actions.archive')}
                className='inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-md text-sm font-medium text-link dark:text-darklink hover:text-primary hover:bg-muted/40 dark:hover:bg-darkmuted/40 transition-colors'>
                <Icon icon='solar:archive-line-duotone' height={18} width={18} />
                <span className='hidden sm:inline'>
                  {t('kanban.detail.actions.archive')}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent className='sm:hidden'>
              {t('kanban.detail.actions.archive')}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type='button'
                    aria-label={t('kanban.detail.actions.changeStatus')}
                    className='inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-md text-sm font-medium text-link dark:text-darklink hover:text-primary hover:bg-muted/40 dark:hover:bg-darkmuted/40 transition-colors'>
                    <Icon icon='solar:refresh-line-duotone' height={18} width={18} />
                    <span className='hidden sm:inline'>
                      {t('kanban.detail.actions.changeStatus')}
                    </span>
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className='sm:hidden'>
                {t('kanban.detail.actions.changeStatus')}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align='end' className='w-44'>
              {COLUMNS.map((col) => {
                const isCurrent = col.id === lead.status
                return (
                  <DropdownMenuItem
                    key={col.id}
                    disabled={isCurrent}
                    onClick={() => onChangeStatus(lead.id, col.id)}>
                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${col.dotColor}`} />
                    {t(col.nameKey)}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <a
            href={whatsappHref()}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md text-sm font-medium bg-success text-white hover:bg-success/90 transition-colors'>
            <Icon icon='ic:baseline-whatsapp' height={18} width={18} />
            {t('kanban.detail.actions.whatsapp')}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Type re-exports so the parent doesn't have to import LeadStatus / Sucursal twice.
export type { LeadStatus, Sucursal }