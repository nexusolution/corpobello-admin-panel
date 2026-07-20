'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  fetchTreatmentPrices,
  updateTreatmentPrice,
  type TreatmentPrice,
} from '@/lib/data/treatment-prices'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function formatCurrency(cur: string): string {
  return cur === 'USD' ? 'USD' : '$'
}

function PriceRow({ price, t }: { price: TreatmentPrice; t: TFn }) {
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
      // Reflect the saved value as the new baseline.
      price.listAmount = Number(list)
      price.efectivoAmount = Number(efec)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const sym = formatCurrency(price.currency)

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
            <span className='text-xs text-link dark:text-darklink'>{sym}</span>
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
            <span className='text-xs text-link dark:text-darklink'>{sym}</span>
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

export function PricesSection() {
  const { t } = useTranslation()
  const [items, setItems] = useState<TreatmentPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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
        <div className='divide-y divide-border dark:divide-darkborder'>
          {items.map((p) => (
            <PriceRow key={p.slug} price={p} t={t} />
          ))}
        </div>
      )}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.prices.note')}
      </p>
    </div>
  )
}
