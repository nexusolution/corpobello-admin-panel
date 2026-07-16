'use client'

import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { getTreatmentColor } from '@/lib/treatment-colors'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type AppointmentStatus = 'confirmado' | 'pendiente' | 'atendido' | 'cancelado'
type Sucursal = 'caballito' | 'merlo' | 'moreno'

type Appointment = {
  id: string
  time: string
  patientName: string
  treatmentLabel: string
  professional: string
  sucursal: Sucursal
  status: AppointmentStatus
}

const SUCURSAL_LABELS: Record<Sucursal, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

// MOCK STATE: today's appointments. Replace with Supabase query joining
// turnos + patients + treatments when Etapa 2 agenda module lands.
const TODAYS_APPOINTMENTS: Appointment[] = [
  { id: '1', time: '09:00', patientName: 'Camila Rojas', treatmentLabel: 'Láser — Axilas', professional: 'Andrés', sucursal: 'caballito', status: 'atendido' },
  { id: '2', time: '10:00', patientName: 'Carolina Ruiz', treatmentLabel: 'Láser — Piernas', professional: 'Andrés', sucursal: 'caballito', status: 'atendido' },
  { id: '3', time: '11:30', patientName: 'María González', treatmentLabel: 'Tatuajes — Remoción', professional: 'Lucía', sucursal: 'caballito', status: 'atendido' },
  { id: '4', time: '13:00', patientName: 'Sofía Martínez', treatmentLabel: 'Endolift', professional: 'Andrés', sucursal: 'caballito', status: 'confirmado' },
  { id: '5', time: '14:30', patientName: 'Valentina Pérez', treatmentLabel: 'Faciales — Limpieza', professional: 'Lucía', sucursal: 'merlo', status: 'confirmado' },
  { id: '6', time: '15:00', patientName: 'Bianca Romero', treatmentLabel: 'Microblading', professional: 'Andrés', sucursal: 'caballito', status: 'pendiente' },
  { id: '7', time: '16:30', patientName: 'Florencia López', treatmentLabel: 'Melasma', professional: 'Lucía', sucursal: 'merlo', status: 'pendiente' },
  { id: '8', time: '18:00', patientName: 'Pilar Cabrera', treatmentLabel: 'Acné', professional: 'Andrés', sucursal: 'caballito', status: 'cancelado' },
]

const STATUS_STYLE: Record<
  AppointmentStatus,
  { bg: string; text: string; labelKey: TranslationKey; dot: string }
> = {
  confirmado: {
    bg: 'bg-lightsuccess',
    text: 'text-success',
    labelKey: 'agenda.status.confirmed',
    dot: 'bg-success',
  },
  pendiente: {
    bg: 'bg-lightwarning',
    text: 'text-warning',
    labelKey: 'agenda.status.pending',
    dot: 'bg-warning',
  },
  atendido: {
    bg: 'bg-lightprimary',
    text: 'text-primary',
    labelKey: 'agenda.status.attended',
    dot: 'bg-primary',
  },
  cancelado: {
    bg: 'bg-lighterror',
    text: 'text-error',
    labelKey: 'agenda.status.cancelled',
    dot: 'bg-error',
  },
}

function showUnderDevelopmentAlert(t: TFn) {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  Swal.fire({
    title: t('alerts.underDevelopmentTitle'),
    text: t('alerts.underDevelopmentBody', { section: t('agenda.title') }),
    icon: 'info',
    iconColor: '#5d87ff',
    confirmButtonText: t('alerts.underDevelopmentButton'),
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-1 [&_.swal2-icon-content]:!text-2xl',
      confirmButton: '!text-sm !px-4 !py-1.5',
      popup: '!rounded-lg',
    },
  })
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
      <div
        className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon icon={icon} height={18} width={18} />
      </div>
      <div className='min-w-0'>
        <div className='text-base font-bold text-dark dark:text-white leading-tight'>
          {count}
        </div>
        <div className='text-xs text-link dark:text-darklink truncate'>
          {t(labelKey)}
        </div>
      </div>
    </div>
  )
}

