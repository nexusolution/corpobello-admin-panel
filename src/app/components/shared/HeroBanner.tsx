'use client'

import Link from 'next/link'
import { Icon } from '@iconify/react'

import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

/**
 * Page-level hero banner used on the main module routes (pacientes, kanban,
 * usuarios, etc.). Light-primary tinted bg with title + breadcrumb on the
 * left and a decorative circular icon on the right.
 */
export function HeroBanner({
  titleKey,
  currentKey,
  icon,
}: {
  /** i18n key for the H1 title */
  titleKey: TranslationKey
  /** i18n key for the current page label in the breadcrumb (usually same as title) */
  currentKey: TranslationKey
  /** Iconify icon name shown inside the decorative circle */
  icon: string
}) {
  const { t } = useTranslation()

  return (
    <div className='relative overflow-hidden rounded-lg bg-lightprimary dark:bg-lightprimary p-6 sm:p-8'>
      <div className='relative z-10 max-w-[60%]'>
        <h1 className='text-2xl font-semibold text-dark dark:text-white'>
          {t(titleKey)}
        </h1>
        <div className='flex items-center gap-1.5 text-sm text-link dark:text-darklink mt-1'>
          <Link href='/' className='hover:text-primary transition-colors'>
            {t('common.breadcrumb.home')}
          </Link>
          <Icon icon='tabler:chevron-right' height={14} width={14} />
          <span className='text-dark dark:text-white font-medium'>
            {t(currentKey)}
          </span>
        </div>
      </div>

      {/* Decorative illustration — hidden on small screens */}
      <div className='hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 items-center justify-center'>
        <div className='size-16 lg:size-20 rounded-full bg-white/40 dark:bg-white/10 flex items-center justify-center'>
          <Icon icon={icon} height={36} width={36} className='text-primary' />
        </div>
      </div>
    </div>
  )
}