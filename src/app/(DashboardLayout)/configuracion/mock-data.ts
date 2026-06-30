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

// ---------- Services catalog ----------

export type Service = {
  id: string
  name: string
  /** Treatment-color slug — joins to /lib/treatment-colors */
  categorySlug: string
  /** Price as a formatted display string (e.g. "$18.000" or "USD 1.200") */
  price: string
  /** Duration in minutes */
  durationMin: number
  active: boolean
}

export const INITIAL_SERVICES: Service[] = [
  { id: 'svc-1', name: 'Tatuaje pequeño — Remoción', categorySlug: 'tatuaje', price: '$18.000', durationMin: 60, active: true },
  { id: 'svc-2', name: 'Tatuaje grande — Remoción', categorySlug: 'tatuaje', price: '$45.000', durationMin: 90, active: true },
  { id: 'svc-3', name: 'Microblading', categorySlug: 'microblading', price: '$80.000', durationMin: 90, active: true },
  { id: 'svc-4', name: 'Microblading — Retoque', categorySlug: 'microblading', price: '$28.000', durationMin: 45, active: false },
  { id: 'svc-5', name: 'Endolift facial', categorySlug: 'endolift', price: 'USD 1.200', durationMin: 120, active: true },
  { id: 'svc-6', name: 'Láser axilas (sesión)', categorySlug: 'depilacion', price: '$15.000', durationMin: 30, active: true },
  { id: 'svc-7', name: 'Láser piernas (sesión)', categorySlug: 'depilacion', price: '$45.000', durationMin: 60, active: true },
  { id: 'svc-8', name: 'Faciales — Limpieza', categorySlug: 'facial', price: '$35.000', durationMin: 60, active: true },
  { id: 'svc-9', name: 'Faciales — Laserpeel', categorySlug: 'facial', price: '$55.000', durationMin: 75, active: true },
  { id: 'svc-10', name: 'Melasma — sesión', categorySlug: 'melasma', price: '$45.000', durationMin: 60, active: true },
  { id: 'svc-11', name: 'Acné — sesión', categorySlug: 'acne', price: '$30.000', durationMin: 45, active: true },
  { id: 'svc-12', name: 'Onicomicosis', categorySlug: 'other', price: '$22.000', durationMin: 30, active: false },
]

// ---------- Bot / WhatsApp settings ----------

export type BotTimeout = '5min' | '15min' | '30min' | '1h' | '4h'

export type BotSettings = {
  connectedNumber: string
  connected: boolean
  auto247: boolean
  handoffOnBooking: boolean
  surveyAfterAppointment: boolean
  timeout: BotTimeout
  welcomeMessage: string
}

export const INITIAL_BOT_SETTINGS: BotSettings = {
  connectedNumber: '+54 9 11 2686-4646',
  connected: true,
  auto247: true,
  handoffOnBooking: true,
  surveyAfterAppointment: false,
  timeout: '30min',
  welcomeMessage:
    'Hola {nombre} 👋 Soy el asistente de {clínica} en {sucursal}. ¿En qué te puedo ayudar hoy?',
}

export const BOT_TIMEOUT_OPTIONS: BotTimeout[] = ['5min', '15min', '30min', '1h', '4h']