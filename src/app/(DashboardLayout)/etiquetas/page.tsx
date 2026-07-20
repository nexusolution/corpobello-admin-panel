import type { Metadata } from 'next'

import { TagsManager } from './tags-manager'
import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { AdminGate } from '@/lib/auth/AdminGate'

export const metadata: Metadata = {
  title: 'Etiquetas · Panel Corpo Bello',
}

export default function EtiquetasPage() {
  return (
    <AdminGate>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='tags.title'
          currentKey='tags.breadcrumb.current'
          icon='solar:tag-line-duotone'
        />
        <TagsManager />
      </div>
    </AdminGate>
  )
}
