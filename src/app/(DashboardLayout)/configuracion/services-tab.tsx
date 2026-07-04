'use client'

import { useState } from 'react'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import { INITIAL_SERVICES, type Service } from './mock-data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getTreatmentColorBySlug } from '@/lib/treatment-colors'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function isDarkMode(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
}

function showUnderDevAlert(itemName: string, t: TFn) {
  const isDark = isDarkMode()
  Swal.fire({
    title: t('alerts.underDevelopmentTitle'),
    text: t('alerts.underDevelopmentBody', { section: itemName }),
    icon: 'info',
    iconColor: '#5d87ff',
    confirmButtonText: t('alerts.underDevelopmentButton'),
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-1 [&_.swal2-icon-content]:!text-2xl',
      confirmButton: '!text-sm !px-4 !py-1.5',
      popup: '!rounded-lg',
    },
  })
}

async function confirmDeleteService(name: string, t: TFn): Promise<boolean> {
  const isDark = isDarkMode()
  const result = await Swal.fire({
    title: t('configuracion.services.deleteConfirm.title'),
    text: t('configuracion.services.deleteConfirm.body', { name }),
    icon: 'warning',
    iconColor: '#ef4444',
    iconHtml:
      '<span style="font-size:30px;line-height:1;color:#ef4444;font-weight:700;">!</span>',
    showCancelButton: true,
    confirmButtonText: t('configuracion.services.deleteConfirm.yes'),
    cancelButtonText: t('configuracion.services.deleteConfirm.no'),
    confirmButtonColor: '#ef4444',
    cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1.5rem 1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0 !mt-3',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-2',
      actions: '!gap-2 !mt-5',
      confirmButton: '!text-sm !px-4 !py-1.5 !rounded-md',
      cancelButton: `!text-sm !px-4 !py-1.5 !rounded-md ${
        isDark ? '!text-white' : '!text-dark'
      }`,
      popup: '!rounded-lg',
    },
  })
  return result.isConfirmed
}

export function ServicesTab() {
  const { t } = useTranslation()
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES)

  function toggleActive(id: string) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    )
  }

  async function handleDelete(service: Service) {
    const ok = await confirmDeleteService(service.name, t)
    if (ok) setServices((prev) => prev.filter((s) => s.id !== service.id))
  }

  return (
    <div>
      {/* Header row — icon + title + subtitle + count + add button */}
      <div className='flex items-start justify-between mb-5 gap-3 flex-wrap'>
        <div className='flex items-start gap-3'>
          <div className='size-10 shrink-0 rounded-md bg-lightprimary flex items-center justify-center'>
            <Icon icon='solar:bag-heart-line-duotone' height={20} width={20} className='text-primary' />
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h2 className='text-base font-semibold text-dark dark:text-white leading-tight'>
                {t('configuracion.services.title')}
              </h2>
              <span className='inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-lightprimary text-primary text-[11px] font-semibold'>
                {services.length}
              </span>
            </div>
            <p className='text-xs text-link dark:text-darklink mt-0.5 leading-tight'>
              {t('configuracion.services.title.subtitle')}
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={() => showUnderDevAlert(t('configuracion.services.addButton'), t)}
          className='inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('configuracion.services.addButton')}
        </button>
      </div>

      {/* Table */}
      <div className='rounded-md border border-border dark:border-darkborder overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border dark:border-darkborder text-link dark:text-darklink bg-muted/30 dark:bg-darkmuted/20'>
              <th className='py-3 px-3 text-left font-semibold'>
                {t('configuracion.services.col.name')}
              </th>
              <th className='py-3 px-3 text-left font-semibold'>
                {t('configuracion.services.col.category')}
              </th>
              <th className='py-3 px-3 text-left font-semibold'>
                {t('configuracion.services.col.price')}
              </th>
              <th className='py-3 px-3 text-left font-semibold'>
                {t('configuracion.services.col.duration')}
              </th>
              <th className='py-3 px-3 text-center font-semibold w-20'>
                {t('configuracion.services.col.active')}
              </th>
              <th className='py-3 px-3 text-right font-semibold w-12'>
                <span className='sr-only'>{t('configuracion.services.col.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => {
              const color = getTreatmentColorBySlug(service.categorySlug)
              return (
                <tr
                  key={service.id}
                  className='border-b border-border dark:border-darkborder last:border-b-0 hover:bg-muted/30 dark:hover:bg-darkmuted/30 transition-colors'>
                  <td className='py-3 px-3 text-dark dark:text-white font-medium'>
                    {service.name}
                  </td>
                  <td className='py-3 px-3'>
                    <span className='inline-flex items-center gap-1.5 text-link dark:text-darklink'>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${color.dotClass}`} />
                      <span>{t(color.labelKey as TranslationKey)}</span>
                    </span>
                  </td>
                  <td className='py-3 px-3 text-dark dark:text-white tabular-nums'>
                    {service.price}
                  </td>
                  <td className='py-3 px-3 text-link dark:text-darklink whitespace-nowrap'>
                    {t('configuracion.services.minutes', { n: String(service.durationMin) })}
                  </td>
                  <td className='py-3 px-3 text-center'>
                    <Switch
                      checked={service.active}
                      onCheckedChange={() => toggleActive(service.id)}
                      aria-label={`${service.name} ${t('configuracion.services.col.active').toLowerCase()}`}
                    />
                  </td>
                  <td className='py-3 px-3 text-right'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type='button'
                          aria-label={t('configuracion.services.col.actions')}
                          className='h-8 w-8 inline-flex items-center justify-center rounded text-link dark:text-darklink hover:text-primary'>
                          <Icon icon='tabler:dots' height={18} width={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end' className='w-40'>
                        <DropdownMenuItem
                          onClick={() => showUnderDevAlert(t('configuracion.services.action.edit'), t)}>
                          <Icon icon='solar:pen-line-duotone' height={16} width={16} className='mr-2' />
                          {t('configuracion.services.action.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(service)}
                          className='text-error focus:text-error focus:bg-error/10'>
                          <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} className='mr-2' />
                          {t('configuracion.services.action.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}