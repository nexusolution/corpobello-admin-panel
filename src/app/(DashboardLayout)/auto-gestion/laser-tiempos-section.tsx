'use client'

// Autogestión → Tiempos de láser (Etapa 2, Fase 4): edit the internal duration
// tables (per sex: zonas sola/agregada, inclusiones, reemplazos, combinaciones
// fijas) that feed the turno's automatic duration. Seeded from Andrés' PDF; fully
// editable so the clinic can tune the times after real tests. Internal times,
// never shown to the patient.

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import { fetchLaserDurationConfig, saveLaserDurationConfig } from '@/lib/data/laser-duration-config'
import {
  defaultLaserDurationConfig,
  type LaserDurationConfig,
  type LaserSex,
  type LaserSexConfig,
} from '@/lib/scheduling/laser-duration'
import { useTranslation } from '@/lib/i18n/context'

function clone(c: LaserDurationConfig): LaserDurationConfig {
  return JSON.parse(JSON.stringify(c)) as LaserDurationConfig
}
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const INPUT =
  'rounded-md border border-border dark:border-darkborder bg-background px-2 py-1 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'

// A compact multi-toggle over the sex's zonas (click chips to add/remove).
function ZonePick({
  zones,
  selected,
  onToggle,
}: {
  zones: { key: string; label: string }[]
  selected: string[]
  onToggle: (key: string) => void
}) {
  return (
    <div className='flex flex-wrap gap-1 max-h-24 overflow-y-auto cb-hscroll rounded-md border border-border dark:border-darkborder p-1.5'>
      {zones.map((z) => {
        const on = selected.includes(z.key)
        return (
          <button
            key={z.key}
            type='button'
            onClick={() => onToggle(z.key)}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
              on
                ? 'bg-primary text-white border-primary'
                : 'border-border dark:border-darkborder text-link dark:text-darklink hover:border-primary'
            }`}>
            {z.label}
          </button>
        )
      })}
    </div>
  )
}

export function LaserTiemposSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<LaserDurationConfig | null>(null)
  const [saved, setSaved] = useState<string>('') // JSON of the last saved config, for dirty
  const [sex, setSex] = useState<LaserSex>('mujer')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void fetchLaserDurationConfig().then(({ data }) => {
      if (!active) return
      setConfig(data)
      setSaved(JSON.stringify(data))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const dirty = useMemo(() => (config ? JSON.stringify(config) !== saved : false), [config, saved])

  // Immutable patch of the current sex's config.
  function patch(mut: (s: LaserSexConfig) => void) {
    setConfig((prev) => {
      if (!prev) return prev
      const next = clone(prev)
      mut(next[sex])
      return next
    })
  }

  const cfg = config?.[sex]
  const zoneLabels = useMemo(
    () => (cfg ? cfg.zones.map((z) => ({ key: z.key, label: z.label })) : []),
    [cfg],
  )
  const labelOf = useMemo(() => {
    const m = new Map((cfg?.zones ?? []).map((z) => [z.key, z.label]))
    return (k: string) => m.get(k) ?? k
  }, [cfg])

  async function save() {
    if (!config || busy) return
    setBusy(true)
    const err = await saveLaserDurationConfig(config)
    setBusy(false)
    if (err) return void Swal.fire({ icon: 'error', title: t('autoGestion.laserTimes.error'), text: err, width: '360px' })
    setSaved(JSON.stringify(config))
    void Swal.fire({ icon: 'success', title: t('autoGestion.laserTimes.saved'), timer: 1200, showConfirmButton: false, width: '320px' })
  }

  async function restore() {
    const res = await Swal.fire({
      icon: 'warning',
      iconColor: '#ffae1f',
      title: t('autoGestion.laserTimes.restore'),
      text: t('autoGestion.laserTimes.restoreConfirm'),
      showCancelButton: true,
      confirmButtonText: t('autoGestion.laserTimes.restore'),
      cancelButtonText: t('autoGestion.availability.cancel'),
      confirmButtonColor: '#5d87ff',
      width: '400px',
    })
    if (res.isConfirmed) setConfig(clone(defaultLaserDurationConfig))
  }

  if (loading || !cfg) {
    return <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.laserTimes.loading')}</p>
  }

  return (
    <div className='space-y-5'>
      <div className='flex items-start justify-between gap-3 flex-wrap'>
        <div>
          <h3 className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.laserTimes.heading')}</h3>
          <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-xl'>{t('autoGestion.laserTimes.subtitle')}</p>
        </div>
        <div className='inline-flex rounded-md border border-border dark:border-darkborder overflow-hidden text-sm'>
          {(['mujer', 'varon'] as LaserSex[]).map((sx) => (
            <button
              key={sx}
              type='button'
              onClick={() => setSex(sx)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                sex === sx ? 'bg-primary text-white' : 'text-link dark:text-darklink hover:bg-lightprimary/40'
              }`}>
              {t(sx === 'mujer' ? 'autoGestion.laserTimes.female' : 'autoGestion.laserTimes.male')}
            </button>
          ))}
        </div>
      </div>

      {/* Zonas: sola + agregada, editable, add/remove. */}
      <section className='rounded-lg border border-border dark:border-darkborder bg-card p-4'>
        <div className='flex items-center justify-between mb-2'>
          <h4 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.laserTimes.zonesTitle')}</h4>
          <button
            type='button'
            onClick={() => patch((s) => s.zones.push({ key: `zona-${Date.now()}`, label: t('autoGestion.laserTimes.newZone'), sola: 10, agregada: 5 }))}
            className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
            <Icon icon='tabler:plus' height={14} width={14} />
            {t('autoGestion.laserTimes.addZone')}
          </button>
        </div>
        <div className='grid grid-cols-[1fr_70px_70px_28px] gap-x-2 gap-y-1 items-center'>
          <span className='text-[11px] font-medium uppercase tracking-wide text-link dark:text-darklink'>{t('autoGestion.laserTimes.zoneName')}</span>
          <span className='text-[11px] font-medium uppercase tracking-wide text-link dark:text-darklink text-center'>{t('autoGestion.laserTimes.sola')}</span>
          <span className='text-[11px] font-medium uppercase tracking-wide text-link dark:text-darklink text-center'>{t('autoGestion.laserTimes.agregada')}</span>
          <span />
          {cfg.zones.map((z, i) => (
            <div key={z.key} className='contents'>
              <input
                value={z.label}
                onChange={(e) => patch((s) => { s.zones[i]!.label = e.target.value; if (!s.zones[i]!.key || s.zones[i]!.key.startsWith('zona-')) s.zones[i]!.key = slugify(e.target.value) || s.zones[i]!.key })}
                className={`${INPUT} w-full`}
              />
              <input
                type='number'
                min={0}
                value={z.sola}
                onChange={(e) => patch((s) => { s.zones[i]!.sola = Math.max(0, parseInt(e.target.value || '0', 10)) })}
                className={`${INPUT} w-full text-center`}
              />
              <input
                type='number'
                min={0}
                value={z.agregada}
                onChange={(e) => patch((s) => { s.zones[i]!.agregada = Math.max(0, parseInt(e.target.value || '0', 10)) })}
                className={`${INPUT} w-full text-center`}
              />
              <button
                type='button'
                aria-label={t('autoGestion.laserTimes.remove')}
                onClick={() => patch((s) => {
                  const key = s.zones[i]!.key
                  s.zones.splice(i, 1)
                  // Clean references so no rule points at a deleted zona.
                  s.inclusions = s.inclusions.filter((x) => x.principal !== key).map((x) => ({ ...x, includes: x.includes.filter((k) => k !== key) }))
                  s.replacements = s.replacements.filter((x) => x.to !== key).map((x) => ({ ...x, from: x.from.filter((k) => k !== key) })).filter((x) => x.from.length > 0)
                  s.fixed = s.fixed.map((x) => ({ ...x, zones: x.zones.filter((k) => k !== key) })).filter((x) => x.zones.length > 0)
                })}
                className='text-link dark:text-darklink hover:text-error'>
                <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Inclusiones. */}
      <section className='rounded-lg border border-border dark:border-darkborder bg-card p-4'>
        <div className='flex items-center justify-between mb-2'>
          <h4 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.laserTimes.inclusionsTitle')}</h4>
          <button
            type='button'
            onClick={() => patch((s) => s.inclusions.push({ principal: s.zones[0]?.key ?? '', includes: [] }))}
            className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
            <Icon icon='tabler:plus' height={14} width={14} />
            {t('autoGestion.laserTimes.add')}
          </button>
        </div>
        <p className='text-[11px] text-link dark:text-darklink mb-2'>{t('autoGestion.laserTimes.inclusionsHint')}</p>
        <div className='space-y-3'>
          {cfg.inclusions.map((inc, i) => (
            <div key={i} className='rounded-md border border-border/60 dark:border-darkborder/60 p-2.5 space-y-1.5'>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-link dark:text-darklink w-20'>{t('autoGestion.laserTimes.principal')}</span>
                <select value={inc.principal} onChange={(e) => patch((s) => { s.inclusions[i]!.principal = e.target.value })} className={`${INPUT} flex-1`}>
                  {cfg.zones.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
                </select>
                <button type='button' onClick={() => patch((s) => s.inclusions.splice(i, 1))} className='text-link dark:text-darklink hover:text-error'>
                  <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} />
                </button>
              </div>
              <span className='text-xs text-link dark:text-darklink'>{t('autoGestion.laserTimes.includes')}</span>
              <ZonePick
                zones={zoneLabels}
                selected={inc.includes}
                onToggle={(k) => patch((s) => { const arr = s.inclusions[i]!.includes; s.inclusions[i]!.includes = arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k] })}
              />
            </div>
          ))}
          {cfg.inclusions.length === 0 && <p className='text-xs text-link dark:text-darklink italic'>{t('autoGestion.laserTimes.none')}</p>}
        </div>
      </section>

      {/* Reemplazos. */}
      <section className='rounded-lg border border-border dark:border-darkborder bg-card p-4'>
        <div className='flex items-center justify-between mb-2'>
          <h4 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.laserTimes.replacementsTitle')}</h4>
          <button
            type='button'
            onClick={() => patch((s) => s.replacements.push({ from: [], to: s.zones[0]?.key ?? '' }))}
            className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
            <Icon icon='tabler:plus' height={14} width={14} />
            {t('autoGestion.laserTimes.add')}
          </button>
        </div>
        <p className='text-[11px] text-link dark:text-darklink mb-2'>{t('autoGestion.laserTimes.replacementsHint')}</p>
        <div className='space-y-3'>
          {cfg.replacements.map((r, i) => (
            <div key={i} className='rounded-md border border-border/60 dark:border-darkborder/60 p-2.5 space-y-1.5'>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-link dark:text-darklink w-20'>{t('autoGestion.laserTimes.to')}</span>
                <select value={r.to} onChange={(e) => patch((s) => { s.replacements[i]!.to = e.target.value })} className={`${INPUT} flex-1`}>
                  {cfg.zones.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
                </select>
                <button type='button' onClick={() => patch((s) => s.replacements.splice(i, 1))} className='text-link dark:text-darklink hover:text-error'>
                  <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} />
                </button>
              </div>
              <span className='text-xs text-link dark:text-darklink'>{t('autoGestion.laserTimes.from')}</span>
              <ZonePick
                zones={zoneLabels}
                selected={r.from}
                onToggle={(k) => patch((s) => { const arr = s.replacements[i]!.from; s.replacements[i]!.from = arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k] })}
              />
            </div>
          ))}
          {cfg.replacements.length === 0 && <p className='text-xs text-link dark:text-darklink italic'>{t('autoGestion.laserTimes.none')}</p>}
        </div>
      </section>

      {/* Combinaciones fijas. */}
      <section className='rounded-lg border border-border dark:border-darkborder bg-card p-4'>
        <div className='flex items-center justify-between mb-2'>
          <h4 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.laserTimes.fixedTitle')}</h4>
          <button
            type='button'
            onClick={() => patch((s) => s.fixed.push({ zones: [], minutes: 30 }))}
            className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
            <Icon icon='tabler:plus' height={14} width={14} />
            {t('autoGestion.laserTimes.add')}
          </button>
        </div>
        <p className='text-[11px] text-link dark:text-darklink mb-2'>{t('autoGestion.laserTimes.fixedHint')}</p>
        <div className='space-y-3'>
          {cfg.fixed.map((f, i) => (
            <div key={i} className='rounded-md border border-border/60 dark:border-darkborder/60 p-2.5 space-y-1.5'>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-link dark:text-darklink w-20'>{t('autoGestion.laserTimes.minutes')}</span>
                <input
                  type='number'
                  min={0}
                  value={f.minutes}
                  onChange={(e) => patch((s) => { s.fixed[i]!.minutes = Math.max(0, parseInt(e.target.value || '0', 10)) })}
                  className={`${INPUT} w-24`}
                />
                <span className='text-[11px] text-link dark:text-darklink flex-1 truncate'>
                  {f.zones.map(labelOf).join(' + ') || t('autoGestion.laserTimes.pickZones')}
                </span>
                <button type='button' onClick={() => patch((s) => s.fixed.splice(i, 1))} className='text-link dark:text-darklink hover:text-error'>
                  <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} />
                </button>
              </div>
              <ZonePick
                zones={zoneLabels}
                selected={f.zones}
                onToggle={(k) => patch((s) => { const arr = s.fixed[i]!.zones; s.fixed[i]!.zones = arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k] })}
              />
            </div>
          ))}
          {cfg.fixed.length === 0 && <p className='text-xs text-link dark:text-darklink italic'>{t('autoGestion.laserTimes.none')}</p>}
        </div>
      </section>

      <div className='flex items-center gap-2 sticky bottom-0 bg-card/80 backdrop-blur py-2'>
        <button
          type='button'
          onClick={save}
          disabled={busy || !dirty}
          className='inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50'>
          <Icon icon='tabler:device-floppy' height={16} width={16} />
          {t('autoGestion.laserTimes.save')}
        </button>
        <button
          type='button'
          onClick={restore}
          className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm text-link dark:text-darklink hover:text-primary hover:border-primary'>
          <Icon icon='solar:refresh-line-duotone' height={16} width={16} />
          {t('autoGestion.laserTimes.restore')}
        </button>
        {dirty && <span className='text-[11px] text-warning'>{t('autoGestion.laserTimes.unsaved')}</span>}
      </div>

      <p className='text-xs text-link dark:text-darklink flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.laserTimes.footNote')}
      </p>
    </div>
  )
}
