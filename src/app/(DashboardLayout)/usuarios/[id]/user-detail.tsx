'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'

import {
  MOCK_USERS,
  SUCURSAL_LABELS,
  type ActivityEntry,
  type ActivityStatus,
  type AppUser,
  type UserRole,
} from '../mock-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const RECENT_KEY = 'panel-recent-users'
const RECENT_LIMIT = 6

function useRecentUsers(currentId: string): AppUser[] {
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    if (typeof window === 'undefined') return
    let stored: string[] = []
    try {
      const raw = window.localStorage.getItem(RECENT_KEY)
      stored = raw ? (JSON.parse(raw) as string[]).filter((v) => typeof v === 'string') : []
    } catch {
      stored = []
    }
    const next = [currentId, ...stored.filter((id) => id !== currentId)].slice(0, RECENT_LIMIT)
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {}
    setIds(next)
  }, [currentId])

  return useMemo(() => {
    return ids
      .map((id) => MOCK_USERS.find((u) => u.id === id))
      .filter((u): u is AppUser => Boolean(u))
  }, [ids])
}

function roleLabelKey(role: UserRole): TranslationKey {
  return role === 'admin'
    ? 'users.role.admin'
    : role === 'operador'
    ? 'users.role.operador'
    : 'users.role.profesional'
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale === 'es' ? 'es-AR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string, locale: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  const dateFmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
  const timeFmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return { date: dateFmt.format(d), time: timeFmt.format(d) }
}

// ---------- Left rail: recently viewed users ----------

type RecentRange = 'today' | 'week' | 'all'

const RANGE_OPTIONS: ReadonlyArray<{ value: RecentRange; labelKey: TranslationKey }> = [
  { value: 'today', labelKey: 'userDetail.recent.rangeToday' },
  { value: 'week', labelKey: 'userDetail.recent.rangeWeek' },
  { value: 'all', labelKey: 'userDetail.recent.rangeAll' },
]

function phoneToWa(phone: string): string {
  // Strip everything that isn't a digit — WhatsApp wa.me expects a plain
  // international number without symbols or spaces.
  return phone.replace(/\D+/g, '')
}

