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

// showFinancials gates the economic KPIs (daily income + pending charges) so
// non-admin roles never see clinic billing (Andrés' rule: Operador/Profesional
// must not see facturación). Default true (admin/superset view).
export function WelcomeBanner({
  showFinancials = true,
}: {
  showFinancials?: boolean
} = {}) {
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

          <div className='flex flex-wrap gap-x-8 gap-y-4'>
            <div className='min-w-[80px]'>
              <div className='text-xl sm:text-2xl font-bold text-dark dark:text-white'>
                2
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.patientsAttended')}
              </div>
            </div>
            <div className='min-w-[80px]'>
              <div className='text-xl sm:text-2xl font-bold text-dark dark:text-white'>
                1
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.cancellations')}
              </div>
            </div>
            {showFinancials && (
              <>
                <div className='min-w-[110px]'>
                  <div className='flex items-center gap-1.5'>
                    <span className='text-xl sm:text-2xl font-bold text-success whitespace-nowrap'>
                      $84.500
                    </span>
                    <Icon
                      icon='tabler:arrow-up-right'
                      height={16}
                      width={16}
                      className='text-success shrink-0'
                    />
                  </div>
                  <div className='text-xs text-link dark:text-darklink mt-0.5'>
                    {t('welcome.dailyIncome')}
                  </div>
                </div>
                <div className='min-w-[100px]'>
                  <div className='text-xl sm:text-2xl font-bold text-warning whitespace-nowrap'>
                    $31.000
                  </div>
                  <div className='text-xs text-link dark:text-darklink mt-0.5'>
                    {t('welcome.pendingCharges')}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right half — Today's workload (treatment chip row), vertically
            centered to line up with the "Today at a glance" column beside it. */}
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

        {/* Discrete brand mark instead of the old decorative illustration —
            keeps the dashboard clean/operative (Andrés' ask) while still
            carrying Corpo Bello's identity. Hidden on small screens. */}
        <div className='hidden lg:flex items-center justify-center shrink-0 w-[200px] xl:w-[240px] px-6'>
          <img
            src='/images/logos/logo.webp'
            alt='Corpo Bello'
            className='w-full max-w-[160px] h-auto opacity-70 dark:opacity-90 dark:brightness-0 dark:invert'
          />
        </div>
      </div>
    </Card>
  )
}