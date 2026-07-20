'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from './layout/header/Header'
import Sidebar from './layout/sidebar/Sidebar'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { FullPageSpinner } from '@/app/components/shared/FullPageSpinner'

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Auth gate: require a live Supabase session, else redirect to login. Also
  // re-check on auth-state changes (e.g. sign-out in another tab). When
  // Supabase isn't configured yet, send to login rather than expose the panel.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace('/auth/login')
      return
    }
    const supabase = getSupabase()
    let active = true

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) setAuthChecked(true)
      else router.replace('/auth/login')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (!session) router.replace('/auth/login')
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [router])

  // While the Supabase session is being verified, show a spinner instead of a
  // blank screen (the sidebar/header can't render until we know we're signed in).
  if (!authChecked) return <FullPageSpinner />

  return (
    <div className='flex w-full min-h-screen'>
      <div
        className={`page-wrapper flex w-full ${
          collapsed ? 'sidebar-collapsed' : ''
        }`}>
        {/* Header/sidebar */}
        <div
          className='xl:block hidden relative z-50'
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
