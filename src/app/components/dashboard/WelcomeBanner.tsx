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

            {/* Right illustration — Lottie animation, sized to match the sample card */}
            <div className='hidden sm:flex items-center justify-end shrink-0 w-[360px] lg:w-[420px] pr-2'>
              <DotLottieReact
                src='https://lottie.host/31c92a4c-ac39-4320-8646-3348fa21cffe/JnGZyldzlm.lottie'
                loop
                autoplay
              />
            </div>
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