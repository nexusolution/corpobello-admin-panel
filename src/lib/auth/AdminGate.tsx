'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useCurrentUser } from '@/lib/auth/useCurrentUser'

// Route-level guard for admin-only pages (Usuarios, Configuración). Hiding the
// sidebar entry isn't real protection — a non-admin can still type the URL — so
// the page content is wrapped here and non-admins are bounced to the dashboard.
//
// We wait for `loading` to settle before deciding: redirecting mid-load would
// bounce an admin during the brief window before their role resolves.
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { role, loading } = useCurrentUser()

  useEffect(() => {
    if (!loading && role !== 'admin') router.replace('/')
  }, [loading, role, router])

  if (loading || role !== 'admin') return null

  return <>{children}</>
}

export default AdminGate
