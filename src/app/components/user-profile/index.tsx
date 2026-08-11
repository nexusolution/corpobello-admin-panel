'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react/dist/iconify.js'

import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  useCurrentUser,
  updateCurrentAvatar,
  type UserRole,
} from '@/lib/auth/useCurrentUser'
import { fileToAvatarDataUrl, setOwnAvatar } from '@/lib/auth/avatar'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'

// My Profile: the real signed-in user (Auth + app_users). Name/role/contact are
// admin-managed (Usuarios); the user can set their OWN avatar here + language.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

const ROLE_LABEL_KEY: Record<UserRole, TranslationKey> = {
  admin: 'users.role.admin',
  operador: 'users.role.operador',
  profesional: 'users.role.profesional',
}

const SUCURSAL_LABELS: Record<string, string> = {
  caballito: 'Caballito',
  merlo: 'Merlo',
  moreno: 'Moreno',
}

type Extra = { phone: string; location: string; sucursal: string | null; createdAt: string }

// A read-only field styled like the sample (label + bordered box + leading icon).
function ReadField({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <div>
      <label className='text-xs font-medium text-dark dark:text-white'>{label}</label>
      <div className='mt-1 flex items-center gap-2 rounded-md border border-border dark:border-darkborder bg-background px-3 py-2.5'>
        <Icon icon={icon} height={16} width={16} className='text-link dark:text-darklink shrink-0' />
        <span className='text-sm text-dark dark:text-white truncate'>{value}</span>
      </div>
    </div>
  )
}

