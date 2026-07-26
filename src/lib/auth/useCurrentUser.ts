'use client'

import { useEffect, useSyncExternalStore } from 'react'

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// The signed-in user, as the UI needs it: name + role (drives the
// role-reprioritised dashboard and admin-page gating) + avatar.
//
// The DB enum (app_users.role) is admin | operador | profesional (0004 seeded
// the first two; 0005 added 'profesional').
export type UserRole = 'admin' | 'operador' | 'profesional'

export interface CurrentUser {
  name: string
  email: string
  role: UserRole
  avatar: string | null
  loading: boolean
}

interface AppUserRow {
  display_name: string | null
  role: UserRole | null
  avatar_url: string | null
}

// ---------------------------------------------------------------------------
// Shared store — one fetch, one source of truth. Every component that calls
// useCurrentUser() subscribes to this, so a change (e.g. the user updates their
// avatar on the profile page) propagates to the sidebar + header immediately,
// with no page refresh. Backed by useSyncExternalStore.
// ---------------------------------------------------------------------------
let state: CurrentUser = {
  name: '',
  email: '',
  role: 'operador',
  avatar: null,
  loading: true,
}
let started = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
function getSnapshot(): CurrentUser {
  return state
}
function setState(next: CurrentUser) {
  state = next
  emit()
}

async function load() {
  if (!isSupabaseConfigured()) {
    setState({ name: '', email: '', role: 'operador', avatar: null, loading: false })
    return
  }
  const supabase = getSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) {
    setState({ name: '', email: '', role: 'operador', avatar: null, loading: false })
    return
  }
  const { data } = await supabase
    .from('app_users')
    .select('display_name, role, avatar_url')
    .eq('id', authUser.id)
    .single<AppUserRow>()

  const email = authUser.email ?? ''
  setState({
    name: data?.display_name ?? email.split('@')[0] ?? '',
    email,
    role: data?.role ?? 'operador',
    avatar: data?.avatar_url ?? null,
    loading: false,
  })
}

/** Update the shared avatar so every consumer re-renders at once. */
export function updateCurrentAvatar(url: string | null) {
  setState({ ...state, avatar: url })
}

export function useCurrentUser(): CurrentUser {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    if (!started) {
      started = true
      void load()
    }
  }, [])
  return snapshot
}
