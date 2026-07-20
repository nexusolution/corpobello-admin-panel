'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'

import {
  fetchPatientDetail,
  addPatientNote,
  updatePatientContact,
  type PatientDetail as PatientDetailData,
  type PatientNote,
} from '../data'
import { SUCURSAL_LABELS } from '../mock-data'
import { PageSkeleton } from '@/app/components/shared/PageSkeleton'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type TabKey = 'contact' | 'conversation' | 'quotes' | 'reservations' | 'notes'

const TABS: { key: TabKey; labelKey: TranslationKey; icon: string }[] = [
  { key: 'contact', labelKey: 'patientDetail.tab.contact', icon: 'solar:user-circle-line-duotone' },
  { key: 'conversation', labelKey: 'patientDetail.tab.conversation', icon: 'solar:chat-round-line-duotone' },
  { key: 'quotes', labelKey: 'patientDetail.tab.quotes', icon: 'solar:bill-list-line-duotone' },
  { key: 'reservations', labelKey: 'patientDetail.tab.reservations', icon: 'solar:calendar-mark-line-duotone' },
  { key: 'notes', labelKey: 'patientDetail.tab.notes', icon: 'solar:notes-line-duotone' },
]

// Lead/funnel status → label + color, shared by the contact + reservations tabs.
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  nuevo: { bg: 'bg-lightinfo', text: 'text-info', dot: 'bg-info', label: 'Nuevo' },
  new: { bg: 'bg-lightinfo', text: 'text-info', dot: 'bg-info', label: 'Nuevo' },
  en_conversacion: { bg: 'bg-lightwarning', text: 'text-warning', dot: 'bg-warning', label: 'En conversación' },
  cotizado: { bg: 'bg-lightsecondary', text: 'text-secondary', dot: 'bg-secondary', label: 'Cotizado' },
  reservado: { bg: 'bg-lightprimary', text: 'text-primary', dot: 'bg-primary', label: 'Reservado' },
  comprobante: { bg: 'bg-lightprimary', text: 'text-primary', dot: 'bg-primary', label: 'Comprobante' },
  comprobante_recibido: { bg: 'bg-lightprimary', text: 'text-primary', dot: 'bg-primary', label: 'Comprobante' },
  confirmado: { bg: 'bg-lightsuccess', text: 'text-success', dot: 'bg-success', label: 'Confirmado' },
  sin_respuesta: { bg: 'bg-muted/60 dark:bg-darkmuted/40', text: 'text-link dark:text-darklink', dot: 'bg-link dark:bg-darklink', label: 'Sin respuesta' },
}

function statusStyle(raw: string) {
  return STATUS_STYLE[raw?.toLowerCase()] ?? {
    bg: 'bg-muted/60 dark:bg-darkmuted/40',
    text: 'text-link dark:text-darklink',
    dot: 'bg-link dark:bg-darklink',
    label: raw || '—',
  }
}

