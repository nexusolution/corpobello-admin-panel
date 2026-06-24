import type { Metadata } from 'next'
import { KanbanBoard } from './kanban-board'

export const metadata: Metadata = {
  title: 'Kanban · Panel Corpo Bello',
}

export default function KanbanPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold text-dark dark:text-white'>
          Pipeline de pacientes
        </h1>
        <p className='text-sm text-link dark:text-darklink mt-1'>
          Arrastrá una tarjeta entre columnas para cambiar el estado del lead.
        </p>
      </div>

      <KanbanBoard />
    </div>
  )
}