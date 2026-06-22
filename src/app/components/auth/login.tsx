'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type FieldErrors = {
  email?: string
  password?: string
}

const showValidationAlert = () => {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  Swal.fire({
    title: 'Ups, hay errores',
    text: 'Revisá los campos marcados y volvé a intentarlo.',
    icon: 'error',
    iconColor: '#ef4444',
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '400px',
    padding: '1.25rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0 !mt-3',
      htmlContainer: '!text-sm !mt-2',
      confirmButton: '!text-sm !px-5 !py-2 !rounded-md',
      popup: '!rounded-lg',
    },
  })
}

export const Login = () => {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!email.trim()) {
      next.email = 'El email es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Ingresá un email válido'
    }
    if (!password) {
      next.password = 'La contraseña es requerida'
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
    // Visual-only flow: navigate to dashboard. Real Supabase signIn comes later.
    router.push('/')
  }

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className='grid lg:grid-cols-2 min-h-screen w-full'>
      {/* LEFT — Form column */}
      <div className='flex flex-col justify-center min-h-screen bg-background px-6 py-16'>
        {/* Form */}
        <div className='w-full max-w-md mx-auto'>
          <div className='text-center mb-12'>
            <h1 className='text-2xl font-semibold text-dark dark:text-white mb-2'>
              Iniciar sesión
            </h1>
            <p className='text-sm text-link dark:text-darklink'>
              Panel de gestión Corpo Bello
            </p>
          </div>

          {/* Social sign-in */}
          <div className='grid grid-cols-2 gap-3 mb-10'>
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

          <form className='space-y-7' onSubmit={handleSubmit} noValidate>
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

            <div>
              <div className='flex items-center justify-between mb-2'>
                <Label htmlFor='password' className='font-medium'>
                  Contraseña
                </Label>
                <Link
                  href='#'
                  className='text-xs font-medium text-primary hover:text-primaryemphasis'>
                  ¿Olvidaste tu contraseña?
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
              {errors.password && (
                <p className='text-xs text-error font-medium mt-1.5'>
                  {errors.password}
                </p>
              )}
            </div>

            <Button type='submit' className='w-full mt-6'>
              Iniciar sesión
            </Button>
          </form>

          <p className='text-center text-sm text-link dark:text-darklink mt-12'>
            ¿No tenés cuenta?{' '}
            <Link
              href='#'
              className='font-medium text-primary hover:text-primaryemphasis'>
              Contactá al administrador
            </Link>
          </p>
        </div>

        {/* Footer — pushed lower so it sits closer to the column bottom */}
        <div className='w-full max-w-md mx-auto mt-32 px-4 flex items-center justify-between text-sm'>
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

      {/* RIGHT — Brand column (hidden on mobile) */}
      <div className='hidden lg:flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary to-secondary px-12 py-12'>
        {/* Decorative background blobs */}
        <div className='absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl' />
        <div className='absolute -bottom-32 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl' />

        {/* Brand mark */}
        <div className='flex flex-col items-center mb-10 z-10'>
          <div className='bg-white/15 backdrop-blur-sm rounded-2xl p-4 mb-4'>
            <Icon icon='solar:heart-pulse-bold' className='text-white' height={44} width={44} />
          </div>
          <h2 className='text-3xl font-bold text-white tracking-tight'>
            Corpo Bello
          </h2>
        </div>

        {/* Decorative stat-card cluster */}
        <div className='relative w-full max-w-sm h-60 mb-10 z-10'>
          <div className='absolute top-0 left-0 bg-white rounded-xl shadow-2xl p-4 w-44 rotate-[-3deg]'>
            <p className='text-xs text-link mb-1'>Pacientes activos</p>
            <p className='text-2xl font-bold text-dark'>248</p>
            <p className='text-xs text-success font-medium'>+12% este mes</p>
          </div>
          <div className='absolute top-8 right-0 bg-white rounded-xl shadow-2xl p-4 w-44 rotate-[3deg]'>
            <p className='text-xs text-link mb-1'>Turnos hoy</p>
            <p className='text-2xl font-bold text-dark'>14</p>
            <p className='text-xs text-link'>3 pendientes</p>
          </div>
          <div className='absolute top-32 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl p-4 w-44'>
            <p className='text-xs text-link mb-1'>Conversaciones</p>
            <p className='text-2xl font-bold text-dark'>7</p>
            <p className='text-xs text-warning font-medium'>en curso</p>
          </div>
        </div>

        {/* Tagline */}
        <div className='text-center max-w-md z-10'>
          <h3 className='text-2xl font-bold text-white mb-3'>
            Gestión clínica simple y eficaz
          </h3>
          <p className='text-white/85 text-sm leading-relaxed'>
            Todas las herramientas que necesitás para operar el consultorio en
            un solo panel: pacientes, agenda, fichas y configuración del bot.
          </p>
        </div>
      </div>
    </div>
  )
}