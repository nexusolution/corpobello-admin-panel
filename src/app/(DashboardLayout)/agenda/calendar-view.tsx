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
import {
  availabilityFor,
  anyTreatmentAvailability,
  type AvailabilityRule,
  type AvailabilityExclusion,
} from '@/lib/scheduling/availability'
import { suggestDurationMinutes } from '@/lib/scheduling/duration'
import { getTreatmentColorBySlug } from '@/lib/treatment-colors'
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
}

const SELECT_CLS =
  'mt-1 w-full pl-2.5 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

// Status picker with a colour dot per estado (native <option> can't be coloured).
function StatusSelect({
  value,
  onChange,
  t,
}: {
  value: TurnoStatus
  onChange: (v: TurnoStatus) => void
  t: TFn
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type='button' className={`${SELECT_CLS} flex items-center justify-between gap-2 text-left`}>
          <span className='flex items-center gap-2 truncate'>
            <span className='h-2.5 w-2.5 rounded-full shrink-0' style={{ backgroundColor: STATUS_COLORS[value] }} />
            <span className='truncate'>{t(STATUS_LABEL_KEY[value])}</span>
          </span>
          <Icon icon='tabler:chevron-down' height={15} width={15} className='text-link dark:text-darklink shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-[240px] p-1' align='start'>
        <div className='max-h-72 overflow-y-auto'>
          {TURNO_STATUSES.map((s) => (
            <button
              key={s}
              type='button'
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded text-sm hover:bg-lightprimary text-dark dark:text-white ${s === value ? 'bg-lightprimary/60' : ''}`}>
              <span className='h-2.5 w-2.5 rounded-full shrink-0' style={{ backgroundColor: STATUS_COLORS[s] }} />
              <span className='truncate'>{t(STATUS_LABEL_KEY[s])}</span>
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
    // Availability guard: warn (but allow override) if the branch is closed.
    if (hasClosedDay) {
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
    setSaving(true)
    setError(null)
    const input = {
      title: patientName ?? 'Turno',
      start: allDay ? startOfDay(startStr) : dateTime(startStr, startTime),
      end: allDay ? endOfDay(endStr) : dateTime(endStr, endTime),
      allDay,
      status,
      charged,
      patientId,
      professionalId: professionalId || null,
      sucursal: sucursal || null,
      treatmentSlug: treatmentSlug || null,
      observaciones: observaciones.trim() || null,
    }
    const err = isEdit
      ? await updateCalendarEvent(draft.id as string, input)
      : (await createCalendarEvent(input)).error
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    onSaved()
  }

  async function remove() {
    if (!isEdit) return
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
    onSaved()
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto'
      onClick={onClose}>
      <div
        className='w-full max-w-md rounded-xl bg-card p-6 shadow-xl my-8'
        onClick={(e) => e.stopPropagation()}>
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
        <p className='text-xs text-link dark:text-darklink mb-4'>{t('turno.subtitle')}</p>

        <div className='space-y-4'>
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
                    onClick={() => router.push(`/pacientes/${patientId}`)}
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
              <select
                value={treatmentSlug}
                onChange={(e) => {
                  const v = e.target.value
                  setTreatmentSlug(v)
                  applyAutoDuration(v, firstSession)
                }}
                className={SELECT_CLS}>
                <option value=''>{t('turno.none')}</option>
                {treatments.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
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
              <StatusSelect value={status} onChange={setStatus} t={t} />
            </label>
          </div>

          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className='h-4 w-4 rounded border-border dark:border-darkborder accent-primary'
            />
            <span className='text-sm text-dark dark:text-white'>{t('turno.allDay')}</span>
          </label>

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

        <div className='mt-6 flex items-center justify-between gap-2'>
          {isEdit ? (
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

// ── Main view ─────────────────────────────────────────────────────────────────
export function CalendarView() {
  const { t, locale } = useTranslation()
  const { role } = useCurrentUser()
  const isProfesional = role === 'profesional'
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState<Date>(() => new Date())
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
  // Vertical time scale (minutes per slot) for Week/Day — a zoom, not the real
  // duration. Smaller = short turnos read clearly (Andrés 2026-09-11).
  const [scaleMin, setScaleMin] = useState(30)
  const [availRules, setAvailRules] = useState<AvailabilityRule[]>([])
  const [availExclusions, setAvailExclusions] = useState<AvailabilityExclusion[]>([])
  const [catalogSlugs, setCatalogSlugs] = useState<string[]>([])
  const [treatmentFilterSlugs, setTreatmentFilterSlugs] = useState<string[]>([])
  const [blocks, setBlocks] = useState<AgendaBlock[]>([])

  moment.locale(locale)
  const localizer = useMemo(() => momentLocalizer(moment), [locale])

  const reload = useCallback(() => {
    setLoading(true)
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

  // "Columns by branch" resources: one column per sucursal + a "Sin asignar"
  // bucket for turnos with none. Events carry a `resourceId` so RBC places them
  // in the right column; dragging to another column changes that sucursal.
  const sucursalResources = useMemo(
    () => [
      ...SUCURSALES.map((s) => ({ resourceId: s, resourceTitle: sucursalLabel(s) })),
      { resourceId: NONE_RESOURCE, resourceTitle: t('agenda.noSucursal') },
    ],
    [t],
  )
  // One column per (active) profesional + a "Sin asignar" bucket.
  const professionalResources = useMemo(
    () => [
      ...professionals.map((p) => ({ resourceId: p.value, resourceTitle: p.label })),
      { resourceId: NONE_RESOURCE, resourceTitle: t('turno.none') },
    ],
    [professionals, t],
  )
  const resources = columnMode === 'professional' ? professionalResources : sucursalResources
  const calendarEvents = useMemo(
    () =>
      columnMode === 'professional'
        ? visibleEvents.map((e) => ({ ...e, resourceId: e.professionalId || NONE_RESOURCE }))
        : columnMode === 'sucursal'
          ? visibleEvents.map((e) => ({ ...e, resourceId: e.sucursal || NONE_RESOURCE }))
          : visibleEvents,
    [columnMode, visibleEvents],
  )

  // Pre-reservas past the TTL (highlight only — no auto-cancel in v1).
  const expiredCount = useMemo(
    () => visibleEvents.filter((e) => isExpiredReserva(e)).length,
    [visibleEvents],
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
      if (sucursalFilter || inColumns) return []
      const ds = toDateInput(d)
      return SUCURSALES.filter((suc) => sucursalOpen(ds, suc).open).map((suc) => ({
        sucursal: suc,
        color: sucursalColor(suc),
      }))
    },
    [sucursalFilter, inColumns, sucursalOpen],
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

  // Refs to the volatile lookups so the RBC `components` can be STABLE (never
  // change identity). If the components object changed each render, RBC remounted
  // the toolbar + cells → the "Nuevo evento" button, month label and cells blinked
  // on every state change (e.g. toggling a filter). Stable components read the
  // latest data via these refs; the calendar re-renders cells when `events` change.
  const dayMarkersRef = useRef(dayMarkers)
  dayMarkersRef.current = dayMarkers
  const treatmentNameRef = useRef(treatmentName)
  treatmentNameRef.current = treatmentName
  const professionalNameRef = useRef(professionalName)
  professionalNameRef.current = professionalName

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
      })
    },
    [isProfesional, myUserId],
  )

  const onSelectSlot = useCallback(
    (slot: SlotInfo) => {
      // Clicking a column pre-fills that column's sucursal or profesional.
      const rid = (slot as { resourceId?: unknown }).resourceId
      const picked = rid != null && rid !== NONE_RESOURCE ? String(rid) : undefined
      const sucursalDefault = columnMode === 'sucursal' ? picked : undefined
      const professionalDefault = columnMode === 'professional' ? picked : undefined
      // Month: clicking a free area drills into that day's Day view (Andrés
      // 2026-09-12) — creating a turno is via "Nuevo evento" or from Day/Week.
      if (view === Views.MONTH) {
        setDate(slot.start)
        setView(Views.DAY)
        return
      }
      openAdd(slot.start, slot.end, false, sucursalDefault, professionalDefault)
    },
    [openAdd, view, columnMode],
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
        e = end
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
      })
      reload()
    },
    [reload],
  )

  const onEventDrop = useCallback<
    NonNullable<withDragAndDropProps<CalendarEvent>['onEventDrop']>
  >(
    async ({ event, start, end, isAllDay, resourceId }) => {
      const s = new Date(start)
      const e = new Date(end)
      const rid =
        resourceId != null ? (resourceId === NONE_RESOURCE ? null : String(resourceId)) : undefined

      // Dragging between columns reassigns that dimension.
      if (columnMode === 'sucursal') {
        void persistMove(event, s, e, !!isAllDay, rid)
        return
      }
      if (columnMode === 'professional') {
        void persistMove(event, s, e, !!isAllDay, undefined, rid)
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
          })
          if (res.isConfirmed && res.value) void persistMove(event, s, e, !!isAllDay, String(res.value))
          return // cancel → no move (reverts)
        }
        await Swal.fire({
          icon: 'warning',
          title: t('agenda.noAvailabilityTitle'),
          text: t('agenda.noAvailabilityBody'),
          confirmButtonColor: '#5d87ff',
        })
        return // invalid combination → do not save
      }

      void persistMove(event, s, e, !!isAllDay)
    },
    [persistMove, columnMode, availRules, availExclusions, t],
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
      endStr: toDateInput(ev.end),
      startTime: toTimeInput(ev.start),
      endTime: toTimeInput(ev.end),
      observaciones: ev.observaciones ?? '',
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
        // Left bar = treatment colour; body = paciente / tratamiento / prof·sede;
        // "$" = cobro. Full background (via eventPropGetter) = estado.
        <div className='flex items-stretch gap-1.5 w-full overflow-hidden'>
          <span
            className='w-1 rounded-sm shrink-0'
            style={{
              backgroundColor: event.treatmentSlug
                ? getTreatmentColorBySlug(event.treatmentSlug).hex
                : 'rgba(255,255,255,0.6)',
            }}
          />
          <div className='flex flex-col leading-tight min-w-0 flex-1 overflow-hidden'>
            <span className='flex items-center justify-between gap-1'>
              <span className='truncate font-medium'>
                {isExpiredReserva(event) && <span title={t('agendaCal.expiredMark')}>⏳ </span>}
                {event.title}
              </span>
              {event.charged && (
                <span className='font-bold shrink-0' title={t('agenda.charged')}>$</span>
              )}
            </span>
            {event.treatmentSlug && (
              <span className='truncate opacity-90 text-[11px]'>{treatmentNameRef.current(event.treatmentSlug)}</span>
            )}
            {proSuc && <span className='truncate opacity-75 text-[11px]'>{proSuc}</span>}
          </div>
        </div>
      )
    },
    [t],
  )
  const dateCellWrapper = useCallback((props: { children: ReactElement; value: Date }) => {
    const markers = dayMarkersRef.current(props.value)
    const el = props.children as ReactElement<{
      style?: CSSProperties
      children?: ReactNode
      title?: string
    }>
    if (markers.length === 0) return el
    const n = markers.length
    // Equal vertical columns per open sede (Andrés 2026-09-12): 1 = full colour,
    // 2 = 50/50, 3 = 33/33/33 — clearer and scales better than an oblique split.
    const background =
      n === 1
        ? hexToRgba(markers[0]!.color, 0.16)
        : `linear-gradient(90deg, ${markers
            .map(
              (m, i) =>
                `${hexToRgba(m.color, 0.16)} ${Math.round((i / n) * 100)}% ${Math.round(((i + 1) / n) * 100)}%`,
            )
            .join(', ')})`
    return cloneElement(el, {
      style: { ...(el.props.style ?? {}), background },
      title: markers.map((m) => sucursalLabel(m.sucursal)).join(' · '),
    })
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
        <span className='flex items-center gap-1.5'>
          {event.treatmentSlug && (
            <span
              className='inline-block h-2.5 w-2.5 rounded-sm shrink-0'
              style={{ backgroundColor: getTreatmentColorBySlug(event.treatmentSlug).hex }}
            />
          )}
          <span className='font-medium'>{event.title}</span>
          {parts.length > 0 && <span className='text-link dark:text-darklink'>· {parts.join(' · ')}</span>}
          {event.charged && <span className='font-bold text-success' title={t('agenda.charged')}>$</span>}
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
      week: { header: dayHeader },
      day: { header: dayHeader },
      agenda: { event: agendaEventComp },
    }),
    [toolbarComp, eventComp, dateCellWrapper, dayHeader, agendaEventComp],
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

      <DnDCalendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor='start'
        endAccessor='end'
        view={inColumns ? Views.DAY : view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        {...(inColumns && {
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
            height: 720,
            // Taller rows for finer scales so short turnos stay readable.
            ['--rbc-group-h' as string]: `${Math.max(1, Math.round(60 / scaleMin)) * 24}px`,
          } as CSSProperties
        }
        eventPropGetter={(event: CalendarEvent) => ({
          // Full background = STATUS. The treatment-colour left bar is rendered
          // inside the event card (eventComp) so it shows reliably in every view.
          style: {
            backgroundColor: STATUS_COLORS[event.status],
            color: '#ffffff',
            border: 'none',
          },
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
