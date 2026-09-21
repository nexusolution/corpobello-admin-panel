'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'
import moment from 'moment'
import { es } from 'date-fns/locale'
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimeField } from '@/components/ui/time-field'

import {
  fetchAvailability,
  saveRule,
  deleteRule,
  saveExclusion,
  deleteExclusion,
} from '@/lib/data/availability'
import type {
  AvailabilityExclusion,
  AvailabilityRule,
  DayPattern,
  Weekday,
} from '@/lib/scheduling/availability'
import { SUCURSALES } from '@/lib/data/calendar-events'
import { fetchMenuOverrides } from '@/lib/data/menu-overrides'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchTreatmentCatalog } from '@/lib/data/treatment-catalog'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Treatment = { slug: string; name: string }
type Professional = { id: string; name: string }

const FIELD =
  'rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'

// Native select with a consistent custom chevron (no doubled/overlapping arrow).
function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string | number
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  // Plain native select: it already shows a single built-in chevron (a custom
  // overlay chevron doubled the arrow — Andrés 2026-09-21).
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD} w-full pr-8 ${className ?? ''}`}>
      {children}
    </select>
  )
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Styled date picker (Popover + Calendar) matching the agenda — replaces the raw
// native date input so the reference date reads and picks consistently.
function DateField({
  value,
  onChange,
  locale,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  locale: string
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='w-full flex items-center justify-between gap-2 rounded-md border border-border dark:border-darkborder bg-background px-3 py-1.5 text-sm text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
          <span>{date ? moment(date).format('DD MMM YYYY') : placeholder}</span>
          <Icon icon='solar:calendar-mark-line-duotone' height={16} width={16} className='text-link dark:text-darklink shrink-0' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <DatePickerCalendar
          mode='single'
          selected={date}
          defaultMonth={date}
          captionLayout='dropdown'
          startMonth={new Date(2020, 0)}
          endMonth={new Date(2035, 11)}
          locale={locale === 'es' ? es : undefined}
          onSelect={(d: Date | undefined) => {
            if (!d) return
            onChange(toDateInput(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// Monday-first display order (JS getDay numbers).
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]
const ORDINALS = [1, 2, 3, 4, -1]

function weekdayLabel(wd: number, locale: string): string {
  const es = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (locale === 'es' ? es : en)[wd] ?? ''
}
function ordinalLabel(ord: number, locale: string): string {
  if (ord === -1) return locale === 'es' ? 'último' : 'last'
  return locale === 'es' ? `${ord}º` : `${ord}.`
}
function sucursalLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10))
  return (h || 0) * 60 + (m || 0)
}

function patternSummary(p: DayPattern, locale: string): string {
  switch (p.type) {
    case 'weekly':
      return WEEKDAY_ORDER.filter((w) => p.weekdays.includes(w))
        .map((w) => weekdayLabel(w, locale))
        .join(', ')
    case 'monthly_ordinal':
      return p.days.map((d) => `${ordinalLabel(d.ordinal, locale)} ${weekdayLabel(d.weekday, locale)}`).join(', ')
    case 'alternating': {
      const g = p.groups.map(
        (grp, i) => `${locale === 'es' ? 'Sem' : 'Wk'} ${i + 1}: ${grp.map((w) => weekdayLabel(w, locale)).join('/')}`,
      )
      return g.join(' · ')
    }
    case 'monthly_cycle': {
      const wk = locale === 'es' ? 'sem' : 'wk'
      const anchorTxt = locale === 'es' ? 'Ciclo desde el 2º lunes' : 'Cycle from 2nd Mon'
      const parts = p.entries.map((e) => `+${e.weekOffset} ${wk} ${weekdayLabel(e.weekday, locale)}`)
      const feriado =
        p.shiftAnchorOnHoliday !== false
          ? locale === 'es'
            ? ' · si el 2º lunes es feriado, adelanta esa jornada'
            : ' · if 2nd Mon is a holiday, that day moves up'
          : ''
      return `${anchorTxt} → ${parts.join(', ')}${feriado}`
    }
    default:
      return ''
  }
}

// ── an editable rule draft ───────────────────────────────────────────────────
type Draft = {
  id: string
  sucursal: string
  professionalId: string // '' = sin asignar (aplica a cualquiera)
  mode: 'include' | 'exclude' // include a set, or "todos menos" a set
  slugs: string[]
  patternType: DayPattern['type']
  weekly: Weekday[]
  monthly: { weekday: Weekday; ordinal: number }[]
  anchorMonday: string
  groupA: Weekday[]
  groupB: Weekday[]
  cycleEntries: { weekOffset: number; weekday: Weekday }[]
  holidayShift: boolean // monthly_cycle: adelantar la jornada ancla si el 2º lunes es feriado
  openMin: number
  closeMin: number
  active: boolean
  label: string
}

function emptyDraft(): Draft {
  return {
    id: '',
    sucursal: SUCURSALES[0] ?? 'merlo',
    professionalId: '',
    mode: 'include',
    slugs: [],
    patternType: 'weekly',
    weekly: [2, 3, 4, 5, 6],
    monthly: [{ weekday: 1, ordinal: 1 }],
    anchorMonday: '',
    groupA: [5],
    groupB: [6],
    cycleEntries: [{ weekOffset: 0, weekday: 1 }],
    holidayShift: true,
    openMin: 8 * 60,
    closeMin: 20 * 60,
    active: true,
    label: '',
  }
}

function ruleToDraft(r: AvailabilityRule): Draft {
  const exclude = r.treatmentExclude ?? []
  const d = emptyDraft()
  d.id = r.id
  d.sucursal = r.sucursal
  d.professionalId = r.professionalId ?? ''
  d.mode = exclude.length > 0 ? 'exclude' : 'include'
  d.slugs = exclude.length > 0 ? exclude : r.treatmentSlugs
  d.patternType = r.pattern.type
  if (r.pattern.type === 'weekly') d.weekly = r.pattern.weekdays
  if (r.pattern.type === 'monthly_ordinal') d.monthly = r.pattern.days
  if (r.pattern.type === 'alternating') {
    d.anchorMonday = r.pattern.anchorMonday
    d.groupA = r.pattern.groups[0] ?? []
    d.groupB = r.pattern.groups[1] ?? []
  }
  if (r.pattern.type === 'monthly_cycle') {
    d.cycleEntries = r.pattern.entries.length ? r.pattern.entries : [{ weekOffset: 0, weekday: 1 }]
    d.holidayShift = r.pattern.shiftAnchorOnHoliday !== false
  }
  d.openMin = r.openMin
  d.closeMin = r.closeMin
  d.active = r.active
  d.label = r.label ?? ''
  return d
}

function draftToRule(d: Draft): AvailabilityRule {
  let pattern: DayPattern
  if (d.patternType === 'weekly') pattern = { type: 'weekly', weekdays: [...d.weekly].sort() }
  else if (d.patternType === 'monthly_ordinal') pattern = { type: 'monthly_ordinal', days: d.monthly }
  else if (d.patternType === 'monthly_cycle')
    pattern = {
      type: 'monthly_cycle',
      ordinal: 2,
      anchorWeekday: 1,
      shiftAnchorOnHoliday: d.holidayShift,
      entries: d.cycleEntries,
    }
  else pattern = { type: 'alternating', anchorMonday: d.anchorMonday, groups: [d.groupA, d.groupB] }
  return {
    id: d.id,
    sucursal: d.sucursal,
    professionalId: d.professionalId || null,
    treatmentSlugs: d.mode === 'include' ? d.slugs : [],
    treatmentExclude: d.mode === 'exclude' ? d.slugs : [],
    pattern,
    openMin: d.openMin,
    closeMin: d.closeMin,
    active: d.active,
    label: d.label.trim() || undefined,
  }
}

// Same sessionStorage key the agenda uses to stash a turno before jumping here
// (Andrés #1c). Kept as a local literal so this bundle does not import the huge
// agenda module just for a string.
const RETURN_TURNO_KEY = 'cb:agenda:returnTurno'

export function DisponibilidadSection({
  initialFocus,
}: {
  // Deep-link from the agenda's "Editar disponibilidad" (Andrés #1b): open a new
  // rule draft pre-filled with this professional + sucursal (+ the date's weekday).
  initialFocus?: { prof: string; suc: string; date: string } | null
} = {}) {
  const { t, locale } = useTranslation() as { t: TFn; locale: string }
  const router = useRouter()
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [exclusions, setExclusions] = useState<AvailabilityExclusion[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)

  // exclusion form
  const [exSucursal, setExSucursal] = useState<string>(SUCURSALES[0] ?? 'merlo')
  const [exSlugs, setExSlugs] = useState<string[]>([])
  const [exWhen, setExWhen] = useState<string[]>([])

  const nameOf = useMemo(() => {
    const m = new Map(treatments.map((x) => [x.slug, x.name]))
    return (slug: string) => m.get(slug) ?? slug
  }, [treatments])

  const professionalName = useMemo(() => {
    const m = new Map(professionals.map((x) => [x.id, x.name]))
    return (id?: string | null) => (id ? m.get(id) ?? id : '')
  }, [professionals])

  function reload() {
    setLoading(true)
    return fetchAvailability().then(({ rules, exclusions }) => {
      setRules(rules)
      setExclusions(exclusions)
      setLoading(false)
    })
  }

  // Deep-link: open a new rule draft pre-filled with the professional/sucursal
  // (and the date's weekday) that the agenda sent us (Andrés #1b). Once.
  const focusAppliedRef = useRef(false)
  useEffect(() => {
    if (!initialFocus || focusAppliedRef.current) return
    focusAppliedRef.current = true
    const d = emptyDraft()
    if (initialFocus.suc) d.sucursal = initialFocus.suc
    if (initialFocus.prof) d.professionalId = initialFocus.prof
    if (initialFocus.date) {
      const wd = new Date(`${initialFocus.date}T12:00:00`).getDay() as Weekday
      d.patternType = 'weekly'
      d.weekly = [wd]
    }
    setDraft(d)
  }, [initialFocus])

  useEffect(() => {
    void reload()
    // Prefer the autogestionable catalog (0051) when imported so NEW treatments are
    // configurable here too; fall back to the code catalog otherwise (Andrés #8).
    void Promise.all([fetchMenuOverrides(), fetchTreatmentPrices(), fetchTreatmentCatalog()]).then(
      ([mo, tp, cat]) => {
        if (cat.data.length > 0) {
          setTreatments(
            cat.data
              .map((c) => ({ slug: c.slug, name: c.label }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          )
          return
        }
        const byslug = new Map<string, string>()
        for (const m of mo.data) byslug.set(m.slug, m.displayName)
        for (const p of tp.data) if (!byslug.has(p.slug)) byslug.set(p.slug, p.displayName)
        setTreatments(
          [...byslug.entries()]
            .map(([slug, name]) => ({ slug, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      },
    )
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data
          .filter((u) => u.status === 'active')
          .map((u) => ({ id: u.id, name: u.fullName })),
      ),
    )
  }, [])

  async function persist() {
    if (!draft) return
    const error = await saveRule(draftToRule(draft))
    if (error) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.availability.error'), text: error })
      return
    }
    setDraft(null)
    void reload()
    // If we arrived here from a blocked turno ("Editar disponibilidad"), offer to
    // go back to that turno with its data intact (Andrés #1c). The turno is stashed
    // in sessionStorage; the agenda re-opens it on return.
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
        title: t('autoGestion.availability.savedTitle'),
        text: t('autoGestion.availability.returnToTurno'),
        showCancelButton: true,
        confirmButtonText: t('autoGestion.availability.returnGo'),
        cancelButtonText: t('autoGestion.availability.returnStay'),
        confirmButtonColor: '#5d87ff',
      })
      if (res.isConfirmed) router.push('/agenda')
    }
  }

  async function removeRule(r: AvailabilityRule) {
    const c = await Swal.fire({
      icon: 'warning',
      title: t('autoGestion.availability.deleteConfirm'),
      showCancelButton: true,
      confirmButtonText: t('autoGestion.availability.delete'),
      cancelButtonText: t('autoGestion.availability.cancel'),
      confirmButtonColor: '#fa896b',
    })
    if (!c.isConfirmed) return
    setRules((prev) => prev.filter((x) => x.id !== r.id))
    await deleteRule(r.id)
  }

  async function addExclusion() {
    if (exSlugs.length === 0 || exWhen.length === 0) return
    const error = await saveExclusion({
      id: '',
      sucursal: exSucursal,
      treatmentSlugs: exSlugs,
      whenActiveIn: exWhen,
      active: true,
    })
    if (error) {
      await Swal.fire({ icon: 'error', title: t('autoGestion.availability.error'), text: error })
      return
    }
    setExSlugs([])
    setExWhen([])
    void reload()
  }

  async function removeExclusion(e: AvailabilityExclusion) {
    setExclusions((prev) => prev.filter((x) => x.id !== e.id))
    await deleteExclusion(e.id)
  }

  const rulesBySucursal = useMemo(() => {
    const map = new Map<string, AvailabilityRule[]>()
    for (const r of rules) {
      const arr = map.get(r.sucursal) ?? []
      arr.push(r)
      map.set(r.sucursal, arr)
    }
    return map
  }, [rules])

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.availability.heading')}</h3>
          <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-xl'>{t('autoGestion.availability.subtitle')}</p>
        </div>
        {!draft && (
          <button
            type='button'
            onClick={() => setDraft(emptyDraft())}
            className='shrink-0 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis transition-colors'>
            {t('autoGestion.availability.addRule')}
          </button>
        )}
      </div>

      {draft && (
        <RuleEditor
          draft={draft}
          treatments={treatments}
          professionals={professionals}
          locale={locale}
          t={t}
          onChange={setDraft}
          onSave={persist}
          onCancel={() => setDraft(null)}
        />
      )}

      {/* Rules list, grouped by sucursal */}
      {loading ? (
        <div className='py-6 flex justify-center'>
          <Icon icon='tabler:loader-2' height={22} width={22} className='text-primary animate-spin' />
        </div>
      ) : rules.length === 0 ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.availability.empty')}</p>
      ) : (
        <div className='space-y-5'>
          {[...rulesBySucursal.entries()].map(([suc, list]) => (
            <div key={suc}>
              <h4 className='text-xs font-semibold uppercase tracking-wide text-link dark:text-darklink mb-2'>{sucursalLabel(suc)}</h4>
              <div className='space-y-2'>
                {list.map((r) => (
                  <div key={r.id} className='flex items-start gap-3 rounded-md border border-border dark:border-darkborder px-3 py-2.5 flex-wrap'>
                    <span className={`mt-0.5 inline-flex h-2 w-2 rounded-full ${r.active ? 'bg-success' : 'bg-muted'}`} />
                    <div className='min-w-[180px] flex-1'>
                      <div className='text-sm font-medium text-dark dark:text-white'>
                        {r.treatmentExclude && r.treatmentExclude.length > 0
                          ? `${t('autoGestion.availability.allExcept')}: ${r.treatmentExclude.map(nameOf).join(', ')}`
                          : r.treatmentSlugs.length === 0
                            ? t('autoGestion.availability.allTreatments')
                            : r.treatmentSlugs.map(nameOf).join(', ')}
                      </div>
                      <div className='text-xs text-link dark:text-darklink mt-0.5'>
                        {patternSummary(r.pattern, locale)} · {minToHHMM(r.openMin)} a {minToHHMM(r.closeMin)}
                        {r.professionalId ? ` · ${professionalName(r.professionalId)}` : ''}
                      </div>
                    </div>
                    <div className='ml-auto flex items-center gap-2'>
                      <button type='button' onClick={() => setDraft(ruleToDraft(r))} aria-label={t('autoGestion.availability.edit')} className='text-link dark:text-darklink hover:text-primary transition-colors'>
                        <Icon icon='solar:pen-2-line-duotone' height={17} width={17} />
                      </button>
                      <button type='button' onClick={() => void removeRule(r)} aria-label={t('autoGestion.availability.delete')} className='text-link dark:text-darklink hover:text-error transition-colors'>
                        <Icon icon='solar:trash-bin-trash-line-duotone' height={17} width={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Exclusions */}
      <div className='mt-8 border-t border-border dark:border-darkborder pt-5'>
        <h4 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.availability.exclusionsHeading')}</h4>
        <p className='text-xs text-link dark:text-darklink mt-0.5 mb-3 max-w-xl'>{t('autoGestion.availability.exclusionsSubtitle')}</p>

        <div className='rounded-md border border-border dark:border-darkborder p-4 mb-4 space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='flex flex-col gap-1'>
              <span className='text-xs font-medium text-dark dark:text-white'>1. {t('autoGestion.availability.blockedBranch')}</span>
              <Select value={exSucursal} onChange={setExSucursal} className='w-full'>
                {SUCURSALES.map((s) => (
                  <option key={s} value={s}>{sucursalLabel(s)}</option>
                ))}
              </Select>
            </label>
            <div className='flex flex-col gap-1'>
              <span className='text-xs font-medium text-dark dark:text-white'>3. {t('autoGestion.availability.whenActiveIn')}</span>
              <div className='flex flex-wrap gap-1.5 pt-0.5'>
                {SUCURSALES.filter((s) => s !== exSucursal).map((s) => {
                  const on = exWhen.includes(s)
                  return (
                    <button key={s} type='button' onClick={() => setExWhen((p) => (on ? p.filter((x) => x !== s) : [...p, s]))} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-primary text-white border-primary' : 'border-border dark:border-darkborder text-link dark:text-darklink hover:border-primary'}`}>
                      {sucursalLabel(s)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-dark dark:text-white'>
              2. {t('autoGestion.availability.blockedTreatments')}
              {exSlugs.length > 0 ? ` (${exSlugs.length})` : ''}
            </span>
            <TreatmentChips treatments={treatments} selected={exSlugs} onToggle={(slug) => setExSlugs((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]))} />
          </div>

          {/* Live preview so the rule reads as a plain sentence */}
          <p className='text-sm text-dark dark:text-white bg-lightprimary/40 dark:bg-lightprimary/10 rounded-md px-3 py-2'>
            <strong>{sucursalLabel(exSucursal)}</strong> {t('autoGestion.availability.doesNotDo')}{' '}
            <strong>{exSlugs.length > 0 ? exSlugs.map(nameOf).join(', ') : '…'}</strong>{' '}
            {t('autoGestion.availability.whenDoneIn')}{' '}
            <strong>{exWhen.length > 0 ? exWhen.map(sucursalLabel).join(', ') : '…'}</strong>
          </p>

          <button type='button' disabled={exSlugs.length === 0 || exWhen.length === 0} onClick={() => void addExclusion()} className='px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
            {t('autoGestion.availability.addExclusion')}
          </button>
        </div>

        {exclusions.length === 0 ? (
          <p className='text-sm text-link dark:text-darklink italic'>{t('autoGestion.availability.noExclusions')}</p>
        ) : (
          <div className='space-y-2'>
            {exclusions.map((e) => (
              <div key={e.id} className='flex items-center gap-3 rounded-md border border-border dark:border-darkborder px-3 py-2.5 flex-wrap'>
                <span className='text-sm text-dark dark:text-white'>
                  <strong>{sucursalLabel(e.sucursal)}</strong> {t('autoGestion.availability.doesNotDo')} {e.treatmentSlugs.map(nameOf).join(', ')} {t('autoGestion.availability.whenDoneIn')} {e.whenActiveIn.map(sucursalLabel).join(', ')}
                </span>
                <button type='button' onClick={() => void removeExclusion(e)} aria-label={t('autoGestion.availability.delete')} className='ml-auto text-link dark:text-darklink hover:text-error transition-colors'>
                  <Icon icon='solar:trash-bin-trash-line-duotone' height={17} width={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className='text-xs text-link dark:text-darklink mt-6 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.availability.note')}
      </p>
    </div>
  )
}

// ── the add/edit form ────────────────────────────────────────────────────────
function RuleEditor({
  draft,
  treatments,
  professionals,
  locale,
  t,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft
  treatments: Treatment[]
  professionals: Professional[]
  locale: string
  t: TFn
  onChange: (d: Draft) => void
  onSave: () => void
  onCancel: () => void
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  const toggleWeekly = (w: Weekday) =>
    set({ weekly: draft.weekly.includes(w) ? draft.weekly.filter((x) => x !== w) : [...draft.weekly, w] })
  const toggleGroup = (which: 'groupA' | 'groupB', w: Weekday) => {
    const cur = draft[which]
    set({ [which]: cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w] } as Partial<Draft>)
  }
  const valid =
    draft.closeMin > draft.openMin &&
    (draft.patternType !== 'weekly' || draft.weekly.length > 0) &&
    (draft.patternType !== 'monthly_ordinal' || draft.monthly.length > 0) &&
    (draft.patternType !== 'monthly_cycle' || draft.cycleEntries.length > 0) &&
    (draft.patternType !== 'alternating' || (!!draft.anchorMonday && (draft.groupA.length > 0 || draft.groupB.length > 0)))

  return (
    <div className='rounded-md border border-primary/40 bg-lightprimary/30 dark:bg-lightprimary/10 p-4 mb-5 space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.branch')}</span>
          <Select value={draft.sucursal} onChange={(v) => set({ sucursal: v })}>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>{sucursalLabel(s)}</option>
            ))}
          </Select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.professional')}</span>
          <Select value={draft.professionalId} onChange={(v) => set({ professionalId: v })}>
            <option value=''>{t('autoGestion.availability.anyProfessional')}</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.open')}</span>
          <TimeField value={minToHHMM(draft.openMin)} onChange={(v) => set({ openMin: hhmmToMin(v) })} />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.close')}</span>
          <TimeField value={minToHHMM(draft.closeMin)} onChange={(v) => set({ closeMin: hhmmToMin(v) })} />
        </label>
        <label className='flex items-center gap-2 cursor-pointer select-none pb-1.5'>
          <input type='checkbox' checked={draft.active} onChange={(e) => set({ active: e.target.checked })} className='h-4 w-4 rounded border-border dark:border-darkborder accent-primary' />
          <span className='text-sm text-dark dark:text-white'>{t('autoGestion.availability.active')}</span>
        </label>
      </div>

      {/* Treatments */}
      <div className='space-y-1.5'>
        <div className='flex items-center gap-3'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.treatments')}</span>
          <Select value={draft.mode} onChange={(v) => set({ mode: v as Draft['mode'] })}>
            <option value='include'>{t('autoGestion.availability.includeOnly')}</option>
            <option value='exclude'>{t('autoGestion.availability.excludeFrom')}</option>
          </Select>
        </div>
        <TreatmentChips treatments={treatments} selected={draft.slugs} onToggle={(slug) => set({ slugs: draft.slugs.includes(slug) ? draft.slugs.filter((x) => x !== slug) : [...draft.slugs, slug] })} />
        <p className='text-[11px] text-link dark:text-darklink'>
          {draft.mode === 'include' ? t('autoGestion.availability.includeHint') : t('autoGestion.availability.excludeHint')}
        </p>
      </div>

      {/* Pattern */}
      <div className='space-y-2'>
        <label className='flex flex-col gap-1 max-w-[240px]'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.pattern')}</span>
          <Select value={draft.patternType} onChange={(v) => set({ patternType: v as DayPattern['type'] })}>
            <option value='weekly'>{t('autoGestion.availability.weekly')}</option>
            <option value='monthly_ordinal'>{t('autoGestion.availability.monthlyOrdinal')}</option>
            <option value='alternating'>{t('autoGestion.availability.alternating')}</option>
            <option value='monthly_cycle'>{t('autoGestion.availability.monthlyCycle')}</option>
          </Select>
        </label>

        {draft.patternType === 'weekly' && (
          <WeekdayPicker value={draft.weekly} locale={locale} onToggle={toggleWeekly} />
        )}

        {draft.patternType === 'monthly_ordinal' && (
          <div className='space-y-2'>
            {draft.monthly.map((row, i) => (
              <div key={i} className='flex items-center gap-2'>
                <Select value={row.ordinal} onChange={(v) => set({ monthly: draft.monthly.map((r, j) => (j === i ? { ...r, ordinal: parseInt(v, 10) } : r)) })}>
                  {ORDINALS.map((o) => (
                    <option key={o} value={o}>{ordinalLabel(o, locale)}</option>
                  ))}
                </Select>
                <Select value={row.weekday} onChange={(v) => set({ monthly: draft.monthly.map((r, j) => (j === i ? { ...r, weekday: parseInt(v, 10) as Weekday } : r)) })}>
                  {WEEKDAY_ORDER.map((w) => (
                    <option key={w} value={w}>{weekdayLabel(w, locale)}</option>
                  ))}
                </Select>
                <button type='button' onClick={() => set({ monthly: draft.monthly.filter((_, j) => j !== i) })} className='text-link dark:text-darklink hover:text-error'>
                  <Icon icon='solar:close-circle-line-duotone' height={18} width={18} />
                </button>
              </div>
            ))}
            <button type='button' onClick={() => set({ monthly: [...draft.monthly, { weekday: 1, ordinal: 1 }] })} className='text-xs text-primary font-medium hover:underline'>
              + {t('autoGestion.availability.addDay')}
            </button>
          </div>
        )}

        {draft.patternType === 'monthly_cycle' && (
          <div className='space-y-2'>
            <p className='text-[11px] text-link dark:text-darklink'>{t('autoGestion.availability.cycleHint')}</p>
            {draft.cycleEntries.map((row, i) => (
              <div key={i} className='flex items-center gap-2'>
                <span className='text-xs text-link dark:text-darklink'>+</span>
                <input
                  type='number'
                  min={0}
                  max={8}
                  value={row.weekOffset}
                  onChange={(e) =>
                    set({
                      cycleEntries: draft.cycleEntries.map((r, j) =>
                        j === i ? { ...r, weekOffset: Math.max(0, parseInt(e.target.value, 10) || 0) } : r,
                      ),
                    })
                  }
                  className={`${FIELD} w-16`}
                />
                <span className='text-xs text-link dark:text-darklink'>{t('autoGestion.availability.weekOffset')}</span>
                <Select
                  value={row.weekday}
                  onChange={(v) =>
                    set({
                      cycleEntries: draft.cycleEntries.map((r, j) =>
                        j === i ? { ...r, weekday: parseInt(v, 10) as Weekday } : r,
                      ),
                    })
                  }>
                  {WEEKDAY_ORDER.map((w) => (
                    <option key={w} value={w}>{weekdayLabel(w, locale)}</option>
                  ))}
                </Select>
                <button
                  type='button'
                  onClick={() => set({ cycleEntries: draft.cycleEntries.filter((_, j) => j !== i) })}
                  className='text-link dark:text-darklink hover:text-error'>
                  <Icon icon='solar:close-circle-line-duotone' height={18} width={18} />
                </button>
              </div>
            ))}
            <button
              type='button'
              onClick={() => set({ cycleEntries: [...draft.cycleEntries, { weekOffset: 0, weekday: 1 }] })}
              className='text-xs text-primary font-medium hover:underline'>
              + {t('autoGestion.availability.addEntry')}
            </button>

            {/* Feriado exception (Andrés #10): visible + editable, not hidden. */}
            <label className='flex items-start gap-2 cursor-pointer select-none pt-1'>
              <input
                type='checkbox'
                checked={draft.holidayShift}
                onChange={(e) => set({ holidayShift: e.target.checked })}
                className='h-4 w-4 mt-0.5 rounded border-border dark:border-darkborder accent-primary'
              />
              <span className='text-xs text-dark dark:text-white'>{t('autoGestion.availability.holidayShift')}</span>
            </label>
          </div>
        )}

        {draft.patternType === 'alternating' && (
          <div className='space-y-2'>
            <div className='flex flex-col gap-1 max-w-[220px]'>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.anchorDate')}</span>
              <DateField value={draft.anchorMonday} onChange={(v) => set({ anchorMonday: v })} locale={locale} placeholder={t('turno.chooseDate')} />
              <span className='text-[11px] text-link dark:text-darklink'>{t('autoGestion.availability.anchorHint')}</span>
            </div>
            <div>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.weekA')}</span>
              <WeekdayPicker value={draft.groupA} locale={locale} onToggle={(w) => toggleGroup('groupA', w)} />
            </div>
            <div>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.weekB')}</span>
              <WeekdayPicker value={draft.groupB} locale={locale} onToggle={(w) => toggleGroup('groupB', w)} />
            </div>
          </div>
        )}
      </div>

      <label className='flex flex-col gap-1'>
        <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.label')}</span>
        <input value={draft.label} onChange={(e) => set({ label: e.target.value })} className={FIELD} placeholder={t('autoGestion.availability.labelPlaceholder')} />
      </label>

      <div className='flex items-center gap-2'>
        <button type='button' disabled={!valid} onClick={onSave} className='px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
          {t('autoGestion.availability.save')}
        </button>
        <button type='button' onClick={onCancel} className='px-4 py-1.5 rounded-md text-sm font-medium border border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary transition-colors'>
          {t('autoGestion.availability.cancel')}
        </button>
      </div>
    </div>
  )
}

function WeekdayPicker({ value, locale, onToggle }: { value: Weekday[]; locale: string; onToggle: (w: Weekday) => void }) {
  return (
    <div className='flex flex-wrap gap-1.5 mt-1'>
      {WEEKDAY_ORDER.map((w) => {
        const on = value.includes(w)
        return (
          <button key={w} type='button' onClick={() => onToggle(w)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-primary text-white border-primary' : 'border-border dark:border-darkborder text-link dark:text-darklink hover:border-primary'}`}>
            {weekdayLabel(w, locale)}
          </button>
        )
      })}
    </div>
  )
}

function TreatmentChips({ treatments, selected, onToggle }: { treatments: Treatment[]; selected: string[]; onToggle: (slug: string) => void }) {
  return (
    <div className='flex flex-wrap gap-1.5 max-w-2xl max-h-40 overflow-y-auto'>
      {treatments.map((tr) => {
        const on = selected.includes(tr.slug)
        return (
          <button key={tr.slug} type='button' onClick={() => onToggle(tr.slug)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-primary text-white border-primary' : 'border-border dark:border-darkborder text-link dark:text-darklink hover:border-primary'}`}>
            {tr.name}
          </button>
        )
      })}
    </div>
  )
}
