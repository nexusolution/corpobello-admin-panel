'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

type FieldErrors = {
  email?: string
  password?: string
  repeatPassword?: string
  terms?: string
}

/**
 * Returns a strength score (0..4) and a matching color/label for the bars.
 * 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong.
 */
function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4
  color: string
} {
  if (!password) return { score: 0, color: 'bg-border dark:bg-darkborder' }

  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const color =
    score <= 1
      ? 'bg-error'
      : score === 2
      ? 'bg-warning'
      : score === 3
      ? 'bg-secondary'
      : 'bg-success'

  return { score: score as 0 | 1 | 2 | 3 | 4, color }
}

const showValidationAlert = () => {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  Swal.fire({
    title: 'Ups, hay errores',
    text: 'Revisá los campos marcados y volvé a intentarlo.',
    // Custom red X — swal2's built-in error icon clips when shrunk
    // (its X strokes use fixed-offset positioning), so render our own.
    iconHtml:
      '<span style="font-size:26px;line-height:1;color:#ef4444;font-weight:700;">&times;</span>',
    confirmButtonText: 'Entendido',
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

export const Register = () => {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  const strength = useMemo(() => passwordStrength(password), [password])

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!email.trim()) {
      next.email = 'El email es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Ingresá un email válido'
    }
    if (!password) {
      next.password = 'La contraseña es requerida'
    } else if (password.length < 8) {
      next.password = 'Usá al menos 8 caracteres'
    }
    if (!repeatPassword) {
      next.repeatPassword = 'Repetí la contraseña'
    } else if (password && password !== repeatPassword) {
      next.repeatPassword = 'Las contraseñas no coinciden'
    }
    if (!termsAccepted) {
      next.terms = 'Tenés que aceptar los términos'
    }
    return next
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) {
      showValidationAlert()
      return
    }
    // Visual-only flow: navigate to dashboard. Real Supabase signUp comes later.
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
              Crear cuenta
            </h1>
            <p className='text-sm text-link dark:text-darklink'>
              Panel de gestión Corpo Bello
            </p>
          </div>

          {/* Social sign-up */}
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
              o con email
            </span>
            <div className='flex-1 h-px bg-border dark:bg-darkborder' />
          </div>

          <form className='space-y-6' onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div>
              <Label htmlFor='email' className='font-medium mb-2 block'>
                Email
              </Label>
              <Input
                id='email'
                type='email'
                placeholder='tuemail@ejemplo.com'
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearError('email')
                }}
                aria-invalid={!!errors.email}
                className={
                  errors.email
                    ? 'border-error focus-visible:ring-error'
                    : undefined
                }
              />
              {errors.email && (
                <p className='text-xs text-error font-medium mt-1.5'>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password + strength */}
            <div>
              <Label htmlFor='password' className='font-medium mb-2 block'>
                Contraseña
              </Label>
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
                      ? 'pr-10 border-error focus-visible:ring-error'
                      : 'pr-10'
                  }
                />
                <button
                  type='button'
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword((s) => !s)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink hover:text-primary'>
                  <Icon
                    icon={showPassword ? 'solar:eye-closed-line-duotone' : 'solar:eye-line-duotone'}
                    height={20}
                    width={20}
                  />
                </button>
              </div>
              {/* Strength bars */}
              <div className='mt-2 grid grid-cols-4 gap-1.5'>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-colors ${
                      i <= strength.score
                        ? strength.color
                        : 'bg-border dark:bg-darkborder'
                    }`}
                  />
                ))}
              </div>
              {errors.password ? (
                <p className='text-xs text-error font-medium mt-1.5'>
                  {errors.password}
                </p>
              ) : (
                <p className='text-xs text-link dark:text-darklink mt-1.5'>
                  Usá 8 o más caracteres con letras, números y símbolos.
                </p>
              )}
            </div>

            {/* Repeat password */}
            <div>
              <Label htmlFor='repeatPassword' className='font-medium mb-2 block'>
                Repetir contraseña
              </Label>
              <Input
                id='repeatPassword'
                type={showPassword ? 'text' : 'password'}
                placeholder='••••••••'
                value={repeatPassword}
                onChange={(e) => {
                  setRepeatPassword(e.target.value)
                  clearError('repeatPassword')
                }}
                aria-invalid={!!errors.repeatPassword}
                className={
                  errors.repeatPassword
                    ? 'border-error focus-visible:ring-error'
                    : undefined
                }
              />
              {errors.repeatPassword && (
                <p className='text-xs text-error font-medium mt-1.5'>
                  {errors.repeatPassword}
                </p>
              )}
            </div>

            {/* Terms */}
            <div>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='terms'
                  checked={termsAccepted}
                  onCheckedChange={(checked) => {
                    setTermsAccepted(checked === true)
                    clearError('terms')
                  }}
                />
                <Label
                  htmlFor='terms'
                  className='text-sm font-normal text-link dark:text-darklink cursor-pointer'>
                  Acepto los{' '}
                  <Link
                    href='#'
                    className='font-medium text-primary hover:text-primaryemphasis'>
                    Términos
                  </Link>
                </Label>
              </div>
              {errors.terms && (
                <p className='text-xs text-error font-medium mt-1.5'>
                  {errors.terms}
                </p>
              )}
            </div>

            <Button type='submit' className='w-full mt-2'>
              Crear cuenta
            </Button>
          </form>

          <p className='text-center text-sm text-link dark:text-darklink mt-10'>
            ¿Ya tenés cuenta?{' '}
            <Link
              href='/auth/login'
              className='font-medium text-primary hover:text-primaryemphasis'>
              Iniciar sesión
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className='w-full max-w-md mx-auto mt-16 lg:mt-32 px-4 flex items-center justify-between text-sm'>
          <button
            type='button'
            className='flex items-center gap-2 text-link dark:text-darklink hover:text-primary transition-colors'>
            <Icon icon='circle-flags:ar' height={20} width={20} />
            <span className='font-medium'>Español</span>
            <Icon icon='tabler:chevron-down' height={14} width={14} />
          </button>
          <div className='flex items-center gap-5'>
            <Link
              href='#'
              className='text-primary hover:text-primaryemphasis font-medium'>
              Términos
            </Link>
            <Link
              href='#'
              className='text-primary hover:text-primaryemphasis font-medium'>
              Privacidad
            </Link>
            <Link
              href='#'
              className='text-primary hover:text-primaryemphasis font-medium'>
              Soporte
            </Link>
          </div>
        </div>
      </div>

      {/* Brand column — top on mobile, right on desktop */}
      <div
        className='order-1 lg:order-2 flex flex-col items-center justify-center relative overflow-hidden px-6 lg:px-12 py-8 lg:py-12 bg-cover bg-center min-h-[200px] lg:min-h-screen'
        style={{ backgroundImage: "url('/images/backgrounds/auth-bg.png')" }}>
        {/* Subtle dark overlay for text legibility regardless of image tone */}
        <div className='absolute inset-0 bg-black/20' />

        {/* Brand mark — Corpo Bello logo (smaller on mobile) */}
        <div className='flex flex-col items-center lg:mb-8 z-10'>
          <img
            src='/images/logos/logo5.png'
            alt='Corpo Bello'
            className='h-20 lg:h-40 w-auto drop-shadow-lg'
          />
        </div>

        {/* Tagline — hidden on mobile/tablet, shown on desktop */}
        <div className='hidden lg:block text-center max-w-md z-10'>
          <h3 className='text-2xl font-bold text-white mb-3 drop-shadow-md'>
            Gestión clínica simple y eficaz
          </h3>
          <p className='text-white/90 text-sm leading-relaxed drop-shadow'>
            Todas las herramientas que necesitás para operar el consultorio en
            un solo panel: pacientes, agenda, fichas y configuración del bot.
          </p>
        </div>
      </div>
    </div>
  )
}