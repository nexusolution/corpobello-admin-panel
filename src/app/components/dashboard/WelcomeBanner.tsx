'use client'

import Link from 'next/link'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  TREATMENT_SLUGS_ORDERED,
  getTreatmentColorBySlug,
} from '@/lib/treatment-colors'

// MOCK STATE: today's count per treatment category. When agenda + Supabase
// land, derive from today's confirmed/pending turnos grouped by treatment_id.
const TODAYS_LOAD: Record<string, number> = {
  tatuaje: 4,
  depilacion: 8,
  melasma: 2,
  endolift: 1,
  acne: 0,
  microblading: 0,
  facial: 0,
}

// Three-dot progress indicator (first one active) — mirrors the sample cards.
function Dots({ color }: { color: string }) {
  return (
    <span className='flex items-center gap-1 shrink-0'>
      <span className={`h-1.5 w-4 rounded-full ${color}`} />
      <span className='h-1.5 w-1.5 rounded-full bg-black/15 dark:bg-white/25' />
      <span className='h-1.5 w-1.5 rounded-full bg-black/15 dark:bg-white/25' />
    </span>
  )
}

// One stat line: a "›" chevron badge + value + muted label (sample format).
function StatRow({ value, label }: { value: string; label: string }) {
  return (
    <div className='flex items-center gap-2 min-w-0'>
      <span className='inline-flex items-center justify-center h-5 w-5 rounded bg-muted dark:bg-darkmuted/40 shrink-0'>
        <Icon icon='tabler:chevron-right' height={13} width={13} className='text-link dark:text-darklink' />
      </span>
      <span className='truncate text-sm text-dark dark:text-white'>
        <span className='font-semibold'>{value}</span>{' '}
        <span className='text-link dark:text-darklink'>{label}</span>
      </span>
    </div>
  )
}

// showFinancials gates the economic KPIs (daily income + pending charges) so
// non-admin roles never see clinic billing (Andrés' rule: Operador/Profesional
// must not see facturación). Default true (admin/superset view).
//
// Renders TWO standalone cards as direct grid items (a fragment), so RoleDashboard
// places them in their own columns. Items are listed vertically (one per row).
export function WelcomeBanner({
  showFinancials = true,
}: {
  showFinancials?: boolean
} = {}) {
  const { t } = useTranslation()

  // Only chips for categories with at least 1 scheduled today.
  const treatmentChips = TREATMENT_SLUGS_ORDERED.filter(
    (slug) => (TODAYS_LOAD[slug] ?? 0) > 0
  )
  const totalTurnos = treatmentChips.reduce((sum, slug) => sum + (TODAYS_LOAD[slug] ?? 0), 0)

  return (
    <>
      {/* Card 1 — Today at a glance */}
      <div className='col-span-12 md:col-span-6 lg:col-span-4'>
        <CardBox className='h-full w-full'>
          <div className='flex flex-col h-full'>
            <div className='flex items-start justify-between gap-2 mb-4'>
              <div className='min-w-0'>
                <h2 className='text-lg font-semibold text-dark dark:text-white'>{t('welcome.title')}</h2>
                <p className='text-xs text-link dark:text-darklink mt-0.5'>{t('welcome.subtitle')}</p>
              </div>
              <Dots color='bg-primary' />
            </div>

            <div className='flex items-center justify-center gap-4 flex-1'>
              <div className='flex items-center justify-center shrink-0'>
                <Icon icon='solar:chart-square-line-duotone' height={48} width={48} className='text-primary' />
              </div>
              <div className='flex flex-col gap-2 min-w-0'>
                <StatRow value='2' label={t('welcome.patientsAttended')} />
                <StatRow value='1' label={t('welcome.cancellations')} />
                {showFinancials && (
                  <>
                    <StatRow value='$84.500' label={t('welcome.dailyIncome')} />
                    <StatRow value='$31.000' label={t('welcome.pendingCharges')} />
                  </>
                )}
              </div>
            </div>

            <div className='flex items-center gap-2 mt-5'>
              <Link
                href='/agenda'
                className='px-3 py-1.5 rounded-md text-sm font-medium border border-border dark:border-darkborder text-dark dark:text-white hover:bg-muted/40 transition-colors'>
                {t('welcome.viewAgenda')}
              </Link>
              {showFinancials && (
                <Link
                  href='/caja'
                  className='px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis transition-colors'>
                  {t('welcome.viewCaja')}
                </Link>
              )}
            </div>
          </div>
        </CardBox>
      </div>

      {/* Card 2 — Today's workload */}
      <div className='col-span-12 md:col-span-6 lg:col-span-4'>
        <CardBox className='h-full w-full'>
          <div className='flex flex-col h-full'>
            <div className='flex items-start justify-between gap-2 mb-4'>
              <div className='min-w-0'>
                <h2 className='text-lg font-semibold text-dark dark:text-white'>
                  {t('treatments.summary.title')}
                </h2>
                <p className='text-xs text-link dark:text-darklink mt-0.5'>
                  {t('treatments.summary.subtitle', { n: String(totalTurnos) })}
                </p>
              </div>
              <Dots color='bg-secondary' />
            </div>

            {treatmentChips.length === 0 ? (
              <p className='text-sm text-link dark:text-darklink italic flex-1'>
                {t('treatments.summary.empty')}
              </p>
            ) : (
              <div className='flex items-center justify-center gap-4 flex-1'>
                <div className='flex items-center justify-center shrink-0'>
                  <Icon icon='solar:stethoscope-line-duotone' height={48} width={48} className='text-secondary' />
                </div>
                <div className='flex flex-col gap-2 min-w-0'>
                  {treatmentChips.map((slug) => {
                    const color = getTreatmentColorBySlug(slug)
                    return (
                      <StatRow
                        key={slug}
                        value={String(TODAYS_LOAD[slug])}
                        label={t(color.labelKey as TranslationKey)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            <div className='flex items-center gap-2 mt-5'>
              <Link
                href='/agenda'
                className='px-3 py-1.5 rounded-md text-sm font-medium bg-secondary text-white hover:brightness-95 transition-colors'>
                {t('treatments.summary.openAgenda')}
              </Link>
            </div>
          </div>
        </CardBox>
      </div>
    </>
  )
}