const UserProfile = () => {
  const { t, locale, setLocale } = useTranslation()
  const { name, email, role, avatar, loading } = useCurrentUser()
  const [uploading, setUploading] = useState(false)
  const [extra, setExtra] = useState<Extra | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!email) return
    let active = true
    void fetchAppUsers().then(({ data }) => {
      if (!active) return
      const me = data.find((u) => u.email === email)
      if (me) {
        setExtra({
          phone: me.phone ?? '',
          location: me.location ?? '',
          sucursal: me.sucursal,
          createdAt: me.createdAt,
        })
      }
    })
    return () => {
      active = false
    }
  }, [email])

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      const err = await setOwnAvatar(dataUrl)
      if (!err) updateCurrentAvatar(dataUrl)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const displayName = name || email.split('@')[0] || t('profile.heading')
  const roleLabel = t(ROLE_LABEL_KEY[role])
  const joined = extra?.createdAt
    ? new Date(extra.createdAt).toLocaleDateString(locale === 'es' ? 'es-AR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''
  const sucursalLabel = extra?.sucursal
    ? SUCURSAL_LABELS[extra.sucursal] ?? extra.sucursal
    : t('users.sucursal.none')

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4 flex-wrap'>
        <div>
          <h1 className='text-xl sm:text-2xl font-semibold text-dark dark:text-white'>{t('profile.heading')}</h1>
          <p className='text-sm text-link dark:text-darklink mt-0.5'>{t('profile.subtitle')}</p>
        </div>
        <button
          type='button'
          onClick={() => fileRef.current?.click()}
          disabled={uploading || loading}
          className='inline-flex items-center gap-2 px-4 py-2 rounded-md bg-dark dark:bg-white text-white dark:text-dark text-sm font-medium hover:opacity-90 disabled:opacity-60 transition'>
          <Icon icon={uploading ? 'tabler:loader-2' : 'solar:pen-2-line-duotone'} height={16} width={16} className={uploading ? 'animate-spin' : ''} />
          {t('profile.edit')}
        </button>
        <input
          ref={fileRef}
          type='file'
          accept='image/png,image/jpeg,image/webp'
          className='hidden'
          onChange={handleAvatarFile}
        />
      </div>

      {loading ? (
        <div className='rounded-xl border border-border dark:border-darkborder p-10 flex items-center justify-center'>
          <Icon icon='tabler:loader-2' height={32} width={32} className='text-primary animate-spin' />
        </div>
      ) : (
        <div className='rounded-xl border border-border dark:border-darkborder bg-card overflow-hidden'>
          {/* Gradient banner */}
          <div className='relative bg-gradient-to-r from-violet-200 via-pink-200 to-blue-200 dark:from-violet-500/20 dark:via-pink-500/20 dark:to-blue-500/20 px-6 py-6'>
            <div className='flex items-center gap-5 flex-wrap'>
              <div className='relative shrink-0'>
                <div className='h-20 w-20 rounded-full overflow-hidden bg-white/70 text-primary flex items-center justify-center text-2xl font-bold ring-4 ring-white/60'>
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt={displayName} className='h-full w-full object-cover' />
                  ) : (
                    initials(displayName)
                  )}
                </div>
                <button
                  type='button'
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t('profile.avatar.change')}
                  className='absolute -bottom-1 -right-1 h-8 w-8 inline-flex items-center justify-center rounded-full bg-primary text-white ring-2 ring-white hover:bg-primaryemphasis disabled:opacity-60 transition-colors'>
                  <Icon icon={uploading ? 'tabler:loader-2' : 'solar:camera-line-duotone'} height={15} width={15} className={uploading ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className='min-w-0'>
                <h2 className='text-xl font-bold text-dark'>{displayName}</h2>
                <p className='text-sm font-medium text-dark/70'>{roleLabel}</p>
                <div className='flex items-center gap-4 flex-wrap mt-1 text-xs text-dark/70'>
                  {email && (
                    <span className='inline-flex items-center gap-1.5'>
                      <Icon icon='solar:letter-line-duotone' height={14} width={14} />
                      {email}
                    </span>
                  )}
                  {joined && (
                    <span className='inline-flex items-center gap-1.5'>
                      <Icon icon='solar:calendar-line-duotone' height={14} width={14} />
                      {t('profile.joined', { date: joined })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className='p-6 border-b border-border dark:border-darkborder'>
            <h3 className='text-base font-semibold text-dark dark:text-white mb-4'>{t('profile.personalInfo')}</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4'>
              <ReadField label={t('profile.field.name')} value={displayName} icon='solar:user-line-duotone' />
              <ReadField label={t('profile.field.email')} value={email} icon='solar:letter-line-duotone' />
              <ReadField label={t('profile.field.phone')} value={extra?.phone || ''} icon='solar:phone-line-duotone' />
              <ReadField label={t('profile.field.location')} value={extra?.location || ''} icon='solar:map-point-line-duotone' />
              <ReadField label={t('profile.field.sucursal')} value={sucursalLabel} icon='solar:buildings-2-line-duotone' />
              <ReadField label={t('profile.field.role')} value={roleLabel} icon='solar:shield-user-line-duotone' />
            </div>
          </div>

          {/* Preferences */}
          <div className='p-6'>
            <h3 className='text-base font-semibold text-dark dark:text-white mb-4'>{t('profile.preferences')}</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4'>
              <ReadField label={t('profile.field.timezone')} value='America/Argentina/Buenos Aires' icon='solar:clock-circle-line-duotone' />
              <div>
                <label className='text-xs font-medium text-dark dark:text-white'>{t('profile.field.language')}</label>
                <div className='mt-1 flex items-center gap-2 rounded-md border border-border dark:border-darkborder bg-background px-3 py-2'>
                  <Icon icon='solar:global-line-duotone' height={16} width={16} className='text-link dark:text-darklink shrink-0' />
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as 'es' | 'en')}
                    className='flex-1 bg-transparent text-sm text-dark dark:text-white focus:outline-none'>
                    <option value='es'>{t('profile.lang.es')}</option>
                    <option value='en'>{t('profile.lang.en')}</option>
                  </select>
                </div>
              </div>
            </div>
            <p className='text-xs text-link dark:text-darklink mt-6 flex items-start gap-1.5'>
              <Icon icon='solar:info-circle-line-duotone' height={15} width={15} className='mt-0.5 shrink-0' />
              {t('profile.note')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfile
