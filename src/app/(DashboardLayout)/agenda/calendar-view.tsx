'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'
import {
  Calendar,
  momentLocalizer,
  Views,
  type View,
  type SlotInfo,
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
} from '@/lib/data/calendar-events'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { getTreatmentColorBySlug } from '@/lib/treatment-colors'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { fetchSucursalHours, type DayHours, type Sucursal } from '@/lib/data/sucursal-hours'
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
}

const SELECT_CLS =
  'mt-1 w-full pl-2.5 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

function EventDialog({
  draft,
  treatments,
  professionals,
  onClose,
  onSaved,
  onCloseSession,
  t,
}: {
  draft: Draft
  treatments: Option[]
  professionals: Option[]
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hours, setHours] = useState<DayHours[] | null>(null)

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

  // Load the chosen sucursal's hours to warn about booking on a closed day.
  useEffect(() => {
    if (!sucursal) {
      setHours(null)
      return
    }
    let active = true
    void fetchSucursalHours(sucursal as Sucursal).then((h) => {
      if (active) setHours(h)
    })
    return () => {
      active = false
    }
  }, [sucursal])

  // Any day in [start, end] the branch is closed → availability warning.
  const hasClosedDay = useMemo(() => {
    if (!hours || !startStr || !endStr) return false
    const end = new Date(`${endStr}T00:00:00`)
    for (const d = new Date(`${startStr}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
      const day = hours.find((h) => h.weekday === d.getDay())
      if (day && !day.isOpen) return true
    }
    return false
  }, [hours, startStr, endStr])

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

          <div className='grid grid-cols-2 gap-3'>
            <label className='block'>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('turno.treatment')}</span>
              <select value={treatmentSlug} onChange={(e) => setTreatmentSlug(e.target.value)} className={SELECT_CLS}>
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
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TurnoStatus)}
                className={SELECT_CLS}>
                {TURNO_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(STATUS_LABEL_KEY[s])}</option>
                ))}
              </select>
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
                  onChange={(e) => setStartTime(e.target.value)}
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

          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={charged}
              onChange={(e) => setCharged(e.target.checked)}
              className='h-4 w-4 rounded border-border dark:border-darkborder accent-success'
            />
            <span className='text-sm text-dark dark:text-white'>{t('turno.charged')}</span>
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
  const [professionalFilter, setProfessionalFilter] = useState('')
  // Filter by sucursal ('' = all). When a sucursal is picked we also shade its
  // closed days/hours (availability) from sucursal_hours.
  const [sucursalFilter, setSucursalFilter] = useState('')
  // "Columns by branch" mode: render one column per sucursal (react-big-calendar
  // resources) so staff can drag a turno between branches to reassign it. Only
  // meaningful in the Day view, so turning it on forces Day.
  const [resourceMode, setResourceMode] = useState(false)
  const [hours, setHours] = useState<DayHours[] | null>(null)
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
    // Lookups for the form (best-effort; empty on RLS/error).
    void fetchTreatmentPrices().then(({ data }) =>
      setTreatments(data.map((p) => ({ value: p.slug, label: p.displayName }))),
    )
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data
          .filter((u) => u.status === 'active')
          .map((u) => ({ value: u.id, label: u.fullName })),
      ),
    )
  }, [reload, t])

  // Effective professional filter: the Profesional role is always locked to
  // their own turnos; everyone else uses the dropdown ('' = all).
  const effectiveProfessional = isProfesional ? myUserId ?? '__none__' : professionalFilter
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (!effectiveProfessional || e.professionalId === effectiveProfessional) &&
          (!sucursalFilter || e.sucursal === sucursalFilter),
      ),
    [events, effectiveProfessional, sucursalFilter],
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
  const calendarEvents = useMemo(
    () =>
      resourceMode
        ? visibleEvents.map((e) => ({ ...e, resourceId: e.sucursal || NONE_RESOURCE }))
        : visibleEvents,
    [resourceMode, visibleEvents],
  )

  // Pre-reservas past the TTL (highlight only — no auto-cancel in v1).
  const expiredCount = useMemo(
    () => visibleEvents.filter((e) => isExpiredReserva(e)).length,
    [visibleEvents],
  )

  // Load the selected sucursal's weekly hours (for closed-day/slot shading).
  useEffect(() => {
    if (!sucursalFilter) {
      setHours(null)
      return
    }
    let active = true
    void fetchSucursalHours(sucursalFilter as Sucursal).then((h) => {
      if (active) setHours(h)
    })
    return () => {
      active = false
    }
  }, [sucursalFilter])

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

  // Shade whole days the branch is closed (weekly hours) OR blocked (feriado).
  const dayPropGetter = useCallback(
    (d: Date) => {
      if (isBlockedDay(d)) return { className: 'rbc-closed-day' }
      if (!hours) return {}
      const day = hours.find((h) => h.weekday === d.getDay())
      return day && !day.isOpen ? { className: 'rbc-closed-day' } : {}
    },
    [hours, isBlockedDay],
  )

  // Shade time slots outside opening hours (week/day views) or on blocked days.
  const slotPropGetter = useCallback(
    (d: Date) => {
      if (isBlockedDay(d)) return { className: 'rbc-closed-slot' }
      if (!hours) return {}
      const day = hours.find((h) => h.weekday === d.getDay())
      if (!day || !day.isOpen) return { className: 'rbc-closed-slot' }
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      return hhmm < day.open || hhmm >= day.close ? { className: 'rbc-closed-slot' } : {}
    },
    [hours, isBlockedDay],
  )

  const openAdd = useCallback(
    (start?: Date, end?: Date, allDay = false, sucursalDefault?: string) => {
      const now = new Date()
      // Default new turno: a 1-hour slot at the next full hour.
      const s = start ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.min(now.getHours() + 1, 23), 0, 0)
      const e = end ?? new Date(s.getTime() + 60 * 60 * 1000)
      setDraft({
        id: null,
        patientId: null,
        patientName: null,
        treatmentSlug: '',
        // A profesional creating a turno defaults it to themselves.
        professionalId: isProfesional ? myUserId ?? '' : '',
        sucursal: sucursalDefault ?? '',
        status: 'pendiente',
        charged: false,
        allDay,
        startStr: toDateInput(s),
        endStr: toDateInput(e),
        startTime: toTimeInput(s),
        endTime: toTimeInput(e),
      })
    },
    [isProfesional, myUserId],
  )

  const onSelectSlot = useCallback(
    (slot: SlotInfo) => {
      // In branch-columns mode, clicking a column pre-fills that sucursal.
      const rid = (slot as { resourceId?: unknown }).resourceId
      const sucursalDefault =
        resourceMode && rid != null && rid !== NONE_RESOURCE ? String(rid) : undefined
      // Month select → all-day; week/day time select → timed slot.
      if (view === Views.MONTH) {
        const end = new Date(slot.end.getTime() - 1)
        openAdd(slot.start, end < slot.start ? slot.start : end, true, sucursalDefault)
      } else {
        openAdd(slot.start, slot.end, false, sucursalDefault)
      }
    },
    [openAdd, view, resourceMode],
  )

  // Persist a drag/resize. Timed turnos keep their exact times; all-day ones
  // normalise to day bounds. Optimistic update, then write + reload.
  const persistMove = useCallback(
    async (
      event: CalendarEvent,
      start: Date,
      end: Date,
      allDay: boolean,
      // undefined = keep the event's sucursal; a string/null reassigns it
      // (used when dragging between branch columns).
      newSucursal?: string | null,
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
      setEvents((prev) =>
        prev.map((ev) => (ev.id === event.id ? { ...ev, start: s, end: e, allDay, sucursal } : ev)),
      )
      await updateCalendarEvent(event.id, {
        title: event.title,
        start: s,
        end: e,
        allDay,
        status: event.status,
        charged: event.charged,
        patientId: event.patientId,
        professionalId: event.professionalId,
        sucursal,
        treatmentSlug: event.treatmentSlug,
      })
      reload()
    },
    [reload],
  )

  const onEventDrop = useCallback<
    NonNullable<withDragAndDropProps<CalendarEvent>['onEventDrop']>
  >(
    ({ event, start, end, isAllDay, resourceId }) => {
      // In branch-columns mode the drop target's resourceId is the new sucursal.
      const newSucursal =
        resourceMode && resourceId != null
          ? resourceId === NONE_RESOURCE
            ? null
            : String(resourceId)
          : undefined
      void persistMove(event, new Date(start), new Date(end), !!isAllDay, newSucursal)
    },
    [persistMove, resourceMode],
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
            <select
              value={professionalFilter}
              onChange={(e) => setProfessionalFilter(e.target.value)}
              className='pl-2.5 pr-9 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'>
              <option value=''>{t('agendaCal.allProfessionals')}</option>
              {professionals.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
        {/* Columns-by-branch toggle: switches the Day view into one column per
            sucursal so a turno can be dragged between branches to reassign it. */}
        <label className='flex items-center gap-2 cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={resourceMode}
            onChange={(e) => setResourceMode(e.target.checked)}
            className='h-4 w-4 rounded border-border dark:border-darkborder text-primary focus:ring-primary'
          />
          <Icon icon='solar:layers-minimalistic-line-duotone' height={16} width={16} className='text-link dark:text-darklink' />
          <span className='text-xs font-medium text-link dark:text-darklink'>{t('agenda.bySucursal')}</span>
        </label>
      </div>

      <DnDCalendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor='start'
        endAccessor='end'
        view={resourceMode ? Views.DAY : view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        {...(resourceMode && {
          resources: sucursalResources,
          resourceIdAccessor: (item: object) =>
            (item as { resourceId?: string }).resourceId ?? NONE_RESOURCE,
          resourceTitleAccessor: (item: object) =>
            (item as { resourceTitle?: string }).resourceTitle ?? '',
        })}
        selectable
        popup
        resizable
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        dayPropGetter={dayPropGetter}
        slotPropGetter={slotPropGetter}
        messages={messages}
        style={{ height: 720 }}
        eventPropGetter={(event: CalendarEvent) => ({
          // Full background = STATUS; thin left bar = TREATMENT (Andrés' scheme).
          style: {
            backgroundColor: STATUS_COLORS[event.status],
            color: '#ffffff',
            border: 'none',
            borderLeft: `5px solid ${
              event.treatmentSlug ? getTreatmentColorBySlug(event.treatmentSlug).hex : 'rgba(255,255,255,0.5)'
            }`,
          },
        })}
        components={{
          toolbar: (props) => (
            <Toolbar
              label={props.label}
              view={props.view}
              onView={props.onView}
              onNavigate={props.onNavigate}
              onAdd={() => openAdd()}
              t={t}
            />
          ),
          event: ({ event }: { event: CalendarEvent }) => (
            // Title on the left; "$" pushed to the right as an extra charge mark
            // (does not replace the status, which the full background encodes).
            <span className='flex items-center justify-between gap-1 w-full'>
              <span className='truncate'>
                {isExpiredReserva(event) && <span title={t('agendaCal.expiredMark')}>⏳ </span>}
                {event.title}
              </span>
              {event.charged && (
                <span className='font-bold shrink-0' title={t('agenda.charged')}>$</span>
              )}
            </span>
          ),
        }}
      />

      {draft && (
        <EventDialog
          draft={draft}
          treatments={treatments}
          professionals={professionals}
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
