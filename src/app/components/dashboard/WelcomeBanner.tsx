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

// ApexCharts uses window — must be client-only
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

// ---------- Expense (donut) ----------
const expenseChart = {
  series: [45, 35, 20],
  options: {
    chart: { type: 'donut' as const, sparkline: { enabled: true } },
    colors: ['#5d87ff', '#49beff', '#13deb9'],
    plotOptions: { pie: { donut: { size: '70%' } } },
    dataLabels: { enabled: false },
    legend: { show: false },
    stroke: { show: false },
    tooltip: { enabled: false },
  },
}

// ---------- Sales (sparkline bars) ----------
const salesChart = {
  series: [{ data: [10, 14, 11, 18, 15, 22, 17, 21, 19, 24] }],
  options: {
    chart: { type: 'bar' as const, sparkline: { enabled: true } },
    colors: ['#49beff'],
    plotOptions: {
      bar: { columnWidth: '55%', borderRadius: 2, borderRadiusApplication: 'end' as const },
    },
    dataLabels: { enabled: false },
    tooltip: { enabled: false },
  },
}

export function WelcomeBanner() {
  const { t } = useTranslation()

  return (
    <div className='grid grid-cols-12 gap-6'>
      {/* ---------- Welcome card ---------- */}
      <div className='col-span-12 lg:col-span-8'>
        <Card className='!rounded-md !p-0 bg-lightprimary dark:bg-lightprimary border-0 relative overflow-hidden h-full flex flex-col'>
          {/* Top: identity + KPIs */}
          <div className='p-6 z-10 relative'>
            <div className='flex items-center gap-3 mb-5'>
              <div className='h-10 w-10 rounded-full bg-white dark:bg-dark ring-1 ring-border dark:ring-darkborder flex items-center justify-center text-primary font-semibold text-sm shrink-0'>
                A
              </div>
              <p className='text-sm sm:text-base font-medium text-dark dark:text-white'>
                {t('welcome.greeting', { name: 'Andrés' })}
              </p>
            </div>

            <div className='flex gap-6 sm:gap-10'>
              <div>
                <div className='flex items-center gap-1.5'>
                  <span className='text-2xl sm:text-3xl font-bold text-dark dark:text-white'>
                    $2,340
                  </span>
                  <Icon
                    icon='tabler:arrow-up-right'
                    height={18}
                    width={18}
                    className='text-success'
                  />
                </div>
                <div className='text-xs sm:text-sm text-link dark:text-darklink mt-1'>
                  {t('welcome.todaysSales')}
                </div>
              </div>
              <div>
                <div className='flex items-center gap-1.5'>
                  <span className='text-2xl sm:text-3xl font-bold text-dark dark:text-white'>
                    35%
                  </span>
                  <Icon
                    icon='tabler:arrow-up-right'
                    height={18}
                    width={18}
                    className='text-success'
                  />
                </div>
                <div className='text-xs sm:text-sm text-link dark:text-darklink mt-1'>
                  {t('welcome.overallPerformance')}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: full-width Lottie illustration */}
          <div className='mt-auto h-56 w-full hidden sm:block'>
            <DotLottieReact
              src='https://lottie.host/31c92a4c-ac39-4320-8646-3348fa21cffe/JnGZyldzlm.lottie'
              loop
              autoplay
            />
          </div>
        </Card>
      </div>

      {/* ---------- Expense card ---------- */}
      <div className='col-span-6 lg:col-span-2'>
        <Card className='!rounded-md !p-4 h-full flex flex-col justify-between border-border dark:border-darkborder shadow-none'>
          <div className='flex items-start justify-between'>
            <div>
              <div className='text-xl font-bold text-dark dark:text-white'>
                $10,230
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.expense')}
              </div>
            </div>
            <div className='h-8 w-8 rounded-md bg-lightprimary text-primary flex items-center justify-center shrink-0'>
              <Icon icon='solar:wallet-money-line-duotone' height={18} width={18} />
            </div>
          </div>
          <div className='h-20'>
            <Chart
              options={expenseChart.options}
              series={expenseChart.series}
              type='donut'
              height='100%'
              width='100%'
            />
          </div>
        </Card>
      </div>

      {/* ---------- Sales card ---------- */}
      <div className='col-span-6 lg:col-span-2'>
        <Card className='!rounded-md !p-4 h-full flex flex-col justify-between border-border dark:border-darkborder shadow-none'>
          <div className='flex items-start justify-between'>
            <div>
              <div className='text-xl font-bold text-dark dark:text-white'>
                $65,432
              </div>
              <div className='text-xs text-link dark:text-darklink mt-0.5'>
                {t('welcome.sales')}
              </div>
            </div>
            <div className='h-8 w-8 rounded-md bg-lightsecondary text-secondary flex items-center justify-center shrink-0'>
              <Icon icon='solar:bag-4-line-duotone' height={18} width={18} />
            </div>
          </div>
          <div className='h-20'>
            <Chart
              options={salesChart.options}
              series={salesChart.series}
              type='bar'
              height='100%'
              width='100%'
            />
          </div>
        </Card>
      </div>
    </div>
  )
}