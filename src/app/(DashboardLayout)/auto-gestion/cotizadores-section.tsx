'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  TATTOO_DEFAULT,
  LASER_DEFAULT,
  type TattooRulesJson,
  type LaserRulesJson,
  type LaserZoneEntry,
} from '@/lib/data/quoting-defaults'
import {
  fetchQuotingConfig,
  saveTattooConfig,
  saveLaserConfig,
} from '@/lib/data/quoting-config'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// ── percentage <-> internal conversions ──────────────────────────────────
// Multipliers are stored as e.g. 1.15 (= +15%); discounts/recargos as 0.15.
const round1 = (n: number) => Math.round(n * 10) / 10
const mulToPct = (m: number) => round1((m - 1) * 100)
const pctToMul = (p: number) => 1 + p / 100
const fracToPct = (f: number) => round1(f * 100)
const pctToFrac = (p: number) => p / 100

// A labelled number field (percentage or currency).
function Field({
  label,
  hint,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
}) {
  return (
    <label className='block'>
      <span className='text-xs font-medium text-dark dark:text-white'>{label}</span>
      <div className='mt-1 flex items-center gap-1.5'>
        <input
          type='number'
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className='w-full rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
        />
        {suffix && <span className='text-sm text-link dark:text-darklink shrink-0'>{suffix}</span>}
      </div>
      {hint && <span className='text-[10px] text-link dark:text-darklink'>{hint}</span>}
    </label>
  )
}

