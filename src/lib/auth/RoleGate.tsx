'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useCurrentUser, type UserRole } from '@/lib/auth/useCurrentUser'

// Route-level guard that only lets the given roles through — the counterpart to
// AdminGate for pages that aren't admin-only but still shouldn't be reachable by
// every role. Hiding the sidebar/header entry isn't real protection (the URL can
// be typed), so the page content is wrapped here and disallowed roles are
// bounced to the dashboard.
//
// Used to keep the Profesional out of the commercial/operational surfaces
// (general patient list, Kanban, patient import) — their scoped clinical view
// arrives with Etapa 2/3. We wait for `loading` to settle before deciding so an
// allowed user isn't bounced during the brief window before their role resolves.
export function RoleGate({
  allow,
  children,
}: {
  allow: readonly UserRole[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const { role, loading } = useCurrentUser()
  const allowed = !!role && allow.includes(role)

  useEffect(() => {
    if (!loading && !allowed) router.replace('/')
  }, [loading, allowed, router])

  if (loading || !allowed) return null

  return <>{children}</>
}

export default RoleGate
