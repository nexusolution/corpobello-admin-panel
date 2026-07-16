'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { useCurrentUser, type UserRole } from '@/lib/auth/useCurrentUser'

// Andrés 2026-06-30: a small dynamic summary under the logo that adapts to
// who signed in AND their role — same dashboard, reprioritised per role.
type SummaryLine = {
  icon: string
  key: TranslationKey
  params?: Record<string, string>
}

// MOCK counts. The role-branched STRUCTURE is the point here; the numbers get
// wired to Supabase (agenda turnos + leads.status + tasks) as those data
// layers land. The bot already writes leads.status, so the CRM-side lines
// (deposits pending, awaiting reply) can go live before the agenda does.
const ROLE_SUMMARY: Record<UserRole, SummaryLine[]> = {
  admin: [
    { icon: 'solar:users-group-rounded-line-duotone', key: 'greeting.pros', params: { count: '2' } },
    { icon: 'solar:map-point-line-duotone', key: 'greeting.sucursales', params: { list: 'Merlo, Caballito' } },
    { icon: 'solar:calendar-mark-line-duotone', key: 'greeting.scheduled', params: { count: '21' } },
    { icon: 'solar:danger-triangle-line-duotone', key: 'greeting.tasks', params: { count: '5' } },
  ],
  operador: [
    { icon: 'solar:calendar-mark-line-duotone', key: 'greeting.toConfirm', params: { count: '8' } },
    { icon: 'solar:wallet-money-line-duotone', key: 'greeting.pendingDeposits', params: { count: '3' } },
    { icon: 'solar:chat-round-line-duotone', key: 'greeting.awaitingReply', params: { count: '2' } },
  ],
  profesional: [
    { icon: 'solar:calendar-mark-line-duotone', key: 'greeting.myScheduled', params: { count: '12' } },
    { icon: 'solar:map-point-line-duotone', key: 'greeting.attendingAt', params: { sucursal: 'Caballito' } },
    { icon: 'solar:clipboard-list-line-duotone', key: 'greeting.pendingRecords', params: { count: '3' } },
  ],
}

function greetingKey(hour: number): TranslationKey {
  if (hour < 12) return 'greeting.morning'
  if (hour < 20) return 'greeting.afternoon'
  return 'greeting.evening'
}

export function DashboardGreeting() {
  const { t } = useTranslation()
  const { name, role } = useCurrentUser()

  // Time-of-day is computed on the client (after mount) to avoid an SSR/CSR
  // hydration mismatch — the server's clock and the viewer's may differ.
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => setHour(new Date().getHours()), [])

  const hello = hour === null ? t('greeting.hello') : t(greetingKey(hour))
  const lines = ROLE_SUMMARY[role]

  return (
    <div className='mb-1'>
      <h1 className='text-xl sm:text-2xl font-semibold text-dark dark:text-white'>
        {hello}, {name}.
      </h1>
      <div className='mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5'>
        {lines.map((line) => (
          <span
            key={line.key}
            className='inline-flex items-center gap-1.5 text-sm text-link dark:text-darklink'>
            <Icon
              icon={line.icon}
              height={16}
              width={16}
              className='text-primary shrink-0'
            />
            {t(line.key, line.params)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default DashboardGreeting
