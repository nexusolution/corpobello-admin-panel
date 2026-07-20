import type { Metadata } from 'next'

import { UsersTable } from './users-table'
import { HeroBanner } from '@/app/components/shared/HeroBanner'
import { AdminGate } from '@/lib/auth/AdminGate'

export const metadata: Metadata = {
  title: 'Usuarios · Panel Corpo Bello',
}

export default function UsuariosPage() {
  return (
    <AdminGate>
      <div className='space-y-6'>
        <HeroBanner
          titleKey='sidebar.users'
          currentKey='sidebar.users'
          icon='solar:shield-user-line-duotone'
        />
        <UsersTable />
      </div>
    </AdminGate>
  )
}