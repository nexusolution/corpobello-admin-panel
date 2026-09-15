'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  fetchTreatmentColors,
  saveTreatmentColor,
  resetTreatmentColor,
} from '@/lib/data/treatment-colors-config'
import { fetchMenuOverrides } from '@/lib/data/menu-overrides'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { getTreatmentColor } from '@/lib/treatment-colors'
import { useTranslation } from '@/lib/i18n/context'

export function ColoresSection() {
  const { t } = useTranslation()
  const [treatments, setTreatments] = useState<{ slug: string; name: string }[]>([])
  const [colors, setColors] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  function reload() {
    setLoading(true)
    return Promise.all([
      fetchMenuOverrides(),
      fetchTreatmentPrices(),
      fetchTreatmentColors(),
    ]).then(([mo, tp, cols]) => {
      const byslug = new Map<string, string>()
      for (const m of mo.data) byslug.set(m.slug, m.displayName)
      for (const p of tp.data) if (!byslug.has(p.slug)) byslug.set(p.slug, p.displayName)
      setTreatments(
        [...byslug.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
      )
      setColors(cols)
      setLoading(false)
    })
  }
  useEffect(() => {
    void reload()
  }, [])

  // Resolved colour for a treatment: the saved override, else the code default.
  const resolved = useMemo(
    () => (slug: string, name: string) => colors.get(slug) ?? getTreatmentColor(`${slug} ${name}`).hex,
    [colors],
  )

  async function setColor(slug: string, color: string) {
    setColors((prev) => new Map(prev).set(slug, color))
    const err = await saveTreatmentColor(slug, color)
    if (err) await Swal.fire({ icon: 'error', title: t('autoGestion.colors.error'), text: err })
  }
  async function reset(slug: string) {
    const err = await resetTreatmentColor(slug)
    if (err) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.colors.error'), text: err })
      return
    }
    setColors((prev) => {
      const n = new Map(prev)
      n.delete(slug)
      return n
    })
  }

  return (
    <div className='space-y-6'>
      <div>
        <h5 className='card-title'>{t('autoGestion.colors.heading')}</h5>
        <p className='text-sm text-link dark:text-darklink mt-1'>{t('autoGestion.colors.subtitle')}</p>
      </div>

      {loading ? (
        <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.packs.loading')}</p>
      ) : treatments.length === 0 ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.colors.empty')}</p>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
          {treatments.map((tr) => {
            const overridden = colors.has(tr.slug)
            return (
              <div
                key={tr.slug}
                className='flex items-center gap-3 rounded-lg border border-border dark:border-darkborder p-3'>
                <input
                  type='color'
                  value={resolved(tr.slug, tr.name)}
                  onChange={(e) => setColor(tr.slug, e.target.value)}
                  className='h-8 w-10 rounded-md border border-border dark:border-darkborder bg-transparent p-0.5 cursor-pointer shrink-0'
                />
                <span className='flex-1 min-w-0 truncate text-sm text-dark dark:text-white'>{tr.name}</span>
                {overridden && (
                  <button
                    type='button'
                    onClick={() => reset(tr.slug)}
                    className='text-xs font-medium text-link dark:text-darklink hover:text-primary'>
                    {t('autoGestion.colors.reset')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
