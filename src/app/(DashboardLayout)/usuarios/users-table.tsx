'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  SUCURSAL_LABELS,
  type AppUser,
  type UserRole,
  type UserSucursal,
} from './mock-data'
import {
  fetchAppUsers,
  persistUserActive,
  persistUserRole,
  persistUserName,
  createUser as createUserApi,
  deleteUser as deleteUserApi,
} from './data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// ---------- Role + status badges ----------

function RoleBadge({ role, t }: { role: UserRole; t: TFn }) {
  const styles =
    role === 'admin'
      ? 'bg-lightprimary text-primary'
      : role === 'operador'
      ? 'bg-lightsuccess text-success'
      : 'bg-lightwarning text-warning'
  const labelKey: TranslationKey =
    role === 'admin'
      ? 'users.role.admin'
      : role === 'operador'
      ? 'users.role.operador'
      : 'users.role.profesional'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {t(labelKey)}
    </span>
  )
}

function StatusBadge({
  status,
  t,
}: {
  status: 'active' | 'inactive'
  t: TFn
}) {
  if (status === 'active') {
    return (
      <span className='inline-flex items-center gap-1.5 text-xs font-medium text-success'>
        <span className='h-2 w-2 rounded-full bg-success' />
        {t('users.status.active')}
      </span>
    )
  }
  return (
    <span className='inline-flex items-center gap-1.5 text-xs font-medium text-link dark:text-darklink'>
      <span className='h-2 w-2 rounded-full bg-link dark:bg-darklink' />
      {t('users.status.inactive')}
    </span>
  )
}

// ---------- KPI cards + mini bar chart ----------

const BAR_HEIGHTS_A = [30, 45, 40, 55, 50, 65, 60, 75, 70, 90, 85, 95, 80, 100]
const BAR_HEIGHTS_B = [70, 50, 65, 55, 80, 60, 90, 70, 85, 75, 100, 80, 90, 65]
const BAR_HEIGHTS_C = [60, 75, 55, 80, 45, 90, 65, 100, 60, 85, 70, 95, 75, 60]
const BAR_HEIGHTS_D = [40, 60, 50, 70, 55, 80, 70, 90, 60, 100, 75, 85, 65, 55]

type KpiTint = 'success' | 'primary' | 'warning' | 'error'
const KPI_STYLES: Record<KpiTint, { bar: string; barHighlight: string; iconBg: string; iconText: string }> = {
  success: {
    bar: 'bg-lightsuccess',
    barHighlight: 'bg-success',
    iconBg: 'bg-lightsuccess',
    iconText: 'text-success',
  },
  primary: {
    bar: 'bg-lightprimary',
    barHighlight: 'bg-primary',
    iconBg: 'bg-lightprimary',
    iconText: 'text-primary',
  },
  warning: {
    bar: 'bg-lightwarning',
    barHighlight: 'bg-warning',
    iconBg: 'bg-lightwarning',
    iconText: 'text-warning',
  },
  error: {
    bar: 'bg-lighterror',
    barHighlight: 'bg-error',
    iconBg: 'bg-lighterror',
    iconText: 'text-error',
  },
}

