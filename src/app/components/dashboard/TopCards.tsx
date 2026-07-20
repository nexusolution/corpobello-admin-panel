'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import Link from 'next/link'

// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import { Card } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { fetchFunnelCounts, type FunnelCounts } from './data'

// Import Swiper styles
import 'swiper/css'

// Funnel pipeline stages, in flow order. Each card mirrors a stage in the
// patient lifecycle from first message to follow-up. `count` is now filled
// from live Supabase data (leads.status + patients); the literals below are
// only the fallback shown before the fetch resolves.
type FunnelCard = {
  key: string
  labelKey: TranslationKey
  count: number
  icon: string
  bgcolor: string
  textclr: string
  url: string
}

const FUNNEL_CARDS: FunnelCard[] = [
  {
    key: 'new',
    labelKey: 'dashboard.funnel.new',
    count: 12,
    icon: 'solar:user-plus-line-duotone',
    bgcolor: 'bg-lightinfo dark:bg-lightinfo',
    textclr: 'text-info dark:text-info',
    url: '/kanban',
  },
  {
    key: 'awaitingPhoto',
    labelKey: 'dashboard.funnel.awaitingPhoto',
    count: 6,
    icon: 'solar:camera-line-duotone',
    bgcolor: 'bg-lightwarning dark:bg-lightwarning',
    textclr: 'text-warning dark:text-warning',
    url: '/kanban',
  },
  {
    key: 'quoteSent',
    labelKey: 'dashboard.funnel.quoteSent',
    count: 9,
    icon: 'solar:bill-list-line-duotone',
    bgcolor: 'bg-lightsecondary dark:bg-lightsecondary',
    textclr: 'text-secondary dark:text-secondary',
    url: '/kanban',
  },
  {
    key: 'awaitingDeposit',
    labelKey: 'dashboard.funnel.awaitingDeposit',
    count: 5,
    icon: 'solar:wallet-money-line-duotone',
    bgcolor: 'bg-lightprimary dark:bg-lightprimary',
    textclr: 'text-primary dark:text-primary',
    url: '/kanban',
  },
  {
    key: 'preReservation',
    labelKey: 'dashboard.funnel.preReservation',
    count: 7,
    icon: 'solar:calendar-mark-line-duotone',
    bgcolor: 'bg-lightinfo dark:bg-lightinfo',
    textclr: 'text-info dark:text-info',
    url: '/kanban',
  },
  {
    key: 'confirmed',
    labelKey: 'dashboard.funnel.confirmed',
    count: 16,
    icon: 'solar:check-circle-line-duotone',
    bgcolor: 'bg-lightsuccess dark:bg-lightsuccess',
    textclr: 'text-success dark:text-success',
    url: '/kanban',
  },
  {
    key: 'attended',
    labelKey: 'dashboard.funnel.attended',
    count: 31,
    icon: 'solar:check-read-line-duotone',
    bgcolor: 'bg-lightsuccess dark:bg-lightsuccess',
    textclr: 'text-success dark:text-success',
    url: '/kanban',
  },
  {
    key: 'followUp',
    labelKey: 'dashboard.funnel.followUp',
    count: 5,
    icon: 'solar:bell-line-duotone',
    bgcolor: 'bg-lighterror dark:bg-lighterror',
    textclr: 'text-error dark:text-error',
    url: '/kanban',
  },
]

const TopCards = () => {
  const { t } = useTranslation()
  const [counts, setCounts] = useState<FunnelCounts | null>(null)

  useEffect(() => {
    let active = true
    void fetchFunnelCounts().then(({ counts }) => {
      if (active) setCounts(counts)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      <Swiper
        slidesPerView={6}
        spaceBetween={24}
        loop={true}
        freeMode={false}
        grabCursor={true}
        speed={5000}
        autoplay={{
          delay: 0,
          disableOnInteraction: false,
        }}
        modules={[Autoplay]}
        breakpoints={{
          0: { slidesPerView: 1, spaceBetween: 10 },
          640: { slidesPerView: 2, spaceBetween: 14 },
          768: { slidesPerView: 3, spaceBetween: 18 },
          1030: { slidesPerView: 4, spaceBetween: 18 },
          1200: { slidesPerView: 6, spaceBetween: 24 },
        }}
        className='mySwiper'>
        {FUNNEL_CARDS.map((item) => {
          return (
            <SwiperSlide key={item.key}>
              {/* Per Andrés 2026-06-30: each indicator opens the corresponding
                  list. The stage is passed as a query param so the Kanban can
                  focus/filter that column once the data layer lands. */}
              <Link href={`${item.url}?stage=${item.key}`}>
                <Card
                  className={`!rounded-md !p-3 !gap-2 shadow-none ${item.bgcolor} border-0 w-full`}>
                  <div className='text-center'>
                    <div className='flex justify-center mb-2'>
                      <div
                        className={`h-12 w-12 rounded-full bg-white/40 dark:bg-white/10 flex items-center justify-center ${item.textclr}`}>
                        <Icon icon={item.icon} height={28} width={28} />
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${item.textclr} mb-1`}>
                      {t(item.labelKey)}
                    </p>
                    <h5
                      className={`text-lg font-semibold ${item.textclr} mb-0`}>
                      {counts ? (counts[item.key] ?? 0) : '…'}
                    </h5>
                  </div>
                </Card>
              </Link>
            </SwiperSlide>
          )
        })}
      </Swiper>
    </div>
  )
}
export default TopCards