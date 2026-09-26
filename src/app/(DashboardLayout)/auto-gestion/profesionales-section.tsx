'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { fetchTreatmentCatalog } from '@/lib/data/treatment-catalog'
import { fetchCalendarEvents } from '@/lib/data/calendar-events'
import {
  fetchProfessionalTreatments,
  saveProfessionalTreatments,
  professionalDoesTreatment,
  type ProfessionalTreatments,
  type TreatmentMode,
} from '@/lib/data/professional-treatments'
import { useTranslation } from '@/lib/i18n/context'
import { ReturnToTurnoBanner } from './return-to-turno-banner'

// Same key the agenda uses to stash a turno before jumping here (Andrés #1c/#8):
// after editing the professional's treatments we offer to return to the turno.
const RETURN_TURNO_KEY = 'cb:agenda:returnTurno'

type Professional = { id: string; name: string }
type Treatment = { slug: string; label: string }

export function ProfesionalesSection({
  initialProf,
}: {
  // Deep-link from the agenda ("El profesional no realiza este tratamiento" →
  // Admin edits): pre-select this professional.
  initialProf?: string | null
} = {}) {
  const { t } = useTranslation()
  const router = useRouter()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [configs, setConfigs] = useState<Map<string, ProfessionalTreatments>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  // Draft for the selected professional.
  const [mode, setMode] = useState<TreatmentMode>('all')
  const [slugs, setSlugs] = useState<string[]>([])

  // Future turnos per (professional, treatment) — for the "affects N turnos" warning.
  const futureRef = useRef<{ professionalId: string | null; treatmentSlug: string | null; start: Date }[]>([])

  function reloadConfigs() {
    return fetchProfessionalTreatments().then(({ data }) => setConfigs(data))
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      fetchAppUsers(),
      fetchTreatmentCatalog(),
      fetchProfessionalTreatments(),
      fetchCalendarEvents(),
    ]).then(([usersRes, catRes, ptRes, evRes]) => {
      if (!active) return
      const profs = usersRes.data
        .filter((u) => u.status === 'active')
        .map((u) => ({ id: u.id, name: u.fullName }))
      setProfessionals(profs)
      setTreatments(catRes.data.filter((c) => c.active).map((c) => ({ slug: c.slug, label: c.label })))
      setConfigs(ptRes.data)
      futureRef.current = evRes.data
        .filter((e) => e.status !== 'cancelado')
        .map((e) => ({ professionalId: e.professionalId, treatmentSlug: e.treatmentSlug, start: e.start }))
      // Pre-select the deep-linked professional, else the first one.
      const first = initialProf && profs.some((p) => p.id === initialProf) ? initialProf : profs[0]?.id ?? ''
      setSelected(first)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [initialProf])

  // Load the selected professional's draft whenever the selection or configs change.
  useEffect(() => {
    if (!selected) return
    const cfg = configs.get(selected)
    setMode(cfg?.mode ?? 'all')
    setSlugs(cfg?.slugs ?? [])
    setSearch('')
  }, [selected, configs])

  const nameOf = useMemo(() => {
    const m = new Map(professionals.map((p) => [p.id, p.name]))
    return (id: string) => m.get(id) ?? id
  }, [professionals])
  const labelOf = useMemo(() => {
    const m = new Map(treatments.map((x) => [x.slug, x.label]))
    return (slug: string) => m.get(slug) ?? slug
  }, [treatments])

  // Short human summary of a professional's capability, for the list.
  function summaryFor(id: string): string {
    const cfg = configs.get(id)
    if (!cfg || cfg.mode === 'all') return t('autoGestion.profTreatments.summaryAll')
    if (cfg.mode === 'none') return t('autoGestion.profTreatments.summaryNone')
    const names = cfg.slugs.map(labelOf).join(', ')
    return cfg.mode === 'all_except'
      ? t('autoGestion.profTreatments.summaryExcept', { list: names })
      : t('autoGestion.profTreatments.summaryOnly', { list: names })
  }

  const filteredTreatments = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? treatments.filter((x) => x.label.toLowerCase().includes(q)) : treatments
  }, [treatments, search])

  function toggleSlug(slug: string) {
    setSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  // Treatments the professional performs NOW (before saving the draft).
  function performsNow(slug: string): boolean {
    return professionalDoesTreatment(configs.get(selected), slug)
  }
  // Treatments the professional would perform under the DRAFT.
  function performsDraft(slug: string): boolean {
    return professionalDoesTreatment({ professionalId: selected, mode, slugs }, slug)
  }

  async function save() {
    if (!selected || busy) return
    // Which treatments are being REMOVED (performed now, not under the draft)?
    const removed = treatments.filter((x) => performsNow(x.slug) && !performsDraft(x.slug)).map((x) => x.slug)
    if (removed.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const affected = futureRef.current.filter(
        (e) => e.professionalId === selected && e.treatmentSlug != null && removed.includes(e.treatmentSlug) && e.start >= today,
      ).length
      if (affected > 0) {
        const res = await Swal.fire({
          icon: 'warning',
          iconColor: '#ffae1f',
          title: t('autoGestion.profTreatments.warnTitle'),
          text: t('autoGestion.profTreatments.warnBody', { n: String(affected), name: nameOf(selected) }),
          showCancelButton: true,
          confirmButtonText: t('autoGestion.profTreatments.warnConfirm'),
          cancelButtonText: t('autoGestion.availability.cancel'),
          confirmButtonColor: '#5d87ff',
          width: '400px',
          customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
        })
        if (!res.isConfirmed) return
      }
    }
    setBusy(true)
    const err = await saveProfessionalTreatments(selected, mode, slugs)
    setBusy(false)
    if (err) return void Swal.fire({ icon: 'error', title: t('autoGestion.profTreatments.error'), text: err, width: '360px' })
    await reloadConfigs()
    // If we came from a blocked turno, offer to return with the data intact.
    let hasReturn = false
    try {
      hasReturn = !!sessionStorage.getItem(RETURN_TURNO_KEY)
    } catch {
      hasReturn = false
    }
    if (hasReturn) {
      const res = await Swal.fire({
        icon: 'success',
        iconColor: '#13deb9',
        title: t('autoGestion.profTreatments.saved'),
        text: t('autoGestion.availability.returnToTurno'),
        showCancelButton: true,
        confirmButtonText: t('autoGestion.availability.returnGo'),
        cancelButtonText: t('autoGestion.availability.returnStay'),
        confirmButtonColor: '#5d87ff',
      })
      if (res.isConfirmed) router.push('/agenda')
    } else {
      void Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        iconColor: '#13deb9',
        title: t('autoGestion.profTreatments.saved'),
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false,
      })
    }
  }

  if (loading) {
    return <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.profTreatments.loading')}</p>
  }

  const dirty = (() => {
    const cfg = configs.get(selected)
    const curMode = cfg?.mode ?? 'all'
    const curSlugs = [...(cfg?.slugs ?? [])].sort().join('|')
    return curMode !== mode || curSlugs !== [...slugs].sort().join('|')
  })()
  const needsList = mode === 'all_except' || mode === 'only'

  const RADIOS: { value: TreatmentMode; label: string; hint: string }[] = [
    { value: 'all', label: t('autoGestion.profTreatments.modeAll'), hint: t('autoGestion.profTreatments.modeAllHint') },
    { value: 'all_except', label: t('autoGestion.profTreatments.modeExcept'), hint: t('autoGestion.profTreatments.modeExceptHint') },
    { value: 'only', label: t('autoGestion.profTreatments.modeOnly'), hint: t('autoGestion.profTreatments.modeOnlyHint') },
    { value: 'none', label: t('autoGestion.profTreatments.modeNone'), hint: t('autoGestion.profTreatments.modeNoneHint') },
  ]

  return (
    <div className='space-y-5'>
      <ReturnToTurnoBanner />
      <div>
        <h3 className='text-base font-semibold text-dark dark:text-white'>{t('autoGestion.profTreatments.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5'>{t('autoGestion.profTreatments.subtitle')}</p>
      </div>

      <div className='flex flex-col gap-4 md:flex-row'>
        {/* Professionals list */}
        <div className='md:w-64 md:shrink-0 rounded-md border border-border dark:border-darkborder divide-y divide-border dark:divide-darkborder overflow-hidden'>
          {professionals.length === 0 ? (
            <p className='p-3 text-sm text-link dark:text-darklink italic'>{t('autoGestion.profTreatments.empty')}</p>
          ) : (
            professionals.map((p) => {
              const active = p.id === selected
              return (
                <button
                  key={p.id}
                  type='button'
                  onClick={() => setSelected(p.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    active ? 'bg-lightprimary' : 'hover:bg-lightprimary/40'
                  }`}>
                  <span className={`block text-sm font-medium ${active ? 'text-primary' : 'text-dark dark:text-white'}`}>
                    {p.name}
                  </span>
                  <span className='block text-[11px] text-link dark:text-darklink truncate'>{summaryFor(p.id)}</span>
                </button>
              )
            })
          )}
        </div>

        {/* Editor for the selected professional */}
        {selected && (
          <div className='flex-1 min-w-0 rounded-md border border-border dark:border-darkborder p-4 space-y-4'>
            <p className='text-sm font-semibold text-dark dark:text-white'>{nameOf(selected)}</p>
            <div className='space-y-2'>
              {RADIOS.map((r) => (
                <label key={r.value} className='flex items-start gap-2 cursor-pointer'>
                  <input
                    type='radio'
                    name='mode'
                    checked={mode === r.value}
                    onChange={() => setMode(r.value)}
                    className='mt-0.5 accent-primary'
                  />
                  <span>
                    <span className='block text-sm text-dark dark:text-white'>{r.label}</span>
                    <span className='block text-[11px] text-link dark:text-darklink'>{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {needsList && (
              <div className='space-y-2'>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('autoGestion.profTreatments.searchPlaceholder')}
                  className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary'
                />
                <div className='max-h-64 overflow-y-auto rounded-md border border-border dark:border-darkborder divide-y divide-border/60 dark:divide-darkborder/60'>
                  {filteredTreatments.length === 0 ? (
                    <p className='p-3 text-sm text-link dark:text-darklink italic'>{t('autoGestion.profTreatments.noTreatments')}</p>
                  ) : (
                    filteredTreatments.map((x) => (
                      <label key={x.slug} className='flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-lightprimary/30'>
                        <input
                          type='checkbox'
                          checked={slugs.includes(x.slug)}
                          onChange={() => toggleSlug(x.slug)}
                          className='accent-primary'
                        />
                        <span className='text-sm text-dark dark:text-white'>{x.label}</span>
                      </label>
                    ))
                  )}
                </div>
                {slugs.length > 0 && (
                  <p className='text-[11px] text-link dark:text-darklink'>
                    {t('autoGestion.profTreatments.selectedCount', { n: String(slugs.length) })}
                  </p>
                )}
              </div>
            )}

            <div className='flex items-center gap-2 pt-1'>
              <button
                type='button'
                onClick={save}
                disabled={busy || !dirty || (needsList && slugs.length === 0)}
                className='inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50'>
                <Icon icon='tabler:device-floppy' height={16} width={16} />
                {t('autoGestion.profTreatments.save')}
              </button>
              {needsList && slugs.length === 0 && (
                <span className='text-[11px] text-error'>{t('autoGestion.profTreatments.pickAtLeastOne')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className='text-xs text-link dark:text-darklink flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.profTreatments.footNote')}
      </p>
    </div>
  )
}
