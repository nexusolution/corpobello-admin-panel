'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  fetchPromotions,
  createPromotion,
  updatePromotion,
  setPromotionActive,
  deletePromotion,
  type Promotion,
  type PromotionInput,
} from '@/lib/data/promotions'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type TreatmentOption = { slug: string; displayName: string }

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const startIso = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : null)
const endIso = (d: string) => (d ? new Date(`${d}T23:59:59`).toISOString() : null)

const EMPTY: PromotionInput = {
  name: '',
  active: true,
  scope: 'all',
  treatmentSlugs: [],
  discountPercent: 20,
  combinable: false,
  priority: 0,
  startsAt: null,
  endsAt: null,
}

function PromoDialog({
  open,
  editing,
  treatments,
  onOpenChange,
  onSaved,
  t,
}: {
  open: boolean
  editing: Promotion | null
  treatments: TreatmentOption[]
  onOpenChange: (next: boolean) => void
  onSaved: (p: Promotion, isNew: boolean) => void
  t: TFn
}) {
  const [form, setForm] = useState<PromotionInput>(EMPTY)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      const { id: _id, ...rest } = editing
      setForm(rest)
      setStart(dateInput(editing.startsAt))
      setEnd(dateInput(editing.endsAt))
    } else {
      setForm(EMPTY)
      setStart('')
      setEnd('')
    }
    setError(false)
  }, [open, editing])

  const valid =
    form.name.trim().length > 0 &&
    form.discountPercent > 0 &&
    form.discountPercent < 100 &&
    (form.scope === 'all' || form.treatmentSlugs.length > 0)

  function toggleSlug(slug: string) {
    setForm((f) => ({
      ...f,
      treatmentSlugs: f.treatmentSlugs.includes(slug)
        ? f.treatmentSlugs.filter((s) => s !== slug)
        : [...f.treatmentSlugs, slug],
    }))
  }

  async function submit() {
    if (!valid) return
    setSaving(true)
    setError(false)
    const payload: PromotionInput = {
      ...form,
      name: form.name.trim(),
      startsAt: startIso(start),
      endsAt: endIso(end),
    }
    if (editing) {
      const err = await updatePromotion(editing.id, payload)
      setSaving(false)
      if (err) return setError(true)
      onSaved({ ...payload, id: editing.id }, false)
    } else {
      const { promotion, error: err } = await createPromotion(payload)
      setSaving(false)
      if (err || !promotion) return setError(true)
      onSaved(promotion, true)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-[520px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='border-b border-border dark:border-darkborder pb-3 mb-2'>
          <DialogTitle className='text-lg text-dark dark:text-white'>
            {editing ? t('autoGestion.promos.editTitle') : t('autoGestion.promos.newTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4 mt-2'>
          <div>
            <Label className='font-medium mb-1.5 block'>
              {t('autoGestion.promos.name')} <span className='text-error'>*</span>
            </Label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('autoGestion.promos.namePlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label className='font-medium mb-1.5 block'>{t('autoGestion.promos.discount')} <span className='text-error'>*</span></Label>
              <div className='flex items-center gap-1.5'>
                <input
                  type='number'
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: parseFloat(e.target.value) }))}
                  className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
                />
                <span className='text-sm text-link dark:text-darklink'>%</span>
              </div>
            </div>
            <div>
              <Label className='font-medium mb-1.5 block'>{t('autoGestion.promos.priority')}</Label>
              <input
                type='number'
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))}
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
              />
            </div>
          </div>

          <div>
            <Label className='font-medium mb-1.5 block'>{t('autoGestion.promos.scope')}</Label>
            <div className='flex gap-2'>
              {(['all', 'selected'] as const).map((s) => (
                <button
                  key={s}
                  type='button'
                  onClick={() => setForm((f) => ({ ...f, scope: s }))}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    form.scope === s
                      ? 'border-primary bg-lightprimary text-primary'
                      : 'border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary'
                  }`}>
                  {s === 'all' ? t('autoGestion.promos.scopeAll') : t('autoGestion.promos.scopeSelected')}
                </button>
              ))}
            </div>
          </div>

          {form.scope === 'selected' && (
            <div className='rounded-md border border-border dark:border-darkborder p-2 max-h-[160px] overflow-y-auto space-y-1'>
              {treatments.length === 0 ? (
                <p className='text-xs text-link dark:text-darklink p-1'>{t('autoGestion.promos.noTreatments')}</p>
              ) : (
                treatments.map((tr) => (
                  <label key={tr.slug} className='flex items-center gap-2 px-1 py-1 cursor-pointer'>
                    <Checkbox
                      checked={form.treatmentSlugs.includes(tr.slug)}
                      onCheckedChange={() => toggleSlug(tr.slug)}
                    />
                    <span className='text-sm text-dark dark:text-white'>{tr.displayName}</span>
                  </label>
                ))
              )}
            </div>
          )}

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label className='font-medium mb-1.5 block'>{t('autoGestion.promos.startsAt')}</Label>
              <input
                type='date'
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
              />
            </div>
            <div>
              <Label className='font-medium mb-1.5 block'>{t('autoGestion.promos.endsAt')}</Label>
              <input
                type='date'
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
              />
            </div>
          </div>

          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <Checkbox
              checked={form.combinable}
              onCheckedChange={(v) => setForm((f) => ({ ...f, combinable: v === true }))}
            />
            <span className='text-sm text-dark dark:text-white'>{t('autoGestion.promos.combinable')}</span>
          </label>
          <p className='text-[11px] text-link dark:text-darklink -mt-2'>{t('autoGestion.promos.combinableHint')}</p>

          {error && <p className='text-xs text-error'>{t('autoGestion.promos.error')}</p>}

          <div className='flex items-center justify-end gap-3 pt-1'>
            <button
              type='button'
              onClick={() => onOpenChange(false)}
              className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('autoGestion.promos.cancel')}
            </button>
            <button
              type='button'
              disabled={!valid || saving}
              onClick={submit}
              className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
              {saving ? t('autoGestion.promos.saving') : t('autoGestion.promos.save')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PromoCard({
  promo,
  treatments,
  onEdit,
  onToggle,
  onDelete,
  t,
}: {
  promo: Promotion
  treatments: TreatmentOption[]
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  t: TFn
}) {
  const [confirming, setConfirming] = useState(false)
  const scopeLabel =
    promo.scope === 'all'
      ? t('autoGestion.promos.scopeAll')
      : promo.treatmentSlugs
          .map((s) => treatments.find((tr) => tr.slug === s)?.displayName ?? s)
          .join(', ')

  return (
    <div className={`rounded-lg border p-4 ${promo.active ? 'border-border dark:border-darkborder' : 'border-dashed border-border dark:border-darkborder opacity-70'}`}>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2 flex-wrap'>
            <span className='text-sm font-semibold text-dark dark:text-white'>{promo.name}</span>
            <span className='text-[11px] px-1.5 py-0.5 rounded bg-lightsuccess text-success font-semibold'>{promo.discountPercent}% OFF</span>
            {promo.combinable && <span className='text-[11px] px-1.5 py-0.5 rounded bg-lightprimary text-primary'>{t('autoGestion.promos.combinableTag')}</span>}
          </div>
          <p className='text-xs text-link dark:text-darklink mt-1 truncate'>
            {t('autoGestion.promos.appliesTo')}: {scopeLabel}
          </p>
          <p className='text-[11px] text-link dark:text-darklink mt-0.5'>
            {t('autoGestion.promos.priority')}: {promo.priority}
            {(promo.startsAt || promo.endsAt) && (
              <> · {dateInput(promo.startsAt) || '…'} → {dateInput(promo.endsAt) || '…'}</>
            )}
          </p>
        </div>
        <div className='flex items-center gap-1.5 shrink-0'>
          <button
            type='button'
            onClick={onToggle}
            title={promo.active ? t('autoGestion.promos.deactivate') : t('autoGestion.promos.activate')}
            className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
              promo.active ? 'bg-lightsuccess text-success' : 'bg-muted/60 dark:bg-darkmuted/40 text-link dark:text-darklink'
            }`}>
            {promo.active ? t('autoGestion.promos.on') : t('autoGestion.promos.off')}
          </button>
          <button
            type='button'
            onClick={onEdit}
            aria-label={t('autoGestion.promos.edit')}
            className='h-8 w-8 inline-flex items-center justify-center rounded-full bg-lightprimary text-primary hover:bg-primary hover:text-white transition-colors'>
            <Icon icon='solar:pen-line-duotone' height={15} width={15} />
          </button>
          {confirming ? (
            <button
              type='button'
              onClick={onDelete}
              className='text-[11px] px-2 py-1.5 rounded-md bg-error text-white font-medium'>
              {t('autoGestion.promos.confirmDelete')}
            </button>
          ) : (
            <button
              type='button'
              onClick={() => {
                setConfirming(true)
                setTimeout(() => setConfirming(false), 3000)
              }}
              aria-label={t('autoGestion.promos.delete')}
              className='h-8 w-8 inline-flex items-center justify-center rounded-full bg-lighterror text-error hover:bg-error hover:text-white transition-colors'>
              <Icon icon='solar:trash-bin-trash-line-duotone' height={15} width={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function PromocionesSection() {
  const { t } = useTranslation()
  const [promos, setPromos] = useState<Promotion[]>([])
  const [treatments, setTreatments] = useState<TreatmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([fetchPromotions(), fetchTreatmentPrices()]).then(
      ([promoRes, trRes]) => {
        if (!active) return
        setPromos(promoRes.data)
        setLoadError(promoRes.error)
        setTreatments(trRes.data.map((r) => ({ slug: r.slug, displayName: r.displayName })))
        setLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [])

  const sorted = useMemo(
    () => [...promos].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)),
    [promos],
  )

  async function toggle(p: Promotion) {
    setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))
    const err = await setPromotionActive(p.id, !p.active)
    if (err) setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: p.active } : x)))
  }

  async function remove(p: Promotion) {
    const err = await deletePromotion(p.id)
    if (!err) setPromos((prev) => prev.filter((x) => x.id !== p.id))
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='flex items-start justify-between gap-3 mb-5'>
        <div>
          <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.promos.heading')}</h3>
          <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.promos.subtitle')}</p>
        </div>
        <button
          type='button'
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          className='shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('autoGestion.promos.new')}
        </button>
      </div>

      {loading ? (
        <div className='py-14 flex justify-center'>
          <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
        </div>
      ) : loadError ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.promos.loadError')}</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
            <Icon icon='solar:tag-horizontal-line-duotone' height={26} width={26} className='text-primary' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.promos.emptyTitle')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('autoGestion.promos.emptyBody')}</p>
        </div>
      ) : (
        <div className='space-y-2'>
          {sorted.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              treatments={treatments}
              onEdit={() => {
                setEditing(p)
                setDialogOpen(true)
              }}
              onToggle={() => toggle(p)}
              onDelete={() => remove(p)}
              t={t}
            />
          ))}
        </div>
      )}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.promos.note')}
      </p>

      <PromoDialog
        open={dialogOpen}
        editing={editing}
        treatments={treatments}
        onOpenChange={setDialogOpen}
        onSaved={(p, isNew) => {
          setPromos((prev) => (isNew ? [p, ...prev] : prev.map((x) => (x.id === p.id ? p : x))))
        }}
        t={t}
      />
    </div>
  )
}