function RecentUsersRail({
  currentId,
  users,
  t,
}: {
  currentId: string
  users: AppUser[]
  t: TFn
}) {
  const [range, setRange] = useState<RecentRange>('today')
  const currentRangeLabel =
    RANGE_OPTIONS.find((r) => r.value === range) ?? RANGE_OPTIONS[0]

  return (
    <aside className='rounded-lg border border-border dark:border-darkborder bg-card p-4 flex flex-col gap-3'>
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='size-10 rounded-md bg-lightprimary flex items-center justify-center'>
            <Icon icon='solar:history-line-duotone' height={22} width={22} className='text-primary' />
          </div>
          <div>
            <p className='text-sm font-semibold text-dark dark:text-white leading-tight'>
              {t('userDetail.recent.title')}
            </p>
            <p className='text-xs text-link dark:text-darklink'>
              {t('userDetail.recent.count', { count: String(users.length) })}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='inline-flex items-center gap-1 text-xs text-link dark:text-darklink border border-border dark:border-darkborder rounded-md px-2 py-1 hover:border-primary hover:text-primary transition-colors'>
              {t(currentRangeLabel.labelKey)}
              <Icon icon='tabler:chevron-down' height={12} width={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='min-w-[140px]'>
            {RANGE_OPTIONS.map((opt) => {
              const isSelected = opt.value === range
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={
                    isSelected
                      ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                      : ''
                  }>
                  <Icon
                    icon='tabler:check'
                    height={14}
                    width={14}
                    className={`mr-2 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {t(opt.labelKey)}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='flex flex-col gap-3 mt-1'>
        {users.length === 0 ? (
          <p className='text-xs text-link dark:text-darklink py-4 text-center'>
            {t('userDetail.recent.empty')}
          </p>
        ) : (
          users.map((u) => {
            const isCurrent = u.id === currentId
            const wa = u.phone ? phoneToWa(u.phone) : null
            return (
              <Link
                key={u.id}
                href={`/usuarios/${u.id}`}
                className={`group relative block p-3 pb-4 rounded-lg border transition-colors ${
                  isCurrent
                    ? 'border-primary bg-lightprimary/40'
                    : 'border-border dark:border-darkborder hover:border-primary/60 hover:bg-lightprimary/20'
                }`}>
                {/* Top row: avatar (left) + call/chat (right) */}
                <div className='flex items-start justify-between gap-2 mb-3'>
                  <div className='relative shrink-0'>
                    <Avatar className='size-12 ring-1 ring-border dark:ring-darkborder'>
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} className='object-cover' />}
                      <AvatarFallback className='bg-lightprimary text-primary'>
                        <Icon icon='solar:user-bold-duotone' height={24} width={24} />
                      </AvatarFallback>
                    </Avatar>
                    {u.status === 'active' && (
                      <span className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card' />
                    )}
                  </div>
                  <div className='flex items-center gap-1.5 shrink-0'>
                    <a
                      href={u.phone ? `tel:${u.phone}` : undefined}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t('userDetail.recent.callAria', { name: u.fullName })}
                      aria-disabled={!u.phone}
                      className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors ${
                        u.phone
                          ? 'bg-muted/50 dark:bg-darkmuted/40 text-link dark:text-darklink hover:bg-primary hover:text-white'
                          : 'bg-muted/30 text-link/40 dark:text-darklink/40 cursor-not-allowed pointer-events-none'
                      }`}>
                      <Icon icon='solar:phone-linear' height={14} width={14} />
                    </a>
                    <a
                      href={wa ? `https://wa.me/${wa}` : undefined}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t('userDetail.recent.chatAria', { name: u.fullName })}
                      aria-disabled={!wa}
                      className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors ${
                        wa
                          ? 'bg-muted/50 dark:bg-darkmuted/40 text-link dark:text-darklink hover:bg-primary hover:text-white'
                          : 'bg-muted/30 text-link/40 dark:text-darklink/40 cursor-not-allowed pointer-events-none'
                      }`}>
                      <Icon icon='solar:chat-round-line-linear' height={14} width={14} />
                    </a>
                  </div>
                </div>

                {/* Name + role — full-width, below the top row */}
                <div className='min-w-0 pr-10'>
                  <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-dark dark:text-white'}`}>
                    {u.fullName}
                  </p>
                  <p className='text-xs text-link dark:text-darklink truncate mt-0.5'>
                    {t(roleLabelKey(u.role))}
                  </p>
                </div>

                {/* Bottom-right navigate arrow */}
                <span
                  aria-hidden='true'
                  className={`absolute bottom-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-full transition-colors ${
                    isCurrent
                      ? 'bg-primary text-white'
                      : 'border border-primary text-primary group-hover:bg-primary group-hover:text-white'
                  }`}>
                  <Icon icon='tabler:arrow-up-right' height={14} width={14} />
                </span>
              </Link>
            )
          })
        )}
      </div>
    </aside>
  )
}

// ---------- Center: identity card ----------

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className='inline-flex items-center gap-1'>
      {Array.from({ length: full }, (_, i) => (
        <Icon key={`f${i}`} icon='tabler:star-filled' height={16} width={16} className='text-warning' />
      ))}
      {half && <Icon icon='tabler:star-half-filled' height={16} width={16} className='text-warning' />}
      {Array.from({ length: empty }, (_, i) => (
        <Icon key={`e${i}`} icon='tabler:star' height={16} width={16} className='text-link dark:text-darklink' />
      ))}
    </span>
  )
}

