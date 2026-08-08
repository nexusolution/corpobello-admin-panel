import type { Metadata } from 'next'

import { KanbanBoard } from './kanban-board'
import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { RoleGate } from '@/lib/auth/RoleGate'

export const metadata: Metadata = {
  title: 'Kanban · Panel Corpo Bello',
}

export default function KanbanPage() {
  return (
    // Commercial funnel — not part of the Profesional's clinical view.
    <RoleGate allow={['admin', 'operador']}>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='kanban.pageTitle'
          currentKey='sidebar.kanban'
          subtitleKey='kanban.pageSubtitle'
          icon='solar:layers-minimalistic-line-duotone'
        />
        <KanbanBoard />
      </div>
    </RoleGate>
  )
}