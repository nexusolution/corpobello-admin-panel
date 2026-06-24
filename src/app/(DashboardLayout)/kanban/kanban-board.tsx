'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function formatLastActivity(hours: number, t: TFn): string {
  if (hours < 1) return t('kanban.time.justNow')
  if (hours < 24) return t('kanban.time.hours', { n: String(Math.floor(hours)) })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('kanban.time.days', { n: String(days) })
  return t('kanban.time.months', { n: String(Math.floor(days / 30)) })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function LeadCardBody({
  lead,
  t,
  onDelete,
}: {
  lead: Lead
  t: TFn
  onDelete?: (id: string) => void
}) {
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

      <p className='text-xs text-link dark:text-darklink mb-3'>
        {formatLastActivity(lead.lastActivityHoursAgo, t)}
      </p>

      {/* Separator */}
      <div className='border-t border-border dark:border-darkborder -mx-3 mt-1 mb-3' />

      {/* Footer: notes / photos counts + actions menu (all with tooltips) */}
      <div className='flex items-center justify-between text-link dark:text-darklink'>
        <div className='flex items-center gap-4 text-sm'>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className='flex items-center gap-1.5 cursor-help'>
                <Icon icon='solar:notes-line-duotone' height={18} width={18} />
                {lead.notesCount}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('kanban.tooltip.notes')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className='flex items-center gap-1.5 cursor-help'>
                <Icon icon='solar:camera-line-duotone' height={18} width={18} />
                {lead.photosCount}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('kanban.tooltip.photos')}</TooltipContent>
          </Tooltip>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              aria-label={t('kanban.tooltip.more')}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className='hover:text-primary'>
              <Icon icon='tabler:dots' height={18} width={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-40'>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                // Edit currently navigates to detail (same target as card click)
                window.location.href = `/pacientes/${lead.id}`
              }}>
              <Icon icon='solar:pen-line-duotone' height={16} width={16} className='mr-2' />
              {t('kanban.menu.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(lead.id)
              }}
              className='text-error focus:text-error focus:bg-error/10'>
              <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} className='mr-2' />
              {t('kanban.menu.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

function SortableLeadCard({
  lead,
  t,
  onDelete,
}: {
  lead: Lead
  t: TFn
  onDelete: (id: string) => void
}) {
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
        <LeadCardBody lead={lead} t={t} onDelete={onDelete} />
      </Link>
    </div>
  )
}

function KanbanColumn({
  columnId,
  name,
  dotColor,
  leads,
  emptyLabel,
  t,
  onAddLead,
  onClearColumn,
  onDeleteLead,
}: {
  columnId: LeadStatus
  name: string
  dotColor: string
  leads: Lead[]
  emptyLabel: string
  t: TFn
  onAddLead: (columnId: LeadStatus) => void
  onClearColumn: (columnId: LeadStatus) => void
  onDeleteLead: (id: string) => void
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

        <div className='flex items-center gap-1'>
          {/* + Add lead */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                aria-label={t('kanban.tooltip.addLead')}
                onClick={() => onAddLead(columnId)}
                className='h-6 w-6 flex items-center justify-center rounded-full border border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
                <Icon icon='tabler:plus' height={14} width={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('kanban.tooltip.addLead')}</TooltipContent>
          </Tooltip>

          {/* Column actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                aria-label={t('kanban.tooltip.columnActions')}
                className='h-6 w-6 flex items-center justify-center rounded text-link dark:text-darklink hover:text-primary'>
                <Icon icon='tabler:dots' height={16} width={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44'>
              <DropdownMenuItem onClick={() => { /* edit column — schema-level, deferred */ }}>
                <Icon icon='solar:pen-line-duotone' height={16} width={16} className='mr-2' />
                {t('kanban.menu.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { /* delete column — schema-level, deferred */ }}>
                <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} className='mr-2' />
                {t('kanban.menu.delete')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onClearColumn(columnId)}
                className='text-error focus:text-error focus:bg-error/10'>
                <Icon icon='solar:close-circle-line-duotone' height={16} width={16} className='mr-2' />
                {t('kanban.menu.clearAll')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SortableContext
        id={columnId}
        items={leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}>
        <div className='flex flex-col gap-2 min-h-[20px]'>
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} t={t} onDelete={onDeleteLead} />
          ))}
          {leads.length === 0 && (
            <p className='text-xs text-link dark:text-darklink text-center py-6 italic'>
              {emptyLabel}
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  function handleBlur() {
    // Auto-collapse only when there is no query to preserve
    if (!value) setExpanded(false)
  }

  function handleClear() {
    onChange('')
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            aria-label={placeholder}
            onClick={() => setExpanded(true)}
            className='h-10 w-10 flex items-center justify-center rounded-md text-link dark:text-darklink hover:text-primary transition-colors'>
            <Icon icon='solar:magnifer-linear' height={20} width={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{placeholder}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className='relative w-[320px]'>
      <Icon
        icon='solar:magnifer-linear'
        height={16}
        width={16}
        className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink pointer-events-none'
      />
      <input
        ref={inputRef}
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className='w-full pl-9 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40'
      />
      <button
        type='button'
        aria-label='Cerrar búsqueda'
        onClick={handleClear}
        className='absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-link dark:text-darklink hover:text-primary'>
        <Icon icon='solar:close-circle-line-duotone' height={16} width={16} />
      </button>
    </div>
  )
}

function SucursalSelect({
  value,
  onChange,
  allLabel,
}: {
  value: Sucursal | 'all'
  onChange: (v: Sucursal | 'all') => void
  allLabel: string
}) {
  const options: Array<{ value: Sucursal | 'all'; label: string }> = [
    { value: 'all', label: allLabel },
    { value: 'caballito', label: SUCURSAL_LABELS.caballito },
    { value: 'merlo', label: SUCURSAL_LABELS.merlo },
    { value: 'moreno', label: SUCURSAL_LABELS.moreno },
  ]
  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='inline-flex items-center justify-between gap-3 min-w-[200px] px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm font-medium text-dark dark:text-white hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors'>
          <span>{current.label}</span>
          <Icon
            icon='tabler:chevron-down'
            height={14}
            width={14}
            className='text-link dark:text-darklink'
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-[200px]'>
        {options.map((opt) => {
          const isSelected = opt.value === value
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={
                isSelected
                  ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                  : ''
              }>
              <Icon
                icon='tabler:check'
                height={16}
                width={16}
                className={`mr-2 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
              />
              {opt.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function KanbanBoard() {
  const { t } = useTranslation()
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

  function handleDeleteLead(id: string) {
    setLeads((prev) => prev.filter((l) => l.id !== id))
  }

  function handleClearColumn(columnId: LeadStatus) {
    setLeads((prev) => prev.filter((l) => l.status !== columnId))
  }

  function handleAddLead(_columnId: LeadStatus) {
    // Real add-lead flow comes when bot data layer + creation form land.
    // For the visual prototype, this is a no-op.
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null
  const emptyLabel = t('kanban.emptyColumn')

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div>
        <h1 className='text-2xl font-semibold text-dark dark:text-white'>
          {t('kanban.pageTitle')}
        </h1>
        <p className='text-sm text-link dark:text-darklink mt-1'>
          {t('kanban.pageSubtitle')}
        </p>
      </div>

      {/* Filters bar */}
      <div className='flex items-center gap-3 flex-wrap'>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder={t('kanban.searchPlaceholder')}
        />

        <SucursalSelect
          value={sucursalFilter}
          onChange={setSucursalFilter}
          allLabel={t('kanban.allSucursales')}
        />

        <button
          type='button'
          onClick={() => setShowSecondary((s) => !s)}
          className='px-3 py-2 rounded-md text-sm font-medium text-primary border border-primary/30 hover:bg-lightprimary transition-colors'>
          {showSecondary ? t('kanban.hideArchived') : t('kanban.showArchived')}
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
              name={t(column.nameKey)}
              dotColor={column.dotColor}
              leads={leadsByStatus[column.id] ?? []}
              emptyLabel={emptyLabel}
              t={t}
              onAddLead={handleAddLead}
              onClearColumn={handleClearColumn}
              onDeleteLead={handleDeleteLead}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead && (
            <div className='rounded-md border border-border dark:border-darkborder bg-card p-3 shadow-lg ring-2 ring-primary w-72'>
              <LeadCardBody lead={activeLead} t={t} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}