'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  fetchTreatmentPrices,
  updateTreatmentPrice,
  bulkUpdateTreatmentPrices,
  applyPercent,
  type TreatmentPrice,
  type Rounding,
  type Direction,
} from '@/lib/data/treatment-prices'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function sym(cur: string): string {
  return cur === 'USD' ? 'USD' : '$'
}

function isDark(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
}

function PriceRow({
  price,
  onSaved,
  t,
}: {
  price: TreatmentPrice
  onSaved: (slug: string, list: number, efec: number) => void
  t: TFn
}) {
  const [list, setList] = useState(String(price.listAmount))
  const [efec, setEfec] = useState(String(price.efectivoAmount))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const dirty =
    Number(list) !== price.listAmount || Number(efec) !== price.efectivoAmount
  const valid = Number(list) > 0 && Number(efec) > 0

  async function save() {
    if (!dirty || !valid) return
    setSaving(true)
    setError(false)
    const err = await updateTreatmentPrice(price.slug, Number(list), Number(efec))
    setSaving(false)
    if (err) {
      setError(true)
    } else {
      onSaved(price.slug, Number(list), Number(efec))
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const s = sym(price.currency)

  return (
    <div className='flex items-center justify-between gap-3 py-3 flex-wrap'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium text-dark dark:text-white truncate'>{price.displayName}</p>
        <p className='text-xs text-link dark:text-darklink font-mono'>{price.slug}</p>
      </div>
      <div className='flex items-center gap-3 shrink-0'>
        <label className='flex flex-col'>
          <span className='text-[10px] uppercase tracking-wide text-link dark:text-darklink mb-0.5'>{t('autoGestion.prices.list')}</span>
          <div className='flex items-center gap-1'>
            <span className='text-xs text-link dark:text-darklink'>{s}</span>
            <input
              type='number'
              value={list}
              onChange={(e) => setList(e.target.value)}
              className='w-24 px-2 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>
        </label>
        <label className='flex flex-col'>
          <span className='text-[10px] uppercase tracking-wide text-success mb-0.5'>{t('autoGestion.prices.efectivo')}</span>
          <div className='flex items-center gap-1'>
            <span className='text-xs text-link dark:text-darklink'>{s}</span>
            <input
              type='number'
              value={efec}
              onChange={(e) => setEfec(e.target.value)}
              className='w-24 px-2 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>
        </label>
        <button
          type='button'
          disabled={!dirty || !valid || saving}
          onClick={save}
          className={`h-9 w-9 mt-3.5 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors shrink-0 ${
            error
              ? 'bg-lighterror text-error'
              : saved
                ? 'bg-lightsuccess text-success'
                : 'bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
          aria-label={t('autoGestion.prices.save')}>
          <Icon
            icon={error ? 'tabler:alert-triangle' : saved ? 'tabler:check' : 'solar:diskette-line-duotone'}
            height={16}
            width={16}
          />
        </button>
      </div>
    </div>
  )
}

// ---------- Mass-update bar ----------

function MassUpdateBar({
  count,
  onApply,
  t,
}: {
  count: number
  onApply: (percent: number, direction: Direction, rounding: Rounding) => void
  t: TFn
}) {
  const [direction, setDirection] = useState<Direction>('increase')
  const [percent, setPercent] = useState('10')
  const [rounding, setRounding] = useState<Rounding>('up1000')

  const p = Number(percent)
  const valid = Number.isFinite(p) && p > 0

  // appearance-none + explicit right padding so the custom chevron never
  // overlaps the option text (the native arrow did).
  const selectCls =
    'appearance-none w-full pl-2.5 pr-8 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
  const chevron = (
    <Icon
      icon='tabler:chevron-down'
      height={14}
      width={14}
      className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-link dark:text-darklink'
    />
  )

  return (
    <div className='rounded-md border border-dashed border-border dark:border-darkborder p-3 mb-4 flex items-end gap-3 flex-wrap'>
      <div className='flex flex-col'>
        <span className='text-[10px] uppercase tracking-wide text-link dark:text-darklink mb-0.5'>{t('autoGestion.mass.direction')}</span>
        <div className='relative'>
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)} className={selectCls}>
            <option value='increase'>{t('autoGestion.mass.increase')}</option>
            <option value='decrease'>{t('autoGestion.mass.decrease')}</option>
          </select>
          {chevron}
        </div>
      </div>
      <div className='flex flex-col'>
        <span className='text-[10px] uppercase tracking-wide text-link dark:text-darklink mb-0.5'>{t('autoGestion.mass.percent')}</span>
        <div className='flex items-center gap-1'>
          <input
            type='number'
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className='w-20 px-2 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
          />
          <span className='text-sm text-link dark:text-darklink'>%</span>
        </div>
      </div>
      <div className='flex flex-col'>
        <span className='text-[10px] uppercase tracking-wide text-link dark:text-darklink mb-0.5'>{t('autoGestion.mass.rounding')}</span>
        <div className='relative'>
          <select value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)} className={selectCls}>
            <option value='up1000'>{t('autoGestion.mass.round.up1000')}</option>
            <option value='nearest1000'>{t('autoGestion.mass.round.nearest1000')}</option>
            <option value='none'>{t('autoGestion.mass.round.none')}</option>
          </select>
          {chevron}
        </div>
      </div>
      <button
        type='button'
        disabled={!valid}
        onClick={() => onApply(p, direction, rounding)}
        className='px-4 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
        {t('autoGestion.mass.apply', { count: String(count) })}
      </button>
    </div>
  )
}

// ---------- Section ----------

export function PricesSection() {
  const { t } = useTranslation()
  const [items, setItems] = useState<TreatmentPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Bumped after a mass update so every PriceRow remounts with fresh values.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    void fetchTreatmentPrices().then(({ data, error }) => {
      if (!active) return
      setItems(data)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  function handleRowSaved(slug: string, list: number, efec: number) {
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, listAmount: list, efectivoAmount: efec } : i))
    )
  }

  async function handleMassApply(percent: number, direction: Direction, rounding: Rounding) {
    const dark = isDark()
    const dirLabel = direction === 'increase' ? t('autoGestion.mass.increase') : t('autoGestion.mass.decrease')
    const res = await Swal.fire({
      title: t('autoGestion.mass.confirmTitle'),
      text: t('autoGestion.mass.confirmBody', {
        dir: dirLabel.toLowerCase(),
        percent: String(percent),
        count: String(items.length),
      }),
      icon: 'warning',
      iconColor: '#ffae1f',
      showCancelButton: true,
      confirmButtonText: t('autoGestion.mass.confirmYes'),
      cancelButtonText: t('autoGestion.mass.confirmNo'),
      confirmButtonColor: '#5d87ff',
      cancelButtonColor: dark ? '#3f4a5d' : '#e5e7eb',
      background: dark ? '#2a3547' : '#ffffff',
      color: dark ? '#ffffff' : '#2a3547',
      width: '380px',
      customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
    })
    if (!res.isConfirmed) return

    const next = items.map((i) => ({
      ...i,
      listAmount: applyPercent(i.listAmount, percent, direction, rounding),
      efectivoAmount: applyPercent(i.efectivoAmount, percent, direction, rounding),
    }))
    setItems(next)
    setVersion((v) => v + 1)
    const err = await bulkUpdateTreatmentPrices(next)
    Swal.fire({
      title: err ? t('autoGestion.mass.failToast') : t('autoGestion.mass.doneToast'),
      icon: err ? 'error' : 'success',
      iconColor: err ? '#fa896b' : '#13deb9',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2200,
      background: dark ? '#2a3547' : '#ffffff',
      color: dark ? '#ffffff' : '#2a3547',
      customClass: { popup: '!rounded-lg', title: '!text-sm' },
    })
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='mb-5'>
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.prices.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.prices.subtitle')}</p>
      </div>

      {loading ? (
        <div className='py-14 flex flex-col items-center gap-3'>
          <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.prices.loading')}</p>
        </div>
      ) : loadError ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.prices.error')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
            <Icon icon='solar:tag-price-line-duotone' height={26} width={26} className='text-primary' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.prices.empty.title')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('autoGestion.prices.empty.body')}</p>
        </div>
      ) : (
        <>
          <MassUpdateBar count={items.length} onApply={handleMassApply} t={t} />
          <div className='divide-y divide-border dark:divide-darkborder'>
            {items.map((p) => (
              <PriceRow key={`${p.slug}-${version}`} price={p} onSaved={handleRowSaved} t={t} />
            ))}
          </div>
        </>
      )}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.prices.note')}
      </p>
    </div>
  )
}
