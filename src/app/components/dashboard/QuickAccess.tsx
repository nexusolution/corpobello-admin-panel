'use client'

import Link from 'next/link'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

type Tile = {
  key: string
  labelKey: TranslationKey
  icon: string
  iconBg: string
  iconColor: string
  url: string
  underDevelopment?: boolean
  /** Links into an admin-gated page — hidden for non-admins so the tile
   *  doesn't offer a destination that would just bounce them back. */
  adminOnly?: boolean
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
    url: '/agenda',
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
    adminOnly: true,
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
  const { role, loading } = useCurrentUser()
  // Hide the admin-only tile while the role loads (never flash it), matching the
  // sidebar/header gate — see Sidebar.tsx canSeeAdmin.
  const canSeeAdmin = !loading && role === 'admin'
  const tiles = TILES.filter((tile) => canSeeAdmin || !tile.adminOnly)

  return (
    <CardBox className='h-full w-full'>
      {/* Header — title + subtitle, mirroring the sample card. */}
      <div className='mb-4'>
        <h5 className='card-title'>{t('quickAccess.title')}</h5>
        <p className='text-sm text-link dark:text-darklink mt-0.5'>{t('quickAccess.subtitle')}</p>
      </div>

      {/* Square tiles — icon on top, label below, dashed border; the CTA tile
          (Estadísticas) is highlighted with a solid border + accent bar. */}
      <div className='flex flex-wrap gap-3'>
        {tiles.map((tile) => {
          const label = t(tile.labelKey)
          const active = tile.key === 'stats'
          const inner = (
            // title = full label so a wrapped/long name reveals on hover.
            <div
              title={label}
              className={`relative flex flex-col items-center justify-center gap-2 w-[104px] h-[96px] p-2 rounded-lg text-center transition-colors cursor-pointer ${
                active
                  ? 'border border-solid border-primary/50 bg-lightprimary/30 dark:bg-lightprimary/10'
                  : 'border border-dashed border-border dark:border-darkborder hover:border-solid hover:border-primary hover:bg-lightprimary/30 dark:hover:bg-lightprimary/10'
              }`}>
              <Icon
                icon={tile.icon}
                height={26}
                width={26}
                className={active ? 'text-primary' : tile.iconColor}
              />
              <span className='text-[11px] font-medium leading-tight text-dark dark:text-white'>
                {label}
              </span>
              {active && (
                <span className='absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full bg-primary' />
              )}
            </div>
          )

          if (tile.underDevelopment) {
            return (
              <button
                type='button'
                key={tile.key}
                onClick={() => showUnderDevelopmentAlert(label, t)}
                className='text-left'>
                {inner}
              </button>
            )
          }

          return (
            <Link key={tile.key} href={tile.url} className='block'>
              {inner}
            </Link>
          )
        })}
      </div>
    </CardBox>
  )
}

export default QuickAccess