'use client'

import { Icon } from '@iconify/react'

import { Card } from '@/components/ui/card'
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

export function WelcomeBanner() {
  const { t } = useTranslation()

  // Only render chips for categories with at least 1 scheduled today.
  const treatmentChips = TREATMENT_SLUGS_ORDERED.filter(
    (slug) => (TODAYS_LOAD[slug] ?? 0) > 0
  )

  return (
    <Card className='!rounded-md !p-0 bg-lightprimary dark:bg-lightprimary border-0 relative overflow-hidden h-full'>
      <div className='flex flex-col md:flex-row items-stretch h-full divide-y md:divide-y-0 md:divide-x divide-white/40 dark:divide-white/10'>
        {/* Left half — Today at a glance (KPIs) */}
        <div className='flex-1 min-w-0 p-6 flex flex-col justify-center'>
          <h2 className='text-lg sm:text-xl font-semibold text-dark dark:text-white mb-5'>
            {t('welcome.title')}
          </h2>

          <div className='grid grid-cols-2 gap-x-6 gap-y-4'>
            <div>
              <div className='text-xl sm:text-2xl font-bold text-dark dark:text-white'>
                2
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.patientsAttended')}
              </div>
            </div>
            <div>
              <div className='text-xl sm:text-2xl font-bold text-dark dark:text-white'>
                1
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.cancellations')}
              </div>
            </div>
            <div>
              <div className='flex items-center gap-1.5'>
                <span className='text-xl sm:text-2xl font-bold text-success'>
                  $84.500
                </span>
                <Icon
                  icon='tabler:arrow-up-right'
                  height={16}
                  width={16}
                  className='text-success'
                />
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.dailyIncome')}
              </div>
            </div>
            <div>
              <div className='text-xl sm:text-2xl font-bold text-warning'>
                $31.000
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.pendingCharges')}
              </div>
            </div>
          </div>
        </div>

        {/* Right half — Today's workload (treatment chip row) */}
        <div className='flex-1 min-w-0 p-6 flex flex-col justify-center'>
          <h2 className='text-lg sm:text-xl font-semibold text-dark dark:text-white mb-5'>
            {t('treatments.summary.title')}
          </h2>

          {treatmentChips.length === 0 ? (
            <p className='text-sm text-link dark:text-darklink italic'>
              {t('treatments.summary.empty')}
            </p>
          ) : (
            <div className='flex flex-wrap gap-2'>
              {treatmentChips.map((slug) => {
                const color = getTreatmentColorBySlug(slug)
                return (
                  <div
                    key={slug}
                    className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/60 dark:bg-white/10'>
                    <span aria-hidden='true' className='text-base leading-none'>
                      {color.emoji}
                    </span>
                    <span className={`text-sm font-semibold ${color.textClass}`}>
                      {TODAYS_LOAD[slug]}
                    </span>
                    <span className='text-sm text-dark dark:text-white'>
                      {t(color.labelKey as TranslationKey)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}