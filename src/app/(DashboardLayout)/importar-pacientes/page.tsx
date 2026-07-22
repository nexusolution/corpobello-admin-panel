import type { Metadata } from 'next'

import { ImportWizard } from './import-wizard'
import { HeroBanner } from '@/app/components/shared/HeroBanner'

export const metadata: Metadata = {
  title: 'Importar pacientes · Panel Corpo Bello',
}

export default function ImportPatientsPage() {
  return (
    <div className='space-y-6'>
      <HeroBanner
        titleKey='import.title'
        currentKey='import.breadcrumb.current'
        parentKey='sidebar.patients'
        parentHref='/pacientes'
        icon='solar:import-line-duotone'
      />
      <ImportWizard />
    </div>
  )
}
