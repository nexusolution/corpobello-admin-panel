'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { getTreatmentColor } from '@/lib/treatment-colors'
import { fetchCalendarEvents, getCurrentUserId } from '@/lib/data/calendar-events'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type AppointmentStatus = 'confirmado' | 'pendiente' | 'atendido' | 'cancelado'

type Appointment = {
  id: string
  patientName: string
  treatmentLabel: string
  professional: string
  sucursal: string | null
  status: AppointmentStatus
  charged: boolean
}

const SUCURSAL_LABELS: Record<string, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

const STATUS_STYLE: Record<
  AppointmentStatus,
  { bg: string; text: string; labelKey: TranslationKey }
> = {
  confirmado: { bg: 'bg-lightsuccess', text: 'text-success', labelKey: 'agenda.status.confirmed' },
  pendiente: { bg: 'bg-lightwarning', text: 'text-warning', labelKey: 'agenda.status.pending' },
  atendido: { bg: 'bg-lightprimary', text: 'text-primary', labelKey: 'agenda.status.attended' },
  cancelado: { bg: 'bg-lighterror', text: 'text-error', labelKey: 'agenda.status.cancelled' },
}

function normalizeStatus(s: string): AppointmentStatus {
  return s === 'confirmado' || s === 'pendiente' || s === 'atendido' || s === 'cancelado'
    ? s
    : 'pendiente'
}

function StatBlock({
  icon,
  count,
  labelKey,
  iconClass,
  t,
}: {
  icon: string
  count: number
  labelKey: TranslationKey
  iconClass: string
  t: TFn
}) {
  return (
    <div className='flex items-center gap-2.5 rounded-md border border-border dark:border-darkborder px-3 py-2'>
      <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon icon={icon} height={18} width={18} />
      </div>
      <div className='min-w-0'>
        <div className='text-base font-bold text-dark dark:text-white leading-tight'>{count}</div>
        <div className='text-xs text-link dark:text-darklink truncate'>{t(labelKey)}</div>
      </div>
    </div>
  )
}

