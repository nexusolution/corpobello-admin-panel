'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  fetchTurnoStatusConfig,
  upsertTurnoStatus,
  deleteTurnoStatus,
  slugifyStatusKey,
  type TurnoStatusConfig,
} from '@/lib/data/turno-statuses'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

export function EstadosSection() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<TurnoStatusConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#5d87ff')

  function reload() {
    setLoading(true)
    return fetchTurnoStatusConfig().then(({ data }) => {
      setRows(data)
      setLoading(false)
    })
  }
  useEffect(() => {
    void reload()
  }, [])

  async function save(next: TurnoStatusConfig) {
    setRows((prev) => prev.map((r) => (r.statusKey === next.statusKey ? next : r)))
    const err = await upsertTurnoStatus(next)
    if (err) await Swal.fire({ icon: 'error', title: t('autoGestion.statuses.error'), text: err })
  }

  async function addCustom() {
    const label = newLabel.trim()
    if (!label) return
    const key = slugifyStatusKey(label)
    if (rows.some((r) => r.statusKey === key)) {
      await Swal.fire({ icon: 'warning', title: t('autoGestion.statuses.duplicate') })
      return
    }
    const err = await upsertTurnoStatus({
      statusKey: key,
      label,
      color: newColor,
      active: true,
      sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 1,
      isCustom: true,
    })
    if (err) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.statuses.error'), text: err })
      return
    }
    setNewLabel('')
    setNewColor('#5d87ff')
    await reload()
  }

  async function removeCustom(statusKey: string) {
    const res = await Swal.fire({
      icon: 'warning',
      title: t('autoGestion.statuses.removeTitle'),
      text: t('autoGestion.statuses.removeBody'),
      showCancelButton: true,
      confirmButtonText: t('autoGestion.statuses.removeConfirm'),
      cancelButtonText: t('autoGestion.availability.cancel'),
      confirmButtonColor: '#fa896b',
    })
    if (!res.isConfirmed) return
    const err = await deleteTurnoStatus(statusKey)
    if (err) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.statuses.error'), text: err })
      return
    }
    await reload()
  }

  async function move(index: number, dir: -1 | 1) {
    const other = index + dir
    if (other < 0 || other >= rows.length) return
    const a = rows[index]!
    const b = rows[other]!
    // swap sort_order
    await save({ ...a, sortOrder: b.sortOrder })
    await save({ ...b, sortOrder: a.sortOrder })
    await reload()
  }

  return (
    <div className='space-y-6'>
      <div>
        <h5 className='card-title'>{t('autoGestion.statuses.heading')}</h5>
        <p className='text-sm text-link dark:text-darklink mt-1'>{t('autoGestion.statuses.subtitle')}</p>
      </div>

      {/* Add custom status */}
      <div className='flex flex-wrap items-end gap-3 rounded-lg border border-border dark:border-darkborder p-4'>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-link dark:text-darklink'>{t('autoGestion.statuses.newLabel')}</label>
          <input
            type='text'
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t('autoGestion.statuses.newPlaceholder')}
            className='h-10 min-w-[220px] rounded-md border border-border dark:border-darkborder bg-transparent px-3 text-sm text-dark dark:text-white'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-link dark:text-darklink'>{t('autoGestion.statuses.color')}</label>
          <input
            type='color'
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className='h-10 w-14 rounded-md border border-border dark:border-darkborder bg-transparent p-1 cursor-pointer'
          />
        </div>
        <button
          type='button'
          onClick={addCustom}
          disabled={!newLabel.trim()}
          className='inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-white text-sm font-medium disabled:opacity-40'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('autoGestion.statuses.add')}
        </button>
      </div>

      {loading ? (
        <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.packs.loading')}</p>
      ) : (
        <div className='space-y-2'>
          {rows.map((r, i) => (
            <div
              key={r.statusKey}
              className='flex flex-wrap items-center gap-3 rounded-lg border border-border dark:border-darkborder p-3'>
              {/* reorder */}
              <div className='flex flex-col'>
                <button
                  type='button'
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={t('autoGestion.statuses.moveUp')}
                  className='text-link dark:text-darklink hover:text-primary disabled:opacity-30'>
                  <Icon icon='tabler:chevron-up' height={15} width={15} />
                </button>
                <button
                  type='button'
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={t('autoGestion.statuses.moveDown')}
                  className='text-link dark:text-darklink hover:text-primary disabled:opacity-30'>
                  <Icon icon='tabler:chevron-down' height={15} width={15} />
                </button>
              </div>
              <input
                type='color'
                value={r.color}
                onChange={(e) => save({ ...r, color: e.target.value })}
                className='h-8 w-10 rounded-md border border-border dark:border-darkborder bg-transparent p-0.5 cursor-pointer shrink-0'
              />
              <input
                type='text'
                defaultValue={r.label}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== r.label) save({ ...r, label: v })
                }}
                className='h-9 flex-1 min-w-[160px] rounded-md border border-border dark:border-darkborder bg-transparent px-2 text-sm text-dark dark:text-white'
              />
              {r.isCustom && (
                <span className='text-[11px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary'>
                  {t('autoGestion.statuses.customTag')}
                </span>
              )}
              <label className='flex items-center gap-2 text-sm text-dark dark:text-white cursor-pointer'>
                <input
                  type='checkbox'
                  checked={r.active}
                  onChange={(e) => save({ ...r, active: e.target.checked })}
                  className='h-4 w-4 accent-primary'
                />
                {t('autoGestion.statuses.active')}
              </label>
              {r.isCustom && (
                <button
                  type='button'
                  onClick={() => removeCustom(r.statusKey)}
                  aria-label={t('autoGestion.statuses.removeConfirm')}
                  className='h-8 w-8 flex items-center justify-center rounded-md text-error hover:bg-lighterror transition-colors'>
                  <Icon icon='tabler:trash' height={16} width={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className='text-xs text-link dark:text-darklink flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.statuses.note')}
      </p>
    </div>
  )
}
