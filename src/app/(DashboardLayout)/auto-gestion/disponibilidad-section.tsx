'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

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
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Treatment = { slug: string; name: string }

const FIELD =
  'rounded-md border border-border dark:border-darkborder bg-background px-2 py-1.5 text-sm text-dark dark:text-white focus:outline-none focus:border-primary'

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
    default:
      return ''
  }
}

// ── an editable rule draft ───────────────────────────────────────────────────
type Draft = {
  id: string
  sucursal: string
  mode: 'include' | 'exclude' // include a set, or "todos menos" a set
  slugs: string[]
  patternType: DayPattern['type']
  weekly: Weekday[]
  monthly: { weekday: Weekday; ordinal: number }[]
  anchorMonday: string
  groupA: Weekday[]
  groupB: Weekday[]
  openMin: number
  closeMin: number
  active: boolean
  label: string
}

function emptyDraft(): Draft {
  return {
    id: '',
    sucursal: SUCURSALES[0] ?? 'merlo',
    mode: 'include',
    slugs: [],
    patternType: 'weekly',
    weekly: [2, 3, 4, 5, 6],
    monthly: [{ weekday: 1, ordinal: 1 }],
    anchorMonday: '',
    groupA: [5],
    groupB: [6],
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
  else pattern = { type: 'alternating', anchorMonday: d.anchorMonday, groups: [d.groupA, d.groupB] }
  return {
    id: d.id,
    sucursal: d.sucursal,
    treatmentSlugs: d.mode === 'include' ? d.slugs : [],
    treatmentExclude: d.mode === 'exclude' ? d.slugs : [],
    pattern,
    openMin: d.openMin,
    closeMin: d.closeMin,
    active: d.active,
    label: d.label.trim() || undefined,
  }
}

export function DisponibilidadSection() {
  const { t, locale } = useTranslation() as { t: TFn; locale: string }
  const [rules, setRules] = useState<AvailabilityRule[]>([])
  const [exclusions, setExclusions] = useState<AvailabilityExclusion[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
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

  function reload() {
    setLoading(true)
    return fetchAvailability().then(({ rules, exclusions }) => {
      setRules(rules)
      setExclusions(exclusions)
      setLoading(false)
    })
  }

  useEffect(() => {
    void reload()
    void Promise.all([fetchMenuOverrides(), fetchTreatmentPrices()]).then(([mo, tp]) => {
      const byslug = new Map<string, string>()
      for (const m of mo.data) byslug.set(m.slug, m.displayName)
      for (const p of tp.data) if (!byslug.has(p.slug)) byslug.set(p.slug, p.displayName)
      setTreatments(
        [...byslug.entries()]
          .map(([slug, name]) => ({ slug, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    })
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

        <div className='rounded-md border border-border dark:border-darkborder p-3 mb-4 flex flex-wrap items-end gap-3'>
          <label className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.blockedBranch')}</span>
            <select value={exSucursal} onChange={(e) => setExSucursal(e.target.value)} className={FIELD}>
              {SUCURSALES.map((s) => (
                <option key={s} value={s}>{sucursalLabel(s)}</option>
              ))}
            </select>
          </label>
          <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.blockedTreatments')}</span>
            <TreatmentChips treatments={treatments} selected={exSlugs} onToggle={(slug) => setExSlugs((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]))} />
          </div>
          <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.whenActiveIn')}</span>
            <div className='flex flex-wrap gap-1.5'>
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
  locale,
  t,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft
  treatments: Treatment[]
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
    (draft.patternType !== 'alternating' || (!!draft.anchorMonday && (draft.groupA.length > 0 || draft.groupB.length > 0)))

  return (
    <div className='rounded-md border border-primary/40 bg-lightprimary/30 dark:bg-lightprimary/10 p-4 mb-5 space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.branch')}</span>
          <select value={draft.sucursal} onChange={(e) => set({ sucursal: e.target.value })} className={FIELD}>
            {SUCURSALES.map((s) => (
              <option key={s} value={s}>{sucursalLabel(s)}</option>
            ))}
          </select>
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.open')}</span>
          <input type='time' value={minToHHMM(draft.openMin)} onChange={(e) => set({ openMin: hhmmToMin(e.target.value) })} className={FIELD} />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.close')}</span>
          <input type='time' value={minToHHMM(draft.closeMin)} onChange={(e) => set({ closeMin: hhmmToMin(e.target.value) })} className={FIELD} />
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
          <select value={draft.mode} onChange={(e) => set({ mode: e.target.value as Draft['mode'] })} className={FIELD}>
            <option value='include'>{t('autoGestion.availability.includeOnly')}</option>
            <option value='exclude'>{t('autoGestion.availability.excludeFrom')}</option>
          </select>
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
          <select value={draft.patternType} onChange={(e) => set({ patternType: e.target.value as DayPattern['type'] })} className={FIELD}>
            <option value='weekly'>{t('autoGestion.availability.weekly')}</option>
            <option value='monthly_ordinal'>{t('autoGestion.availability.monthlyOrdinal')}</option>
            <option value='alternating'>{t('autoGestion.availability.alternating')}</option>
          </select>
        </label>

        {draft.patternType === 'weekly' && (
          <WeekdayPicker value={draft.weekly} locale={locale} onToggle={toggleWeekly} />
        )}

        {draft.patternType === 'monthly_ordinal' && (
          <div className='space-y-2'>
            {draft.monthly.map((row, i) => (
              <div key={i} className='flex items-center gap-2'>
                <select value={row.ordinal} onChange={(e) => set({ monthly: draft.monthly.map((r, j) => (j === i ? { ...r, ordinal: parseInt(e.target.value, 10) } : r)) })} className={FIELD}>
                  {ORDINALS.map((o) => (
                    <option key={o} value={o}>{ordinalLabel(o, locale)}</option>
                  ))}
                </select>
                <select value={row.weekday} onChange={(e) => set({ monthly: draft.monthly.map((r, j) => (j === i ? { ...r, weekday: parseInt(e.target.value, 10) as Weekday } : r)) })} className={FIELD}>
                  {WEEKDAY_ORDER.map((w) => (
                    <option key={w} value={w}>{weekdayLabel(w, locale)}</option>
                  ))}
                </select>
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

        {draft.patternType === 'alternating' && (
          <div className='space-y-2'>
            <label className='flex flex-col gap-1 max-w-[220px]'>
              <span className='text-xs font-medium text-dark dark:text-white'>{t('autoGestion.availability.anchorDate')}</span>
              <input type='date' value={draft.anchorMonday} onChange={(e) => set({ anchorMonday: e.target.value })} className={FIELD} />
              <span className='text-[11px] text-link dark:text-darklink'>{t('autoGestion.availability.anchorHint')}</span>
            </label>
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
