'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { RoleGate } from '@/lib/auth/RoleGate'
import {
  fetchPagos,
  recordPago,
  PAYMENT_METHODS,
  type Pago,
  type PaymentMethod,
} from '@/lib/data/pagos'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }
const SUCURSALES = ['caballito', 'merlo', 'moreno']

const FIELD =
  'w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}
function fmtTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function CajaPage() {
  const { t } = useTranslation() as { t: TFn }
  const [date, setDate] = useState(today())
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [professionals, setProfessionals] = useState<Option[]>([])
  const [treatments, setTreatments] = useState<Option[]>([])

  // New-cobro form
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [sucursal, setSucursal] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [treatmentSlug, setTreatmentSlug] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const fromIso = new Date(`${date}T00:00:00`).toISOString()
    const toIso = new Date(`${date}T23:59:59.999`).toISOString()
    return fetchPagos(fromIso, toIso).then(({ data, error }) => {
      setPagos(data)
      setError(error)
      setLoading(false)
    })
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void fetchTreatmentPrices().then(({ data }) =>
      setTreatments(data.map((p) => ({ value: p.slug, label: p.displayName }))),
    )
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: u.fullName })),
      ),
    )
  }, [])

  const totals = useMemo(() => {
    const byMethod = new Map<PaymentMethod, number>()
    let grand = 0
    for (const p of pagos) {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount)
      grand += p.amount
    }
    return { byMethod, grand }
  }, [pagos])

  async function save() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    setSaving(true)
    const { error } = await recordPago({
      amount: value,
      method,
      sucursal: sucursal || null,
      professionalId: professionalId || null,
      treatmentSlug: treatmentSlug || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) {
      await Swal.fire({ icon: 'error', title: t('caja.saveError'), text: error })
      return
    }
    setShowForm(false)
    setAmount('')
    setMethod('efectivo')
    setSucursal('')
    setProfessionalId('')
    setTreatmentSlug('')
    setNotes('')
    await load()
  }

  return (
    <RoleGate allow={['admin', 'operador']}>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='caja.title'
          currentKey='caja.breadcrumb.current'
          subtitleKey='caja.subtitle'
          icon='solar:wallet-money-line-duotone'
        />

        <div className='flex items-end gap-3 flex-wrap'>
          <div>
            <label className='block text-xs font-medium text-link dark:text-darklink mb-1'>{t('caja.date')}</label>
            <input type='date' value={date} onChange={(e) => setDate(e.target.value)}
              className='rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary' />
          </div>
          <button
            type='button'
            onClick={() => setShowForm((v) => !v)}
            className='ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors'>
            <Icon icon='tabler:plus' height={16} width={16} />
            {t('caja.new')}
          </button>
        </div>

        {showForm && (
          <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 space-y-3'>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
              <div>
                <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('caja.form.amount')}</label>
                <input type='number' min='0' value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD} />
              </div>
              <div>
                <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('caja.form.method')}</label>
                <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={FIELD}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{t(`caja.method.${m}` as TranslationKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('caja.form.sucursal')}</label>
                <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} className={FIELD}>
                  <option value=''>{t('caja.form.none')}</option>
                  {SUCURSALES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('caja.form.professional')}</label>
                <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={FIELD}>
                  <option value=''>{t('caja.form.none')}</option>
                  {professionals.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('caja.form.treatment')}</label>
                <select value={treatmentSlug} onChange={(e) => setTreatmentSlug(e.target.value)} className={FIELD}>
                  <option value=''>{t('caja.form.none')}</option>
                  {treatments.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('caja.form.notes')}</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
              </div>
            </div>
            <div className='flex items-center justify-end gap-2'>
              <button type='button' onClick={() => setShowForm(false)} className='px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
                {t('caja.form.cancel')}
              </button>
              <button type='button' onClick={save} disabled={saving || !(Number(amount) > 0)} className='px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors'>
                {t('caja.form.save')}
              </button>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
          {PAYMENT_METHODS.map((m) => (
            <div key={m} className='rounded-lg border border-border dark:border-darkborder bg-card p-3'>
              <p className='text-xs text-link dark:text-darklink'>{t(`caja.method.${m}` as TranslationKey)}</p>
              <p className='text-lg font-semibold text-dark dark:text-white'>{fmtMoney(totals.byMethod.get(m) ?? 0)}</p>
            </div>
          ))}
          <div className='rounded-lg border border-primary/40 bg-lightprimary/40 p-3'>
            <p className='text-xs text-primary'>{t('caja.total')}</p>
            <p className='text-lg font-semibold text-primary'>{fmtMoney(totals.grand)}</p>
          </div>
        </div>

        {/* List */}
        <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
          {loading ? (
            <div className='py-10 flex justify-center'><Icon icon='tabler:loader-2' height={26} width={26} className='text-primary animate-spin' /></div>
          ) : error ? (
            <p className='text-sm text-error italic py-6'>{t('caja.error')}</p>
          ) : pagos.length === 0 ? (
            <p className='text-sm text-link dark:text-darklink italic py-6'>{t('caja.empty')}</p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-link dark:text-darklink border-b border-border dark:border-darkborder'>
                    <th className='py-2 pr-4 font-medium'>{t('caja.col.time')}</th>
                    <th className='py-2 pr-4 font-medium'>{t('caja.col.detail')}</th>
                    <th className='py-2 pr-4 font-medium'>{t('caja.col.method')}</th>
                    <th className='py-2 font-medium text-right'>{t('caja.col.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className='border-b border-border/60 dark:border-darkborder/60'>
                      <td className='py-2 pr-4 text-dark dark:text-white'>{fmtTime(p.paidAt)}</td>
                      <td className='py-2 pr-4 text-dark dark:text-white'>
                        {p.patientName || (p.treatmentSlug ? p.treatmentSlug.replace(/-/g, ' ') : '')}
                        {p.sucursal ? ` · ${p.sucursal.charAt(0).toUpperCase() + p.sucursal.slice(1)}` : ''}
                      </td>
                      <td className='py-2 pr-4 text-dark dark:text-white'>{t(`caja.method.${p.method}` as TranslationKey)}</td>
                      <td className='py-2 text-right text-dark dark:text-white'>{fmtMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RoleGate>
  )
}
