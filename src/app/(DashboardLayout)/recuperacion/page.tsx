'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'

import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { RoleGate } from '@/lib/auth/RoleGate'
import { fetchLeads } from '@/app/(DashboardLayout)/kanban/data'
import type { Lead, LeadStatus } from '@/app/(DashboardLayout)/kanban/mock-data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// A lead is "recoverable" when it's still in the early/mid funnel (not booked,
// not closed) and has gone quiet for at least this long.
const STALE_HOURS = 48
const PAGE_SIZE = 15
const IN_FUNNEL: LeadStatus[] = ['nuevo', 'en_conversacion', 'cotizado', 'sin_respuesta']

const STATUS_KEY: Partial<Record<LeadStatus, TranslationKey>> = {
  nuevo: 'kanban.col.nuevo',
  en_conversacion: 'kanban.col.enConversacion',
  cotizado: 'kanban.col.cotizado',
  sin_respuesta: 'kanban.col.sinRespuesta',
}

const SUCURSAL_LABELS: Record<string, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

// Condensed page list with ellipsis: always first + last, the current page and
// its neighbours, and '…' for the gaps. e.g. 1 … 4 [5] 6 … 20
function pageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < total - 1) out.push('…')
  out.push(total)
  return out
}

function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 ? `https://wa.me/${digits}` : null
}

function lastActivity(hours: number | null, t: TFn): string {
  if (hours == null) return t('recovery.noActivity')
  if (hours >= 24) return t('recovery.daysAgo', { n: String(Math.floor(hours / 24)) })
  return t('recovery.hoursAgo', { n: String(Math.floor(hours)) })
}

function Row({ lead, t }: { lead: Lead; t: TFn }) {
  const href = whatsappHref(lead.phoneFull)
  const statusKey = STATUS_KEY[lead.status]
  return (
    <div className='flex items-center gap-3 py-3 flex-wrap border-b border-border dark:border-darkborder last:border-0'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium text-dark dark:text-white truncate'>{lead.patientName}</p>
        <p className='text-xs text-link dark:text-darklink'>
          ···{lead.phoneLast4}
          {lead.sucursal ? ` · ${SUCURSAL_LABELS[lead.sucursal] ?? lead.sucursal}` : ''}
        </p>
      </div>
      <div className='hidden sm:block text-xs text-link dark:text-darklink w-40 truncate'>
        {lead.treatmentLabel}
      </div>
      <div className='w-32 shrink-0'>
        {statusKey && (
          <span className='inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-lightprimary text-primary'>
            {t(statusKey)}
          </span>
        )}
      </div>
      <div className='w-28 shrink-0 text-xs text-link dark:text-darklink'>
        {lastActivity(lead.lastActivityHoursAgo, t)}
      </div>
      <div className='shrink-0'>
        {href ? (
          <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-white text-sm font-medium hover:brightness-95 transition'>
            <Icon icon='tabler:brand-whatsapp' height={16} width={16} />
            {t('recovery.contact')}
          </a>
        ) : (
          <span className='text-xs text-link dark:text-darklink italic'>{t('recovery.noPhone')}</span>
        )}
      </div>
    </div>
  )
}

