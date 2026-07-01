'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from './layout/header/Header'
import Sidebar from './layout/sidebar/Sidebar'

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Mock auth gate: until Supabase wires in, treat localStorage 'panel-auth'
  // as the session flag. Missing flag → redirect to login. The login form
  // sets the flag before navigating to '/'.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isAuthed = localStorage.getItem('panel-auth') === 'true'
    if (!isAuthed) {
      router.replace('/auth/login')
    } else {
      setAuthChecked(true)
    }
  }, [router])

  if (!authChecked) return null

  return (
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
  )
}
