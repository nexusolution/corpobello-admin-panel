// Mock data for the Pacientes preview. Replaced by Supabase queries when
// the patient data layer lands (Etapa 1 backend wiring).

export type Sucursal = 'caballito' | 'merlo' | 'moreno'

export type PatientStatus =
  | 'activo'
  | 'en_tratamiento'
  | 'sin_contacto'
  | 'archivado'

export type Patient = {
  id: string
  fullName: string
  phoneLast4: string
  phoneFull: string
  // null when the patient has no sucursal on record (the bot's promote trigger
  // doesn't copy one) — rendered as "—" rather than a fabricated branch.
  sucursal: Sucursal | null
  mainTreatmentLabel: string
  status: PatientStatus
  /** Days since the patient was added to the system. */
  createdAtDays: number
  /** Days since last visit. null = never visited. */
  lastVisitDays: number | null
}

export const SUCURSAL_LABELS: Record<Sucursal, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

const phone = (last4: string) =>
  `+54 9 11 4${last4.slice(0, 1)}${last4.slice(0, 2)}-${last4}`

export const MOCK_PATIENTS: Patient[] = [
  { id: 'P-101', fullName: 'María González', phoneLast4: '4521', phoneFull: phone('4521'), sucursal: 'caballito', mainTreatmentLabel: 'Tatuajes — Remoción', status: 'activo', createdAtDays: 45, lastVisitDays: 3 },
  { id: 'P-102', fullName: 'Lucía Fernández', phoneLast4: '8893', phoneFull: phone('8893'), sucursal: 'merlo', mainTreatmentLabel: 'Microblading', status: 'en_tratamiento', createdAtDays: 28, lastVisitDays: 7 },
  { id: 'P-103', fullName: 'Sofía Martínez', phoneLast4: '2210', phoneFull: phone('2210'), sucursal: 'caballito', mainTreatmentLabel: 'Faciales — Endolift', status: 'activo', createdAtDays: 90, lastVisitDays: 14 },
  { id: 'P-104', fullName: 'Camila Rojas', phoneLast4: '7741', phoneFull: phone('7741'), sucursal: 'caballito', mainTreatmentLabel: 'Láser — Axilas', status: 'en_tratamiento', createdAtDays: 60, lastVisitDays: 5 },
  { id: 'P-105', fullName: 'Valentina Pérez', phoneLast4: '5630', phoneFull: phone('5630'), sucursal: 'merlo', mainTreatmentLabel: 'Faciales — Limpieza', status: 'activo', createdAtDays: 120, lastVisitDays: 30 },
  { id: 'P-106', fullName: 'Florencia López', phoneLast4: '1145', phoneFull: phone('1145'), sucursal: 'moreno', mainTreatmentLabel: 'Tatuajes — Remoción', status: 'en_tratamiento', createdAtDays: 75, lastVisitDays: 10 },
  { id: 'P-107', fullName: 'Agustina Díaz', phoneLast4: '9067', phoneFull: phone('9067'), sucursal: 'caballito', mainTreatmentLabel: 'Cicatrices', status: 'activo', createdAtDays: 200, lastVisitDays: 60 },
  { id: 'P-108', fullName: 'Carolina Ruiz', phoneLast4: '3318', phoneFull: phone('3318'), sucursal: 'caballito', mainTreatmentLabel: 'Láser — Piernas', status: 'en_tratamiento', createdAtDays: 30, lastVisitDays: 2 },
  { id: 'P-109', fullName: 'Mariana Pinto', phoneLast4: '2244', phoneFull: phone('2244'), sucursal: 'moreno', mainTreatmentLabel: 'Verrugas', status: 'sin_contacto', createdAtDays: 180, lastVisitDays: 95 },
  { id: 'P-110', fullName: 'Daniela Sosa', phoneLast4: '6731', phoneFull: phone('6731'), sucursal: 'merlo', mainTreatmentLabel: 'Faciales — Limpieza', status: 'sin_contacto', createdAtDays: 220, lastVisitDays: 120 },
  { id: 'P-111', fullName: 'Ximena Torres', phoneLast4: '3380', phoneFull: phone('3380'), sucursal: 'caballito', mainTreatmentLabel: 'Microblading', status: 'archivado', createdAtDays: 365, lastVisitDays: null },
  { id: 'P-112', fullName: 'Pilar Cabrera', phoneLast4: '9923', phoneFull: phone('9923'), sucursal: 'caballito', mainTreatmentLabel: 'Onicomicosis', status: 'activo', createdAtDays: 50, lastVisitDays: 1 },
]