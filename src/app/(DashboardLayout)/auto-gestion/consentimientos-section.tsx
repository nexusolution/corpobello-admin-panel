'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  fetchConsentTemplates,
  createConsentTemplate,
  updateConsentTemplate,
  deleteConsentTemplate,
  type ConsentTemplate,
} from '@/lib/data/consents'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }

const FIELD =
  'w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

function slugLabel(slug: string, treatments: Option[]): string {
  return treatments.find((o) => o.value === slug)?.label ?? slug.replace(/-/g, ' ')
}

export function ConsentimientosSection() {
  const { t } = useTranslation() as { t: TFn }
  const [rows, setRows] = useState<ConsentTemplate[]>([])
  const [treatments, setTreatments] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ConsentTemplate | 'new' | null>(null)

  // Editor fields
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [treatmentSlug, setTreatmentSlug] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  function reload() {
    setLoading(true)
    return fetchConsentTemplates().then(({ data, error }) => {
      setRows(data)
      setError(error)
      setLoading(false)
    })
  }

  useEffect(() => {
    void reload()
    void fetchTreatmentPrices().then(({ data }) =>
      setTreatments(data.map((p) => ({ value: p.slug, label: p.displayName }))),
    )
  }, [])

  function openNew() {
    setEditing('new')
    setTitle('')
    setBody('')
    setTreatmentSlug('')
    setActive(true)
  }
  function openEdit(tpl: ConsentTemplate) {
    setEditing(tpl)
    setTitle(tpl.title)
    setBody(tpl.body)
    setTreatmentSlug(tpl.treatmentSlug ?? '')
    setActive(tpl.active)
  }

  async function save() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    const draft = {
      title: title.trim(),
      body: body.trim(),
      treatmentSlug: treatmentSlug || null,
      active,
    }
    const { error } =
      editing === 'new'
        ? await createConsentTemplate(draft)
        : await updateConsentTemplate((editing as ConsentTemplate).id, draft)
    setSaving(false)
    if (error) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.consents.saveError'), text: error })
      return
    }
    setEditing(null)
    await reload()
  }

  async function remove(tpl: ConsentTemplate) {
    const c = await Swal.fire({
      icon: 'warning',
      title: t('autoGestion.consents.deleteConfirm'),
      text: tpl.title,
      showCancelButton: true,
      confirmButtonText: t('autoGestion.consents.delete'),
      cancelButtonText: t('autoGestion.consents.cancel'),
      confirmButtonColor: '#fa896b',
    })
    if (!c.isConfirmed) return
    const { error } = await deleteConsentTemplate(tpl.id)
    if (error) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.consents.saveError'), text: error })
      return
    }
    await reload()
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-base font-semibold text-dark dark:text-white'>
            {t('autoGestion.consents.heading')}
          </h3>
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.consents.subtitle')}</p>
        </div>
        {editing === null && (
          <button
            type='button'
            onClick={openNew}
            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors shrink-0'>
            <Icon icon='tabler:plus' height={15} width={15} />
            {t('autoGestion.consents.new')}
          </button>
        )}
      </div>

      {editing !== null ? (
        <div className='rounded-md border border-border dark:border-darkborder p-4 space-y-3'>
          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('autoGestion.consents.title')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('autoGestion.consents.treatment')}</label>
            <select value={treatmentSlug} onChange={(e) => setTreatmentSlug(e.target.value)} className={FIELD}>
              <option value=''>{t('autoGestion.consents.treatmentAny')}</option>
              {treatments.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('autoGestion.consents.body')}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={FIELD} />
          </div>
          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input type='checkbox' checked={active} onChange={(e) => setActive(e.target.checked)} className='h-4 w-4 rounded border-border dark:border-darkborder' />
            <span className='text-sm text-dark dark:text-white'>{t('autoGestion.consents.active')}</span>
          </label>
          <div className='flex items-center justify-end gap-2 pt-1'>
            <button type='button' onClick={() => setEditing(null)} className='px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('autoGestion.consents.cancel')}
            </button>
            <button type='button' onClick={save} disabled={saving || !title.trim() || !body.trim()} className='px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors'>
              {t('autoGestion.consents.save')}
            </button>
          </div>
        </div>
      ) : loading ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.consents.loading')}</p>
      ) : error ? (
        <p className='text-sm text-error italic'>{t('autoGestion.consents.error')}</p>
      ) : rows.length === 0 ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.consents.empty')}</p>
      ) : (
        <div className='space-y-2'>
          {rows.map((tpl) => (
            <div key={tpl.id} className='flex items-center justify-between gap-3 rounded-md border border-border dark:border-darkborder p-3'>
              <div className='min-w-0'>
                <p className='text-sm font-medium text-dark dark:text-white truncate'>{tpl.title}</p>
                <p className='text-xs text-link dark:text-darklink truncate'>
                  {tpl.treatmentSlug ? slugLabel(tpl.treatmentSlug, treatments) : t('autoGestion.consents.treatmentAny')}
                  {!tpl.active && ` · ${t('autoGestion.consents.inactive')}`}
                </p>
              </div>
              <div className='flex items-center gap-3 shrink-0'>
                <button type='button' onClick={() => openEdit(tpl)} className='text-xs font-medium text-primary hover:underline'>
                  {t('autoGestion.consents.edit')}
                </button>
                <button type='button' onClick={() => void remove(tpl)} className='text-xs font-medium text-error hover:underline'>
                  {t('autoGestion.consents.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
