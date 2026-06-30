'use client'

import dynamic from 'next/dynamic'
import { Icon } from '@iconify/react'

import { Card } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n/context'

// Lottie player — touches DOM APIs, must be client-only
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
)

export function WelcomeBanner() {
  const { t } = useTranslation()

  return (
    <Card className='!rounded-md !p-0 bg-lightprimary dark:bg-lightprimary border-0 relative overflow-hidden h-full'>
      <div className='flex items-stretch h-full'>
        {/* Left content */}
        <div className='flex-1 min-w-0 p-6 z-10 relative flex flex-col justify-center'>
          <h2 className='text-lg sm:text-xl font-semibold text-dark dark:text-white mb-5'>
            {t('welcome.title')}
          </h2>

          <div className='grid grid-cols-2 gap-x-6 gap-y-4'>
            <div>
              <div className='text-xl sm:text-2xl font-bold text-dark dark:text-white'>
                2
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.patientsAttended')}
              </div>
            </div>
            <div>
              <div className='text-xl sm:text-2xl font-bold text-dark dark:text-white'>
                1
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.cancellations')}
              </div>
            </div>
            <div>
              <div className='flex items-center gap-1.5'>
                <span className='text-xl sm:text-2xl font-bold text-success'>
                  $84.500
                </span>
                <Icon
                  icon='tabler:arrow-up-right'
                  height={16}
                  width={16}
                  className='text-success'
                />
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.dailyIncome')}
              </div>
            </div>
            <div>
              <div className='text-xl sm:text-2xl font-bold text-warning'>
                $31.000
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.pendingCharges')}
              </div>
            </div>
          </div>
        </div>

        {/* Right illustration — Lottie animation */}
        <div className='hidden sm:flex items-center justify-end shrink-0 w-[280px] lg:w-[340px] pr-2'>
          <DotLottieReact
            src='https://lottie.host/31c92a4c-ac39-4320-8646-3348fa21cffe/JnGZyldzlm.lottie'
            loop
            autoplay
          />
        </div>
      </div>
    </Card>
  )
}