function IdentityCard({ user, t }: { user: AppUser; t: TFn }) {
  const roleLabel = t(roleLabelKey(user.role))
  const rating = user.professionalDetails?.rating

  return (
    <div className='relative rounded-lg border border-border dark:border-darkborder bg-card overflow-hidden'>
      {/* Hero — decorative colored strip only */}
      <div className='h-20 bg-gradient-to-r from-lightprimary via-lightsuccess/60 to-lightprimary' />

      {/* Avatar — absolute, straddles the hero/content boundary */}
      <div className='absolute left-6 top-12'>
        <div className='relative'>
          <Avatar className='size-36 !rounded-full ring-4 ring-card shadow-md'>
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} className='object-cover' />}
            <AvatarFallback className='!rounded-full bg-lightprimary text-primary'>
              <Icon icon='solar:user-bold-duotone' height={56} width={56} />
            </AvatarFallback>
          </Avatar>
          {user.status === 'active' && (
            <span className='absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full bg-success ring-2 ring-card' />
          )}
        </div>
      </div>

      <div className='px-6 pt-6 pb-6'>
        {/* Identity block — mobile: pushes below avatar with top padding; desktop: sits to the right */}
        <div className='mb-6 pt-24 sm:pt-0 sm:pl-44 sm:min-h-[80px] sm:flex sm:flex-col sm:justify-center'>
          <div className='flex items-center justify-between gap-4 flex-wrap mb-2'>
            <div className='flex items-center gap-2 flex-wrap'>
              <span className='inline-flex items-center gap-1.5 text-xs font-medium text-success'>
                <span className='h-2 w-2 rounded-full bg-success' />
                {user.status === 'active'
                  ? t('userDetail.identity.active')
                  : t('userDetail.identity.inactive')}
              </span>
              <span className='inline-flex items-center gap-1 text-xs font-medium text-dark dark:text-white bg-card/70 border border-border dark:border-darkborder rounded-md px-2 py-0.5'>
                {roleLabel}
              </span>
            </div>
            {rating !== undefined && (
              <div className='flex items-center gap-2'>
                <StarRating rating={rating} />
                <span className='text-sm font-semibold text-dark dark:text-white'>{rating.toFixed(1)}</span>
                <span className='text-xs text-link dark:text-darklink'>/5.0</span>
              </div>
            )}
          </div>

          <div className='min-w-0'>
            <h2 className='text-xl font-bold text-dark dark:text-white'>{user.fullName}</h2>
            <p className='text-sm text-link dark:text-darklink mt-0.5'>
              {user.bio ?? roleLabel}
            </p>
          </div>
        </div>

        {/* Divider + bottom section: contact + action buttons */}
        <div className='border-t border-border dark:border-darkborder pt-8'>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-5'>
            <ContactCell
              icon='solar:phone-bold-duotone'
              tint='success'
              label={t('userDetail.identity.contactPhone')}
              value={user.phone ?? '—'}
            />
            <ContactCell
              icon='solar:letter-bold-duotone'
              tint='primary'
              label={t('userDetail.identity.contactEmail')}
              value={user.email}
            />
            <ContactCell
              icon='solar:map-point-bold-duotone'
              tint='warning'
              label={t('userDetail.identity.contactLocation')}
              value={user.location ?? '—'}
            />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8'>
            <button
              type='button'
              className='inline-flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
              <Icon icon='solar:phone-linear' height={16} width={16} />
              {t('userDetail.identity.call')}
            </button>
            <button
              type='button'
              className='inline-flex items-center justify-center gap-2 py-2.5 rounded-md border border-primary text-primary text-sm font-medium hover:bg-lightprimary transition-colors'>
              <Icon icon='solar:chat-round-line-linear' height={16} width={16} />
              {t('userDetail.identity.chat')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type ContactTint = 'success' | 'primary' | 'warning'
const CONTACT_TINT: Record<ContactTint, { bg: string; text: string }> = {
  success: { bg: 'bg-lightsuccess', text: 'text-success' },
  primary: { bg: 'bg-lightprimary', text: 'text-primary' },
  warning: { bg: 'bg-lightwarning', text: 'text-warning' },
}

function ContactCell({
  icon,
  tint,
  label,
  value,
}: {
  icon: string
  tint: ContactTint
  label: string
  value: string
}) {
  const style = CONTACT_TINT[tint]
  return (
    <div className='flex items-start gap-2'>
      <span className={`h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md ${style.bg} ${style.text}`}>
        <Icon icon={icon} height={18} width={18} />
      </span>
      <div className='min-w-0'>
        <p className='text-[11px] font-medium tracking-wide uppercase text-link dark:text-darklink'>{label}</p>
        <p className='text-sm text-dark dark:text-white truncate'>{value}</p>
      </div>
    </div>
  )
}

// ---------- Right: role-aware summary card ----------

function SummaryCard({ user, t, locale }: { user: AppUser; t: TFn; locale: string }) {
  const roleLabel = t(roleLabelKey(user.role))
  const sucursalLabel = user.sucursal ? SUCURSAL_LABELS[user.sucursal] : t('users.sucursal.none')
  const joined = formatDate(user.createdAt, locale)

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-6'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <div className='size-10 rounded-md bg-lightprimary flex items-center justify-center'>
            <Icon icon='solar:diploma-verified-line-duotone' height={22} width={22} className='text-primary' />
          </div>
          <div>
            <p className='text-sm font-semibold text-dark dark:text-white leading-tight'>
              {t('userDetail.summary.title')}
            </p>
            <p className='text-xs text-link dark:text-darklink max-w-[220px] leading-tight mt-0.5'>
              {t('userDetail.summary.subtitle')}
            </p>
          </div>
        </div>
        <span className='shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-lightsuccess text-success'>
          {roleLabel}
        </span>
      </div>

      {/* Role-specific KPI trio */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6'>
        {user.role === 'profesional' && user.professionalDetails && (
          <>
            <KpiCell
              tint='blue'
              titleKey='userDetail.pro.experience.title'
              value={t('userDetail.pro.experience.value', {
                years: String(user.professionalDetails.yearsExperience),
              })}
              footerKey='userDetail.pro.experience.footer'
              progress={Math.min(100, (user.professionalDetails.yearsExperience / 20) * 100)}
              t={t}
            />
            <KpiCell
              tint='orange'
              titleKey='userDetail.pro.patients.title'
              value={String(user.professionalDetails.patientsAttended)}
              footerKey='userDetail.pro.patients.footer'
              progress={Math.min(100, (user.professionalDetails.patientsAttended / 500) * 100)}
              t={t}
            />
            <KpiCell
              tint='cyan'
              titleKey='userDetail.pro.rating.title'
              value={t('userDetail.pro.rating.value', {
                value: user.professionalDetails.rating.toFixed(1),
              })}
              footerKey='userDetail.pro.rating.footer'
              progress={(user.professionalDetails.rating / 5) * 100}
              t={t}
            />
          </>
        )}

        {user.role === 'operador' && user.operatorDetails && (
          <>
            <KpiCell
              tint='blue'
              titleKey='userDetail.op.bookings.title'
              value={String(user.operatorDetails.bookingsThisMonth)}
              footerKey='userDetail.op.bookings.footer'
              progress={Math.min(100, user.operatorDetails.bookingsThisMonth)}
              t={t}
            />
            <KpiCell
              tint='orange'
              titleKey='userDetail.op.calls.title'
              value={String(user.operatorDetails.callsHandled)}
              footerKey='userDetail.op.calls.footer'
              progress={Math.min(100, (user.operatorDetails.callsHandled / 150) * 100)}
              t={t}
            />
            <KpiCell
              tint='cyan'
              titleKey='userDetail.op.response.title'
              value={t('userDetail.op.response.value', {
                value: Math.round(user.operatorDetails.responseRate * 100).toString(),
              })}
              footerKey='userDetail.op.response.footer'
              progress={user.operatorDetails.responseRate * 100}
              t={t}
            />
          </>
        )}

        {user.role === 'admin' && user.adminDetails && (
          <>
            <KpiCell
              tint='blue'
              titleKey='userDetail.admin.lastLogin.title'
              value={formatDate(user.adminDetails.lastLoginIso, locale)}
              footerKey='userDetail.admin.lastLogin.footer'
              progress={100}
              t={t}
            />
            <KpiCell
              tint='orange'
              titleKey='userDetail.admin.users.title'
              value={String(user.adminDetails.createdUsers)}
              footerKey='userDetail.admin.users.footer'
              progress={Math.min(100, user.adminDetails.createdUsers * 5)}
              t={t}
            />
            <KpiCell
              tint='cyan'
              titleKey='userDetail.admin.config.title'
              value={String(user.adminDetails.configChanges)}
              footerKey='userDetail.admin.config.footer'
              progress={Math.min(100, user.adminDetails.configChanges * 2)}
              t={t}
            />
          </>
        )}
      </div>

      {/* Footer meta grid */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border dark:border-darkborder'>
        <MetaCell
          icon='solar:buildings-3-line-duotone'
          label={t('userDetail.summary.sucursalLabel')}
          value={sucursalLabel}
        />
        <MetaCell
          icon='solar:calendar-line-duotone'
          label={t('userDetail.summary.joinedLabel')}
          value={joined}
        />
        {user.role === 'operador' && user.operatorDetails && (
          <MetaCell
            icon='solar:clock-circle-line-duotone'
            label={t('userDetail.op.shiftLabel')}
            value={user.operatorDetails.shiftsSlot}
          />
        )}
        {user.role === 'profesional' && user.professionalDetails && (
          <MetaCell
            icon='solar:heart-pulse-2-line-duotone'
            label={t('userDetail.summary.specialtyLabel')}
            value={user.professionalDetails.specialties.join(', ')}
          />
        )}
        {user.role === 'admin' && user.adminDetails && (
          <MetaCell
            icon='solar:shield-user-line-duotone'
            label={t('userDetail.admin.permissionsLabel')}
            value={user.adminDetails.permissionsLevel}
          />
        )}
      </div>
    </div>
  )
}

type KpiTint = 'blue' | 'orange' | 'cyan'
const TINT_STYLES: Record<
  KpiTint,
  { bg: string; dot: string; text: string; barTrack: string; barFill: string }
> = {
  blue: {
    bg: 'bg-lightprimary/50',
    dot: 'bg-primary',
    text: 'text-primary',
    barTrack: 'bg-primary/20',
    barFill: 'bg-primary',
  },
  orange: {
    bg: 'bg-lightwarning/50',
    dot: 'bg-warning',
    text: 'text-warning',
    barTrack: 'bg-warning/20',
    barFill: 'bg-warning',
  },
  cyan: {
    bg: 'bg-lightsuccess/50',
    dot: 'bg-success',
    text: 'text-success',
    barTrack: 'bg-success/20',
    barFill: 'bg-success',
  },
}

function KpiCell({
  tint,
  titleKey,
  value,
  footerKey,
  progress,
  t,
}: {
  tint: KpiTint
  titleKey: TranslationKey
  value: string
  footerKey: TranslationKey
  /** 0..100 — fraction filled in the progress bar */
  progress: number
  t: TFn
}) {
  const style = TINT_STYLES[tint]
  const pct = Math.max(0, Math.min(100, progress))
  return (
    <div className={`rounded-lg p-4 ${style.bg}`}>
      <div className='flex items-center gap-1.5 mb-1.5'>
        <span className={`h-2 w-2 rotate-45 ${style.dot}`} />
        <p className='text-[11px] font-medium text-link dark:text-darklink'>{t(titleKey)}</p>
      </div>
      <p className='text-lg font-bold text-dark dark:text-white leading-tight'>{value}</p>
      <div className={`mt-2.5 h-1.5 rounded-full overflow-hidden ${style.barTrack}`}>
        <div
          className={`h-full rounded-full ${style.barFill} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${style.text}`}>
        <Icon icon='tabler:arrow-up-right' height={11} width={11} />
        <span>{t(footerKey)}</span>
      </p>
    </div>
  )
}

function MetaCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className='flex items-start gap-3'>
      <span className='h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md bg-muted/50 dark:bg-darkmuted/40 text-link dark:text-darklink'>
        <Icon icon={icon} height={18} width={18} />
      </span>
      <div className='min-w-0 pt-0.5'>
        <p className='text-[11px] font-medium tracking-wide uppercase text-link dark:text-darklink'>{label}</p>
        <p className='text-sm text-dark dark:text-white truncate mt-0.5'>{value}</p>
      </div>
    </div>
  )
}

