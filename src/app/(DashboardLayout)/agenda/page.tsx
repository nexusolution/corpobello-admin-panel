'use client'

import dynamic from 'next/dynamic'
import { Icon } from '@iconify/react'

import { HeroBanner } from '@/app/components/shared/HeroBanner'

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
  return (
    <div className='space-y-6'>
      <HeroBanner
        titleKey='agendaCal.pageTitle'
        currentKey='sidebar.agenda'
        subtitleKey='agendaCal.pageSubtitle'
        icon='solar:calendar-mark-line-duotone'
      />
      <CalendarView />
    </div>
  )
}
