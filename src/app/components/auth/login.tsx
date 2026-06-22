'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@iconify/react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Login = () => {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className='grid lg:grid-cols-2 min-h-screen w-full'>
      {/* LEFT — Form column */}
      <div className='flex flex-col bg-background'>
        <div className='flex-1 flex items-center justify-center px-6 py-12'>
          <div className='w-full max-w-md'>
          <div className='text-center mb-10'>
            <h1 className='text-2xl font-semibold text-dark dark:text-white mb-2'>
              Iniciar sesión
            </h1>
            <p className='text-sm text-link dark:text-darklink'>
              Panel de gestión Corpo Bello
            </p>
          </div>

          {/* Social sign-in */}
          <div className='grid grid-cols-2 gap-3 mb-8'>
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
          <div className='flex items-center gap-3 mb-8'>
            <div className='flex-1 h-px bg-border dark:bg-darkborder' />
            <span className='text-xs text-link dark:text-darklink whitespace-nowrap'>
              o con email
            </span>
            <div className='flex-1 h-px bg-border dark:bg-darkborder' />
          </div>

          <form className='space-y-6'>
            <div>
              <Label htmlFor='email' className='font-medium mb-2 block'>
                Email
              </Label>
              <Input
                id='email'
                type='email'
                placeholder='tuemail@ejemplo.com'
                required
              />
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
                  className='pr-10'
                  required
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
            </div>

            <Button type='submit' className='w-full mt-4' asChild>
              <Link href='/'>Iniciar sesión</Link>
            </Button>
          </form>

          <p className='text-center text-sm text-link dark:text-darklink mt-10'>
            ¿No tenés cuenta?{' '}
            <Link
              href='#'
              className='font-medium text-primary hover:text-primaryemphasis'>
              Contactá al administrador
            </Link>
          </p>
          </div>
        </div>

        {/* Footer — language switcher + links */}
        <div className='flex items-center justify-between px-6 py-6 text-sm'>
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