export default function RecuperacionPage() {
  const { t } = useTranslation()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchLeads().then(({ data, error }) => {
      if (!active) return
      setLeads(data)
      setError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const cold = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            IN_FUNNEL.includes(l.status) &&
            l.lastActivityHoursAgo != null &&
            l.lastActivityHoursAgo >= STALE_HOURS,
        )
        .sort((a, b) => (b.lastActivityHoursAgo ?? 0) - (a.lastActivityHoursAgo ?? 0)),
    [leads],
  )

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cold.filter(
      (l) =>
        (!statusFilter || l.status === statusFilter) &&
        (!q ||
          l.patientName.toLowerCase().includes(q) ||
          l.phoneFull.replace(/\D/g, '').includes(q.replace(/\D/g, ''))),
    )
  }, [cold, query, statusFilter])

  const [page, setPage] = useState(1)
  // Reset to the first page whenever the visible set changes (data or filters).
  useEffect(() => setPage(1), [filtered.length, query, statusFilter])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <RoleGate allow={['admin', 'operador']}>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='recovery.title'
          currentKey='recovery.breadcrumb.current'
          subtitleKey='recovery.subtitle'
          icon='solar:refresh-circle-line-duotone'
        />

        <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
          {loading ? (
            <div className='py-14 flex justify-center'>
              <Icon icon='tabler:loader-2' height={28} width={28} className='text-primary animate-spin' />
            </div>
          ) : error ? (
            <div className='py-14 flex flex-col items-center gap-2 text-center'>
              <Icon icon='solar:cloud-cross-line-duotone' height={28} width={28} className='text-error' />
              <p className='text-sm text-link dark:text-darklink'>{t('recovery.error')}</p>
            </div>
          ) : cold.length === 0 ? (
            <div className='py-14 flex flex-col items-center gap-2 text-center'>
              <div className='size-14 rounded-full bg-lightsuccess/60 flex items-center justify-center'>
                <Icon icon='solar:check-circle-line-duotone' height={26} width={26} className='text-success' />
              </div>
              <p className='text-base font-semibold text-dark dark:text-white'>{t('recovery.empty.title')}</p>
              <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('recovery.empty.body')}</p>
            </div>
          ) : (
            <>
              {/* Filters: search by name/phone + status */}
              <div className='flex items-center gap-3 mb-4 flex-wrap'>
                <div className='relative flex-1 min-w-[200px]'>
                  <Icon icon='solar:magnifer-line-duotone' height={15} width={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink' />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('recovery.searchPlaceholder')}
                    className='w-full rounded-md border border-border dark:border-darkborder bg-background pl-9 pr-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className='pl-2.5 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'>
                  <option value=''>{t('recovery.allStatuses')}</option>
                  {IN_FUNNEL.map((s) => {
                    const k = STATUS_KEY[s]
                    return (
                      <option key={s} value={s}>{k ? t(k) : s}</option>
                    )
                  })}
                </select>
              </div>

              <p className='text-sm text-link dark:text-darklink mb-3'>
                {t('recovery.count', { n: String(filtered.length) })}
              </p>
              {filtered.length === 0 ? (
                <p className='text-sm text-link dark:text-darklink italic py-6 text-center'>
                  {t('recovery.noMatches')}
                </p>
              ) : (
              <div>
                {pageItems.map((lead) => (
                  <Row key={lead.id} lead={lead} t={t} />
                ))}
              </div>
              )}
              {totalPages > 1 && (
                <div className='flex items-center justify-center gap-1.5 pt-5 flex-wrap'>
                  <button
                    type='button'
                    aria-label={t('recovery.prev')}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className='h-9 w-9 inline-flex items-center justify-center rounded-md border border-border dark:border-darkborder text-dark dark:text-white hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                    <Icon icon='tabler:chevron-left' height={16} width={16} />
                  </button>
                  {pageRange(page, totalPages).map((p, i) =>
                    p === '…' ? (
                      <span
                        key={`dots-${i}`}
                        className='h-9 w-9 inline-flex items-center justify-center text-link dark:text-darklink select-none'>
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type='button'
                        onClick={() => setPage(p)}
                        aria-current={p === page ? 'page' : undefined}
                        className={`h-9 min-w-9 px-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                          p === page
                            ? 'bg-primary text-white'
                            : 'border border-border dark:border-darkborder text-dark dark:text-white hover:bg-muted/40'
                        }`}>
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    type='button'
                    aria-label={t('recovery.next')}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className='h-9 w-9 inline-flex items-center justify-center rounded-md border border-border dark:border-darkborder text-dark dark:text-white hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                    <Icon icon='tabler:chevron-right' height={16} width={16} />
                  </button>
                </div>
              )}
            </>
          )}

          <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
            <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
            {t('recovery.note')}
          </p>
        </div>
      </div>
    </RoleGate>
  )
}
