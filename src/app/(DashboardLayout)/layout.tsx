'use client'

import { useState } from 'react'
import Header from './layout/header/Header'
import Sidebar from './layout/sidebar/Sidebar'
import { LanguageProvider } from '@/lib/i18n/context'

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [collapsed, setCollapsed] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <LanguageProvider>
      <div className='flex w-full min-h-screen'>
        <div
          className={`page-wrapper flex w-full ${
            collapsed ? 'sidebar-collapsed' : ''
          }`}>
          {/* Header/sidebar */}
          <div
            className='xl:block hidden'
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}>
            <Sidebar isCollapse={collapsed && !hovered} />
          </div>
          <div className='body-wrapper w-full bg-background'>
            {/* Top Header  */}
            <Header onToggleSidebar={() => setCollapsed((c) => !c)} />
            {/* Body Content  */}
            <div className='w-full px-6 py-30'>{children}</div>
          </div>
        </div>
      </div>
    </LanguageProvider>
  )
}
