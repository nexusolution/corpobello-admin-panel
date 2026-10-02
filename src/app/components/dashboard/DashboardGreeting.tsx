'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { useCurrentUser, type UserRole } from '@/lib/auth/useCurrentUser'
import { fetchFunnelCounts, fetchTodaySummary, type TodaySummary } from './data'
import { getCurrentUserId } from '@/lib/data/calendar-events'

// Andrés 2026-06-30: a small dynamic summary under the logo that adapts to
// who signed in AND their role — same dashboard, reprioritised per role.
// Andrés 2026-10-02: the counts are now LIVE (today's turnos + leads.status),
// no longer hardcoded samples.
type SummaryLine = {
  icon: string
  key: TranslationKey
  params?: Record<string, string>
}

const SUCURSAL_LABELS: Record<string, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

// Build the role-branched summary lines from real data. `tasks` (admin) mirrors
// the "Needs your attention now" list = deposits to confirm + patients awaiting
// reply. Unknown-source metrics (e.g. pending clinical records) read 0 until a
// data model lands rather than showing a fake number.
function buildLines(
  role: UserRole,
  today: TodaySummary,
  tasks: number,
  pendingDeposits: number,
  awaitingReply: number,
  t: (k: TranslationKey, p?: Record<string, string>) => string,
): SummaryLine[] {
  const sucursalList =
    today.sucursales.map((s) => SUCURSAL_LABELS[s] ?? s).join(', ') || t('agenda.noSucursal')
  switch (role) {
    case 'admin':
      return [
        { icon: 'solar:users-group-rounded-line-duotone', key: 'greeting.pros', params: { count: String(today.professionalsCount) } },
        { icon: 'solar:map-point-line-duotone', key: 'greeting.sucursales', params: { list: sucursalList } },
        { icon: 'solar:calendar-mark-line-duotone', key: 'greeting.scheduled', params: { count: String(today.scheduled) } },
        { icon: 'solar:danger-triangle-line-duotone', key: 'greeting.tasks', params: { count: String(tasks) } },
      ]
    case 'operador':
      return [
        { icon: 'solar:calendar-mark-line-duotone', key: 'greeting.toConfirm', params: { count: String(today.pending) } },
        { icon: 'solar:wallet-money-line-duotone', key: 'greeting.pendingDeposits', params: { count: String(pendingDeposits) } },
        { icon: 'solar:chat-round-line-duotone', key: 'greeting.awaitingReply', params: { count: String(awaitingReply) } },
      ]
    case 'profesional':
      return [
        { icon: 'solar:calendar-mark-line-duotone', key: 'greeting.myScheduled', params: { count: String(today.myScheduled) } },
        { icon: 'solar:map-point-line-duotone', key: 'greeting.attendingAt', params: { sucursal: today.mySucursal ? SUCURSAL_LABELS[today.mySucursal] ?? today.mySucursal : t('agenda.noSucursal') } },
        { icon: 'solar:clipboard-list-line-duotone', key: 'greeting.pendingRecords', params: { count: '0' } },
      ]
  }
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

  // Live summary + funnel counts for the header lines.
  const [lines, setLines] = useState<SummaryLine[]>([])
  useEffect(() => {
    let alive = true
    async function load() {
      const myId = role === 'profesional' ? await getCurrentUserId() : null
      const [today, funnel] = await Promise.all([
        fetchTodaySummary(myId),
        fetchFunnelCounts(),
      ])
      if (!alive) return
      const pendingDeposits = funnel.counts.awaitingDeposit ?? 0
      const awaitingReply = funnel.counts.followUp ?? 0
      const tasks = pendingDeposits + awaitingReply
      setLines(buildLines(role, today, tasks, pendingDeposits, awaitingReply, t))
    }
    void load()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const hello = hour === null ? t('greeting.hello') : t(greetingKey(hour))

  return (
    <div className='mb-1'>
      <h1 className='text-xl sm:text-2xl font-semibold text-dark dark:text-white'>
        {name ? `${hello}, ${name}.` : `${hello}.`}
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
