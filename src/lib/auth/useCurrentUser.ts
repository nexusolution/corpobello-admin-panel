'use client'

// The signed-in user, as the UI needs it: a display name and a role that
// drives what each screen prioritises (Andrés 2026-06-30 — same dashboard,
// reprioritised per role).
export type UserRole = 'admin' | 'operador' | 'profesional'

export interface CurrentUser {
  name: string
  role: UserRole
}

// PHASE 1 (now): a placeholder so the role-aware UI can be built and reviewed
// before auth exists.
//
// PHASE 2 (Supabase Auth): replace the body with a read of the live session +
// the `app_users` role for the signed-in user. The return shape stays the
// same, so DashboardGreeting and any other consumer don't change.
export function useCurrentUser(): CurrentUser {
  return { name: 'Andrés', role: 'admin' }
}
