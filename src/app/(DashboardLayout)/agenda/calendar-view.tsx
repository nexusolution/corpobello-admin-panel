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
  type DragEvent as ReactDragEvent,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { TimeField } from '@/components/ui/time-field'
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
import { fetchTreatmentCatalog } from '@/lib/data/treatment-catalog'
import { fetchAvailability } from '@/lib/data/availability'
import { logTurnoAudit } from '@/lib/data/turno-audit'
import { fetchTurnoStatusConfig, type TurnoStatusConfig } from '@/lib/data/turno-statuses'
import { fetchTreatmentColors } from '@/lib/data/treatment-colors-config'
import {
  availabilityFor,
  anyTreatmentAvailability,
  genericAvailability,
  professionalsFor,
  type AvailabilityRule,
  type AvailabilityExclusion,
} from '@/lib/scheduling/availability'
import { suggestDurationMinutes } from '@/lib/scheduling/duration'
import {
  fetchLunch,
  resolveLunch,
  saveLunchOverride,
  type LunchConfig,
  type LunchOverride,
  type LunchWindow,
} from '@/lib/data/lunch'
import {
  fetchProfessionalTreatments,
  professionalDoesTreatment as resolveDoesTreatment,
  type ProfessionalTreatments,
} from '@/lib/data/professional-treatments'
import { RescheduleDialog, type RescheduleTurno } from './reschedule-dialog'
import { validateMove, minToHHMM, type RescheduleCtx } from '@/lib/scheduling/reschedule'
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
import { DaySchedule } from './day-schedule'
import { WeekSchedule } from './week-schedule'
import { useHorizontalDragScroll } from './use-hscroll'

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

// Dark-mode turno card: blend the estado colour toward the dark surface so the
// card reads as a tinted dark chip (light text on top) instead of a bright pastel.
function darkCardBg(hex: string, factor = 0.74): string {
  const h = hex.replace('#', '')
  const base = [42, 53, 71] // #2a3547 (dark card surface)
  const mix = (c: number, b: number) => Math.round(c + (b - c) * factor)
  const r = mix(parseInt(h.slice(0, 2), 16), base[0]!)
  const g = mix(parseInt(h.slice(2, 4), 16), base[1]!)
  const b = mix(parseInt(h.slice(4, 6), 16), base[2]!)
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

// sessionStorage key for the "Editar disponibilidad" round-trip (Andrés punto 1c):
// when an admin jumps from a blocked turno to Autogestión to fix the availability,
// the turno draft is stashed here so we can re-open it, with its data intact, once
// the availability is saved. Shared with the Disponibilidad section.
export const RETURN_TURNO_KEY = 'cb:agenda:returnTurno'

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
  canAdd = true,
  t,
}: {
  label: string
  view: View
  onView: (v: View) => void
  onNavigate: (action: 'TODAY' | 'PREV' | 'NEXT') => void
  onAdd: () => void
  canAdd?: boolean
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
        {canAdd && (
          <button
            type='button'
            onClick={onAdd}
            className='inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
            <Icon icon='tabler:plus' height={16} width={16} />
            {t('agendaCal.new')}
          </button>
        )}
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
  defaultMonth,
}: {
  label: string
  value: string
  min?: string
  onChange: (v: string) => void
  // Month to open the calendar on when there is no value yet (Andrés punto 20).
  defaultMonth?: string
}) {
  const { t, locale } = useTranslation()
  const [open, setOpen] = useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : undefined
  const minDate = min ? new Date(`${min}T00:00:00`) : undefined
  const openMonth = date ?? (defaultMonth ? new Date(`${defaultMonth}T00:00:00`) : undefined)

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
            defaultMonth={openMonth}
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
                  {p.dni && <span className='text-link dark:text-darklink'> · DNI {p.dni}</span>}
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
  depositAmount: string
  depositDate: string
  depositReceived: boolean
  // Month the date picker should open on when the date is still empty (Andrés
  // punto 20): "Nuevo evento" from Month keeps the field empty but opens the
  // calendar on the month currently in view, not today.
  defaultMonth?: string
}

const SELECT_CLS =
  'mt-1 w-full pl-2.5 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