function StatusPill({ status }: { status: string }) {
  const s = statusStyle(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function formatMoney(amount: number, currency: string): string {
  const n = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)
  return currency === 'USD' ? `USD ${n}` : `$${n}`
}

function formatDateTime(iso: string, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatDate(iso: string, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

// ---------- Empty state ----------

function EmptyBlock({ icon, text }: { icon: string; text: string }) {
  return (
    <div className='flex flex-col items-center justify-center text-center gap-2 py-14'>
      <div className='size-14 rounded-full bg-muted/60 dark:bg-darkmuted/40 flex items-center justify-center'>
        <Icon icon={icon} height={26} width={26} className='text-link dark:text-darklink' />
      </div>
      <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{text}</p>
    </div>
  )
}

// ---------- Contact tab ----------

function ContactTab({
  detail,
  onSaved,
  t,
  locale,
}: {
  detail: PatientDetailData
  onSaved: (fullName: string, email: string) => void
  t: TFn
  locale: string
}) {
  const c = detail.contact
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(c.fullName)
  const [email, setEmail] = useState(c.email)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(c.fullName)
    setEmail(c.email)
  }, [c.fullName, c.email])

  async function handleSave() {
    setSaving(true)
    await updatePatientContact(c.id, { fullName: name.trim(), email: email.trim() })
    setSaving(false)
    setEditing(false)
    onSaved(name.trim(), email.trim())
  }

  const rows: { label: string; value: string; editable?: boolean }[] = [
    { label: t('patientDetail.contact.phone'), value: c.phone || '—' },
    { label: t('patientDetail.contact.treatment'), value: c.treatment },
    { label: t('patientDetail.contact.sucursal'), value: c.sucursal ? SUCURSAL_LABELS[c.sucursal as keyof typeof SUCURSAL_LABELS] : '—' },
    { label: t('patientDetail.contact.joined'), value: formatDate(c.createdAt, locale) },
  ]

  return (
    <div className='space-y-6 max-w-2xl'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('patientDetail.contact.title')}</h3>
        {!editing ? (
          <button
            type='button'
            onClick={() => setEditing(true)}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
            <Icon icon='solar:pen-line-duotone' height={15} width={15} />
            {t('patientDetail.contact.edit')}
          </button>
        ) : (
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => { setEditing(false); setName(c.fullName); setEmail(c.email) }}
              className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('patientDetail.contact.cancel')}
            </button>
            <button
              type='button'
              disabled={saving || name.trim().length === 0}
              onClick={handleSave}
              className='px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
              {t('patientDetail.contact.save')}
            </button>
          </div>
        )}
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
        <div>
          <p className='text-xs text-link dark:text-darklink mb-1'>{t('patientDetail.contact.name')}</p>
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          ) : (
            <p className='text-dark dark:text-white'>{c.fullName}</p>
          )}
        </div>
        <div>
          <p className='text-xs text-link dark:text-darklink mb-1'>{t('patientDetail.contact.email')}</p>
          {editing ? (
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('patientDetail.contact.emailPlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          ) : (
            <p className='text-dark dark:text-white'>{c.email || '—'}</p>
          )}
        </div>
        {rows.map((r) => (
          <div key={r.label}>
            <p className='text-xs text-link dark:text-darklink mb-1'>{r.label}</p>
            <p className='text-dark dark:text-white'>{r.value}</p>
          </div>
        ))}
        <div>
          <p className='text-xs text-link dark:text-darklink mb-1'>{t('patientDetail.contact.status')}</p>
          <StatusPill status={detail.reservations[0]?.status ?? 'nuevo'} />
        </div>
      </div>
    </div>
  )
}

// ---------- Conversation tab ----------

