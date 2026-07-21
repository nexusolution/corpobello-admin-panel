import type { Metadata } from 'next'

import { TreatmentsToggle } from './treatments-toggle'
import { PricesSection } from './prices-section'
import { TextsSection } from './texts-section'
import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { AdminGate } from '@/lib/auth/AdminGate'

export const metadata: Metadata = {
  title: 'Auto-gestión · Panel Corpo Bello',
}

export default function AutoGestionPage() {
  return (
    <AdminGate>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='autoGestion.title'
          currentKey='autoGestion.breadcrumb.current'
          icon='solar:tuning-4-line-duotone'
        />
        <TreatmentsToggle />
        <PricesSection />
        <TextsSection />
      </div>
    </AdminGate>
  )
}