function MiniBarChart({ heights, tint }: { heights: number[]; tint: KpiTint }) {
  const style = KPI_STYLES[tint]
  return (
    <div className='flex items-end gap-1 h-10 mt-3'>
      {heights.map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${i >= heights.length - 4 ? style.barHighlight : style.bar}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

function KpiCard({
  label,
  value,
  trend,
  trendUp,
  tint,
  heights,
}: {
  label: string
  value: string
  trend: string
  trendUp: boolean
  tint: KpiTint
  heights: number[]
}) {
  const trendColor = trendUp ? 'text-success bg-lightsuccess' : 'text-error bg-lighterror'
  const trendIcon = trendUp ? 'tabler:trending-up' : 'tabler:trending-down'
  const { t } = useTranslation()

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5'>
      <div className='flex items-start justify-between gap-2'>
        <p className='text-sm text-link dark:text-darklink'>{label}</p>
        <button
          type='button'
          aria-label='More'
          className='text-link dark:text-darklink hover:text-primary transition-colors'>
          <Icon icon='tabler:dots' height={16} width={16} />
        </button>
      </div>
      <div className='flex items-center gap-2 mt-2'>
        <p className='text-3xl font-bold text-dark dark:text-white'>{value}</p>
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-2 py-0.5 ${trendColor}`}>
          <Icon icon={trendIcon} height={11} width={11} />
          {trend}
        </span>
      </div>
      <MiniBarChart heights={heights} tint={tint} />
      <p className='text-[11px] text-link dark:text-darklink mt-2'>
        {t('users.stats.trend')}
      </p>
    </div>
  )
}

function KpiRow({ users, t }: { users: AppUser[]; t: TFn }) {
  const total = users.length
  const active = users.filter((u) => u.status === 'active').length
  const inactive = total - active
  const roles = new Set(users.map((u) => u.role)).size

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
      <KpiCard
        label={t('users.stats.total')}
        value={String(total)}
        trend='4%'
        trendUp
        tint='success'
        heights={BAR_HEIGHTS_A}
      />
      <KpiCard
        label={t('users.stats.active')}
        value={String(active)}
        trend='2%'
        trendUp
        tint='primary'
        heights={BAR_HEIGHTS_B}
      />
      <KpiCard
        label={t('users.stats.inactive')}
        value={String(inactive)}
        trend='8%'
        trendUp={false}
        tint='warning'
        heights={BAR_HEIGHTS_C}
      />
      <KpiCard
        label={t('users.stats.roles')}
        value={String(roles)}
        trend='9%'
        trendUp
        tint='error'
        heights={BAR_HEIGHTS_D}
      />
    </div>
  )
}

// ---------- User card (grid item) ----------

function InfoChip({ value, label }: { value: string; label: string }) {
  return (
    <div className='rounded-md bg-muted/50 dark:bg-darkmuted/40 py-2 px-3 text-center'>
      <p className='text-sm font-bold text-dark dark:text-white leading-tight'>{value}</p>
      <p className='text-[10px] text-link dark:text-darklink mt-0.5 uppercase tracking-wide'>{label}</p>
    </div>
  )
}

function phoneToWa(phone: string): string {
  return phone.replace(/\D+/g, '')
}

function UserCardActionButton({
  href,
  target,
  ariaLabel,
  disabled,
  tint,
  icon,
}: {
  href?: string
  target?: string
  ariaLabel: string
  disabled: boolean
  tint: KpiTint
  icon: string
}) {
  const style = KPI_STYLES[tint]
  const className = `h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors ${
    disabled
      ? 'bg-muted/40 text-link/40 dark:text-darklink/40 cursor-not-allowed pointer-events-none'
      : `${style.iconBg} ${style.iconText} hover:brightness-90`
  }`
  return (
    <a
      href={disabled ? undefined : href}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      className={className}>
      <Icon icon={icon} height={14} width={14} />
    </a>
  )
}

function UserCard({
  user,
  t,
  onEdit,
  onDelete,
  onToggleActive,
  onChangeRole,
}: {
  user: AppUser
  t: TFn
  onEdit: (u: AppUser) => void
  onDelete: (u: AppUser) => void
  onToggleActive: (u: AppUser) => void
  onChangeRole: (u: AppUser, r: UserRole) => void
}) {
  const rating = user.professionalDetails?.rating
  const roleLabel = t(
    user.role === 'admin'
      ? 'users.role.admin'
      : user.role === 'operador'
      ? 'users.role.operador'
      : 'users.role.profesional'
  )

  // Two stats per card, keyed to the user's role
  const stats: Array<{ value: string; label: string }> = (() => {
    if (user.role === 'profesional' && user.professionalDetails) {
      return [
        {
          value: String(user.professionalDetails.patientsAttended),
          label: t('users.card.patients'),
        },
        {
          value: t('users.card.experienceValue', {
            years: String(user.professionalDetails.yearsExperience),
          }),
          label: t('users.card.experience'),
        },
      ]
    }
    if (user.role === 'operador' && user.operatorDetails) {
      return [
        {
          value: String(user.operatorDetails.bookingsThisMonth),
          label: t('users.card.bookings'),
        },
        {
          value: user.operatorDetails.shiftsSlot.split(' ')[0],
          label: t('users.card.shift'),
        },
      ]
    }
    if (user.role === 'admin' && user.adminDetails) {
      return [
        {
          value: String(user.adminDetails.createdUsers),
          label: t('users.card.usersCreated'),
        },
        {
          value: String(user.adminDetails.configChanges),
          label: t('users.card.configChanges'),
        },
      ]
    }
    return []
  })()

  const wa = user.phone ? phoneToWa(user.phone) : null

  return (
    <div className='group relative rounded-lg border border-border dark:border-darkborder bg-card p-5 hover:border-primary/60 transition-colors'>
      {/* Top row: status + role pills */}
      <div className='flex items-start justify-between mb-4'>
        <StatusBadge status={user.status} t={t} />
        <div className='flex items-center gap-1'>
          <RoleBadge role={user.role} t={t} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                aria-label={t('users.col.actions')}
                onClick={(e) => e.stopPropagation()}
                className='h-6 w-6 inline-flex items-center justify-center rounded text-link dark:text-darklink hover:text-primary'>
                <Icon icon='tabler:dots' height={16} width={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44'>
              <DropdownMenuItem asChild>
                <Link href={`/usuarios/${user.id}`} className='w-full'>
                  <Icon icon='solar:eye-line-duotone' height={16} width={16} className='mr-2' />
                  {t('users.action.viewDetail')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(user)}>
                <Icon icon='solar:pen-line-duotone' height={16} width={16} className='mr-2' />
                {t('users.action.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(user)}>
                <Icon
                  icon={user.status === 'active' ? 'solar:pause-line-duotone' : 'solar:play-line-duotone'}
                  height={16}
                  width={16}
                  className='mr-2'
                />
                {user.status === 'active' ? t('users.action.deactivate') : t('users.action.activate')}
              </DropdownMenuItem>
              {(['admin', 'operador', 'profesional'] as const)
                .filter((r) => r !== user.role)
                .map((r) => (
                  <DropdownMenuItem key={r} onClick={() => onChangeRole(user, r)}>
                    <Icon icon='solar:shield-user-line-duotone' height={16} width={16} className='mr-2' />
                    →{' '}
                    {t(
                      r === 'admin'
                        ? 'users.role.admin'
                        : r === 'operador'
                        ? 'users.role.operador'
                        : 'users.role.profesional'
                    )}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuItem
                onClick={() => onDelete(user)}
                className='text-error focus:text-error focus:bg-error/10'>
                <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} className='mr-2' />
                {t('users.action.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Centered avatar with role dot */}
      <Link href={`/usuarios/${user.id}`} className='block'>
        <div className='flex justify-center mb-3'>
          <div className='relative'>
            <Avatar className='size-24 ring-4 ring-lightprimary/40'>
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} className='object-cover' />}
              <AvatarFallback className='bg-lightprimary text-primary'>
                <Icon icon='solar:user-bold-duotone' height={44} width={44} />
              </AvatarFallback>
            </Avatar>
            <span className='absolute bottom-1 right-1 h-6 w-6 rounded-full bg-lightsuccess flex items-center justify-center border-2 border-card'>
              <Icon icon='solar:stethoscope-line-duotone' height={12} width={12} className='text-success' />
            </span>
          </div>
        </div>

        <div className='text-center'>
          <h3 className='text-base font-bold text-dark dark:text-white group-hover:text-primary transition-colors'>
            {user.fullName}
          </h3>
          <p className='text-xs text-link dark:text-darklink mt-0.5 truncate'>
            {user.bio ?? roleLabel}
          </p>
        </div>
      </Link>

      {/* Info chips (2) */}
      {stats.length === 2 && (
        <div className='grid grid-cols-2 gap-2 mt-4'>
          <InfoChip value={stats[0].value} label={stats[0].label} />
          <InfoChip value={stats[1].value} label={stats[1].label} />
        </div>
      )}

      {/* Footer: rating (or spacer) + action buttons */}
      <div className='flex items-center justify-between mt-4'>
        <div className='flex items-center gap-1 min-w-0'>
          {rating !== undefined ? (
            <>
              <Icon icon='tabler:star-filled' height={14} width={14} className='text-warning' />
              <span className='text-sm font-semibold text-dark dark:text-white'>{rating.toFixed(1)}</span>
              <span className='text-xs text-link dark:text-darklink'>/5.0</span>
            </>
          ) : (
            <span className='text-xs text-link dark:text-darklink truncate'>
              {user.location ?? user.email}
            </span>
          )}
        </div>
        <div className='flex items-center gap-1.5'>
          <UserCardActionButton
            href={user.phone ? `tel:${user.phone}` : undefined}
            ariaLabel={t('users.card.actionCall')}
            disabled={!user.phone}
            tint='primary'
            icon='solar:phone-linear'
          />
          <UserCardActionButton
            href={user.email ? `mailto:${user.email}` : undefined}
            ariaLabel={t('users.card.actionEmail')}
            disabled={!user.email}
            tint='warning'
            icon='solar:letter-linear'
          />
          <UserCardActionButton
            href={wa ? `https://wa.me/${wa}` : undefined}
            target='_blank'
            ariaLabel={t('users.card.actionChat')}
            disabled={!wa}
            tint='error'
            icon='solar:chat-round-line-linear'
          />
        </div>
      </div>
    </div>
  )
}

// ---------- Sort dropdown ----------

type SortKey = 'name-asc' | 'name-desc' | 'role' | 'status' | 'recent'
const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; labelKey: TranslationKey }> = [
  { value: 'name-asc', labelKey: 'users.sort.nameAsc' },
  { value: 'name-desc', labelKey: 'users.sort.nameDesc' },
  { value: 'role', labelKey: 'users.sort.role' },
  { value: 'status', labelKey: 'users.sort.status' },
  { value: 'recent', labelKey: 'users.sort.recent' },
]

function SortSelect({
  value,
  onChange,
  t,
}: {
  value: SortKey
  onChange: (next: SortKey) => void
  t: TFn
}) {
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0]
  return (
    <div className='flex items-center gap-2'>
      <span className='text-xs text-link dark:text-darklink'>{t('users.sort.label')}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm text-dark dark:text-white hover:border-primary transition-colors'>
            <span>{t(current.labelKey)}</span>
            <Icon icon='tabler:chevron-down' height={14} width={14} className='text-link dark:text-darklink' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-[160px]'>
          {SORT_OPTIONS.map((opt) => {
            const isSelected = opt.value === value
            return (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onChange(opt.value)}
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
  )
}

// ---------- Add / edit user dialog (unchanged from previous version) ----------

type DraftUser = {
  fullName: string
  email: string
  password: string
  role: UserRole
  sucursal: UserSucursal
  avatarUrl?: string
}

const EMPTY_DRAFT: DraftUser = {
  fullName: '',
  email: '',
  password: '',
  role: 'operador',
  sucursal: null,
}

const ROLE_OPTIONS: ReadonlyArray<{
  value: UserRole
  labelKey: TranslationKey
  descriptionKey: TranslationKey
}> = [
  { value: 'admin', labelKey: 'users.role.admin', descriptionKey: 'users.role.adminDescription' },
  { value: 'operador', labelKey: 'users.role.operador', descriptionKey: 'users.role.operadorDescription' },
  { value: 'profesional', labelKey: 'users.role.profesional', descriptionKey: 'users.role.profesionalDescription' },
]

function DialogSucursalSelect({
  value,
  onChange,
  noneLabel,
}: {
  value: UserSucursal
  onChange: (next: UserSucursal) => void
  noneLabel: string
}) {
  const options: Array<{ value: UserSucursal; label: string }> = [
    { value: null, label: noneLabel },
    { value: 'caballito', label: SUCURSAL_LABELS.caballito },
    { value: 'merlo', label: SUCURSAL_LABELS.merlo },
    { value: 'moreno', label: SUCURSAL_LABELS.moreno },
  ]
  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm font-medium text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
          <span>{current.label}</span>
          <Icon icon='tabler:chevron-down' height={14} width={14} className='text-link dark:text-darklink' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-[var(--radix-dropdown-menu-trigger-width)]'>
        {options.map((opt) => {
          const isSelected = opt.value === value
          const key = opt.value ?? '__none__'
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onChange(opt.value)}
              className={
                isSelected
                  ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                  : ''
              }>
              <Icon
                icon='tabler:check'
                height={16}
                width={16}
                className={`mr-2 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
              />
              {opt.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function userToDraft(u: AppUser): DraftUser {
  return {
    fullName: u.fullName,
    email: u.email,
    password: '',
    role: u.role,
    sucursal: u.sucursal,
    avatarUrl: u.avatarUrl,
  }
}

function AddUserDialog({
  open,
  onOpenChange,
  editingUser,
  onCreate,
  onUpdate,
  t,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  editingUser: AppUser | null
  onCreate: (user: DraftUser) => void
  onUpdate: (id: string, user: DraftUser) => void
  t: TFn
}) {
  const baseline = editingUser ? userToDraft(editingUser) : EMPTY_DRAFT
  const [draft, setDraft] = useState<DraftUser>(baseline)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skipNextResetRef = useRef(false)

  useEffect(() => {
    if (!open) return
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false
      return
    }
    setDraft(editingUser ? userToDraft(editingUser) : EMPTY_DRAFT)
  }, [open, editingUser])

  const isValid =
    draft.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) &&
    // On create a password (min 6) is required; on edit it isn't collected here.
    (editingUser !== null || draft.password.length >= 6)

  const isDirty =
    draft.fullName !== baseline.fullName ||
    draft.email !== baseline.email ||
    draft.avatarUrl !== baseline.avatarUrl ||
    draft.role !== baseline.role ||
    draft.sucursal !== baseline.sucursal

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true)
      return
    }
    if (!isDirty) {
      onOpenChange(false)
      return
    }
    onOpenChange(false)
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    Swal.fire({
      title: t(
        editingUser ? 'users.dialog.cancelEditConfirmTitle' : 'users.dialog.cancelConfirmTitle'
      ),
      icon: 'warning',
      iconColor: '#ffae1f',
      iconHtml:
        '<span style="font-size:30px;line-height:1;color:#ffae1f;font-weight:700;">!</span>',
      showCancelButton: true,
      confirmButtonText: t('users.dialog.cancelConfirmYes'),
      cancelButtonText: t('users.dialog.cancelConfirmNo'),
      confirmButtonColor: '#5d87ff',
      cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
      background: isDark ? '#2a3547' : '#ffffff',
      color: isDark ? '#ffffff' : '#2a3547',
      width: '360px',
      padding: '1.5rem 1rem',
      reverseButtons: false,
      customClass: {
        title: '!text-base !font-semibold !pb-0 !mt-3',
        icon: '!w-12 !h-12 !mt-2 !mb-2',
        actions: '!gap-2 !mt-5',
        confirmButton: '!text-sm !px-4 !py-1.5 !rounded-md',
        cancelButton: `!text-sm !px-4 !py-1.5 !rounded-md ${
          isDark ? '!text-white' : '!text-dark'
        }`,
        popup: '!rounded-lg',
      },
    }).then((res) => {
      if (res.isConfirmed) return
      skipNextResetRef.current = true
      onOpenChange(true)
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setDraft((d) => ({ ...d, avatarUrl: result }))
      }
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    const normalized: DraftUser = {
      ...draft,
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
    }
    if (editingUser) {
      onUpdate(editingUser.id, normalized)
    } else {
      onCreate(normalized)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-[560px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='border-b border-border dark:border-darkborder pb-3 mb-2'>
          <DialogTitle className='text-lg text-dark dark:text-white'>
            {t(editingUser ? 'users.dialog.editTitle' : 'users.dialog.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-5 mt-2'>
          <div>
            <Label className='font-medium'>{t('users.dialog.avatarLabel')}</Label>
            <div className='flex items-start gap-4 mt-2'>
              <div className='relative'>
                <Avatar
                  key={draft.avatarUrl ?? 'empty'}
                  className='size-28 !rounded-xl ring-1 ring-border dark:ring-darkborder'>
                  {draft.avatarUrl && (
                    <AvatarImage src={draft.avatarUrl} alt='Avatar' className='object-cover' />
                  )}
                  <AvatarFallback className='!rounded-xl bg-lightprimary text-primary'>
                    <Icon icon='solar:user-bold-duotone' height={56} width={56} />
                  </AvatarFallback>
                </Avatar>
                <button
                  type='button'
                  aria-label={t('users.dialog.avatarEdit')}
                  onClick={() => fileInputRef.current?.click()}
                  className='absolute -top-1 -right-1 h-7 w-7 inline-flex items-center justify-center rounded-full bg-background border border-border dark:border-darkborder shadow-sm text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
                  <Icon icon='solar:pen-line-duotone' height={14} width={14} />
                </button>
                {draft.avatarUrl && (
                  <button
                    type='button'
                    aria-label={t('users.dialog.avatarRemove')}
                    onClick={() => setDraft((d) => ({ ...d, avatarUrl: undefined }))}
                    className='absolute -bottom-1 -right-1 h-7 w-7 inline-flex items-center justify-center rounded-full bg-background border border-border dark:border-darkborder shadow-sm text-link dark:text-darklink hover:text-error hover:border-error transition-colors'>
                    <Icon icon='tabler:x' height={14} width={14} />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.png,.jpg,.jpeg,image/png,image/jpeg'
                  className='hidden'
                  onChange={handleFile}
                />
              </div>
            </div>
            <p className='text-xs text-link dark:text-darklink mt-3'>
              {t('users.dialog.avatarAllowed')}
            </p>
          </div>

          <div>
            <Label htmlFor='draft-name' className='font-medium mb-1.5 block'>
              {t('users.dialog.nameLabel')} <span className='text-error'>*</span>
            </Label>
            <input
              id='draft-name'
              type='text'
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              placeholder={t('users.dialog.namePlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          <div>
            <Label htmlFor='draft-email' className='font-medium mb-1.5 block'>
              {t('users.dialog.emailLabel')} <span className='text-error'>*</span>
            </Label>
            <input
              id='draft-email'
              type='email'
              value={draft.email}
              disabled={editingUser !== null}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder={t('users.dialog.emailPlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
            />
          </div>

          {/* Password — only on create (it's the new user's login credential). */}
          {!editingUser && (
            <div>
              <Label htmlFor='draft-password' className='font-medium mb-1.5 block'>
                {t('users.dialog.passwordLabel')} <span className='text-error'>*</span>
              </Label>
              <input
                id='draft-password'
                type='text'
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder={t('users.dialog.passwordPlaceholder')}
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
              {draft.password.length > 0 && draft.password.length < 6 ? (
                <p className='text-xs text-error mt-1'>{t('users.dialog.passwordTooShort')}</p>
              ) : (
                <p className='text-xs text-link dark:text-darklink mt-1'>{t('users.dialog.passwordHint')}</p>
              )}
            </div>
          )}

          <div>
            <Label className='font-medium mb-2 block'>
              {t('users.dialog.roleLabel')} <span className='text-error'>*</span>
            </Label>
            <RadioGroup
              value={draft.role}
              onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}
              className='space-y-0 rounded-md border border-border dark:border-darkborder overflow-hidden'>
              {ROLE_OPTIONS.map((opt, i) => (
                <div
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 ${
                    i < ROLE_OPTIONS.length - 1
                      ? 'border-b border-border dark:border-darkborder'
                      : ''
                  } ${
                    draft.role === opt.value ? 'bg-lightprimary/30' : 'hover:bg-muted/40'
                  } transition-colors`}>
                  <RadioGroupItem value={opt.value} id={`role-${opt.value}`} className='mt-0.5' />
                  <Label htmlFor={`role-${opt.value}`} className='flex-1 cursor-pointer'>
                    <div className='text-sm font-semibold text-dark dark:text-white'>
                      {t(opt.labelKey)}
                    </div>
                    <div className='text-xs text-link dark:text-darklink font-normal mt-0.5'>
                      {t(opt.descriptionKey)}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className='font-medium mb-1.5 block'>{t('users.dialog.sucursalLabel')}</Label>
            <DialogSucursalSelect
              value={draft.sucursal}
              onChange={(next) => setDraft({ ...draft, sucursal: next })}
              noneLabel={t('users.dialog.sucursalNone')}
            />
          </div>

          <div className='flex items-center justify-end gap-3 pt-2'>
            <button
              type='button'
              onClick={() => handleOpenChange(false)}
              className='px-4 py-2 rounded-md text-sm font-medium text-dark dark:text-white border border-border dark:border-darkborder hover:bg-muted/40 transition-colors'>
              {t('users.dialog.discard')}
            </button>
            <button
              type='submit'
              disabled={!isValid || (editingUser !== null && !isDirty)}
              className='px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
              {t(editingUser ? 'users.dialog.saveChanges' : 'users.dialog.submit')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Pagination ----------

const PAGE_SIZE_OPTIONS = [15, 30, 45, 60] as const
const DEFAULT_PAGE_SIZE = 15 // 5 cards wide × 3 rows

function PageSizeSelect({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border dark:border-darkborder text-sm text-dark dark:text-white hover:border-primary transition-colors'>
          <span>{value}</span>
          <Icon icon='tabler:chevron-down' height={14} width={14} className='text-link dark:text-darklink' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='min-w-[80px]'>
        {PAGE_SIZE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => onChange(opt)}
            className={
              opt === value
                ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                : ''
            }>
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number
  totalPages: number
  onChange: (page: number) => void
}) {
  // Choose which page numbers to render. For up to 7 pages, show all; for
  // more, always show first/last with ellipses around the current window.
  const pageNumbers = useMemo(() => {
    const pages: Array<number | 'ellipsis-left' | 'ellipsis-right'> = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }
    pages.push(1)
    if (currentPage > 3) pages.push('ellipsis-left')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('ellipsis-right')
    pages.push(totalPages)
    return pages
  }, [currentPage, totalPages])

  if (totalPages <= 1) return null

  return (
    <nav className='flex items-center gap-1.5' aria-label='Pagination'>
      <button
        type='button'
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label='Previous'
        className='h-9 w-9 inline-flex items-center justify-center rounded-full border border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary hover:border-primary disabled:opacity-40 disabled:hover:text-link disabled:hover:border-border transition-colors'>
        <Icon icon='tabler:chevron-left' height={16} width={16} />
      </button>
      {pageNumbers.map((p, i) => {
        if (p === 'ellipsis-left' || p === 'ellipsis-right') {
          return (
            <span
              key={`${p}-${i}`}
              className='h-9 w-9 inline-flex items-center justify-center text-link dark:text-darklink'>
              …
            </span>
          )
        }
        const isCurrent = p === currentPage
        return (
          <button
            key={p}
            type='button'
            onClick={() => onChange(p)}
            aria-current={isCurrent ? 'page' : undefined}
            className={`h-9 w-9 inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
              isCurrent
                ? 'bg-primary text-white'
                : 'border border-border dark:border-darkborder text-dark dark:text-white hover:text-primary hover:border-primary'
            }`}>
            {p}
          </button>
        )
      })}
      <button
        type='button'
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label='Next'
        className='h-9 w-9 inline-flex items-center justify-center rounded-full border border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary hover:border-primary disabled:opacity-40 disabled:hover:text-link disabled:hover:border-border transition-colors'>
        <Icon icon='tabler:chevron-right' height={16} width={16} />
      </button>
    </nav>
  )
}

// ---------- Main users grid ----------

type RoleFilter = 'all' | UserRole

export function UsersTable() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name-asc')
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [currentPage, setCurrentPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)

  // Load real app_users from Supabase on mount.
  useEffect(() => {
    let active = true
    void fetchAppUsers().then(({ data, error }) => {
      if (!active) return
      setUsers(data)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    let list = users
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return a.fullName.localeCompare(b.fullName, 'es')
        case 'name-desc':
          return b.fullName.localeCompare(a.fullName, 'es')
        case 'role':
          return a.role.localeCompare(b.role, 'es')
        case 'status':
          return a.status.localeCompare(b.status, 'es')
        case 'recent':
          return b.createdAt.localeCompare(a.createdAt)
      }
    })
    return list
  }, [users, roleFilter, search, sort])

  // Reset to page 1 whenever filters/search/sort change so the visible slice
  // stays in sync with what the user just picked.
  useEffect(() => {
    setCurrentPage(1)
  }, [roleFilter, search, sort])

  // Reset to page 1 whenever the page size changes so we don't strand the
  // viewer on a page that no longer exists.
  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, filtered.length)
  const paged = filtered.slice(startIdx, endIdx)

  function openCreate() {
    setEditingUser(null)
    setCreateOpen(true)
  }
  function openEdit(user: AppUser) {
    setEditingUser(user)
    setCreateOpen(true)
  }
  function toggleActive(user: AppUser) {
    const nextActive = user.status !== 'active'
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, status: nextActive ? 'active' : 'inactive' } : u
      )
    )
    void persistUserActive(user.id, nextActive)
  }
  function changeRole(user: AppUser, role: UserRole) {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)))
    void persistUserRole(user.id, role)
  }

  async function handleDelete(user: AppUser) {
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    const result = await Swal.fire({
      title: t('users.delete.confirmTitle'),
      text: t('users.delete.confirmBody', { name: user.fullName }),
      icon: 'warning',
      iconColor: '#ef4444',
      iconHtml:
        '<span style="font-size:30px;line-height:1;color:#ef4444;font-weight:700;">!</span>',
      showCancelButton: true,
      confirmButtonText: t('users.delete.confirmYes'),
      cancelButtonText: t('users.delete.confirmNo'),
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
    if (result.isConfirmed) {
      const err = await deleteUserApi(user.id)
      if (err) {
        void Swal.fire({
          title: t('users.delete.error'),
          icon: 'error',
          iconColor: '#fa896b',
          confirmButtonColor: '#5d87ff',
          background: isDark ? '#2a3547' : '#ffffff',
          color: isDark ? '#ffffff' : '#2a3547',
          width: '360px',
          customClass: { popup: '!rounded-lg', title: '!text-base' },
        })
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    }
  }

  async function createUser(draft: DraftUser) {
    const { user, error } = await createUserApi({
      email: draft.email.trim(),
      password: draft.password,
      displayName: draft.fullName.trim(),
      role: draft.role,
      sucursal: draft.sucursal,
    })
    if (error || !user) {
      const dark =
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark')
      void Swal.fire({
        title: t('users.dialog.createError'),
        icon: 'error',
        iconColor: '#fa896b',
        confirmButtonColor: '#5d87ff',
        background: dark ? '#2a3547' : '#ffffff',
        color: dark ? '#ffffff' : '#2a3547',
        width: '360px',
        customClass: { popup: '!rounded-lg', title: '!text-base' },
      })
      return
    }
    setUsers((prev) => [user, ...prev])
    setRoleFilter('all')
  }
  function updateUser(id: string, draft: DraftUser) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, fullName: draft.fullName, role: draft.role, sucursal: draft.sucursal, avatarUrl: draft.avatarUrl }
          : u
      )
    )
    // Persist the DB-backed fields (name + role). Email is the auth login and
    // isn't editable here; sucursal/avatar have no app_users columns.
    void persistUserName(id, draft.fullName.trim())
    void persistUserRole(id, draft.role)
    setEditingUser(null)
  }

  const filterPills: { value: RoleFilter; labelKey: TranslationKey }[] = [
    { value: 'all', labelKey: 'users.filter.all' },
    { value: 'admin', labelKey: 'users.filter.admin' },
    { value: 'operador', labelKey: 'users.filter.operador' },
    { value: 'profesional', labelKey: 'users.filter.profesional' },
  ]

  return (
    <div className='space-y-6'>
      {/* KPI row */}
      <KpiRow users={users} t={t} />

      {/* Filter pills + search + sort + create */}
      <div className='rounded-lg border border-border dark:border-darkborder bg-card p-4'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
            <div className='inline-flex p-1 rounded-md bg-muted/50 dark:bg-darkmuted/40'>
              {filterPills.map((pill) => {
                const active = pill.value === roleFilter
                return (
                  <button
                    key={pill.value}
                    type='button'
                    onClick={() => setRoleFilter(pill.value)}
                    className={`px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-primary text-white'
                        : 'text-link dark:text-darklink hover:text-primary'
                    }`}>
                    {t(pill.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className='flex items-center gap-3 flex-wrap'>
            <div className='relative flex-1 sm:flex-none sm:w-[240px]'>
              <Icon
                icon='solar:magnifer-linear'
                height={16}
                width={16}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink pointer-events-none'
              />
              <input
                type='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('users.search.placeholder')}
                className='w-full pl-9 pr-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
            </div>
            <SortSelect value={sort} onChange={setSort} t={t} />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={openCreate}
                  className='inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
                  <Icon icon='tabler:plus' height={16} width={16} />
                  {t('users.create')}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('users.create')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* User grid */}
      {loading ? (
        <div className='rounded-lg border border-border dark:border-darkborder bg-card py-16 flex flex-col items-center justify-center text-center gap-3'>
          <Icon icon='tabler:loader-2' height={32} width={32} className='text-primary animate-spin' />
          <p className='text-sm text-link dark:text-darklink'>{t('users.loading')}</p>
        </div>
      ) : loadError ? (
        <div className='rounded-lg border border-border dark:border-darkborder bg-card py-16 flex flex-col items-center justify-center text-center gap-3'>
          <div className='size-16 rounded-full bg-lighterror/60 flex items-center justify-center'>
            <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('users.error.title')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[340px]'>{t('users.error.body')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className='rounded-lg border border-border dark:border-darkborder bg-card py-16 flex flex-col items-center justify-center text-center gap-3'>
          <div className='size-16 rounded-full bg-muted/60 dark:bg-darkmuted/40 flex items-center justify-center'>
            <Icon icon='solar:magnifer-line-duotone' height={28} width={28} className='text-link dark:text-darklink' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>
            {users.length === 0 ? t('users.empty.title') : t('users.noResults.title')}
          </p>
          <p className='text-sm text-link dark:text-darklink max-w-[340px]'>
            {users.length === 0 ? t('users.empty.body') : t('users.noResults.body')}
          </p>
          {(search || roleFilter !== 'all') && users.length > 0 && (
            <button
              type='button'
              onClick={() => {
                setSearch('')
                setRoleFilter('all')
              }}
              className='mt-1 px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 dark:hover:bg-darkmuted/40 transition-colors'>
              {t('users.noResults.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4'>
            {paged.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                t={t}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleActive={toggleActive}
                onChangeRole={changeRole}
              />
            ))}
          </div>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <span className='text-sm text-link dark:text-darklink'>
                {t('users.pagination.show')} {t('users.pagination.perPage')}
              </span>
              <PageSizeSelect value={pageSize} onChange={setPageSize} />
            </div>
            <div className='flex items-center gap-4'>
              <p className='text-sm text-link dark:text-darklink'>
                {t('users.pagination.range', {
                  start: String(filtered.length === 0 ? 0 : startIdx + 1),
                  end: String(endIdx),
                  total: String(filtered.length),
                })}
              </p>
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                onChange={setCurrentPage}
              />
            </div>
          </div>
        </>
      )}

      <AddUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editingUser={editingUser}
        onCreate={createUser}
        onUpdate={updateUser}
        t={t}
      />
    </div>
  )
}