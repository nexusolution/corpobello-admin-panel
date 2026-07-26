'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  fetchTreatmentIntros,
  updateTreatmentIntro,
  type TreatmentIntro,
} from '@/lib/data/treatment-intros'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function IntroCard({ item, t }: { item: TreatmentIntro; t: TFn }) {
  const [body, setBody] = useState(item.introText)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const dirty = body !== item.introText
  const valid = body.trim().length > 0
  const bubbles = item.introText.split(/\r?\n---\r?\n/).filter((b) => b.trim()).length

  async function save() {
    if (!dirty || !valid) return
    setSaving(true)
    setError(false)
    const err = await updateTreatmentIntro(item.slug, body)
    setSaving(false)
    if (err) {
      setError(true)
    } else {
      item.introText = body
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const firstLine = item.introText.split('\n').find((l) => l.trim()) ?? ''

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
          <span className='text-[11px] text-link dark:text-darklink'>{t('autoGestion.intros.bubbles', { n: String(bubbles) })}</span>
          {dirty && <span className='h-2 w-2 rounded-full bg-warning' aria-hidden='true' />}
          <Icon icon={open ? 'tabler:chevron-up' : 'tabler:chevron-down'} height={16} width={16} className='text-link dark:text-darklink' />
        </div>
      </button>

      {open && (
        <div className='px-3 pb-3 space-y-2'>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className='w-full resize-y rounded-md border border-border dark:border-darkborder bg-background p-3 text-sm font-mono text-dark dark:text-white focus:outline-none focus:border-primary transition-colors whitespace-pre-wrap'
          />
          <div className='flex items-center justify-between gap-2 flex-wrap'>
            <p className='text-[11px] text-link dark:text-darklink'>{t('autoGestion.intros.hint')}</p>
            <div className='flex items-center gap-2'>
              {dirty && (
                <button
                  type='button'
                  onClick={() => setBody(item.introText)}
                  className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
                  {t('autoGestion.intros.reset')}
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
                {error ? t('autoGestion.intros.failed') : saved ? t('autoGestion.intros.saved') : t('autoGestion.intros.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function IntrosSection() {
  const { t } = useTranslation()
  const [items, setItems] = useState<TreatmentIntro[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchTreatmentIntros().then(({ data, error }) => {
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
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.intros.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.intros.subtitle')}</p>
      </div>

      {loading ? (
        <div className='py-14 flex flex-col items-center gap-3'>
          <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.intros.loading')}</p>
        </div>
      ) : loadError ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.intros.error')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
            <Icon icon='solar:chat-square-like-line-duotone' height={26} width={26} className='text-primary' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.intros.empty.title')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('autoGestion.intros.empty.body')}</p>
        </div>
      ) : (
        <div className='space-y-2'>
          {items.map((it) => (
            <IntroCard key={it.slug} item={it} t={t} />
          ))}
        </div>
      )}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.intros.note')}
      </p>
    </div>
  )
}
