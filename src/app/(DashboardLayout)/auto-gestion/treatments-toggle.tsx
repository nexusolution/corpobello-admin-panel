'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  fetchMenuOverrides,
  setTreatmentActive,
  type MenuOverride,
} from '@/lib/data/menu-overrides'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from '@/lib/i18n/context'

export function TreatmentsToggle() {
  const { t } = useTranslation()
  const [items, setItems] = useState<MenuOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchMenuOverrides().then(({ data, error }) => {
      if (!active) return
      setItems(data)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  async function toggle(slug: string, next: boolean) {
    setSaving(slug)
    setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, active: next } : i)))
    const err = await setTreatmentActive(slug, next)
    if (err) {
      // revert on failure
      setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, active: !next } : i)))
    }
    setSaving(null)
  }

  const activeCount = items.filter((i) => i.active).length

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='flex items-start justify-between gap-3 mb-5 flex-wrap'>
        <div>
          <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.treatments.heading')}</h3>
          <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.treatments.subtitle')}</p>
        </div>
        {!loading && !loadError && (
          <span className='text-xs text-link dark:text-darklink shrink-0'>
            {t('autoGestion.treatments.activeCount', { active: String(activeCount), total: String(items.length) })}
          </span>
        )}
      </div>

      {loading ? (
        <div className='py-14 flex flex-col items-center gap-3'>
          <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.treatments.loading')}</p>
        </div>
      ) : loadError ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.treatments.error')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
            <Icon icon='solar:widget-line-duotone' height={26} width={26} className='text-primary' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.treatments.empty.title')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('autoGestion.treatments.empty.body')}</p>
        </div>
      ) : (
        <div className='divide-y divide-border dark:divide-darkborder'>
          {items.map((item) => (
            <div key={item.slug} className='flex items-center justify-between gap-3 py-3'>
              <div className='min-w-0'>
                <p className='text-sm font-medium text-dark dark:text-white truncate'>{item.displayName}</p>
                <p className='text-xs text-link dark:text-darklink font-mono'>{item.slug}</p>
              </div>
              <div className='flex items-center gap-3 shrink-0'>
                <span className={`text-xs font-medium ${item.active ? 'text-success' : 'text-link dark:text-darklink'}`}>
                  {item.active ? t('autoGestion.treatments.on') : t('autoGestion.treatments.off')}
                </span>
                <Switch
                  checked={item.active}
                  disabled={saving === item.slug}
                  onCheckedChange={(v) => toggle(item.slug, v)}
                  aria-label={item.displayName}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.treatments.note')}
      </p>
    </div>
  )
}
