import { uniqueId } from 'lodash'

export interface ChildItem {
  id?: number | string
  name?: string
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
}

export interface MenuItem {
  heading?: string
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
    children: [
      {
        name: 'Inicio',
        icon: 'solar:home-smile-angle-line-duotone',
        id: uniqueId(),
        url: '/',
      },
      {
        name: 'Agenda',
        icon: 'solar:calendar-mark-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
      {
        name: 'Pacientes',
        icon: 'solar:user-heart-rounded-line-duotone',
        id: uniqueId(),
        url: '/pacientes',
      },
      {
        name: 'Kanban',
        icon: 'solar:layers-minimalistic-line-duotone',
        id: uniqueId(),
        url: '/kanban',
      },
    ],
  },
  {
    heading: 'Clínica',
    children: [
      {
        name: 'Fichas',
        icon: 'solar:clipboard-heart-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
      {
        name: 'Consentimientos',
        icon: 'solar:document-text-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
    ],
  },
  {
    heading: 'Inventario',
    children: [
      {
        name: 'Productos',
        icon: 'solar:box-minimalistic-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
      {
        name: 'Movimientos',
        icon: 'solar:transfer-horizontal-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
      },
    ],
  },
  {
    heading: 'Reportes',
    children: [
      {
        name: 'Cierre diario',
        icon: 'solar:wallet-money-line-duotone',
        id: uniqueId(),
        url: '#',
        underDevelopment: true,
        adminOnly: true,
      },
      {
        name: 'Reportes operativos',
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
    children: [
      {
        name: 'Usuarios',
        icon: 'solar:shield-user-line-duotone',
        id: uniqueId(),
        url: '/usuarios',
        adminOnly: true,
      },
      {
        name: 'Configuración',
        icon: 'solar:tuning-3-line-duotone',
        id: uniqueId(),
        url: '/configuracion',
        adminOnly: true,
      },
      {
        name: 'Auditoría',
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