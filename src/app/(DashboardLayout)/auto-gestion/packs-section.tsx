'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  fetchPackConfigs,
  upsertPackConfig,
  deletePackConfig,
  type TreatmentPackConfig,
} from '@/lib/data/packs'
import { fetchMenuOverrides } from '@/lib/data/menu-overrides'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// The two packs Andrés sells today; "otro" lets him set a custom count without
// touching code. label is the staff-facing tag shown on turnos + the ficha.
type PresetKey = '4x3' | '5x4' | 'otro'
const PRESETS: Record<Exclude<PresetKey, 'otro'>, { total: number; label: string }> = {
  '4x3': { total: 4, label: '4x3' },
  '5x4': { total: 5, label: '5x4' },
}

function presetKey(cfg: TreatmentPackConfig): PresetKey {
  if (cfg.label === '4x3' && cfg.totalSessions === 4) return '4x3'
  if (cfg.label === '5x4' && cfg.totalSessions === 5) return '5x4'
  return 'otro'
}

export function PacksSection() {
  const { t } = useTranslation()
  const [configs, setConfigs] = useState<TreatmentPackConfig[]>([])
  const [treatments, setTreatments] = useState<{ slug: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [addSlug, setAddSlug] = useState('')
  const [addPreset, setAddPreset] = useState<PresetKey>('4x3')

  function reload() {
    setLoading(true)
    return fetchPackConfigs().then(({ data }) => {
      setConfigs(data)
      setLoading(false)
    })
  }

  useEffect(() => {
    void reload()
    void Promise.all([fetchMenuOverrides(), fetchTreatmentPrices()]).then(([mo, tp]) => {
      const byslug = new Map<string, string>()
      for (const m of mo.data) byslug.set(m.slug, m.displayName)
      for (const p of tp.data) if (!byslug.has(p.slug)) byslug.set(p.slug, p.displayName)
      setTreatments(
        [...byslug.entries()]
          .map(([slug, name]) => ({ slug, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    })
  }, [])

  const nameFor = useMemo(() => {
    const m = new Map(treatments.map((x) => [x.slug, x.name]))
    return (slug: string) => m.get(slug) ?? slug
  }, [treatments])

  const configuredSlugs = useMemo(() => new Set(configs.map((c) => c.treatmentSlug)), [configs])
  const available = useMemo(
    () => treatments.filter((x) => !configuredSlugs.has(x.slug)),
    [treatments, configuredSlugs],
  )

  async function add() {
    if (!addSlug) return
    const total = addPreset === 'otro' ? 4 : PRESETS[addPreset].total
    const label = addPreset === 'otro' ? '4x3' : PRESETS[addPreset].label
    const err = await upsertPackConfig({ treatmentSlug: addSlug, totalSessions: total, label, active: true })
    if (err) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.packs.error'), text: err })
      return
    }
    setAddSlug('')
    setAddPreset('4x3')
    await reload()
  }

  async function saveConfig(next: TreatmentPackConfig) {
    setConfigs((prev) => prev.map((c) => (c.treatmentSlug === next.treatmentSlug ? next : c)))
    const err = await upsertPackConfig(next)
    if (err) await Swal.fire({ icon: 'error', title: t('autoGestion.packs.error'), text: err })
  }

  async function remove(slug: string) {
    const res = await Swal.fire({
      icon: 'warning',
      title: t('autoGestion.packs.removeTitle'),
      text: t('autoGestion.packs.removeBody'),
      showCancelButton: true,
      confirmButtonText: t('autoGestion.packs.removeConfirm'),
      cancelButtonText: t('autoGestion.availability.cancel'),
      confirmButtonColor: '#fa896b',
    })
    if (!res.isConfirmed) return
    const err = await deletePackConfig(slug)
    if (err) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.packs.error'), text: err })
      return
    }
    await reload()
  }

  return (
    <div className='space-y-6'>
      <div>
        <h5 className='card-title'>{t('autoGestion.packs.heading')}</h5>
        <p className='text-sm text-link dark:text-darklink mt-1'>
          {t('autoGestion.packs.subtitle')}
        </p>
      </div>

      {/* Add a treatment to the pack list */}
      <div className='flex flex-wrap items-end gap-3 rounded-lg border border-border dark:border-darkborder p-4'>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-link dark:text-darklink'>
            {t('autoGestion.packs.treatment')}
          </label>
          <select
            value={addSlug}
            onChange={(e) => setAddSlug(e.target.value)}
            className='h-10 min-w-[220px] rounded-md border border-border dark:border-darkborder bg-transparent px-3 text-sm text-dark dark:text-white'>
            <option value=''>{t('autoGestion.packs.pickTreatment')}</option>
            {available.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-link dark:text-darklink'>
            {t('autoGestion.packs.type')}
          </label>
          <select
            value={addPreset}
            onChange={(e) => setAddPreset(e.target.value as PresetKey)}
            className='h-10 rounded-md border border-border dark:border-darkborder bg-transparent px-3 text-sm text-dark dark:text-white'>
            <option value='4x3'>{t('autoGestion.packs.preset4x3')}</option>
            <option value='5x4'>{t('autoGestion.packs.preset5x4')}</option>
            <option value='otro'>{t('autoGestion.packs.presetOther')}</option>
          </select>
        </div>
        <button
          type='button'
          onClick={add}
          disabled={!addSlug}
          className='inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-white text-sm font-medium disabled:opacity-40'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('autoGestion.packs.add')}
        </button>
      </div>

      {/* Configured packs */}
      {loading ? (
        <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.packs.loading')}</p>
      ) : configs.length === 0 ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.packs.empty')}</p>
      ) : (
        <div className='space-y-3'>
          {configs.map((cfg) => (
            <PackConfigRow
              key={cfg.treatmentSlug}
              cfg={cfg}
              name={nameFor(cfg.treatmentSlug)}
              onSave={saveConfig}
              onRemove={() => remove(cfg.treatmentSlug)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PackConfigRow({
  cfg,
  name,
  onSave,
  onRemove,
  t,
}: {
  cfg: TreatmentPackConfig
  name: string
  onSave: (next: TreatmentPackConfig) => void
  onRemove: () => void
  t: TFn
}) {
  const preset = presetKey(cfg)
  const [custom, setCustom] = useState(preset === 'otro')

  function applyPreset(p: PresetKey) {
    if (p === 'otro') {
      setCustom(true)
      return
    }
    setCustom(false)
    onSave({ ...cfg, totalSessions: PRESETS[p].total, label: PRESETS[p].label })
  }

  return (
    <div className='flex flex-wrap items-center gap-3 rounded-lg border border-border dark:border-darkborder p-4'>
      <div className='flex items-center gap-2 flex-1 min-w-[180px]'>
        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.active ? 'bg-success' : 'bg-muted'}`}
        />
        <span className='text-sm font-semibold text-dark dark:text-white'>{name}</span>
      </div>

      <select
        value={custom ? 'otro' : preset}
        onChange={(e) => applyPreset(e.target.value as PresetKey)}
        className='h-9 rounded-md border border-border dark:border-darkborder bg-transparent px-3 text-sm text-dark dark:text-white'>
        <option value='4x3'>{t('autoGestion.packs.preset4x3')}</option>
        <option value='5x4'>{t('autoGestion.packs.preset5x4')}</option>
        <option value='otro'>{t('autoGestion.packs.presetOther')}</option>
      </select>

      {custom && (
        <>
          <div className='flex items-center gap-1.5'>
            <label className='text-xs text-link dark:text-darklink'>
              {t('autoGestion.packs.label')}
            </label>
            <input
              type='text'
              defaultValue={cfg.label}
              onBlur={(e) => onSave({ ...cfg, label: e.target.value.trim() || cfg.label })}
              className='h-9 w-20 rounded-md border border-border dark:border-darkborder bg-transparent px-2 text-sm text-dark dark:text-white'
            />
          </div>
          <div className='flex items-center gap-1.5'>
            <label className='text-xs text-link dark:text-darklink'>
              {t('autoGestion.packs.totalSessions')}
            </label>
            <input
              type='number'
              min={1}
              defaultValue={cfg.totalSessions}
              onBlur={(e) => {
                const n = Math.max(1, Number(e.target.value) || cfg.totalSessions)
                onSave({ ...cfg, totalSessions: n })
              }}
              className='h-9 w-16 rounded-md border border-border dark:border-darkborder bg-transparent px-2 text-sm text-dark dark:text-white'
            />
          </div>
        </>
      )}

      <label className='flex items-center gap-2 text-sm text-dark dark:text-white cursor-pointer'>
        <input
          type='checkbox'
          checked={cfg.active}
          onChange={(e) => onSave({ ...cfg, active: e.target.checked })}
          className='h-4 w-4 accent-primary'
        />
        {t('autoGestion.packs.active')}
      </label>

      <button
        type='button'
        onClick={onRemove}
        aria-label={t('autoGestion.packs.removeConfirm')}
        className='h-9 w-9 flex items-center justify-center rounded-md text-error hover:bg-lighterror transition-colors'>
        <Icon icon='tabler:trash' height={17} width={17} />
      </button>
    </div>
  )
}
