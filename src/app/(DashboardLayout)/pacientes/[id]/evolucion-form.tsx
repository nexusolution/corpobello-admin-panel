'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Swal from 'sweetalert2'
import moment from 'moment'
import { es } from 'date-fns/locale'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import {
  createEvolucion,
  updateEvolucion,
  closeEvolucion,
  uploadEvolucionPhoto,
  deleteEvolucionMedia,
  type Evolucion,
  type EvolucionPhoto,
} from '@/lib/data/evoluciones'
import { getCurrentUserId } from '@/lib/data/calendar-events'
import { generateComprobante } from '@/lib/data/comprobante-pdf'
import { Icon } from '@iconify/react'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }

const FIELD_CLS =
  'w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

// This form is a Radix Dialog, which (via react-remove-scroll) sets
// `pointer-events: none` on <body>. Because pointer-events is inherited, a
// SweetAlert2 popup opened over the dialog becomes un-clickable and clicks fall
// through to the dialog behind it. Re-enable pointer events on the Swal container
// so the alert works and blocks the form (Andrés bug 2026-09-24).
const SWAL_OVER_DIALOG = {
  didOpen: () => {
    const c = Swal.getContainer()
    if (c) c.style.pointerEvents = 'auto'
  },
}

// Label with a leading icon for a friendlier, scannable form.
function FieldLabel({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <label className='flex items-center gap-1.5 text-xs font-medium text-dark dark:text-white mb-1'>
      <Icon icon={icon} height={14} width={14} className='text-link dark:text-darklink' />
      {children}
    </label>
  )
}

