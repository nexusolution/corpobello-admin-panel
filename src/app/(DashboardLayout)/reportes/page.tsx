'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { RoleGate } from '@/lib/auth/RoleGate'
import {
  fetchProfessionalHours,
  fetchPacientesExport,
  fetchTurnosExport,
  fetchLeadsExport,
  type ProfessionalHours,
} from '@/lib/data/reportes'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtHours(h: number): string {
  return h.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// Build a CSV and trigger a client-side download.
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportesPage() {
  const { t } = useTranslation() as { t: TFn }
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [rows, setRows] = useState<ProfessionalHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const fromIso = new Date(`${from}T00:00:00`).toISOString()
    const toIso = new Date(`${to}T23:59:59.999`).toISOString()
    return fetchProfessionalHours(fromIso, toIso).then(({ data, error }) => {
      setRows(data)
      setError(error)
      setLoading(false)
    })
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const totalTurnos = rows.reduce((s, r) => s + r.turnos, 0)
  const totalHours = rows.reduce((s, r) => s + r.hours, 0)

  const [busy, setBusy] = useState<string | null>(null)
  async function exportDataset(kind: 'pacientes' | 'turnos' | 'leads') {
    setBusy(kind)
    const fromIso = new Date(`${from}T00:00:00`).toISOString()
    const toIso = new Date(`${to}T23:59:59.999`).toISOString()
    const res =
      kind === 'pacientes'
        ? await fetchPacientesExport()
        : kind === 'turnos'
          ? await fetchTurnosExport(fromIso, toIso)
          : await fetchLeadsExport()
    setBusy(null)
    if (res.error || res.data.rows.length === 0) return
    const suffix = kind === 'turnos' ? `_${from}_${to}` : ''
    downloadCsv(`${kind}${suffix}.csv`, res.data.headers, res.data.rows)
  }

  function exportCsv() {
    downloadCsv(
      `horas-profesional_${from}_${to}.csv`,
      [t('reportes.col.professional'), t('reportes.col.turnos'), t('reportes.col.hours')],
      rows.map((r) => [r.professionalName, r.turnos, fmtHours(r.hours)]),
    )
  }

  return (
    <RoleGate allow={['admin']}>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='reportes.title'
          currentKey='reportes.breadcrumb.current'
          subtitleKey='reportes.subtitle'
          icon='solar:chart-square-line-duotone'
        />

        <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
          <div className='flex items-end gap-3 flex-wrap mb-4'>
            <div>
              <label className='block text-xs font-medium text-link dark:text-darklink mb-1'>{t('reportes.from')}</label>
              <input type='date' value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                className='rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary' />
            </div>
            <div>
              <label className='block text-xs font-medium text-link dark:text-darklink mb-1'>{t('reportes.to')}</label>
              <input type='date' value={to} min={from} onChange={(e) => setTo(e.target.value)}
                className='rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary' />
            </div>
            <button
              type='button'
              onClick={exportCsv}
              disabled={rows.length === 0}
              className='ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:border-primary hover:text-primary disabled:opacity-50 transition-colors'>
              <Icon icon='solar:download-minimalistic-line-duotone' height={16} width={16} />
              {t('reportes.exportCsv')}
            </button>
          </div>

          <h3 className='text-sm font-semibold text-dark dark:text-white uppercase tracking-wide mb-3'>
            {t('reportes.hours.heading')}
          </h3>

          {loading ? (
            <div className='py-10 flex justify-center'>
              <Icon icon='tabler:loader-2' height={26} width={26} className='text-primary animate-spin' />
            </div>
          ) : error ? (
            <p className='text-sm text-error italic py-6'>{t('reportes.error')}</p>
          ) : rows.length === 0 ? (
            <p className='text-sm text-link dark:text-darklink italic py-6'>{t('reportes.empty')}</p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-link dark:text-darklink border-b border-border dark:border-darkborder'>
                    <th className='py-2 pr-4 font-medium'>{t('reportes.col.professional')}</th>
                    <th className='py-2 pr-4 font-medium text-right'>{t('reportes.col.turnos')}</th>
                    <th className='py-2 font-medium text-right'>{t('reportes.col.hours')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.professionalId} className='border-b border-border/60 dark:border-darkborder/60'>
                      <td className='py-2 pr-4 text-dark dark:text-white'>{r.professionalName}</td>
                      <td className='py-2 pr-4 text-right text-dark dark:text-white'>{r.turnos}</td>
                      <td className='py-2 text-right text-dark dark:text-white'>{fmtHours(r.hours)}</td>
                    </tr>
                  ))}
                  <tr className='font-semibold'>
                    <td className='py-2 pr-4 text-dark dark:text-white'>{t('reportes.total')}</td>
                    <td className='py-2 pr-4 text-right text-dark dark:text-white'>{totalTurnos}</td>
                    <td className='py-2 text-right text-dark dark:text-white'>{fmtHours(totalHours)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
          <h3 className='text-sm font-semibold text-dark dark:text-white uppercase tracking-wide mb-1'>
            {t('reportes.export.heading')}
          </h3>
          <p className='text-sm text-link dark:text-darklink mb-4'>{t('reportes.export.subtitle')}</p>
          <div className='flex flex-wrap gap-2'>
            {(['pacientes', 'turnos', 'leads'] as const).map((kind) => (
              <button
                key={kind}
                type='button'
                onClick={() => void exportDataset(kind)}
                disabled={busy !== null}
                className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:border-primary hover:text-primary disabled:opacity-50 transition-colors'>
                <Icon
                  icon={busy === kind ? 'tabler:loader-2' : 'solar:download-minimalistic-line-duotone'}
                  height={16}
                  width={16}
                  className={busy === kind ? 'animate-spin' : ''}
                />
                {t(`reportes.export.${kind}` as TranslationKey)}
              </button>
            ))}
          </div>
          <p className='mt-3 text-xs text-link dark:text-darklink'>{t('reportes.export.turnosNote')}</p>
        </div>
      </div>
    </RoleGate>
  )
}
