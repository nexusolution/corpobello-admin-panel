'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { fetchFunnelCounts, type FunnelCounts } from './data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type Priority = 'urgent' | 'high' | 'medium' | 'disabled'

type TaskRow = {
  key: string
  titleKey: TranslationKey
  subtitleKey: TranslationKey
  count: number | null
  icon: string
  iconBg: string
  iconColor: string
  priority: Priority
  action: 'review' | 'view' | 'open' | 'stage2'
  /** Deep-link target for the live rows (kanban filtered by stage). */
  url?: string
}

// Build the attention rows from live lead-status counts. The two rows that map
// to data the bot already writes (deposits to confirm = 'reservado', awaiting
// reply = 'sin_respuesta') carry real counts and deep-link into the Kanban. The
// rest depend on data models from later stages (agenda TTL → Etapa 2, consents
// → Etapa 4, evolution photos → Etapa 3, stock → inventory), so they're shown
// as upcoming (no fabricated numbers) rather than hidden.
function buildRows(counts: FunnelCounts | null): TaskRow[] {
  const live = (key: number | undefined): number | null =>
    counts ? (key ?? 0) : null
  return [
    {
      key: 'confirmDeposits',
      titleKey: 'tasks.confirmDeposits.title',
      subtitleKey: 'tasks.confirmDeposits.subtitle',
      count: live(counts?.awaitingDeposit),
      icon: 'solar:wallet-money-line-duotone',
      iconBg: 'bg-lighterror',
      iconColor: 'text-error',
      priority: 'urgent',
      action: 'review',
      url: '/kanban?stage=awaitingDeposit',
    },
    {
      key: 'awaitingResponse',
      titleKey: 'tasks.awaitingResponse.title',
      subtitleKey: 'tasks.awaitingResponse.subtitle',
      count: live(counts?.followUp),
      icon: 'solar:chat-round-line-duotone',
      iconBg: 'bg-lightwarning',
      iconColor: 'text-warning',
      priority: 'medium',
      action: 'open',
      url: '/kanban?stage=followUp',
    },
    // ---- Upcoming (need later-stage data models) ----
    {
      key: 'expiringReservations',
      titleKey: 'tasks.expiringReservations.title',
      subtitleKey: 'tasks.expiringReservations.subtitle',
      count: null,
      icon: 'solar:clock-circle-line-duotone',
      iconBg: 'bg-muted/60 dark:bg-darkmuted/40',
      iconColor: 'text-link dark:text-darklink',
      priority: 'disabled',
      action: 'stage2',
    },
    {
      key: 'pendingConsents',
      titleKey: 'tasks.pendingConsents.title',
      subtitleKey: 'tasks.pendingConsents.subtitle',
      count: null,
      icon: 'solar:document-text-line-duotone',
      iconBg: 'bg-muted/60 dark:bg-darkmuted/40',
      iconColor: 'text-link dark:text-darklink',
      priority: 'disabled',
      action: 'stage2',
    },
    {
      key: 'evolutionPhotos',
      titleKey: 'tasks.evolutionPhotos.title',
      subtitleKey: 'tasks.evolutionPhotos.subtitle',
      count: null,
      icon: 'solar:camera-line-duotone',
      iconBg: 'bg-muted/60 dark:bg-darkmuted/40',
      iconColor: 'text-link dark:text-darklink',
      priority: 'disabled',
      action: 'stage2',
    },
    {
      key: 'stockAlerts',
      titleKey: 'tasks.stockAlerts.title',
      subtitleKey: 'tasks.stockAlerts.subtitle',
      count: null,
      icon: 'solar:box-line-duotone',
      iconBg: 'bg-muted/60 dark:bg-darkmuted/40',
      iconColor: 'text-link dark:text-darklink',
      priority: 'disabled',
      action: 'stage2',
    },
  ]
}

const PRIORITY_STRIPE: Record<Priority, string> = {
  urgent: 'border-l-error',
  high: 'border-l-warning',
  medium: 'border-l-warning/50',
  disabled: 'border-l-border dark:border-l-darkborder',
}

const COUNT_COLOR: Record<Priority, string> = {
  urgent: 'text-error',
  high: 'text-dark dark:text-white',
  medium: 'text-dark dark:text-white',
  disabled: 'text-link dark:text-darklink',
}

const ACTION_LABEL_KEY: Record<TaskRow['action'], TranslationKey> = {
  review: 'tasks.attention.action.review',
  view: 'tasks.attention.action.view',
  open: 'tasks.attention.action.open',
  stage2: 'tasks.attention.stage2Badge',
}

const TasksAttention = () => {
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

  const ROWS = buildRows(counts)
  const totalCount = ROWS.reduce((sum, row) => sum + (row.count ?? 0), 0)

  return (
    <CardBox className='h-full w-full'>
      {/* Header */}
      <div className='flex items-center justify-between mb-4 gap-3 flex-wrap'>
        <div className='flex items-center gap-2'>
          <h5 className='card-title'>{t('tasks.attention.title')}</h5>
          <span className='inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-lighterror text-error text-xs font-semibold'>
            {totalCount}
          </span>
        </div>
        <span className='text-xs text-link dark:text-darklink'>
          {t('tasks.attention.sortByPriority')}
        </span>
      </div>

      {/* Task rows */}
      <div className='divide-y divide-border dark:divide-darkborder'>
        {ROWS.map((row) => {
          const isDisabled = row.priority === 'disabled'
          return (
            <div
              key={row.key}
              className={`flex items-center gap-3 border-l-4 ${PRIORITY_STRIPE[row.priority]} pl-3 py-3 ${
                isDisabled ? 'opacity-60' : ''
              }`}>
              <div
                className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${row.iconBg} ${row.iconColor}`}>
                <Icon icon={row.icon} height={18} width={18} />
              </div>

              <div className='flex-1 min-w-0'>
                <div className='text-sm font-semibold text-dark dark:text-white truncate'>
                  {t(row.titleKey)}
                </div>
                <div className='text-xs text-link dark:text-darklink truncate'>
                  {t(row.subtitleKey)}
                </div>
              </div>

              <span
                className={`text-lg font-bold w-8 text-right shrink-0 ${COUNT_COLOR[row.priority]}`}>
                {row.count !== null
                  ? row.count
                  : row.priority === 'disabled'
                    ? ''
                    : '…'}
              </span>

              {row.action === 'stage2' ? (
                <span className='px-2.5 py-1 rounded-md border border-border dark:border-darkborder text-xs font-medium text-link dark:text-darklink shrink-0'>
                  {t(ACTION_LABEL_KEY[row.action])}
                </span>
              ) : row.url ? (
                <Link
                  href={row.url}
                  className='px-3 py-1 rounded-md border border-warning text-warning text-xs font-medium hover:bg-lightwarning transition-colors shrink-0'>
                  {t(ACTION_LABEL_KEY[row.action])}
                </Link>
              ) : (
                <button
                  type='button'
                  className='px-3 py-1 rounded-md border border-warning text-warning text-xs font-medium hover:bg-lightwarning transition-colors shrink-0'>
                  {t(ACTION_LABEL_KEY[row.action])}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </CardBox>
  )
}

export default TasksAttention