const AgendaDay = () => {
  const { t } = useTranslation()

  const counts = {
    total: TODAYS_APPOINTMENTS.length,
    confirmado: TODAYS_APPOINTMENTS.filter((a) => a.status === 'confirmado').length,
    pendiente: TODAYS_APPOINTMENTS.filter((a) => a.status === 'pendiente').length,
    atendido: TODAYS_APPOINTMENTS.filter((a) => a.status === 'atendido').length,
    cancelado: TODAYS_APPOINTMENTS.filter((a) => a.status === 'cancelado').length,
  }

  const openSucursales = Array.from(
    new Set(TODAYS_APPOINTMENTS.map((a) => a.sucursal))
  ).map((s) => SUCURSAL_LABELS[s])

  const workingPros = Array.from(
    new Set(TODAYS_APPOINTMENTS.map((a) => a.professional))
  )

  return (
    <CardBox className='h-full w-full'>
      {/* Header */}
      <div className='flex items-start justify-between mb-4 gap-3 flex-wrap'>
        <div className='min-w-0'>
          <h5 className='card-title'>{t('agenda.title')}</h5>
          <p className='text-xs text-link dark:text-darklink mt-0.5'>
            <span className='inline-flex items-center gap-1'>
              <Icon icon='solar:users-group-rounded-line-duotone' height={14} width={14} />
              {workingPros.join(' · ')}
            </span>
            <span className='mx-2 text-link/40'>·</span>
            <span className='inline-flex items-center gap-1'>
              <Icon icon='solar:map-point-line-duotone' height={14} width={14} />
              {openSucursales.join(' · ')}
            </span>
          </p>
        </div>
        <button
          type='button'
          onClick={() => showUnderDevelopmentAlert(t)}
          className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
          {t('agenda.viewAll')}
          <Icon icon='tabler:arrow-up-right' height={14} width={14} />
        </button>
      </div>

      {/* Summary counts */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4'>
        <StatBlock
          icon='solar:calendar-mark-line-duotone'
          count={counts.total}
          labelKey='agenda.summary.total'
          iconClass='bg-lightprimary text-primary'
          t={t}
        />
        <StatBlock
          icon='solar:check-circle-line-duotone'
          count={counts.confirmado}
          labelKey='agenda.summary.confirmed'
          iconClass='bg-lightsuccess text-success'
          t={t}
        />
        <StatBlock
          icon='solar:clock-circle-line-duotone'
          count={counts.pendiente}
          labelKey='agenda.summary.pending'
          iconClass='bg-lightwarning text-warning'
          t={t}
        />
        <StatBlock
          icon='solar:check-read-line-duotone'
          count={counts.atendido}
          labelKey='agenda.summary.attended'
          iconClass='bg-lightinfo text-info'
          t={t}
        />
      </div>

      {/* Appointment list */}
      <div className='divide-y divide-border dark:divide-darkborder'>
        {TODAYS_APPOINTMENTS.length === 0 ? (
          <p className='text-sm text-link dark:text-darklink italic py-4'>
            {t('agenda.empty')}
          </p>
        ) : (
          TODAYS_APPOINTMENTS.map((appt) => {
            const tColor = getTreatmentColor(appt.treatmentLabel)
            const sStyle = STATUS_STYLE[appt.status]
            return (
              <div
                key={appt.id}
                className='flex items-stretch gap-3 py-2.5 first:pt-0 last:pb-0'>
                {/* Left color bar = treatment identity. Per Andrés 2026-06-30:
                    "barra izquierda = tratamiento". Thin and full-height so it
                    reads at a glance without a text label. */}
                <span
                  className={`w-1 shrink-0 self-stretch rounded-full ${tColor.dotClass}`}
                  title={t(tColor.labelKey as TranslationKey)}
                  aria-hidden='true'
                />

                {/* Time */}
                <div className='shrink-0 w-12 self-center text-sm font-semibold text-dark dark:text-white tabular-nums'>
                  {appt.time}
                </div>

                {/* Patient + treatment */}
                <div className='flex-1 min-w-0 self-center'>
                  <div className='text-sm font-medium text-dark dark:text-white truncate'>
                    {appt.patientName}
                  </div>
                  <div className='text-xs text-link dark:text-darklink truncate'>
                    {appt.treatmentLabel}
                  </div>
                </div>

                {/* Pro + sucursal (hidden on narrow screens) */}
                <div className='hidden md:block shrink-0 self-center text-xs text-link dark:text-darklink text-right'>
                  <div className='truncate max-w-[120px]'>
                    {t('agenda.with')} {appt.professional}
                  </div>
                  <div className='truncate max-w-[120px]'>
                    {SUCURSAL_LABELS[appt.sucursal]}
                  </div>
                </div>

                {/* Right dot = appointment status. Per Andrés: "punto derecho =
                    estado", color only, no text, a touch more visible. The
                    status name shows on hover for accessibility. */}
                <span
                  className={`shrink-0 self-center h-2.5 w-2.5 rounded-full ${sStyle.dot}`}
                  title={t(sStyle.labelKey)}
                />
              </div>
            )
          })
        )}
      </div>
    </CardBox>
  )
}

export default AgendaDay