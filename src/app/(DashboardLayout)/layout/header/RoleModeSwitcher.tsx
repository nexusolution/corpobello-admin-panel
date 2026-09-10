'use client'

import { Icon } from '@iconify/react'

import {
  useCurrentUser,
  setActiveRole,
  type UserRole,
} from '@/lib/auth/useCurrentUser'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

// Mode switch for a user who holds more than one role (Andrés 2026-09-07: the
// same person is Operador in the morning and Profesional in the afternoon and
// shouldn't have to log out to change function). Only renders when the user has
// 2+ roles; picking one calls setActiveRole, which reprioritises the whole panel
// (nav, agenda lock, gates) since everything reads the active role.
const ROLE_ICON: Record<UserRole, string> = {
  admin: 'tabler:shield-check',
  operador: 'tabler:headset',
  profesional: 'tabler:stethoscope',
}
const ROLE_LABEL_KEY: Record<UserRole, TranslationKey> = {
  admin: 'users.role.admin',
  operador: 'users.role.operador',
  profesional: 'users.role.profesional',
}

export default function RoleModeSwitcher() {
  const { roles, role, loading } = useCurrentUser()
  const { t } = useTranslation()

  if (loading || roles.length < 2) return null

  return (
    <div
      role='group'
      aria-label={t('roleMode.label')}
      className='flex items-center gap-0.5 rounded-full border border-border dark:border-darkborder p-0.5'>
      {roles.map((r) => {
        const active = r === role
        return (
          <button
            key={r}
            type='button'
            onClick={() => setActiveRole(r)}
            aria-pressed={active}
            title={t('roleMode.switchTo', { role: t(ROLE_LABEL_KEY[r]) })}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              active
                ? 'bg-primary text-white'
                : 'text-link dark:text-darklink hover:text-primary'
            }`}>
            <Icon icon={ROLE_ICON[r]} height={15} width={15} />
            <span className='hidden sm:inline'>{t(ROLE_LABEL_KEY[r])}</span>
          </button>
        )
      })}
    </div>
  )
}