// Native select styled with a single chevron (hides the OS default arrow).
function SelectField({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <div className='relative'>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_CLS} appearance-none pr-9 cursor-pointer`}>
        {children}
      </select>
      <Icon
        icon='solar:alt-arrow-down-line-duotone'
        height={16}
        width={16}
        className='pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-link dark:text-darklink'
      />
    </div>
  )
}

function dateToInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Popover date picker (localised, DD MMM YYYY) — replaces the native mm/dd/yyyy
// input so the format is consistent and the control is friendlier.
function DateField({
  value,
  onChange,
  locale,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  locale: string
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type='button' className={`${FIELD_CLS} flex items-center justify-between gap-2 text-left`}>
          <span className={date ? '' : 'text-link dark:text-darklink'}>
            {date ? moment(date).format('DD MMM YYYY') : placeholder}
          </span>
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
          locale={locale === 'es' ? es : undefined}
          onSelect={(d: Date | undefined) => {
            if (!d) return
            onChange(dateToInput(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function isoToDateInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dateInputToIso(dateStr: string): string | undefined {
  if (!dateStr) return undefined
  return new Date(`${dateStr}T00:00:00`).toISOString()
}
function todayInput(): string {
  return isoToDateInput(new Date().toISOString())
}
// Base date (the session date, or today) plus N months → date input value.
function addMonthsToInput(baseDate: string, n: number): string {
  const base = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date()
  base.setMonth(base.getMonth() + n)
  return isoToDateInput(base.toISOString())
}

// Create a draft evolution or edit an existing one, then optionally sign+close.
export function EvolucionForm({
  open,
  onClose,
  onSaved,
  patientId,
  evolucion,
  prefill,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  patientId: string
  evolucion: Evolucion | null
  // Pre-fill for a NEW evolution: opened from an agenda turno (links the turno),
  // or "copiar de anterior" (carries the previous ficha's clinical content so
  // the profesional only edits what changed). Photos are never copied.
  prefill?: {
    treatmentSlug?: string
    professionalId?: string
    calendarEventId?: string
    sessionDate?: string
    notes?: string
    nextFollowup?: string
  }
}) {
  const { t, locale } = useTranslation() as { t: TFn; locale: string }
  const { role } = useCurrentUser()
  const isProfesional = role === 'profesional'
  const editing = !!evolucion

  const [treatments, setTreatments] = useState<Option[]>([])
  const [professionals, setProfessionals] = useState<Option[]>([])
  const [treatmentSlug, setTreatmentSlug] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [notes, setNotes] = useState('')
  const [nextFollowup, setNextFollowup] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingPhotos, setExistingPhotos] = useState<EvolucionPhoto[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  // The agenda turno this evolution closes (links agenda ↔ ficha). Kept in
  // state so a new-from-turno evolution carries it into createEvolucion.
  const [calendarEventId, setCalendarEventId] = useState<string | null>(null)

  // Lookups + field init whenever the dialog opens for a (new/edit) record.
  useEffect(() => {
    if (!open) return
    void fetchTreatmentPrices().then(({ data }) =>
      setTreatments(data.map((p) => ({ value: p.slug, label: p.displayName }))),
    )
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: u.fullName })),
      ),
    )
    setTreatmentSlug(evolucion?.treatmentSlug ?? prefill?.treatmentSlug ?? '')
    setSessionDate(
      evolucion
        ? isoToDateInput(evolucion.sessionDate)
        : prefill?.sessionDate
          ? isoToDateInput(prefill.sessionDate)
          : todayInput(),
    )
    setNotes(evolucion?.notes ?? prefill?.notes ?? '')
    setNextFollowup(evolucion?.nextFollowup ?? prefill?.nextFollowup ?? '')
    setExistingPhotos(evolucion?.photos ?? [])
    setNewFiles([])
    setCalendarEventId(evolucion?.calendarEventId ?? prefill?.calendarEventId ?? null)
    // A profesional can only file their own record (RLS) — lock it to them.
    if (isProfesional) {
      void getCurrentUserId().then((uid) => setProfessionalId(uid ?? ''))
    } else {
      setProfessionalId(evolucion?.professionalId ?? prefill?.professionalId ?? '')
    }
  }, [open, evolucion, isProfesional])

  function draft() {
    return {
      patientId,
      treatmentSlug: treatmentSlug || null,
      professionalId: professionalId || null,
      calendarEventId: calendarEventId || null,
      sessionDate: dateInputToIso(sessionDate),
      notes: notes.trim() || null,
      nextFollowup: nextFollowup || null,
    }
  }

  // Persist (create or update) and return the record id, or null on error.
  async function persist(): Promise<string | null> {
    if (editing && evolucion) {
      const { error } = await updateEvolucion(evolucion.id, draft())
      if (error) {
        await Swal.fire({ icon: 'error', title: t('ficha.form.saveError'), text: error, ...SWAL_OVER_DIALOG })
        return null
      }
      return evolucion.id
    }
    const { id, error } = await createEvolucion(draft())
    if (error || !id) {
      await Swal.fire({ icon: 'error', title: t('ficha.form.saveError'), text: error ?? '', ...SWAL_OVER_DIALOG })
      return null
    }
    return id
  }

  // Upload any newly staged photos against the (now persisted) evolution.
  async function uploadStagedPhotos(id: string) {
    for (const file of newFiles) {
      await uploadEvolucionPhoto(id, file)
    }
  }

  async function removeExistingPhoto(photo: EvolucionPhoto) {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    await deleteEvolucionMedia(photo.id, photo.storagePath)
  }

  async function handleSaveDraft() {
    setSaving(true)
    const id = await persist()
    if (id) await uploadStagedPhotos(id)
    setSaving(false)
    if (id) {
      onSaved()
      onClose()
    }
  }

  async function handleSignClose() {
    const confirm = await Swal.fire({
      ...SWAL_OVER_DIALOG,
      icon: 'question',
      title: t('ficha.form.closeConfirmTitle'),
      text: t('ficha.form.closeConfirmText'),
      showCancelButton: true,
      confirmButtonText: t('ficha.form.close'),
      cancelButtonText: t('ficha.form.cancel'),
      confirmButtonColor: '#5d87ff',
    })
    if (!confirm.isConfirmed) return
    setSaving(true)
    const id = await persist()
    if (id) {
      await uploadStagedPhotos(id)
      const { error } = await closeEvolucion(id)
      if (error) {
        setSaving(false)
        await Swal.fire({ icon: 'error', title: t('ficha.form.saveError'), text: error, ...SWAL_OVER_DIALOG })
        return
      }
      // Generate + store the signed comprobante PDF (best-effort — the session
      // is already closed even if the PDF fails; it can be regenerated).
      await generateComprobante(id)
    }
    setSaving(false)
    if (id) {
      onSaved()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {editing ? t('ficha.form.editTitle') : t('ficha.form.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-3'>
          <div>
            <FieldLabel icon='solar:hand-heart-line-duotone'>{t('ficha.form.treatment')}</FieldLabel>
            <SelectField value={treatmentSlug} onChange={setTreatmentSlug}>
              <option value=''>{t('ficha.form.none')}</option>
              {treatments.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>

          {!isProfesional && (
            <div>
              <FieldLabel icon='solar:user-rounded-line-duotone'>{t('ficha.form.professional')}</FieldLabel>
              <SelectField value={professionalId} onChange={setProfessionalId}>
                <option value=''>{t('ficha.form.none')}</option>
                {professionals.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectField>
            </div>
          )}

          <div>
            <FieldLabel icon='solar:calendar-mark-line-duotone'>{t('ficha.form.date')}</FieldLabel>
            <DateField
              value={sessionDate}
              onChange={setSessionDate}
              locale={locale}
              placeholder={t('turno.chooseDate')}
            />
          </div>

          <div>
            <FieldLabel icon='solar:notebook-line-duotone'>{t('ficha.form.notes')}</FieldLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className={FIELD_CLS}
              placeholder={t('ficha.form.notesPlaceholder')}
            />
          </div>

          <div>
            <FieldLabel icon='solar:gallery-line-duotone'>{t('ficha.form.photos')}</FieldLabel>
            <div className='flex flex-wrap gap-2'>
              {existingPhotos.map((p) => (
                <div
                  key={p.id}
                  className='relative h-20 w-20 rounded-md overflow-hidden border border-border dark:border-darkborder'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt='' className='h-full w-full object-cover' />
                  <button
                    type='button'
                    onClick={() => void removeExistingPhoto(p)}
                    className='absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-black/60 text-white'>
                    <Icon icon='tabler:x' height={12} width={12} />
                  </button>
                </div>
              ))}
              {newFiles.map((f, i) => (
                <div
                  key={i}
                  className='relative h-20 w-20 rounded-md overflow-hidden border border-border dark:border-darkborder'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(f)}
                    alt=''
                    className='h-full w-full object-cover'
                  />
                  <button
                    type='button'
                    onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                    className='absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-black/60 text-white'>
                    <Icon icon='tabler:x' height={12} width={12} />
                  </button>
                </div>
              ))}
              <label className='h-20 w-20 flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border dark:border-darkborder cursor-pointer text-link dark:text-darklink hover:border-primary hover:text-primary transition-colors'>
                <Icon icon='tabler:camera-plus' height={18} width={18} />
                <span className='text-[10px] text-center leading-tight'>{t('ficha.form.addPhoto')}</span>
                <input
                  type='file'
                  accept='image/*'
                  multiple
                  className='hidden'
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    setNewFiles((prev) => [...prev, ...files])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <FieldLabel icon='solar:calendar-date-line-duotone'>{t('ficha.form.followup')}</FieldLabel>
            <div className='flex flex-wrap items-center gap-2 mb-2'>
              {[3, 6, 12].map((m) => {
                const active = nextFollowup === addMonthsToInput(sessionDate, m)
                return (
                  <button
                    key={m}
                    type='button'
                    onClick={() => setNextFollowup(addMonthsToInput(sessionDate, m))}
                    className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-lightprimary text-primary'
                        : 'border-border dark:border-darkborder text-dark dark:text-white hover:border-primary hover:text-primary'
                    }`}>
                    {t('ficha.form.months', { n: String(m) })}
                  </button>
                )
              })}
              {nextFollowup && (
                <button
                  type='button'
                  onClick={() => setNextFollowup('')}
                  className='inline-flex items-center gap-1 text-xs text-link dark:text-darklink hover:text-error'>
                  <Icon icon='tabler:x' height={12} width={12} />
                  {t('ficha.form.clear')}
                </button>
              )}
            </div>
            <DateField
              value={nextFollowup}
              onChange={setNextFollowup}
              locale={locale}
              placeholder={t('turno.chooseDate')}
            />
          </div>
        </div>

        <div className='mt-4 flex items-center justify-end gap-2'>
          <button
            type='button'
            onClick={handleSaveDraft}
            disabled={saving}
            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border border-border dark:border-darkborder text-dark dark:text-white hover:border-primary disabled:opacity-50 transition-colors'>
            <Icon icon='solar:diskette-line-duotone' height={16} width={16} />
            {t('ficha.form.saveDraft')}
          </button>
          <button
            type='button'
            onClick={handleSignClose}
            disabled={saving}
            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors'>
            <Icon icon='solar:check-circle-line-duotone' height={16} width={16} />
            {t('ficha.form.close')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