const AgendaDay = () => {
  const { t } = useTranslation()
  const { role } = useCurrentUser()
  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: events }, { data: prices }, { data: users }, myId] = await Promise.all([
        fetchCalendarEvents(),
        fetchTreatmentPrices(),
        fetchAppUsers(),
        getCurrentUserId(),
      ])
      if (!active) return
      const treatmentMap = new Map(prices.map((p) => [p.slug, p.displayName]))
      const proMap = new Map(users.map((u) => [u.id, u.fullName]))

      // Today's turnos: the all-day span covers today.
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

      const rows = events
        .filter((e) => e.start <= todayEnd && e.end >= todayStart)
        // Profesional only sees their own turnos on the dashboard too.
        .filter((e) => role !== 'profesional' || (!!myId && e.professionalId === myId))
        .map<Appointment>((e) => ({
          id: e.id,
          patientName: e.patientName || e.title,
          treatmentLabel: e.treatmentSlug ? treatmentMap.get(e.treatmentSlug) ?? e.treatmentSlug : '—',
          professional: e.professionalId ? proMap.get(e.professionalId) ?? '—' : '—',
          sucursal: e.sucursal,
          status: normalizeStatus(e.status),
          charged: e.charged,
        }))
      setAppts(rows)
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [role])

  const counts = {
    total: appts.length,
    confirmado: appts.filter((a) => a.status === 'confirmado').length,
    pendiente: appts.filter((a) => a.status === 'pendiente').length,
    atendido: appts.filter((a) => a.status === 'atendido').length,
  }

  const workingPros = Array.from(new Set(appts.map((a) => a.professional).filter((p) => p !== '—')))
  const openSucursales = Array.from(
    new Set(appts.map((a) => a.sucursal).filter((s): s is string => !!s)),
  ).map((s) => SUCURSAL_LABELS[s] ?? s)

  return (
    <CardBox className='h-full w-full'>
      {/* Header */}
      <div className='flex items-start justify-between mb-4 gap-3 flex-wrap'>
        <div className='min-w-0'>
          <h5 className='card-title'>{t('agenda.title')}</h5>
          {(workingPros.length > 0 || openSucursales.length > 0) && (
            <p className='text-xs text-link dark:text-darklink mt-0.5'>
              {workingPros.length > 0 && (
                <span className='inline-flex items-center gap-1'>
                  <Icon icon='solar:users-group-rounded-line-duotone' height={14} width={14} />
                  {workingPros.join(' · ')}
                </span>
              )}
              {workingPros.length > 0 && openSucursales.length > 0 && (
                <span className='mx-2 text-link/40'>·</span>
              )}
              {openSucursales.length > 0 && (
                <span className='inline-flex items-center gap-1'>
                  <Icon icon='solar:map-point-line-duotone' height={14} width={14} />
                  {openSucursales.join(' · ')}
                </span>
              )}
            </p>
          )}
        </div>
        <Link
          href='/agenda'
          className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
          {t('agenda.viewAll')}
          <Icon icon='tabler:arrow-up-right' height={14} width={14} />
        </Link>
      </div>

      {/* Summary counts */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4'>
        <StatBlock icon='solar:calendar-mark-line-duotone' count={counts.total} labelKey='agenda.summary.total' iconClass='bg-lightprimary text-primary' t={t} />
        <StatBlock icon='solar:check-circle-line-duotone' count={counts.confirmado} labelKey='agenda.summary.confirmed' iconClass='bg-lightsuccess text-success' t={t} />
        <StatBlock icon='solar:clock-circle-line-duotone' count={counts.pendiente} labelKey='agenda.summary.pending' iconClass='bg-lightwarning text-warning' t={t} />
        <StatBlock icon='solar:check-read-line-duotone' count={counts.atendido} labelKey='agenda.summary.attended' iconClass='bg-lightinfo text-info' t={t} />
      </div>

      {/* Appointment list — left bar = treatment, row background = status,
          "$" = a charge is registered. */}
      <div className='space-y-2'>
        {loading ? (
          <div className='py-6 flex justify-center'>
            <Icon icon='tabler:loader-2' height={22} width={22} className='text-primary animate-spin' />
          </div>
        ) : appts.length === 0 ? (
          <p className='text-sm text-link dark:text-darklink italic py-4'>{t('agenda.empty')}</p>
        ) : (
          appts.map((appt) => {
            const tColor = getTreatmentColor(appt.treatmentLabel)
            const sStyle = STATUS_STYLE[appt.status]
            return (
              <div
                key={appt.id}
                className={`flex items-stretch gap-3 rounded-md pr-3 py-2 overflow-hidden ${sStyle.bg}`}
                title={t(sStyle.labelKey)}>
                <span
                  className={`w-1.5 shrink-0 self-stretch ${tColor.dotClass}`}
                  title={t(tColor.labelKey as TranslationKey)}
                  aria-hidden='true'
                />
                <div className='flex-1 min-w-0 self-center pl-1'>
                  <div className='text-sm font-medium text-dark dark:text-white truncate'>
                    {appt.patientName}
                  </div>
                  <div className='text-xs text-dark/70 dark:text-white/70 truncate'>
                    {appt.treatmentLabel}
                  </div>
                </div>
                <div className='hidden md:block shrink-0 self-center text-xs text-dark/70 dark:text-white/70 text-right'>
                  {appt.professional !== '—' && (
                    <div className='truncate max-w-[120px]'>
                      {t('agenda.with')} {appt.professional}
                    </div>
                  )}
                  {appt.sucursal && (
                    <div className='truncate max-w-[120px]'>
                      {SUCURSAL_LABELS[appt.sucursal] ?? appt.sucursal}
                    </div>
                  )}
                </div>
                {appt.charged && (
                  <span
                    className='shrink-0 self-center h-5 w-5 rounded-full bg-success/20 text-success text-xs font-bold inline-flex items-center justify-center'
                    title={t('agenda.charged')}
                    aria-label={t('agenda.charged')}>
                    $
                  </span>
                )}
                <span className={`shrink-0 self-center text-xs font-semibold ${sStyle.text} hidden sm:inline`}>
                  {t(sStyle.labelKey)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </CardBox>
  )
}

export default AgendaDay
