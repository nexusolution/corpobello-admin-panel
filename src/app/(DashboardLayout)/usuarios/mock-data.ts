// Mock app_users — replaced by Supabase queries once auth + data layer land.

export type UserRole = 'admin' | 'operador'
export type UserStatus = 'active' | 'inactive'
export type UserSucursal = 'caballito' | 'merlo' | 'moreno' | null

export type AppUser = {
  id: string
  fullName: string
  email: string
  role: UserRole
  sucursal: UserSucursal
  status: UserStatus
  createdAt: string // ISO
}

export const SUCURSAL_LABELS: Record<Exclude<UserSucursal, null>, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

export const MOCK_USERS: AppUser[] = [
  {
    id: '1',
    fullName: 'Andrés Romero',
    email: 'andres@corpobello.com',
    role: 'admin',
    sucursal: null,
    status: 'active',
    createdAt: '2026-04-15T10:00:00Z',
  },
  {
    id: '2',
    fullName: 'Sofía Vergara',
    email: 'sofia@corpobello.com',
    role: 'operador',
    sucursal: 'caballito',
    status: 'active',
    createdAt: '2026-04-20T09:00:00Z',
  },
  {
    id: '3',
    fullName: 'Lucas Méndez',
    email: 'lucas@corpobello.com',
    role: 'operador',
    sucursal: 'merlo',
    status: 'active',
    createdAt: '2026-04-22T11:30:00Z',
  },
  {
    id: '4',
    fullName: 'Mariana Sosa',
    email: 'mariana@corpobello.com',
    role: 'operador',
    sucursal: 'caballito',
    status: 'active',
    createdAt: '2026-05-02T14:00:00Z',
  },
  {
    id: '5',
    fullName: 'Federico Paz',
    email: 'federico@corpobello.com',
    role: 'operador',
    sucursal: 'moreno',
    status: 'active',
    createdAt: '2026-05-10T16:00:00Z',
  },
  {
    id: '6',
    fullName: 'Camila Torres',
    email: 'camila@corpobello.com',
    role: 'operador',
    sucursal: 'merlo',
    status: 'inactive',
    createdAt: '2026-03-12T08:00:00Z',
  },
  {
    id: '7',
    fullName: 'Diego López',
    email: 'diego@corpobello.com',
    role: 'admin',
    sucursal: null,
    status: 'active',
    createdAt: '2026-04-18T12:00:00Z',
  },
  {
    id: '8',
    fullName: 'Valentina Ríos',
    email: 'valentina@corpobello.com',
    role: 'operador',
    sucursal: 'caballito',
    status: 'active',
    createdAt: '2026-05-20T10:00:00Z',
  },
]