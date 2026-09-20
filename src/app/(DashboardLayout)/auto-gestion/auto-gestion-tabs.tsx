'use client'

import { useState } from 'react'
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
  { key: 'packs', labelKey: 'autoGestion.packs.heading', icon: 'solar:box-line-duotone' },
  { key: 'estados', labelKey: 'autoGestion.statuses.heading', icon: 'solar:tag-line-duotone' },
  { key: 'colores', labelKey: 'autoGestion.colors.heading', icon: 'solar:palette-line-duotone' },
  { key: 'feriados', labelKey: 'autoGestion.feriados.heading', icon: 'solar:calendar-line-duotone' },
  { key: 'texts', labelKey: 'autoGestion.texts.heading', icon: 'solar:document-text-line-duotone' },
  { key: 'intros', labelKey: 'autoGestion.intros.heading', icon: 'solar:chat-square-like-line-duotone' },
  { key: 'faq', labelKey: 'autoGestion.faq.heading', icon: 'solar:question-circle-line-duotone' },
  { key: 'consents', labelKey: 'autoGestion.consents.heading', icon: 'solar:document-add-line-duotone' },
]

export function AutoGestionTabs() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>('catalogo')

  return (
    // Tabs on the LEFT as a vertical nav on desktop (Andrés 2026-09-20); on narrow
    // screens they stack on top as wrapping chips so the page stays usable.
    <div className='flex flex-col gap-4 md:flex-row md:gap-6'>
      <nav className='flex flex-wrap gap-1 md:w-60 md:shrink-0 md:flex-col md:flex-nowrap'>
        {TABS.map((tb) => {
          const active = tb.key === tab
          return (
            <button
              key={tb.key}
              type='button'
              onClick={() => setTab(tb.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-md transition-colors md:w-full md:justify-start ${
                active
                  ? 'bg-lightprimary text-primary'
                  : 'text-link dark:text-darklink hover:text-primary hover:bg-lightprimary/40'
              }`}>
              <Icon icon={tb.icon} height={17} width={17} className='shrink-0' />
              {t(tb.labelKey)}
            </button>
          )
        })}
      </nav>

      <div className='min-w-0 flex-1'>
      {tab === 'treatments' && <TreatmentsToggle />}
      {tab === 'prices' && <PricesSection />}
      {tab === 'cotizadores' && <CotizadoresSection />}
      {tab === 'promos' && <PromocionesSection />}
      {tab === 'horarios' && <HorariosSection />}
      {tab === 'disponibilidad' && <DisponibilidadSection />}
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
