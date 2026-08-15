'use client'

import Link from 'next/link'
import Image from 'next/image'
import { UserAvatar } from '@/components/ui/user-avatar'
import { usePathname } from 'next/navigation'
import Swal from 'sweetalert2'
import SidebarContent from './Sidebaritems'
import SimpleBar from 'simplebar-react'
import { Icon } from '@iconify/react'
import FullLogo from '../shared/logo/FullLogo'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AMLogo,
  AMMenu,
  AMMenuItem,
  AMSidebar,
  AMSubmenu,
} from 'tailwind-sidebar'
import 'tailwind-sidebar/styles.css'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const showUnderDevelopmentAlert = (itemName: string, t: TFn) => {
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

const renderSidebarItems = (
  items: any[],
  currentPath: string,
  t: TFn,
  onClose?: () => void,
  isSubItem: boolean = false
) => {
  return items.map((item, index) => {
    const isSelected = currentPath === item?.url
    const IconComp = item.icon || null

    const iconElement = IconComp ? (
      <Icon icon={IconComp} height={21} width={21} />
    ) : (
      <Icon icon={'ri:checkbox-blank-circle-line'} height={9} width={9} />
    )

    // Resolve translatable labels — fall back to static text if no key set.
    const resolvedHeading = item.headingKey ? t(item.headingKey) : item.heading
    const resolvedName = item.nameKey ? t(item.nameKey) : item.name

    // Heading
    if (resolvedHeading) {
      return (
        <div className='mb-1' key={resolvedHeading}>
          <AMMenu
            subHeading={resolvedHeading}
            ClassName='hide-menu leading-21 text-charcoal font-bold uppercase text-xs dark:text-darkcharcoal'
          />
        </div>
      )
    }

    // Submenu
    if (item.children?.length) {
      return (
        <AMSubmenu
          key={item.id}
          icon={iconElement}
          title={resolvedName}
          ClassName='mt-0.5 text-link dark:text-darklink'>
          {renderSidebarItems(item.children, currentPath, t, onClose, true)}
        </AMSubmenu>
      )
    }

    // Regular menu item
    const linkTarget = item.url?.startsWith('https') ? '_blank' : '_self'

    const itemClassNames = isSubItem
      ? `mt-0.5 text-link dark:text-darklink !hover:bg-transparent ${isSelected ? '!bg-transparent !text-primary' : ''
      } !px-1.5`
      : `mt-0.5 text-link dark:text-darklink`

    // Under-development items: render without a Link, intercept click with SweetAlert.
    if (item.underDevelopment) {
      return (
        <div
          key={index}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            showUnderDevelopmentAlert(resolvedName, t)
            onClose?.()
          }}
          className='cursor-pointer'>
          <AMMenuItem
            key={item.id}
            icon={iconElement}
            isSelected={false}
            badge={!!item.isPro}
            badgeColor='bg-lightsecondary'
            badgeTextColor='text-secondary'
            disabled={item.disabled}
            badgeContent={item.isPro ? 'Pro' : undefined}
            className={`${itemClassNames}`}>
            <span className='truncate flex-1'>{item.title || resolvedName}</span>
          </AMMenuItem>
        </div>
      )
    }

    return (
      <div onClick={onClose} key={index}>
        <AMMenuItem
          key={item.id}
          icon={iconElement}
          isSelected={isSelected}
          link={item.url || undefined}
          target={linkTarget}
          badge={!!item.isPro}
          badgeColor='bg-lightsecondary'
          badgeTextColor='text-secondary'
          disabled={item.disabled}
          badgeContent={item.isPro ? 'Pro' : undefined}
          component={Link}
          className={`${itemClassNames}`}>
          <span className='truncate flex-1'>{item.title || resolvedName}</span>
        </AMMenuItem>
      </div>
    )
  })
}

