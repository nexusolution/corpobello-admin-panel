// Mock data for the Kanban preview. Replaced by Supabase queries once auth
// + data layer land in a later session.

import type { TranslationKey } from '@/lib/i18n/dictionaries'

export type Sucursal = 'caballito' | 'merlo' | 'moreno'

export type LeadStatus =
  | 'nuevo'
  | 'en_conversacion'
  | 'cotizado'
  | 'reservado'
  | 'comprobante'
  | 'confirmado'
  | 'sin_respuesta'
  | 'pausado'
  | 'archivado'
  | 'cancelado'

export type Tag = { label: string; color: string }

export type LeadQuote = {
  listAmount: number
  efectivoAmount?: number
  currency: 'ARS' | 'USD'
  sentAtHoursAgo: number
}

export type LeadPhoto = { url: string; label: string }

export type LeadConversation = {
  lastStage: string
  exchangeCount: number
  faqTopics: string[]
}

export type ComprobanteStatus = 'pending' | 'received' | 'verified'

export type LeadReservation = {
  slot: string // human-readable, e.g. "Vie 28 jun · 16:30"
  sucursal: Sucursal
  depositAmount: number
  depositCurrency: 'ARS' | 'USD'
  comprobanteStatus: ComprobanteStatus
  comprobanteUrl?: string
}

export type LeadNote = {
  text: string
  author: string
  createdAtHoursAgo: number
}

export type Lead = {
  id: string
  patientName: string
  phoneLast4: string
  phoneFull: string
  sucursal: Sucursal
  treatmentLabel: string
  lastActivityHoursAgo: number
  tags: Tag[]
  notesCount: number
  photosCount: number
  status: LeadStatus
  // Detail fields used by the lead detail dialog
  quote?: LeadQuote
  photos?: LeadPhoto[]
  conversation?: LeadConversation
  reservation?: LeadReservation
  internalNotes?: LeadNote[]
}

export type ColumnDef = {
  id: LeadStatus
  /** i18n key — resolved at render time so the column header follows the active locale. */
  nameKey: TranslationKey
  /** Tailwind bg-* class for the status dot. */
  dotColor: string
  primary: boolean
}

export const COLUMNS: ColumnDef[] = [
  // Primary pipeline
  { id: 'nuevo', nameKey: 'kanban.col.nuevo', dotColor: 'bg-info', primary: true },
  { id: 'en_conversacion', nameKey: 'kanban.col.enConversacion', dotColor: 'bg-warning', primary: true },
  { id: 'cotizado', nameKey: 'kanban.col.cotizado', dotColor: 'bg-secondary', primary: true },
  { id: 'reservado', nameKey: 'kanban.col.reservado', dotColor: 'bg-primary', primary: true },
  { id: 'comprobante', nameKey: 'kanban.col.comprobante', dotColor: 'bg-purple-500', primary: true },
  { id: 'confirmado', nameKey: 'kanban.col.confirmado', dotColor: 'bg-success', primary: true },
  // Secondary (collapsible)
  { id: 'sin_respuesta', nameKey: 'kanban.col.sinRespuesta', dotColor: 'bg-gray-400', primary: false },
  { id: 'pausado', nameKey: 'kanban.col.pausado', dotColor: 'bg-gray-400', primary: false },
  { id: 'archivado', nameKey: 'kanban.col.archivado', dotColor: 'bg-gray-400', primary: false },
  { id: 'cancelado', nameKey: 'kanban.col.cancelado', dotColor: 'bg-error', primary: false },
]

export const SUCURSAL_LABELS: Record<Sucursal, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

const TAG_META: Tag = { label: 'Meta Ads', color: '#5d87ff' }
const TAG_REFERIDO: Tag = { label: 'Referido', color: '#13deb9' }
const TAG_WALKIN: Tag = { label: 'Walk-in', color: '#8754ec' }
const TAG_VIP: Tag = { label: 'VIP', color: '#f6b51e' }

