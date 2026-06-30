import type { Metadata } from 'next'

import { KanbanBoard } from './kanban-board'
import { HeroBanner } from '@/app/components/shared/HeroBanner'

export const metadata: Metadata = {
  title: 'Kanban · Panel Corpo Bello',
}

export default function KanbanPage() {
  return (
    <div className='space-y-6'>
      <HeroBanner
        titleKey='sidebar.kanban'
        currentKey='sidebar.kanban'
        icon='solar:layers-minimalistic-line-duotone'
      />
      <KanbanBoard />
    </div>
  )
}