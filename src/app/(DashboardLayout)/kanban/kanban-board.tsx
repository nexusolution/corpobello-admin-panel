'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  COLUMNS,
  MOCK_LEADS,
  SUCURSAL_LABELS,
  type Lead,
  type LeadStatus,
  type Sucursal,
} from './mock-data'

function formatLastActivity(hours: number): string {
  if (hours < 1) return 'hace unos minutos'
  if (hours < 24) return `hace ${Math.floor(hours)} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} d`
  return `hace ${Math.floor(days / 30)} m`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function LeadCardBody({ lead }: { lead: Lead }) {
  return (
    <>
      <div className='flex items-start justify-between gap-2 mb-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <div className='h-8 w-8 rounded-full bg-lightprimary text-primary flex items-center justify-center text-xs font-semibold shrink-0'>
            {initials(lead.patientName)}
          </div>
          <div className='min-w-0'>
            <p className='text-sm font-semibold text-dark dark:text-white truncate'>
              {lead.patientName}
            </p>
            <p className='text-xs text-link dark:text-darklink truncate'>
              ···{lead.phoneLast4} · {SUCURSAL_LABELS[lead.sucursal]}
            </p>
          </div>
        </div>
      </div>

      <p className='text-xs text-link dark:text-darklink mb-2 truncate'>
        {lead.treatmentLabel}
      </p>

      {lead.tags.length > 0 && (
        <div className='flex flex-wrap gap-1 mb-3'>
          {lead.tags.map((tag) => (
            <span
              key={tag.label}
              style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
              className='inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium'>
              {tag.label}
            </span>
          ))}
        </div>
      )}

      <div className='flex items-center justify-between text-xs text-link dark:text-darklink'>
        <span>{formatLastActivity(lead.lastActivityHoursAgo)}</span>
        <div className='flex items-center gap-3'>
          {lead.notesCount > 0 && (
            <span className='flex items-center gap-1'>
              <Icon icon='solar:notes-line-duotone' height={14} width={14} />
              {lead.notesCount}
            </span>
          )}
          {lead.photosCount > 0 && (
            <span className='flex items-center gap-1'>
              <Icon icon='solar:camera-line-duotone' height={14} width={14} />
              {lead.photosCount}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

function SortableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      {...attributes}
      {...listeners}
      className='rounded-md border border-border dark:border-darkborder bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow'>
      <Link
        href={`/pacientes/${lead.id}`}
        onClick={(e) => e.stopPropagation()}
        className='block'>
        <LeadCardBody lead={lead} />
      </Link>
    </div>
  )
}

function KanbanColumn({
  columnId,
  name,
  dotColor,
  leads,
}: {
  columnId: LeadStatus
  name: string
  dotColor: string
  leads: Lead[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-lg bg-muted/40 dark:bg-darkmuted/40 p-3 transition-colors ${
        isOver ? 'ring-2 ring-primary/40' : ''
      }`}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2 text-sm font-semibold text-dark dark:text-white'>
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span>{name}</span>
          <span className='text-link dark:text-darklink font-normal'>
            {leads.length}
          </span>
        </div>
        <button
          type='button'
          className='text-link dark:text-darklink hover:text-primary'
          aria-label='Más opciones'>
          <Icon icon='tabler:dots' height={16} width={16} />
        </button>
      </div>

      <SortableContext
        id={columnId}
        items={leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}>
        <div className='flex flex-col gap-2 min-h-[20px]'>
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} />
          ))}
          {leads.length === 0 && (
            <p className='text-xs text-link dark:text-darklink text-center py-6 italic'>
              Sin leads
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export function KanbanBoard() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSecondary, setShowSecondary] = useState(false)
  const [sucursalFilter, setSucursalFilter] = useState<Sucursal | 'all'>('all')
  const [search, setSearch] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const visibleColumns = COLUMNS.filter((c) => showSecondary || c.primary)

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (sucursalFilter !== 'all' && lead.sucursal !== sucursalFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !lead.patientName.toLowerCase().includes(q) &&
          !lead.phoneLast4.includes(q)
        )
          return false
      }
      return true
    })
  }, [leads, sucursalFilter, search])

  const leadsByStatus = useMemo(() => {
    const acc: Record<string, Lead[]> = {}
    for (const col of visibleColumns) acc[col.id] = []
    for (const lead of filteredLeads) {
      if (acc[lead.status]) acc[lead.status].push(lead)
    }
    return acc
  }, [filteredLeads, visibleColumns])

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string)
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeLead = leads.find((l) => l.id === active.id)
    if (!activeLead) return

    // Determine target column id: over.id can be a column id or another lead id.
    const overId = over.id as string
    const overIsColumn = COLUMNS.some((c) => c.id === overId)
    const targetStatus: LeadStatus = overIsColumn
      ? (overId as LeadStatus)
      : leads.find((l) => l.id === overId)?.status ?? activeLead.status

    if (activeLead.status === targetStatus) return

    setLeads((prev) =>
      prev.map((l) =>
        l.id === active.id ? { ...l, status: targetStatus } : l
      )
    )
  }

  function handleDragEnd() {
    setActiveId(null)
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null

  return (
    <div>
      {/* Filters bar */}
      <div className='flex items-center gap-3 mb-6 flex-wrap'>
        <div className='relative flex-1 min-w-[220px] max-w-md'>
          <Icon
            icon='solar:magnifer-linear'
            height={16}
            width={16}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink'
          />
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar por nombre o últimos 4 del teléfono'
            className='w-full pl-9 pr-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40'
          />
        </div>

        <select
          value={sucursalFilter}
          onChange={(e) => setSucursalFilter(e.target.value as Sucursal | 'all')}
          className='px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40'>
          <option value='all'>Todas las sucursales</option>
          <option value='caballito'>Caballito</option>
          <option value='merlo'>Merlo</option>
          <option value='moreno'>Moreno</option>
        </select>

        <button
          type='button'
          onClick={() => setShowSecondary((s) => !s)}
          className='px-3 py-2 rounded-md text-sm font-medium text-primary border border-primary/30 hover:bg-lightprimary transition-colors'>
          {showSecondary ? 'Ocultar archivados' : 'Mostrar archivados'}
        </button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}>
        <div className='flex gap-4 overflow-x-auto pb-4'>
          {visibleColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              columnId={column.id}
              name={column.name}
              dotColor={column.dotColor}
              leads={leadsByStatus[column.id] ?? []}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead && (
            <div className='rounded-md border border-border dark:border-darkborder bg-card p-3 shadow-lg ring-2 ring-primary w-72'>
              <LeadCardBody lead={activeLead} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}