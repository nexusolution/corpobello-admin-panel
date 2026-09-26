'use client'

// A persistent "Volver a la agenda" arrow shown at the top of the Autogestión
// screens the turno dialog deep-links into (Disponibilidad, Profesionales) when a
// turno is stashed. Clicking it returns to /agenda, where the restore effect
// reopens the turno with its data intact (Andrés #8/#21). Same round-trip the
// Feriados section already uses (#17).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'

import { useTranslation } from '@/lib/i18n/context'

const RETURN_TURNO_KEY = 'cb:agenda:returnTurno'

export function ReturnToTurnoBanner() {
  const { t } = useTranslation()
  const router = useRouter()
  const [hasReturn, setHasReturn] = useState(false)
  useEffect(() => {
    try {
      setHasReturn(!!sessionStorage.getItem(RETURN_TURNO_KEY))
    } catch {
      setHasReturn(false)
    }
  }, [])
  if (!hasReturn) return null
  return (
    <div className='mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2'>
      <span className='text-xs text-dark dark:text-white'>{t('autoGestion.availability.returnBannerHint')}</span>
      <button
        type='button'
        onClick={() => router.push('/agenda')}
        className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis'>
        <Icon icon='solar:arrow-left-line-duotone' height={16} width={16} />
        {t('autoGestion.availability.backToTurno')}
      </button>
    </div>
  )
}
