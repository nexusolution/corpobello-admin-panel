// Mock initial values for the Configuración page. Replaced by Supabase
// queries against a `clinic_settings` row when the data layer wires in.

export type ScheduleDay = string // human-readable range like "09:00 – 19:00" or "Cerrado"

export type ClinicSettings = {
  name: string
  phone: string
  email: string
  address: string
  timezone: string
  currency: string
  logoUrl?: string
  schedule: {
    weekdays: ScheduleDay
    saturday: ScheduleDay
    sunday: ScheduleDay
  }
}

export const INITIAL_CLINIC_SETTINGS: ClinicSettings = {
  name: 'Corpo Bello',
  phone: '+54 9 11 5612-6183',
  email: 'corpob26@gmail.com',
  address: 'Av. Rivadavia 4500, CABA',
  timezone: 'America/Argentina/Buenos_Aires (GMT-3)',
  currency: 'ARS',
  schedule: {
    weekdays: '09:00 – 19:00',
    saturday: '09:00 – 14:00',
    sunday: 'Cerrado',
  },
}

export const TIMEZONE_OPTIONS = [
  'America/Argentina/Buenos_Aires (GMT-3)',
  'America/Mexico_City (GMT-6)',
  'America/Bogota (GMT-5)',
  'America/Santiago (GMT-4)',
  'America/New_York (GMT-5)',
  'Europe/Madrid (GMT+1)',
] as const

export const CURRENCY_OPTIONS = ['ARS', 'USD', 'MXN', 'CLP', 'COP', 'EUR'] as const