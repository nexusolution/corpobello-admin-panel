'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'

import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { RoleGate } from '@/lib/auth/RoleGate'
import { fetchEvoluciones, type Evolucion } from '@/lib/data/evoluciones'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const PAGE_SIZE = 15

// No dashes (client rule): slug hyphens become spaces.
function prettySlug(slug: string | null): string {
  if (!slug) return ''
  const spaced = slug.replace(/-/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale === 'en' ? 'en-US' : 'es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

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

function StatTile({ value, label, icon, tint }: { value: number; label: string; icon: string; tint: string }) {
  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-4'>
      <div className='flex items-start justify-between'>
        <div>
          <p className='text-2xl font-semibold text-dark dark:text-white'>{value}</p>
          <p className='text-xs text-link dark:text-darklink mt-1'>{label}</p>
        </div>
        <span className={`size-9 rounded-md flex items-center justify-center ${tint}`}>
          <Icon icon={icon} height={18} width={18} />
        </span>
      </div>
    </div>
  )
}

function Row({ ev, t, locale }: { ev: Evolucion; t: TFn; locale: string }) {
  const closed = ev.status === 'cerrada'
  return (
    <div className='flex items-center justify-between gap-3 rounded-md border border-border dark:border-darkborder p-3'>
      <div className='min-w-0'>
        <p className='text-sm font-medium text-dark dark:text-white truncate'>
          {ev.patientName || t('fichas.noPatient')}
        </p>
        <p className='text-xs text-link dark:text-darklink truncate'>
          {ev.treatmentSlug ? prettySlug(ev.treatmentSlug) : t('ficha.session')}
          {' · '}
          {formatDate(ev.sessionDate, locale)}
          {ev.professionalName ? ` · ${ev.professionalName}` : ''}
        </p>
      </div>
      <div className='flex items-center gap-3 shrink-0'>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            closed ? 'bg-lightsuccess text-success' : 'bg-lightwarning text-warning'
          }`}>
          {closed ? t('ficha.status.closed') : t('ficha.status.draft')}
        </span>
        <Link
          href={`/pacientes/${ev.patientId}`}
          className='text-xs font-medium text-primary hover:underline whitespace-nowrap'>
          {t('fichas.open')}
        </Link>
      </div>
    </div>
  )
}

export default function FichasPage() {
  const { t, locale } = useTranslation() as { t: TFn; locale: string }
  const [rows, setRows] = useState<Evolucion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    void fetchEvoluciones().then(({ data, error }) => {
      if (!active) return
      setRows(data)
      setError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(
    () => ({
      total: rows.length,
      closed: rows.filter((r) => r.status === 'cerrada').length,
      draft: rows.filter((r) => r.status === 'borrador').length,
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!statusFilter || r.status === statusFilter) &&
        (!q ||
          (r.patientName ?? '').toLowerCase().includes(q) ||
          (r.professionalName ?? '').toLowerCase().includes(q)),
    )
  }, [rows, query, statusFilter])

  useEffect(() => setPage(1), [filtered.length, query, statusFilter])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <RoleGate allow={['admin', 'operador', 'profesional']}>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='fichas.title'
          currentKey='fichas.breadcrumb.current'
          subtitleKey='fichas.subtitle'
          icon='solar:clipboard-heart-line-duotone'
        />

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          <StatTile value={stats.total} label={t('fichas.stat.total')} icon='solar:clipboard-list-line-duotone' tint='bg-lightprimary text-primary' />
          <StatTile value={stats.closed} label={t('fichas.stat.closed')} icon='solar:check-circle-line-duotone' tint='bg-lightsuccess text-success' />
          <StatTile value={stats.draft} label={t('fichas.stat.draft')} icon='solar:pen-new-square-line-duotone' tint='bg-lightwarning text-warning' />
        </div>

        <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
          {loading ? (
            <div className='py-14 flex justify-center'>
              <Icon icon='tabler:loader-2' height={28} width={28} className='text-primary animate-spin' />
            </div>
          ) : error ? (
            <div className='py-14 flex flex-col items-center gap-2 text-center'>
              <Icon icon='solar:cloud-cross-line-duotone' height={28} width={28} className='text-error' />
              <p className='text-sm text-link dark:text-darklink'>{t('fichas.error')}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className='py-14 flex flex-col items-center gap-2 text-center'>
              <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
                <Icon icon='solar:clipboard-heart-line-duotone' height={26} width={26} className='text-primary' />
              </div>
              <p className='text-base font-semibold text-dark dark:text-white'>{t('fichas.empty.title')}</p>
              <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('fichas.empty.body')}</p>
            </div>
          ) : (
            <>
              <div className='flex items-center gap-3 mb-4 flex-wrap'>
                <div className='relative flex-1 min-w-[200px]'>
                  <Icon icon='solar:magnifer-line-duotone' height={15} width={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink' />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('fichas.searchPlaceholder')}
                    className='w-full rounded-md border border-border dark:border-darkborder bg-background pl-9 pr-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className='rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'>
                  <option value=''>{t('fichas.filter.all')}</option>
                  <option value='borrador'>{t('ficha.status.draft')}</option>
                  <option value='cerrada'>{t('ficha.status.closed')}</option>
                </select>
              </div>

              <div className='space-y-2'>
                {pageItems.map((ev) => (
                  <Row key={ev.id} ev={ev} t={t} locale={locale} />
                ))}
                {pageItems.length === 0 && (
                  <p className='py-8 text-center text-sm text-link dark:text-darklink italic'>
                    {t('fichas.noMatches')}
                  </p>
                )}
              </div>

              {totalPages > 1 && (
                <div className='mt-4 flex items-center justify-center gap-1'>
                  {pageRange(page, totalPages).map((p, i) =>
                    p === '…' ? (
                      <span key={`e${i}`} className='px-2 text-link dark:text-darklink'>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-8 min-w-8 px-2 rounded-md text-sm font-medium transition-colors ${
                          p === page
                            ? 'bg-primary text-white'
                            : 'text-dark dark:text-white hover:bg-lightprimary'
                        }`}>
                        {p}
                      </button>
                    ),
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RoleGate>
  )
}
