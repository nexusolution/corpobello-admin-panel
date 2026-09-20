'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import { TimeField } from '@/components/ui/time-field'
import { Switch } from '@/components/ui/switch'
import { SUCURSALES } from '@/lib/data/calendar-events'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import {
  fetchLunch,
  saveLunchConfig,
  deleteLunchConfig,
  type LunchConfig,
} from '@/lib/data/lunch'
import { useTranslation } from '@/lib/i18n/context'

const FIELD =
  'rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function weekdayLabel(wd: number, locale: string): string {
  const es = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const en = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return (locale === 'es' ? es : en)[wd] ?? ''
}
function sucursalLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10))
  return (h || 0) * 60 + (m || 0)
}

function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string | number
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative inline-block ${className ?? ''}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full appearance-none pr-8 ${FIELD}`}>
        {children}
      </select>
      <Icon
        icon='tabler:chevron-down'
        height={15}
        width={15}
        className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-link dark:text-darklink'
      />
    </div>
  )
}

type Professional = { id: string; name: string }

export function AlmuerzosSection() {
  const { t, locale } = useTranslation()
  const [config, setConfig] = useState<LunchConfig[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // New-lunch form.
  const [sucursal, setSucursal] = useState<string>(SUCURSALES[0] ?? 'merlo')
  const [professionalId, setProfessionalId] = useState<string>('')
  const [weekday, setWeekday] = useState<number>(1)
  const [startStr, setStartStr] = useState('13:00')
  const [endStr, setEndStr] = useState('14:00')

  function reload() {
    setLoading(true)
    return fetchLunch().then(({ config }) => {
      setConfig(config)
      setLoading(false)
    })
  }
  useEffect(() => {
    void reload()
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(data.filter((u) => u.status === 'active').map((u) => ({ id: u.id, name: u.fullName }))),
    )
  }, [])

  const nameOf = useMemo(() => {
    const m = new Map(professionals.map((p) => [p.id, p.name]))
    return (id: string | null) => (id ? m.get(id) ?? id : t('autoGestion.lunch.allProfessionals'))
  }, [professionals, t])

  async function add() {
    if (busy) return
    if (hhmmToMin(endStr) <= hhmmToMin(startStr)) {
      return void Swal.fire({ icon: 'warning', title: t('autoGestion.lunch.error'), text: t('autoGestion.lunch.badRange'), width: '360px' })
    }
    setBusy(true)
    const err = await saveLunchConfig({
      sucursal,
      professionalId: professionalId || null,
      weekday,
      startMin: hhmmToMin(startStr),
      endMin: hhmmToMin(endStr),
      active: true,
    })
    setBusy(false)
    if (err) return void Swal.fire({ icon: 'error', title: t('autoGestion.lunch.error'), text: err, width: '360px' })
    await reload()
  }

  async function toggleActive(row: LunchConfig, next: boolean) {
    setConfig((prev) => prev.map((c) => (c.id === row.id ? { ...c, active: next } : c)))
    const err = await saveLunchConfig({ ...row, active: next })
    if (err) await reload()
  }

  async function remove(row: LunchConfig) {
    const res = await Swal.fire({
      icon: 'warning',
      iconColor: '#fa896b',
      title: t('autoGestion.lunch.deleteTitle'),
      showCancelButton: true,
      confirmButtonText: t('autoGestion.lunch.delete'),
      cancelButtonText: t('autoGestion.availability.cancel'),
      confirmButtonColor: '#fa896b',
      width: '360px',
      customClass: { popup: '!rounded-lg', title: '!text-base' },
    })
    if (!res.isConfirmed) return
    const err = await deleteLunchConfig(row.id)
    if (err) return void Swal.fire({ icon: 'error', title: t('autoGestion.lunch.error'), text: err, width: '360px' })
    await reload()
  }

  if (loading) {
    return <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.lunch.loading')}</p>
  }

  return (
    <div className='space-y-5'>
      <div>
        <h3 className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.lunch.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5'>{t('autoGestion.lunch.subtitle')}</p>
      </div>

      {/* New lunch form */}
      <div className='flex flex-wrap items-end gap-3 rounded-md border border-border dark:border-darkborder p-3'>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.lunch.sucursal')}</span>
          <Select value={sucursal} onChange={setSucursal}>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>{sucursalLabel(s)}</option>
            ))}
          </Select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.lunch.professional')}</span>
          <Select value={professionalId} onChange={setProfessionalId}>
            <option value=''>{t('autoGestion.lunch.allProfessionals')}</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.lunch.weekday')}</span>
          <Select value={weekday} onChange={(v) => setWeekday(parseInt(v, 10))}>
            {WEEKDAY_ORDER.map((w) => (
              <option key={w} value={w}>{weekdayLabel(w, locale)}</option>
            ))}
          </Select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.lunch.from')}</span>
          <TimeField className='w-28' value={startStr} onChange={setStartStr} />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.lunch.to')}</span>
          <TimeField className='w-28' value={endStr} onChange={setEndStr} />
        </label>
        <button
          type='button'
          onClick={add}
          disabled={busy}
          className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('autoGestion.lunch.add')}
        </button>
      </div>

      {/* Configured lunches grouped by sucursal */}
      {config.length === 0 ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.lunch.empty')}</p>
      ) : (
        SUCURSALES.filter((s) => config.some((c) => c.sucursal === s)).map((suc) => (
          <div key={suc}>
            <h4 className='text-xs font-semibold uppercase tracking-wide text-link dark:text-darklink mb-2'>
              {sucursalLabel(suc)}
            </h4>
            <div className='rounded-md border border-border dark:border-darkborder divide-y divide-border dark:divide-darkborder'>
              {config
                .filter((c) => c.sucursal === suc)
                .sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday))
                .map((c) => (
                  <div key={c.id} className='flex items-center gap-3 px-3 py-2 text-sm'>
                    <span className='w-24 font-medium text-dark dark:text-white'>{weekdayLabel(c.weekday, locale)}</span>
                    <span className='flex-1 text-link dark:text-darklink truncate'>{nameOf(c.professionalId)}</span>
                    <span className='text-dark dark:text-white whitespace-nowrap'>
                      {minToHHMM(c.startMin)} {t('autoGestion.lunch.to')} {minToHHMM(c.endMin)}
                    </span>
                    <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c, v)} />
                    <button
                      type='button'
                      onClick={() => remove(c)}
                      className='text-error hover:bg-lighterror/50 rounded p-1'
                      title={t('autoGestion.lunch.delete')}>
                      <Icon icon='tabler:trash' height={16} width={16} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}

      <p className='text-xs text-link dark:text-darklink flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.lunch.footNote')}
      </p>
    </div>
  )
}
