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
  TURNO_STATUSES,
  STATUS_COLORS,
  SUCURSALES,
  type CalendarEvent,
  type TurnoStatus,
  type PatientOption,
} from '@/lib/data/calendar-events'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar-theme.css'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }

// Map a turno status to its shared translation key (reuse the agenda.status.*).
const STATUS_KEY: Record<TurnoStatus, TranslationKey> = {
  pendiente: 'agenda.status.pending',
  confirmado: 'agenda.status.confirmed',
  atendido: 'agenda.status.attended',
  cancelado: 'agenda.status.cancelled',
}

function sucursalLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

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
  const { locale } = useTranslation()
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
            <span>{date ? moment(date).format('DD MMM YYYY') : '—'}</span>
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
              <div className='px-3 py-2 text-xs text-link dark:text-darklink'>…</div>
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
  startStr: string
  endStr: string
}

const SELECT_CLS =
  'mt-1 w-full pl-2.5 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

function EventDialog({
  draft,
  treatments,
  professionals,
  onClose,
  onSaved,
  t,
}: {
  draft: Draft
  treatments: Option[]
  professionals: Option[]
  onClose: () => void
  onSaved: () => void
  t: TFn
}) {
  const [patientId, setPatientId] = useState(draft.patientId)
  const [patientName, setPatientName] = useState(draft.patientName)
  const [treatmentSlug, setTreatmentSlug] = useState(draft.treatmentSlug)
  const [professionalId, setProfessionalId] = useState(draft.professionalId)
  const [sucursal, setSucursal] = useState(draft.sucursal)
  const [status, setStatus] = useState<TurnoStatus>(draft.status)
  const [charged, setCharged] = useState(draft.charged)
  const [startStr, setStartStr] = useState(draft.startStr)
  const [endStr, setEndStr] = useState(draft.endStr)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = draft.id !== null
  const valid = !!patientId && !!startStr && !!endStr && endStr >= startStr

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    const input = {
      title: patientName ?? 'Turno',
      start: startOfDay(startStr),
      end: endOfDay(endStr),
      allDay: true,
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
                  <option key={s} value={s}>{t(STATUS_KEY[s])}</option>
                ))}
              </select>
            </label>
          </div>

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

          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={charged}
              onChange={(e) => setCharged(e.target.checked)}
              className='h-4 w-4 rounded border-border dark:border-darkborder accent-success'
            />
            <span className='text-sm text-dark dark:text-white'>{t('turno.charged')}</span>
          </label>

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

// ── Main view ─────────────────────────────────────────────────────────────────
export function CalendarView() {
  const { t, locale } = useTranslation()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>(Views.MONTH)
  const [date, setDate] = useState<Date>(() => new Date())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [treatments, setTreatments] = useState<Option[]>([])
  const [professionals, setProfessionals] = useState<Option[]>([])

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
  }, [reload])

  const openAdd = useCallback((start?: Date, end?: Date) => {
    const s = start ?? new Date()
    const e = end ?? s
    setDraft({
      id: null,
      patientId: null,
      patientName: null,
      treatmentSlug: '',
      professionalId: '',
      sucursal: '',
      status: 'pendiente',
      charged: false,
      startStr: toDateInput(s),
      endStr: toDateInput(e),
    })
  }, [])

  const onSelectSlot = useCallback(
    (slot: SlotInfo) => {
      const end = new Date(slot.end.getTime() - 1)
      openAdd(slot.start, end < slot.start ? slot.start : end)
    },
    [openAdd],
  )

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
      startStr: toDateInput(ev.start),
      endStr: toDateInput(ev.end),
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
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor='start'
        endAccessor='end'
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        selectable
        popup
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        messages={messages}
        style={{ height: 720 }}
        eventPropGetter={(event: CalendarEvent) => ({
          style: {
            backgroundColor: STATUS_COLORS[event.status],
            borderColor: STATUS_COLORS[event.status],
            color: '#ffffff',
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
            <span className='truncate'>
              {event.charged && <span className='font-bold'>$ </span>}
              {event.title}
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
          t={t}
        />
      )}
    </div>
  )
}

export default CalendarView
