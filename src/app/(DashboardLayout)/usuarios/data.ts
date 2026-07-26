// Live Supabase read/write for the Usuarios page. Reads `app_users` (Module A)
// and persists the two direct, non-destructive changes an admin makes here:
// role and active. RLS: everyone reads, only admins write — and this page is
// AdminGate-wrapped, so the writer is always an admin.
//
// Create goes through the server route /api/users/create (service_role) since
// making an Auth login can't be done with the browser anon key. Edit persists
// name+role; delete stays local (removing an Auth account also needs the admin
// API — a future follow-up).

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { AppUser, UserRole } from './mock-data'

type AppUserRow = {
  id: string
  email: string | null
  display_name: string | null
  role: UserRole | null
  active: boolean | null
  created_at: string | null
  avatar_url: string | null
}

export type UsersResult = {
  data: AppUser[]
  error: string | null
}

export async function fetchAppUsers(): Promise<UsersResult> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const { data, error } = await getSupabase()
    .from('app_users')
    .select('id, email, display_name, role, active, created_at, avatar_url')
    .order('created_at', { ascending: true })

  if (error) return { data: [], error: error.message }

  const users: AppUser[] = (data as AppUserRow[]).map((row) => ({
    id: row.id,
    fullName: row.display_name?.trim() || row.email || 'Sin nombre',
    email: row.email ?? '',
    role: (row.role ?? 'operador') as UserRole,
    // No sucursal / phone / rich details columns on app_users — the card
    // gracefully falls back (fewer stats, email shown instead of location).
    sucursal: null,
    status: row.active === false ? 'inactive' : 'active',
    createdAt: row.created_at ?? '',
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  }))

  return { data: users, error: null }
}

/** Persist a role change. Best-effort; returns an error string on failure. */
export async function persistUserRole(
  id: string,
  role: UserRole,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('app_users').update({ role }).eq('id', id)
  return error ? error.message : null
}

/** Persist an active/inactive toggle. */
export async function persistUserActive(
  id: string,
  active: boolean,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase().from('app_users').update({ active }).eq('id', id)
  return error ? error.message : null
}

/**
 * Create a real user (Auth login + app_users row) via the server route. The
 * caller's session token is forwarded so the route can verify admin rights.
 */
export async function createUser(fields: {
  email: string
  password: string
  displayName: string
  role: UserRole
}): Promise<{ user: AppUser | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { user: null, error: 'not-configured' }
  const {
    data: { session },
  } = await getSupabase().auth.getSession()
  const token = session?.access_token
  if (!token) return { user: null, error: 'no-session' }

  const res = await fetch('/api/users/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(fields),
  })
  const json = (await res.json().catch(() => ({}))) as {
    id?: string
    error?: string
  }
  if (!res.ok || !json.id) {
    return { user: null, error: json.error ?? `error-${res.status}` }
  }
  return {
    user: {
      id: json.id,
      fullName: fields.displayName,
      email: fields.email,
      role: fields.role,
      sucursal: null,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    error: null,
  }
}

/** Persist a display-name change (app_users.display_name). */
export async function persistUserName(
  id: string,
  displayName: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { error } = await getSupabase()
    .from('app_users')
    .update({ display_name: displayName })
    .eq('id', id)
  return error ? error.message : null
}
