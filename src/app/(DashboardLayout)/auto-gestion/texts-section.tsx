'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  fetchTreatmentTexts,
  updateTreatmentText,
  type TreatmentText,
} from '@/lib/data/treatment-texts'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function TextCard({ item, t }: { item: TreatmentText; t: TFn }) {
  const [body, setBody] = useState(item.customQuoteBody)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const dirty = body !== item.customQuoteBody
  const valid = body.trim().length > 0

  async function save() {
    if (!dirty || !valid) return
    setSaving(true)
    setError(false)
    const err = await updateTreatmentText(item.slug, body)
    setSaving(false)
    if (err) {
      setError(true)
    } else {
      item.customQuoteBody = body
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  // Collapsed preview: first line + char count.
  const firstLine = item.customQuoteBody.split('\n').find((l) => l.trim()) ?? ''

  return (
    <div className='rounded-md border border-border dark:border-darkborder'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/30 dark:hover:bg-darkmuted/30 transition-colors'>
        <div className='min-w-0'>
          <p className='text-sm font-medium text-dark dark:text-white truncate'>{item.displayName}</p>
          <p className='text-xs text-link dark:text-darklink truncate'>{firstLine}</p>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {dirty && <span className='h-2 w-2 rounded-full bg-warning' aria-hidden='true' />}
          <Icon icon={open ? 'tabler:chevron-up' : 'tabler:chevron-down'} height={16} width={16} className='text-link dark:text-darklink' />
        </div>
      </button>

      {open && (
        <div className='px-3 pb-3 space-y-2'>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className='w-full resize-y rounded-md border border-border dark:border-darkborder bg-background p-3 text-sm font-mono text-dark dark:text-white focus:outline-none focus:border-primary transition-colors whitespace-pre-wrap'
          />
          <div className='flex items-center justify-between gap-2 flex-wrap'>
            <p className='text-[11px] text-link dark:text-darklink'>{t('autoGestion.texts.hint')}</p>
            <div className='flex items-center gap-2'>
              {dirty && (
                <button
                  type='button'
                  onClick={() => setBody(item.customQuoteBody)}
                  className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
                  {t('autoGestion.texts.reset')}
                </button>
              )}
              <button
                type='button'
                disabled={!dirty || !valid || saving}
                onClick={save}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  error
                    ? 'bg-lighterror text-error'
                    : saved
                      ? 'bg-lightsuccess text-success'
                      : 'bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed'
                }`}>
                {error ? t('autoGestion.texts.failed') : saved ? t('autoGestion.texts.saved') : t('autoGestion.texts.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function TextsSection() {
  const { t } = useTranslation()
  const [items, setItems] = useState<TreatmentText[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchTreatmentTexts().then(({ data, error }) => {
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
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.texts.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.texts.subtitle')}</p>
      </div>

      {loading ? (
        <div className='py-14 flex flex-col items-center gap-3'>
          <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.texts.loading')}</p>
        </div>
      ) : loadError ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.texts.error')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
            <Icon icon='solar:document-text-line-duotone' height={26} width={26} className='text-primary' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.texts.empty.title')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('autoGestion.texts.empty.body')}</p>
        </div>
      ) : (
        <div className='space-y-2'>
          {items.map((it) => (
            <TextCard key={it.slug} item={it} t={t} />
          ))}
        </div>
      )}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.texts.note')}
      </p>
    </div>
  )
}
