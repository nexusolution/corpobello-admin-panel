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
  | 'feriados'
  | 'consents'

const TABS: { key: TabKey; labelKey: TranslationKey; icon: string }[] = [
  { key: 'treatments', labelKey: 'autoGestion.treatments.heading', icon: 'solar:widget-line-duotone' },
  { key: 'prices', labelKey: 'autoGestion.prices.heading', icon: 'solar:tag-price-line-duotone' },
  { key: 'cotizadores', labelKey: 'autoGestion.cotizadores.heading', icon: 'solar:calculator-line-duotone' },
  { key: 'promos', labelKey: 'autoGestion.promos.heading', icon: 'solar:tag-horizontal-line-duotone' },
  { key: 'horarios', labelKey: 'autoGestion.horarios.heading', icon: 'solar:clock-circle-line-duotone' },
  { key: 'feriados', labelKey: 'autoGestion.feriados.heading', icon: 'solar:calendar-line-duotone' },
  { key: 'texts', labelKey: 'autoGestion.texts.heading', icon: 'solar:document-text-line-duotone' },
  { key: 'intros', labelKey: 'autoGestion.intros.heading', icon: 'solar:chat-square-like-line-duotone' },
  { key: 'faq', labelKey: 'autoGestion.faq.heading', icon: 'solar:question-circle-line-duotone' },
  { key: 'consents', labelKey: 'autoGestion.consents.heading', icon: 'solar:document-add-line-duotone' },
]

export function AutoGestionTabs() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>('treatments')

  return (
    <div className='space-y-6'>
      {/* Tab bar — wraps to a second row instead of scrolling off-screen, so
          the last tabs (Textos informativos / Preguntas frecuentes) are always
          visible. The old hidden-scrollbar overflow hid them with no cue. */}
      <div className='border-b border-border dark:border-darkborder'>
        <div className='flex flex-wrap'>
          {TABS.map((tb) => {
            const active = tb.key === tab
            return (
              <button
                key={tb.key}
                type='button'
                onClick={() => setTab(tb.key)}
                className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-link dark:text-darklink hover:text-primary'
                }`}>
                <Icon icon={tb.icon} height={17} width={17} />
                {t(tb.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'treatments' && <TreatmentsToggle />}
      {tab === 'prices' && <PricesSection />}
      {tab === 'cotizadores' && <CotizadoresSection />}
      {tab === 'promos' && <PromocionesSection />}
      {tab === 'horarios' && <HorariosSection />}
      {tab === 'feriados' && <FeriadosSection />}
      {tab === 'texts' && <TextsSection />}
      {tab === 'intros' && <IntrosSection />}
      {tab === 'faq' && <FaqSection />}
      {tab === 'consents' && <ConsentimientosSection />}
    </div>
  )
}
