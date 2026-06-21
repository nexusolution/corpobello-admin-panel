'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Icon } from '@iconify/react'
import Link from 'next/link'
import Profile from './Profile'
import Language from './Language'
import Notifications from './Notifications'
import SidebarLayout from '../sidebar/Sidebar'
import FullLogo from '../shared/logo/FullLogo'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

const appLinks = [
  { name: 'Notes', url: '/apps/notes' },
  { name: 'Tickets', url: '/apps/tickets' },
  { name: 'Blog', url: '/apps/blog/post' },
]

const navLinks = [
  { name: 'Chat', url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/chats' },
  { name: 'Calendar', url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/calendar' },
  { name: 'Email', url: 'https://modernize-tailwind-nextjs-main.vercel.app/apps/email' },
]

const Header = ({ onToggleSidebar }: { onToggleSidebar?: () => void }) => {
  const { theme, setTheme } = useTheme()
  const [isSticky, setIsSticky] = useState(false)
  const [mobileMenu, setMobileMenu] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsSticky(true)
      } else {
        setIsSticky(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Close the mobile actions panel on outside click, but keep it open while
  // interacting with the nested dropdown popovers (rendered in Radix portals).
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        actionsRef.current &&
        !actionsRef.current.contains(target) &&
        !target.closest('[data-radix-popper-content-wrapper]')
      ) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleMode = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'))
  }

  return (
    <>
      <header
        ref={actionsRef}
        className={`sticky top-0 z-2 ${
          isSticky ? 'bg-background shadow-md fixed w-full' : 'bg-transparent'
        }`}>
        <nav
          className={`rounded-none  py-4 sm:ps-6 max-w-full! sm:pe-10 dark:bg-dark flex justify-between items-center px-6`}>
          {/* Mobile / Tablet header: hamburger - centered logo - overflow menu */}
          <div className='flex xl:hidden items-center justify-between w-full relative'>
            {/* Hamburger (opens sidebar) */}
            <button
              onClick={() => setIsOpen(true)}
              aria-label='Menu'
              className='text-link dark:text-darklink hover:text-primary p-2 rounded-full hover:bg-lightprimary cursor-pointer'>
              <Icon icon='tabler:menu-2' height={22} width={22} />
            </button>

            {/* Centered logo */}
            <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
              <FullLogo />
            </div>

            {/* Overflow (...) toggle */}
            <button
              onClick={() => setActionsOpen((o) => !o)}
              aria-label='More'
              className='text-link dark:text-darklink hover:text-primary p-2 rounded-full hover:bg-lightprimary cursor-pointer'>
              <Icon icon='tabler:dots' height={22} width={22} />
            </button>
          </div>

          <div className='hidden xl:flex items-center justify-between w-full'>
            <div className='flex items-center gap-1'>
              {/* Hamburger */}
              <button
                onClick={onToggleSidebar}
                aria-label='Toggle sidebar'
                className='p-2 rounded-full text-link dark:text-darklink hover:bg-lightprimary hover:text-primary cursor-pointer'>
                <Icon icon='tabler:menu-2' height={20} width={20} />
              </button>

              {/* Search Icon */}
              <button
                aria-label='Search'
                className='p-2 rounded-full text-link dark:text-darklink hover:bg-lightprimary hover:text-primary cursor-pointer'>
                <Icon icon='solar:magnifer-linear' height={20} width={20} />
              </button>

              {/* Apps Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className='flex items-center gap-1 px-3 py-2 text-sm font-medium text-link dark:text-darklink hover:text-primary cursor-pointer'>
                    Apps
                    <Icon icon='tabler:chevron-down' height={16} width={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start' className='w-[180px] py-2 rounded-sm'>
                  {appLinks.map((item) => (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link
                        href={item.url}
                        className='px-4 py-2 flex items-center w-full text-sm hover:bg-lightprimary hover:text-primary'>
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Nav Links */}
              {navLinks.map((item) => (
                <Link
                  key={item.name}
                  href={item.url}
                  target='_blank'
                  className='px-3 py-2 text-sm font-medium text-link dark:text-darklink hover:text-primary'>
                  {item.name}
                </Link>
              ))}
            </div>
            <div className='flex w-full justify-end items-end'>
              <div className='flex gap-0 items-center '>
                {/* ✅ Dark/Light Toggle */}
                <div
                  className='hover:text-primary px-15 group focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-gray relative'
                  onClick={toggleMode}>
                  <span className='flex items-center justify-center relative after:absolute after:w-10 after:h-10 after:rounded-full after:-top-1/2   group-hover:after:bg-lightprimary'>
                    {theme === 'light' ? (
                      <Icon icon='tabler:moon' width='20' />
                    ) : (
                      <Icon
                        icon='solar:sun-bold-duotone'
                        width='20'
                        className='group-hover:text-primary'
                      />
                    )}
                  </span>
                </div>

                {/* Language Dropdown */}
                <Language />

                <div className='xl:block '>
                  <div className='flex gap-0 items-center relative'>
                    {/* Chat */}
                    <Notifications />
                  </div>
                </div>

                {/* Profile Dropdown */}
                <Profile />
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile / Tablet actions row (toggled by the ... button) */}
        <div
          className={`mobile-header-menu xl:hidden ${actionsOpen ? 'active' : ''}`}>
          <div className='mobile-actions flex items-center justify-center gap-6 py-2 px-6'>
            {/* Dark/Light toggle */}
            <button
              onClick={toggleMode}
              aria-label='Toggle theme'
              className='text-link dark:text-darklink hover:text-primary cursor-pointer'>
              <Icon
                icon={theme === 'light' ? 'tabler:moon' : 'solar:sun-bold-duotone'}
                height={20}
                width={20}
              />
            </button>

            {/* Notifications */}
            <Notifications />

            {/* Apps */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label='Apps'
                  className='text-link dark:text-darklink hover:text-primary cursor-pointer'>
                  <Icon icon='tabler:layout-grid' height={20} width={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='center' className='w-[180px] py-2 rounded-sm'>
                {appLinks.map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link
                      href={item.url}
                      className='px-4 py-2 flex items-center w-full text-sm hover:bg-lightprimary hover:text-primary'>
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language */}
            <Language />

            {/* Profile */}
            <Profile />
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side='left' className='w-64 p-0'>
          <VisuallyHidden>
            <SheetTitle>sidebar</SheetTitle>
          </VisuallyHidden>
          <SidebarLayout onClose={() => setIsOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}

export default Header
