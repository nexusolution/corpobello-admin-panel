'use client'

import { useEffect, useState } from 'react'

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// The signed-in user, as the UI needs it: a display name and a role that
// drives what each screen prioritises (Andrés 2026-06-30 — same dashboard,
// reprioritised per role).
//
// The DB enum (app_users.role) is admin | operador | profesional (migration
// 0004 seeded the first two; 0005 added 'profesional'). All three drive the
// role-reprioritised dashboard and admin-page gating.
export type UserRole = 'admin' | 'operador' | 'profesional'

export interface CurrentUser {
  name: string
  role: UserRole
  loading: boolean
}

interface AppUserRow {
  display_name: string | null
  role: UserRole | null
}

// Reads the live Supabase session and the matching `app_users` row (role +
// display_name). While loading — or when Supabase isn't configured yet — it
// returns an empty name so the greeting renders without a dangling label.
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({
    name: '',
    role: 'operador',
    loading: true,
  })

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setUser({ name: '', role: 'operador', loading: false })
      return
    }

    let active = true
    const supabase = getSupabase()

    void (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        if (active) setUser({ name: '', role: 'operador', loading: false })
        return
      }

      const { data } = await supabase
        .from('app_users')
        .select('display_name, role')
        .eq('id', authUser.id)
        .single<AppUserRow>()

      if (!active) return

      const name =
        data?.display_name ?? authUser.email?.split('@')[0] ?? ''
      const role: UserRole = data?.role ?? 'operador'
      setUser({ name, role, loading: false })
    })()

    return () => {
      active = false
    }
  }, [])

  return user
}
