'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@iconify/react'

import { TreatmentsToggle } from './treatments-toggle'
import { PricesSection } from './prices-section'
import { TextsSection } from './texts-section'
import { IntrosSection } from './intros-section'
import { FaqSection } from './faq-section'
import { CotizadoresSection } from './cotizadores-section'
import { PromocionesSection } from './promociones-section'
import { HorariosSection } from './horarios-section'
import { DisponibilidadSection } from './disponibilidad-section'
import { PacksSection } from './packs-section'
import { CatalogoSection } from './catalogo-section'
import { AlmuerzosSection } from './almuerzos-section'
import { EstadosSection } from './estados-section'
import { ColoresSection } from './colores-section'
import { FeriadosSection } from './feriados-section'
import { ConsentimientosSection } from './consentimientos-section'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TabKey =
  | 'treatments'
  | 'prices'
  | 'texts'
  | 'intros'
  | 'faq'
  | 'cotizadores'
  | 'promos'
  | 'horarios'
  | 'disponibilidad'
  | 'almuerzos'
  | 'packs'
  | 'estados'
  | 'colores'
  | 'catalogo'
  | 'feriados'
  | 'consents'

const TABS: { key: TabKey; labelKey: TranslationKey; icon: string }[] = [
  // Treatment self-management is the primary entry (Andrés 2026-09-20, punto 8):
  // the catalog (add/rename/reorder/enable-disable/colour/duration) comes first,
  // then the bot-menu on/off toggle.
  { key: 'catalogo', labelKey: 'autoGestion.catalog.heading', icon: 'solar:list-check-line-duotone' },
  { key: 'treatments', labelKey: 'autoGestion.treatments.heading', icon: 'solar:widget-line-duotone' },
  { key: 'prices', labelKey: 'autoGestion.prices.heading', icon: 'solar:tag-price-line-duotone' },
  { key: 'cotizadores', labelKey: 'autoGestion.cotizadores.heading', icon: 'solar:calculator-line-duotone' },
  { key: 'promos', labelKey: 'autoGestion.promos.heading', icon: 'solar:tag-horizontal-line-duotone' },
  { key: 'horarios', labelKey: 'autoGestion.horarios.heading', icon: 'solar:clock-circle-line-duotone' },
  { key: 'disponibilidad', labelKey: 'autoGestion.availability.heading', icon: 'solar:calendar-mark-line-duotone' },
  { key: 'almuerzos', labelKey: 'autoGestion.lunch.heading', icon: 'solar:cup-hot-line-duotone' },
  { key: 'packs', labelKey: 'autoGestion.packs.heading', icon: 'solar:box-line-duotone' },
  { key: 'estados', labelKey: 'autoGestion.statuses.heading', icon: 'solar:tag-line-duotone' },
  { key: 'colores', labelKey: 'autoGestion.colors.heading', icon: 'solar:palette-line-duotone' },
  { key: 'feriados', labelKey: 'autoGestion.feriados.heading', icon: 'solar:calendar-line-duotone' },
  { key: 'texts', labelKey: 'autoGestion.texts.heading', icon: 'solar:document-text-line-duotone' },
  { key: 'intros', labelKey: 'autoGestion.intros.heading', icon: 'solar:chat-square-like-line-duotone' },
  { key: 'faq', labelKey: 'autoGestion.faq.heading', icon: 'solar:question-circle-line-duotone' },
  { key: 'consents', labelKey: 'autoGestion.consents.heading', icon: 'solar:document-add-line-duotone' },
]

const META: Record<TabKey, { labelKey: TranslationKey; icon: string }> = Object.fromEntries(
  TABS.map((tb) => [tb.key, { labelKey: tb.labelKey, icon: tb.icon }]),
) as Record<TabKey, { labelKey: TranslationKey; icon: string }>

// Left-nav sections (Andrés 2026-09-20): the 15 tabs grouped so the menu reads
// as three clear areas instead of one long flat list.
const GROUPS: { titleKey: TranslationKey; keys: TabKey[] }[] = [
  { titleKey: 'autoGestion.group.treatments', keys: ['catalogo', 'treatments', 'prices', 'colores', 'packs'] },
  { titleKey: 'autoGestion.group.agenda', keys: ['horarios', 'disponibilidad', 'almuerzos', 'feriados', 'estados'] },
  {
    titleKey: 'autoGestion.group.bot',
    keys: ['cotizadores', 'promos', 'texts', 'intros', 'faq', 'consents'],
  },
]

export function AutoGestionTabs() {
  const { t } = useTranslation()
  // Deep-link support (Andrés #1b): ?tab opens a section, and prof/suc/date
  // pre-position the availability editor. Read once on mount (the agenda opens
  // this with a full navigation, so window.location is fresh).
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'catalogo'
    const q = new URLSearchParams(window.location.search).get('tab')
    return (TABS.some((x) => x.key === q) ? q : 'catalogo') as TabKey
  })
  const initialDispo = useMemo(() => {
    if (typeof window === 'undefined') return null
    const p = new URLSearchParams(window.location.search)
    const prof = p.get('prof') ?? ''
    const suc = p.get('suc') ?? ''
    const date = p.get('date') ?? ''
    return prof || suc ? { prof, suc, date } : null
  }, [])

  return (
    // Tabs on the LEFT as a vertical nav on desktop (Andrés 2026-09-20); on narrow
    // screens they stack on top as wrapping chips so the page stays usable.
    <div className='flex flex-col gap-4 md:flex-row md:gap-6'>
      <nav className='md:w-60 md:shrink-0 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto space-y-4'>
        {GROUPS.map((g) => (
          <div key={g.titleKey}>
            <p className='px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-link/70 dark:text-darklink/70'>
              {t(g.titleKey)}
            </p>
            <div className='flex flex-wrap gap-1 md:flex-col md:flex-nowrap'>
              {g.keys.map((key) => {
                const active = key === tab
                return (
                  <button
                    key={key}
                    type='button'
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-md transition-colors md:w-full md:justify-start ${
                      active
                        ? 'bg-lightprimary text-primary'
                        : 'text-link dark:text-darklink hover:text-primary hover:bg-lightprimary/40'
                    }`}>
                    <Icon icon={META[key].icon} height={17} width={17} className='shrink-0' />
                    {t(META[key].labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className='min-w-0 flex-1'>
      {tab === 'treatments' && <TreatmentsToggle />}
      {tab === 'prices' && <PricesSection />}
      {tab === 'cotizadores' && <CotizadoresSection />}
      {tab === 'promos' && <PromocionesSection />}
      {tab === 'horarios' && <HorariosSection />}
      {tab === 'disponibilidad' && <DisponibilidadSection initialFocus={initialDispo} />}
      {tab === 'almuerzos' && <AlmuerzosSection />}
      {tab === 'catalogo' && <CatalogoSection onNavigate={setTab} />}
      {tab === 'packs' && <PacksSection />}
      {tab === 'estados' && <EstadosSection />}
      {tab === 'colores' && <ColoresSection />}
      {tab === 'feriados' && <FeriadosSection />}
      {tab === 'texts' && <TextsSection />}
      {tab === 'intros' && <IntrosSection />}
      {tab === 'faq' && <FaqSection />}
      {tab === 'consents' && <ConsentimientosSection />}
      </div>
    </div>
  )
}
