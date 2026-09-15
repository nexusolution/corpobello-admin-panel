'use client'

import {
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { computeAge } from '@/lib/age'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'
import {
  Calendar,
  momentLocalizer,
  Views,
  type View,
  type SlotInfo,
  type ToolbarProps,
} from 'react-big-calendar'
import withDragAndDrop, {
  type withDragAndDropProps,
} from 'react-big-calendar/lib/addons/dragAndDrop'
// RBC's internal time-grid — reused for a Monday–Saturday week grid (no types).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error no type declarations for the internal view module
import TimeGrid from 'react-big-calendar/lib/TimeGrid'
import moment from 'moment'
import 'moment/locale/es'
import { es } from 'date-fns/locale'

import { Calendar as DatePickerCalendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  searchPatients,
  fetchPatientBasics,
  getCurrentUserId,
  isExpiredReserva,
  autoCancelExpiredReservas,
  TURNO_STATUSES,
  STATUS_COLORS,
  STATUS_LABEL_KEY,
  SUCURSALES,
  type CalendarEvent,
  type TurnoStatus,
  type PatientOption,
  type PatientBasics,
} from '@/lib/data/calendar-events'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchMenuOverrides } from '@/lib/data/menu-overrides'
import { fetchAvailability } from '@/lib/data/availability'
import { logTurnoAudit } from '@/lib/data/turno-audit'
import { fetchTurnoStatusConfig, type TurnoStatusConfig } from '@/lib/data/turno-statuses'
import { fetchTreatmentColors } from '@/lib/data/treatment-colors-config'
import {
  availabilityFor,
  anyTreatmentAvailability,
  type AvailabilityRule,
  type AvailabilityExclusion,
} from '@/lib/scheduling/availability'
import { suggestDurationMinutes } from '@/lib/scheduling/duration'
import {
  fetchPackConfigs,
  fetchActivePacks,
  createPatientPack,
  fetchPackTurnos,
  fetchPackTotals,
  packProgress,
  turnoConsumesSession,
  type TreatmentPackConfig,
  type PatientPack,
} from '@/lib/data/packs'
import { getTreatmentColorBySlug, getTreatmentColor } from '@/lib/treatment-colors'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { fetchAgendaBlocks, type AgendaBlock } from '@/lib/data/agenda-blocks'
import { EvolucionForm } from '@/app/(DashboardLayout)/pacientes/[id]/evolucion-form'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import './calendar-theme.css'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }

// Distinct colour per sucursal for the "Todas" availability overview (Andrés
// 2026-09-11: see, at a glance, which branch runs a treatment each day).
const SUCURSAL_COLORS: Record<string, string> = {
  caballito: '#5d87ff', // blue
  merlo: '#13deb9', // teal/green
  moreno: '#ffae1f', // amber
}
function sucursalColor(s: string): string {
  return SUCURSAL_COLORS[s] ?? '#8a8a8a'
}
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// Soft availability background for a day, from its open-sucursal markers: 1 sede
// = full tint, 2+ = equal HORIZONTAL stripes (180deg). Shared by the Month cells
// and the Week-list date column so both show the same per-sucursal colours.
function stripesBackground(markers: readonly { color: string }[]): string {
  if (markers.length === 0) return ''
  const n = markers.length
  if (n === 1) return hexToRgba(markers[0]!.color, 0.16)
  return `linear-gradient(180deg, ${markers
    .map(
      (m, i) =>
        `${hexToRgba(m.color, 0.16)} ${Math.round((i / n) * 100)}% ${Math.round(((i + 1) / n) * 100)}%`,
    )
    .join(', ')})`
}

// Darker shade of a hex colour (factor < 1). Used for the turno's left bar + the
// cobro "$" block: the card (estado) colour, a bit darker to stand out.
function darkenHex(hex: string, factor = 0.72): string {
  const h = hex.replace('#', '')
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor)
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor)
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor)
  return `rgb(${r}, ${g}, ${b})`
}

// Lighter shade of a hex colour (factor = amount toward white, 0..1). The turno
// card uses a light shade of its estado colour with black text (Andrés 2026-09-15).
function lightenHex(hex: string, factor = 0.6): string {
  const h = hex.replace('#', '')
  const mix = (c: number) => Math.round(c + (255 - c) * factor)
  const r = mix(parseInt(h.slice(0, 2), 16))
  const g = mix(parseInt(h.slice(2, 4), 16))
  const b = mix(parseInt(h.slice(4, 6), 16))
  return `rgb(${r}, ${g}, ${b})`
}

// Turno treatment colour. The palette is keyed by CATEGORY slugs (depilacion,
// endolift…), but a turno stores the MENU slug (depilacion-laser, verrugas-
// lunares…), so a direct lookup misses and falls back to grey. Try the direct
// slug first, then infer the category from the slug/name (substring match).
function treatmentColorFor(slug: string | null | undefined, name?: string) {
  if (!slug) return getTreatmentColorBySlug('other')
  const direct = getTreatmentColorBySlug(slug)
  if (direct.slug !== 'other') return direct
  return getTreatmentColor(`${slug} ${name ?? ''}`)
}

