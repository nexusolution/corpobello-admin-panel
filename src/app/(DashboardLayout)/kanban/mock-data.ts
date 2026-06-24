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

export type Lead = {
  id: string
  patientName: string
  phoneLast4: string
  sucursal: Sucursal
  treatmentLabel: string
  lastActivityHoursAgo: number
  tags: Tag[]
  notesCount: number
  photosCount: number
  status: LeadStatus
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

export const MOCK_LEADS: Lead[] = [
  // Nuevo (3)
  { id: '1', patientName: 'María González', phoneLast4: '4521', sucursal: 'caballito', treatmentLabel: 'Tatuajes — Remoción', lastActivityHoursAgo: 0.5, tags: [TAG_META], notesCount: 0, photosCount: 0, status: 'nuevo' },
  { id: '2', patientName: 'Lucía Fernández', phoneLast4: '8893', sucursal: 'merlo', treatmentLabel: 'Microblading', lastActivityHoursAgo: 1, tags: [TAG_META], notesCount: 0, photosCount: 0, status: 'nuevo' },
  { id: '3', patientName: 'Sofía Martínez', phoneLast4: '2210', sucursal: 'caballito', treatmentLabel: 'Faciales — Endolift', lastActivityHoursAgo: 2, tags: [TAG_META, TAG_VIP], notesCount: 1, photosCount: 0, status: 'nuevo' },

  // En conversación (4)
  { id: '4', patientName: 'Camila Rojas', phoneLast4: '7741', sucursal: 'caballito', treatmentLabel: 'Láser — Axilas', lastActivityHoursAgo: 3, tags: [TAG_META], notesCount: 1, photosCount: 0, status: 'en_conversacion' },
  { id: '5', patientName: 'Valentina Pérez', phoneLast4: '5630', sucursal: 'merlo', treatmentLabel: 'Faciales — Limpieza', lastActivityHoursAgo: 5, tags: [TAG_REFERIDO], notesCount: 2, photosCount: 1, status: 'en_conversacion' },
  { id: '6', patientName: 'Florencia López', phoneLast4: '1145', sucursal: 'moreno', treatmentLabel: 'Tatuajes — Remoción', lastActivityHoursAgo: 6, tags: [TAG_META], notesCount: 0, photosCount: 2, status: 'en_conversacion' },
  { id: '7', patientName: 'Agustina Díaz', phoneLast4: '9067', sucursal: 'caballito', treatmentLabel: 'Cicatrices', lastActivityHoursAgo: 8, tags: [TAG_WALKIN], notesCount: 1, photosCount: 0, status: 'en_conversacion' },

  // Cotizado (3)
  { id: '8', patientName: 'Carolina Ruiz', phoneLast4: '3318', sucursal: 'caballito', treatmentLabel: 'Láser — Piernas', lastActivityHoursAgo: 12, tags: [TAG_META], notesCount: 2, photosCount: 1, status: 'cotizado' },
  { id: '9', patientName: 'Julieta Morales', phoneLast4: '6677', sucursal: 'merlo', treatmentLabel: 'Venus Legacy', lastActivityHoursAgo: 18, tags: [TAG_META, TAG_VIP], notesCount: 3, photosCount: 2, status: 'cotizado' },
  { id: '10', patientName: 'Antonella Vega', phoneLast4: '0204', sucursal: 'moreno', treatmentLabel: 'Microblading — Retoque', lastActivityHoursAgo: 22, tags: [TAG_REFERIDO], notesCount: 1, photosCount: 0, status: 'cotizado' },

  // Reservado (2)
  { id: '11', patientName: 'Bianca Romero', phoneLast4: '5512', sucursal: 'caballito', treatmentLabel: 'Endolift', lastActivityHoursAgo: 26, tags: [TAG_META], notesCount: 2, photosCount: 3, status: 'reservado' },
  { id: '12', patientName: 'Renata Costa', phoneLast4: '7799', sucursal: 'merlo', treatmentLabel: 'Faciales — Foliculitis', lastActivityHoursAgo: 30, tags: [TAG_WALKIN], notesCount: 1, photosCount: 1, status: 'reservado' },

  // Comprobante (2)
  { id: '13', patientName: 'Manuela Aguirre', phoneLast4: '4408', sucursal: 'caballito', treatmentLabel: 'Tatuaje — pequeño', lastActivityHoursAgo: 36, tags: [TAG_META], notesCount: 1, photosCount: 0, status: 'comprobante' },
  { id: '14', patientName: 'Catalina Silva', phoneLast4: '1187', sucursal: 'merlo', treatmentLabel: 'Faciales — Laserpeel', lastActivityHoursAgo: 40, tags: [TAG_META, TAG_VIP], notesCount: 4, photosCount: 2, status: 'comprobante' },

  // Confirmado (1)
  { id: '15', patientName: 'Pilar Cabrera', phoneLast4: '9923', sucursal: 'caballito', treatmentLabel: 'Onicomicosis', lastActivityHoursAgo: 48, tags: [TAG_REFERIDO], notesCount: 2, photosCount: 1, status: 'confirmado' },

  // Sin respuesta (2)
  { id: '16', patientName: 'Mariana Pinto', phoneLast4: '2244', sucursal: 'moreno', treatmentLabel: 'Verrugas', lastActivityHoursAgo: 96, tags: [TAG_META], notesCount: 0, photosCount: 0, status: 'sin_respuesta' },
  { id: '17', patientName: 'Daniela Sosa', phoneLast4: '6731', sucursal: 'merlo', treatmentLabel: 'Faciales — Limpieza', lastActivityHoursAgo: 120, tags: [TAG_META], notesCount: 1, photosCount: 0, status: 'sin_respuesta' },

  // Archivado (1)
  { id: '18', patientName: 'Ximena Torres', phoneLast4: '3380', sucursal: 'caballito', treatmentLabel: 'Microblading', lastActivityHoursAgo: 720, tags: [TAG_META], notesCount: 2, photosCount: 0, status: 'archivado' },
]