'use client'

import Link from 'next/link'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

type Tile = {
  key: string
  labelKey: TranslationKey
  icon: string
  iconBg: string
  iconColor: string
  url: string
  underDevelopment?: boolean
}

const TILES: Tile[] = [
  {
    key: 'searchPatient',
    labelKey: 'quickAccess.searchPatient',
    icon: 'solar:magnifer-line-duotone',
    iconBg: 'bg-lightprimary',
    iconColor: 'text-primary',
    url: '/pacientes',
  },
  {
    key: 'openAgenda',
    labelKey: 'quickAccess.openAgenda',
    icon: 'solar:calendar-mark-line-duotone',
    iconBg: 'bg-lightsecondary',
    iconColor: 'text-secondary',
    url: '#',
    underDevelopment: true,
  },
  {
    key: 'newPatient',
    labelKey: 'quickAccess.newPatient',
    icon: 'solar:user-plus-line-duotone',
    iconBg: 'bg-lightsuccess',
    iconColor: 'text-success',
    url: '/pacientes',
  },
  {
    key: 'inventory',
    labelKey: 'quickAccess.inventory',
    icon: 'solar:box-line-duotone',
    iconBg: 'bg-lightwarning',
    iconColor: 'text-warning',
    url: '#',
    underDevelopment: true,
  },
  {
    key: 'reports',
    labelKey: 'quickAccess.reports',
    icon: 'solar:chart-line-duotone',
    iconBg: 'bg-lighterror',
    iconColor: 'text-error',
    url: '#',
    underDevelopment: true,
  },
  {
    key: 'config',
    labelKey: 'quickAccess.config',
    icon: 'solar:tuning-3-line-duotone',
    iconBg: 'bg-lightinfo',
    iconColor: 'text-info',
    url: '/configuracion',
  },
  {
    // Stats is a separate module concept (not just a route), so we mark it
    // visually with a filled primary icon instead of the muted tints used by
    // the navigation tiles.
    key: 'stats',
    labelKey: 'quickAccess.stats',
    icon: 'solar:chart-square-line-duotone',
    iconBg: 'bg-primary',
    iconColor: 'text-white',
    url: '/estadisticas',
  },
]

function showUnderDevelopmentAlert(itemName: string, t: TFn) {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  Swal.fire({
    title: t('alerts.underDevelopmentTitle'),
    text: t('alerts.underDevelopmentBody', { section: itemName }),
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

const QuickAccess = () => {
  const { t } = useTranslation()

  return (
    <CardBox className='h-full w-full'>
      <div className='grid grid-cols-2 gap-2'>
        {TILES.map((tile) => {
          const label = t(tile.labelKey)
          // Statistics is the highlighted CTA — span both columns so it stays
          // visually distinct AND fills the otherwise-orphan last row (7 tiles
          // in a 2-col grid would leave it alone otherwise).
          const colSpan = tile.key === 'stats' ? 'col-span-2' : ''
          const inner = (
            <div className='flex items-center gap-3 px-3 py-2.5 rounded-md border border-border dark:border-darkborder hover:border-primary hover:bg-lightprimary/40 dark:hover:bg-lightprimary/20 transition-colors cursor-pointer'>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${tile.iconBg} ${tile.iconColor}`}>
                <Icon icon={tile.icon} height={18} width={18} />
              </div>
              <span className='text-sm font-medium text-dark dark:text-white flex-1 truncate'>
                {label}
              </span>
              <Icon
                icon='tabler:chevron-right'
                height={16}
                width={16}
                className='text-link dark:text-darklink opacity-60 shrink-0'
              />
            </div>
          )

          if (tile.underDevelopment) {
            return (
              <button
                type='button'
                key={tile.key}
                onClick={() => showUnderDevelopmentAlert(label, t)}
                className={`text-left ${colSpan}`}>
                {inner}
              </button>
            )
          }

          return (
            <Link key={tile.key} href={tile.url} className={`block ${colSpan}`}>
              {inner}
            </Link>
          )
        })}
      </div>
    </CardBox>
  )
}

export default QuickAccess