// Checkbox multi-select in a popover (empty selection = Todos). Used for the
// Profesional and Tratamiento filters so reception can watch several at once.
function MultiSelect({
  options,
  selected,
  onChange,
  allLabel,
}: {
  options: Option[]
  selected: string[]
  onChange: (v: string[]) => void
  allLabel: string
}) {
  const [open, setOpen] = useState(false)
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? '1'
        : `${selected.length}`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='inline-flex items-center justify-between gap-2 min-w-[120px] pl-2.5 pr-2 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
          <span className='truncate'>{summary}</span>
          <Icon icon='tabler:chevron-down' height={15} width={15} className='text-link dark:text-darklink shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-[230px] p-1' align='start'>
        <button
          type='button'
          onClick={() => onChange([])}
          className={`w-full text-left px-2.5 py-1.5 rounded text-sm hover:bg-lightprimary hover:text-primary ${selected.length === 0 ? 'text-primary font-medium' : 'text-dark dark:text-white'}`}>
          {allLabel}
        </button>
        <div className='max-h-60 overflow-y-auto'>
          {options.map((o) => {
            const on = selected.includes(o.value)
            return (
              <label
                key={o.value}
                className='flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer hover:bg-lightprimary text-sm text-dark dark:text-white'>
                <input
                  type='checkbox'
                  checked={on}
                  onChange={() => onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
                  className='h-4 w-4 rounded border-border dark:border-darkborder accent-primary'
                />
                <span className='truncate'>{o.label}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}


function sucursalLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Resource id for turnos with no sucursal set, in the "columns by branch" view.
const NONE_RESOURCE = '__sin__'

// ── date <-> <input type="date"> helpers (local, never UTC — avoids day shift) ─
function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function startOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`)
}
function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`)
}
function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function dateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`)
}

// ── Custom toolbar — mirrors the sample: Today/Back/Next pill · title · views ──
function Toolbar({
  label,
  view,
  onView,
  onNavigate,
  onAdd,
  t,
}: {
  label: string
  view: View
  onView: (v: View) => void
  onNavigate: (action: 'TODAY' | 'PREV' | 'NEXT') => void
  onAdd: () => void
  t: TFn
}) {
  const views: { key: View; label: string }[] = [
    { key: Views.MONTH, label: t('agendaCal.month') },
    { key: Views.WEEK, label: t('agendaCal.week') },
    { key: Views.DAY, label: t('agendaCal.day') },
    { key: Views.AGENDA, label: t('agendaCal.agenda') },
  ]
  const groupCls =
    'inline-flex items-center rounded-full border border-primary/40 overflow-hidden text-sm font-medium'
  const segCls =
    'px-4 py-1.5 text-dark dark:text-white hover:bg-lightprimary/50 transition-colors'
  return (
    <div className='flex items-center justify-between gap-3 flex-wrap mb-4'>
      <div className='flex items-center gap-2'>
        <div className={groupCls}>
          <button type='button' onClick={() => onNavigate('TODAY')} className={segCls}>
            {t('agendaCal.today')}
          </button>
          <button
            type='button'
            onClick={() => onNavigate('PREV')}
            className={`${segCls} border-l border-primary/30`}>
            {t('agendaCal.back')}
          </button>
          <button
            type='button'
            onClick={() => onNavigate('NEXT')}
            className={`${segCls} border-l border-primary/30`}>
            {t('agendaCal.next')}
          </button>
        </div>
        <button
          type='button'
          onClick={onAdd}
          className='inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('agendaCal.new')}
        </button>
      </div>

      <h5 className='text-base font-semibold text-dark dark:text-white capitalize order-first w-full text-center sm:order-none sm:w-auto'>
        {label}
      </h5>

      <div className={groupCls}>
        {views.map((v, i) => (
          <button
            key={v.key}
            type='button'
            onClick={() => onView(v.key)}
            className={`px-4 py-1.5 transition-colors ${i > 0 ? 'border-l border-primary/30' : ''} ${
              view === v.key
                ? 'bg-primary text-white'
                : 'text-dark dark:text-white hover:bg-lightprimary/50'
            }`}>
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// A modern date field: styled trigger + shadcn/react-day-picker calendar in a
// popover, replacing the browser's native <input type="date">.
function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: string
  min?: string
  onChange: (v: string) => void
}) {
  const { t, locale } = useTranslation()
  const [open, setOpen] = useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : undefined
  const minDate = min ? new Date(`${min}T00:00:00`) : undefined

  return (
    <div className='block'>
      <span className='text-xs font-medium text-dark dark:text-white'>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type='button'
            className='mt-1 w-full flex items-center justify-between gap-2 rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
            <span>{date ? moment(date).format('DD MMM YYYY') : t('turno.chooseDate')}</span>
            <Icon
              icon='solar:calendar-mark-line-duotone'
              height={16}
              width={16}
              className='text-link dark:text-darklink shrink-0'
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <DatePickerCalendar
            mode='single'
            selected={date}
            defaultMonth={date}
            captionLayout='dropdown'
            startMonth={new Date(2020, 0)}
            endMonth={new Date(2035, 11)}
            disabled={minDate ? { before: minDate } : undefined}
            locale={locale === 'es' ? es : undefined}
            onSelect={(d: Date | undefined) => {
              if (!d) return
              onChange(toDateInput(d))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Searchable patient picker (async ilike search against patients).
function PatientPicker({
  valueName,
  onChange,
  t,
}: {
  valueName: string | null
  onChange: (id: string, name: string) => void
  t: TFn
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    const h = setTimeout(() => {
      void searchPatients(query).then((r) => {
        if (active) {
          setResults(r)
          setLoading(false)
        }
      })
    }, 250)
    return () => {
      active = false
      clearTimeout(h)
    }
  }, [query, open])

  return (
    <div className='block'>
      <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.patient')}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type='button'
            className='mt-1 w-full flex items-center justify-between gap-2 rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm hover:border-primary focus:outline-none focus:border-primary transition-colors'>
            <span className={valueName ? 'text-dark dark:text-white' : 'text-link dark:text-darklink'}>
              {valueName || t('turno.patientPlaceholder')}
            </span>
            <Icon
              icon='tabler:chevron-down'
              height={15}
              width={15}
              className='text-link dark:text-darklink shrink-0'
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-[280px] p-0' align='start'>
          <div className='p-2 border-b border-border dark:border-darkborder'>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('turno.searchPatient')}
              className='w-full rounded-md border border-border dark:border-darkborder bg-background px-2.5 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
            />
          </div>
          <div className='max-h-60 overflow-y-auto py-1'>
            {loading ? (
              <div className='px-3 py-2 text-xs text-link dark:text-darklink'>{t('turno.loading')}</div>
            ) : results.length === 0 ? (
              <div className='px-3 py-2 text-xs text-link dark:text-darklink'>{t('turno.noPatients')}</div>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type='button'
                  onClick={() => {
                    onChange(p.id, p.name)
                    setOpen(false)
                  }}
                  className='w-full text-left px-3 py-2 text-sm text-dark dark:text-white hover:bg-lightprimary/50 transition-colors'>
                  {p.name}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ── Add / edit turno modal ─────────────────────────────────────────────────────
type Draft = {
  id: string | null
  patientId: string | null
  patientName: string | null
  treatmentSlug: string
  professionalId: string
  sucursal: string
  status: TurnoStatus
  charged: boolean
  allDay: boolean
  startStr: string
  endStr: string
  startTime: string
  endTime: string
  observaciones: string
  packId: string | null
}

const SELECT_CLS =
  'mt-1 w-full pl-2.5 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

// Status picker with a colour dot per estado (native <option> can't be coloured).
function StatusSelect({
  value,
  onChange,
  options,
  labelFor,
  colorFor,
}: {
  value: string
  onChange: (v: string) => void
  // Selectable statuses (active ones, from config), in order.
  options: { key: string; label: string; color: string }[]
  // Resolve label/colour for ANY key (incl. the current one even if inactive).
  labelFor: (key: string) => string
  colorFor: (key: string) => string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type='button' className={`${SELECT_CLS} flex items-center justify-between gap-2 text-left`}>
          <span className='flex items-center gap-2 truncate'>
            <span className='h-2.5 w-2.5 rounded-full shrink-0' style={{ backgroundColor: colorFor(value) }} />
            <span className='truncate'>{labelFor(value)}</span>
          </span>
          <Icon icon='tabler:chevron-down' height={15} width={15} className='text-link dark:text-darklink shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-[240px] p-1' align='start'>
        <div className='max-h-72 overflow-y-auto'>
          {options.map((s) => (
            <button
              key={s.key}
              type='button'
              onClick={() => {
                onChange(s.key)
                setOpen(false)
              }}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded text-sm hover:bg-lightprimary text-dark dark:text-white ${s.key === value ? 'bg-lightprimary/60' : ''}`}>
              <span className='h-2.5 w-2.5 rounded-full shrink-0' style={{ backgroundColor: s.color }} />
              <span className='truncate'>{s.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Treatment picker with a colour dot per tratamiento (same colour as the agenda
// left bar). Native <option> can't be coloured, so a small popup like the estado.
function TreatmentSelect({
  value,
  options,
  onChange,
  colorFor,
  t,
}: {
  value: string
  options: Option[]
  onChange: (v: string) => void
  colorFor: (slug: string, name?: string) => string
  t: TFn
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type='button' className={`${SELECT_CLS} flex items-center justify-between gap-2 text-left`}>
          <span className='flex items-center gap-2 truncate'>
            {value && (
              <span
                className='h-2.5 w-2.5 rounded-sm shrink-0'
                style={{ backgroundColor: colorFor(value, current?.label) }}
              />
            )}
            <span className='truncate'>{current ? current.label : t('turno.none')}</span>
          </span>
          <Icon icon='tabler:chevron-down' height={15} width={15} className='text-link dark:text-darklink shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-[260px] p-1' align='start'>
        <div className='max-h-72 overflow-y-auto'>
          <button
            type='button'
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-2.5 py-1.5 rounded text-sm hover:bg-lightprimary text-dark dark:text-white ${value === '' ? 'bg-lightprimary/60' : ''}`}>
            {t('turno.none')}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type='button'
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded text-sm hover:bg-lightprimary text-dark dark:text-white ${o.value === value ? 'bg-lightprimary/60' : ''}`}>
              <span className='h-2.5 w-2.5 rounded-sm shrink-0' style={{ backgroundColor: colorFor(o.value, o.label) }} />
              <span className='truncate'>{o.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function EventDialog({
  draft,
  treatments,
  professionals,
  rules,
  exclusions,
  catalogSlugs,
  allEvents,
  isSucursalClosed,
  canOverrideClosed,
  canDelete,
  actorId,
  actorName,
  statusOptions,
  statusLabelFor,
  statusColorFor,
  treatmentColor,
  backDate,
  backView,
  onClose,
  onSaved,
  onCloseSession,
  t,
}: {
  draft: Draft
  treatments: Option[]
  professionals: Option[]
  rules: AvailabilityRule[]
  exclusions: AvailabilityExclusion[]
  catalogSlugs: string[]
  // All loaded turnos, to warn about overlaps (sobre-turnos) on save.
  allEvents: CalendarEvent[]
  // Is (date, sucursal) closed by a feriado/branch-closure block? + whether the
  // current user may FORCE a turno on a closed day (admin/operador only).
  isSucursalClosed: (ds: string, sucursal: string) => boolean
  canOverrideClosed: boolean
  // Only admin/operador (secretaría) may delete turnos; profesional cannot.
  canDelete: boolean
  // Acting user (for the audit trail: who made the change).
  actorId: string | null
  actorName: string
  // Turno status config (autogestionable): selectable options + resolvers.
  statusOptions: { key: string; label: string; color: string }[]
  statusLabelFor: (key: string) => string
  statusColorFor: (key: string) => string
  // Config-aware treatment colour resolver (for the treatment picker dots).
  treatmentColor: (slug: string, name?: string) => string
  backDate: string
  backView: string
  onClose: () => void
  onSaved: () => void
  // Open the clinical evolution form pre-linked to this turno ("Cerrar sesión").
  onCloseSession: (prefill: {
    patientId: string
    treatmentSlug?: string
    professionalId?: string
    calendarEventId: string
    sessionDate: string
  }) => void
  t: TFn
}) {
  const [patientId, setPatientId] = useState(draft.patientId)
  const [patientName, setPatientName] = useState(draft.patientName)
  const [treatmentSlug, setTreatmentSlug] = useState(draft.treatmentSlug)
  const [professionalId, setProfessionalId] = useState(draft.professionalId)
  const [sucursal, setSucursal] = useState(draft.sucursal)
  const [status, setStatus] = useState<TurnoStatus>(draft.status)
  const [charged, setCharged] = useState(draft.charged)
  const [allDay, setAllDay] = useState(draft.allDay)
  const [startStr, setStartStr] = useState(draft.startStr)
  const [endStr, setEndStr] = useState(draft.endStr)
  const [startTime, setStartTime] = useState(draft.startTime)
  const [endTime, setEndTime] = useState(draft.endTime)
  const [observaciones, setObservaciones] = useState(draft.observaciones)
  // Primera sesión: bumps the auto-suggested duration (charla/explicación previa).
  const [firstSession, setFirstSession] = useState(false)
  // Pack linking (Andrés' 4x3 / 5x4). A turno can be tied to a patient's pack
  // for the selected treatment; the session counter is derived elsewhere from
  // the turno statuses (a session is consumed only when 'atendido').
  const [packId, setPackId] = useState<string | null>(draft.packId)
  const [packConfigs, setPackConfigs] = useState<TreatmentPackConfig[]>([])
  const [activePacks, setActivePacks] = useState<PatientPack[]>([])
  const [packAttended, setPackAttended] = useState(0)
  const [creatingPack, setCreatingPack] = useState(false)
  const router = useRouter()
  // Basic patient data shown read-only when an existing turno is opened.
  const [basics, setBasics] = useState<PatientBasics | null>(null)
  useEffect(() => {
    if (!patientId) {
      setBasics(null)
      return
    }
    let active = true
    void fetchPatientBasics(patientId).then((b) => {
      if (active) setBasics(b)
    })
    return () => {
      active = false
    }
  }, [patientId])
  // Pack config catalog (which treatments are packs) — load once.
  useEffect(() => {
    let active = true
    void fetchPackConfigs().then(({ data }) => {
      if (active) setPackConfigs(data)
    })
    return () => {
      active = false
    }
  }, [])
  // The patient's active packs for the selected treatment (for the linker).
  useEffect(() => {
    if (!patientId || !treatmentSlug) {
      setActivePacks([])
      return
    }
    let active = true
    void fetchActivePacks(patientId, treatmentSlug).then((packs) => {
      if (active) setActivePacks(packs)
    })
    return () => {
      active = false
    }
  }, [patientId, treatmentSlug])
  // Attended-session count of the linked pack (drives the progress line).
  useEffect(() => {
    if (!packId) {
      setPackAttended(0)
      return
    }
    let active = true
    void fetchPackTurnos(packId).then((turnos) => {
      if (active) setPackAttended(turnos.filter((x) => turnoConsumesSession(x.status)).length)
    })
    return () => {
      active = false
    }
  }, [packId])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-block the turno's duration from the treatment (Andrés' rule: 15 min
  // habitual / 20 primera sesión; láser base + zonas). Only for timed turnos;
  // always editable afterwards (this just moves the end time). Called on the
  // user actions that change the suggestion, never on mount, so an existing
  // turno's saved duration is preserved until the user re-picks a treatment.
  const applyAutoDuration = (
    slug: string,
    first: boolean,
    sStr: string = startStr,
    sTime: string = startTime,
  ) => {
    if (allDay || !slug) return
    const minutes = suggestDurationMinutes(slug, first)
    if (minutes <= 0) return
    const end = new Date(dateTime(sStr, sTime).getTime() + minutes * 60_000)
    setEndStr(toDateInput(end))
    setEndTime(toTimeInput(end))
  }
  const isEdit = draft.id !== null

  // Pack context for the selected treatment + patient.
  const packConfig = packConfigs.find((c) => c.treatmentSlug === treatmentSlug && c.active) ?? null
  const selectedPack = activePacks.find((p) => p.id === packId) ?? null
  const packStats = selectedPack
    ? packProgress(selectedPack.totalSessions, packAttended, selectedPack.manualAdjustment)
    : null

  async function createPack() {
    if (!patientId || !packConfig || creatingPack) return
    setCreatingPack(true)
    const { data, error: err } = await createPatientPack({
      patientId,
      treatmentSlug,
      totalSessions: packConfig.totalSessions,
      label: packConfig.label,
    })
    setCreatingPack(false)
    if (err || !data) {
      setError(err)
      return
    }
    setActivePacks((prev) => [data, ...prev])
    setPackId(data.id)
  }

  const valid =
    !!patientId &&
    !!startStr &&
    !!endStr &&
    (allDay
      ? endStr >= startStr
      : !!startTime &&
        !!endTime &&
        dateTime(endStr, endTime).getTime() > dateTime(startStr, startTime).getTime())

  // Any day in the range the treatment is NOT offered at the branch (per the
  // availability rules) → warning. Uses the selected treatment when set, else
  // "any treatment" (whether the branch works at all that day).
  const hasClosedDay = useMemo(() => {
    if (!sucursal || !startStr) return false
    const endBound = allDay ? endStr || startStr : startStr
    const end = new Date(`${endBound}T00:00:00`)
    for (const d = new Date(`${startStr}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = toDateInput(d)
      const w = treatmentSlug
        ? availabilityFor(ds, sucursal, treatmentSlug, rules, exclusions)
        : anyTreatmentAvailability(ds, sucursal, catalogSlugs, rules, exclusions)
      if (!w.open) return true
    }
    return false
  }, [sucursal, treatmentSlug, startStr, endStr, allDay, rules, exclusions, catalogSlugs])

  async function save() {
    if (!valid || saving) return
    const isDarkNow =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    // Feriado / branch-closure ENFORCEMENT (Andrés 2026-09-15): a day closed via
    // Autogestión → Feriados must not simply warn. Users without permission are
    // BLOCKED; admin/operador may FORCE with a confirmation (logged once the
    // audit trail exists). Checked per day in the range, for the turno's sucursal.
    const closedByFeriado = (() => {
      if (!sucursal || !startStr) return false
      const endBound = allDay ? endStr || startStr : startStr
      const end = new Date(`${endBound}T00:00:00`)
      for (const d = new Date(`${startStr}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
        if (isSucursalClosed(toDateInput(d), sucursal)) return true
      }
      return false
    })()
    if (closedByFeriado) {
      if (!canOverrideClosed) {
        await Swal.fire({
          icon: 'error',
          title: t('turno.closedBlockedTitle'),
          text: t('turno.closedBlockedBody'),
          confirmButtonText: t('turno.closedBlockedOk'),
          confirmButtonColor: '#5d87ff',
          background: isDarkNow ? '#2a3547' : '#ffffff',
          color: isDarkNow ? '#ffffff' : '#2a3547',
          width: '360px',
          customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
        })
        return
      }
      const res = await Swal.fire({
        icon: 'warning',
        iconColor: '#fa896b',
        title: t('turno.closedForceTitle'),
        text: t('turno.closedForceBody'),
        showCancelButton: true,
        confirmButtonText: t('turno.closedForceYes'),
        cancelButtonText: t('agendaCal.cancel'),
        confirmButtonColor: '#fa896b',
        cancelButtonColor: isDarkNow ? '#3f4a5d' : '#e5e7eb',
        background: isDarkNow ? '#2a3547' : '#ffffff',
        color: isDarkNow ? '#ffffff' : '#2a3547',
        width: '380px',
        customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
      })
      if (!res.isConfirmed) return
    }
    // Availability guard: warn (but allow override) if the branch is closed by the
    // schedule rules (softer than a feriado). Skipped when already handled above.
    if (hasClosedDay && !closedByFeriado) {
      const isDark =
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark')
      const res = await Swal.fire({
        title: t('turno.closedConfirmTitle'),
        text: t('turno.closedConfirmBody'),
        icon: 'warning',
        iconColor: '#ffae1f',
        showCancelButton: true,
        confirmButtonText: t('turno.closedConfirmYes'),
        cancelButtonText: t('agendaCal.cancel'),
        confirmButtonColor: '#5d87ff',
        cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
        background: isDark ? '#2a3547' : '#ffffff',
        color: isDark ? '#ffffff' : '#2a3547',
        width: '360px',
        customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
      })
      if (!res.isConfirmed) return
    }
    // Sobre-turno: warn (do NOT block) if this timed turno overlaps another one
    // of the SAME professional (or same sucursal when no professional). A stronger
    // warning when it collides exactly (same professional + same start). Andrés
    // 2026-09-15: allow the overbooking on confirm; never hard-block.
    if (!allDay && (professionalId || sucursal)) {
      const s = dateTime(startStr, startTime).getTime()
      const e = dateTime(startStr, endTime).getTime()
      const conflicts = allEvents.filter(
        (ev) =>
          ev.id !== draft.id &&
          !ev.allDay &&
          ev.status !== 'cancelado' &&
          (professionalId
            ? ev.professionalId === professionalId
            : ev.sucursal === sucursal) &&
          ev.start.getTime() < e &&
          ev.end.getTime() > s,
      )
      if (conflicts.length > 0) {
        const exact =
          !!professionalId &&
          conflicts.some((c) => c.professionalId === professionalId && c.start.getTime() === s)
        const other = conflicts[0]!
        const otherName = other.patientName || other.title || t('turno.none')
        const otherRange = `${toTimeInput(other.start)} - ${toTimeInput(other.end)}`
        const isDark =
          typeof document !== 'undefined' &&
          document.documentElement.classList.contains('dark')
        const res = await Swal.fire({
          title: t(exact ? 'turno.overlapExactTitle' : 'turno.overlapTitle'),
          text: t(exact ? 'turno.overlapExactBody' : 'turno.overlapBody', {
            name: otherName,
            range: otherRange,
          }),
          icon: 'warning',
          iconColor: exact ? '#fa896b' : '#ffae1f',
          showCancelButton: true,
          confirmButtonText: t('turno.overlapConfirm'),
          cancelButtonText: t('agendaCal.cancel'),
          confirmButtonColor: exact ? '#fa896b' : '#5d87ff',
          cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
          background: isDark ? '#2a3547' : '#ffffff',
          color: isDark ? '#ffffff' : '#2a3547',
          width: '380px',
          customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
        })
        if (!res.isConfirmed) return
      }
    }
    setSaving(true)
    setError(null)
    const input = {
      title: patientName ?? 'Turno',
      start: allDay ? startOfDay(startStr) : dateTime(startStr, startTime),
      // A timed turno is always the SAME day (single "Fecha del turno"); use
      // startStr for the end too so a stale endStr can't leave it spanning two
      // days. Only all-day turnos use the separate end date (a real range).
      end: allDay ? endOfDay(endStr) : dateTime(startStr, endTime),
      allDay,
      status,
      charged,
      patientId,
      professionalId: professionalId || null,
      sucursal: sucursal || null,
      treatmentSlug: treatmentSlug || null,
      observaciones: observaciones.trim() || null,
      packId: packId || null,
    }
    // Build the audit entry (who / when / what) before persisting.
    const statusLabel = (s: TurnoStatus) => statusLabelFor(s)
    const profLabel = (id: string) => professionals.find((p) => p.value === id)?.label ?? id
    const sucLabel = (s: string) => (s ? sucursalLabel(s) : t('turno.none'))
    let auditAction: 'created' | 'updated' | 'rescheduled' | 'status_changed' | 'forced_closed'
    let auditDetail: string
    if (!isEdit) {
      auditAction = closedByFeriado ? 'forced_closed' : 'created'
      auditDetail = `${t('turnoAudit.created')}: ${statusLabel(status)}`
    } else {
      const changes: string[] = []
      const dateChanged =
        draft.startStr !== startStr ||
        draft.endStr !== endStr ||
        draft.startTime !== startTime ||
        draft.endTime !== endTime ||
        draft.allDay !== allDay
      if (dateChanged)
        changes.push(`${t('turnoAudit.rescheduledTo')} ${startStr}${allDay ? '' : ' ' + startTime}`)
      if (draft.status !== status)
        changes.push(`${t('turnoAudit.status')}: ${statusLabel(draft.status)} → ${statusLabel(status)}`)
      if (draft.sucursal !== sucursal)
        changes.push(`${t('turnoAudit.sucursal')}: ${sucLabel(draft.sucursal)} → ${sucLabel(sucursal)}`)
      if (draft.professionalId !== professionalId)
        changes.push(
          `${t('turnoAudit.professional')}: ${draft.professionalId ? profLabel(draft.professionalId) : t('turno.none')} → ${professionalId ? profLabel(professionalId) : t('turno.none')}`,
        )
      if (draft.charged !== charged)
        changes.push(charged ? t('turnoAudit.charged') : t('turnoAudit.uncharged'))
      auditAction = dateChanged
        ? 'rescheduled'
        : draft.status !== status
          ? 'status_changed'
          : 'updated'
      auditDetail = changes.length ? changes.join(' · ') : t('turnoAudit.updated')
    }
    if (closedByFeriado) auditDetail += ` · ${t('turnoAudit.forcedNote')}`

    let savedId: string | null = draft.id
    let err: string | null
    if (isEdit) {
      err = await updateCalendarEvent(draft.id as string, input)
    } else {
      const res = await createCalendarEvent(input)
      err = res.error
      savedId = res.data?.id ?? null
    }
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    void logTurnoAudit({
      calendarEventId: savedId,
      patientId,
      action: auditAction,
      detail: auditDetail,
      changedBy: actorId,
      changedByName: actorName,
    })
    onSaved()
  }

  async function remove() {
    if (!isEdit || !canDelete) return
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    const res = await Swal.fire({
      title: t('agendaCal.deleteConfirmTitle'),
      text: t('agendaCal.deleteConfirmBody'),
      icon: 'warning',
      iconColor: '#ffae1f',
      showCancelButton: true,
      confirmButtonText: t('agendaCal.deleteYes'),
      cancelButtonText: t('agendaCal.cancel'),
      confirmButtonColor: '#fa896b',
      cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
      background: isDark ? '#2a3547' : '#ffffff',
      color: isDark ? '#ffffff' : '#2a3547',
      width: '360px',
      customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
    })
    if (!res.isConfirmed) return
    setSaving(true)
    const err = await deleteCalendarEvent(draft.id as string)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    void logTurnoAudit({
      calendarEventId: null,
      patientId,
      action: 'deleted',
      detail: t('turnoAudit.deleted'),
      changedBy: actorId,
      changedByName: actorName,
    })
    onSaved()
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'
      onClick={onClose}>
      {/* Column layout with a fixed header + footer and a scrollable body so a
          tall form never hides the title or the action buttons (Andrés 2026-09-14). */}
      <div
        className='w-full max-w-md rounded-xl bg-card shadow-xl flex flex-col max-h-[90vh]'
        onClick={(e) => e.stopPropagation()}>
        <div className='p-6 pb-3 shrink-0'>
          <div className='flex items-start justify-between mb-1'>
            <h3 className='text-lg font-semibold text-dark dark:text-white'>
              {isEdit ? t('turno.editTitle') : t('turno.addTitle')}
            </h3>
            <button
              type='button'
              onClick={onClose}
              aria-label={t('agendaCal.cancel')}
              className='text-link dark:text-darklink hover:text-primary transition-colors'>
              <Icon icon='tabler:x' height={20} width={20} />
            </button>
          </div>
          <p className='text-xs text-link dark:text-darklink'>{t('turno.subtitle')}</p>
        </div>

        <div className='px-6 pb-4 overflow-y-auto flex-1 space-y-4'>
          <PatientPicker
            valueName={patientName}
            onChange={(id, name) => {
              setPatientId(id)
              setPatientName(name)
            }}
            t={t}
          />

          {basics && (
            <div className='rounded-md border border-border dark:border-darkborder bg-lightprimary/30 dark:bg-white/5 px-3 py-2.5 text-xs space-y-1'>
              <div className='flex items-center justify-between gap-2'>
                <span className='font-semibold text-dark dark:text-white text-sm'>{basics.fullName}</span>
                {patientId && (
                  <button
                    type='button'
                    onClick={() =>
                      router.push(
                        `/pacientes/${patientId}?from=agenda&date=${backDate}&view=${backView}`,
                      )
                    }
                    className='inline-flex items-center gap-1 text-primary hover:underline font-medium shrink-0'>
                    <Icon icon='solar:user-id-line-duotone' height={14} width={14} />
                    {t('turno.viewFicha')}
                  </button>
                )}
              </div>
              <div className='flex flex-wrap gap-x-4 gap-y-1 text-link dark:text-darklink'>
                {basics.dni && <span>{t('turno.dni')}: {basics.dni}</span>}
                {basics.phone && <span>{t('turno.phone')}: {basics.phone}</span>}
                {basics.email && <span>{t('turno.email')}: {basics.email}</span>}
                {basics.birthdate && (
                  <span>
                    {t('turno.birthdate')}: {basics.birthdate}
                    {computeAge(basics.birthdate) != null ? ` (${computeAge(basics.birthdate)} ${t('turno.yearsShort')})` : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <label className='block'>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.treatment')}</span>
              <TreatmentSelect
                value={treatmentSlug}
                options={treatments}
                onChange={(v) => {
                  setTreatmentSlug(v)
                  applyAutoDuration(v, firstSession)
                }}
                colorFor={treatmentColor}
                t={t}
              />
            </label>
            <label className='block'>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.professional')}</span>
              <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={SELECT_CLS}>
                <option value=''>{t('turno.none')}</option>
                {professionals.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className='block'>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.sucursal')}</span>
              <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} className={SELECT_CLS}>
                <option value=''>{t('turno.none')}</option>
                {SUCURSALES.map((s) => (
                  <option key={s} value={s}>{sucursalLabel(s)}</option>
                ))}
              </select>
            </label>
            <label className='block'>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.status')}</span>
              <StatusSelect
                value={status}
                onChange={(v) => setStatus(v as TurnoStatus)}
                options={statusOptions}
                labelFor={statusLabelFor}
                colorFor={statusColorFor}
              />
            </label>
          </div>

          {/* Pack linker — shown only when the treatment is sold as a pack. */}
          {packConfig && patientId && (
            <div className='rounded-md border border-secondary/30 bg-secondary/5 px-3 py-2.5 space-y-2'>
              <div className='flex items-center gap-1.5 text-xs font-semibold text-dark dark:text-white'>
                <Icon icon='solar:box-line-duotone' height={15} width={15} className='text-secondary' />
                {t('turno.pack.title')} · {packConfig.label}
              </div>
              {activePacks.length > 0 ? (
                <select
                  value={packId ?? ''}
                  onChange={(e) => setPackId(e.target.value || null)}
                  className={SELECT_CLS}>
                  <option value=''>{t('turno.pack.none')}</option>
                  {activePacks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} · {new Date(p.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              ) : (
                <p className='text-xs text-link dark:text-darklink'>{t('turno.pack.noneYet')}</p>
              )}
              {packStats && (
                <p className='text-xs text-link dark:text-darklink'>
                  {t('turno.pack.progress', {
                    done: String(packStats.done),
                    total: String(selectedPack?.totalSessions ?? 0),
                    remaining: String(packStats.remaining),
                  })}
                  {packStats.next != null && (
                    <>
                      {' · '}
                      <span className='font-medium text-secondary'>
                        {t('turno.pack.next', {
                          n: String(packStats.next),
                          total: String(selectedPack?.totalSessions ?? 0),
                        })}
                      </span>
                    </>
                  )}
                </p>
              )}
              <button
                type='button'
                onClick={createPack}
                disabled={creatingPack}
                className='inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:underline disabled:opacity-50'>
                <Icon icon='tabler:plus' height={13} width={13} />
                {t('turno.pack.create', { label: packConfig.label })}
              </button>
            </div>
          )}

          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className='h-4 w-4 rounded border-border dark:border-darkborder accent-primary'
            />
            <span className='text-sm text-dark dark:text-white'>{t('turno.allDay')}</span>
          </label>

          {allDay ? (
            // Multi-day range (feriados/bloqueos/eventos de varios días).
            <div className='grid grid-cols-2 gap-3'>
              <DateField
                label={t('agendaCal.fieldStart')}
                value={startStr}
                onChange={(v) => {
                  setStartStr(v)
                  if (endStr < v) setEndStr(v)
                }}
              />
              <DateField
                label={t('agendaCal.fieldEnd')}
                value={endStr}
                min={startStr}
                onChange={setEndStr}
              />
            </div>
          ) : (
            // Normal turno: a single date + hora inicio/fin (Andrés 2026-09-12).
            <DateField
              label={t('turno.date')}
              value={startStr}
              onChange={(v) => {
                setStartStr(v)
                setEndStr(v)
              }}
            />
          )}

          {!allDay && (
            <div className='grid grid-cols-2 gap-3'>
              <label className='block'>
                <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.startTime')}</span>
                <input
                  type='time'
                  value={startTime}
                  onChange={(e) => {
                    const v = e.target.value
                    setStartTime(v)
                    // Keep the auto-blocked duration when the start moves.
                    applyAutoDuration(treatmentSlug, firstSession, startStr, v)
                  }}
                  className='mt-1 w-full rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
                />
              </label>
              <label className='block'>
                <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.endTime')}</span>
                <input
                  type='time'
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className='mt-1 w-full rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
                />
              </label>
            </div>
          )}

          {!allDay && (
            <div className='space-y-1.5'>
              <label className='flex items-center gap-2 cursor-pointer select-none'>
                <input
                  type='checkbox'
                  checked={firstSession}
                  onChange={(e) => {
                    const c = e.target.checked
                    setFirstSession(c)
                    applyAutoDuration(treatmentSlug, c)
                  }}
                  className='h-4 w-4 rounded border-border dark:border-darkborder accent-primary'
                />
                <span className='text-sm text-dark dark:text-white'>{t('turno.firstSession')}</span>
              </label>
              <p className='text-xs text-link dark:text-darklink'>{t('turno.durationHint')}</p>
            </div>
          )}

          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={charged}
              onChange={(e) => setCharged(e.target.checked)}
              className='h-4 w-4 rounded border-border dark:border-darkborder accent-success'
            />
            <span className='text-sm text-dark dark:text-white'>{t('turno.charged')}</span>
          </label>

          <label className='block'>
            <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.observaciones')}</span>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder={t('turno.observacionesPlaceholder')}
              className='mt-1 w-full rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors resize-y'
            />
          </label>

          {hasClosedDay && (
            <p className='flex items-start gap-1.5 text-xs text-warning'>
              <Icon icon='solar:danger-triangle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
              {t('turno.closedWarning')}
            </p>
          )}

          {error && <p className='text-xs text-error'>{t('agendaCal.saveError')}</p>}
        </div>

        <div className='p-6 pt-3 shrink-0 border-t border-border dark:border-darkborder flex items-center justify-between gap-2'>
          {isEdit && canDelete ? (
            <button
              type='button'
              onClick={remove}
              disabled={saving}
              className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-error hover:bg-lighterror/60 transition-colors disabled:opacity-50'>
              <Icon icon='tabler:trash' height={16} width={16} />
              {t('agendaCal.delete')}
            </button>
          ) : (
            <span />
          )}
          <div className='flex items-center gap-2'>
            {isEdit && patientId && (
              <button
                type='button'
                onClick={() =>
                  onCloseSession({
                    patientId,
                    ...(treatmentSlug && { treatmentSlug }),
                    ...(professionalId && { professionalId }),
                    calendarEventId: draft.id!,
                    sessionDate: allDay
                      ? new Date(`${startStr}T12:00:00`).toISOString()
                      : dateTime(startStr, startTime).toISOString(),
                  })
                }
                className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-primary hover:bg-lightprimary transition-colors'>
                <Icon icon='solar:clipboard-heart-line-duotone' height={16} width={16} />
                {t('turno.closeSession')}
              </button>
            )}
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('agendaCal.cancel')}
            </button>
            <button
              type='button'
              onClick={save}
              disabled={!valid || saving}
              className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
              {saving ? t('agendaCal.saving') : isEdit ? t('agendaCal.save') : t('agendaCal.add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Drag-and-drop enabled calendar (react-big-calendar addon). Created once at
// module scope so the HOC isn't re-applied on every render.
const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar)

// Custom "Semana" view (Andrés 2026-09-15): the agenda LIST scoped to the current
// week (Dom–Sáb) instead of the time grid — dates on the left, no time gutter.
// Reuses RBC's Agenda renderer (so the circle + "$" block components apply),
// forced to 7 days and aligned to the week regardless of the shared `length` prop.
/* eslint-disable @typescript-eslint/no-explicit-any */
type RbcLocalizer = {
  startOf: (d: Date, unit: string) => Date
  endOf: (d: Date, unit: string) => Date
  add: (d: Date, amount: number, unit: string) => Date
  format: (d: Date, fmt: string) => string
}
// Week = a Monday–Saturday time grid (Andrés 2026-09-15): the days are the
// columns and the hours run vertically, so the height stays constant no matter
// how many turnos there are, and simultaneous turnos (any sucursal/profesional)
// render side by side automatically (TimeGrid overlap layout). Sunday is dropped
// because the clinic does not work that day. Column-by-sucursal/profesional is a
// Day-only concern here, so this view ignores resources.
function weekMonToSat(date: Date, localizer: RbcLocalizer): Date[] {
  const base = localizer.startOf(date, 'day')
  const back = (base.getDay() + 6) % 7 // days since the Monday of this week
  const monday = localizer.add(base, -back, 'day')
  return [0, 1, 2, 3, 4, 5].map((i) => localizer.add(monday, i, 'day'))
}
function WorkWeekView(props: any) {
  const range = weekMonToSat(props.date, props.localizer as RbcLocalizer)
  return <TimeGrid {...props} range={range} eventOffset={15} />
}
WorkWeekView.range = (date: Date, { localizer }: { localizer: RbcLocalizer }) =>
  weekMonToSat(date, localizer)
WorkWeekView.navigate = (
  date: Date,
  action: string,
  { localizer }: { localizer: RbcLocalizer },
) => {
  if (action === 'PREV') return localizer.add(date, -7, 'day')
  if (action === 'NEXT') return localizer.add(date, 7, 'day')
  return date
}
WorkWeekView.title = (date: Date, { localizer }: { localizer: RbcLocalizer }) => {
  const days = weekMonToSat(date, localizer)
  const start = days[0]
  const end = days[days.length - 1]
  return `${localizer.format(start, 'ddd D MMM')} – ${localizer.format(end, 'ddd D MMM YYYY')}`
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Main view ─────────────────────────────────────────────────────────────────
export function CalendarView() {
  const { t, locale } = useTranslation()
  const { role, name: actorName, userId: actorId } = useCurrentUser()
  const isProfesional = role === 'profesional'
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Restore date/view from the URL (?date=&view=) when returning from a ficha.
  const [view, setView] = useState<View>(() => {
    if (typeof window === 'undefined') return Views.MONTH
    const v = new URLSearchParams(window.location.search).get('view')
    return v === 'week' || v === 'day' || v === 'agenda' || v === 'month' ? (v as View) : Views.MONTH
  })
  const [date, setDate] = useState<Date>(() => {
    if (typeof window === 'undefined') return new Date()
    const d = new URLSearchParams(window.location.search).get('date')
    return d ? new Date(`${d}T00:00:00`) : new Date()
  })
  const [draft, setDraft] = useState<Draft | null>(null)
  // When set, the clinical evolution form opens pre-linked to a turno ("Cerrar
  // sesión"). Reuses the ficha's EvolucionForm (agenda ↔ ficha integration).
  const [evolucionPrefill, setEvolucionPrefill] = useState<{
    patientId: string
    treatmentSlug?: string
    professionalId?: string
    calendarEventId: string
    sessionDate: string
  } | null>(null)
  const [treatments, setTreatments] = useState<Option[]>([])
  const [professionals, setProfessionals] = useState<Option[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  // Filter by professional. Admin/operador pick from the dropdown ('' = all);
  // the Profesional role is locked to their own turnos (Andrés' scoped view).
  const [professionalFilterIds, setProfessionalFilterIds] = useState<string[]>([])
  // Filter by sucursal ('' = all). When a sucursal is picked we also shade its
  // closed days/hours (availability) from sucursal_hours.
  const [sucursalFilter, setSucursalFilter] = useState('')
  // "Columns by branch" mode: render one column per sucursal (react-big-calendar
  // resources) so staff can drag a turno between branches to reassign it. Only
  // meaningful in the Day view, so turning it on forces Day.
  // Resource columns in Day view: none, one column per sucursal, or one per
  // profesional (Andrés 2026-09-11: two professionals working simultaneously).
  const [columnMode, setColumnMode] = useState<'none' | 'sucursal' | 'professional'>('none')
  const inColumns = columnMode !== 'none'
  // Columns are a DAY-view display option only (Andrés 2026-09-15): they must not
  // block navigation to Week/Month. When leaving Day the columns are ignored, and
  // the last choice is remembered (columnMode state persists) for when you return.
  const columnsActive = inColumns && view === Views.DAY
  // Vertical time scale (minutes per slot) for Week/Day — a zoom, not the real
  // duration. Smaller = short turnos read clearly (Andrés 2026-09-11).
  const [scaleMin, setScaleMin] = useState(30)
  const [availRules, setAvailRules] = useState<AvailabilityRule[]>([])
  const [availExclusions, setAvailExclusions] = useState<AvailabilityExclusion[]>([])
  const [catalogSlugs, setCatalogSlugs] = useState<string[]>([])
  const [treatmentFilterSlugs, setTreatmentFilterSlugs] = useState<string[]>([])
  const [blocks, setBlocks] = useState<AgendaBlock[]>([])
  // Pack totals (id -> {total,label}) to render "Sesión N/M" on turno cards.
  const [packTotals, setPackTotals] = useState<Map<string, { total: number; label: string }>>(
    new Map(),
  )
  // Per-treatment colour overrides (Autogestión). Empty → default palette.
  const [treatmentColorMap, setTreatmentColorMap] = useState<Map<string, string>>(new Map())
  const treatmentColorResolved = useCallback(
    (slug: string | null | undefined, name?: string) =>
      (slug && treatmentColorMap.get(slug)) || treatmentColorFor(slug, name).hex,
    [treatmentColorMap],
  )
  // Autogestionable turno status config (label/colour/active/order). Empty until
  // loaded → helpers fall back to the built-in defaults.
  const [statusConfigs, setStatusConfigs] = useState<TurnoStatusConfig[]>([])
  const statusColorFor = useCallback(
    (key: string) =>
      statusConfigs.find((c) => c.statusKey === key)?.color ??
      STATUS_COLORS[key as TurnoStatus] ??
      '#8a94a6',
    [statusConfigs],
  )
  const statusLabelFor = useCallback(
    (key: string) => {
      const cfg = statusConfigs.find((c) => c.statusKey === key)
      if (cfg) return cfg.label
      const k = STATUS_LABEL_KEY[key as TurnoStatus]
      return k ? t(k) : key
    },
    [statusConfigs, t],
  )
  const statusOptions = useMemo(() => {
    const list = statusConfigs.length
      ? statusConfigs.filter((c) => c.active).map((c) => ({ key: c.statusKey, label: c.label, color: c.color }))
      : TURNO_STATUSES.map((s) => ({ key: s, label: t(STATUS_LABEL_KEY[s]), color: STATUS_COLORS[s] }))
    return list
  }, [statusConfigs, t])

  moment.locale(locale)
  const localizer = useMemo(() => momentLocalizer(moment), [locale])

  // Refresh events in place. Does NOT flip `loading` (only the initial mount
  // shows the spinner) — otherwise every save/drag unmounted the calendar and
  // flashed the spinner, which looked like a full page reload.
  const reload = useCallback(() => {
    void fetchCalendarEvents().then(({ data, error }) => {
      setEvents(data)
      setLoadError(error)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    reload()
    void getCurrentUserId().then(setMyUserId)
    // Pre-reserva TTL: auto-cancel expired 'reservado' turnos (48h) on load,
    // then refresh + toast how many were freed.
    void autoCancelExpiredReservas().then(({ cancelled }) => {
      if (cancelled <= 0) return
      const isDark =
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      Swal.fire({
        title: t('agendaCal.autoCancelled', { count: String(cancelled) }),
        icon: 'info',
        iconColor: '#5d87ff',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        background: isDark ? '#2a3547' : '#ffffff',
        color: isDark ? '#ffffff' : '#2a3547',
        customClass: { popup: '!rounded-lg', title: '!text-sm' },
      })
      reload()
    })
    // Lookups for the form (best-effort; empty on RLS/error). Merge the full
    // treatment catalog (menu_overrides) with the flat-priced ones so depilación,
    // tatuajes and verrugas are bookable — not just the photo-eval treatments.
    void Promise.all([fetchMenuOverrides(), fetchTreatmentPrices()]).then(([mo, tp]) => {
      const byslug = new Map<string, string>()
      for (const m of mo.data) byslug.set(m.slug, m.displayName)
      for (const p of tp.data) if (!byslug.has(p.slug)) byslug.set(p.slug, p.displayName)
      const opts = [...byslug.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label))
      setTreatments(opts)
      setCatalogSlugs(opts.map((o) => o.value))
    })
    // Availability rules + cross-sucursal exclusions for shading + warnings.
    void fetchAvailability().then(({ rules, exclusions }) => {
      setAvailRules(rules)
      setAvailExclusions(exclusions)
    })
    void fetchPackTotals().then(setPackTotals)
    void fetchTurnoStatusConfig().then(({ data }) => setStatusConfigs(data))
    void fetchTreatmentColors().then(setTreatmentColorMap)
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data
          .filter((u) => u.status === 'active')
          .map((u) => ({ value: u.id, label: u.fullName })),
      ),
    )
  }, [reload, t])

  // Effective professional filter: the Profesional role is always locked to
  // their own turnos; everyone else uses the multi-select (empty = all).
  const effectiveProfessionalIds = useMemo(
    () => (isProfesional ? [myUserId ?? '__none__'] : professionalFilterIds),
    [isProfesional, myUserId, professionalFilterIds],
  )
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (effectiveProfessionalIds.length === 0 ||
            (e.professionalId != null && effectiveProfessionalIds.includes(e.professionalId))) &&
          (!sucursalFilter || e.sucursal === sucursalFilter) &&
          (treatmentFilterSlugs.length === 0 ||
            (e.treatmentSlug != null && treatmentFilterSlugs.includes(e.treatmentSlug))),
      ),
    [events, effectiveProfessionalIds, sucursalFilter, treatmentFilterSlugs],
  )

  // Load feriados / branch-closure blocks (0037) once, for day shading.
  useEffect(() => {
    let active = true
    void fetchAgendaBlocks().then(({ data }) => {
      if (active) setBlocks(data)
    })
    return () => {
      active = false
    }
  }, [])

  // Branch-closure (feriado) blocks that apply to the current sucursal filter.
  const closureBlocks = useMemo(
    () =>
      blocks.filter(
        (b) =>
          b.professionalId === null &&
          (b.sucursal === null || b.sucursal === sucursalFilter),
      ),
    [blocks, sucursalFilter],
  )
  const isBlockedDay = useCallback(
    (d: Date) => {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return closureBlocks.some((b) => b.startDate <= ds && b.endDate >= ds)
    },
    [closureBlocks],
  )
  // Is a SPECIFIC sucursal closed on a date by a branch-closure block (feriado /
  // cierre)? A block with sucursal null closes every branch; professionalId null
  // = a branch closure (not a professional's vacation). Used by the month stripes
  // so a closed branch's colour never shows as available (Andrés 2026-09-14).
  const isSucursalClosed = useCallback(
    (ds: string, suc: string) =>
      blocks.some(
        (b) =>
          b.professionalId === null &&
          (b.sucursal === null || b.sucursal === suc) &&
          b.startDate <= ds &&
          b.endDate >= ds,
      ),
    [blocks],
  )

  // Availability window for a date at the filtered sucursal, per the rules —
  // scoped to the treatment filter when set, else "any treatment". Null when no
  // sucursal is selected (all-branches view is not shaded by hours).
  // Availability window at a sucursal on a date, honouring the multi-selects:
  // treatment = union of the selected (or the whole catalog), professional =
  // union of the selected (or any). Drives shading and the day dots.
  const sucursalOpen = useCallback(
    (ds: string, sucursal: string) => {
      const slugs = treatmentFilterSlugs.length ? treatmentFilterSlugs : catalogSlugs
      const profs: (string | undefined)[] = professionalFilterIds.length
        ? professionalFilterIds
        : [undefined]
      let open = false
      let openMin = Number.POSITIVE_INFINITY
      let closeMin = Number.NEGATIVE_INFINITY
      for (const slug of slugs)
        for (const p of profs) {
          const w = availabilityFor(ds, sucursal, slug, availRules, availExclusions, p)
          if (w.open) {
            open = true
            openMin = Math.min(openMin, w.openMin ?? openMin)
            closeMin = Math.max(closeMin, w.closeMin ?? closeMin)
          }
        }
      return open ? { open: true, openMin, closeMin } : { open: false }
    },
    [treatmentFilterSlugs, professionalFilterIds, catalogSlugs, availRules, availExclusions],
  )

  const shadeWindow = useCallback(
    (d: Date) => (sucursalFilter ? sucursalOpen(toDateInput(d), sucursalFilter) : null),
    [sucursalFilter, sucursalOpen],
  )

  // "Todas" overview: which sucursales are open on a date (per the filters) —
  // one soft-coloured marker/tint per open branch. Only in all-branches mode; a
  // single-branch view uses the closed-day shading instead.
  const dayMarkers = useCallback(
    (d: Date): { sucursal: string; color: string }[] => {
      if (sucursalFilter || columnsActive) return []
      const ds = toDateInput(d)
      return SUCURSALES.filter(
        (suc) => sucursalOpen(ds, suc).open && !isSucursalClosed(ds, suc),
      ).map((suc) => ({
        sucursal: suc,
        color: sucursalColor(suc),
      }))
    },
    [sucursalFilter, columnsActive, sucursalOpen, isSucursalClosed],
  )
  // Same per-sucursal availability, but WITHOUT the "column mode" guard (columns
  // don't apply to the agenda/week list) — used to colour the list's date column.
  const sedeMarkers = useCallback(
    (d: Date): { sucursal: string; color: string }[] => {
      const ds = toDateInput(d)
      return SUCURSALES.filter(
        (suc) =>
          (!sucursalFilter || suc === sucursalFilter) &&
          sucursalOpen(ds, suc).open &&
          !isSucursalClosed(ds, suc),
      ).map((suc) => ({ sucursal: suc, color: sucursalColor(suc) }))
    },
    [sucursalFilter, sucursalOpen, isSucursalClosed],
  )

  // Turnos of each day grouped by sucursal (for the Month overview circles).
  // dateStr -> sucursal(or NONE) -> turnos. Excludes cancelled.
  const turnosByDaySucursal = useMemo(() => {
    const m = new Map<string, Map<string, CalendarEvent[]>>()
    for (const e of visibleEvents) {
      if (e.status === 'cancelado') continue
      const ds = toDateInput(e.start)
      const suc = e.sucursal || NONE_RESOURCE
      let inner = m.get(ds)
      if (!inner) {
        inner = new Map()
        m.set(ds, inner)
      }
      const arr = inner.get(suc)
      if (arr) arr.push(e)
      else inner.set(suc, [e])
    }
    return m
  }, [visibleEvents])

  // "Columns by branch" resources for the Day/Week view: one column per sucursal
  // that is OPEN on the current date OR has turnos that day (Andrés 2026-09-15 —
  // opening a day shows only the branches that work that day), + a "Sin asignar"
  // bucket when some turno that day has no sucursal.
  const sucursalResources = useMemo(() => {
    const ds = toDateInput(date)
    const relevant = new Set<string>()
    for (const m of sedeMarkers(date)) relevant.add(m.sucursal)
    const dayMap = turnosByDaySucursal.get(ds)
    let hasNone = false
    if (dayMap) {
      for (const suc of dayMap.keys()) {
        if (suc === NONE_RESOURCE) hasNone = true
        else relevant.add(suc)
      }
    }
    const cols = SUCURSALES.filter((s) => relevant.has(s))
    const base = (cols.length ? cols : [...SUCURSALES]).map((s) => ({
      resourceId: s as string,
      resourceTitle: sucursalLabel(s),
    }))
    if (hasNone) base.push({ resourceId: NONE_RESOURCE, resourceTitle: t('agenda.noSucursal') })
    return base
  }, [date, sedeMarkers, turnosByDaySucursal, t])
  // "Por profesional" columns (Andrés 2026-09-15): DYNAMIC and grouped by sucursal.
  // For the current date we build one column per (sucursal, profesional) that
  // actually works that day — a professional "works" at a sucursal if they have a
  // turno there that day OR the availability rules open a slot for them there. No
  // fixed/empty columns, no permanent "Sin asignar": that column appears only if
  // there are turnos that day without a professional. Sucursales with no known
  // professional (open but unassigned) fall back to a single sucursal column so no
  // turno is ever homeless. resourceId encodes the pair: sp:<suc>:<profId>,
  // su:<suc>, or the unassigned bucket.
  type DayCol = {
    resourceId: string
    resourceTitle: string
    sucursal: string
    sucColor: string
  }
  const dayHybridResources = useMemo<DayCol[]>(() => {
    const ds = toDateInput(date)
    const dayMap = turnosByDaySucursal.get(ds)
    const sucs = new Set<string>()
    for (const m of sedeMarkers(date)) sucs.add(m.sucursal)
    if (dayMap) for (const s of dayMap.keys()) if (s !== NONE_RESOURCE) sucs.add(s)
    const orderedSucs = SUCURSALES.filter((s) => sucs.has(s))
    const cols: DayCol[] = []
    let hasUnassigned = false
    for (const suc of orderedSucs) {
      const profIds = new Set<string>()
      for (const p of professionals) {
        const works = catalogSlugs.some(
          (slug) => availabilityFor(ds, suc, slug, availRules, availExclusions, p.value).open,
        )
        if (works) profIds.add(p.value)
      }
      for (const tt of dayMap?.get(suc) ?? []) {
        if (tt.professionalId) profIds.add(tt.professionalId)
        else hasUnassigned = true
      }
      const profList = professionals.filter((p) => profIds.has(p.value))
      if (profList.length === 0) {
        cols.push({
          resourceId: `su:${suc}`,
          resourceTitle: sucursalLabel(suc),
          sucursal: suc,
          sucColor: sucursalColor(suc),
        })
      } else {
        for (const p of profList)
          cols.push({
            resourceId: `sp:${suc}:${p.value}`,
            resourceTitle: p.label,
            sucursal: suc,
            sucColor: sucursalColor(suc),
          })
      }
    }
    if (hasUnassigned)
      cols.push({
        resourceId: NONE_RESOURCE,
        resourceTitle: t('agenda.noProfessional'),
        sucursal: '',
        sucColor: '#94a3b8',
      })
    return cols.length
      ? cols
      : [{ resourceId: NONE_RESOURCE, resourceTitle: t('turno.none'), sucursal: '', sucColor: '#94a3b8' }]
  }, [date, sedeMarkers, turnosByDaySucursal, professionals, catalogSlugs, availRules, availExclusions, t])

  // Map a turno to its hybrid column: prefer the exact (sucursal, profesional)
  // pair, else the sucursal-only column, else the unassigned bucket.
  const hybridResourceIdFor = useCallback(
    (e: CalendarEvent, colIds: Set<string>) => {
      const suc = e.sucursal || ''
      if (e.professionalId && colIds.has(`sp:${suc}:${e.professionalId}`))
        return `sp:${suc}:${e.professionalId}`
      if (colIds.has(`su:${suc}`)) return `su:${suc}`
      return NONE_RESOURCE
    },
    [],
  )

  const resources = columnMode === 'professional' ? dayHybridResources : sucursalResources
  const calendarEvents = useMemo(() => {
    if (columnMode === 'professional') {
      const colIds = new Set(dayHybridResources.map((r) => r.resourceId))
      return visibleEvents.map((e) => ({ ...e, resourceId: hybridResourceIdFor(e, colIds) }))
    }
    if (columnMode === 'sucursal')
      return visibleEvents.map((e) => ({ ...e, resourceId: e.sucursal || NONE_RESOURCE }))
    return visibleEvents
  }, [columnMode, visibleEvents, dayHybridResources, hybridResourceIdFor])

  // Pre-reservas past the TTL (highlight only — no auto-cancel in v1).
  const expiredCount = useMemo(
    () => visibleEvents.filter((e) => isExpiredReserva(e)).length,
    [visibleEvents],
  )


  // Treatment slug → display name, for the event card's second line.
  const treatmentName = useCallback(
    (slug?: string | null) => {
      if (!slug) return ''
      return treatments.find((o) => o.value === slug)?.label ?? slug
    },
    [treatments],
  )
  // Professional id → display name, for the event card's third line.
  const professionalName = useCallback(
    (id?: string | null) => {
      if (!id) return ''
      return professionals.find((o) => o.value === id)?.label ?? ''
    },
    [professionals],
  )

  // Treatment-colour legend: the time-grid views (Week/Day/Agenda) colour the
  // treatment bar + agenda circle by treatment, so show what each colour means.
  // Only the treatments actually present in the current (filtered) events.
  const treatmentLegend = useMemo(() => {
    const seen = new Map<string, { label: string; color: string }>()
    for (const e of visibleEvents) {
      if (!e.treatmentSlug || seen.has(e.treatmentSlug)) continue
      const label = treatmentName(e.treatmentSlug)
      seen.set(e.treatmentSlug, {
        label,
        color: treatmentColorResolved(e.treatmentSlug, label),
      })
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [visibleEvents, treatmentName, treatmentColorResolved])

  // Status-colour legend (Andrés 2026-09-15): the Month circles are coloured by
  // the patient STATUS, so the Month view shows what each circle colour means.
  // Only the estados present among the month's (non-cancelled) turnos.
  const statusLegend = useMemo(() => {
    const seen = new Map<string, { label: string; color: string }>()
    for (const e of visibleEvents) {
      if (e.status === 'cancelado' || seen.has(e.status)) continue
      seen.set(e.status, { label: statusLabelFor(e.status), color: statusColorFor(e.status) })
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [visibleEvents, statusLabelFor, statusColorFor])

  // Refs to the volatile lookups so the RBC `components` can be STABLE (never
  // change identity). If the components object changed each render, RBC remounted
  // the toolbar + cells → the "Nuevo evento" button, month label and cells blinked
  // on every state change (e.g. toggling a filter). Stable components read the
  // latest data via these refs; the calendar re-renders cells when `events` change.
  const dayMarkersRef = useRef(dayMarkers)
  dayMarkersRef.current = dayMarkers
  const sedeMarkersRef = useRef(sedeMarkers)
  sedeMarkersRef.current = sedeMarkers
  const treatmentNameRef = useRef(treatmentName)
  treatmentNameRef.current = treatmentName
  const professionalNameRef = useRef(professionalName)
  professionalNameRef.current = professionalName
  const statusColorRef = useRef(statusColorFor)
  statusColorRef.current = statusColorFor
  const statusLabelRef = useRef(statusLabelFor)
  statusLabelRef.current = statusLabelFor
  const treatmentColorRef = useRef(treatmentColorResolved)
  treatmentColorRef.current = treatmentColorResolved
  const turnosByDaySucursalRef = useRef(turnosByDaySucursal)
  turnosByDaySucursalRef.current = turnosByDaySucursal

  // "Sesión N/M" per turno: order a pack's non-cancelled turnos by date and
  // label each with its position + the pack total. Shown discreetly on the card.
  const packSessionLabels = useMemo(() => {
    const byPack = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      if (!e.packId || e.status === 'cancelado') continue
      const arr = byPack.get(e.packId) ?? []
      arr.push(e)
      byPack.set(e.packId, arr)
    }
    const labels = new Map<string, string>()
    for (const [pid, arr] of byPack) {
      arr.sort((a, b) => a.start.getTime() - b.start.getTime())
      const total = packTotals.get(pid)?.total ?? arr.length
      arr.forEach((e, i) => labels.set(e.id, `${i + 1}/${total}`))
    }
    return labels
  }, [events, packTotals])
  const packSessionLabelsRef = useRef(packSessionLabels)
  packSessionLabelsRef.current = packSessionLabels

  // Week/Day column header: default label + a coloured dot per open sucursal.
  const dayHeader = useCallback(
    ({ date, label }: { date: Date; label: string }) => {
      const markers = dayMarkersRef.current(date)
      return (
        <div className='flex flex-col items-center gap-0.5 py-0.5'>
          <span>{label}</span>
          {markers.length > 0 && (
            <span className='flex gap-1'>
              {markers.map((m) => (
                <span
                  key={m.sucursal}
                  title={sucursalLabel(m.sucursal)}
                  className='h-2 w-2 rounded-full'
                  style={{ backgroundColor: m.color }}
                />
              ))}
            </span>
          )}
        </div>
      )
    },
    [],
  )

  // Week grid day header (Andrés 2026-09-15): the date + which sucursales work that
  // day (coloured dots + names) and how many professionals are scheduled, so the
  // week reads as an overview even before looking at individual turnos.
  const weekHeaderComp = useCallback(
    ({ date: d, label }: { date: Date; label: string }) => {
      const markers = sedeMarkersRef.current(d)
      const ds = toDateInput(d)
      const dayMap = turnosByDaySucursalRef.current.get(ds)
      const profs = new Set<string>()
      if (dayMap)
        for (const arr of dayMap.values())
          for (const tt of arr) if (tt.professionalId) profs.add(tt.professionalId)
      return (
        <div className='cb-week-header'>
          <span className='cb-week-date'>{label}</span>
          {markers.length > 0 && (
            <span className='cb-week-meta'>
              <span className='cb-week-sucnames'>
                {markers.map((m) => sucursalLabel(m.sucursal)).join(' + ')}
                {profs.size > 0 ? ` · ${profs.size} prof.` : ''}
              </span>
              <span className='cb-week-dots'>
                {markers.map((m) => (
                  <span
                    key={m.sucursal}
                    title={sucursalLabel(m.sucursal)}
                    className='cb-week-dot'
                    style={{ backgroundColor: m.color }}
                  />
                ))}
              </span>
            </span>
          )}
        </div>
      )
    },
    [],
  )

  // Day-view "por profesional" column header (Andrés 2026-09-15): shows the
  // sucursal (coloured) above the professional so the columns read as grouped by
  // sucursal even though RBC uses a flat resource list.
  const resourceHeaderComp = useCallback(
    ({ label, resource }: { label: string; resource?: DayCol }) => {
      const sucOnly = resource?.resourceId?.startsWith('su:')
      return (
        <div className='cb-res-header'>
          {resource?.sucursal && (
            <span className='cb-res-suc' style={{ color: resource.sucColor }}>
              {sucursalLabel(resource.sucursal)}
            </span>
          )}
          {!sucOnly && <span className='cb-res-prof'>{label}</span>}
        </div>
      )
    },
    [],
  )

  // Shade whole days the branch is closed (per rules) OR blocked (feriado).
  const dayPropGetter = useCallback(
    (d: Date) => {
      if (isBlockedDay(d)) return { className: 'rbc-closed-day' }
      const w = shadeWindow(d)
      return w && !w.open ? { className: 'rbc-closed-day' } : {}
    },
    [isBlockedDay, shadeWindow],
  )

  // Shade time slots: closed slots greyed out; the open range softly tinted with
  // the selected sucursal's colour (Week/Day), so the available band reads at a
  // glance. Turnos render above with their status colour.
  const slotPropGetter = useCallback(
    (d: Date) => {
      if (isBlockedDay(d)) return { className: 'rbc-closed-slot' }
      const w = shadeWindow(d)
      if (!w) return {}
      if (!w.open) return { className: 'rbc-closed-slot' }
      const mins = d.getHours() * 60 + d.getMinutes()
      const before = w.openMin != null && mins < w.openMin
      const after = w.closeMin != null && mins >= w.closeMin
      if (before || after) return { className: 'rbc-closed-slot' }
      return sucursalFilter
        ? { style: { backgroundColor: hexToRgba(sucursalColor(sucursalFilter), 0.1) } }
        : {}
    },
    [isBlockedDay, shadeWindow, sucursalFilter],
  )

  const openAdd = useCallback(
    (
      start?: Date,
      end?: Date,
      allDay = false,
      sucursalDefault?: string,
      professionalDefault?: string,
    ) => {
      const now = new Date()
      // Default new turno: a 1-hour slot at the next full hour.
      const s = start ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.min(now.getHours() + 1, 23), 0, 0)
      const e = end ?? new Date(s.getTime() + 60 * 60 * 1000)
      setDraft({
        id: null,
        patientId: null,
        patientName: null,
        treatmentSlug: '',
        // A profesional creating a turno defaults it to themselves; clicking a
        // professional column pre-fills that professional.
        professionalId: isProfesional ? myUserId ?? '' : professionalDefault ?? '',
        sucursal: sucursalDefault ?? '',
        status: 'pendiente',
        charged: false,
        allDay,
        startStr: toDateInput(s),
        endStr: toDateInput(e),
        startTime: toTimeInput(s),
        endTime: toTimeInput(e),
        observaciones: '',
        packId: null,
      })
    },
    [isProfesional, myUserId],
  )

  // From the Month, open a day in the Day view; if 2+ sucursales work/have turnos
  // that day, open it split into columns per sucursal (Andrés 2026-09-15).
  const openDayFromMonth = useCallback(
    (d: Date) => {
      // Drill into the day already split by the working sucursales and, within
      // each, the professionals that work there that day (hybrid columns). The
      // hybrid builder collapses to a single full-width column when only one
      // sucursal + professional works, so this is safe for quiet days too.
      setDate(d)
      setColumnMode('professional')
      setView(Views.DAY)
    },
    [],
  )

  const onSelectSlot = useCallback(
    (slot: SlotInfo) => {
      // Clicking a column pre-fills that column's sucursal / profesional. In the
      // hybrid "por profesional" mode the resource id encodes both (sp:<suc>:<prof>
      // or su:<suc>), so parse it back into the two defaults.
      const rid = (slot as { resourceId?: unknown }).resourceId
      const picked = rid != null && rid !== NONE_RESOURCE ? String(rid) : undefined
      let sucursalDefault: string | undefined
      let professionalDefault: string | undefined
      if (columnMode === 'sucursal') {
        sucursalDefault = picked
      } else if (columnMode === 'professional' && picked) {
        if (picked.startsWith('sp:')) {
          const idx = picked.indexOf(':', 3)
          sucursalDefault = picked.slice(3, idx)
          professionalDefault = picked.slice(idx + 1)
        } else if (picked.startsWith('su:')) {
          sucursalDefault = picked.slice(3)
        }
      }
      // Month: clicking anywhere on a day drills into that day's Day view, split
      // into columns per sucursal/profesional that work that day.
      if (view === Views.MONTH) {
        openDayFromMonth(slot.start)
        return
      }
      openAdd(slot.start, slot.end, false, sucursalDefault, professionalDefault)
    },
    [openAdd, view, columnMode, openDayFromMonth],
  )

  // Persist a drag/resize. Timed turnos keep their exact times; all-day ones
  // normalise to day bounds. Optimistic update, then write + reload.
  const persistMove = useCallback(
    async (
      event: CalendarEvent,
      start: Date,
      end: Date,
      allDay: boolean,
      // undefined = keep; a string/null reassigns (dragging between columns).
      newSucursal?: string | null,
      newProfessional?: string | null,
    ) => {
      let s: Date
      let e: Date
      if (allDay) {
        const startStr = toDateInput(start)
        // RBC gives an exclusive end for all-day spans — step back to the
        // inclusive last day.
        let endStr = toDateInput(new Date(end.getTime() - 1))
        if (endStr < startStr) endStr = startStr
        s = startOfDay(startStr)
        e = endOfDay(endStr)
      } else {
        s = start
        // Timed turno: force the end onto the SAME calendar day as the start
        // (keep the end clock time). Guards month-view drags where RBC can hand
        // back a next-day / all-day-ish end, which made a 1-turno span two days.
        e = new Date(s.getFullYear(), s.getMonth(), s.getDate(), end.getHours(), end.getMinutes(), end.getSeconds())
        if (e.getTime() <= s.getTime()) {
          const durMs = Math.max(30 * 60_000, event.end.getTime() - event.start.getTime())
          e = new Date(s.getTime() + durMs)
        }
      }
      const sucursal = newSucursal !== undefined ? newSucursal : event.sucursal
      const professionalId =
        newProfessional !== undefined ? newProfessional : event.professionalId
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === event.id ? { ...ev, start: s, end: e, allDay, sucursal, professionalId } : ev,
        ),
      )
      await updateCalendarEvent(event.id, {
        title: event.title,
        start: s,
        end: e,
        allDay,
        status: event.status,
        charged: event.charged,
        patientId: event.patientId,
        professionalId,
        sucursal,
        treatmentSlug: event.treatmentSlug,
        observaciones: event.observaciones,
        packId: event.packId,
      })
      // Audit the drag/resize (reschedule + any column reassign).
      const changes = [`${t('turnoAudit.rescheduledTo')} ${toDateInput(s)}${allDay ? '' : ' ' + toTimeInput(s)}`]
      if (newSucursal !== undefined && newSucursal !== event.sucursal)
        changes.push(`${t('turnoAudit.sucursal')}: ${sucursal ? sucursalLabel(sucursal) : t('turno.none')}`)
      if (newProfessional !== undefined && newProfessional !== event.professionalId)
        changes.push(`${t('turnoAudit.professional')}: ${professionalName(professionalId)}`)
      void logTurnoAudit({
        calendarEventId: event.id,
        patientId: event.patientId,
        action: 'rescheduled',
        detail: changes.join(' · '),
        changedBy: actorId,
        changedByName: actorName,
      })
      reload()
    },
    [reload, t, professionalName, actorId, actorName],
  )

  const onEventDrop = useCallback<
    NonNullable<withDragAndDropProps<CalendarEvent>['onEventDrop']>
  >(
    async ({ event, start, end, isAllDay, resourceId }) => {
      const s = new Date(start)
      const e = new Date(end)
      const rid =
        resourceId != null ? (resourceId === NONE_RESOURCE ? null : String(resourceId)) : undefined

      // Dragging between columns reassigns that dimension (Day view only).
      if (columnsActive && columnMode === 'sucursal') {
        void persistMove(event, s, e, !!isAllDay, rid)
        return
      }
      if (columnsActive && columnMode === 'professional') {
        // Hybrid column id: sp:<suc>:<profId> reassigns both, su:<suc> sets the
        // sucursal + clears the professional, the unassigned bucket clears it.
        let newSuc: string | null | undefined
        let newProf: string | null | undefined
        if (rid == null) {
          newProf = null
        } else if (rid.startsWith('sp:')) {
          const idx = rid.indexOf(':', 3)
          newSuc = rid.slice(3, idx)
          newProf = rid.slice(idx + 1)
        } else if (rid.startsWith('su:')) {
          newSuc = rid.slice(3)
          newProf = null
        }
        void persistMove(event, s, e, !!isAllDay, newSuc, newProf)
        return
      }

      // Plain reprogramación: keep the sucursal if it still matches availability;
      // otherwise switch to the only open one, ask if several, block if none.
      const slug = event.treatmentSlug
      if (slug && !isAllDay && availRules.length > 0) {
        const ds = toDateInput(s)
        const prof = event.professionalId ?? undefined
        const openSucs: string[] = SUCURSALES.filter(
          (suc) => availabilityFor(ds, suc, slug, availRules, availExclusions, prof).open,
        )
        if (event.sucursal && openSucs.includes(event.sucursal)) {
          void persistMove(event, s, e, !!isAllDay)
          return
        }
        if (openSucs.length === 1) {
          void persistMove(event, s, e, !!isAllDay, openSucs[0])
          return
        }
        if (openSucs.length > 1) {
          const res = await Swal.fire({
            title: t('agenda.pickSucursalTitle'),
            input: 'select',
            inputOptions: Object.fromEntries(openSucs.map((x) => [x, sucursalLabel(x)])),
            showCancelButton: true,
            confirmButtonText: t('autoGestion.availability.save'),
            cancelButtonText: t('autoGestion.availability.cancel'),
            confirmButtonColor: '#5d87ff',
            width: '360px',
            padding: '1rem',
            customClass: { title: '!text-base', htmlContainer: '!text-sm' },
          })
          if (res.isConfirmed && res.value) void persistMove(event, s, e, !!isAllDay, String(res.value))
          return // cancel → no move (reverts)
        }
        await Swal.fire({
          icon: 'warning',
          title: t('agenda.noAvailabilityTitle'),
          text: t('agenda.noAvailabilityBody'),
          confirmButtonColor: '#5d87ff',
          width: '360px',
          padding: '1rem',
          customClass: {
            title: '!text-base !pb-0',
            htmlContainer: '!text-sm !mt-1',
            icon: '!w-12 !h-12 !mt-2 !mb-1 [&_.swal2-icon-content]:!text-2xl',
            confirmButton: '!text-sm !px-4 !py-1.5',
            popup: '!rounded-lg',
          },
        })
        return // invalid combination → do not save
      }

      void persistMove(event, s, e, !!isAllDay)
    },
    [persistMove, columnsActive, columnMode, availRules, availExclusions, t],
  )

  const onEventResize = useCallback<
    NonNullable<withDragAndDropProps<CalendarEvent>['onEventResize']>
  >(({ event, start, end }) => void persistMove(event, new Date(start), new Date(end), event.allDay), [persistMove])

  const onSelectEvent = useCallback((ev: CalendarEvent) => {
    setDraft({
      id: ev.id,
      patientId: ev.patientId,
      patientName: ev.patientName ?? ev.title,
      treatmentSlug: ev.treatmentSlug ?? '',
      professionalId: ev.professionalId ?? '',
      sucursal: ev.sucursal ?? '',
      status: ev.status,
      charged: ev.charged,
      allDay: ev.allDay,
      startStr: toDateInput(ev.start),
      // Timed turnos are same-day: pin endStr to the start date so the single
      // "Fecha del turno" and the save stay consistent (self-heals bad data on
      // the next save). All-day turnos keep their real end date (a range).
      endStr: ev.allDay ? toDateInput(ev.end) : toDateInput(ev.start),
      startTime: toTimeInput(ev.start),
      endTime: toTimeInput(ev.end),
      observaciones: ev.observaciones ?? '',
      packId: ev.packId,
    })
  }, [])

  const messages = useMemo(
    () => ({
      today: t('agendaCal.today'),
      previous: t('agendaCal.back'),
      next: t('agendaCal.next'),
      month: t('agendaCal.month'),
      week: t('agendaCal.week'),
      day: t('agendaCal.day'),
      agenda: t('agendaCal.agenda'),
      date: t('agendaCal.colDate'),
      time: t('agendaCal.colTime'),
      event: t('agendaCal.colEvent'),
      noEventsInRange: t('agendaCal.noEvents'),
      showMore: (count: number) => t('agendaCal.showMore', { count: String(count) }),
    }),
    [t],
  )

  // Week/Day open scrolled to 08:00 so morning turnos are visible without scrolling.
  const scrollToTime = useMemo(() => {
    const d = new Date()
    d.setHours(8, 0, 0, 0)
    return d
  }, [])
  // Clinic working-hours bounds for the Week/Day time grids (Andrés 2026-09-15):
  // keep the grid compact so its height reflects the hours, not the turno count.
  const dayMin = useMemo(() => {
    const d = new Date()
    d.setHours(7, 0, 0, 0)
    return d
  }, [])
  const dayMax = useMemo(() => {
    const d = new Date()
    d.setHours(21, 0, 0, 0)
    return d
  }, [])

  // Stable RBC components — identities never change (volatile data read via the
  // refs above), so toggling a filter re-renders cells WITHOUT remounting the
  // toolbar/cells (which was the "Nuevo evento" + month + cells blink).
  const toolbarComp = useCallback(
    (props: ToolbarProps<CalendarEvent, object>) => (
      <Toolbar
        label={props.label}
        view={props.view}
        onView={props.onView}
        onNavigate={props.onNavigate}
        onAdd={() => openAdd()}
        t={t}
      />
    ),
    [t, openAdd],
  )
  const eventComp = useCallback(
    ({ event }: { event: CalendarEvent }) => {
      const proSuc = [professionalNameRef.current(event.professionalId), event.sucursal ? sucursalLabel(event.sucursal) : '']
        .filter(Boolean)
        .join(' · ')
      return (
        // Text only. The treatment colour bar (left) and cobro "$" block (right,
        // only when charged) are painted as full-height ::before/::after on
        // .rbc-event (eventPropGetter + calendar-theme.css). Padding clears them:
        // pl for the bar, pr larger when charged for the "$" block.
        <div
          className={`flex flex-col leading-tight min-w-0 h-full overflow-hidden justify-center py-0.5 pl-3 ${event.charged ? 'pr-8' : 'pr-2'}`}>
            <span className='truncate font-medium'>
              {isExpiredReserva(event) && <span title={t('agendaCal.expiredMark')}>⏳ </span>}
              {event.title}
            </span>
            {event.treatmentSlug && (
              <span className='truncate opacity-90 text-[11px] flex items-center gap-1'>
                {treatmentNameRef.current(event.treatmentSlug)}
                {packSessionLabelsRef.current.get(event.id) && (
                  <span className='shrink-0 rounded bg-white/25 px-1 text-[10px] font-medium leading-tight'>
                    {t('turno.pack.sessionShort', { n: packSessionLabelsRef.current.get(event.id) as string })}
                  </span>
                )}
              </span>
            )}
            {proSuc && <span className='truncate opacity-75 text-[11px]'>{proSuc}</span>}
        </div>
      )
    },
    [t],
  )
  // Month day cell = overview (Andrés 2026-09-15): per-sucursal bands (a band for
  // every sede OPEN that day OR with turnos), each tinted with the sede colour and
  // filled with one circle per turno, coloured by the PATIENT STATUS (estado).
  // The circles are only a visual read of how many patients/turnos each sucursal
  // has that day — NOT identifiable, NOT individually clickable. Each band caps at
  // 9/5/3 circles (1/2/3 sedes) and overflows into its OWN "+N" so the number
  // reflects that sucursal, not the whole day. The whole cell (bands, circles and
  // "+N" included) drills into the Day view (see openDayFromMonth).
  const dateCellWrapper = useCallback((props: { children: ReactElement; value: Date }) => {
    const el = props.children as ReactElement<{
      style?: CSSProperties
      children?: ReactNode
      title?: string
    }>
    const ds = toDateInput(props.value)
    const dayMap = turnosByDaySucursalRef.current.get(ds)
    const openSucs = new Set(sedeMarkersRef.current(props.value).map((m) => m.sucursal))
    const bandSucs = SUCURSALES.filter((s) => openSucs.has(s) || dayMap?.has(s))
    if (bandSucs.length === 0) return el
    const cap = bandSucs.length === 1 ? 9 : bandSucs.length === 2 ? 5 : 3
    const overlay = (
      <div className='cb-month-bands'>
        {bandSucs.map((suc) => {
          const turnos = dayMap?.get(suc) ?? []
          const shown = turnos.slice(0, cap)
          const extra = turnos.length - shown.length
          return (
            <div
              key={suc}
              className='cb-month-band'
              style={{ background: hexToRgba(sucursalColor(suc), 0.16) }}
              title={sucursalLabel(suc)}>
              <div className='cb-month-circles'>
                {shown.map((tt) => (
                  <span
                    key={tt.id}
                    className='cb-month-dot'
                    title={statusLabelRef.current(tt.status)}
                    style={{ backgroundColor: statusColorRef.current(tt.status) }}
                  />
                ))}
                {extra > 0 && (
                  <span className='cb-month-more' title={t('agenda.moreTurnos', { n: String(extra) })}>
                    +{extra}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
    return cloneElement(
      el,
      { title: bandSucs.map((s) => sucursalLabel(s)).join(' · ') },
      overlay,
    )
  }, [])
  // Week-list / Agenda date column: same per-sucursal availability colours as the
  // Month, so both views match (Andrés 2026-09-15). Fills the date cell.
  const agendaDateComp = useCallback(({ day, label }: { day: Date; label: string }) => {
    const markers = sedeMarkersRef.current(day)
    const bg = stripesBackground(markers)
    return (
      <div
        className='cb-agenda-date'
        style={bg ? { background: bg } : undefined}
        title={markers.map((m) => sucursalLabel(m.sucursal)).join(' · ') || undefined}>
        {label}
      </div>
    )
  }, [])
  // Agenda (list) view: one clear line — paciente · tratamiento · prof · sede.
  const agendaEventComp = useCallback(
    ({ event }: { event: CalendarEvent }) => {
      const parts = [
        treatmentNameRef.current(event.treatmentSlug),
        professionalNameRef.current(event.professionalId),
        event.sucursal ? sucursalLabel(event.sucursal) : '',
      ].filter(Boolean)
      return (
        // Agenda: treatment = a CIRCLE at the left; info runs inline; cobro "$"
        // is a solid full-height block at the right, only when charged (Andrés
        // 2026-09-14/15). Row background = estado (eventPropGetter).
        <span className={`flex items-center gap-2 w-full ${event.charged ? 'pr-12' : ''}`}>
          {event.treatmentSlug && (
            <span
              className='inline-block h-3.5 w-3.5 rounded-full shrink-0'
              style={{ backgroundColor: treatmentColorRef.current(event.treatmentSlug, treatmentNameRef.current(event.treatmentSlug)) }}
              title={treatmentNameRef.current(event.treatmentSlug)}
            />
          )}
          <span className='min-w-0 truncate'>
            <span className='font-bold'>{event.title}</span>
            {parts.length > 0 && <span className='text-link dark:text-darklink'> · {parts.join(' · ')}</span>}
            {packSessionLabelsRef.current.get(event.id) && (
              <span className='ml-1.5 rounded bg-secondary/15 text-secondary px-1 text-[11px] font-medium'>
                {t('turno.pack.sessionShort', { n: packSessionLabelsRef.current.get(event.id) as string })}
              </span>
            )}
          </span>
          {event.charged && (
            <span
              className='cb-list-cobro'
              style={{ backgroundColor: darkenHex(statusColorRef.current(event.status)) }}
              title={t('agenda.charged')}>
              $
            </span>
          )}
        </span>
      )
    },
    [t],
  )
  const calendarComponents = useMemo(
    () => ({
      toolbar: toolbarComp,
      event: eventComp,
      dateCellWrapper,
      // "Semana" is now a Monday–Saturday time grid (WorkWeekView): it reuses the
      // top-level grid `event` component and only overrides the day header.
      week: { header: weekHeaderComp } as never,
      // Day: custom date header + the "por profesional" grouped column header.
      day: { header: dayHeader, resourceHeader: resourceHeaderComp as never },
      // RBC types agenda.date as a props-less component; ours reads day/label.
      agenda: { event: agendaEventComp, date: agendaDateComp as unknown as () => ReactElement },
    }),
    [
      toolbarComp,
      eventComp,
      dateCellWrapper,
      dayHeader,
      weekHeaderComp,
      resourceHeaderComp,
      agendaEventComp,
      agendaDateComp,
    ],
  )

  if (loading) {
    return (
      <div className='rounded-lg border border-border dark:border-darkborder bg-card p-6 flex justify-center py-20'>
        <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
      </div>
    )
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-4 sm:p-6'>
      {loadError && (
        <p className='mb-3 text-xs text-error flex items-center gap-1.5'>
          <Icon icon='solar:cloud-cross-line-duotone' height={15} width={15} />
          {t('agendaCal.loadError')}
        </p>
      )}

      {expiredCount > 0 && (
        <div className='mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-lightwarning/50 dark:bg-lightwarning/20 px-3 py-2'>
          <Icon icon='solar:hourglass-line-duotone' height={16} width={16} className='text-warning shrink-0 mt-0.5' />
          <p className='text-xs text-dark dark:text-white'>
            {t('agendaCal.expiredReservas', { count: String(expiredCount) })}
          </p>
        </div>
      )}

      {/* Filters: professional (Profesional role locked to own) + sucursal (also
          drives the closed-day/hour shading). */}
      <div className='mb-4 flex items-center gap-x-5 gap-y-2 flex-wrap'>
        <div className='flex items-center gap-2'>
          <Icon icon='solar:user-rounded-line-duotone' height={16} width={16} className='text-link dark:text-darklink' />
          <span className='text-xs font-medium text-link dark:text-darklink'>{t('turno.professional')}:</span>
          {isProfesional ? (
            <span className='text-sm font-medium text-primary'>{t('agendaCal.myAgenda')}</span>
          ) : (
            <MultiSelect
              options={professionals}
              selected={professionalFilterIds}
              onChange={setProfessionalFilterIds}
              allLabel={t('agendaCal.allProfessionals')}
            />
          )}
        </div>
        <div className='flex items-center gap-2'>
          <Icon icon='solar:map-point-line-duotone' height={16} width={16} className='text-link dark:text-darklink' />
          <span className='text-xs font-medium text-link dark:text-darklink'>{t('turno.sucursal')}:</span>
          <select
            value={sucursalFilter}
            onChange={(e) => setSucursalFilter(e.target.value)}
            className='pl-2.5 pr-9 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'>
            <option value=''>{t('agendaCal.allSucursales')}</option>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className='flex items-center gap-2'>
          <Icon icon='solar:magic-stick-3-line-duotone' height={16} width={16} className='text-link dark:text-darklink' />
          <span className='text-xs font-medium text-link dark:text-darklink'>{t('turno.treatment')}:</span>
          <MultiSelect
            options={treatments}
            selected={treatmentFilterSlugs}
            onChange={setTreatmentFilterSlugs}
            allLabel={t('agendaCal.allTreatments')}
          />
        </div>
        {/* Columns mode: none, one column per sucursal, or one per profesional
            (Day view). Dragging a turno between columns reassigns that field. */}
        <div className='flex items-center gap-2'>
          <Icon icon='solar:layers-minimalistic-line-duotone' height={16} width={16} className='text-link dark:text-darklink' />
          <span className='text-xs font-medium text-link dark:text-darklink'>{t('agenda.columns')}:</span>
          <select
            value={columnMode}
            onChange={(e) => setColumnMode(e.target.value as 'none' | 'sucursal' | 'professional')}
            className='pl-2.5 pr-9 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'>
            <option value='none'>{t('agenda.columnsNone')}</option>
            <option value='sucursal'>{t('agenda.columnsBySucursal')}</option>
            <option value='professional'>{t('agenda.columnsByProfessional')}</option>
          </select>
        </div>
        <div className='flex items-center gap-2'>
          <Icon icon='solar:clock-square-line-duotone' height={16} width={16} className='text-link dark:text-darklink' />
          <span className='text-xs font-medium text-link dark:text-darklink'>{t('agenda.scale')}:</span>
          <select
            value={scaleMin}
            onChange={(e) => setScaleMin(parseInt(e.target.value, 10))}
            className='pl-2.5 pr-9 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'>
            {[5, 10, 15, 20, 30, 60].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>
      </div>

      {/* Colour legend for the all-branches availability overview. */}
      {!sucursalFilter && (
        <div className='flex items-center gap-3 flex-wrap mb-3 text-xs text-link dark:text-darklink'>
          <span className='font-medium'>{t('agenda.availabilityLegend')}:</span>
          {SUCURSALES.map((s) => (
            <span key={s} className='inline-flex items-center gap-1.5'>
              <span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: sucursalColor(s) }} />
              {sucursalLabel(s)}
            </span>
          ))}
        </div>
      )}

      {/* Colour legend for the circles/cards. In Month the circles are coloured by
          the patient ESTADO (Andrés 2026-09-15), so show the estado legend there;
          in the time-grid views the treatment colour is what needs explaining. */}
      {view === Views.MONTH
        ? statusLegend.length > 0 && (
            <div className='flex items-center gap-3 flex-wrap mb-3 text-xs text-link dark:text-darklink'>
              <span className='font-medium'>{t('agenda.statusLegend')}:</span>
              {statusLegend.map((sl) => (
                <span key={sl.label} className='inline-flex items-center gap-1.5'>
                  <span className='h-3 w-3 rounded-full' style={{ backgroundColor: sl.color }} />
                  {sl.label}
                </span>
              ))}
            </div>
          )
        : treatmentLegend.length > 0 && (
            <div className='flex items-center gap-3 flex-wrap mb-3 text-xs text-link dark:text-darklink'>
              <span className='font-medium'>{t('agenda.treatmentLegend')}:</span>
              {treatmentLegend.map((tl) => (
                <span key={tl.label} className='inline-flex items-center gap-1.5'>
                  <span className='h-3 w-3 rounded-full' style={{ backgroundColor: tl.color }} />
                  {tl.label}
                </span>
              ))}
            </div>
          )}

      <DnDCalendar
        localizer={localizer}
        // Plain Day view (Columns: None) hides the whole time-grid table (Andrés
        // 2026-09-16 "remove the table"). In columns mode the Day keeps its grid
        // (that is where the sucursal/profesional detail lives).
        className={view === Views.DAY && !columnsActive ? 'cb-day-hidegrid' : undefined}
        events={calendarEvents}
        startAccessor='start'
        endAccessor='end'
        // Columns are a Day-only display option, so they no longer force the view
        // nor block Week/Month navigation (Andrés 2026-09-15). The view is always
        // whatever the toolbar selects; columns apply only when Day is active.
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        // Clicking a day (number, band, circle or "+N") in Month opens that day's
        // Day view, split into columns per working sucursal/profesional.
        onDrillDown={(d: Date) => openDayFromMonth(d)}
        // Week/Day start scrolled to the morning so turnos are visible at once.
        scrollToTime={scrollToTime}
        // Week = Monday–Saturday time grid (WorkWeekView); Agenda = the list view.
        views={{ month: true, week: WorkWeekView, day: true, agenda: true } as never}
        // Bound the time grids to the clinic's working hours so the Week grid stays
        // compact and its height does not depend on the number of turnos.
        min={dayMin}
        max={dayMax}
        {...(columnsActive && {
          resources,
          resourceIdAccessor: (item: object) =>
            (item as { resourceId?: string }).resourceId ?? NONE_RESOURCE,
          resourceTitleAccessor: (item: object) =>
            (item as { resourceTitle?: string }).resourceTitle ?? '',
        })}
        selectable
        popup
        resizable
        step={scaleMin}
        timeslots={Math.max(1, Math.round(60 / scaleMin))}
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        dayPropGetter={dayPropGetter}
        slotPropGetter={slotPropGetter}
        messages={messages}
        style={
          {
            // Fixed height (RBC needs one to render). Month is a compact overview
            // (bands + circles), so it needs less height than the time grids
            // (Andrés 2026-09-15: reduce the month table height).
            height: view === Views.MONTH ? 680 : 720,
            // Taller rows so even short turnos show their full content (nombre +
            // tratamiento + profesional) without clipping. 50px per slot (Andrés
            // 2026-09-15).
            ['--rbc-group-h' as string]: `${Math.max(1, Math.round(60 / scaleMin)) * 50}px`,
          } as CSSProperties
        }
        eventPropGetter={(event: CalendarEvent) => ({
          // Andrés' visual logic (reaffirmed 2026-09-15): LEFT bar = TREATMENT
          // colour, card BACKGROUND = ESTADO (light shade, black text), and the
          // cobro "$" block (right, only when charged) = a darker shade of the
          // estado. The bar + "$" block are full-height ::before/::after on
          // .rbc-event, painted from these CSS vars so they span the whole block.
          className: event.charged ? 'cb-charged' : undefined,
          style: {
            backgroundColor: lightenHex(statusColorFor(event.status)),
            color: '#1f2937',
            border: 'none',
            ['--cb-treat' as string]: treatmentColorResolved(
              event.treatmentSlug,
              treatmentName(event.treatmentSlug),
            ),
            ['--cb-pay' as string]: darkenHex(statusColorFor(event.status)),
          } as CSSProperties,
        })}
        components={calendarComponents}
      />

      {draft && (
        <EventDialog
          draft={draft}
          treatments={treatments}
          professionals={professionals}
          rules={availRules}
          exclusions={availExclusions}
          catalogSlugs={catalogSlugs}
          allEvents={events}
          isSucursalClosed={isSucursalClosed}
          canOverrideClosed={role === 'admin' || role === 'operador'}
          canDelete={role === 'admin' || role === 'operador'}
          actorId={actorId}
          actorName={actorName}
          statusOptions={statusOptions}
          statusLabelFor={statusLabelFor}
          statusColorFor={statusColorFor}
          treatmentColor={treatmentColorResolved}
          backDate={toDateInput(date)}
          backView={view}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            reload()
          }}
          onCloseSession={(pf) => {
            setDraft(null)
            setEvolucionPrefill(pf)
          }}
          t={t}
        />
      )}

      {evolucionPrefill && (
        <EvolucionForm
          open
          onClose={() => setEvolucionPrefill(null)}
          onSaved={() => reload()}
          patientId={evolucionPrefill.patientId}
          evolucion={null}
          prefill={{
            ...(evolucionPrefill.treatmentSlug && { treatmentSlug: evolucionPrefill.treatmentSlug }),
            ...(evolucionPrefill.professionalId && { professionalId: evolucionPrefill.professionalId }),
            calendarEventId: evolucionPrefill.calendarEventId,
            sessionDate: evolucionPrefill.sessionDate,
          }}
        />
      )}
    </div>
  )
}

export default CalendarView
