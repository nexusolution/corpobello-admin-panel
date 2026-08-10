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
  EVENT_COLORS,
  DEFAULT_EVENT_COLOR,
  type CalendarEvent,
} from '@/lib/data/calendar-events'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar-theme.css'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// ── date <-> <input type="date"> helpers (local, never UTC — avoids day shift) ─
function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// All-day span: start at 00:00, end at 23:59:59.999 of the chosen last day so
// react-big-calendar renders the event through that day inclusively.
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
  // Pill button groups matching the reference design: fully-rounded outline in
  // the primary tint, thin dividers, active view filled solid primary.
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

// A modern date field: a styled trigger + a shadcn/react-day-picker calendar in
// a popover, replacing the browser's native (and ugly) <input type="date">.
// Value is a 'YYYY-MM-DD' string; the popover selects/returns the same.
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

// ── Add / edit modal ─────────────────────────────────────────────────────────
type Draft = {
  id: string | null
  title: string
  startStr: string
  endStr: string
  color: string
}

function EventDialog({
  draft,
  onClose,
  onSaved,
  t,
}: {
  draft: Draft
  onClose: () => void
  onSaved: () => void
  t: TFn
}) {
  const [title, setTitle] = useState(draft.title)
  const [startStr, setStartStr] = useState(draft.startStr)
  const [endStr, setEndStr] = useState(draft.endStr)
  const [color, setColor] = useState(draft.color)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = draft.id !== null
  const valid = title.trim().length > 0 && !!startStr && !!endStr && endStr >= startStr

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    const input = {
      title: title.trim(),
      start: startOfDay(startStr),
      end: endOfDay(endStr),
      allDay: true,
      color,
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
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'
      onClick={onClose}>
      <div
        className='w-full max-w-md rounded-xl bg-card p-6 shadow-xl'
        onClick={(e) => e.stopPropagation()}>
        <div className='flex items-start justify-between mb-1'>
          <h3 className='text-lg font-semibold text-dark dark:text-white'>
            {isEdit ? t('agendaCal.editTitle') : t('agendaCal.addTitle')}
          </h3>
          <button
            type='button'
            onClick={onClose}
            aria-label={t('agendaCal.cancel')}
            className='text-link dark:text-darklink hover:text-primary transition-colors'>
            <Icon icon='tabler:x' height={20} width={20} />
          </button>
        </div>
        <p className='text-xs text-link dark:text-darklink mb-4'>{t('agendaCal.addSubtitle')}</p>

        <div className='space-y-4'>
          <label className='block'>
            <span className='text-xs font-medium text-dark dark:text-white'>{t('agendaCal.fieldTitle')}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('agendaCal.fieldTitlePlaceholder')}
              autoFocus
              className='mt-1 w-full rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
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

          <div>
            <span className='text-xs font-medium text-dark dark:text-white'>{t('agendaCal.fieldColor')}</span>
            <div className='mt-2 flex items-center gap-2.5'>
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.key}
                  type='button'
                  onClick={() => setColor(c.hex)}
                  aria-label={c.key}
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform ${
                    color === c.hex ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : ''
                  }`}
                  style={{ backgroundColor: c.hex, boxShadow: color === c.hex ? `0 0 0 2px ${c.hex}` : undefined }}>
                  {color === c.hex && <Icon icon='tabler:check' height={15} width={15} className='text-white' />}
                </button>
              ))}
            </div>
          </div>

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

  // moment drives the localizer + the toolbar label locale.
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
  }, [reload])

  const openAdd = useCallback((start?: Date, end?: Date) => {
    const s = start ?? new Date()
    const e = end ?? s
    setDraft({
      id: null,
      title: '',
      startStr: toDateInput(s),
      endStr: toDateInput(e),
      color: DEFAULT_EVENT_COLOR,
    })
  }, [])

  const onSelectSlot = useCallback(
    (slot: SlotInfo) => {
      // Month single-day select gives end = next day 00:00 → step back a day for
      // the inclusive end date shown in the modal.
      const end = new Date(slot.end.getTime() - 1)
      openAdd(slot.start, end < slot.start ? slot.start : end)
    },
    [openAdd],
  )

  const onSelectEvent = useCallback((ev: CalendarEvent) => {
    setDraft({
      id: ev.id,
      title: ev.title,
      startStr: toDateInput(ev.start),
      endStr: toDateInput(ev.end),
      color: ev.color,
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
            backgroundColor: event.color,
            borderColor: event.color,
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
        }}
      />

      {draft && (
        <EventDialog
          draft={draft}
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