function ConversationTab({ detail, t, locale }: { detail: PatientDetailData; t: TFn; locale: string }) {
  if (detail.messages.length === 0) {
    return <EmptyBlock icon='solar:chat-round-line-duotone' text={t('patientDetail.conversation.empty')} />
  }
  return (
    <div className='space-y-3 max-h-[560px] overflow-y-auto pr-1'>
      {detail.messages.map((m) => {
        const out = m.direction === 'out'
        return (
          <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 ${
                out
                  ? 'bg-lightprimary text-dark dark:text-white'
                  : 'bg-muted/50 dark:bg-darkmuted/40 text-dark dark:text-white'
              }`}>
              <p className='text-sm whitespace-pre-wrap break-words'>{m.text}</p>
              <p className='text-[10px] text-link dark:text-darklink mt-1 text-right'>
                {formatDateTime(m.createdAt, locale)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Quotes tab ----------

function QuotesTab({ detail, t, locale }: { detail: PatientDetailData; t: TFn; locale: string }) {
  if (detail.quotes.length === 0) {
    return <EmptyBlock icon='solar:bill-list-line-duotone' text={t('patientDetail.quotes.empty')} />
  }
  return (
    <div className='space-y-2'>
      {detail.quotes.map((q) => (
        <div key={q.id} className='flex items-center justify-between gap-3 rounded-md border border-border dark:border-darkborder p-3'>
          <div className='min-w-0'>
            <p className='text-sm font-medium text-dark dark:text-white truncate'>{q.treatment}</p>
            <p className='text-xs text-link dark:text-darklink'>{formatDateTime(q.createdAt, locale)}</p>
          </div>
          <p className='text-sm font-semibold text-dark dark:text-white shrink-0'>{formatMoney(q.amount, q.currency)}</p>
        </div>
      ))}
    </div>
  )
}

// ---------- Reservations tab ----------

function ReservationsTab({ detail, t, locale }: { detail: PatientDetailData; t: TFn; locale: string }) {
  if (detail.reservations.length === 0) {
    return <EmptyBlock icon='solar:calendar-mark-line-duotone' text={t('patientDetail.reservations.empty')} />
  }
  return (
    <div className='space-y-3'>
      <p className='text-xs text-link dark:text-darklink flex items-start gap-1.5'>
        <Icon icon='solar:info-circle-line-duotone' height={14} width={14} className='mt-0.5 shrink-0' />
        {t('patientDetail.reservations.note')}
      </p>
      {detail.reservations.map((r) => (
        <div key={r.id} className='flex items-center justify-between gap-3 rounded-md border border-border dark:border-darkborder p-3'>
          <div className='min-w-0'>
            <StatusPill status={r.status} />
            <p className='text-xs text-link dark:text-darklink mt-1.5'>
              {t('patientDetail.reservations.since', { date: formatDate(r.createdAt, locale) })}
            </p>
          </div>
          {r.lastActivity && (
            <p className='text-xs text-link dark:text-darklink shrink-0'>
              {t('patientDetail.reservations.lastActivity', { date: formatDateTime(r.lastActivity, locale) })}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------- Notes tab ----------

function NotesTab({
  patientId,
  notes,
  onAdded,
  t,
  locale,
}: {
  patientId: string
  notes: PatientNote[]
  onAdded: (note: PatientNote) => void
  t: TFn
  locale: string
}) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    const body = draft.trim()
    if (!body) return
    setSaving(true)
    const { note } = await addPatientNote(patientId, body)
    setSaving(false)
    if (note) {
      onAdded(note)
      setDraft('')
    }
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-md border border-border dark:border-darkborder p-3'>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('patientDetail.notes.placeholder')}
          rows={2}
          className='w-full resize-none bg-transparent text-sm text-dark dark:text-white focus:outline-none'
        />
        <div className='flex justify-end mt-2'>
          <button
            type='button'
            disabled={saving || draft.trim().length === 0}
            onClick={handleAdd}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
            <Icon icon='solar:add-circle-line-duotone' height={15} width={15} />
            {t('patientDetail.notes.add')}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyBlock icon='solar:notes-line-duotone' text={t('patientDetail.notes.empty')} />
      ) : (
        <div className='space-y-2'>
          {notes.map((n) => (
            <div key={n.id} className='rounded-md border border-border dark:border-darkborder p-3'>
              <p className='text-sm text-dark dark:text-white whitespace-pre-wrap break-words'>{n.body}</p>
              <p className='text-xs text-link dark:text-darklink mt-2'>
                {n.author} · {formatDateTime(n.createdAt, locale)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Not found ----------

function NotFoundState({ t }: { t: TFn }) {
  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-16 flex flex-col items-center text-center gap-3'>
      <div className='size-16 rounded-full bg-lightprimary/60 flex items-center justify-center'>
        <Icon icon='solar:user-cross-line-duotone' height={32} width={32} className='text-primary' />
      </div>
      <p className='text-base font-semibold text-dark dark:text-white'>{t('patientDetail.notFound.title')}</p>
      <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('patientDetail.notFound.body')}</p>
      <Link href='/pacientes' className='mt-1 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
        {t('patientDetail.notFound.back')}
      </Link>
    </div>
  )
}

// ---------- Main ----------

export function PatientDetail({ id }: { id: string }) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [detail, setDetail] = useState<PatientDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('contact')

  useEffect(() => {
    let active = true
    void fetchPatientDetail(id).then(({ data, error }) => {
      if (!active) return
      setDetail(data)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  const counts = useMemo(
    () => ({
      conversation: detail?.messages.length ?? 0,
      quotes: detail?.quotes.length ?? 0,
      reservations: detail?.reservations.length ?? 0,
      notes: detail?.notes.length ?? 0,
    }),
    [detail]
  )

  if (loading) return <PageSkeleton />
  if (loadError) {
    return (
      <div className='rounded-lg border border-border dark:border-darkborder bg-card p-16 flex flex-col items-center text-center gap-3'>
        <div className='size-16 rounded-full bg-lighterror/60 flex items-center justify-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
        </div>
        <p className='text-base font-semibold text-dark dark:text-white'>{t('patientDetail.error.title')}</p>
        <p className='text-sm text-link dark:text-darklink max-w-[360px]'>{t('patientDetail.error.body')}</p>
      </div>
    )
  }
  if (!detail) return <NotFoundState t={t} />

  function handleContactSaved(fullName: string, email: string) {
    setDetail((prev) => (prev ? { ...prev, contact: { ...prev.contact, fullName, email } } : prev))
  }
  function handleNoteAdded(note: PatientNote) {
    setDetail((prev) => (prev ? { ...prev, notes: [note, ...prev.notes] } : prev))
  }

  const c = detail.contact

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <button
          type='button'
          onClick={() => router.push('/pacientes')}
          aria-label={t('patientDetail.back')}
          className='h-10 w-10 inline-flex items-center justify-center rounded-md border border-border dark:border-darkborder text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
          <Icon icon='tabler:arrow-left' height={18} width={18} />
        </button>
        <div className='h-12 w-12 rounded-full bg-lightprimary text-primary flex items-center justify-center text-base font-bold shrink-0'>
          {c.fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'}
        </div>
        <div className='min-w-0'>
          <h1 className='text-xl font-semibold text-dark dark:text-white leading-tight truncate'>{c.fullName}</h1>
          <div className='flex items-center gap-1.5 text-xs text-link dark:text-darklink mt-1'>
            <Link href='/pacientes' className='hover:text-primary transition-colors'>{t('patientDetail.breadcrumb')}</Link>
            <Icon icon='tabler:chevron-right' height={12} width={12} />
            <span className='text-dark dark:text-white font-medium truncate'>{c.fullName}</span>
          </div>
        </div>
      </div>

      {/* Card with tabs */}
      <div className='rounded-lg border border-border dark:border-darkborder bg-card overflow-hidden'>
        <div className='border-b border-border dark:border-darkborder overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
          <div className='inline-flex'>
            {TABS.map((tb) => {
              const active = tb.key === tab
              const count = (counts as Record<string, number>)[tb.key]
              return (
                <button
                  key={tb.key}
                  type='button'
                  onClick={() => setTab(tb.key)}
                  className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-link dark:text-darklink hover:text-primary'
                  }`}>
                  <Icon icon={tb.icon} height={17} width={17} />
                  {t(tb.labelKey)}
                  {count > 0 && (
                    <span className='inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-muted/60 dark:bg-darkmuted/40 text-[10px] font-semibold'>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className='p-5 sm:p-6'>
          {tab === 'contact' && <ContactTab detail={detail} onSaved={handleContactSaved} t={t} locale={locale} />}
          {tab === 'conversation' && <ConversationTab detail={detail} t={t} locale={locale} />}
          {tab === 'quotes' && <QuotesTab detail={detail} t={t} locale={locale} />}
          {tab === 'reservations' && <ReservationsTab detail={detail} t={t} locale={locale} />}
          {tab === 'notes' && (
            <NotesTab patientId={c.id} notes={detail.notes} onAdded={handleNoteAdded} t={t} locale={locale} />
          )}
        </div>
      </div>
    </div>
  )
}