// Helper to fabricate a plausible AR phone number from the last-4 digits.
const phone = (last4: string) => `+54 9 11 4${last4.slice(0, 1)}${last4.slice(0, 2)}-${last4}`

// Mock photo placeholders — reusing existing kanban background images so the
// modal renders something visual without external requests.
const PHOTO_TATTOO: LeadPhoto = {
  url: '/images/backgrounds/kanban-img-1.jpg',
  label: 'Tatuaje a remover',
}
const PHOTO_FACIAL: LeadPhoto = {
  url: '/images/backgrounds/kanban-img-2.jpg',
  label: 'Foto facial',
}
const PHOTO_ZONE: LeadPhoto = {
  url: '/images/backgrounds/kanban-img-3.jpg',
  label: 'Zona a tratar',
}

export const MOCK_LEADS: Lead[] = [
  // Nuevo (3) — minimal data, just arrived
  {
    id: '1', patientName: 'María González', phoneLast4: '4521', phoneFull: phone('4521'),
    sucursal: 'caballito', treatmentLabel: 'Tatuajes — Remoción',
    lastActivityHoursAgo: 0.5, tags: [TAG_META], notesCount: 0, photosCount: 0, status: 'nuevo',
    conversation: { lastStage: 'Eligió tratamiento — esperando foto', exchangeCount: 3, faqTopics: [] },
  },
  {
    id: '2', patientName: 'Lucía Fernández', phoneLast4: '8893', phoneFull: phone('8893'),
    sucursal: 'merlo', treatmentLabel: 'Microblading',
    lastActivityHoursAgo: 1, tags: [TAG_META], notesCount: 0, photosCount: 0, status: 'nuevo',
    conversation: { lastStage: 'Inició menú — eligió microblading', exchangeCount: 2, faqTopics: [] },
  },
  {
    id: '3', patientName: 'Sofía Martínez', phoneLast4: '2210', phoneFull: phone('2210'),
    sucursal: 'caballito', treatmentLabel: 'Faciales — Endolift',
    lastActivityHoursAgo: 2, tags: [TAG_META, TAG_VIP], notesCount: 1, photosCount: 0, status: 'nuevo',
    conversation: { lastStage: 'En FAQ — endolift', exchangeCount: 5, faqTopics: ['Precio', 'Duración'] },
    internalNotes: [{ text: 'Cliente recurrente, atender con prioridad.', author: 'Andrés', createdAtHoursAgo: 1.5 }],
  },

  // En conversación (4)
  {
    id: '4', patientName: 'Camila Rojas', phoneLast4: '7741', phoneFull: phone('7741'),
    sucursal: 'caballito', treatmentLabel: 'Láser — Axilas',
    lastActivityHoursAgo: 3, tags: [TAG_META], notesCount: 1, photosCount: 0, status: 'en_conversacion',
    conversation: { lastStage: 'Eligiendo zonas de láser', exchangeCount: 8, faqTopics: ['Sesiones necesarias', 'Cuidados post'] },
    internalNotes: [{ text: 'Consultó por paquete de 6 sesiones.', author: 'Andrés', createdAtHoursAgo: 2 }],
  },
  {
    id: '5', patientName: 'Valentina Pérez', phoneLast4: '5630', phoneFull: phone('5630'),
    sucursal: 'merlo', treatmentLabel: 'Faciales — Limpieza',
    lastActivityHoursAgo: 5, tags: [TAG_REFERIDO], notesCount: 2, photosCount: 1, status: 'en_conversacion',
    conversation: { lastStage: 'Esperando foto de evaluación', exchangeCount: 6, faqTopics: ['Duración', 'Frecuencia'] },
    photos: [PHOTO_FACIAL],
    internalNotes: [
      { text: 'Referida por Camila Rojas.', author: 'Andrés', createdAtHoursAgo: 4 },
      { text: 'Prefiere turnos de tarde.', author: 'Andrés', createdAtHoursAgo: 3 },
    ],
  },
  {
    id: '6', patientName: 'Florencia López', phoneLast4: '1145', phoneFull: phone('1145'),
    sucursal: 'moreno', treatmentLabel: 'Tatuajes — Remoción',
    lastActivityHoursAgo: 6, tags: [TAG_META], notesCount: 0, photosCount: 2, status: 'en_conversacion',
    conversation: { lastStage: 'Foto recibida — clasificando', exchangeCount: 4, faqTopics: ['Cantidad de sesiones'] },
    photos: [PHOTO_TATTOO, PHOTO_TATTOO],
  },
  {
    id: '7', patientName: 'Agustina Díaz', phoneLast4: '9067', phoneFull: phone('9067'),
    sucursal: 'caballito', treatmentLabel: 'Cicatrices',
    lastActivityHoursAgo: 8, tags: [TAG_WALKIN], notesCount: 1, photosCount: 0, status: 'en_conversacion',
    conversation: { lastStage: 'En FAQ — cicatrices', exchangeCount: 5, faqTopics: ['Tipo de cicatriz', 'Resultados esperados'] },
    internalNotes: [{ text: 'Viene de consulta presencial.', author: 'Andrés', createdAtHoursAgo: 7 }],
  },

  // Cotizado (3)
  {
    id: '8', patientName: 'Carolina Ruiz', phoneLast4: '3318', phoneFull: phone('3318'),
    sucursal: 'caballito', treatmentLabel: 'Láser — Piernas',
    lastActivityHoursAgo: 12, tags: [TAG_META], notesCount: 2, photosCount: 1, status: 'cotizado',
    quote: { listAmount: 45000, efectivoAmount: 36000, currency: 'ARS', sentAtHoursAgo: 11 },
    conversation: { lastStage: 'Esperando confirmación de reserva', exchangeCount: 10, faqTopics: ['Cuotas', 'Cuidados pre-sesión'] },
    photos: [PHOTO_ZONE],
    internalNotes: [
      { text: 'Mostró interés alto, hacer seguimiento mañana.', author: 'Andrés', createdAtHoursAgo: 10 },
      { text: 'Mencionó querer empezar antes del verano.', author: 'Andrés', createdAtHoursAgo: 6 },
    ],
  },
  {
    id: '9', patientName: 'Julieta Morales', phoneLast4: '6677', phoneFull: phone('6677'),
    sucursal: 'merlo', treatmentLabel: 'Venus Legacy',
    lastActivityHoursAgo: 18, tags: [TAG_META, TAG_VIP], notesCount: 3, photosCount: 2, status: 'cotizado',
    quote: { listAmount: 120000, efectivoAmount: 96000, currency: 'ARS', sentAtHoursAgo: 17 },
    conversation: { lastStage: 'Considerando paquete completo', exchangeCount: 14, faqTopics: ['Zonas combinadas', 'Resultados a 3 meses'] },
    photos: [PHOTO_FACIAL, PHOTO_ZONE],
    internalNotes: [
      { text: 'Atendida antes para depilación, muy buena cliente.', author: 'Andrés', createdAtHoursAgo: 17 },
      { text: 'Preguntó por combos con Endolift.', author: 'Andrés', createdAtHoursAgo: 15 },
      { text: 'Disponible solo los sábados.', author: 'Andrés', createdAtHoursAgo: 10 },
    ],
  },
  {
    id: '10', patientName: 'Antonella Vega', phoneLast4: '0204', phoneFull: phone('0204'),
    sucursal: 'moreno', treatmentLabel: 'Microblading — Retoque',
    lastActivityHoursAgo: 22, tags: [TAG_REFERIDO], notesCount: 1, photosCount: 0, status: 'cotizado',
    quote: { listAmount: 28000, currency: 'ARS', sentAtHoursAgo: 21 },
    conversation: { lastStage: 'Sin respuesta tras envío de cotización', exchangeCount: 7, faqTopics: ['Duración del retoque'] },
    internalNotes: [{ text: 'Retoque sobre trabajo de hace 8 meses.', author: 'Andrés', createdAtHoursAgo: 21 }],
  },

  // Reservado (2)
  {
    id: '11', patientName: 'Bianca Romero', phoneLast4: '5512', phoneFull: phone('5512'),
    sucursal: 'caballito', treatmentLabel: 'Endolift',
    lastActivityHoursAgo: 26, tags: [TAG_META], notesCount: 2, photosCount: 3, status: 'reservado',
    quote: { listAmount: 1200, currency: 'USD', sentAtHoursAgo: 30 },
    reservation: { slot: 'Sáb 5 jul · 11:00', sucursal: 'caballito', depositAmount: 100000, depositCurrency: 'ARS', comprobanteStatus: 'pending' },
    conversation: { lastStage: 'Esperando comprobante de seña', exchangeCount: 16, faqTopics: ['Cuidados pre-sesión'] },
    photos: [PHOTO_FACIAL, PHOTO_FACIAL, PHOTO_ZONE],
    internalNotes: [
      { text: 'Confirmar 24h antes del turno.', author: 'Andrés', createdAtHoursAgo: 24 },
      { text: 'Pagó en USDT BEP-20.', author: 'Andrés', createdAtHoursAgo: 1 },
    ],
  },
  {
    id: '12', patientName: 'Renata Costa', phoneLast4: '7799', phoneFull: phone('7799'),
    sucursal: 'merlo', treatmentLabel: 'Faciales — Foliculitis',
    lastActivityHoursAgo: 30, tags: [TAG_WALKIN], notesCount: 1, photosCount: 1, status: 'reservado',
    quote: { listAmount: 35000, currency: 'ARS', sentAtHoursAgo: 35 },
    reservation: { slot: 'Lun 30 jun · 17:00', sucursal: 'merlo', depositAmount: 30000, depositCurrency: 'ARS', comprobanteStatus: 'pending' },
    conversation: { lastStage: 'Esperando comprobante', exchangeCount: 11, faqTopics: ['Tratamiento previo'] },
    photos: [PHOTO_FACIAL],
    internalNotes: [{ text: 'Primera vez en Merlo.', author: 'Andrés', createdAtHoursAgo: 28 }],
  },

  // Comprobante (2)
  {
    id: '13', patientName: 'Manuela Aguirre', phoneLast4: '4408', phoneFull: phone('4408'),
    sucursal: 'caballito', treatmentLabel: 'Tatuaje — pequeño',
    lastActivityHoursAgo: 36, tags: [TAG_META], notesCount: 1, photosCount: 0, status: 'comprobante',
    quote: { listAmount: 18000, currency: 'ARS', sentAtHoursAgo: 40 },
    reservation: { slot: 'Mié 2 jul · 15:00', sucursal: 'caballito', depositAmount: 30000, depositCurrency: 'ARS', comprobanteStatus: 'received', comprobanteUrl: '/images/backgrounds/kanban-img-4.jpg' },
    conversation: { lastStage: 'Comprobante recibido — verificando', exchangeCount: 13, faqTopics: [] },
    internalNotes: [{ text: 'Verificar transferencia con banco.', author: 'Andrés', createdAtHoursAgo: 2 }],
  },
  {
    id: '14', patientName: 'Catalina Silva', phoneLast4: '1187', phoneFull: phone('1187'),
    sucursal: 'merlo', treatmentLabel: 'Faciales — Laserpeel',
    lastActivityHoursAgo: 40, tags: [TAG_META, TAG_VIP], notesCount: 4, photosCount: 2, status: 'comprobante',
    quote: { listAmount: 55000, efectivoAmount: 44000, currency: 'ARS', sentAtHoursAgo: 45 },
    reservation: { slot: 'Vie 4 jul · 10:30', sucursal: 'merlo', depositAmount: 30000, depositCurrency: 'ARS', comprobanteStatus: 'received', comprobanteUrl: '/images/backgrounds/kanban-img-4.jpg' },
    conversation: { lastStage: 'Comprobante recibido', exchangeCount: 18, faqTopics: ['Cuidados post', 'Tiempo de recuperación'] },
    photos: [PHOTO_FACIAL, PHOTO_FACIAL],
    internalNotes: [
      { text: 'Atendida muchas veces, full VIP.', author: 'Andrés', createdAtHoursAgo: 40 },
      { text: 'Preferencia: turnos AM.', author: 'Andrés', createdAtHoursAgo: 38 },
      { text: 'Quiere combinar con limpieza facial.', author: 'Andrés', createdAtHoursAgo: 30 },
      { text: 'Comprobante OK — confirmar turno.', author: 'Andrés', createdAtHoursAgo: 4 },
    ],
  },

  // Confirmado (1)
  {
    id: '15', patientName: 'Pilar Cabrera', phoneLast4: '9923', phoneFull: phone('9923'),
    sucursal: 'caballito', treatmentLabel: 'Onicomicosis',
    lastActivityHoursAgo: 48, tags: [TAG_REFERIDO], notesCount: 2, photosCount: 1, status: 'confirmado',
    quote: { listAmount: 22000, currency: 'ARS', sentAtHoursAgo: 60 },
    reservation: { slot: 'Jue 3 jul · 18:00', sucursal: 'caballito', depositAmount: 30000, depositCurrency: 'ARS', comprobanteStatus: 'verified', comprobanteUrl: '/images/backgrounds/kanban-img-4.jpg' },
    conversation: { lastStage: 'Turno confirmado', exchangeCount: 12, faqTopics: ['Cantidad de sesiones'] },
    photos: [PHOTO_ZONE],
    internalNotes: [
      { text: 'Referida por su hermana.', author: 'Andrés', createdAtHoursAgo: 48 },
      { text: 'Confirmado por WhatsApp 24h antes.', author: 'Andrés', createdAtHoursAgo: 5 },
    ],
  },

  // Sin respuesta (2)
  {
    id: '16', patientName: 'Mariana Pinto', phoneLast4: '2244', phoneFull: phone('2244'),
    sucursal: 'moreno', treatmentLabel: 'Verrugas',
    lastActivityHoursAgo: 96, tags: [TAG_META], notesCount: 0, photosCount: 0, status: 'sin_respuesta',
    conversation: { lastStage: 'Sin respuesta tras menú inicial', exchangeCount: 2, faqTopics: [] },
  },
  {
    id: '17', patientName: 'Daniela Sosa', phoneLast4: '6731', phoneFull: phone('6731'),
    sucursal: 'merlo', treatmentLabel: 'Faciales — Limpieza',
    lastActivityHoursAgo: 120, tags: [TAG_META], notesCount: 1, photosCount: 0, status: 'sin_respuesta',
    conversation: { lastStage: 'Sin respuesta tras envío de info', exchangeCount: 4, faqTopics: ['Precio'] },
    internalNotes: [{ text: 'Consultó precio y no respondió.', author: 'Andrés', createdAtHoursAgo: 115 }],
  },

  // Archivado (1)
  {
    id: '18', patientName: 'Ximena Torres', phoneLast4: '3380', phoneFull: phone('3380'),
    sucursal: 'caballito', treatmentLabel: 'Microblading',
    lastActivityHoursAgo: 720, tags: [TAG_META], notesCount: 2, photosCount: 0, status: 'archivado',
    conversation: { lastStage: 'Conversación cerrada', exchangeCount: 6, faqTopics: ['Precio', 'Duración'] },
    internalNotes: [
      { text: 'No coincidió disponibilidad.', author: 'Andrés', createdAtHoursAgo: 700 },
      { text: 'Volver a contactar en 3 meses.', author: 'Andrés', createdAtHoursAgo: 720 },
    ],
  },
]