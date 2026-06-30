'use client'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  TREATMENT_SLUGS_ORDERED,
  getTreatmentColorBySlug,
} from '@/lib/treatment-colors'

// MOCK STATE: today's count per treatment category, hardcoded to match Andrés'
// example chip row. When agenda + Supabase land, derive from today's
// confirmed/pending turnos grouped by treatment_id.
const TODAYS_LOAD: Record<string, number> = {
  tatuaje: 4,
  depilacion: 8,
  melasma: 2,
  endolift: 1,
  acne: 0,
  microblading: 0,
  facial: 0,
}

const TreatmentSummary = () => {
  const { t } = useTranslation()

  // Only render chips for categories with at least 1 scheduled today.
  const chips = TREATMENT_SLUGS_ORDERED.filter((slug) => (TODAYS_LOAD[slug] ?? 0) > 0)

  return (
    <CardBox className='h-full w-full'>
      <h5 className='card-title mb-3'>{t('treatments.summary.title')}</h5>

      {chips.length === 0 ? (
        <p className='text-sm text-link dark:text-darklink italic'>
          {t('treatments.summary.empty')}
        </p>
      ) : (
        <div className='flex flex-wrap gap-2'>
          {chips.map((slug) => {
            const color = getTreatmentColorBySlug(slug)
            const count = TODAYS_LOAD[slug] ?? 0
            return (
              <div
                key={slug}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md ${color.bgClass}`}>
                <span aria-hidden='true' className='text-base leading-none'>
                  {color.emoji}
                </span>
                <span className={`text-sm font-semibold ${color.textClass}`}>
                  {count}
                </span>
                <span className='text-sm text-dark dark:text-white'>
                  {t(color.labelKey as TranslationKey)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </CardBox>
  )
}

export default TreatmentSummary