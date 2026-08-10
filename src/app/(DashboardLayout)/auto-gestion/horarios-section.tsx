'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  fetchSucursalHours,
  saveSucursalHours,
  SUCURSALES,
  type Sucursal,
  type DayHours,
} from '@/lib/data/sucursal-hours'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const WEEKDAY_KEY: Record<number, TranslationKey> = {
  0: 'autoGestion.horarios.sun',
  1: 'autoGestion.horarios.mon',
  2: 'autoGestion.horarios.tue',
  3: 'autoGestion.horarios.wed',
  4: 'autoGestion.horarios.thu',
  5: 'autoGestion.horarios.fri',
  6: 'autoGestion.horarios.sat',
}

function sucursalLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function HorariosSection() {
  const { t } = useTranslation()
  const [sucursal, setSucursal] = useState<Sucursal>('caballito')
  const [days, setDays] = useState<DayHours[]>([])
  const [base, setBase] = useState<DayHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchSucursalHours(sucursal).then((d) => {
      if (!active) return
      setDays(d)
      setBase(d)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [sucursal])

  const dirty = useMemo(() => JSON.stringify(days) !== JSON.stringify(base), [days, base])

  function patchDay(weekday: number, p: Partial<DayHours>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...p } : d)))
  }

  async function save() {
    setSaving(true)
    setError(false)
    const err = await saveSucursalHours(sucursal, days)
    setSaving(false)
    if (err) {
      setError(true)
      setTimeout(() => setError(false), 1800)
      return
    }
    setBase(days)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='mb-4'>
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.horarios.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.horarios.subtitle')}</p>
      </div>

      {/* Sucursal sub-toggle */}
      <div className='inline-flex rounded-md border border-border dark:border-darkborder p-0.5 mb-5'>
        {SUCURSALES.map((s) => (
          <button
            key={s}
            type='button'
            onClick={() => setSucursal(s)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              sucursal === s ? 'bg-primary text-white' : 'text-link dark:text-darklink hover:text-primary'
            }`}>
            {sucursalLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className='py-10 flex justify-center'>
          <Icon icon='tabler:loader-2' height={26} width={26} className='text-primary animate-spin' />
        </div>
      ) : (
        <div className='space-y-2'>
          {days.map((d) => (
            <div
              key={d.weekday}
              className='flex items-center gap-3 rounded-md border border-border dark:border-darkborder px-3 py-2.5 flex-wrap'>
              <span className='w-24 shrink-0 text-sm font-medium text-dark dark:text-white'>
                {t(WEEKDAY_KEY[d.weekday])}
              </span>

              <label className='inline-flex items-center gap-2 cursor-pointer select-none w-28 shrink-0'>
                <input
                  type='checkbox'
                  checked={d.isOpen}
                  onChange={(e) => patchDay(d.weekday, { isOpen: e.target.checked })}
                  className='h-4 w-4 rounded border-border dark:border-darkborder accent-primary'
                />
                <span className={`text-sm ${d.isOpen ? 'text-success' : 'text-link dark:text-darklink'}`}>
                  {d.isOpen ? t('autoGestion.horarios.open') : t('autoGestion.horarios.closed')}
                </span>
              </label>

              {d.isOpen ? (
                <div className='flex items-center gap-2'>
                  <input
                    type='time'
                    value={d.open}
                    onChange={(e) => patchDay(d.weekday, { open: e.target.value })}
                    className='rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
                  />
                  <span className='text-link dark:text-darklink text-sm'>a</span>
                  <input
                    type='time'
                    value={d.close}
                    onChange={(e) => patchDay(d.weekday, { close: e.target.value })}
                    className='rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
                  />
                </div>
              ) : (
                <span className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.horarios.closedDay')}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className='flex items-center justify-end gap-2 flex-wrap pt-4'>
        {dirty && (
          <button
            type='button'
            onClick={() => setDays(base)}
            className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
            {t('autoGestion.cotizadores.reset')}
          </button>
        )}
        <button
          type='button'
          disabled={!dirty || saving}
          onClick={save}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            error
              ? 'bg-lighterror text-error'
              : saved
                ? 'bg-lightsuccess text-success'
                : 'bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed'
          }`}>
          {error
            ? t('autoGestion.cotizadores.failed')
            : saved
              ? t('autoGestion.cotizadores.saved')
              : saving
                ? t('autoGestion.cotizadores.saving')
                : t('autoGestion.cotizadores.save')}
        </button>
      </div>

      <p className='text-xs text-link dark:text-darklink mt-4 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.horarios.note')}
      </p>
    </div>
  )
}