// For the CUSTOM (Popover) selects that render their own chevron: same styling but
// a normal right padding (not pr-9, which is reserved for a native arrow), so the
// chevron sits at the right end aligned with the native selects (Andrés 2026-09-20).
const SELECT_TRIGGER_CLS =
  'mt-1 w-full pl-2.5 pr-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

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
        <button type='button' className={`${SELECT_TRIGGER_CLS} flex items-center justify-between gap-2 text-left`}>
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
        <button type='button' className={`${SELECT_TRIGGER_CLS} flex items-center justify-between gap-2 text-left`}>
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
  treatmentDurations,
  lunchFor,
  professionalDoesTreatment,
  allEvents,
  isSucursalClosed,
  closureReasonFor,
  isAdmin,
  canEditFull,
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
  onReschedule,
  onCloseSession,
  t,
}: {
  draft: Draft
  treatments: Option[]
  professionals: Option[]
  rules: AvailabilityRule[]
  exclusions: AvailabilityExclusion[]
  catalogSlugs: string[]
  // Per-treatment self-managed duration (slug -> minutes); overrides the slug
  // heuristic when auto-blocking a turno's end time.
  treatmentDurations: Map<string, number>
  // Resolve the lunch window for (sucursal, professional, date) — used to block
  // booking over lunch (Andrés punto 5).
  lunchFor: (sucursal: string, professionalId: string | undefined, dateStr: string) => LunchWindow | null
  // Capability check (Andrés #8): does the professional perform this treatment?
  professionalDoesTreatment: (professionalId: string, slug: string) => boolean
  // All loaded turnos, to warn about overlaps (sobre-turnos) on save.
  allEvents: CalendarEvent[]
  // Is (date, sucursal) closed by a feriado/branch-closure block? + the reason to
  // show. Closed days are NOT forceable (Andrés 2026-09-18): admin is guided to
  // Autogestión, staff is told to ask an admin.
  isSucursalClosed: (ds: string, sucursal: string) => boolean
  closureReasonFor: (ds: string, sucursal: string) => string
  isAdmin: boolean
  // Full agenda edit (create/reprogram/cancel). Profesional = false → status only.
  canEditFull: boolean
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
  // Open the contextual reschedule calendar for this (existing) turno (Andrés #19).
  onReschedule?: (turno: RescheduleTurno) => void
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
  // Patient turnos are ALWAYS timed now (Andrés 2026-09-20, punto 4a): a clinical
  // turno must have inicio+fin because it drives disponibilidad, duración y
  // superposiciones. "Todo el día" stays only for administrative closures in
  // Autogestión. Opening a legacy all-day turno converts it to a timed one with a
  // sensible default time the user can adjust.
  // Held false (no setter, no toggle) so every existing allDay branch stays valid
  // while patient turnos are always timed.
  const [allDay] = useState(false)
  const [startStr, setStartStr] = useState(draft.startStr)
  const [endStr, setEndStr] = useState(draft.allDay ? draft.startStr : draft.endStr)
  const [startTime, setStartTime] = useState(draft.allDay ? '09:00' : draft.startTime)
  const [endTime, setEndTime] = useState(draft.allDay ? '09:30' : draft.endTime)
  const [observaciones, setObservaciones] = useState(draft.observaciones)
  // Depósito/seña on the turno (Etapa 2 signed scope): importe + fecha + recibido.
  // Preserved on reprogramación / cambio de sucursal (persistMove copies them).
  const [depositAmount, setDepositAmount] = useState(draft.depositAmount)
  const [depositDate, setDepositDate] = useState(draft.depositDate)
  const [depositReceived, setDepositReceived] = useState(draft.depositReceived)
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
    // Skip while the date is still empty (Andrés punto 20): the general "Nuevo
    // evento" opens with no date, so a time picked first must not compute an end
    // off an invalid date. The end is recomputed once a date is chosen.
    if (allDay || !slug || !sStr) return
    const minutes = suggestDurationMinutes(slug, first, undefined, treatmentDurations.get(slug))
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
    // Sucursal required for NEW turnos to avoid incomplete records (Andrés #4);
    // existing turnos with a missing sucursal stay editable so they can be fixed.
    (isEdit || !!sucursal) &&
    (allDay
      ? endStr >= startStr
      : !!startTime &&
        !!endTime &&
        dateTime(endStr, endTime).getTime() > dateTime(startStr, startTime).getTime())

  // Any day in the range the treatment is NOT offered at the branch (per the
  // availability rules) → warning. Uses the selected treatment when set, else
  // "any treatment" (whether the branch works at all that day).
  // No disponibilidad programada for the turno's sucursal/date — considering the
  // SELECTED professional when one is chosen (Andrés 2026-09-20: "ese profesional
  // no tiene disponibilidad"). Falls back to sucursal-level when no professional.
  const hasClosedDay = useMemo(() => {
    if (!sucursal || !startStr) return false
    const pid = professionalId || undefined
    const endBound = allDay ? endStr || startStr : startStr
    const end = new Date(`${endBound}T00:00:00`)
    for (const d = new Date(`${startStr}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = toDateInput(d)
      // requireOwnRule (last arg) only when a professional is selected: they must
      // have their OWN programmed availability at this sucursal/date — a branch
      // open thanks to a generic or another professional's rule is not enough
      // (Andrés 2026-10 #1). Without a professional we stay at sucursal level.
      const open = treatmentSlug
        ? availabilityFor(ds, sucursal, treatmentSlug, rules, exclusions, pid, undefined, !!pid).open
        : pid
          ? catalogSlugs.some((s) => availabilityFor(ds, sucursal, s, rules, exclusions, pid, undefined, true).open)
          : anyTreatmentAvailability(ds, sucursal, catalogSlugs, rules, exclusions).open
      if (!open) return true
    }
    return false
  }, [sucursal, treatmentSlug, professionalId, startStr, endStr, allDay, rules, exclusions, catalogSlugs])

  async function save() {
    if (!valid || saving) return
    const isDarkNow =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    // Enforcement (feriado + disponibilidad) only fires when the turno is being
    // PLACED onto the day for the first time: a new turno, or an existing one whose
    // day/sucursal/range changed. Editing an existing turno in place (e.g. a
    // Profesional's status-only update, or notes) must still save.
    // A professional change must RE-VALIDATE too (Andrés 2026-10 #3): reassigning
    // a turno to another professional re-checks that they perform the treatment and
    // have availability at that sucursal/date/time.
    const placementChanged =
      !isEdit ||
      startStr !== draft.startStr ||
      sucursal !== draft.sucursal ||
      professionalId !== draft.professionalId ||
      startTime !== draft.startTime ||
      endTime !== draft.endTime ||
      (allDay && (endStr || startStr) !== (draft.endStr || draft.startStr))
    // Feriado / branch-closure ENFORCEMENT (Andrés 2026-09-15): a day closed via
    // Autogestión → Feriados must not simply warn. Users without permission are
    // BLOCKED; admin/operador may FORCE with a confirmation (logged once the
    // audit trail exists). Checked per day in the range, for the turno's sucursal.
    const closedByFeriado = (() => {
      if (!sucursal || !startStr || !placementChanged) return false
      const endBound = allDay ? endStr || startStr : startStr
      const end = new Date(`${endBound}T00:00:00`)
      for (const d = new Date(`${startStr}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
        if (isSucursalClosed(toDateInput(d), sucursal)) return true
      }
      return false
    })()
    if (closedByFeriado) {
      // Closed days are NOT forceable (Andrés 2026-09-18): to avoid accidental
      // bookings, block and guide. Admin → modify the closure in Autogestión (with
      // a shortcut); operador/profesional → ask an admin to enable it. Only the
      // turno's own sucursal is checked, so other open branches stay bookable.
      const reason = closureReasonFor(startStr, sucursal)
      const motivo = reason ? ` ${t('turno.closedReason', { reason })}` : ''
      const sucTxt = sucursal ? sucursalLabel(sucursal) : ''
      const commonSwal = {
        background: isDarkNow ? '#2a3547' : '#ffffff',
        color: isDarkNow ? '#ffffff' : '#2a3547',
        width: '380px',
        customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
      }
      if (isAdmin) {
        const res = await Swal.fire({
          ...commonSwal,
          icon: 'warning',
          iconColor: '#fa896b',
          title: t('turno.closedBlockedTitle'),
          text: `${t('turno.closedAdminBody', { sucursal: sucTxt })}${motivo}`,
          showCancelButton: true,
          confirmButtonText: t('turno.closedGoFeriados'),
          cancelButtonText: t('agendaCal.cancel'),
          confirmButtonColor: '#5d87ff',
          cancelButtonColor: isDarkNow ? '#3f4a5d' : '#e5e7eb',
        })
        if (res.isConfirmed && typeof window !== 'undefined') {
          // Stash the turno so we can return to it once the closure is edited/removed
          // (Andrés #17). Deep-link straight to Feriados y cierres, positioned on the
          // turno's sucursal + date (the section highlights the matching closure).
          const snapshot: Draft = {
            id: draft.id,
            patientId,
            patientName,
            treatmentSlug,
            professionalId,
            sucursal,
            status,
            charged,
            allDay: false,
            startStr,
            endStr,
            startTime,
            endTime,
            observaciones,
            packId,
            depositAmount,
            depositDate,
            depositReceived,
          }
          try {
            sessionStorage.setItem(
              RETURN_TURNO_KEY,
              JSON.stringify({ draft: snapshot, view: backView, date: backDate }),
            )
          } catch {
            // sessionStorage unavailable: skip the round-trip.
          }
          const qs = new URLSearchParams({ tab: 'feriados' })
          if (sucursal) qs.set('suc', sucursal)
          if (startStr) qs.set('date', startStr)
          window.location.href = `/auto-gestion?${qs.toString()}`
        }
        return
      }
      await Swal.fire({
        ...commonSwal,
        icon: 'error',
        title: t('turno.closedBlockedTitle'),
        text: `${t('turno.closedStaffBody', { sucursal: sucTxt })}${motivo}`,
        confirmButtonText: t('turno.closedBlockedOk'),
        confirmButtonColor: '#5d87ff',
      })
      return
    }
    // Compatibilidad del PROFESIONAL con el turno (Andrés 2026-09-20 punto 1 +
    // 2026-10 punto 3): al colocar/mover un turno o CAMBIAR de profesional se
    // revalida todo y se listan TODAS las incompatibilidades a la vez:
    //   (1) que el profesional realice el tratamiento,
    //   (2) que tenga disponibilidad programada en esa sucursal/fecha.
    // Secretaría queda BLOQUEADA (pedir a un Admin); el Admin puede autorizar una
    // excepción puntual o ir a Autogestión a editar los tratamientos/disponibilidad
    // de ese profesional. El turno excepcional existe y se muestra, pero el fondo
    // del Mes sigue reflejando solo la disponibilidad programada (dateCellWrapper).
    // La superposición y el almuerzo se validan aparte, más abajo.
    const whoLabel = professionalId
      ? professionals.find((p) => p.value === professionalId)?.label || ''
      : ''
    const sucTxt = sucursal ? sucursalLabel(sucursal) : ''
    // Does the professional perform this treatment? First-class capability config
    // (Autogestión → Profesionales, migration 0053), independent of the schedule.
    const performsSelectedTreatment =
      !professionalId || !treatmentSlug || professionalDoesTreatment(professionalId, treatmentSlug)
    const incompat: string[] = []
    if (!performsSelectedTreatment) {
      const treatmentLabel = treatmentSlug
        ? treatments.find((tt) => tt.value === treatmentSlug)?.label || treatmentSlug
        : ''
      incompat.push(t('turno.incompatTreatment', { name: whoLabel, treatment: treatmentLabel }))
    }
    if (hasClosedDay) {
      incompat.push(
        whoLabel
          ? t('turno.noAvailWho', { name: whoLabel, sucursal: sucTxt })
          : t('turno.noAvailBranch', { sucursal: sucTxt }),
      )
    }
    if (incompat.length > 0 && !closedByFeriado && placementChanged) {
      const commonSwal = {
        background: isDarkNow ? '#2a3547' : '#ffffff',
        color: isDarkNow ? '#ffffff' : '#2a3547',
        width: '400px',
        customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
      }
      const listHtml = `<ul style="text-align:left;margin:0 0 .6em;padding-left:1.15em">${incompat
        .map((i) => `<li style="margin:.15em 0">${i}</li>`)
        .join('')}</ul>`
      if (isAdmin) {
        const res = await Swal.fire({
          ...commonSwal,
          icon: 'warning',
          iconColor: '#ffae1f',
          title: t('turno.incompatTitle'),
          html: `${listHtml}<div>${t('turno.noAvailAdminTail')}</div>`,
          showConfirmButton: true,
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: t('turno.noAvailAuthorize'),
          denyButtonText: t('turno.noAvailEditDispo'),
          cancelButtonText: t('agendaCal.cancel'),
          confirmButtonColor: '#5d87ff',
          denyButtonColor: '#13deb9',
          cancelButtonColor: isDarkNow ? '#3f4a5d' : '#e5e7eb',
        })
        if (res.isDenied) {
          // Open Autogestión → Disponibilidad already positioned on this
          // professional + sucursal (+ the date's weekday) so the admin doesn't
          // have to hunt for it (Andrés #1b).
          if (typeof window !== 'undefined') {
            // Stash the current (edited) turno so we can re-open it, data intact,
            // once the admin saves the availability and comes back (Andrés #1c).
            const snapshot: Draft = {
              id: draft.id,
              patientId,
              patientName,
              treatmentSlug,
              professionalId,
              sucursal,
              status,
              charged,
              allDay: false,
              startStr,
              endStr,
              startTime,
              endTime,
              observaciones,
              packId,
              depositAmount,
              depositDate,
              depositReceived,
            }
            try {
              sessionStorage.setItem(
                RETURN_TURNO_KEY,
                JSON.stringify({ draft: snapshot, view: backView, date: backDate }),
              )
            } catch {
              // sessionStorage unavailable (private mode): skip the round-trip.
            }
            // If the professional simply does not perform the treatment, send the
            // admin to Profesionales (edit enabled treatments); otherwise to
            // Disponibilidad (edit the schedule). Andrés #8.
            const capabilityIssue = !performsSelectedTreatment
            const qs = new URLSearchParams({ tab: capabilityIssue ? 'profesionales' : 'disponibilidad' })
            if (professionalId) qs.set('prof', professionalId)
            if (!capabilityIssue) {
              if (sucursal) qs.set('suc', sucursal)
              if (startStr) qs.set('date', startStr)
            }
            window.location.href = `/auto-gestion?${qs.toString()}`
          }
          return
        }
        if (!res.isConfirmed) return
        // confirmed → proceed (one-off exception)
      } else {
        await Swal.fire({
          ...commonSwal,
          icon: 'error',
          title: t('turno.incompatTitle'),
          html: `${listHtml}<div>${t('turno.noAvailStaffTail')}</div>`,
          confirmButtonText: t('turno.closedBlockedOk'),
          confirmButtonColor: '#5d87ff',
        })
        return
      }
    }
    // Almuerzo (Andrés punto 5): no se agenda dentro del almuerzo. Secretaría
    // bloqueada; Admin puede autorizar una excepción. Solo al colocar/mover.
    if (!allDay && sucursal && placementChanged) {
      const lunch = lunchFor(sucursal, professionalId || undefined, startStr)
      if (lunch) {
        const s = dateTime(startStr, startTime)
        const e = dateTime(startStr, endTime)
        const sMin = s.getHours() * 60 + s.getMinutes()
        const eMin = e.getHours() * 60 + e.getMinutes()
        if (sMin < lunch.endMin && eMin > lunch.startMin) {
          const commonSwal = {
            background: isDarkNow ? '#2a3547' : '#ffffff',
            color: isDarkNow ? '#ffffff' : '#2a3547',
            width: '380px',
            customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
          }
          if (isAdmin) {
            const res = await Swal.fire({
              ...commonSwal,
              icon: 'warning',
              iconColor: '#ffae1f',
              title: t('turno.lunchTitle'),
              text: t('turno.lunchAdminBody'),
              showCancelButton: true,
              confirmButtonText: t('turno.lunchAuthorize'),
              cancelButtonText: t('agendaCal.cancel'),
              confirmButtonColor: '#5d87ff',
              cancelButtonColor: isDarkNow ? '#3f4a5d' : '#e5e7eb',
            })
            if (!res.isConfirmed) return
          } else {
            await Swal.fire({
              ...commonSwal,
              icon: 'error',
              title: t('turno.lunchTitle'),
              text: t('turno.lunchStaffBody'),
              confirmButtonText: t('turno.closedBlockedOk'),
              confirmButtonColor: '#5d87ff',
            })
            return
          }
        }
      }
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
      depositAmount: depositAmount.trim() ? Number(depositAmount.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
      depositDate: depositDate || null,
      depositReceived,
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
        className='w-full max-w-lg rounded-xl bg-card shadow-xl flex flex-col max-h-[90vh]'
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
          {/* Profesional (canEditFull=false): status is the ONLY editable field —
              no create/reprogram/reassign (Andrés #18). The rest of the form is
              shown read-only inside a disabled fieldset. */}
          {!canEditFull && (
            <div className='rounded-md border border-primary/30 bg-lightprimary/20 dark:bg-lightprimary/10 p-3 space-y-2'>
              <p className='text-xs text-link dark:text-darklink flex items-start gap-1.5'>
                <Icon icon='solar:lock-keyhole-minimalistic-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
                {t('turno.profStatusOnly')}
              </p>
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
          )}
          <fieldset disabled={!canEditFull} className='space-y-4 min-w-0 border-0 p-0 m-0 disabled:opacity-60'>
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
                {professionals
                  // Secretaría only sees professionals ENABLED for the selected
                  // treatment (Andrés #8). Admin sees all; the already-assigned
                  // professional always stays visible so an existing turno reads right.
                  .filter(
                    (o) =>
                      isAdmin ||
                      !treatmentSlug ||
                      o.value === professionalId ||
                      professionalDoesTreatment(o.value, treatmentSlug),
                  )
                  .map((o) => (
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

          {/* Depósito / seña on the turno (Etapa 2): importe + fecha + recibido. */}
          <div className='rounded-md border border-border dark:border-darkborder p-3 space-y-2'>
            <div className='flex items-center gap-2'>
              <Icon icon='solar:hand-money-line-duotone' height={16} width={16} className='text-secondary' />
              <span className='text-sm font-medium text-dark dark:text-white'>{t('turno.deposit.title')}</span>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <label className='block'>
                <span className='text-xs text-link dark:text-darklink'>{t('turno.deposit.amount')}</span>
                <input
                  type='text'
                  inputMode='decimal'
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder='0'
                  className='mt-1 w-full px-2.5 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
                />
              </label>
              <DateField
                label={t('turno.deposit.date')}
                value={depositDate}
                onChange={setDepositDate}
              />
            </div>
            <label className='flex items-center gap-2 cursor-pointer select-none'>
              <input
                type='checkbox'
                checked={depositReceived}
                onChange={(e) => setDepositReceived(e.target.checked)}
                className='h-4 w-4 rounded border-border dark:border-darkborder accent-primary'
              />
              <span className='text-sm text-dark dark:text-white'>{t('turno.deposit.received')}</span>
            </label>
          </div>

          {/* Patient turnos are always timed (punto 4a): single date + hora
              inicio/fin. "Todo el día" moved out to Autogestión closures. */}
          <DateField
            label={t('turno.date')}
            value={startStr}
            defaultMonth={draft.defaultMonth}
            onChange={(v) => {
              setStartStr(v)
              setEndStr(v)
            }}
          />

          {!allDay && (
            <div className='grid grid-cols-2 gap-3'>
              <label className='block'>
                <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.startTime')}</span>
                <TimeField
                  className='mt-1'
                  value={startTime}
                  onChange={(v) => {
                    setStartTime(v)
                    // Keep the auto-blocked duration when the start moves.
                    applyAutoDuration(treatmentSlug, firstSession, startStr, v)
                  }}
                />
              </label>
              <label className='block'>
                <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.endTime')}</span>
                <TimeField className='mt-1' value={endTime} onChange={setEndTime} />
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
          </fieldset>
        </div>

        <div className='px-5 py-3 shrink-0 border-t border-border dark:border-darkborder flex flex-wrap items-center justify-between gap-2'>
          {/* Secondary actions as compact icon buttons with tooltips (Andrés):
              Delete + Close session grouped together on the left. */}
          <div className='flex items-center gap-1'>
            {isEdit && canDelete && (
              <button
                type='button'
                onClick={remove}
                disabled={saving}
                title={t('agendaCal.delete')}
                aria-label={t('agendaCal.delete')}
                className='inline-flex items-center justify-center h-9 w-9 rounded-md text-error hover:bg-lighterror/60 transition-colors disabled:opacity-50'>
                <Icon icon='tabler:trash' height={18} width={18} />
              </button>
            )}
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
                title={t('turno.closeSession')}
                aria-label={t('turno.closeSession')}
                className='inline-flex items-center justify-center h-9 w-9 rounded-md text-primary hover:bg-lightprimary transition-colors'>
                <Icon icon='solar:clipboard-heart-line-duotone' height={18} width={18} />
              </button>
            )}
          </div>
          <div className='flex flex-wrap items-center justify-end gap-2'>
            {isEdit && canEditFull && !allDay && (
              <button
                type='button'
                onClick={() =>
                  onReschedule?.({
                    id: draft.id!,
                    patientName: patientName ?? '',
                    treatmentSlug,
                    professionalId: professionalId || undefined,
                    sucursal,
                    start: dateTime(startStr, startTime),
                    end: dateTime(startStr, endTime),
                  })
                }
                className='inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm font-medium text-primary hover:bg-lightprimary transition-colors'>
                <Icon icon='solar:calendar-search-line-duotone' height={16} width={16} />
                {t('reschedule.button')}
              </button>
            )}
            <button
              type='button'
              onClick={onClose}
              className='px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('agendaCal.cancel')}
            </button>
            <button
              type='button'
              onClick={save}
              disabled={!valid || saving}
              className='px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
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
  const wd = base.getDay() // 0=Sun … 6=Sat
  // Sunday is a non-working day: instead of rolling it BACK to the week that just
  // ended, roll it FORWARD to the upcoming Mon–Sat, so landing on a Sunday (e.g.
  // "today") shows the current working week, consistent with the Month (Andrés
  // 2026-09-20). Mon–Sat map to their own week's Monday.
  const back = wd === 0 ? -1 : wd - 1
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
  return `${localizer.format(start, 'ddd D MMM')} a ${localizer.format(end, 'ddd D MMM YYYY')}`
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Main view ─────────────────────────────────────────────────────────────────
export function CalendarView() {
  const { t, locale } = useTranslation()
  const { role, name: actorName, userId: actorId } = useCurrentUser()
  const isProfesional = role === 'profesional'
  // Reactive dark-mode flag so turno cards can adapt their colours to the theme
  // (Andrés: cards stayed bright-pastel in dark mode). Tracks the <html> class.
  const [isDarkMode, setIsDarkMode] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    const update = () => setIsDarkMode(el.classList.contains('dark'))
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
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
  // Agenda (list) length in days — contextual to the view you entered from (Andrés
  // 2026-09-17): Día → ~1 mes, Mes → ese mes calendario, Semana → ~1 mes desde la
  // semana. Default 30.
  const [agendaLength, setAgendaLength] = useState(30)
  // Remember the date you were working on before opening Agenda, to restore the
  // context when you switch back to Día/Semana/Mes.
  const preAgendaDateRef = useRef<Date | null>(null)
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
  // Configurable lunch (migration 0052): habitual config + per-day overrides.
  const [lunchConfig, setLunchConfig] = useState<LunchConfig[]>([])
  const [lunchOverrides, setLunchOverrides] = useState<LunchOverride[]>([])
  // Which treatments each professional performs (migration 0053, Andrés #8).
  const [profTreatments, setProfTreatments] = useState<Map<string, ProfessionalTreatments>>(new Map())
  // Contextual reschedule dialog (Andrés #19-E): the turno being rescheduled.
  const [rescheduleTurno, setRescheduleTurno] = useState<RescheduleTurno | null>(null)
  const [catalogSlugs, setCatalogSlugs] = useState<string[]>([])
  // Per-treatment self-managed duration (Autogestión → Catálogo, migration 0051).
  // slug -> minutes; overrides the slug heuristic when auto-blocking a turno.
  const [treatmentDurations, setTreatmentDurations] = useState<Map<string, number>>(new Map())
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

  // Horizontal scroll for the Month grid on narrow screens (a min-width on the
  // month view below makes it overflow on phones). Wheel + visible scrollbar; no
  // drag-pan here, to avoid fighting RBC's day click/drilldown.
  const monthScrollRef = useRef<HTMLDivElement>(null)
  useHorizontalDragScroll(monthScrollRef, { drag: false })

  // Force 24h times + DD/MM/YYYY dates in RBC's built-in Agenda/Month regardless
  // of the UI language (Andrés #15: the whole system in 24h). Without this, the
  // moment localizer follows the locale, so an English UI renders the Agenda as
  // "9:00 am" / "MM/DD/YYYY". The custom Day/Week tables already hardcode 24h.
  // Range separator is a word ("a"/"to"), never a dash (panel no-dash rule).
  const calendarFormats = useMemo(() => {
    const sep = locale === 'es' ? ' a ' : ' to '
    type Rng = { start: Date; end: Date }
    type Loc = { format: (d: Date, f: string, c?: string) => string }
    const hm = (d: Date, c: string | undefined, l: Loc) => l.format(d, 'HH:mm', c)
    const dmy = (d: Date, c: string | undefined, l: Loc) => l.format(d, 'DD/MM/YYYY', c)
    return {
      timeGutterFormat: 'HH:mm',
      eventTimeRangeFormat: ({ start, end }: Rng, c: string, l: Loc) =>
        `${hm(start, c, l)}${sep}${hm(end, c, l)}`,
      agendaTimeRangeFormat: ({ start, end }: Rng, c: string, l: Loc) =>
        `${hm(start, c, l)}${sep}${hm(end, c, l)}`,
      agendaHeaderFormat: ({ start, end }: Rng, c: string, l: Loc) =>
        `${dmy(start, c, l)}${sep}${dmy(end, c, l)}`,
      agendaDateFormat: 'ddd DD/MM',
    }
  }, [locale])

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
    void Promise.all([fetchMenuOverrides(), fetchTreatmentPrices(), fetchTreatmentCatalog()]).then(
      ([mo, tp, cat]) => {
        // Prefer the autogestionable catalog (0051) when it has been imported:
        // active treatments only, in the configured order. Falls back to the code
        // catalog (menu_overrides + prices) until the clinic imports it.
        if (cat.data.length > 0) {
          const active = cat.data.filter((c) => c.active)
          setTreatments(active.map((c) => ({ value: c.slug, label: c.label })))
          setCatalogSlugs(active.map((c) => c.slug))
          setTreatmentDurations(
            new Map(
              cat.data
                .filter((c) => c.durationMin != null && c.durationMin > 0)
                .map((c) => [c.slug, c.durationMin as number]),
            ),
          )
          return
        }
        const byslug = new Map<string, string>()
        for (const m of mo.data) byslug.set(m.slug, m.displayName)
        for (const p of tp.data) if (!byslug.has(p.slug)) byslug.set(p.slug, p.displayName)
        const opts = [...byslug.entries()]
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => a.label.localeCompare(b.label))
        setTreatments(opts)
        setCatalogSlugs(opts.map((o) => o.value))
      },
    )
    // Availability rules + cross-sucursal exclusions for shading + warnings.
    void fetchLunch().then(({ config, overrides }) => {
      setLunchConfig(config)
      setLunchOverrides(overrides)
    })
    // Per-professional treatment capability (Andrés #8) for booking validation.
    void fetchProfessionalTreatments().then(({ data }) => setProfTreatments(data))
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
  // Reason (motivo) of the branch-closure covering (ds, suc), '' if none — shown in
  // the closed-day warnings (Andrés 2026-09-18).
  const closureReasonFor = useCallback(
    (ds: string, suc: string) => {
      const b = blocks.find(
        (x) =>
          x.professionalId === null &&
          (x.sucursal === null || x.sucursal === suc) &&
          x.startDate <= ds &&
          x.endDate >= ds,
      )
      return b?.reason ?? ''
    },
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
      // Resolve per REAL professional (not "any professional") so a special jornada
      // REPLACES the habitual one and a professional never shows in two branches the
      // same day (Andrés #11). Generic (unassigned) rules are OR'd in separately.
      // Cross-sucursal EXCLUSIONS stay ignored here (booking-time concern, and two
      // DIFFERENT professionals can work two branches the same day — #11/#12).
      // isHoliday enables the 2nd-Monday feriado shift (monthly_cycle, #10).
      const realProfs = professionals.map((p) => p.value)
      const profs: (string | undefined)[] = professionalFilterIds.length
        ? professionalFilterIds
        : realProfs.length
          ? realProfs
          : [undefined]
      const hol = (d: string) => isSucursalClosed(d, sucursal)
      let open = false
      let openMin = Number.POSITIVE_INFINITY
      let closeMin = Number.NEGATIVE_INFINITY
      const take = (w: { open: boolean; openMin?: number; closeMin?: number }) => {
        if (!w.open) return
        open = true
        openMin = Math.min(openMin, w.openMin ?? openMin)
        closeMin = Math.max(closeMin, w.closeMin ?? closeMin)
      }
      for (const slug of slugs) {
        take(genericAvailability(ds, sucursal, slug, availRules, hol))
        for (const p of profs) take(availabilityFor(ds, sucursal, slug, availRules, [], p, hol))
      }
      return open ? { open: true, openMin, closeMin } : { open: false }
    },
    [treatmentFilterSlugs, professionalFilterIds, professionals, catalogSlugs, availRules, isSucursalClosed],
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
  // Columns (sucursal → professional pairs) that actually work on a given day.
  // Reused for the Day table and, per day, for the Week grid's lanes.
  const computeDayColumns = useCallback(
    (day: Date): DayCol[] => {
      const ds = toDateInput(day)
      const dayMap = turnosByDaySucursal.get(ds)
      const sucs = new Set<string>()
      for (const m of sedeMarkers(day)) sucs.add(m.sucursal)
      if (dayMap) for (const s of dayMap.keys()) if (s !== NONE_RESOURCE) sucs.add(s)
      const orderedSucs = SUCURSALES.filter((s) => sucs.has(s))
      const cols: DayCol[] = []
      let hasUnassigned = false
      for (const suc of orderedSucs) {
        // "Who works here today" = professionals with a PROFESSIONAL-SPECIFIC
        // availability rule that day (professionalsFor ignores generic sucursal
        // rules, so a generic rule no longer makes every professional appear —
        // Andrés 2026-09-16: no empty columns), plus anyone who has a turno.
        const profIds = new Set<string>()
        for (const slug of catalogSlugs) {
          for (const pid of professionalsFor(ds, suc, slug, availRules, (d) => isSucursalClosed(d, suc)))
            profIds.add(pid)
        }
        for (const tt of dayMap?.get(suc) ?? []) {
          // A turno with no professional OR a professional not in the active list
          // (e.g. an inactive user) must still be shown — it falls into the "Sin
          // asignar" catch-all instead of being dropped (Andrés 2026-09-17 bug #4).
          if (tt.professionalId && professionals.some((p) => p.value === tt.professionalId))
            profIds.add(tt.professionalId)
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
          for (const p of profList) {
            cols.push({
              resourceId: `sp:${suc}:${p.value}`,
              resourceTitle: p.label,
              sucursal: suc,
              sucColor: sucursalColor(suc),
            })
          }
        }
      }
      // Null/unknown-sucursal turnos live under the NONE key. They show under a
      // "Sin asignar" sucursal group, subdivided by PROFESSIONAL (Andrés 2026-09:
      // Sucursal = Sin asignar, Profesional = Andrés), so the professional is not
      // lost and the missing sucursal is flagged for correction. A turno with no
      // (active) professional falls to the plain "Sin asignar" catch-all.
      const noneProfIds = new Set<string>()
      let noneUnassigned = false
      for (const tt of dayMap?.get(NONE_RESOURCE) ?? []) {
        if (tt.professionalId && professionals.some((p) => p.value === tt.professionalId))
          noneProfIds.add(tt.professionalId)
        else noneUnassigned = true
      }
      for (const p of professionals.filter((x) => noneProfIds.has(x.value))) {
        cols.push({ resourceId: `sp::${p.value}`, resourceTitle: p.label, sucursal: '', sucColor: '#94a3b8' })
      }
      if (hasUnassigned || noneUnassigned)
        cols.push({
          resourceId: NONE_RESOURCE,
          resourceTitle: t('agenda.noProfessional'),
          sucursal: '',
          sucColor: '#94a3b8',
        })
      return cols.length
        ? cols
        : [{ resourceId: NONE_RESOURCE, resourceTitle: t('turno.none'), sucursal: '', sucColor: '#94a3b8' }]
    },
    [sedeMarkers, turnosByDaySucursal, professionals, catalogSlugs, availRules, isSucursalClosed, t],
  )
  const dayHybridResources = useMemo<DayCol[]>(
    () => computeDayColumns(date),
    [computeDayColumns, date],
  )

  // Map a turno to its hybrid column: prefer the exact (sucursal, profesional)
  // pair; if the sucursal is missing/mismatched but the PROFESSIONAL is known,
  // still place it in that professional's column anywhere they work that day
  // (professional and sucursal are independent — Andrés 2026-09-20, punto 4);
  // else the sucursal-only column, else the unassigned bucket.
  const hybridResourceIdFor = useCallback(
    (e: CalendarEvent, colIds: Set<string>) => {
      const suc = e.sucursal || ''
      // Exact (sucursal, profesional). For a null-sucursal turno this is
      // `sp::<prof>`, i.e. the "Sin asignar" group's professional column, which
      // computeDayColumns creates — so the professional shows even without a
      // sucursal (Andrés 2026-09, punto 4).
      if (e.professionalId && colIds.has(`sp:${suc}:${e.professionalId}`)) {
        return `sp:${suc}:${e.professionalId}`
      }
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

  // Configurable lunch (Andrés punto 5): resolve the lunch window for a
  // (sucursal, professional, date) from the loaded config + overrides. A column's
  // professional id is encoded in its resourceId (sp:<suc>:<prof> or sp::<prof>).
  const profIdOfResource = (rid: string) =>
    rid.startsWith('sp:') ? rid.slice(rid.indexOf(':', 3) + 1) : undefined
  const lunchFor = useCallback(
    (sucursal: string, professionalId: string | undefined, dateStr: string): LunchWindow | null =>
      resolveLunch(sucursal, professionalId, dateStr, lunchConfig, lunchOverrides),
    [lunchConfig, lunchOverrides],
  )
  // Capability resolver (Andrés #8): does professional `pid` perform `slug`?
  const professionalDoesTreatment = useCallback(
    (pid: string, slug: string): boolean => resolveDoesTreatment(profTreatments.get(pid), slug),
    [profTreatments],
  )

  // Shared reschedule context (Andrés #19): every availability/lunch/overlap check
  // the contextual calendar (and, later, drag) runs comes from here.
  const rescheduleCtx = useMemo<RescheduleCtx>(
    () => ({
      rules: availRules,
      exclusions: availExclusions,
      lunchConfig,
      lunchOverrides,
      profTreatments,
      isSucursalClosed,
      events: events.map((e) => ({
        id: e.id,
        professionalId: e.professionalId,
        sucursal: e.sucursal,
        start: e.start,
        end: e.end,
        status: e.status,
      })),
    }),
    [availRules, availExclusions, lunchConfig, lunchOverrides, profTreatments, isSucursalClosed, events],
  )

  // Persist a move (reschedule / drag) preserving EVERY field except date/time/
  // sucursal/professional, audit it, then offer a brief Undo (Andrés #19-F). Shared
  // by the contextual calendar and the drag-and-drop drops.
  const applyMoveWithUndo = useCallback(
    async (
      turnoId: string,
      next: { start: Date; end: Date; sucursal: string | null; professionalId: string | null },
      forcedBy?: string | null,
    ) => {
      const orig = events.find((e) => e.id === turnoId)
      if (!orig) return
      const isDarkNow =
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      const base = {
        title: orig.title,
        status: orig.status,
        charged: orig.charged,
        patientId: orig.patientId,
        treatmentSlug: orig.treatmentSlug,
        observaciones: orig.observaciones,
        packId: orig.packId,
        depositAmount: orig.depositAmount,
        depositDate: orig.depositDate,
        depositReceived: orig.depositReceived,
        allDay: false,
      }
      const err = await updateCalendarEvent(turnoId, {
        ...base,
        start: next.start,
        end: next.end,
        sucursal: next.sucursal,
        professionalId: next.professionalId,
      })
      if (err) {
        void Swal.fire({ icon: 'error', title: t('reschedule.error'), text: err, width: '360px' })
        return
      }
      const parts = [`${t('turnoAudit.rescheduledTo')} ${toDateInput(next.start)} ${toTimeInput(next.start)}`]
      if (next.sucursal !== orig.sucursal)
        parts.push(`${t('turnoAudit.sucursal')}: ${next.sucursal ? sucursalLabel(next.sucursal) : t('turno.none')}`)
      if (next.professionalId !== orig.professionalId)
        parts.push(
          `${t('turnoAudit.professional')}: ${
            next.professionalId
              ? professionals.find((p) => p.value === next.professionalId)?.label || next.professionalId
              : t('turno.none')
          }`,
        )
      if (forcedBy) parts.push(t('turnoAudit.forcedNote'))
      void logTurnoAudit({
        calendarEventId: turnoId,
        patientId: orig.patientId,
        action: 'rescheduled',
        detail: parts.join(' · '),
        changedBy: actorId,
        changedByName: forcedBy || actorName,
      })
      reload()
      const res = await Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: t('reschedule.done'),
        showConfirmButton: true,
        confirmButtonText: t('reschedule.undo'),
        confirmButtonColor: '#5d87ff',
        timer: 6000,
        timerProgressBar: true,
        background: isDarkNow ? '#2a3547' : '#ffffff',
        color: isDarkNow ? '#ffffff' : '#2a3547',
      })
      if (res.isConfirmed) {
        await updateCalendarEvent(turnoId, {
          ...base,
          start: orig.start,
          end: orig.end,
          sucursal: orig.sucursal,
          professionalId: orig.professionalId,
        })
        reload()
      }
    },
    [events, reload, actorId, actorName, sucursalLabel, professionals, t],
  )

  // Contextual calendar (Andrés #19-E): the dialog already showed the before/after
  // summary, so just persist (same professional; only date/time/sucursal move).
  const confirmReschedule = useCallback(
    async (next: { dateStr: string; startTime: string; endTime: string; sucursal: string }) => {
      const turno = rescheduleTurno
      setRescheduleTurno(null)
      if (!turno) return
      const orig = events.find((e) => e.id === turno.id)
      await applyMoveWithUndo(turno.id, {
        start: dateTime(next.dateStr, next.startTime),
        end: dateTime(next.dateStr, next.endTime),
        sucursal: next.sucursal,
        professionalId: orig?.professionalId ?? null,
      })
    },
    [rescheduleTurno, events, applyMoveWithUndo],
  )

  // Drag-and-drop drop (Andrés #19-A/C/D): validate the target, show a before/after
  // summary (or, on incompatibilities, the role-gated block/exception like the
  // editor), then persist with Undo. `target` carries whatever the drop changes;
  // unspecified fields keep the turno's current value.
  const attemptMove = useCallback(
    async (
      turnoId: string,
      target: {
        dateStr?: string
        startMin?: number
        sucursal?: string | null
        professionalId?: string | null
      },
    ) => {
      if (isProfesional) return
      const orig = events.find((e) => e.id === turnoId)
      if (!orig) return
      const isAdmin = role === 'admin'
      const isDarkNow =
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      const durationMin = Math.max(5, Math.round((orig.end.getTime() - orig.start.getTime()) / 60000))
      const dateStr = target.dateStr ?? toDateInput(orig.start)
      const startMin =
        target.startMin ?? orig.start.getHours() * 60 + orig.start.getMinutes()
      const sucursal = target.sucursal !== undefined ? target.sucursal : orig.sucursal
      const professionalId = target.professionalId !== undefined ? target.professionalId : orig.professionalId
      // No-op guard: nothing actually changed.
      const sameSlot =
        dateStr === toDateInput(orig.start) &&
        startMin === orig.start.getHours() * 60 + orig.start.getMinutes() &&
        (sucursal ?? '') === (orig.sucursal ?? '') &&
        (professionalId ?? '') === (orig.professionalId ?? '')
      if (sameSlot) return
      const start = dateTime(dateStr, minToHHMM(startMin))
      const end = new Date(start.getTime() + durationMin * 60000)
      const check = validateMove(
        {
          dateStr,
          startMin,
          durationMin,
          sucursal: sucursal ?? '',
          professionalId: professionalId ?? undefined,
          treatmentSlug: orig.treatmentSlug ?? '',
          excludeId: turnoId,
        },
        rescheduleCtx,
        (ev) => events.find((x) => x.id === ev.id)?.patientName ?? t('turno.none'),
      )
      const commonSwal = {
        background: isDarkNow ? '#2a3547' : '#ffffff',
        color: isDarkNow ? '#ffffff' : '#2a3547',
        width: '400px',
        customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
      }
      const profLabel = professionalId
        ? professionals.find((p) => p.value === professionalId)?.label || ''
        : ''
      const sucLabel = sucursal ? sucursalLabel(sucursal) : t('turno.none')
      const summaryHtml =
        `<div style="text-align:left">` +
        `<div>${t('reschedule.from')}: ${toDateInput(orig.start)} · ${toTimeInput(orig.start)} · ${
          orig.professionalId
            ? professionals.find((p) => p.value === orig.professionalId)?.label || orig.professionalId
            : t('turno.none')
        } · ${orig.sucursal ? sucursalLabel(orig.sucursal) : t('turno.none')}</div>` +
        `<div style="font-weight:600;margin-top:.25em">${t('reschedule.toLabel')}: ${dateStr} · ${minToHHMM(
          startMin,
        )} · ${profLabel || t('turno.none')} · ${sucLabel}</div></div>`

      if (check.ok) {
        const res = await Swal.fire({
          ...commonSwal,
          icon: 'question',
          iconColor: '#5d87ff',
          title: t('reschedule.confirmMoveTitle'),
          html: summaryHtml,
          showCancelButton: true,
          confirmButtonText: t('reschedule.confirm'),
          cancelButtonText: t('reschedule.cancel'),
          confirmButtonColor: '#5d87ff',
          cancelButtonColor: isDarkNow ? '#3f4a5d' : '#e5e7eb',
        })
        if (!res.isConfirmed) return
        await applyMoveWithUndo(turnoId, { start, end, sucursal, professionalId })
        return
      }

      // Incompatibilities → list them all (Andrés #19-B).
      const issues: string[] = []
      if (!check.performsTreatment) {
        const treatmentLabel = orig.treatmentSlug
          ? treatments.find((x) => x.value === orig.treatmentSlug)?.label || orig.treatmentSlug
          : ''
        issues.push(t('turno.incompatTreatment', { name: profLabel, treatment: treatmentLabel }))
      }
      if (!check.hasAvailability)
        issues.push(
          profLabel
            ? t('turno.noAvailWho', { name: profLabel, sucursal: sucLabel })
            : t('turno.noAvailBranch', { sucursal: sucLabel }),
        )
      else if (!check.fitsWindow) issues.push(t('reschedule.incompatDuration'))
      if (check.lunchConflict) issues.push(t('reschedule.incompatLunch'))
      if (check.overlap)
        issues.push(t('reschedule.incompatOverlap', { name: check.overlap.name, range: check.overlap.range }))
      const listHtml = `<ul style="text-align:left;margin:0 0 .6em;padding-left:1.15em">${issues
        .map((i) => `<li style="margin:.15em 0">${i}</li>`)
        .join('')}</ul>`
      const capabilityIssue = !check.performsTreatment

      if (isAdmin) {
        const res = await Swal.fire({
          ...commonSwal,
          icon: 'warning',
          iconColor: '#ffae1f',
          title: t('turno.incompatTitle'),
          html: `${listHtml}<div>${t('turno.noAvailAdminTail')}</div>`,
          showConfirmButton: true,
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: t('turno.noAvailAuthorize'),
          denyButtonText: t('turno.noAvailEditDispo'),
          cancelButtonText: t('reschedule.cancel'),
          confirmButtonColor: '#5d87ff',
          denyButtonColor: '#13deb9',
          cancelButtonColor: isDarkNow ? '#3f4a5d' : '#e5e7eb',
        })
        if (res.isDenied) {
          if (typeof window !== 'undefined') {
            const qs = new URLSearchParams({ tab: capabilityIssue ? 'profesionales' : 'disponibilidad' })
            if (professionalId) qs.set('prof', professionalId)
            if (!capabilityIssue) {
              if (sucursal) qs.set('suc', sucursal)
              qs.set('date', dateStr)
            }
            window.location.href = `/auto-gestion?${qs.toString()}`
          }
          return
        }
        if (!res.isConfirmed) return
        await applyMoveWithUndo(turnoId, { start, end, sucursal, professionalId }, actorName)
      } else {
        await Swal.fire({
          ...commonSwal,
          icon: 'error',
          title: t('turno.incompatTitle'),
          html: `${listHtml}<div>${t('turno.noAvailStaffTail')}</div>`,
          confirmButtonText: t('turno.closedBlockedOk'),
          confirmButtonColor: '#5d87ff',
        })
      }
    },
    [
      events,
      role,
      isProfesional,
      rescheduleCtx,
      applyMoveWithUndo,
      professionals,
      treatments,
      sucursalLabel,
      actorName,
      t,
    ],
  )
  const reloadLunch = useCallback(() => {
    void fetchLunch().then(({ config, overrides }) => {
      setLunchConfig(config)
      setLunchOverrides(overrides)
    })
  }, [])
  // Click the ALMUERZO block in Vista Día to move/remove lunch for THIS day only
  // (an override; the habitual config stays). Admin-only — moving lunch is an
  // authorisation, like the booking exception (Andrés punto 5).
  const openLunchEditor = useCallback(
    async (col: DayCol) => {
      const isDark =
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      const commonSwal = {
        background: isDark ? '#2a3547' : '#ffffff',
        color: isDark ? '#ffffff' : '#2a3547',
        width: '360px',
        customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
      }
      if (role !== 'admin') {
        await Swal.fire({ ...commonSwal, icon: 'info', title: t('turno.lunchTitle'), text: t('turno.lunchAdminOnly'), confirmButtonText: t('turno.closedBlockedOk'), confirmButtonColor: '#5d87ff' })
        return
      }
      const ds = toDateInput(date)
      const profId = profIdOfResource(col.resourceId)
      const cur = lunchFor(col.sucursal, profId, ds)
      const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      const startCur = cur ? mm(cur.startMin) : '13:00'
      const endCur = cur ? mm(cur.endMin) : '14:00'
      const opts = (selected: string) => {
        let out = ''
        for (let m = 6 * 60; m <= 22 * 60; m += 15) {
          const v = mm(m)
          out += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`
        }
        return out
      }
      const selCls =
        'rounded-md border border-[#e5eaef] dark:border-[#333f55] bg-transparent px-2 py-1.5 text-sm'
      const res = await Swal.fire({
        ...commonSwal,
        title: t('turno.lunchTitle'),
        html: `<div style="display:flex;gap:12px;justify-content:center;align-items:end">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px">${t('autoGestion.lunch.from')}<select id="cb-lunch-start" class="${selCls}">${opts(startCur)}</select></label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px">${t('autoGestion.lunch.to')}<select id="cb-lunch-end" class="${selCls}">${opts(endCur)}</select></label>
          </div>`,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: t('turno.lunchSave'),
        denyButtonText: t('turno.lunchRemoveDay'),
        cancelButtonText: t('agendaCal.cancel'),
        confirmButtonColor: '#5d87ff',
        denyButtonColor: '#fa896b',
        cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
        preConfirm: () => {
          const toMin = (v: string) => {
            const [h, m] = v.split(':').map(Number)
            return h * 60 + m
          }
          const sEl = document.getElementById('cb-lunch-start') as HTMLSelectElement | null
          const eEl = document.getElementById('cb-lunch-end') as HTMLSelectElement | null
          const sMin = toMin(sEl?.value ?? startCur)
          const eMin = toMin(eEl?.value ?? endCur)
          if (eMin <= sMin) {
            Swal.showValidationMessage(t('autoGestion.lunch.badRange'))
            return false
          }
          return { sMin, eMin }
        },
      })
      if (res.isConfirmed && res.value) {
        await saveLunchOverride({
          sucursal: col.sucursal,
          professionalId: profId ?? null,
          day: ds,
          removed: false,
          startMin: res.value.sMin,
          endMin: res.value.eMin,
        })
        reloadLunch()
      } else if (res.isDenied) {
        await saveLunchOverride({
          sucursal: col.sucursal,
          professionalId: profId ?? null,
          day: ds,
          removed: true,
          startMin: null,
          endMin: null,
        })
        reloadLunch()
      }
    },
    [date, role, lunchFor, reloadLunch, t],
  )

  // Day-view schedule table (Andrés 2026-09-16): the day's (timed, non-cancelled)
  // turnos and a stable turno -> hybrid column mapping, reusing the same columns
  // as the RBC resource layout so the table matches the rest of the agenda.
  const dayColIdSet = useMemo(
    () => new Set(dayHybridResources.map((r) => r.resourceId)),
    [dayHybridResources],
  )
  const dayResourceIdFor = useCallback(
    (e: CalendarEvent) => hybridResourceIdFor(e, dayColIdSet),
    [hybridResourceIdFor, dayColIdSet],
  )
  const dayTurnos = useMemo(
    () =>
      visibleEvents.filter(
        (e) => !e.allDay && e.status !== 'cancelado' && toDateInput(e.start) === toDateInput(date),
      ),
    [visibleEvents, date],
  )
  // Legacy all-day turnos on this date (patient turnos are timed now, punto 4a):
  // surfaced in a small top section of Vista Día so they never disappear.
  const dayAllDayTurnos = useMemo(
    () =>
      visibleEvents.filter(
        (e) => e.allDay && e.status !== 'cancelado' && toDateInput(e.start) === toDateInput(date),
      ),
    [visibleEvents, date],
  )

  // Week grid (Andrés 2026-09-16): the 6 days Mon–Sat of the current week, and the
  // week's (timed, non-cancelled) turnos.
  const weekDays = useMemo(() => {
    const base = new Date(date)
    base.setHours(0, 0, 0, 0)
    const wd = base.getDay() // 0=Sun … 6=Sat
    // Match weekMonToSat: a Sunday rolls FORWARD to the upcoming Mon–Sat working
    // week (not back to the one that ended), so it stays consistent with the Month.
    const back = wd === 0 ? -1 : wd - 1
    const monday = new Date(base)
    monday.setDate(base.getDate() - back)
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [date])
  const weekTurnos = useMemo(() => {
    const startMs = weekDays[0].getTime()
    const end = new Date(weekDays[weekDays.length - 1])
    end.setHours(23, 59, 59, 999)
    const endMs = end.getTime()
    return visibleEvents.filter(
      (e) =>
        !e.allDay &&
        e.status !== 'cancelado' &&
        e.start.getTime() >= startMs &&
        e.start.getTime() <= endMs,
    )
  }, [visibleEvents, weekDays])

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
  // "+N" day panel (Andrés #19-D): clicking the overflow opens a list of ALL that
  // day's turnos. A ref keeps dateCellWrapper (empty-deps) able to open it.
  const [dayPanelDate, setDayPanelDate] = useState<string | null>(null)
  const openDayPanelRef = useRef((ds: string) => setDayPanelDate(ds))
  // Month drag-reschedule (Andrés #19-D): dropping a circle on another day moves
  // the turno to that day (keeping time/professional/sucursal). Ref for empty-deps.
  const attemptMoveRef = useRef(attemptMove)
  attemptMoveRef.current = attemptMove

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
      // Profesional cannot create turnos (Andrés #18) — view + status only.
      if (isProfesional) return
      // The general "Nuevo evento" button (no slot clicked) must NOT prefill
      // today's date/time (Andrés punto 20): leave the date/time empty and open
      // the calendar on the month currently in view. From the Day view (a concrete
      // day) prefill that day; a clicked Day/Week free slot fills date + time.
      const fromSlot = !!start
      const dayContext = !fromSlot && view === Views.DAY
      const startStr = start ? toDateInput(start) : dayContext ? toDateInput(date) : ''
      const endBase = end ?? start
      const endStr = endBase ? toDateInput(endBase) : startStr
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
        startStr,
        endStr,
        startTime: start ? toTimeInput(start) : '',
        endTime: end ? toTimeInput(end) : '',
        observaciones: '',
        packId: null,
        depositAmount: '',
        depositDate: '',
        depositReceived: false,
        defaultMonth: toDateInput(date),
      })
    },
    [isProfesional, myUserId, view, date],
  )

  // From the Month, open a day in the Day view; if 2+ sucursales work/have turnos
  // that day, open it split into columns per sucursal (Andrés 2026-09-15).
  const openDayFromMonth = useCallback(
    async (d: Date) => {
      const ds = toDateInput(d)
      // If EVERY sucursal is closed that day, warn before entering (Andrés #17):
      // you can still "ver el día", but it does not enable scheduling. Partial
      // closures just open normally (the open branches still show).
      const fullyClosed = SUCURSALES.every((s) => isSucursalClosed(ds, s))
      if (fullyClosed) {
        const reason = closureReasonFor(ds, SUCURSALES[0] ?? '')
        const isDarkNow =
          typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
        const res = await Swal.fire({
          icon: 'warning',
          iconColor: '#fa896b',
          title: t('turno.closedDayTitle'),
          text: `${t('turno.closedDayBody')}${reason ? ` ${t('turno.closedReason', { reason })}` : ''}`,
          showCancelButton: true,
          confirmButtonText: t('turno.closedDayView'),
          cancelButtonText: t('agendaCal.cancel'),
          confirmButtonColor: '#5d87ff',
          cancelButtonColor: isDarkNow ? '#3f4a5d' : '#e5e7eb',
          background: isDarkNow ? '#2a3547' : '#ffffff',
          color: isDarkNow ? '#ffffff' : '#2a3547',
          width: '380px',
          customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
        })
        if (!res.isConfirmed) return
      }
      // Drill into the day split by working sucursales/profesionales (hybrid).
      setDate(d)
      setColumnMode('professional')
      setView(Views.DAY)
    },
    [isSucursalClosed, closureReasonFor, t],
  )

  // View switch from the toolbar. Entering Agenda builds a contextual date range
  // from the view you came from (Andrés 2026-09-17); leaving it restores the date
  // you were working on so Día/Semana/Mes keep their context.
  const handleView = useCallback(
    (next: View) => {
      if (next === Views.AGENDA && view !== Views.AGENDA) {
        preAgendaDateRef.current = date
        if (view === Views.MONTH) {
          const first = new Date(date.getFullYear(), date.getMonth(), 1)
          const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
          setDate(first)
          setAgendaLength(daysInMonth)
        } else if (view === Views.WEEK) {
          const base = new Date(date)
          base.setHours(0, 0, 0, 0)
          const wd = base.getDay()
          const back = wd === 0 ? -1 : wd - 1 // Sunday → upcoming week's Monday
          const monday = new Date(base)
          monday.setDate(base.getDate() - back)
          setDate(monday)
          setAgendaLength(30)
        } else {
          // From Day: keep the date, show ~1 month ahead.
          setAgendaLength(30)
        }
      } else if (view === Views.AGENDA && next !== Views.AGENDA && preAgendaDateRef.current) {
        setDate(preAgendaDateRef.current)
      }
      setView(next)
    },
    [view, date],
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
        // Preserve the deposit on reprogramación / cambio de sucursal (Andrés #1).
        depositAmount: event.depositAmount,
        depositDate: event.depositDate,
        depositReceived: event.depositReceived,
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
      depositAmount: ev.depositAmount != null ? String(ev.depositAmount) : '',
      depositDate: ev.depositDate ?? '',
      depositReceived: ev.depositReceived,
    })
  }, [])

  // Deep-link from the patient ficha (Reservas → click turno): ?event=<id> lands
  // on that turno's date in Vista Día and FLASHES the exact card, keeping the
  // agenda context instead of opening the editor directly (Andrés punto 3). The
  // user then clicks the card to open it normally.
  //
  // Read the params REACTIVELY (useSearchParams), not from window.location in a
  // one-shot initializer: Next's App Router keeps this route mounted and only
  // swaps the query on client navigation, so a state initializer would never
  // re-run and the deep-link would land on whatever view was already open.
  const [flashEventId, setFlashEventId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const eventParam = searchParams.get('event')
  const dateParam = searchParams.get('date')
  // 1) Navigate to Día on the linked date as soon as the param appears (even
  //    before that day's turnos have loaded), so the right day's data fetches.
  const navigatedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!eventParam || navigatedForRef.current === eventParam) return
    navigatedForRef.current = eventParam
    setView(Views.DAY)
    setColumnMode('professional')
    if (dateParam) setDate(new Date(`${dateParam}T00:00:00`))
  }, [eventParam, dateParam])
  // 2) Once the exact turno is loaded, pin the date to it and flash the card.
  const flashedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!eventParam || events.length === 0 || flashedForRef.current === eventParam) return
    const ev = events.find((e) => e.id === eventParam)
    if (!ev) return
    flashedForRef.current = eventParam
    setDate(new Date(ev.start))
    setFlashEventId(ev.id)
  }, [events, eventParam])

  // Return trip from "Editar disponibilidad" (Andrés punto 1c): after the admin
  // saves the availability in Autogestión and chooses to come back, we land here
  // with the stashed turno in sessionStorage. Restore the agenda context (view +
  // date) and re-open the editor with the data the admin had loaded. Runs once.
  const restoredReturnRef = useRef(false)
  useEffect(() => {
    if (restoredReturnRef.current) return
    restoredReturnRef.current = true
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(RETURN_TURNO_KEY)
      if (raw) sessionStorage.removeItem(RETURN_TURNO_KEY)
    } catch {
      return
    }
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { draft: Draft; view?: string; date?: string }
      if (!parsed?.draft) return
      if (parsed.date) setDate(new Date(`${parsed.date}T00:00:00`))
      if (parsed.view === Views.DAY || parsed.view === Views.WEEK) setColumnMode('professional')
      if (parsed.view) setView(parsed.view as View)
      setDraft(parsed.draft)
    } catch {
      // Malformed payload: ignore.
    }
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
        canAdd={!isProfesional}
        t={t}
      />
    ),
    [t, openAdd, isProfesional],
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
      onDragOver?: (ev: ReactDragEvent) => void
      onDrop?: (ev: ReactDragEvent) => void
    }>
    const ds = toDateInput(props.value)
    const dayMap = turnosByDaySucursalRef.current.get(ds)
    const openSucs = new Set(sedeMarkersRef.current(props.value).map((m) => m.sucursal))
    // A band is drawn for any sucursal that is programmed-open OR merely has a
    // turno (so an admin's exceptional turno is still visible), but ONLY the
    // programmed-open ones paint the coloured availability "fondo" — an
    // exceptional turno gets a neutral band and never makes its sucursal look
    // normally available in Vista Mes (Andrés 2026-09-20, punto 1).
    const bandSucs = SUCURSALES.filter((s) => openSucs.has(s) || dayMap?.has(s))
    // Turnos with no sucursal still get a NEUTRAL band so their treatment circle
    // shows in Vista Mes (never with a sucursal colour) — Andrés 2026-09, punto 4.
    const hasNone = (dayMap?.get(NONE_RESOURCE)?.length ?? 0) > 0
    const bandKeys = hasNone ? [...bandSucs, NONE_RESOURCE] : bandSucs
    // Every day is a drop target for Month drag (Andrés #19-D): drop a turno's
    // circle here to move it to this day (keeping time/professional/sucursal).
    const dropProps = {
      onDragOver: (ev: ReactDragEvent) => {
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
      },
      onDrop: (ev: ReactDragEvent) => {
        ev.preventDefault()
        const id = ev.dataTransfer.getData('text/plain')
        if (id) void attemptMoveRef.current(id, { dateStr: ds })
      },
    }
    if (bandKeys.length === 0) return cloneElement(el, dropProps)
    // Circles shown per band before the "+N" pill, adaptive to how many bands work
    // that day (Andrés spec: 1 → 9, 2 → 5, 3+ → 3). Each band keeps its own "+N".
    const cap = bandKeys.length === 1 ? 9 : bandKeys.length === 2 ? 5 : 3
    const overlay = (
      <div className='cb-month-bands'>
        {bandKeys.map((key) => {
          const isNone = key === NONE_RESOURCE
          const turnos = dayMap?.get(key) ?? []
          const shown = turnos.slice(0, cap)
          const extra = turnos.length - shown.length
          return (
            <div
              key={key}
              className='cb-month-band'
              style={{
                background: !isNone && openSucs.has(key) ? hexToRgba(sucursalColor(key), 0.16) : 'transparent',
              }}
              title={isNone ? t('agenda.noSucursal') : sucursalLabel(key)}>
              <div className='cb-month-circles'>
                {shown.map((tt) => (
                  <span
                    key={tt.id}
                    className='cb-month-dot'
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData('text/plain', tt.id)
                      ev.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(ev) => {
                      ev.preventDefault()
                      ev.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(ev) => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      const id = ev.dataTransfer.getData('text/plain')
                      if (id) void attemptMoveRef.current(id, { dateStr: ds })
                    }}
                    // Rich tooltip (Andrés #19-D): hora · paciente · tratamiento ·
                    // profesional · sucursal · estado.
                    title={[
                      toTimeInput(tt.start),
                      tt.patientName || tt.title,
                      treatmentNameRef.current(tt.treatmentSlug),
                      tt.professionalId ? professionalNameRef.current(tt.professionalId) : '',
                      tt.sucursal ? sucursalLabel(tt.sucursal) : t('agenda.noSucursal'),
                      statusLabelRef.current(tt.status),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    style={{
                      backgroundColor: statusColorRef.current(tt.status),
                      pointerEvents: 'auto',
                      cursor: 'grab',
                    }}
                  />
                ))}
                {extra > 0 && (
                  <button
                    type='button'
                    className='cb-month-more'
                    style={{ pointerEvents: 'auto' }}
                    title={t('agenda.moreTurnos', { n: String(extra) })}
                    onClick={(ev) => {
                      // Open the day panel (all turnos), not drill into the day.
                      ev.stopPropagation()
                      openDayPanelRef.current(ds)
                    }}>
                    +{extra}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
    return cloneElement(
      el,
      {
        title: bandKeys.map((k) => (k === NONE_RESOURCE ? t('agenda.noSucursal') : sucursalLabel(k))).join(' · '),
        ...dropProps,
      },
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
        // Agenda: treatment = a vertical BAR at the left of the row (painted on the
        // time cell via --cb-treat, like Day/Week — Andrés 2026-09-17); info runs
        // inline; cobro "$" is a solid full-height block at the right when charged.
        // Row background = estado (eventPropGetter).
        <span className={`flex items-center gap-2 w-full ${event.charged ? 'pr-14' : ''}`}>
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
              style={{ backgroundColor: '#16a34a' }}
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
        {/* Columns selector: only where columns apply (not the custom Day view). */}
        {view !== Views.DAY && (
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
        )}
        {/* Scale selector: only in Day + Week, where it drives a real time grid
            (Andrés #14). Hidden in Month (no time grid) and Agenda (list). */}
        {(view === Views.DAY || view === Views.WEEK) && (
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
        )}
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
          {/* Andrés #1: white/neutral = an exceptional turno on a day without
              programmed availability. */}
          <span className='inline-flex items-center gap-1.5'>
            <span className='h-2.5 w-2.5 rounded-full border border-border dark:border-darkborder bg-card' />
            {t('agenda.exceptionLegend')}
          </span>
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
                  {/* A short bar (not a circle): the treatment colour is the left
                      bar in Semana/Día/Agenda (Andrés 2026-09-20, punto 6). */}
                  <span className='h-3 w-1.5 rounded-sm' style={{ backgroundColor: tl.color }} />
                  {tl.label}
                </span>
              ))}
            </div>
          )}

      <div
        ref={monthScrollRef}
        className={view === Views.MONTH ? 'overflow-x-auto cb-hscroll' : undefined}>
      <DnDCalendar
        localizer={localizer}
        formats={calendarFormats as never}
        // Hide RBC's own time-grid in Week and Day (Andrés 2026-09-16): the Day is
        // rendered by the custom hour-table (DaySchedule) below, and the RBC
        // calendar is kept only for its toolbar + Month/Agenda views.
        className={view === Views.WEEK || view === Views.DAY ? 'cb-hidegrid' : undefined}
        events={calendarEvents}
        startAccessor='start'
        endAccessor='end'
        // Columns are a Day-only display option, so they no longer force the view
        // nor block Week/Month navigation (Andrés 2026-09-15). The view is always
        // whatever the toolbar selects; columns apply only when Day is active.
        view={view}
        onView={handleView}
        date={date}
        onNavigate={setDate}
        // Agenda (list) range length in days — contextual to how it was entered.
        length={agendaLength}
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
            // Fixed height for the views RBC actually renders (Month overview,
            // Agenda list). Week/Day hide RBC's grid (custom table below), so the
            // calendar shrinks to just its toolbar (auto) with no empty gap.
            height:
              view === Views.MONTH ? 680 : view === Views.AGENDA ? 720 : 'auto',
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
            backgroundColor: isDarkMode
              ? darkCardBg(statusColorFor(event.status))
              : lightenHex(statusColorFor(event.status)),
            color: isDarkMode ? '#e6ebf2' : '#1f2937',
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
      </div>

      {view === Views.WEEK && (
        <div className='mt-3'>
          <WeekSchedule
            days={weekDays}
            focusDate={date}
            columnsForDay={computeDayColumns}
            resourceIdFor={hybridResourceIdFor}
            lunchFor={(day, col) => lunchFor(col.sucursal, profIdOfResource(col.resourceId), toDateInput(day))}
            turnos={weekTurnos}
            onOpenTurno={onSelectEvent}
            onOpenDay={openDayFromMonth}
            onCreate={(start, end, sucursal, professionalId) =>
              openAdd(start, end, false, sucursal, professionalId)
            }
            treatmentColor={treatmentColorResolved}
            treatmentName={treatmentName}
            cardBg={(status) =>
              isDarkMode ? darkCardBg(statusColorFor(status)) : lightenHex(statusColorFor(status))
            }
            cardText={() => (isDarkMode ? '#e6ebf2' : '#141a21')}
            sucursalLabel={sucursalLabel}
            sucursalColor={sucursalColor}
            locale={locale}
            lunchLabel={t('agenda.lunch')}
            newLabel={t('agendaCal.new')}
            emptyLabel={t('agenda.noProfessional')}
            scaleMin={scaleMin}
            onMoveTurno={(id, target) => void attemptMove(id, target)}
          />
        </div>
      )}

      {view === Views.DAY && (
        <div className='mt-3'>
          <DaySchedule
            date={date}
            columns={dayHybridResources}
            turnos={dayTurnos}
            allDayTurnos={dayAllDayTurnos}
            noTimeLabel={t('agenda.noTimeEvents')}
            resourceIdFor={dayResourceIdFor}
            flashEventId={flashEventId}
            onFlashDone={() => setFlashEventId(null)}
            onOpenTurno={onSelectEvent}
            onCreate={(start, end, sucursal, professionalId) =>
              openAdd(start, end, false, sucursal, professionalId)
            }
            treatmentColor={treatmentColorResolved}
            treatmentName={treatmentName}
            cardBg={(status) =>
              isDarkMode ? darkCardBg(statusColorFor(status)) : lightenHex(statusColorFor(status))
            }
            cardText={() => (isDarkMode ? '#e6ebf2' : '#141a21')}
            sucursalLabel={sucursalLabel}
            locale={locale}
            emptyLabel={t('agenda.noProfessional')}
            newLabel={t('agendaCal.new')}
            lunchLabel={t('agenda.lunch')}
            scaleMin={scaleMin}
            earlierLabel={t('agenda.showEarlier')}
            laterLabel={t('agenda.showLater')}
            resetHoursLabel={t('agenda.resetHours')}
            lunchFor={(col) => lunchFor(col.sucursal, profIdOfResource(col.resourceId), toDateInput(date))}
            onEditLunch={openLunchEditor}
            onMoveTurno={(id, target) => void attemptMove(id, target)}
          />
        </div>
      )}

      {draft && (
        <EventDialog
          draft={draft}
          treatments={treatments}
          professionals={professionals}
          rules={availRules}
          exclusions={availExclusions}
          catalogSlugs={catalogSlugs}
          treatmentDurations={treatmentDurations}
          lunchFor={lunchFor}
          professionalDoesTreatment={professionalDoesTreatment}
          allEvents={events}
          isSucursalClosed={isSucursalClosed}
          closureReasonFor={closureReasonFor}
          // Closed days are NOT forceable (Andrés 2026-09-18): admin is guided to
          // Autogestión; staff must ask an admin. Profesional edits status only.
          isAdmin={role === 'admin'}
          canEditFull={role === 'admin' || role === 'operador'}
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
          onReschedule={(turno) => {
            setDraft(null)
            setRescheduleTurno(turno)
          }}
          onCloseSession={(pf) => {
            setDraft(null)
            setEvolucionPrefill(pf)
          }}
          t={t}
        />
      )}

      {rescheduleTurno && (
        <RescheduleDialog
          turno={rescheduleTurno}
          durationMin={Math.max(
            5,
            Math.round((rescheduleTurno.end.getTime() - rescheduleTurno.start.getTime()) / 60000),
          )}
          ctx={rescheduleCtx}
          sucursalLabel={sucursalLabel}
          treatmentLabel={
            treatments.find((x) => x.value === rescheduleTurno.treatmentSlug)?.label ||
            rescheduleTurno.treatmentSlug ||
            t('turno.none')
          }
          professionalLabel={
            (rescheduleTurno.professionalId &&
              professionals.find((p) => p.value === rescheduleTurno.professionalId)?.label) ||
            t('turno.none')
          }
          onClose={() => setRescheduleTurno(null)}
          onConfirm={confirmReschedule}
          onViewDay={(ds) => {
            setRescheduleTurno(null)
            setDate(new Date(`${ds}T00:00:00`))
            setColumnMode('professional')
            setView(Views.DAY)
          }}
          t={t}
          locale={locale}
        />
      )}

      {dayPanelDate && (() => {
        // All turnos of the clicked day, across sucursales, ordered by time
        // (Andrés #19-D). Each row opens its turno.
        const dayMap = turnosByDaySucursal.get(dayPanelDate)
        const list = dayMap ? [...dayMap.values()].flat().sort((a, b) => a.start.getTime() - b.start.getTime()) : []
        return (
          <div
            className='fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4'
            onClick={() => setDayPanelDate(null)}>
            <div
              className='w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg bg-card shadow-xl'
              onClick={(e) => e.stopPropagation()}>
              <div className='flex items-center justify-between border-b border-border dark:border-darkborder px-4 py-3'>
                <h3 className='text-base font-semibold text-dark dark:text-white'>
                  {moment(new Date(`${dayPanelDate}T00:00:00`)).format('DD MMM YYYY')} · {list.length}
                </h3>
                <button
                  type='button'
                  onClick={() => setDayPanelDate(null)}
                  className='text-link dark:text-darklink hover:text-primary'>
                  <Icon icon='tabler:x' height={18} width={18} />
                </button>
              </div>
              <div className='divide-y divide-border dark:divide-darkborder'>
                {list.map((tt) => (
                  <button
                    key={tt.id}
                    type='button'
                    onClick={() => {
                      setDayPanelDate(null)
                      onSelectEvent(tt)
                    }}
                    className='w-full text-left px-4 py-2.5 hover:bg-lightprimary/40 transition-colors flex items-start gap-2'>
                    <span
                      className='mt-1 h-2.5 w-2.5 rounded-full shrink-0'
                      style={{ backgroundColor: statusColorFor(tt.status) }}
                    />
                    <span className='min-w-0'>
                      <span className='block text-sm font-medium text-dark dark:text-white'>
                        {toTimeInput(tt.start)} · {tt.patientName || tt.title}
                      </span>
                      <span className='block text-xs text-link dark:text-darklink truncate'>
                        {[
                          treatmentName(tt.treatmentSlug),
                          tt.professionalId ? professionalName(tt.professionalId) : '',
                          tt.sucursal ? sucursalLabel(tt.sucursal) : t('agenda.noSucursal'),
                          statusLabelFor(tt.status),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

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
