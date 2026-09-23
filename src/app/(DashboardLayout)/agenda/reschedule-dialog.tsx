'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import moment from 'moment'
import { es } from 'date-fns/locale'

import { Calendar as DatePickerCalendar } from '@/components/ui/calendar'
import { SUCURSALES } from '@/lib/data/calendar-events'
import {
  availableStartTimes,
  compatibleSucursalesOn,
  minToHHMM,
  type RescheduleCtx,
} from '@/lib/scheduling/reschedule'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const SUC_COLOR: Record<string, string> = {
  caballito: '#2563eb', // azul
  merlo: '#14b8a6', // verde
  moreno: '#f59e0b', // naranja
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export type RescheduleTurno = {
  id: string
  patientName: string
  treatmentSlug: string
  professionalId: string | undefined
  sucursal: string
  start: Date
  end: Date
}

// Contextual reschedule (Andrés punto 19-E/F): a calendar coloured by the
// professional's real compatible availability (per sucursal), free time slots for
// the chosen day, and a before/after summary. Keeps the turno untouched until the
// move is confirmed. Cross-month friendly (no need to drag across months).
export function RescheduleDialog({
  turno,
  durationMin,
  ctx,
  sucursalLabel,
  treatmentLabel,
  professionalLabel,
  onClose,
  onConfirm,
  onViewDay,
  t,
  locale,
}: {
  turno: RescheduleTurno
  durationMin: number
  ctx: RescheduleCtx
  sucursalLabel: (s: string) => string
  treatmentLabel: string
  professionalLabel: string
  onClose: () => void
  // Persist the move (also handles the confirm summary + undo in the parent).
  onConfirm: (next: { dateStr: string; startTime: string; endTime: string; sucursal: string }) => void
  // Open Vista Día on that date keeping this turno's context (optional).
  onViewDay?: (dateStr: string) => void
  t: TFn
  locale: string
}) {
  const [selected, setSelected] = useState<Date | undefined>(undefined)
  const [pickedTime, setPickedTime] = useState<string>('')

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const originalTime = `${pad2(turno.start.getHours())}:${pad2(turno.start.getMinutes())}`

  // The sucursal the professional resolves to on a day (current one if compatible,
  // else the first compatible branch). null = no compatible availability that day.
  const resolvedSucFor = useMemo(
    () => (day: Date): string | null => {
      const list = compatibleSucursalesOn(toDateStr(day), turno.professionalId, turno.treatmentSlug, SUCURSALES, ctx)
      if (list.length === 0) return null
      return list.includes(turno.sucursal) ? turno.sucursal : list[0]!
    },
    [ctx, turno.professionalId, turno.treatmentSlug, turno.sucursal],
  )

  const targetSucursal = selected ? resolvedSucFor(selected) : null
  const selectedStr = selected ? toDateStr(selected) : ''

  const slots = useMemo(() => {
    if (!selected || !targetSucursal) return []
    return availableStartTimes(
      selectedStr,
      targetSucursal,
      turno.professionalId,
      turno.treatmentSlug,
      durationMin,
      turno.id,
      ctx,
    )
  }, [selected, selectedStr, targetSucursal, turno.professionalId, turno.treatmentSlug, turno.id, durationMin, ctx])

  const originalStillFree = slots.includes(originalTime)

  function onSelectDate(d: Date | undefined) {
    setSelected(d)
    if (!d) {
      setPickedTime('')
      return
    }
    // Keep the original time if it is still free that day; else clear it.
    const suc = resolvedSucFor(d)
    const daySlots = suc
      ? availableStartTimes(toDateStr(d), suc, turno.professionalId, turno.treatmentSlug, durationMin, turno.id, ctx)
      : []
    setPickedTime(daySlots.includes(originalTime) ? originalTime : '')
  }

  function endFrom(startTime: string): string {
    const [h, m] = startTime.split(':').map((x) => parseInt(x, 10))
    const endMin = (h || 0) * 60 + (m || 0) + durationMin
    return minToHHMM(endMin)
  }

  function confirm() {
    if (!selected || !targetSucursal || !pickedTime) return
    onConfirm({
      dateStr: selectedStr,
      startTime: pickedTime,
      endTime: endFrom(pickedTime),
      sucursal: targetSucursal,
    })
  }

  // react-day-picker function matchers: colour by resolved sucursal, disable days
  // with no compatible availability and days before today.
  const modifiers = {
    sucCaballito: (d: Date) => resolvedSucFor(d) === 'caballito',
    sucMerlo: (d: Date) => resolvedSucFor(d) === 'merlo',
    sucMoreno: (d: Date) => resolvedSucFor(d) === 'moreno',
  }
  const modifiersStyles = {
    sucCaballito: { boxShadow: `inset 0 -3px 0 ${SUC_COLOR.caballito}` },
    sucMerlo: { boxShadow: `inset 0 -3px 0 ${SUC_COLOR.merlo}` },
    sucMoreno: { boxShadow: `inset 0 -3px 0 ${SUC_COLOR.moreno}` },
  }
  const disabled = (d: Date) => d < today || resolvedSucFor(d) === null

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4' onClick={onClose}>
      <div
        className='w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-darkgray shadow-xl'
        onClick={(e) => e.stopPropagation()}>
        <div className='flex items-center justify-between border-b border-border dark:border-darkborder px-4 py-3'>
          <h3 className='text-base font-semibold text-dark dark:text-white'>{t('reschedule.title')}</h3>
          <button type='button' onClick={onClose} className='text-link dark:text-darklink hover:text-primary'>
            <Icon icon='tabler:x' height={18} width={18} />
          </button>
        </div>

        <div className='px-4 py-3 space-y-4'>
          {/* Current turno summary */}
          <div className='rounded-md bg-lightprimary/30 dark:bg-white/[0.03] px-3 py-2 text-sm'>
            <p className='font-medium text-dark dark:text-white'>{turno.patientName}</p>
            <p className='text-link dark:text-darklink text-xs mt-0.5'>
              {treatmentLabel} · {professionalLabel} · {sucursalLabel(turno.sucursal)}
            </p>
            <p className='text-link dark:text-darklink text-xs'>
              {t('reschedule.current')}: {moment(turno.start).format('DD MMM YYYY')} · {originalTime} {t('reschedule.to')}{' '}
              {`${pad2(turno.end.getHours())}:${pad2(turno.end.getMinutes())}`}
            </p>
          </div>

          <div className='flex flex-col gap-4 md:flex-row'>
            {/* Calendar */}
            <div className='md:shrink-0'>
              <DatePickerCalendar
                mode='single'
                selected={selected}
                onSelect={onSelectDate}
                defaultMonth={turno.start}
                captionLayout='dropdown'
                startMonth={new Date(2024, 0)}
                endMonth={new Date(2035, 11)}
                disabled={disabled}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                locale={locale === 'es' ? es : undefined}
              />
              <div className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-link dark:text-darklink'>
                <span className='inline-flex items-center gap-1'>
                  <span className='h-2.5 w-2.5 rounded-sm' style={{ background: SUC_COLOR.caballito }} /> Caballito
                </span>
                <span className='inline-flex items-center gap-1'>
                  <span className='h-2.5 w-2.5 rounded-sm' style={{ background: SUC_COLOR.merlo }} /> Merlo
                </span>
                <span className='inline-flex items-center gap-1'>
                  <span className='h-2.5 w-2.5 rounded-sm' style={{ background: SUC_COLOR.moreno }} /> Moreno
                </span>
                <span className='text-link/70 dark:text-darklink/70'>{t('reschedule.legendNone')}</span>
              </div>
            </div>

            {/* Slots */}
            <div className='flex-1 min-w-0'>
              {!selected ? (
                <p className='text-sm text-link dark:text-darklink italic'>{t('reschedule.pickDate')}</p>
              ) : (
                <div className='space-y-2'>
                  <p className='text-sm font-medium text-dark dark:text-white'>
                    {moment(selected).format('DD MMM YYYY')}
                    {targetSucursal && (
                      <span className='ml-2 text-xs font-normal text-link dark:text-darklink'>
                        {sucursalLabel(targetSucursal)}
                        {targetSucursal !== turno.sucursal && ` · ${t('reschedule.sucursalChanges')}`}
                      </span>
                    )}
                  </p>
                  {slots.length === 0 ? (
                    <p className='text-sm text-link dark:text-darklink italic'>{t('reschedule.noSlots')}</p>
                  ) : (
                    <>
                      {!originalStillFree && (
                        <p className='text-[11px] text-error'>{t('reschedule.originalTaken')}</p>
                      )}
                      <div className='flex flex-wrap gap-1.5'>
                        {slots.map((s) => (
                          <button
                            key={s}
                            type='button'
                            onClick={() => setPickedTime(s)}
                            className={`px-2.5 py-1.5 rounded-md border text-sm transition-colors ${
                              pickedTime === s
                                ? 'border-primary bg-lightprimary text-primary font-semibold'
                                : 'border-border dark:border-darkborder text-dark dark:text-white hover:border-primary'
                            }`}>
                            {s}
                            {s === originalTime && (
                              <span className='ml-1 text-[10px] text-link dark:text-darklink'>
                                ({t('reschedule.same')})
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {onViewDay && (
                    <button
                      type='button'
                      onClick={() => onViewDay(selectedStr)}
                      className='mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline'>
                      <Icon icon='solar:calendar-search-line-duotone' height={14} width={14} />
                      {t('reschedule.viewDay')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Before / after summary */}
          {selected && targetSucursal && pickedTime && (
            <div className='rounded-md border border-border dark:border-darkborder px-3 py-2 text-sm'>
              <p className='text-xs font-semibold uppercase tracking-wide text-link dark:text-darklink mb-1'>
                {t('reschedule.summary')}
              </p>
              <p className='text-link dark:text-darklink text-xs'>
                {t('reschedule.from')}: {moment(turno.start).format('DD MMM YYYY')} · {originalTime} ·{' '}
                {sucursalLabel(turno.sucursal)}
              </p>
              <p className='text-dark dark:text-white text-xs font-medium'>
                {t('reschedule.toLabel')}: {moment(selected).format('DD MMM YYYY')} · {pickedTime} ·{' '}
                {sucursalLabel(targetSucursal)}
              </p>
            </div>
          )}
        </div>

        <div className='flex items-center justify-end gap-2 border-t border-border dark:border-darkborder px-4 py-3'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm text-dark dark:text-white hover:border-primary'>
            {t('reschedule.cancel')}
          </button>
          <button
            type='button'
            onClick={confirm}
            disabled={!selected || !targetSucursal || !pickedTime}
            className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50'>
            {t('reschedule.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
