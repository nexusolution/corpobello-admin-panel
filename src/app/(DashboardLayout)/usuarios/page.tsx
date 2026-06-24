import type { Metadata } from 'next'
import { UsersTable } from './users-table'

export const metadata: Metadata = {
  title: 'Usuarios · Panel Corpo Bello',
}

export default function UsuariosPage() {
  return <UsersTable />
}