function SaveBar({
  dirty,
  saving,
  saved,
  error,
  onSave,
  onReset,
  t,
}: {
  dirty: boolean
  saving: boolean
  saved: boolean
  error: boolean
  onSave: () => void
  onReset: () => void
  t: TFn
}) {
  return (
    <div className='flex items-center justify-end gap-2 flex-wrap pt-2'>
      {dirty && (
        <button
          type='button'
          onClick={onReset}
          className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
          {t('autoGestion.cotizadores.reset')}
        </button>
      )}
      <button
        type='button'
        disabled={!dirty || saving}
        onClick={onSave}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
          error
            ? 'bg-lighterror text-error'
            : saved
              ? 'bg-lightsuccess text-success'
              : 'bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed'
        }`}>
        {error
          ? t('autoGestion.cotizadores.failed')
          : saved
            ? t('autoGestion.cotizadores.saved')
            : saving
              ? t('autoGestion.cotizadores.saving')
              : t('autoGestion.cotizadores.save')}
      </button>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='rounded-lg border border-border dark:border-darkborder p-4'>
      <h4 className='text-sm font-semibold text-dark dark:text-white mb-3'>{title}</h4>
      {children}
    </div>
  )
}

// ── Tattoo editor ─────────────────────────────────────────────────────────
function TattooEditor({ t }: { t: TFn }) {
  const [base, setBase] = useState<TattooRulesJson>(TATTOO_DEFAULT)
  const [draft, setDraft] = useState<TattooRulesJson>(TATTOO_DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    void fetchQuotingConfig<TattooRulesJson>('tattoo').then(({ config }) => {
      if (!active) return
      const eff = config ?? TATTOO_DEFAULT
      setBase(eff)
      setDraft(eff)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(base),
    [draft, base],
  )

  function patch(p: Partial<TattooRulesJson>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  async function save() {
    // Bands must be positive and non-empty (the bot rejects otherwise).
    const cleanBands = draft.bands
      .filter((b) => b.maxCm2 > 0 && b.base > 0)
      .sort((a, b) => a.maxCm2 - b.maxCm2)
    if (cleanBands.length === 0) {
      setError(true)
      setTimeout(() => setError(false), 1800)
      return
    }
    const payload: TattooRulesJson = { ...draft, bands: cleanBands }
    setSaving(true)
    setError(false)
    const err = await saveTattooConfig(payload)
    setSaving(false)
    if (err) {
      setError(true)
      setTimeout(() => setError(false), 1800)
      return
    }
    setBase(payload)
    setDraft(payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (loading) {
    return (
      <div className='py-10 flex justify-center'>
        <Icon icon='tabler:loader-2' height={26} width={26} className='text-primary animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Bands */}
      <Card title={t('autoGestion.cotizadores.tattoo.bands')}>
        <p className='text-[11px] text-link dark:text-darklink mb-2'>{t('autoGestion.cotizadores.tattoo.bandsHint')}</p>
        <div className='space-y-1.5 max-h-[320px] overflow-y-auto pr-1'>
          {draft.bands.map((b, i) => (
            <div key={i} className='flex items-center gap-2'>
              <span className='text-[11px] text-link dark:text-darklink w-14 shrink-0'>{t('autoGestion.cotizadores.tattoo.upTo')}</span>
              <input
                type='number'
                value={b.maxCm2}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  patch({ bands: draft.bands.map((x, j) => (j === i ? { ...x, maxCm2: v } : x)) })
                }}
                className='w-20 rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
              />
              <span className='text-[11px] text-link dark:text-darklink shrink-0'>cm² →</span>
              <span className='text-sm text-link dark:text-darklink shrink-0'>$</span>
              <input
                type='number'
                value={b.base}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  patch({ bands: draft.bands.map((x, j) => (j === i ? { ...x, base: v } : x)) })
                }}
                className='w-32 rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
              />
              <button
                type='button'
                onClick={() => patch({ bands: draft.bands.filter((_, j) => j !== i) })}
                aria-label={t('autoGestion.cotizadores.tattoo.removeBand')}
                className='h-7 w-7 inline-flex items-center justify-center rounded-full bg-lighterror text-error hover:bg-error hover:text-white transition-colors shrink-0'>
                <Icon icon='tabler:trash' height={14} width={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type='button'
          onClick={() => {
            const lastMax = draft.bands.length ? draft.bands[draft.bands.length - 1].maxCm2 : 0
            const lastBase = draft.bands.length ? draft.bands[draft.bands.length - 1].base : 0
            patch({ bands: [...draft.bands, { maxCm2: lastMax + 10, base: lastBase }] })
          }}
          className='mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border dark:border-darkborder text-sm text-primary hover:bg-lightprimary/40 transition-colors'>
          <Icon icon='tabler:plus' height={14} width={14} />
          {t('autoGestion.cotizadores.tattoo.addBand')}
        </button>
      </Card>

      {/* Adjustments (% surcharges over the base) */}
      <Card title={t('autoGestion.cotizadores.tattoo.adjustments')}>
        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
          <Field
            label={t('autoGestion.cotizadores.tattoo.lineal')}
            hint={t('autoGestion.cotizadores.tattoo.linealHint', { n: String(draft.linealMinLargoCm) })}
            value={mulToPct(draft.tipoMultiplier.lineal)}
            suffix='%'
            onChange={(v) => patch({ tipoMultiplier: { ...draft.tipoMultiplier, lineal: pctToMul(v) } })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.linealMin')}
            value={draft.linealMinLargoCm}
            suffix='cm'
            onChange={(v) => patch({ linealMinLargoCm: v })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.rostro')}
            value={mulToPct(draft.ubicacionMultiplier.rostro)}
            suffix='%'
            onChange={(v) => patch({ ubicacionMultiplier: { ...draft.ubicacionMultiplier, rostro: pctToMul(v) } })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.dosColores')}
            value={mulToPct(draft.colorMultiplier.dos_colores)}
            suffix='%'
            onChange={(v) => patch({ colorMultiplier: { ...draft.colorMultiplier, dos_colores: pctToMul(v) } })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.multicolor')}
            value={mulToPct(draft.colorMultiplier.multicolor)}
            suffix='%'
            onChange={(v) => patch({ colorMultiplier: { ...draft.colorMultiplier, multicolor: pctToMul(v) } })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.verdesAzules')}
            value={mulToPct(draft.colorMultiplier.verdes_azules)}
            suffix='%'
            onChange={(v) => patch({ colorMultiplier: { ...draft.colorMultiplier, verdes_azules: pctToMul(v) } })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.prevSessions')}
            value={fracToPct(draft.prevSessionsRecargo)}
            suffix='%'
            onChange={(v) => patch({ prevSessionsRecargo: pctToFrac(v) })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.allergy')}
            value={fracToPct(draft.alergiaRecargo)}
            suffix='%'
            onChange={(v) => patch({ alergiaRecargo: pctToFrac(v) })}
          />
        </div>
      </Card>

      {/* Discounts */}
      <Card title={t('autoGestion.cotizadores.tattoo.discounts')}>
        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
          <Field
            label={t('autoGestion.cotizadores.tattoo.multi23')}
            value={fracToPct(draft.multiTatuajeDiscount)}
            suffix='%'
            onChange={(v) => patch({ multiTatuajeDiscount: pctToFrac(v) })}
          />
          <Field
            label={t('autoGestion.cotizadores.tattoo.multi4')}
            value={fracToPct(draft.multiTatuajeDiscount4plus)}
            suffix='%'
            onChange={(v) => patch({ multiTatuajeDiscount4plus: pctToFrac(v) })}
          />
          <Field
            label={t('autoGestion.cotizadores.efectivo')}
            value={fracToPct(draft.efectivoDiscount)}
            suffix='%'
            onChange={(v) => patch({ efectivoDiscount: pctToFrac(v) })}
          />
        </div>
      </Card>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        error={error}
        onSave={save}
        onReset={() => setDraft(base)}
        t={t}
      />
    </div>
  )
}

// ── Láser editor ────────────────────────────────────────────────────────
function LaserEditor({ t }: { t: TFn }) {
  const [base, setBase] = useState<LaserRulesJson>(LASER_DEFAULT)
  const [draft, setDraft] = useState<LaserRulesJson>(LASER_DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    void fetchQuotingConfig<LaserRulesJson>('laser').then(({ config }) => {
      if (!active) return
      const eff = config ?? LASER_DEFAULT
      setBase(eff)
      setDraft(eff)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(base),
    [draft, base],
  )

  function patchZone(key: string, p: Partial<LaserZoneEntry>) {
    setDraft((d) => ({
      ...d,
      zones: d.zones.map((z) => (z.key === key ? { ...z, ...p } : z)),
    }))
  }

  async function save() {
    setSaving(true)
    setError(false)
    const err = await saveLaserConfig(draft)
    setSaving(false)
    if (err) {
      setError(true)
      setTimeout(() => setError(false), 1800)
      return
    }
    setBase(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const q = query.trim().toLowerCase()
  const zones = q
    ? draft.zones.filter((z) => z.label.toLowerCase().includes(q) || z.key.toLowerCase().includes(q))
    : draft.zones

  if (loading) {
    return (
      <div className='py-10 flex justify-center'>
        <Icon icon='tabler:loader-2' height={26} width={26} className='text-primary animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <Card title={t('autoGestion.cotizadores.laser.discount')}>
        <div className='max-w-[200px]'>
          <Field
            label={t('autoGestion.cotizadores.efectivo')}
            value={fracToPct(draft.efectivoDiscount)}
            suffix='%'
            onChange={(v) => setDraft((d) => ({ ...d, efectivoDiscount: pctToFrac(v) }))}
          />
        </div>
      </Card>

      <Card title={t('autoGestion.cotizadores.laser.zones')}>
        <div className='relative mb-3'>
          <Icon icon='solar:magnifer-line-duotone' height={15} width={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink' />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('autoGestion.cotizadores.laser.search')}
            className='w-full rounded-md border border-border dark:border-darkborder bg-background pl-9 pr-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
          />
        </div>
        <div className='space-y-1 max-h-[420px] overflow-y-auto pr-1'>
          {zones.map((z) => (
            <div key={z.key} className='flex items-center gap-2'>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                  z.gender === 'mujer' ? 'bg-lightprimary text-primary' : 'bg-lightsecondary text-secondary'
                }`}>
                {z.gender === 'mujer' ? t('autoGestion.cotizadores.laser.female') : t('autoGestion.cotizadores.laser.male')}
              </span>
              <input
                value={z.label}
                onChange={(e) => patchZone(z.key, { label: e.target.value })}
                className='flex-1 min-w-0 rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
              />
              <span className='text-sm text-link dark:text-darklink shrink-0'>$</span>
              <input
                type='number'
                value={z.pricePerSession}
                onChange={(e) => patchZone(z.key, { pricePerSession: parseFloat(e.target.value) })}
                className='w-28 rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary shrink-0'
              />
            </div>
          ))}
        </div>
      </Card>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        error={error}
        onSave={save}
        onReset={() => setDraft(base)}
        t={t}
      />
    </div>
  )
}

export function CotizadoresSection() {
  const { t } = useTranslation()
  const [engine, setEngine] = useState<'tattoo' | 'laser'>('tattoo')

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='mb-4'>
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.cotizadores.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.cotizadores.subtitle')}</p>
      </div>

      <div className='inline-flex rounded-md border border-border dark:border-darkborder p-0.5 mb-5'>
        {(['tattoo', 'laser'] as const).map((e) => (
          <button
            key={e}
            type='button'
            onClick={() => setEngine(e)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              engine === e ? 'bg-primary text-white' : 'text-link dark:text-darklink hover:text-primary'
            }`}>
            {e === 'tattoo' ? t('autoGestion.cotizadores.tattooTab') : t('autoGestion.cotizadores.laserTab')}
          </button>
        ))}
      </div>

      {engine === 'tattoo' ? <TattooEditor t={t} /> : <LaserEditor t={t} />}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.cotizadores.note')}
      </p>
    </div>
  )
}
