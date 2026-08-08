'use client'

import { Icon } from '@iconify/react'

import { PatientsTable } from './patients-table'
import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { RoleGate } from '@/lib/auth/RoleGate'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// ---------- KPI cards ----------

type Kpi = {
  value: string
  labelKey: TranslationKey
  hintKey: TranslationKey
  icon: string
  iconBg: string
  iconColor: string
  progressColor: string
  progressPercent: number
}

const KPIS: Kpi[] = [
  {
    value: '7',
    labelKey: 'pacientes.kpi.newThisMonth',
    hintKey: 'pacientes.kpi.newThisMonthHint',
    icon: 'solar:user-plus-line-duotone',
    iconBg: 'bg-lightwarning',
    iconColor: 'text-warning',
    progressColor: 'bg-warning',
    progressPercent: 35,
  },
  {
    value: '84',
    labelKey: 'pacientes.kpi.active',
    hintKey: 'pacientes.kpi.activeHint',
    icon: 'solar:users-group-two-rounded-line-duotone',
    iconBg: 'bg-lightprimary',
    iconColor: 'text-primary',
    progressColor: 'bg-primary',
    progressPercent: 70,
  },
  {
    value: '12',
    labelKey: 'pacientes.kpi.uncontacted',
    hintKey: 'pacientes.kpi.uncontactedHint',
    icon: 'solar:bell-bing-line-duotone',
    iconBg: 'bg-lighterror',
    iconColor: 'text-error',
    progressColor: 'bg-error',
    progressPercent: 22,
  },
  {
    value: '24',
    labelKey: 'pacientes.kpi.avgBetweenVisits',
    hintKey: 'pacientes.kpi.avgBetweenVisitsHint',
    icon: 'solar:clock-circle-line-duotone',
    iconBg: 'bg-lightsuccess',
    iconColor: 'text-success',
    progressColor: 'bg-success',
    progressPercent: 55,
  },
]

function KpiCard({ kpi, t }: { kpi: Kpi; t: TFn }) {
  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-4 sm:p-5'>
      <div className='flex items-start justify-between gap-3 mb-3'>
        <div className='min-w-0'>
          <div className='text-2xl font-bold text-dark dark:text-white'>
            {kpi.value}
          </div>
          <div className='text-sm text-link dark:text-darklink mt-0.5'>
            {t(kpi.labelKey)}
          </div>
          <div className='text-xs text-link dark:text-darklink/70 mt-0.5'>
            {t(kpi.hintKey)}
          </div>
        </div>
        <div
          className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${kpi.iconBg} ${kpi.iconColor}`}>
          <Icon icon={kpi.icon} height={20} width={20} />
        </div>
      </div>
      <div className='h-1 rounded-full bg-muted/40 dark:bg-darkmuted/40 overflow-hidden'>
        <div
          className={`h-1 rounded-full ${kpi.progressColor}`}
          style={{ width: `${kpi.progressPercent}%` }}
        />
      </div>
    </div>
  )
}

function KpiRow({ t }: { t: TFn }) {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
      {KPIS.map((kpi) => (
        <KpiCard key={kpi.labelKey} kpi={kpi} t={t} />
      ))}
    </div>
  )
}

// ---------- Page ----------

export default function PacientesPage() {
  const { t } = useTranslation()

  return (
    // General patient list is not part of the Profesional's clinical view.
    <RoleGate allow={['admin', 'operador']}>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='pacientes.title'
          currentKey='pacientes.breadcrumb.current'
          icon='solar:users-group-rounded-line-duotone'
        />
        <KpiRow t={t} />
        <PatientsTable />
      </div>
    </RoleGate>
  )
}