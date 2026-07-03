// Mock app_users — replaced by Supabase queries once auth + data layer land.

export type UserRole = 'admin' | 'operador' | 'profesional'
export type UserStatus = 'active' | 'inactive'
export type UserSucursal = 'caballito' | 'merlo' | 'moreno' | null

export type ActivityStatus = 'completed' | 'scheduled' | 'ongoing' | 'cancelled'

export type ActivityEntry = {
  id: string
  date: string // ISO
  /** Primary label — treatment name for profesional, action for operador, event for admin */
  primary: string
  /** Secondary label — patient name for profesional/operador, target entity for admin */
  secondary?: string
  /** Tertiary label — plan/details/branch/etc. */
  tertiary?: string
  status?: ActivityStatus
}

export type ProfessionalDetails = {
  yearsExperience: number
  patientsAttended: number
  rating: number
  specialties: string[]
}

export type OperatorDetails = {
  bookingsThisMonth: number
  callsHandled: number
  responseRate: number // 0..1
  shiftsSlot: string
}

export type AdminDetails = {
  lastLoginIso: string
  permissionsLevel: string
  createdUsers: number
  configChanges: number
}

export type AppUser = {
  id: string
  fullName: string
  email: string
  role: UserRole
  sucursal: UserSucursal
  status: UserStatus
  createdAt: string // ISO
  /** Optional avatar image URL. When absent the UI falls back to a default user icon. */
  avatarUrl?: string
  phone?: string
  location?: string
  bio?: string
  professionalDetails?: ProfessionalDetails
  operatorDetails?: OperatorDetails
  adminDetails?: AdminDetails
  activity?: ActivityEntry[]
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
    createdAt: '2024-04-15T10:00:00Z',
    avatarUrl: '/images/profile/doctor-02.webp',
    phone: '+54 11 5555-0110',
    location: 'CABA, Argentina',
    bio: 'Dueño y administrador principal del panel Corpo Bello.',
    adminDetails: {
      lastLoginIso: '2026-07-03T08:12:00Z',
      permissionsLevel: 'Super Admin',
      createdUsers: 12,
      configChanges: 34,
    },
    activity: [
      { id: 'a1-1', date: '2026-07-03T08:12:00Z', primary: 'Ingreso al panel', secondary: 'IP 190.12.44.10', status: 'completed' },
      { id: 'a1-2', date: '2026-07-01T14:22:00Z', primary: 'Creó usuario', secondary: 'Valentina Ríos', tertiary: 'operador', status: 'completed' },
      { id: 'a1-3', date: '2026-06-28T11:05:00Z', primary: 'Editó configuración', secondary: 'Bot / Mensaje bienvenida', status: 'completed' },
      { id: 'a1-4', date: '2026-06-25T16:40:00Z', primary: 'Aprobó comprobante', secondary: 'Carla Domínguez', tertiary: 'Endolift', status: 'completed' },
      { id: 'a1-5', date: '2026-06-22T09:15:00Z', primary: 'Editó catálogo de servicios', secondary: 'Depilación láser', status: 'completed' },
    ],
  },
  {
    id: '2',
    fullName: 'Sofía Vergara',
    email: 'sofia@corpobello.com',
    role: 'operador',
    sucursal: 'caballito',
    status: 'active',
    createdAt: '2025-04-20T09:00:00Z',
    avatarUrl: '/images/profile/user1.png',
    phone: '+54 11 5555-0121',
    location: 'Caballito, CABA',
    bio: 'Front desk de la sucursal Caballito, turnos y consultas.',
    operatorDetails: {
      bookingsThisMonth: 84,
      callsHandled: 132,
      responseRate: 0.94,
      shiftsSlot: 'Lun–Vie 09–17',
    },
    activity: [
      { id: 'a2-1', date: '2026-07-02T10:32:00Z', primary: 'Reserva creada', secondary: 'Lucía Alonso', tertiary: 'Depilación · Caballito', status: 'scheduled' },
      { id: 'a2-2', date: '2026-07-02T09:18:00Z', primary: 'Mensaje enviado', secondary: 'Pilar Ferrero', tertiary: 'Recordatorio de turno', status: 'completed' },
      { id: 'a2-3', date: '2026-07-01T17:04:00Z', primary: 'Comprobante recibido', secondary: 'Mariana Ibáñez', tertiary: 'Facial · Caballito', status: 'ongoing' },
      { id: 'a2-4', date: '2026-07-01T14:45:00Z', primary: 'Reserva cancelada', secondary: 'Sabrina Vega', tertiary: 'Tatuaje · Caballito', status: 'cancelled' },
      { id: 'a2-5', date: '2026-06-30T11:20:00Z', primary: 'Reserva creada', secondary: 'Julieta Ruiz', tertiary: 'Endolift · Caballito', status: 'scheduled' },
    ],
  },
  {
    id: '3',
    fullName: 'Lucas Méndez',
    email: 'lucas@corpobello.com',
    role: 'profesional',
    sucursal: 'merlo',
    status: 'active',
    createdAt: '2024-04-22T11:30:00Z',
    phone: '+54 11 5555-0134',
    location: 'Merlo, Buenos Aires',
    bio: 'Profesional a cargo de tratamientos láser y aparatología en Merlo.',
    professionalDetails: {
      yearsExperience: 8,
      patientsAttended: 412,
      rating: 4.7,
      specialties: ['Depilación láser', 'Endolift', 'Venus Legacy'],
    },
    activity: [
      { id: 'a3-1', date: '2026-07-02T12:00:00Z', primary: 'Depilación láser', secondary: 'María Paz Castro', tertiary: 'Sesión 4/8', status: 'completed' },
      { id: 'a3-2', date: '2026-07-02T10:30:00Z', primary: 'Endolift', secondary: 'Carla Domínguez', tertiary: 'Abdomen', status: 'completed' },
      { id: 'a3-3', date: '2026-07-01T15:15:00Z', primary: 'Venus Legacy', secondary: 'Florencia Peralta', tertiary: 'Celulitis piernas', status: 'ongoing' },
      { id: 'a3-4', date: '2026-07-01T11:00:00Z', primary: 'Depilación láser', secondary: 'Ana Fernández', tertiary: 'Sesión 1/8', status: 'scheduled' },
      { id: 'a3-5', date: '2026-06-30T16:45:00Z', primary: 'Endolift', secondary: 'Julieta Ruiz', tertiary: 'Rostro completo', status: 'completed' },
    ],
  },
  {
    id: '4',
    fullName: 'Mariana Sosa',
    email: 'mariana@corpobello.com',
    role: 'operador',
    sucursal: 'caballito',
    status: 'active',
    createdAt: '2025-05-02T14:00:00Z',
    avatarUrl: '/images/profile/user3.png',
    phone: '+54 11 5555-0145',
    location: 'Caballito, CABA',
    bio: 'Refuerzo del front desk, atiende consultas y confirma turnos.',
    operatorDetails: {
      bookingsThisMonth: 62,
      callsHandled: 98,
      responseRate: 0.88,
      shiftsSlot: 'Lun–Sáb 14–20',
    },
    activity: [
      { id: 'a4-1', date: '2026-07-02T18:12:00Z', primary: 'Reserva creada', secondary: 'Belén Álvarez', tertiary: 'Facial · Caballito', status: 'scheduled' },
      { id: 'a4-2', date: '2026-07-02T15:44:00Z', primary: 'Comprobante recibido', secondary: 'Sofía López', tertiary: 'Depilación · Caballito', status: 'completed' },
      { id: 'a4-3', date: '2026-07-01T19:00:00Z', primary: 'Mensaje enviado', secondary: 'Camila Ortiz', tertiary: 'Confirmación', status: 'completed' },
      { id: 'a4-4', date: '2026-06-30T17:22:00Z', primary: 'Reserva creada', secondary: 'Agustina Roldán', tertiary: 'Tatuaje · Caballito', status: 'scheduled' },
    ],
  },
  {
    id: '5',
    fullName: 'Federico Paz',
    email: 'federico@corpobello.com',
    role: 'profesional',
    sucursal: 'moreno',
    status: 'active',
    createdAt: '2025-05-10T16:00:00Z',
    phone: '+54 11 5555-0156',
    location: 'Moreno, Buenos Aires',
    bio: 'Especialista en tratamientos faciales y peel químico en Moreno.',
    professionalDetails: {
      yearsExperience: 6,
      patientsAttended: 218,
      rating: 4.6,
      specialties: ['Faciales', 'Peel químico', 'Melasma'],
    },
    activity: [
      { id: 'a5-1', date: '2026-07-02T14:00:00Z', primary: 'Facial hidratación', secondary: 'Silvia Roldán', tertiary: 'Sesión 2/4', status: 'completed' },
      { id: 'a5-2', date: '2026-07-01T11:30:00Z', primary: 'Peel químico', secondary: 'Nadia Espósito', tertiary: 'Rostro completo', status: 'completed' },
      { id: 'a5-3', date: '2026-06-30T15:45:00Z', primary: 'Melasma', secondary: 'Roxana Duarte', tertiary: 'Sesión 1/6', status: 'ongoing' },
      { id: 'a5-4', date: '2026-06-28T13:00:00Z', primary: 'Facial hidratación', secondary: 'Julia Correa', tertiary: 'Sesión 3/4', status: 'completed' },
    ],
  },
  {
    id: '6',
    fullName: 'Camila Torres',
    email: 'camila@corpobello.com',
    role: 'operador',
    sucursal: 'merlo',
    status: 'inactive',
    createdAt: '2025-03-12T08:00:00Z',
    avatarUrl: '/images/profile/user4.png',
    phone: '+54 11 5555-0167',
    location: 'Merlo, Buenos Aires',
    bio: 'Operadora del turno tarde en Merlo. Actualmente inactiva.',
    operatorDetails: {
      bookingsThisMonth: 0,
      callsHandled: 0,
      responseRate: 0.0,
      shiftsSlot: 'Sin turnos asignados',
    },
    activity: [
      { id: 'a6-1', date: '2026-05-15T18:00:00Z', primary: 'Última sesión', secondary: '—', tertiary: 'Cierre de turno', status: 'completed' },
    ],
  },
  {
    id: '7',
    fullName: 'Diego López',
    email: 'diego@corpobello.com',
    role: 'admin',
    sucursal: null,
    status: 'active',
    createdAt: '2025-04-18T12:00:00Z',
    phone: '+54 11 5555-0178',
    location: 'CABA, Argentina',
    bio: 'Administrador secundario, foco en reportes y configuración del bot.',
    adminDetails: {
      lastLoginIso: '2026-07-02T20:05:00Z',
      permissionsLevel: 'Admin',
      createdUsers: 5,
      configChanges: 18,
    },
    activity: [
      { id: 'a7-1', date: '2026-07-02T20:05:00Z', primary: 'Ingreso al panel', secondary: 'IP 190.10.55.42', status: 'completed' },
      { id: 'a7-2', date: '2026-07-01T13:15:00Z', primary: 'Exportó CSV', secondary: 'Pacientes / Julio 2026', status: 'completed' },
      { id: 'a7-3', date: '2026-06-29T10:00:00Z', primary: 'Editó plantilla', secondary: 'Recordatorio de turno', status: 'completed' },
    ],
  },
  {
    id: '8',
    fullName: 'Valentina Ríos',
    email: 'valentina@corpobello.com',
    role: 'operador',
    sucursal: 'caballito',
    status: 'active',
    createdAt: '2025-05-20T10:00:00Z',
    avatarUrl: '/images/profile/user5.png',
    phone: '+54 11 5555-0189',
    location: 'Caballito, CABA',
    bio: 'Nueva operadora de Caballito, en período de onboarding.',
    operatorDetails: {
      bookingsThisMonth: 41,
      callsHandled: 76,
      responseRate: 0.9,
      shiftsSlot: 'Mar–Sáb 10–18',
    },
    activity: [
      { id: 'a8-1', date: '2026-07-02T11:30:00Z', primary: 'Reserva creada', secondary: 'Denise Pombo', tertiary: 'Depilación · Caballito', status: 'scheduled' },
      { id: 'a8-2', date: '2026-07-01T16:00:00Z', primary: 'Mensaje enviado', secondary: 'Ivana Mora', tertiary: 'Consulta general', status: 'completed' },
      { id: 'a8-3', date: '2026-06-30T09:45:00Z', primary: 'Reserva creada', secondary: 'Antonella Vidal', tertiary: 'Facial · Caballito', status: 'scheduled' },
    ],
  },
]