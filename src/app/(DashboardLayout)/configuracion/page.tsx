import type { Metadata } from 'next'

import { ConfigurationContent } from './configuration-content'
import { HeroBanner } from '@/app/components/shared/HeroBanner'

export const metadata: Metadata = {
  title: 'Configuración · Panel Corpo Bello',
}

export default function ConfiguracionPage() {
  return (
    <div className='space-y-6'>
      <HeroBanner
        titleKey='configuracion.title'
        currentKey='configuracion.breadcrumb.current'
        icon='solar:tuning-3-line-duotone'
      />
      <ConfigurationContent />
    </div>
  )
}