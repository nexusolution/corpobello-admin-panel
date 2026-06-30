'use client'

import dynamic from 'next/dynamic'
import { Icon } from '@iconify/react'

import { Card } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  TREATMENT_SLUGS_ORDERED,
  getTreatmentColorBySlug,
} from '@/lib/treatment-colors'

// Lottie player — touches DOM APIs, must be client-only
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
)

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
      <div className='flex flex-col md:flex-row items-stretch h-full'>
        {/* Left half — Today at a glance (KPIs) */}
        <div className='flex-1 min-w-0 p-6 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/40 dark:border-white/10'>
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
            <div className='flex flex-col gap-3'>
              {treatmentChips.map((slug) => {
                const color = getTreatmentColorBySlug(slug)
                return (
                  <div key={slug} className='flex items-center gap-3'>
                    <Icon
                      icon={color.icon}
                      height={28}
                      width={28}
                      className={`shrink-0 ${color.textClass}`}
                    />
                    <span className={`text-base font-bold ${color.textClass}`}>
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

        {/* Right illustration — Lottie animation, hidden on small screens */}
        <div className='hidden lg:flex items-center justify-center shrink-0 w-[280px] xl:w-[340px] p-2'>
          <DotLottieReact
            src='https://lottie.host/31c92a4c-ac39-4320-8646-3348fa21cffe/JnGZyldzlm.lottie'
            loop
            autoplay
          />
        </div>
      </div>
    </Card>
  )
}