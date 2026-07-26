'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  FAQ_DEFAULTS,
  type FaqDefaultEntry,
  type FaqDefaultGroup,
} from '@/lib/data/faq-defaults'
import {
  fetchFaqOverrides,
  upsertFaqOverride,
  resetFaqOverride,
  faqKey,
  joinBubbles,
  type FaqOverrideRow,
} from '@/lib/data/faq-overrides'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// One editable FAQ entry. Fields initialise to the effective value (override if
// present, else code default). Save stores only the DIFF vs default — a field
// equal to the default is persisted as null so future code edits propagate; an
// entry that matches the default in every field deletes its row (reset).
function EntryEditor({
  group,
  entry,
  override,
  t,
  onChange,
}: {
  group: FaqDefaultGroup
  entry: FaqDefaultEntry
  override: FaqOverrideRow | undefined
  t: TFn
  onChange: (key: string, row: FaqOverrideRow | null) => void
}) {
  const defAnswer = joinBubbles(entry.answer)
  const curShortLabel = override?.shortLabel ?? entry.shortLabel
  const curQuestion = override?.question ?? entry.question
  const curAnswer = override?.answerText ?? defAnswer
  const curActive = override?.active ?? true

  const [open, setOpen] = useState(false)
  const [shortLabel, setShortLabel] = useState(curShortLabel)
  const [question, setQuestion] = useState(curQuestion)
  const [answer, setAnswer] = useState(curAnswer)
  const [active, setActive] = useState(curActive)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const edited = override !== undefined
  const hidden = curActive === false
  const dirty =
    shortLabel !== curShortLabel ||
    question !== curQuestion ||
    answer !== curAnswer ||
    active !== curActive
  const valid = shortLabel.trim().length > 0 && question.trim().length > 0

  async function save() {
    if (!dirty || !valid) return
    setSaving(true)
    setError(false)
    const key = faqKey(group.slug, entry.id)
    const slDiff = shortLabel.trim() === entry.shortLabel ? null : shortLabel.trim()
    const qDiff = question.trim() === entry.question ? null : question.trim()
    const aDiff = answer.trim() === defAnswer.trim() ? null : answer
    const isDefault = slDiff === null && qDiff === null && aDiff === null && active
    let err: string | null
    if (isDefault) {
      err = await resetFaqOverride(group.slug, entry.id)
      if (!err) onChange(key, null)
    } else {
      err = await upsertFaqOverride({
        slug: group.slug,
        entryId: entry.id,
        displayName: group.displayName,
        shortLabel: slDiff,
        question: qDiff,
        answerText: aDiff,
        active,
      })
      if (!err) {
        onChange(key, {
          slug: group.slug,
          entryId: entry.id,
          shortLabel: slDiff,
          question: qDiff,
          answerText: aDiff,
          active,
        })
      }
    }
    setSaving(false)
    if (err) {
      setError(true)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  function revertFields() {
    setShortLabel(curShortLabel)
    setQuestion(curQuestion)
    setAnswer(curAnswer)
    setActive(curActive)
  }

  return (
    <div className='rounded-md border border-border dark:border-darkborder'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/30 dark:hover:bg-darkmuted/30 transition-colors'>
        <div className='min-w-0'>
          <p
            className={`text-sm font-medium truncate ${hidden ? 'text-link line-through dark:text-darklink' : 'text-dark dark:text-white'}`}>
            {curShortLabel}
          </p>
          <p className='text-xs text-link dark:text-darklink truncate'>{curQuestion}</p>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {hidden && (
            <span className='text-[11px] px-1.5 py-0.5 rounded bg-lighterror text-error'>
              {t('autoGestion.faq.hidden')}
            </span>
          )}
          {edited && !hidden && (
            <span className='text-[11px] px-1.5 py-0.5 rounded bg-lightprimary text-primary'>
              {t('autoGestion.faq.edited')}
            </span>
          )}
          {dirty && <span className='h-2 w-2 rounded-full bg-warning' aria-hidden='true' />}
          <Icon icon={open ? 'tabler:chevron-up' : 'tabler:chevron-down'} height={16} width={16} className='text-link dark:text-darklink' />
        </div>
      </button>

      {open && (
        <div className='px-3 pb-3 space-y-3 border-t border-border dark:border-darkborder pt-3'>
          <label className='block'>
            <span className='text-[11px] font-medium text-link dark:text-darklink'>{t('autoGestion.faq.shortLabel')}</span>
            <input
              value={shortLabel}
              maxLength={24}
              onChange={(e) => setShortLabel(e.target.value)}
              className='mt-1 w-full rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
            <span className='text-[10px] text-link dark:text-darklink'>{t('autoGestion.faq.shortLabelHint', { n: String(shortLabel.length) })}</span>
          </label>

          <label className='block'>
            <span className='text-[11px] font-medium text-link dark:text-darklink'>{t('autoGestion.faq.question')}</span>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className='mt-1 w-full rounded-md border border-border dark:border-darkborder bg-background px-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </label>

          <label className='block'>
            <span className='text-[11px] font-medium text-link dark:text-darklink'>{t('autoGestion.faq.answer')}</span>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={8}
              className='mt-1 w-full resize-y rounded-md border border-border dark:border-darkborder bg-background p-3 text-sm font-mono text-dark dark:text-white focus:outline-none focus:border-primary transition-colors whitespace-pre-wrap'
            />
            <span className='text-[10px] text-link dark:text-darklink'>{t('autoGestion.faq.answerHint')}</span>
          </label>

          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
            />
            <span className='text-xs text-dark dark:text-white'>{t('autoGestion.faq.visible')}</span>
          </label>

          <div className='flex items-center justify-end gap-2 flex-wrap'>
            {dirty && (
              <button
                type='button'
                onClick={revertFields}
                className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
                {t('autoGestion.faq.cancel')}
              </button>
            )}
            <button
              type='button'
              disabled={!dirty || !valid || saving}
              onClick={save}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                error
                  ? 'bg-lighterror text-error'
                  : saved
                    ? 'bg-lightsuccess text-success'
                    : 'bg-primary text-white hover:bg-primaryemphasis disabled:opacity-40 disabled:cursor-not-allowed'
              }`}>
              {error
                ? t('autoGestion.faq.failed')
                : saved
                  ? t('autoGestion.faq.saved')
                  : t('autoGestion.faq.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupCard({
  group,
  overrides,
  t,
  onChange,
  query,
}: {
  group: FaqDefaultGroup
  overrides: Map<string, FaqOverrideRow>
  t: TFn
  onChange: (key: string, row: FaqOverrideRow | null) => void
  query: string
}) {
  const [open, setOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const matching = q
    ? group.entries.filter(
        (e) =>
          e.shortLabel.toLowerCase().includes(q) ||
          e.question.toLowerCase().includes(q) ||
          group.displayName.toLowerCase().includes(q),
      )
    : group.entries

  // A group is force-open while a search is active and it has matches.
  const expanded = q ? matching.length > 0 : open
  if (q && matching.length === 0) return null

  const editedCount = group.entries.filter((e) =>
    overrides.has(faqKey(group.slug, e.id)),
  ).length

  return (
    <div className='rounded-lg border border-border dark:border-darkborder'>
      <button
        type='button'
        onClick={() => !q && setOpen((o) => !o)}
        className='w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/20 dark:hover:bg-darkmuted/20 transition-colors'>
        <div className='flex items-center gap-2.5 min-w-0'>
          <Icon
            icon={group.isGlobal ? 'solar:buildings-2-line-duotone' : 'solar:question-circle-line-duotone'}
            height={18}
            width={18}
            className='text-primary shrink-0'
          />
          <div className='min-w-0'>
            <p className='text-sm font-semibold text-dark dark:text-white truncate'>{group.displayName}</p>
            <p className='text-xs text-link dark:text-darklink'>
              {t('autoGestion.faq.entryCount', { n: String(group.entries.length) })}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {editedCount > 0 && (
            <span className='text-[11px] px-1.5 py-0.5 rounded bg-lightprimary text-primary'>
              {t('autoGestion.faq.editedCount', { n: String(editedCount) })}
            </span>
          )}
          <Icon icon={expanded ? 'tabler:chevron-up' : 'tabler:chevron-down'} height={16} width={16} className='text-link dark:text-darklink' />
        </div>
      </button>

      {expanded && (
        <div className='px-4 pb-4 space-y-2'>
          {matching.map((entry) => (
            <EntryEditor
              key={entry.id}
              group={group}
              entry={entry}
              override={overrides.get(faqKey(group.slug, entry.id))}
              t={t}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FaqSection() {
  const { t } = useTranslation()
  const [overrides, setOverrides] = useState<Map<string, FaqOverrideRow>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    void fetchFaqOverrides().then(({ data, error }) => {
      if (!active) return
      setOverrides(data)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  function handleChange(key: string, row: FaqOverrideRow | null) {
    setOverrides((prev) => {
      const next = new Map(prev)
      if (row) next.set(key, row)
      else next.delete(key)
      return next
    })
  }

  // Treatments first, the shared consultorio group last.
  const groups = useMemo(
    () => [...FAQ_DEFAULTS].sort((a, b) => Number(a.isGlobal) - Number(b.isGlobal)),
    [],
  )

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='mb-5'>
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('autoGestion.faq.heading')}</h3>
        <p className='text-xs text-link dark:text-darklink mt-0.5 max-w-lg'>{t('autoGestion.faq.subtitle')}</p>
      </div>

      {loading ? (
        <div className='py-14 flex flex-col items-center gap-3'>
          <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.faq.loading')}</p>
        </div>
      ) : loadError ? (
        <div className='py-14 flex flex-col items-center gap-2 text-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          <p className='text-sm text-link dark:text-darklink'>{t('autoGestion.faq.error')}</p>
        </div>
      ) : (
        <>
          <div className='relative mb-4'>
            <Icon icon='solar:magnifer-line-duotone' height={16} width={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink' />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('autoGestion.faq.searchPlaceholder')}
              className='w-full rounded-md border border-border dark:border-darkborder bg-background pl-9 pr-3 py-2 text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>
          <div className='space-y-2'>
            {groups.map((g) => (
              <GroupCard
                key={g.slug}
                group={g}
                overrides={overrides}
                t={t}
                onChange={handleChange}
                query={query}
              />
            ))}
          </div>
        </>
      )}

      <p className='text-xs text-link dark:text-darklink mt-5 flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('autoGestion.faq.note')}
      </p>
    </div>
  )
}
