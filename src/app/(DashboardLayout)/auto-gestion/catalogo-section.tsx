'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  fetchTreatmentCatalog,
  seedTreatmentCatalog,
  addTreatment,
  updateTreatment,
  reorderTreatments,
  deleteTreatment,
  type TreatmentCatalogItem,
} from '@/lib/data/treatment-catalog'
import { fetchMenuOverrides } from '@/lib/data/menu-overrides'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchTreatmentColors, saveTreatmentColor } from '@/lib/data/treatment-colors-config'
import { getTreatmentColor } from '@/lib/treatment-colors'
import { Switch } from '@/components/ui/switch'
import { useTranslation } from '@/lib/i18n/context'

export function CatalogoSection({
  onNavigate,
}: {
  // Jump to a sibling Autogestión tab to finish configuring a treatment
  // (availability/professionals/sucursales, or price) — Andrés punto 8.
  onNavigate?: (tab: 'disponibilidad' | 'prices') => void
}) {
  const { t } = useTranslation()
  const [items, setItems] = useState<TreatmentCatalogItem[]>([])
  const [colors, setColors] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<{ slug: string; label: string } | null>(null)

  function reload() {
    setLoading(true)
    return Promise.all([fetchTreatmentCatalog(), fetchTreatmentColors()]).then(([cat, cols]) => {
      setItems(cat.data)
      setColors(cols)
      setLoading(false)
    })
  }
  useEffect(() => {
    void reload()
  }, [])

  const colorOf = useMemo(
    () => (it: TreatmentCatalogItem) => colors.get(it.slug) ?? getTreatmentColor(`${it.slug} ${it.label}`).hex,
    [colors],
  )

  async function importCatalog() {
    setBusy(true)
    const [mo, tp] = await Promise.all([fetchMenuOverrides(), fetchTreatmentPrices()])
    const byslug = new Map<string, string>()
    for (const m of mo.data) byslug.set(m.slug, m.displayName)
    for (const p of tp.data) if (!byslug.has(p.slug)) byslug.set(p.slug, p.displayName)
    const list = [...byslug.entries()]
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    const { error } = await seedTreatmentCatalog(list)
    setBusy(false)
    if (error) return void Swal.fire({ icon: 'error', title: t('autoGestion.catalog.error'), text: error })
    await reload()
  }

  async function add() {
    const label = newLabel.trim()
    if (!label || busy) return
    setBusy(true)
    const { error } = await addTreatment(label, items.length)
    setBusy(false)
    if (error) return void Swal.fire({ icon: 'error', title: t('autoGestion.catalog.error'), text: error })
    setNewLabel('')
    await reload()
  }

  async function saveRename() {
    if (!editing) return
    const label = editing.label.trim()
    const slug = editing.slug
    setEditing(null)
    if (!label) return
    setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, label } : i)))
    const { error } = await updateTreatment(slug, { label })
    if (error) await Swal.fire({ icon: 'error', title: t('autoGestion.catalog.error'), text: error })
  }

  async function toggleActive(it: TreatmentCatalogItem, next: boolean) {
    setItems((prev) => prev.map((i) => (i.slug === it.slug ? { ...i, active: next } : i)))
    const { error } = await updateTreatment(it.slug, { active: next })
    if (error) {
      setItems((prev) => prev.map((i) => (i.slug === it.slug ? { ...i, active: !next } : i)))
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    setItems(next)
    const { error } = await reorderTreatments(next.map((i) => i.slug))
    if (error) await reload()
  }

  async function setColor(slug: string, color: string) {
    setColors((prev) => new Map(prev).set(slug, color))
    const err = await saveTreatmentColor(slug, color)
    if (err) await Swal.fire({ icon: 'error', title: t('autoGestion.catalog.error'), text: err })
  }

  async function setDuration(it: TreatmentCatalogItem, raw: string) {
    const trimmed = raw.trim()
    const next = trimmed === '' ? null : Math.max(0, Math.round(Number(trimmed)))
    if (next != null && Number.isNaN(next)) return
    setItems((prev) => prev.map((i) => (i.slug === it.slug ? { ...i, durationMin: next } : i)))
    const { error } = await updateTreatment(it.slug, { durationMin: next })
    if (error) await Swal.fire({ icon: 'error', title: t('autoGestion.catalog.error'), text: error })
  }

  async function remove(it: TreatmentCatalogItem) {
    const res = await Swal.fire({
      icon: 'warning',
      iconColor: '#fa896b',
      title: t('autoGestion.catalog.deleteTitle'),
      text: t('autoGestion.catalog.deleteBody', { name: it.label }),
      showCancelButton: true,
      confirmButtonText: t('autoGestion.catalog.deleteYes'),
      cancelButtonText: t('autoGestion.availability.cancel'),
      confirmButtonColor: '#fa896b',
      width: '380px',
      customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
    })
    if (!res.isConfirmed) return
    const { error } = await deleteTreatment(it.slug)
    if (error) return void Swal.fire({ icon: 'error', title: t('autoGestion.catalog.error'), text: error })
    await reload()
  }

  if (loading) {
    return <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.catalog.loading')}</p>
  }

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.catalog.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5'>{t('autoGestion.catalog.subtitle')}</p>
      </div>

      {items.length === 0 ? (
        <div className='rounded-md border border-border dark:border-darkborder p-4 space-y-3'>
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.catalog.importHint')}</p>
          <button
            type='button'
            onClick={importCatalog}
            disabled={busy}
            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50'>
            <Icon icon='solar:download-minimalistic-line-duotone' height={16} width={16} />
            {t('autoGestion.catalog.import')}
          </button>
        </div>
      ) : (
        <div className='rounded-md border border-border dark:border-darkborder divide-y divide-border dark:divide-darkborder'>
          {items.map((it, i) => (
            <div key={it.slug} className='flex items-center gap-3 px-3 py-2.5'>
              <div className='flex flex-col'>
                <button
                  type='button'
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className='text-link dark:text-darklink disabled:opacity-25 hover:text-primary'>
                  <Icon icon='tabler:chevron-up' height={16} width={16} />
                </button>
                <button
                  type='button'
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className='text-link dark:text-darklink disabled:opacity-25 hover:text-primary'>
                  <Icon icon='tabler:chevron-down' height={16} width={16} />
                </button>
              </div>

              <label className='relative shrink-0' title={t('autoGestion.catalog.color')}>
                <span
                  className='block h-6 w-6 rounded-full border border-black/10 dark:border-white/20'
                  style={{ backgroundColor: colorOf(it) }}
                />
                <input
                  type='color'
                  value={colorOf(it)}
                  onChange={(e) => setColor(it.slug, e.target.value)}
                  className='absolute inset-0 opacity-0 cursor-pointer'
                />
              </label>

              <div className='min-w-0 flex-1'>
                {editing?.slug === it.slug ? (
                  <input
                    autoFocus
                    value={editing.label}
                    onChange={(e) => setEditing({ slug: it.slug, label: e.target.value })}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    className='w-full px-2 py-1 rounded-md border border-primary bg-background text-sm text-dark dark:text-white focus:outline-none'
                  />
                ) : (
                  <button
                    type='button'
                    onClick={() => setEditing({ slug: it.slug, label: it.label })}
                    className='text-left text-sm text-dark dark:text-white hover:underline truncate block w-full'>
                    {it.label}
                    {!it.active && (
                      <span className='ml-2 text-[11px] text-link dark:text-darklink'>
                        ({t('autoGestion.catalog.inactive')})
                      </span>
                    )}
                  </button>
                )}
                <p className='text-[11px] text-link dark:text-darklink font-mono truncate'>{it.slug}</p>
              </div>

              <label
                className='flex items-center gap-1 shrink-0 text-[11px] text-link dark:text-darklink'
                title={t('autoGestion.catalog.duration')}>
                <input
                  type='number'
                  min={0}
                  step={5}
                  inputMode='numeric'
                  defaultValue={it.durationMin ?? ''}
                  onBlur={(e) => {
                    const cur = it.durationMin == null ? '' : String(it.durationMin)
                    if (e.target.value.trim() !== cur) void setDuration(it, e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  placeholder={t('autoGestion.catalog.durationUnit')}
                  className='w-14 px-1.5 py-1 rounded-md border border-border dark:border-darkborder bg-background text-xs text-dark dark:text-white text-right focus:outline-none focus:border-primary'
                />
                <span>{t('autoGestion.catalog.durationUnit')}</span>
              </label>

              <Switch checked={it.active} onCheckedChange={(v) => toggleActive(it, v)} />

              {it.isCustom && (
                <button
                  type='button'
                  onClick={() => remove(it)}
                  className='text-error hover:bg-lighterror/50 rounded p-1'
                  title={t('autoGestion.catalog.delete')}>
                  <Icon icon='tabler:trash' height={16} width={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className='flex items-center gap-2'>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder={t('autoGestion.catalog.addPlaceholder')}
          className='flex-1 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
        />
        <button
          type='button'
          onClick={add}
          disabled={busy || !newLabel.trim()}
          className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-white text-sm font-medium hover:brightness-95 disabled:opacity-50'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('autoGestion.catalog.add')}
        </button>
      </div>

      <p className='text-xs text-link dark:text-darklink flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.catalog.footNote')}
      </p>

      {/* Finish configuring a treatment in its sibling tabs (Andrés punto 8): the
          duration and colour are set here; availability/professionals/sucursales
          in Disponibilidad, and the price in Precios. */}
      {onNavigate && (
        <div className='flex flex-wrap items-center gap-2 pt-1'>
          <span className='text-xs text-link dark:text-darklink'>{t('autoGestion.catalog.configHint')}</span>
          <button
            type='button'
            onClick={() => onNavigate('disponibilidad')}
            className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border dark:border-darkborder text-xs font-medium text-dark dark:text-white hover:border-primary hover:text-primary transition-colors'>
            <Icon icon='solar:calendar-mark-line-duotone' height={14} width={14} />
            {t('autoGestion.catalog.goAvailability')}
          </button>
          <button
            type='button'
            onClick={() => onNavigate('prices')}
            className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border dark:border-darkborder text-xs font-medium text-dark dark:text-white hover:border-primary hover:text-primary transition-colors'>
            <Icon icon='solar:tag-price-line-duotone' height={14} width={14} />
            {t('autoGestion.catalog.goPrices')}
          </button>
        </div>
      )}
    </div>
  )
}