const SidebarLayout = ({
  onClose,
  isCollapse = false,
}: {
  onClose?: () => void
  isCollapse?: boolean
}) => {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { name, role, avatar, loading } = useCurrentUser()

  const roleLabel = t(
    role === 'admin'
      ? 'users.role.admin'
      : role === 'operador'
        ? 'users.role.operador'
        : 'users.role.profesional'
  )

  // adminOnly entries (Usuarios, Configuración, reports, audit) are visible to
  // admins only. While the role is still loading we HIDE them (treat as
  // non-admin) so a user re-logging in as a non-admin never flashes the admin
  // menu before their real role resolves. An admin sees their section appear a
  // moment after load — a far smaller trade-off than leaking admin nav. Pairs
  // with the AdminGate route guard — hiding the link isn't enough on its own.
  const canSeeAdmin = !loading && role === 'admin'
  // Profesional sees only the clinical view — hide commercial/operational items
  // (general patient list, funnel, inventory). Wait for role to settle so we
  // don't briefly hide items from a still-resolving user.
  const isProfesional = !loading && role === 'profesional'

  // Sidebar stays dark regardless of theme so menu text reads on the black bg.
  const sidebarMode: 'light' | 'dark' = 'dark'

  return (
    <AMSidebar
      collapsible='none'
      animation={true}
      showProfile={false}
      width={'270px'}
      isCollapse={isCollapse}
      showTrigger={false}
      mode={sidebarMode}
      className='dark fixed left-0 top-0 border-r border-border dark:border-darkborder bg-[#212a3a] dark:bg-[#212a3a] z-10 h-screen'>
      {/* Logo */}
      <div
        className='flex items-center justify-center brand-logo overflow-hidden !m-0 !w-full !h-20 !border-0 px-2'>
        {isCollapse ? (
          <Link href='/' className='flex items-center justify-center w-full'>
            <Image
              src='/images/logos/logo-icon.webp'
              alt='Corpo Bello'
              width={48}
              height={48}
            />
          </Link>
        ) : (
          <AMLogo component={Link} href='/' img=''>
            <FullLogo />
          </AMLogo>
        )}
      </div>

      {/* Sidebar items */}

      <SimpleBar className='h-[calc(100vh-100px)]'>
        <div className={`pb-28 ${isCollapse ? 'px-3 mini-menu' : 'px-6'}`}>
          {/* Until the role resolves, show a neutral skeleton instead of a
              role-filtered list — otherwise the wrong role's items flash on
              login/re-login (e.g. operador items before profesional settles). */}
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg mb-1 ${
                    isCollapse ? 'justify-center py-2.5' : 'px-3 py-2.5'
                  }`}>
                  <span className='h-5 w-5 rounded bg-white/10 animate-pulse shrink-0' />
                  {!isCollapse && (
                    <span
                      className='h-3 rounded bg-white/10 animate-pulse'
                      style={{ width: `${55 + ((i * 13) % 35)}%` }}
                    />
                  )}
                </div>
              ))
            : SidebarContent.map((section, index) => {
            const visibleChildren = (section.children || []).filter(
              (child) =>
                (canSeeAdmin || !child.adminOnly) &&
                !(isProfesional && child.hideFromProfesional)
            )
            // Drop a whole section (and its heading) once every item in it is
            // admin-only and hidden — no orphan "Administración" heading.
            if (section.children?.length && visibleChildren.length === 0) {
              return null
            }
            return (
              <div key={index}>
                {renderSidebarItems(
                  [
                    ...(section.heading || section.headingKey
                      ? [
                          {
                            heading: section.heading,
                            headingKey: section.headingKey,
                          },
                        ]
                      : []),
                    ...visibleChildren,
                  ],
                  pathname,
                  t,
                  onClose
                )}
              </div>
            )
          })}
        </div>
      </SimpleBar>

      {/* Fixed Profile Card */}
      <div
        className={`absolute bottom-0 left-0 w-full pt-2 pb-4 bg-[#212a3a] dark:bg-[#212a3a] ${
          isCollapse ? 'px-2' : 'px-6'
        }`}>
        {isCollapse ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href='/auth/login'
                aria-label='Logout'
                className='flex justify-center bg-lightprimary rounded-lg p-2'>
                {loading ? (
                  <span className='h-9 w-9 rounded-full bg-white/60 animate-pulse' />
                ) : (
                  <UserAvatar name={name} src={avatar} size={36} />
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Logout</TooltipContent>
          </Tooltip>
        ) : (
          <div className='flex items-center justify-between gap-2 bg-lightprimary rounded-lg p-4'>
            <div className='flex items-center gap-3 overflow-hidden'>
              {loading ? (
                <span className='h-10 w-10 rounded-full bg-white/60 animate-pulse shrink-0' />
              ) : (
                <UserAvatar name={name} src={avatar} size={40} />
              )}
              {loading ? (
                <div className='overflow-hidden space-y-1.5'>
                  <span className='block h-3 w-24 rounded bg-white/60 animate-pulse' />
                  <span className='block h-2.5 w-16 rounded bg-white/40 animate-pulse' />
                </div>
              ) : (
                <div className='overflow-hidden'>
                  <h5 className='text-sm font-semibold text-charcoal dark:text-white truncate'>
                    {name || roleLabel}
                  </h5>
                  <span className='text-xs text-link dark:text-darklink'>{roleLabel}</span>
                </div>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href='/auth/login'
                  aria-label='Logout'
                  className='text-primary hover:text-primary shrink-0'>
                  <Icon icon='solar:power-bold' height={20} width={20} />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Logout</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </AMSidebar>
  )
}

export default SidebarLayout
