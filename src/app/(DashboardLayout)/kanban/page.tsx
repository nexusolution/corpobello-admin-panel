import type { Metadata } from 'next'
import { KanbanBoard } from './kanban-board'

export const metadata: Metadata = {
  title: 'Kanban · Panel Corpo Bello',
}

export default function KanbanPage() {
  return <KanbanBoard />
}