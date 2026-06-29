'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'
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

function isDarkMode(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
}

function showUnderDevelopmentAlert(itemName: string, t: TFn) {
  const isDark = isDarkMode()
  Swal.fire({
    title: t('alerts.underDevelopmentTitle'),
    text: t('alerts.underDevelopmentBody', { section: itemName }),
    icon: 'info',
    iconColor: '#5d87ff',
    confirmButtonText: t('alerts.underDevelopmentButton'),
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-1 [&_.swal2-icon-content]:!text-2xl',
      confirmButton: '!text-sm !px-4 !py-1.5',
      popup: '!rounded-lg',
    },
  })
}

async function confirmDeleteLead(name: string, t: TFn): Promise<boolean> {
  const isDark = isDarkMode()
  const result = await Swal.fire({
    title: t('kanban.lead.deleteConfirmTitle'),
    text: t('kanban.lead.deleteConfirmBody', { name }),
    icon: 'warning',
    iconColor: '#ef4444',
    iconHtml:
      '<span style="font-size:30px;line-height:1;color:#ef4444;font-weight:700;">!</span>',
    showCancelButton: true,
    confirmButtonText: t('kanban.lead.deleteConfirmYes'),
    cancelButtonText: t('kanban.lead.deleteConfirmNo'),
    confirmButtonColor: '#ef4444',
    cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1.5rem 1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0 !mt-3',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-2',
      actions: '!gap-2 !mt-5',
      confirmButton: '!text-sm !px-4 !py-1.5 !rounded-md',
      cancelButton: `!text-sm !px-4 !py-1.5 !rounded-md ${
        isDark ? '!text-white' : '!text-dark'
      }`,
      popup: '!rounded-lg',
    },
  })
  return result.isConfirmed
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
              onSelect={(e) => {
                e.preventDefault()
                // Lead detail / edit page is not built yet (Etapa 1 scope).
                // Defer so Radix dropdown closes first; otherwise its focus
                // scope swallows the first click on the swal button.
                setTimeout(() => {
                  showUnderDevelopmentAlert(t('kanban.menu.edit'), t)
                }, 0)
              }}>
              <Icon icon='solar:pen-line-duotone' height={16} width={16} className='mr-2' />
              {t('kanban.menu.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                // Defer + confirm before destroying.
                setTimeout(async () => {
                  const ok = await confirmDeleteLead(lead.patientName, t)
                  if (ok) onDelete?.(lead.id)
                }, 0)
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

// Color picker palette for column dots. Tailwind classes so they pick up the
// project's theme tokens (info / warning / etc.) plus a few generic hues.
const COLUMN_COLOR_OPTIONS: readonly string[] = [
  'bg-info',
  'bg-warning',
  'bg-secondary',
  'bg-primary',
  'bg-purple-500',
  'bg-success',
  'bg-error',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-gray-400',
] as const

// Each dot color maps to a tinted background for the whole column. Theme tokens
// use their predefined light variants (12% opacity via color-mix). Generic
// Tailwind hues fall back to /15 opacity so they read on both light and dark.
const COLOR_TO_BG_TINT: Record<string, string> = {
  'bg-info': 'bg-lightinfo',
  'bg-warning': 'bg-lightwarning',
  'bg-secondary': 'bg-lightsecondary',
  'bg-primary': 'bg-lightprimary',
  'bg-success': 'bg-lightsuccess',
  'bg-error': 'bg-lighterror',
  'bg-purple-500': 'bg-purple-500/15',
  'bg-pink-500': 'bg-pink-500/15',
  'bg-orange-500': 'bg-orange-500/15',
  'bg-teal-500': 'bg-teal-500/15',
  'bg-indigo-500': 'bg-indigo-500/15',
  'bg-gray-400': 'bg-gray-400/15',
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
  onChangeColor,
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
  onChangeColor: (columnId: LeadStatus, color: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })

  const bgTint =
    COLOR_TO_BG_TINT[dotColor] ?? 'bg-muted/40 dark:bg-darkmuted/40'

  return (
    <div
      ref={setNodeRef}
      className={`min-w-0 flex flex-col rounded-lg ${bgTint} p-3 transition-colors ${
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
          {/* Color picker — the + button now opens a swatch grid */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type='button'
                    aria-label={t('kanban.tooltip.changeColor')}
                    className='h-6 w-6 flex items-center justify-center rounded-full border border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
                    <Icon icon='tabler:plus' height={14} width={14} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t('kanban.tooltip.changeColor')}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align='end' className='p-2 w-auto'>
              <div className='grid grid-cols-6 gap-1.5'>
                {COLUMN_COLOR_OPTIONS.map((color) => {
                  const isCurrent = color === dotColor
                  return (
                    <button
                      key={color}
                      type='button'
                      onClick={() => onChangeColor(columnId, color)}
                      aria-label={color}
                      className={`size-6 rounded-full ${color} hover:scale-110 transition-transform ${
                        isCurrent
                          ? 'ring-2 ring-offset-2 ring-primary ring-offset-card'
                          : ''
                      }`}
                    />
                  )
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

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
              <DropdownMenuItem onClick={() => onAddLead(columnId)}>
                <Icon icon='tabler:plus' height={16} width={16} className='mr-2' />
                {t('kanban.menu.addLead')}
              </DropdownMenuItem>
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
        className='w-full pl-9 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
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
          className='inline-flex items-center justify-between gap-3 min-w-[200px] px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm font-medium text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
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

const COLUMNS_PER_PAGE = 4

export function KanbanBoard() {
  const { t } = useTranslation()
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSecondary, setShowSecondary] = useState(false)
  const [sucursalFilter, setSucursalFilter] = useState<Sucursal | 'all'>('all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  // Per-column dot color overrides. Falls back to the menu default when unset.
  const [columnColors, setColumnColors] = useState<
    Partial<Record<LeadStatus, string>>
  >({})

  function handleChangeColor(columnId: LeadStatus, color: string) {
    setColumnColors((prev) => ({ ...prev, [columnId]: color }))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const visibleColumns = COLUMNS.filter((c) => showSecondary || c.primary)

  // Paginate: show COLUMNS_PER_PAGE columns at a time
  const totalPages = Math.max(1, Math.ceil(visibleColumns.length / COLUMNS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedColumns = visibleColumns.slice(
    (safePage - 1) * COLUMNS_PER_PAGE,
    safePage * COLUMNS_PER_PAGE
  )

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

        {totalPages > 1 && (
          <div className='ml-auto flex items-center gap-1 text-link dark:text-darklink'>
            <button
              type='button'
              aria-label={t('kanban.pagination.previous')}
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className='h-8 w-8 flex items-center justify-center rounded-md hover:bg-lightprimary hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-link transition-colors'>
              <Icon icon='tabler:chevron-left' height={18} width={18} />
            </button>
            <span className='px-2 text-sm font-medium text-dark dark:text-white tabular-nums'>
              {t('kanban.pagination.label', {
                current: String(safePage),
                total: String(totalPages),
              })}
            </span>
            <button
              type='button'
              aria-label={t('kanban.pagination.next')}
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className='h-8 w-8 flex items-center justify-center rounded-md hover:bg-lightprimary hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-link transition-colors'>
              <Icon icon='tabler:chevron-right' height={18} width={18} />
            </button>
          </div>
        )}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}>
        <div
          className='grid gap-4 pb-4'
          style={{
            gridTemplateColumns: `repeat(${COLUMNS_PER_PAGE}, minmax(0, 1fr))`,
          }}>
          {pagedColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              columnId={column.id}
              name={t(column.nameKey)}
              dotColor={columnColors[column.id] ?? column.dotColor}
              leads={leadsByStatus[column.id] ?? []}
              emptyLabel={emptyLabel}
              t={t}
              onAddLead={handleAddLead}
              onClearColumn={handleClearColumn}
              onDeleteLead={handleDeleteLead}
              onChangeColor={handleChangeColor}
            />
          ))}
        </div>
        <DragOverlay>
          {activeLead && (
            <div className='rounded-md border border-border dark:border-darkborder bg-card p-3 shadow-lg ring-2 ring-primary w-80'>
              <LeadCardBody lead={activeLead} t={t} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}