import { uniqueId } from 'lodash'
import { type TranslationKey } from '@/lib/i18n/dictionaries'

export interface ChildItem {
  id?: number | string
  name?: string
  /** Translation key — preferred over `name` so the item label follows the active locale. */
  nameKey?: TranslationKey
  icon?: any
  children?: ChildItem[]
  item?: any
  url?: any
  color?: string
  disabled?: boolean
  subtitle?: string
  badge?: boolean
  badgeType?: string
  isPro?: boolean
  /** Show SweetAlert "under development" instead of navigating. */
  underDevelopment?: boolean
  /** Item visible only to admin role (rendered for now; gating wired later). */
  adminOnly?: boolean
  /** Hidden for the Profesional role — commercial/operational surfaces that are
   *  not part of the clinical view (general patient list, funnel, inventory).
   *  Andrés 2026-08-08: el Profesional ve solo lo clínico de SUS pacientes. */
  hideFromProfesional?: boolean
}

export interface MenuItem {
  heading?: string
  /** Translation key for the section heading — preferred over static `heading`. */
  headingKey?: TranslationKey
  name?: string
  icon?: any
  id?: number
  to?: string
  items?: MenuItem[]
  children?: ChildItem[]
  url?: any
  disabled?: boolean
  subtitle?: string
  badgeType?: string
  badge?: boolean
  isPro?: boolean
}

const SidebarContent: MenuItem[] = [
  {
    heading: 'Operación',
    headingKey: 'sidebar.operations',
    children: [
      {
        name: 'Inicio',
        nameKey: 'sidebar.home',
        icon: 'solar:home-smile-angle-line-duotone',
        id: uniqueId(),
        url: '/',
      },
      {
        name: 'Agenda',
        nameKey: 'sidebar.agenda',
        icon: 'solar:calendar-mark-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
      {
        name: 'Pacientes',
        nameKey: 'sidebar.patients',
        icon: 'solar:user-heart-rounded-line-duotone',
        id: uniqueId(),
        url: '/pacientes',
        // Profesional gets its own scoped patient view (Etapa 2/3); the general
        // list is hidden from them.
        hideFromProfesional: true,
      },
      {
        name: 'Kanban',
        nameKey: 'sidebar.kanban',
        icon: 'solar:layers-minimalistic-line-duotone',
        id: uniqueId(),
        url: '/kanban',
        // Commercial funnel — not the Profesional's job.
        hideFromProfesional: true,
      },
    ],
  },
  {
    heading: 'Clínica',
    headingKey: 'sidebar.clinical',
    children: [
      {
        name: 'Fichas',
        nameKey: 'sidebar.records',
        icon: 'solar:clipboard-heart-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
      {
        name: 'Consentimientos',
        nameKey: 'sidebar.consents',
        icon: 'solar:document-text-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
    ],
  },
  {
    heading: 'Inventario',
    headingKey: 'sidebar.inventory',
    children: [
      {
        name: 'Productos',
        nameKey: 'sidebar.products',
        icon: 'solar:box-minimalistic-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
        hideFromProfesional: true,
      },
      {
        name: 'Movimientos',
        nameKey: 'sidebar.movements',
        icon: 'solar:transfer-horizontal-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
        hideFromProfesional: true,
      },
    ],
  },
  {
    heading: 'Reportes',
    headingKey: 'sidebar.reports',
    children: [
      {
        name: 'Cierre diario',
        nameKey: 'sidebar.dailyClose',
        icon: 'solar:wallet-money-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
        adminOnly: true,
      },
      {
        name: 'Reportes operativos',
        nameKey: 'sidebar.operationalReports',
        icon: 'solar:chart-square-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
        adminOnly: true,
      },
    ],
  },
  {
    heading: 'Administración',
    headingKey: 'sidebar.administration',
    children: [
      {
        name: 'Usuarios',
        nameKey: 'sidebar.users',
        icon: 'solar:shield-user-line-duotone',
        id: uniqueId(),
        url: '/usuarios',
        adminOnly: true,
      },
      {
        name: 'Etiquetas',
        nameKey: 'sidebar.tags',
        icon: 'solar:tag-line-duotone',
        id: uniqueId(),
        url: '/etiquetas',
        adminOnly: true,
      },
      {
        name: 'Auto-gestión',
        nameKey: 'sidebar.autoGestion',
        icon: 'solar:tuning-4-line-duotone',
        id: uniqueId(),
        url: '/auto-gestion',
        adminOnly: true,
      },
      {
        name: 'Configuración',
        nameKey: 'sidebar.config',
        icon: 'solar:tuning-3-line-duotone',
        id: uniqueId(),
        url: '/configuracion',
        adminOnly: true,
      },
      {
        name: 'Auditoría',
        nameKey: 'sidebar.audit',
        icon: 'solar:clipboard-list-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
        adminOnly: true,
      },
    ],
  },
]

export default SidebarContent