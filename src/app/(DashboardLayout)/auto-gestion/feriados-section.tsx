'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  fetchAgendaBlocks,
  createAgendaBlock,
  deleteAgendaBlock,
  type AgendaBlock,
} from '@/lib/data/agenda-blocks'
import { SUCURSALES } from '@/lib/data/calendar-events'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }

const FIELD =
  'rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'

function sucursalLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function fmt(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function FeriadosSection() {
  const { t, locale } = useTranslation() as { t: TFn; locale: string }
  const [rows, setRows] = useState<AgendaBlock[]>([])
  const [professionals, setProfessionals] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [kind, setKind] = useState<'feriado' | 'vacaciones'>('feriado')
  const [sucursal, setSucursal] = useState<string>('') // '' = todas
  const [professionalId, setProfessionalId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  function reload() {
    setLoading(true)
    return fetchAgendaBlocks().then(({ data }) => {
      setRows(data)
      setLoading(false)
    })
  }

  useEffect(() => {
    void reload()
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data
          .filter((u) => u.status === 'active')
          .map((u) => ({ value: u.id, label: u.fullName })),
      ),
    )
  }, [])

  const valid =
    !!startDate &&
    !!endDate &&
    endDate >= startDate &&
    (kind === 'feriado' || !!professionalId)

  async function add() {
    if (!valid) return
    setSaving(true)
    const { error } = await createAgendaBlock({
      sucursal: sucursal || null,
      professionalId: kind === 'vacaciones' ? professionalId : null,
      startDate,
      endDate,
      reason: reason.trim() || null,
    })
    setSaving(false)
    if (error) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.feriados.error'), text: error })
      return
    }
    setStartDate('')
    setEndDate('')
    setReason('')
    setProfessionalId('')
    void reload()
  }

  async function remove(b: AgendaBlock) {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: t('autoGestion.feriados.deleteConfirm'),
      showCancelButton: true,
      confirmButtonText: t('autoGestion.feriados.delete'),
      cancelButtonText: t('autoGestion.cotizadores.reset'),
      confirmButtonColor: '#fa896b',
    })
    if (!confirm.isConfirmed) return
    setRows((prev) => prev.filter((x) => x.id !== b.id))
    await deleteAgendaBlock(b.id)
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='mb-4'>
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.feriados.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.feriados.subtitle')}</p>
      </div>

      {/* Add form */}
      <div className='rounded-md border border-border dark:border-darkborder p-3 mb-5 flex flex-wrap items-end gap-3'>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.feriados.type')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'feriado' | 'vacaciones')} className={FIELD}>
            <option value='feriado'>{t('autoGestion.feriados.holiday')}</option>
            <option value='vacaciones'>{t('autoGestion.feriados.vacation')}</option>
          </select>
        </label>

        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.feriados.branch')}</span>
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} className={FIELD}>
            <option value=''>{t('autoGestion.feriados.allBranches')}</option>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>{sucursalLabel(s)}</option>
            ))}
          </select>
        </label>

        {kind === 'vacaciones' && (
          <label className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.feriados.professional')}</span>
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={FIELD}>
              <option value=''>{t('autoGestion.feriados.pickProfessional')}</option>
              {professionals.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}

        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.feriados.from')}</span>
          <input type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} className={FIELD} />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.feriados.to')}</span>
          <input type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)} className={FIELD} />
        </label>
        <label className='flex flex-col gap-1 flex-1 min-w-[140px]'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.feriados.reason')}</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} placeholder={t('autoGestion.feriados.reasonPlaceholder')} />
        </label>

        <button
          type='button'
          disabled={!valid || saving}
          onClick={add}
          className='px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
          {t('autoGestion.feriados.add')}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className='py-6 flex justify-center'>
          <Icon icon='tabler:loader-2' height={22} width={22} className='text-primary animate-spin' />
        </div>
      ) : rows.length === 0 ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.feriados.empty')}</p>
      ) : (
        <div className='space-y-2'>
          {rows.map((b) => (
            <div key={b.id} className='flex items-center gap-3 rounded-md border border-border dark:border-darkborder px-3 py-2.5 flex-wrap'>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  b.professionalId ? 'bg-lightwarning text-warning' : 'bg-lighterror text-error'
                }`}>
                {b.professionalId ? t('autoGestion.feriados.vacation') : t('autoGestion.feriados.holiday')}
              </span>
              <span className='text-sm font-medium text-dark dark:text-white'>
                {fmt(b.startDate, locale)}{b.endDate !== b.startDate ? ` a ${fmt(b.endDate, locale)}` : ''}
              </span>
              <span className='text-sm text-link dark:text-darklink'>
                {b.sucursal ? sucursalLabel(b.sucursal) : t('autoGestion.feriados.allBranches')}
                {b.professionalName ? ` · ${b.professionalName}` : ''}
                {b.reason ? ` · ${b.reason}` : ''}
              </span>
              <button
                type='button'
                onClick={() => void remove(b)}
                aria-label={t('autoGestion.feriados.delete')}
                className='ml-auto text-link dark:text-darklink hover:text-error transition-colors'>
                <Icon icon='solar:trash-bin-trash-line-duotone' height={18} width={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className='text-xs text-link dark:text-darklink mt-4 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.feriados.note')}
      </p>
    </div>
  )
}
