// Treatment color identity system.
//
// Each treatment category gets a configurable color that propagates across
// every module that renders a treatment (kanban cards, dashboard summary,
// agenda turno cards once it lands, patient ficha eventually).
//
// MOCK STATE (current): palette + slugs are hardcoded here. Treatment label
// strings from leads are inferred to a slug via simple substring matching.
//
// REAL STATE (after Supabase wires in): this maps to a `treatment_colors`
// config table. The `/configuracion` admin page edits it. Lookups become
// async via the data layer instead of pure functions.
//
// Until then, edit this file to tune palette / add categories.

export type TreatmentColor = {
  /** Treatment-category slug (stable id) */
  slug: string
  /** Tailwind bg-* class for tinted backgrounds (e.g. column tint, chip bg) */
  bgClass: string
  /** Tailwind text-* class for the accent text/icon */
  textClass: string
  /** Tailwind bg-* class for a solid dot indicator (no opacity) */
  dotClass: string
  /** Hex color for inline styles (e.g. the agenda's left treatment bar) */
  hex: string
  /** Emoji used in compact summary chips */
  emoji: string
  /** Iconify icon name for richer renderings (workload list, agenda chips) */
  icon: string
  /** i18n key for the category display label */
  labelKey: string
}

const DEFAULT_COLOR: TreatmentColor = {
  slug: 'other',
  bgClass: 'bg-muted/40 dark:bg-darkmuted/40',
  textClass: 'text-link dark:text-darklink',
  dotClass: 'bg-link dark:bg-darklink',
  hex: '#8a94a6',
  emoji: '⬜',
  icon: 'solar:question-square-line-duotone',
  labelKey: 'treatments.category.other',
}

const PALETTE: Record<string, TreatmentColor> = {
  tatuaje: {
    slug: 'tatuaje',
    bgClass: 'bg-lightwarning',
    textClass: 'text-warning',
    dotClass: 'bg-warning',
    hex: '#ffae1f',
    emoji: '🟨',
    icon: 'solar:pen-new-square-line-duotone',
    labelKey: 'treatments.category.tatuaje',
  },
  depilacion: {
    slug: 'depilacion',
    bgClass: 'bg-pink-500/15',
    textClass: 'text-pink-500',
    dotClass: 'bg-pink-500',
    hex: '#ec4899',
    emoji: '🩷',
    icon: 'solar:bolt-line-duotone',
    labelKey: 'treatments.category.depilacion',
  },
  melasma: {
    slug: 'melasma',
    bgClass: 'bg-lightsecondary',
    textClass: 'text-secondary',
    dotClass: 'bg-secondary',
    hex: '#49beff',
    emoji: '🟦',
    icon: 'solar:user-rounded-line-duotone',
    labelKey: 'treatments.category.melasma',
  },
  endolift: {
    slug: 'endolift',
    bgClass: 'bg-lightsuccess',
    textClass: 'text-success',
    dotClass: 'bg-success',
    hex: '#13deb9',
    emoji: '🟩',
    icon: 'solar:magic-stick-3-line-duotone',
    labelKey: 'treatments.category.endolift',
  },
  acne: {
    slug: 'acne',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-500',
    dotClass: 'bg-orange-500',
    hex: '#f97316',
    emoji: '🟧',
    icon: 'solar:droplet-line-duotone',
    labelKey: 'treatments.category.acne',
  },
  microblading: {
    slug: 'microblading',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-500',
    dotClass: 'bg-purple-500',
    hex: '#a855f7',
    emoji: '🟪',
    icon: 'solar:pen-2-line-duotone',
    labelKey: 'treatments.category.microblading',
  },
  facial: {
    slug: 'facial',
    bgClass: 'bg-lightinfo',
    textClass: 'text-info',
    dotClass: 'bg-info',
    hex: '#539bff',
    emoji: '🟦',
    icon: 'solar:health-line-duotone',
    labelKey: 'treatments.category.facial',
  },
  cancelado: {
    slug: 'cancelado',
    bgClass: 'bg-gray-400/15',
    textClass: 'text-gray-500',
    dotClass: 'bg-gray-400',
    hex: '#9ca3af',
    emoji: '⬜',
    icon: 'solar:close-circle-line-duotone',
    labelKey: 'treatments.category.cancelado',
  },
}

/**
 * Infer the treatment-category slug from a free-text treatment label.
 * Substring matching — fragile but adequate for mock state. Real state will
 * read the treatment_id from the lead and look up its color directly.
 */
export function inferTreatmentSlug(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('tatuaj')) return 'tatuaje'
  if (l.includes('depila') || l.includes('láser') || l.includes('laser'))
    return 'depilacion'
  if (l.includes('melasma')) return 'melasma'
  if (l.includes('endolift')) return 'endolift'
  if (l.includes('acné') || l.includes('acne')) return 'acne'
  if (l.includes('microblading')) return 'microblading'
  if (l.includes('facial') || l.includes('laserpeel') || l.includes('foliculitis'))
    return 'facial'
  if (l.includes('cancel')) return 'cancelado'
  return 'other'
}

export function getTreatmentColor(label: string): TreatmentColor {
  return PALETTE[inferTreatmentSlug(label)] ?? DEFAULT_COLOR
}

export function getTreatmentColorBySlug(slug: string): TreatmentColor {
  return PALETTE[slug] ?? DEFAULT_COLOR
}

/** Ordered list of slugs for iterating the palette (e.g. summary chip row). */
export const TREATMENT_SLUGS_ORDERED: readonly string[] = [
  'tatuaje',
  'depilacion',
  'melasma',
  'endolift',
  'acne',
  'microblading',
  'facial',
] as const