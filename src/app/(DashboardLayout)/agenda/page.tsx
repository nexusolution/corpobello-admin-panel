'use client'

import dynamic from 'next/dynamic'
import { Icon } from '@iconify/react'

import { useTranslation } from '@/lib/i18n/context'

// react-big-calendar is client-only — load it without SSR to avoid hydration
// mismatches (it reads Date/locale at render time).
const CalendarView = dynamic(
  () => import('./calendar-view').then((m) => m.CalendarView),
  {
    ssr: false,
    loading: () => (
      <div className='rounded-lg border border-border dark:border-darkborder bg-card p-6 flex justify-center py-20'>
        <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
      </div>
    ),
  },
)

export default function AgendaPage() {
  const { t } = useTranslation()
  return (
    // Compact header (Andrés #22): a subtle title instead of the tall hero block,
    // so more of the screen is the calendar itself.
    <div className='space-y-3'>
      <h1 className='flex items-center gap-2 text-lg font-semibold text-dark dark:text-white'>
        <Icon icon='solar:calendar-mark-line-duotone' height={20} width={20} className='text-primary' />
        {t('agendaCal.pageTitle')}
      </h1>
      <CalendarView />
    </div>
  )
}
