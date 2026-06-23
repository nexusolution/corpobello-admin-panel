// Inline EN + ES dictionaries with typed keys.
// Add a new string here, get autocomplete + a TS error if a key is missing
// from either locale.

export const dictionaries = {
  es: {
    // Sidebar — section headings
    'sidebar.operations': 'Operación',
    'sidebar.clinical': 'Clínica',
    'sidebar.inventory': 'Inventario',
    'sidebar.reports': 'Reportes',
    'sidebar.administration': 'Administración',
    // Sidebar — items
    'sidebar.home': 'Inicio',
    'sidebar.agenda': 'Agenda',
    'sidebar.patients': 'Pacientes',
    'sidebar.kanban': 'Kanban',
    'sidebar.records': 'Fichas',
    'sidebar.consents': 'Consentimientos',
    'sidebar.products': 'Productos',
    'sidebar.movements': 'Movimientos',
    'sidebar.dailyClose': 'Cierre diario',
    'sidebar.operationalReports': 'Reportes operativos',
    'sidebar.users': 'Usuarios',
    'sidebar.config': 'Configuración',
    'sidebar.audit': 'Auditoría',
    // Language switcher labels
    'language.spanish': 'Español',
    'language.english': 'Inglés',
    // Under-development alert
    'alerts.underDevelopmentTitle': 'En desarrollo',
    'alerts.underDevelopmentBody': '{section} se habilitará en una etapa posterior.',
    'alerts.underDevelopmentButton': 'Entendido',
  },
  en: {
    // Sidebar — section headings
    'sidebar.operations': 'Operations',
    'sidebar.clinical': 'Clinical',
    'sidebar.inventory': 'Inventory',
    'sidebar.reports': 'Reports',
    'sidebar.administration': 'Administration',
    // Sidebar — items
    'sidebar.home': 'Home',
    'sidebar.agenda': 'Schedule',
    'sidebar.patients': 'Patients',
    'sidebar.kanban': 'Kanban',
    'sidebar.records': 'Records',
    'sidebar.consents': 'Consents',
    'sidebar.products': 'Products',
    'sidebar.movements': 'Movements',
    'sidebar.dailyClose': 'Daily close',
    'sidebar.operationalReports': 'Operational reports',
    'sidebar.users': 'Users',
    'sidebar.config': 'Configuration',
    'sidebar.audit': 'Audit log',
    // Language switcher labels
    'language.spanish': 'Spanish',
    'language.english': 'English',
    // Under-development alert
    'alerts.underDevelopmentTitle': 'Under development',
    'alerts.underDevelopmentBody': '{section} will be enabled in a later stage.',
    'alerts.underDevelopmentButton': 'Got it',
  },
} as const

export type Locale = keyof typeof dictionaries
export type TranslationKey = keyof typeof dictionaries['es']

export const LOCALES: Locale[] = ['es', 'en']