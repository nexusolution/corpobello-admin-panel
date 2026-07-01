'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n/context'
import type { Locale, TranslationKey } from '@/lib/i18n/dictionaries'

type LanguageOption = {
  code: Locale
  flag: string
  label: string
  region: string
}

const LOGIN_LANGUAGES: LanguageOption[] = [
  { code: 'es', flag: 'circle-flags:ar', label: 'Español', region: 'AR' },
  { code: 'en', flag: 'circle-flags:gb', label: 'English', region: 'UK' },
]

type FieldErrors = {
  email?: TranslationKey
  password?: TranslationKey
}

const showValidationAlert = (
  t: (key: TranslationKey) => string
) => {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  Swal.fire({
    title: t('auth.login.errorTitle'),
    text: t('auth.login.errorBody'),
    // Custom red X — swal2's built-in error icon clips when shrunk
    // (its X strokes use fixed-offset positioning), so render our own.
    iconHtml:
      '<span style="font-size:26px;line-height:1;color:#ef4444;font-weight:700;">&times;</span>',
    confirmButtonText: t('auth.login.errorConfirm'),
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-1 !border-2 !border-error',
      confirmButton: '!text-sm !px-4 !py-1.5',
      popup: '!rounded-lg',
    },
  })
}

export const Login = () => {
  const router = useRouter()
  const { locale, setLocale, t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const currentLanguage =
    LOGIN_LANGUAGES.find((l) => l.code === locale) ?? LOGIN_LANGUAGES[0]

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!email.trim()) {
      next.email = 'auth.login.errorEmailRequired'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'auth.login.errorEmailInvalid'
    }
    if (!password) {
      next.password = 'auth.login.errorPasswordRequired'
    }
    return next
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) {
      showValidationAlert(t)
      return
    }
    // Visual-only flow: set mock auth flag + navigate to dashboard. Real
    // Supabase signIn comes later.
    if (typeof window !== 'undefined') {
      localStorage.setItem('panel-auth', 'true')
    }
    router.push('/')
  }

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className='min-h-screen w-full flex flex-col lg:grid lg:grid-cols-2'>
      {/* Form column — bottom on mobile, left on desktop */}
      <div className='order-2 lg:order-1 flex flex-col justify-center bg-background px-6 py-12 lg:py-16 lg:min-h-screen'>
        {/* Form */}
        <div className='w-full max-w-md mx-auto'>
          <div className='text-center mb-12'>
            <h1 className='text-2xl font-semibold text-dark dark:text-white mb-2'>
              {t('auth.login.title')}
            </h1>
            <p className='text-sm text-link dark:text-darklink'>
              {t('auth.login.subtitle')}
            </p>
          </div>

          {/* Social sign-in */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10'>
            <button
              type='button'
              className='flex items-center justify-center gap-2 px-4 py-2.5 border border-border dark:border-darkborder rounded-md text-sm font-medium text-dark dark:text-white hover:bg-lightprimary transition-colors'>
              <Icon icon='flat-color-icons:google' height={20} width={20} />
              <span>Google</span>
            </button>
            <button
              type='button'
              className='flex items-center justify-center gap-2 px-4 py-2.5 border border-border dark:border-darkborder rounded-md text-sm font-medium text-dark dark:text-white hover:bg-lightprimary transition-colors'>
              <Icon icon='ri:apple-fill' height={20} width={20} />
              <span>Apple</span>
            </button>
          </div>

          {/* Divider */}
          <div className='flex items-center gap-3 mb-10'>
            <div className='flex-1 h-px bg-border dark:bg-darkborder' />
            <span className='text-xs text-link dark:text-darklink whitespace-nowrap'>
              {t('auth.login.emailDivider')}
            </span>
            <div className='flex-1 h-px bg-border dark:bg-darkborder' />
          </div>

          <form className='space-y-7' onSubmit={handleSubmit} noValidate>
            <div>
              <Label htmlFor='email' className='font-medium mb-2 block'>
                {t('auth.login.emailLabel')}
              </Label>
              <Input
                id='email'
                type='email'
                placeholder={t('auth.login.emailPlaceholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearError('email')
                }}
                aria-invalid={!!errors.email}
                className={
                  errors.email
                    ? 'border-error focus-visible:border-error'
                    : undefined
                }
              />
              {errors.email && (
                <p className='text-xs text-error font-medium mt-1.5'>
                  {t(errors.email)}
                </p>
              )}
            </div>

            <div>
              <div className='flex items-center justify-between mb-2'>
                <Label htmlFor='password' className='font-medium'>
                  {t('auth.login.passwordLabel')}
                </Label>
                <Link
                  href='#'
                  className='text-xs font-medium text-primary hover:text-primaryemphasis'>
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <div className='relative'>
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='••••••••'
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearError('password')
                  }}
                  aria-invalid={!!errors.password}
                  className={
                    errors.password
                      ? 'pr-10 border-error focus-visible:border-error'
                      : 'pr-10'
                  }
                />
                <button
                  type='button'
                  aria-label={
                    showPassword
                      ? t('auth.login.hidePassword')
                      : t('auth.login.showPassword')
                  }
                  onClick={() => setShowPassword((s) => !s)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink hover:text-primary'>
                  <Icon
                    icon={showPassword ? 'solar:eye-closed-line-duotone' : 'solar:eye-line-duotone'}
                    height={20}
                    width={20}
                  />
                </button>
              </div>
              {errors.password && (
                <p className='text-xs text-error font-medium mt-1.5'>
                  {t(errors.password)}
                </p>
              )}
            </div>

            <Button type='submit' className='w-full mt-6'>
              {t('auth.login.submit')}
            </Button>
          </form>

          <p className='text-center text-sm text-link dark:text-darklink mt-12'>
            {t('auth.login.noAccount')}{' '}
            <Link
              href='#'
              className='font-medium text-primary hover:text-primaryemphasis'>
              {t('auth.login.contactAdmin')}
            </Link>
          </p>
        </div>

        {/* Footer — pushed lower so it sits closer to the column bottom */}
        <div className='w-full max-w-md mx-auto mt-16 lg:mt-32 px-4 flex items-center justify-between text-sm'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                className='flex items-center gap-2 text-link dark:text-darklink hover:text-primary transition-colors'>
                <Icon icon={currentLanguage.flag} height={20} width={20} />
                <span className='font-medium'>{currentLanguage.label}</span>
                <Icon icon='tabler:chevron-down' height={14} width={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-[180px] py-2 rounded-sm'>
              {LOGIN_LANGUAGES.map((lang) => {
                const isSelected = lang.code === locale
                return (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLocale(lang.code)}
                    className={`px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-lightprimary hover:text-primary ${
                      isSelected ? 'bg-lightprimary text-primary' : ''
                    }`}>
                    <Icon icon={lang.flag} height={20} width={20} />
                    <span className='text-sm'>
                      {lang.label}{' '}
                      <span className='text-xs text-darklink'>({lang.region})</span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className='flex items-center gap-5'>
            <Link
              href='#'
              className='text-primary hover:text-primaryemphasis font-medium'>
              {t('auth.login.footerTerms')}
            </Link>
            <Link
              href='#'
              className='text-primary hover:text-primaryemphasis font-medium'>
              {t('auth.login.footerPrivacy')}
            </Link>
            <Link
              href='#'
              className='text-primary hover:text-primaryemphasis font-medium'>
              {t('auth.login.footerSupport')}
            </Link>
          </div>
        </div>
      </div>

      {/* Brand column — top on mobile, right on desktop */}
      <div
        className='order-1 lg:order-2 flex flex-col items-center justify-center relative overflow-hidden px-6 lg:px-12 py-4 lg:py-12 bg-cover bg-center lg:min-h-screen'
        style={{ backgroundImage: "url('/images/backgrounds/auth-bg.png')" }}>
        {/* Subtle dark overlay for text legibility regardless of image tone */}
        <div className='absolute inset-0 bg-black/20' />

        {/* Brand mark — Corpo Bello logo (smaller on mobile) */}
        <div className='flex flex-col items-center lg:mb-8 z-10'>
          <img
            src='/images/logos/auth-logo.webp'
            alt='Corpo Bello'
            className='h-40 lg:h-80 w-auto drop-shadow-lg'
          />
        </div>

        {/* Tagline — hidden on mobile/tablet, shown on desktop */}
        <div className='hidden lg:block text-center max-w-md z-10'>
          <h3 className='text-2xl font-bold text-white mb-3 drop-shadow-md'>
            {t('auth.login.brandTagline')}
          </h3>
          <p className='text-white/90 text-sm leading-relaxed drop-shadow'>
            {t('auth.login.brandCopy')}
          </p>
        </div>
      </div>
    </div>
  )
}