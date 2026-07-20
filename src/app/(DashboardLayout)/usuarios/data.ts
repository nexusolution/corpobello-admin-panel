// Live Supabase read/write for the Usuarios page. Reads `app_users` (Module A)
// and persists the two direct, non-destructive changes an admin makes here:
// role and active. RLS: everyone reads, only admins write — and this page is
// AdminGate-wrapped, so the writer is always an admin.
//
// NOT persisted (kept local for now): create, edit, delete. Those touch the
// Supabase Auth login account (creating/removing a user's ability to sign in),
// which needs the Auth admin API / dashboard, not an anon-key client write.

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { AppUser, UserRole } from './mock-data'

type AppUserRow = {
  id: string
  email: string | null
  display_name: string | null
  role: UserRole | null
  active: boolean | null
  created_at: string | null
}

export type UsersResult = {
  data: AppUser[]
  error: string | null
}

export async function fetchAppUsers(): Promise<UsersResult> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const { data, error } = await getSupabase()
    .from('app_users')
    .select('id, email, display_name, role, active, created_at')
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
