'use client'

import Link from 'next/link'
import { Icon } from '@iconify/react'

import CardBox from '@/app/components/shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

const PREVIEW_KEYS: TranslationKey[] = [
  'estadisticas.preview.conversion',
  'estadisticas.preview.revenue',
  'estadisticas.preview.cohorts',
  'estadisticas.preview.utilization',
]

export default function EstadisticasPage() {
  const { t } = useTranslation()

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div>
        <h1 className='text-2xl font-semibold text-dark dark:text-white'>
          {t('estadisticas.title')}
        </h1>
        <p className='text-sm text-link dark:text-darklink mt-1'>
          {t('estadisticas.subtitle')}
        </p>
      </div>

      {/* Coming-soon card */}
      <CardBox>
        <div className='flex flex-col items-center text-center py-10 px-4 gap-4'>
          <div className='size-20 rounded-full bg-lightprimary text-primary flex items-center justify-center'>
            <Icon icon='solar:chart-square-line-duotone' height={42} width={42} />
          </div>

          <div className='space-y-1 max-w-lg'>
            <h2 className='text-lg font-semibold text-dark dark:text-white'>
              {t('estadisticas.comingSoonHeading')}
            </h2>
            <p className='text-sm text-link dark:text-darklink'>
              {t('estadisticas.comingSoonBody')}
            </p>
          </div>

          {/* Preview list */}
          <div className='w-full max-w-lg mt-2 text-left'>
            <h3 className='text-xs font-semibold uppercase tracking-wide text-link dark:text-darklink mb-2'>
              {t('estadisticas.previewHeading')}
            </h3>
            <ul className='space-y-2'>
              {PREVIEW_KEYS.map((key) => (
                <li
                  key={key}
                  className='flex items-start gap-2 text-sm text-dark dark:text-white'>
                  <Icon
                    icon='solar:check-circle-line-duotone'
                    height={18}
                    width={18}
                    className='text-success shrink-0 mt-0.5'
                  />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Back link */}
          <Link
            href='/'
            className='inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
            <Icon icon='tabler:arrow-left' height={16} width={16} />
            {t('estadisticas.backToDashboard')}
          </Link>
        </div>
      </CardBox>
    </div>
  )
}