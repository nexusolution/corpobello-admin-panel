'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'

import { TreatmentsToggle } from './treatments-toggle'
import { PricesSection } from './prices-section'
import { TextsSection } from './texts-section'
import { IntrosSection } from './intros-section'
import { FaqSection } from './faq-section'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TabKey = 'treatments' | 'prices' | 'texts' | 'intros' | 'faq'

const TABS: { key: TabKey; labelKey: TranslationKey; icon: string }[] = [
  { key: 'treatments', labelKey: 'autoGestion.treatments.heading', icon: 'solar:widget-line-duotone' },
  { key: 'prices', labelKey: 'autoGestion.prices.heading', icon: 'solar:tag-price-line-duotone' },
  { key: 'texts', labelKey: 'autoGestion.texts.heading', icon: 'solar:document-text-line-duotone' },
  { key: 'intros', labelKey: 'autoGestion.intros.heading', icon: 'solar:chat-square-like-line-duotone' },
  { key: 'faq', labelKey: 'autoGestion.faq.heading', icon: 'solar:question-circle-line-duotone' },
]

export function AutoGestionTabs() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>('treatments')

  return (
    <div className='space-y-6'>
      {/* Tab bar */}
      <div className='border-b border-border dark:border-darkborder overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
        <div className='inline-flex'>
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
      {tab === 'texts' && <TextsSection />}
      {tab === 'intros' && <IntrosSection />}
      {tab === 'faq' && <FaqSection />}
    </div>
  )
}
