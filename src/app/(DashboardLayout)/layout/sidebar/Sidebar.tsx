'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
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

const showUnderDevelopmentAlert = (itemName: string) => {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  Swal.fire({
    title: 'En desarrollo',
    html: `<p style="margin:0 0 6px 0">La sección <strong>${itemName}</strong> aún no está disponible.</p><p style="margin:0;font-size:13px;opacity:.75">Se habilitará en una etapa posterior del proyecto.</p>`,
    icon: 'info',
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
  })
}

const renderSidebarItems = (
  items: any[],
  currentPath: string,
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

    // Heading
    if (item.heading) {
      return (
        <div className='mb-1' key={item.heading}>
          <AMMenu
            subHeading={item.heading}
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
          title={item.name}
          ClassName='mt-0.5 text-link dark:text-darklink'>
          {renderSidebarItems(item.children, currentPath, onClose, true)}
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
            showUnderDevelopmentAlert(item.name)
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
            <span className='truncate flex-1'>{item.title || item.name}</span>
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
          <span className='truncate flex-1'>{item.title || item.name}</span>
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
  const { theme } = useTheme()

  // Only allow "light" or "dark" for AMSidebar
  const sidebarMode = theme === 'light' || theme === 'dark' ? theme : undefined

  return (
    <AMSidebar
      collapsible='none'
      animation={true}
      showProfile={false}
      width={'270px'}
      isCollapse={isCollapse}
      showTrigger={false}
      mode={sidebarMode}
      className='fixed left-0 top-0 border border-border dark:border-darkborder bg-white dark:bg-dark z-10 h-screen'>
      {/* Logo */}
      <div
        className={`flex items-center brand-logo overflow-hidden ${
          isCollapse ? 'px-2 justify-center' : 'px-6'
        }`}>
        {isCollapse ? (
          <Link href='/' className='flex items-center justify-center w-full py-2'>
            <Image
              src='/images/logos/logo-icon.svg'
              alt='logo'
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
                  ...(section.heading ? [{ heading: section.heading }] : []),
                  ...(section.children || []),
                ],
                pathname,
                onClose
              )}
            </div>
          ))}
        </div>
      </SimpleBar>

      {/* Fixed Profile Card */}
      <div
        className={`absolute bottom-0 left-0 w-full pt-2 pb-4 bg-white dark:bg-dark ${
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
                  src='/images/profile/user-1.jpg'
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
                src='/images/profile/user-1.jpg'
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