// ---------- Bottom: activity table (role-aware) ----------

function StatusPill({ status, t }: { status: ActivityStatus; t: TFn }) {
  const map: Record<ActivityStatus, { bg: string; text: string; dot: string; label: TranslationKey }> = {
    completed: { bg: 'bg-lightsuccess', text: 'text-success', dot: 'bg-success', label: 'userDetail.activity.status.completed' },
    scheduled: { bg: 'bg-lighterror', text: 'text-error', dot: 'bg-error', label: 'userDetail.activity.status.scheduled' },
    ongoing: { bg: 'bg-lightwarning', text: 'text-warning', dot: 'bg-warning', label: 'userDetail.activity.status.ongoing' },
    cancelled: { bg: 'bg-muted/60 dark:bg-darkmuted/40', text: 'text-link dark:text-darklink', dot: 'bg-link dark:bg-darklink', label: 'userDetail.activity.status.cancelled' },
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {t(s.label)}
    </span>
  )
}

function ActivityTable({ user, t, locale }: { user: AppUser; t: TFn; locale: string }) {
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<ActivityEntry[]>(user.activity ?? [])

  useEffect(() => {
    setEntries(user.activity ?? [])
  }, [user.activity])

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const rows = useMemo(() => {
    if (!search) return entries
    const q = search.toLowerCase()
    return entries.filter(
      (r) =>
        r.primary.toLowerCase().includes(q) ||
        (r.secondary?.toLowerCase().includes(q) ?? false) ||
        (r.tertiary?.toLowerCase().includes(q) ?? false)
    )
  }, [entries, search])

  const titleKey: TranslationKey =
    user.role === 'profesional'
      ? 'userDetail.activity.pro.title'
      : user.role === 'operador'
      ? 'userDetail.activity.op.title'
      : 'userDetail.activity.admin.title'
  const subtitleKey: TranslationKey =
    user.role === 'profesional'
      ? 'userDetail.activity.pro.subtitle'
      : user.role === 'operador'
      ? 'userDetail.activity.op.subtitle'
      : 'userDetail.activity.admin.subtitle'

  const columnLabels =
    user.role === 'profesional'
      ? {
          primary: t('userDetail.activity.col.treatment'),
          secondary: t('userDetail.activity.col.patient'),
          tertiary: t('userDetail.activity.col.session'),
        }
      : user.role === 'operador'
      ? {
          primary: t('userDetail.activity.col.action'),
          secondary: t('userDetail.activity.col.entity'),
          tertiary: t('userDetail.activity.col.detail'),
        }
      : {
          primary: t('userDetail.activity.col.event'),
          secondary: t('userDetail.activity.col.target'),
          tertiary: t('userDetail.activity.col.detail'),
        }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-6'>
      <div className='flex items-start justify-between gap-3 flex-wrap mb-5'>
        <div className='flex items-center gap-3'>
          <div className='size-10 rounded-md bg-lightprimary flex items-center justify-center'>
            <Icon icon='solar:users-group-two-rounded-line-duotone' height={22} width={22} className='text-primary' />
          </div>
          <div>
            <p className='text-sm font-semibold text-dark dark:text-white leading-tight'>{t(titleKey)}</p>
            <p className='text-xs text-link dark:text-darklink leading-tight mt-0.5'>{t(subtitleKey)}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <div className='relative'>
            <Icon
              icon='solar:magnifer-linear'
              height={14}
              width={14}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink pointer-events-none'
            />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('userDetail.activity.searchPlaceholder')}
              className='pl-8 pr-3 py-1.5 rounded-md border border-border dark:border-darkborder bg-muted/30 dark:bg-darkmuted/30 text-xs text-dark dark:text-white focus:outline-none focus:border-primary transition-colors w-[180px]'
            />
          </div>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border dark:border-darkborder text-link dark:text-darklink text-xs'>
              <th className='py-3 px-3 text-left font-medium'>{t('userDetail.activity.col.dateTime')}</th>
              <th className='py-3 px-3 text-left font-medium'>{columnLabels.secondary}</th>
              <th className='py-3 px-3 text-left font-medium'>{columnLabels.primary}</th>
              <th className='py-3 px-3 text-left font-medium'>{columnLabels.tertiary}</th>
              <th className='py-3 px-3 text-left font-medium'>{t('userDetail.activity.col.status')}</th>
              <th className='py-3 px-3 text-right font-medium'>{t('userDetail.activity.col.actionCol')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className='py-10 text-center text-sm text-link dark:text-darklink'>
                  {t('userDetail.activity.empty')}
                </td>
              </tr>
            ) : (
              rows.map((entry) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  t={t}
                  locale={locale}
                  onDelete={handleDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type RowActionTint = 'primary' | 'success' | 'error'
const ROW_ACTION_TINT: Record<RowActionTint, string> = {
  primary: 'bg-lightprimary text-primary hover:bg-primary hover:text-white',
  success: 'bg-lightsuccess text-success hover:bg-success hover:text-white',
  error: 'bg-lighterror text-error hover:bg-error hover:text-white',
}

function RowActionButton({
  icon,
  tint,
  label,
  onClick,
}: {
  icon: string
  tint: RowActionTint
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors ${ROW_ACTION_TINT[tint]}`}>
      <Icon icon={icon} height={15} width={15} />
    </button>
  )
}

function ActivityRow({
  entry,
  t,
  locale,
  onDelete,
}: {
  entry: ActivityEntry
  t: TFn
  locale: string
  onDelete: (id: string) => void
}) {
  const { date, time } = formatDateTime(entry.date, locale)
  return (
    <tr className='border-b border-border dark:border-darkborder last:border-b-0 hover:bg-muted/30 dark:hover:bg-darkmuted/30 transition-colors'>
      <td className='py-3 px-3 whitespace-nowrap'>
        <p className='text-sm text-dark dark:text-white'>{date}</p>
        <p className='text-xs text-link dark:text-darklink'>{time}</p>
      </td>
      <td className='py-3 px-3'>
        <p className='text-sm text-dark dark:text-white'>{entry.secondary ?? '—'}</p>
      </td>
      <td className='py-3 px-3 text-dark dark:text-white'>{entry.primary}</td>
      <td className='py-3 px-3 text-link dark:text-darklink'>{entry.tertiary ?? '—'}</td>
      <td className='py-3 px-3'>{entry.status && <StatusPill status={entry.status} t={t} />}</td>
      <td className='py-3 px-3 text-right'>
        <div className='inline-flex items-center gap-2'>
          <RowActionButton
            icon='solar:pen-line-duotone'
            tint='primary'
            label={t('users.action.edit')}
          />
          <RowActionButton
            icon='solar:eye-line-duotone'
            tint='success'
            label={t('users.action.viewDetail')}
          />
          <RowActionButton
            icon='solar:trash-bin-trash-line-duotone'
            tint='error'
            label={t('users.action.delete')}
            onClick={() => onDelete(entry.id)}
          />
        </div>
      </td>
    </tr>
  )
}

// ---------- Not-found fallback ----------

function NotFoundState({ t }: { t: TFn }) {
  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-16 flex flex-col items-center text-center gap-3'>
      <div className='size-16 rounded-full bg-lightprimary/60 flex items-center justify-center'>
        <Icon icon='solar:user-cross-line-duotone' height={32} width={32} className='text-primary' />
      </div>
      <p className='text-base font-semibold text-dark dark:text-white'>{t('userDetail.notFound.title')}</p>
      <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('userDetail.notFound.body')}</p>
      <Link
        href='/usuarios'
        className='mt-1 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
        {t('userDetail.notFound.back')}
      </Link>
    </div>
  )
}

// ---------- Main ----------

export function UserDetail({ id }: { id: string }) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const user = MOCK_USERS.find((u) => u.id === id)
  const recent = useRecentUsers(id)

  if (!user) {
    return <NotFoundState t={t} />
  }

  return (
    <div className='space-y-6'>
      {/* Header row */}
      <div className='flex items-start justify-between gap-4 flex-wrap'>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => router.push('/usuarios')}
            aria-label={t('userDetail.backLabel')}
            className='h-10 w-10 inline-flex items-center justify-center rounded-md border border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
            <Icon icon='tabler:arrow-left' height={18} width={18} />
          </button>
          <div className='h-10 w-10 rounded-md bg-lightprimary inline-flex items-center justify-center'>
            <Icon icon='solar:user-id-line-duotone' height={22} width={22} className='text-primary' />
          </div>
          <div>
            <h1 className='text-xl font-semibold text-dark dark:text-white leading-tight'>
              {t('userDetail.title')}
            </h1>
            <div className='flex items-center gap-1.5 text-xs text-link dark:text-darklink mt-1'>
              <Link href='/usuarios' className='hover:text-primary transition-colors'>
                {t('userDetail.breadcrumb.parent')}
              </Link>
              <Icon icon='tabler:chevron-right' height={12} width={12} />
              <span className='text-dark dark:text-white font-medium'>{user.fullName}</span>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            className='inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 dark:hover:bg-darkmuted/40 transition-colors'>
            <Icon icon='solar:pen-line-duotone' height={16} width={16} />
            {t('userDetail.editProfile')}
          </button>
          <button
            type='button'
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              user.status === 'active'
                ? 'bg-error text-white hover:bg-error/90'
                : 'bg-success text-white hover:bg-success/90'
            }`}>
            <Icon
              icon={user.status === 'active' ? 'solar:user-block-line-duotone' : 'solar:user-check-line-duotone'}
              height={16}
              width={16}
            />
            {user.status === 'active'
              ? t('userDetail.deactivate')
              : t('userDetail.activate')}
          </button>
        </div>
      </div>

      {/* Two-column layout: rail on the left spans full height; right column
          stacks identity+summary above the activity table so both share the
          same right-column width. */}
      <div className='grid grid-cols-1 xl:grid-cols-12 gap-6'>
        <div className='xl:col-span-2'>
          <RecentUsersRail currentId={id} users={recent} t={t} />
        </div>
        <div className='xl:col-span-10 space-y-6'>
          <div className='grid grid-cols-1 xl:grid-cols-10 gap-6'>
            <div className='xl:col-span-6'>
              <IdentityCard user={user} t={t} />
            </div>
            <div className='xl:col-span-4'>
              <SummaryCard user={user} t={t} locale={locale} />
            </div>
          </div>
          <ActivityTable user={user} t={t} locale={locale} />
        </div>
      </div>
    </div>
  )
}