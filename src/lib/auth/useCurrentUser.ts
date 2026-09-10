'use client'

import { useEffect, useSyncExternalStore } from 'react'

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

// The signed-in user, as the UI needs it: name + role (drives the
// role-reprioritised dashboard and admin-page gating) + avatar.
//
// The DB enum (app_users.role) is admin | operador | profesional (0004 seeded
// the first two; 0005 added 'profesional').
export type UserRole = 'admin' | 'operador' | 'profesional'

const ALL_ROLES: readonly UserRole[] = ['admin', 'operador', 'profesional']
function isUserRole(v: unknown): v is UserRole {
  return typeof v === 'string' && (ALL_ROLES as readonly string[]).includes(v)
}

// Dual role (Andrés 2026-09-07): one person can be Operador in the morning and
// Profesional in the afternoon. app_users.roles (text[], migration 0039) lists
// every role they hold; `role` below is the ACTIVE one, which they switch from
// the header. All gating reads `role`, so a mode switch reprioritises the whole
// panel (nav, agenda lock, admin gate) with no other change. The choice is
// remembered per user in localStorage.
const ACTIVE_ROLE_KEY = 'cb.activeRole'

export interface CurrentUser {
  name: string
  email: string
  userId: string | null
  // The active role — what every permission/gate check uses.
  role: UserRole
  // Every role the user holds (>= 1). length > 1 shows the mode switcher.
  roles: UserRole[]
  avatar: string | null
  loading: boolean
}

interface AppUserRow {
  display_name: string | null
  role: UserRole | null
  roles: string[] | null
  avatar_url: string | null
}

// ---------------------------------------------------------------------------
// Shared store — one fetch, one source of truth. Every component that calls
// useCurrentUser() subscribes to this, so a change (e.g. the user updates their
// avatar on the profile page, or switches mode) propagates to the sidebar +
// header immediately, with no page refresh. Backed by useSyncExternalStore.
// ---------------------------------------------------------------------------
const EMPTY: CurrentUser = {
  name: '',
  email: '',
  userId: null,
  role: 'operador',
  roles: [],
  avatar: null,
  loading: false,
}
let state: CurrentUser = { ...EMPTY, loading: true }
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

// The roles the user holds, from app_users.roles (preferred) or the single
// `role` column (backward compatible), always at least one entry.
function resolveRoles(row: AppUserRow | null): UserRole[] {
  const fromArray = (row?.roles ?? []).filter(isUserRole)
  if (fromArray.length > 0) return Array.from(new Set(fromArray))
  if (isUserRole(row?.role)) return [row.role]
  return ['operador']
}

function storageKey(userId: string): string {
  return `${ACTIVE_ROLE_KEY}.${userId}`
}

// Which role to start active in: a single role has no choice; otherwise the
// remembered one if it's still valid, else the first.
function initialActiveRole(userId: string, roles: UserRole[]): UserRole {
  if (roles.length <= 1) return roles[0] ?? 'operador'
  try {
    const saved = window.localStorage.getItem(storageKey(userId))
    if (isUserRole(saved) && roles.includes(saved)) return saved
  } catch {
    /* private mode / storage blocked — fall through to default */
  }
  return roles[0] ?? 'operador'
}

async function load() {
  if (!isSupabaseConfigured()) {
    setState({ ...EMPTY })
    return
  }
  const supabase = getSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) {
    setState({ ...EMPTY })
    return
  }
  const { data } = await supabase
    .from('app_users')
    .select('display_name, role, roles, avatar_url')
    .eq('id', authUser.id)
    .single<AppUserRow>()

  const email = authUser.email ?? ''
  const roles = resolveRoles(data)
  setState({
    name: data?.display_name ?? email.split('@')[0] ?? '',
    email,
    userId: authUser.id,
    role: initialActiveRole(authUser.id, roles),
    roles,
    avatar: data?.avatar_url ?? null,
    loading: false,
  })
}

/** Update the shared avatar so every consumer re-renders at once. */
export function updateCurrentAvatar(url: string | null) {
  setState({ ...state, avatar: url })
}

/**
 * Switch the active role (mode). No-op unless the user actually holds that role.
 * Persists the choice per user so it survives reloads, and updates every
 * consumer at once so nav/agenda/gates reprioritise immediately.
 */
export function setActiveRole(next: UserRole) {
  if (!state.roles.includes(next) || state.role === next) return
  if (state.userId) {
    try {
      window.localStorage.setItem(storageKey(state.userId), next)
    } catch {
      /* storage blocked — the switch still applies for this session */
    }
  }
  setState({ ...state, role: next })
}

/**
 * Reset the store to a clean loading state. Call this the moment a login is
 * initiated (before navigating in) so the previous user's resolved role can
 * never render for an instant — consumers show their skeleton until the new
 * identity loads. Fixes the "operador list flashes before profesional" glitch
 * on re-login, since router.push keeps this module singleton alive.
 */
export function markLoading() {
  setState({ ...EMPTY, loading: true })
}

// Start the store once: do the initial load AND subscribe to Supabase auth
// changes so a logout→login as a DIFFERENT user re-fetches the new identity
// instead of keeping the previous user's role/name until a page refresh.
// (Fixes: after logging in as profesional the admin dashboard showed until F5.)
function ensureStarted() {
  if (started) return
  started = true
  if (!isSupabaseConfigured()) {
    setState({ ...EMPTY })
    return
  }
  getSupabase().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      setState({ ...EMPTY })
      return
    }
    // SIGNED_IN / USER_UPDATED / TOKEN_REFRESHED / INITIAL_SESSION: clear the
    // previous identity immediately, then re-fetch the current one.
    setState({ ...EMPTY, loading: true })
    void load()
  })
  // Fallback initial fetch (covers the already-signed-in refresh case even if
  // INITIAL_SESSION isn't emitted). Idempotent with the listener.
  void load()
}

export function useCurrentUser(): CurrentUser {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    ensureStarted()
  }, [])
  return snapshot
}
