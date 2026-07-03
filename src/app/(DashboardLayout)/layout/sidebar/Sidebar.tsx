'use client'

import Link from 'next/link'
import Image from 'next/image'
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
          {SidebarContent.map((section, index) => (
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
                  ...(section.children || []),
                ],
                pathname,
                t,
                onClose
              )}
            </div>
          ))}
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
                <Image
                  src='/images/profile/doctor.png'
                  alt='Mathew'
                  width={36}
                  height={36}
                  className='rounded-full'
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Logout</TooltipContent>
          </Tooltip>
        ) : (
          <div className='flex items-center justify-between gap-2 bg-lightprimary rounded-lg p-4'>
            <div className='flex items-center gap-3 overflow-hidden'>
              <Image
                src='/images/profile/doctor.png'
                alt='Mathew'
                width={40}
                height={40}
                className='rounded-full shrink-0'
              />
              <div className='overflow-hidden'>
                <h5 className='text-sm font-semibold text-charcoal dark:text-white truncate'>
                  Mathew
                </h5>
                <span className='text-xs text-link dark:text-darklink'>
                  Designer
                </span>
              </div>
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
