'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import {
  fetchPatientEvoluciones,
  followupState,
  type Evolucion,
} from '@/lib/data/evoluciones'
import { EvolucionForm } from './evolucion-form'
import { fetchPatientConsents, type Consent } from '@/lib/data/consents'
import { ConsentForm } from './consent-form'
import { ConsentSignDialog } from './consent-sign-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageSkeleton } from '@/app/components/shared/PageSkeleton'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  fetchTags,
  fetchEntityTags,
  assignTag,
  unassignTag,
  type Tag,
} from '@/lib/data/tags'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type TabKey = 'contact' | 'conversation' | 'quotes' | 'reservations' | 'ficha' | 'consents' | 'notes'

const TABS: { key: TabKey; labelKey: TranslationKey; icon: string }[] = [
  { key: 'contact', labelKey: 'patientDetail.tab.contact', icon: 'solar:user-circle-line-duotone' },
  { key: 'conversation', labelKey: 'patientDetail.tab.conversation', icon: 'solar:chat-round-line-duotone' },
  { key: 'quotes', labelKey: 'patientDetail.tab.quotes', icon: 'solar:bill-list-line-duotone' },
  { key: 'reservations', labelKey: 'patientDetail.tab.reservations', icon: 'solar:calendar-mark-line-duotone' },
  { key: 'ficha', labelKey: 'patientDetail.tab.ficha', icon: 'solar:notebook-line-duotone' },
  { key: 'consents', labelKey: 'patientDetail.tab.consents', icon: 'solar:document-add-line-duotone' },
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
    label: raw || '',
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
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatDate(iso: string, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
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

// A single read-only field: icon chip + label + value, with an optional
// copy-to-clipboard affordance. Renders a muted placeholder when empty.
function InfoRow({
  icon,
  label,
  value,
  copyable,
  action,
  t,
}: {
  icon: string
  label: string
  value: string
  copyable?: string
  action?: ReactNode
  t: TFn
}) {
  const [copied, setCopied] = useState(false)
  const has = value.trim().length > 0

  async function copy() {
    if (!copyable) return
    try {
      await navigator.clipboard.writeText(copyable)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className='group flex items-center gap-3 py-3'>
      <div className='size-9 rounded-lg bg-lightprimary/60 dark:bg-lightprimary/20 flex items-center justify-center shrink-0'>
        <Icon icon={icon} height={18} width={18} className='text-primary' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-xs text-link dark:text-darklink'>{label}</p>
        {has ? (
          <p className='text-sm font-medium text-dark dark:text-white mt-0.5 break-words'>{value}</p>
        ) : (
          <p className='text-sm text-link/70 dark:text-darklink/70 mt-0.5 italic'>{t('patientDetail.contact.empty')}</p>
        )}
      </div>
      <div className='flex items-center gap-1 shrink-0'>
        {action}
        {copyable && has && (
          <button
            type='button'
            onClick={copy}
            aria-label={t('patientDetail.contact.copy')}
            title={copied ? t('patientDetail.contact.copied') : t('patientDetail.contact.copy')}
            className='h-8 w-8 inline-flex items-center justify-center rounded-md text-link dark:text-darklink opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted/50 hover:text-primary transition-all'>
            <Icon icon={copied ? 'solar:check-circle-line-duotone' : 'solar:copy-line-duotone'} height={16} width={16} className={copied ? 'text-success' : ''} />
          </button>
        )}
      </div>
    </div>
  )
}

// Small labelled input used inside the personal-details card while editing.
function EditField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className='text-xs text-link dark:text-darklink'>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='mt-1 w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all'
      />
    </div>
  )
}

function ContactTab({
  detail,
  onSaved,
  t,
  locale,
}: {
  detail: PatientDetailData
  onSaved: (fullName: string, email: string, dni: string) => void
  t: TFn
  locale: string
}) {
  const c = detail.contact
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(c.fullName)
  const [email, setEmail] = useState(c.email)
  const [dni, setDni] = useState(c.dni)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(c.fullName)
    setEmail(c.email)
    setDni(c.dni)
  }, [c.fullName, c.email, c.dni])

  async function handleSave() {
    setSaving(true)
    await updatePatientContact(c.id, {
      fullName: name.trim(),
      email: email.trim(),
      dni: dni.trim(),
    })
    setSaving(false)
    setEditing(false)
    onSaved(name.trim(), email.trim(), dni.trim())
  }

  const waDigits = (c.phone || '').replace(/\D/g, '')
  const sucursal = c.sucursal ? SUCURSAL_LABELS[c.sucursal as keyof typeof SUCURSAL_LABELS] : ''
  const status = detail.reservations[0]?.status ?? 'nuevo'

  return (
    <div className='space-y-5 max-w-3xl'>
      {/* Quick contact actions */}
      {!editing && (
        <div className='flex flex-wrap items-center gap-2'>
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-lightsuccess text-success text-sm font-medium hover:bg-success hover:text-white transition-colors'>
              <Icon icon='tabler:brand-whatsapp' height={17} width={17} />
              {t('patientDetail.contact.whatsappAction')}
            </a>
          )}
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className='inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-lightprimary text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors'>
              <Icon icon='solar:letter-line-duotone' height={17} width={17} />
              {t('patientDetail.contact.emailAction')}
            </a>
          )}
        </div>
      )}

      {/* Personal details */}
      <section className='rounded-xl border border-border dark:border-darkborder bg-background/40'>
        <div className='flex items-center justify-between gap-2 px-4 py-3 border-b border-border dark:border-darkborder'>
          <div className='flex items-center gap-2'>
            <Icon icon='solar:user-circle-line-duotone' height={18} width={18} className='text-primary' />
            <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('patientDetail.contact.personalInfo')}</h3>
          </div>
          {!editing ? (
            <button
              type='button'
              onClick={() => setEditing(true)}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 hover:border-primary hover:text-primary transition-colors'>
              <Icon icon='solar:pen-line-duotone' height={15} width={15} />
              {t('patientDetail.contact.edit')}
            </button>
          ) : (
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() => { setEditing(false); setName(c.fullName); setEmail(c.email); setDni(c.dni) }}
                className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
                {t('patientDetail.contact.cancel')}
              </button>
              <button
                type='button'
                disabled={saving || name.trim().length === 0}
                onClick={handleSave}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
                {saving && <Icon icon='solar:refresh-line-duotone' height={14} width={14} className='animate-spin' />}
                {t('patientDetail.contact.save')}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 p-4'>
            <div className='sm:col-span-2'>
              <EditField label={t('patientDetail.contact.name')} value={name} onChange={setName} />
            </div>
            <EditField label={t('patientDetail.contact.email')} value={email} onChange={setEmail} type='email' placeholder={t('patientDetail.contact.emailPlaceholder')} />
            <EditField label={t('patientDetail.contact.dni')} value={dni} onChange={setDni} placeholder={t('patientDetail.contact.dniPlaceholder')} />
          </div>
        ) : (
          <div className='px-4 divide-y divide-border dark:divide-darkborder'>
            <InfoRow icon='solar:user-line-duotone' label={t('patientDetail.contact.name')} value={c.fullName} copyable={c.fullName} t={t} />
            <InfoRow icon='solar:letter-line-duotone' label={t('patientDetail.contact.email')} value={c.email || ''} copyable={c.email} t={t} />
            <InfoRow icon='solar:card-line-duotone' label={t('patientDetail.contact.dni')} value={c.dni || ''} copyable={c.dni} t={t} />
            <InfoRow
              icon='tabler:brand-whatsapp'
              label={t('patientDetail.contact.phone')}
              value={c.phone || ''}
              copyable={c.phone}
              t={t}
            />
          </div>
        )}
      </section>

      {/* Activity / commercial */}
      <section className='rounded-xl border border-border dark:border-darkborder bg-background/40'>
        <div className='flex items-center gap-2 px-4 py-3 border-b border-border dark:border-darkborder'>
          <Icon icon='solar:pulse-line-duotone' height={18} width={18} className='text-primary' />
          <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('patientDetail.contact.activityInfo')}</h3>
        </div>
        <div className='px-4 divide-y divide-border dark:divide-darkborder'>
          <InfoRow icon='solar:heart-pulse-line-duotone' label={t('patientDetail.contact.treatment')} value={c.treatment} t={t} />
          <InfoRow icon='solar:map-point-line-duotone' label={t('patientDetail.contact.sucursal')} value={sucursal} t={t} />
          <InfoRow icon='solar:calendar-add-line-duotone' label={t('patientDetail.contact.joined')} value={formatDate(c.createdAt, locale)} t={t} />
          <div className='flex items-center gap-3 py-3'>
            <div className='size-9 rounded-lg bg-lightprimary/60 dark:bg-lightprimary/20 flex items-center justify-center shrink-0'>
              <Icon icon='solar:filter-line-duotone' height={18} width={18} className='text-primary' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='text-xs text-link dark:text-darklink'>{t('patientDetail.contact.status')}</p>
              <div className='mt-1'>
                <StatusPill status={status} />
              </div>
            </div>
          </div>
        </div>
      </section>
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

// ---------- Ficha clínica tab (Etapa 3) ----------

// Turn a treatment slug into readable text WITHOUT a hyphen (panel rule: no
// dashes). 'depilacion-laser' → 'Depilacion laser'.
function prettySlug(slug: string | null): string {
  if (!slug) return ''
  const spaced = slug.replace(/-/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function FollowupChip({ dateStr, t, locale }: { dateStr: string; t: TFn; locale: string }) {
  const st = followupState(dateStr)
  if (!st) return null
  const map = {
    vencido: { cls: 'bg-lighterror text-error', key: 'ficha.followup.overdue' as TranslationKey },
    proximo: { cls: 'bg-lightwarning text-warning', key: 'ficha.followup.soon' as TranslationKey },
    programado: { cls: 'bg-lightprimary text-primary', key: 'ficha.followup.scheduled' as TranslationKey },
  }
  const m = map[st]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      <Icon icon='solar:calendar-line-duotone' height={12} width={12} />
      {t(m.key)} · {formatDate(`${dateStr}T00:00:00`, locale)}
    </span>
  )
}

// One ficha rendered as a column in the side-by-side comparison.
function FichaCompareColumn({ ev, t, locale }: { ev: Evolucion; t: TFn; locale: string }) {
  return (
    <div className='rounded-md border border-border dark:border-darkborder p-3 space-y-2'>
      <p className='text-sm font-semibold text-dark dark:text-white'>
        {ev.treatmentSlug ? prettySlug(ev.treatmentSlug) : t('ficha.session')}
      </p>
      <p className='text-xs text-link dark:text-darklink'>
        {formatDateTime(ev.sessionDate, locale)}
        {ev.professionalName ? ` · ${ev.professionalName}` : ''}
      </p>
      <div>
        <p className='text-[11px] uppercase tracking-wide text-link dark:text-darklink mb-0.5'>
          {t('ficha.form.notes')}
        </p>
        <p className='text-sm text-dark dark:text-white whitespace-pre-wrap break-words'>
          {ev.notes || '—'}
        </p>
      </div>
      {ev.photos && ev.photos.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {ev.photos.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target='_blank'
              rel='noopener noreferrer'
              className='block h-14 w-14 rounded overflow-hidden border border-border dark:border-darkborder'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt='' className='h-full w-full object-cover' />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// Side-by-side comparison of two fichas of the same patient. The profesional
// picks which two to compare (defaults to the two most recent).
function FichaCompareDialog({
  open,
  onClose,
  rows,
  t,
  locale,
}: {
  open: boolean
  onClose: () => void
  rows: Evolucion[]
  t: TFn
  locale: string
}) {
  const [aId, setAId] = useState('')
  const [bId, setBId] = useState('')

  useEffect(() => {
    if (!open) return
    setAId(rows[0]?.id ?? '')
    setBId(rows[1]?.id ?? rows[0]?.id ?? '')
  }, [open, rows])

  const a = rows.find((r) => r.id === aId)
  const b = rows.find((r) => r.id === bId)
  const label = (ev: Evolucion) =>
    `${formatDate(ev.sessionDate, locale)}${ev.treatmentSlug ? ` · ${prettySlug(ev.treatmentSlug)}` : ''}`
  const selectCls =
    'w-full px-2 py-1.5 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('ficha.compare.title')}</DialogTitle>
        </DialogHeader>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <div className='space-y-2'>
            <select value={aId} onChange={(e) => setAId(e.target.value)} className={selectCls}>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>{label(r)}</option>
              ))}
            </select>
            {a && <FichaCompareColumn ev={a} t={t} locale={locale} />}
          </div>
          <div className='space-y-2'>
            <select value={bId} onChange={(e) => setBId(e.target.value)} className={selectCls}>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>{label(r)}</option>
              ))}
            </select>
            {b && <FichaCompareColumn ev={b} t={t} locale={locale} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FichaTab({
  patientId,
  t,
  locale,
}: {
  patientId: string
  t: TFn
  locale: string
}) {
  const [rows, setRows] = useState<Evolucion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Evolucion | null>(null)
  const [prefill, setPrefill] = useState<
    { treatmentSlug?: string; professionalId?: string; notes?: string; nextFollowup?: string } | undefined
  >(undefined)
  const [compareOpen, setCompareOpen] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    return fetchPatientEvoluciones(patientId).then(({ data, error }) => {
      setRows(data)
      setError(error)
      setLoading(false)
    })
  }, [patientId])

  useEffect(() => {
    let active = true
    void fetchPatientEvoluciones(patientId).then(({ data, error }) => {
      if (!active) return
      setRows(data)
      setError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [patientId])

  function openNew() {
    setEditing(null)
    setPrefill(undefined)
    setFormOpen(true)
  }
  // "Copiar de anterior": open a NEW ficha pre-filled from the most recent one
  // (rows are newest-first), so the profesional only edits what changed. Photos,
  // date and turno link are intentionally NOT copied.
  function openCopy() {
    const last = rows[0]
    if (!last) return
    setEditing(null)
    setPrefill({
      ...(last.treatmentSlug ? { treatmentSlug: last.treatmentSlug } : {}),
      ...(last.professionalId ? { professionalId: last.professionalId } : {}),
      ...(last.notes ? { notes: last.notes } : {}),
      ...(last.nextFollowup ? { nextFollowup: last.nextFollowup } : {}),
    })
    setFormOpen(true)
  }
  function openEdit(ev: Evolucion) {
    setEditing(ev)
    setPrefill(undefined)
    setFormOpen(true)
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <span className='text-xs text-link dark:text-darklink'>
          {rows.length > 0 ? t('ficha.count', { n: String(rows.length) }) : ''}
        </span>
        <div className='flex items-center gap-2'>
          {rows.length >= 2 && (
            <button
              type='button'
              onClick={() => setCompareOpen(true)}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border dark:border-darkborder text-dark dark:text-white hover:border-primary hover:text-primary transition-colors'>
              <Icon icon='solar:posts-carousel-horizontal-line-duotone' height={15} width={15} />
              {t('ficha.compare')}
            </button>
          )}
          {rows.length > 0 && (
            <button
              type='button'
              onClick={openCopy}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border dark:border-darkborder text-dark dark:text-white hover:border-primary hover:text-primary transition-colors'>
              <Icon icon='solar:copy-line-duotone' height={15} width={15} />
              {t('ficha.copyPrevious')}
            </button>
          )}
          <button
            type='button'
            onClick={openNew}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors'>
            <Icon icon='tabler:plus' height={15} width={15} />
            {t('ficha.new')}
          </button>
        </div>
      </div>

      {loading ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('ficha.loading')}</p>
      ) : error ? (
        <p className='text-sm text-error italic'>{t('ficha.error')}</p>
      ) : rows.length === 0 ? (
        <EmptyBlock icon='solar:notebook-line-duotone' text={t('ficha.empty')} />
      ) : (
        rows.map((ev) => {
          const closed = ev.status === 'cerrada'
          return (
            <div key={ev.id} className='rounded-md border border-border dark:border-darkborder p-4'>
              <div className='flex items-center justify-between gap-2 mb-1'>
                <p className='text-sm font-medium text-dark dark:text-white truncate'>
                  {ev.treatmentSlug ? prettySlug(ev.treatmentSlug) : t('ficha.session')}
                </p>
                <div className='flex items-center gap-2 shrink-0'>
                  {!closed && (
                    <button
                      type='button'
                      onClick={() => openEdit(ev)}
                      className='text-xs font-medium text-primary hover:underline'>
                      {t('ficha.edit')}
                    </button>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      closed ? 'bg-lightsuccess text-success' : 'bg-lightwarning text-warning'
                    }`}>
                    {closed ? t('ficha.status.closed') : t('ficha.status.draft')}
                  </span>
                </div>
              </div>
              <p className='text-xs text-link dark:text-darklink mb-2'>
                {formatDateTime(ev.sessionDate, locale)}
                {ev.professionalName ? ` · ${ev.professionalName}` : ''}
              </p>
              {ev.notes && (
                <p className='text-sm text-dark dark:text-white whitespace-pre-wrap break-words'>
                  {ev.notes}
                </p>
              )}
              {ev.photos && ev.photos.length > 0 && (
                <div className='mt-2 flex flex-wrap gap-2'>
                  {ev.photos.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='block h-16 w-16 rounded-md overflow-hidden border border-border dark:border-darkborder'>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt='' className='h-full w-full object-cover' />
                    </a>
                  ))}
                </div>
              )}
              <div className='mt-2 flex flex-wrap items-center gap-2'>
                {ev.nextFollowup && (
                  <FollowupChip dateStr={ev.nextFollowup} t={t} locale={locale} />
                )}
                {ev.pdfUrl && (
                  <a
                    href={ev.pdfUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline'>
                    <Icon icon='solar:file-text-line-duotone' height={14} width={14} />
                    {t('ficha.viewComprobante')}
                  </a>
                )}
              </div>
            </div>
          )
        })
      )}

      <EvolucionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void reload()}
        patientId={patientId}
        evolucion={editing}
        {...(prefill && { prefill })}
      />
      <FichaCompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        rows={rows}
        t={t}
        locale={locale}
      />
    </div>
  )
}

// ---------- Consentimientos tab (Etapa 4) ----------

function ConsentsTab({
  patientId,
  t,
  locale,
}: {
  patientId: string
  t: TFn
  locale: string
}) {
  const [rows, setRows] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [signing, setSigning] = useState<Consent | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    return fetchPatientConsents(patientId).then(({ data, error }) => {
      setRows(data)
      setError(error)
      setLoading(false)
    })
  }, [patientId])

  useEffect(() => {
    let active = true
    void fetchPatientConsents(patientId).then(({ data, error }) => {
      if (!active) return
      setRows(data)
      setError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [patientId])

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-end'>
        <button
          type='button'
          onClick={() => setFormOpen(true)}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors'>
          <Icon icon='tabler:plus' height={15} width={15} />
          {t('consent.new')}
        </button>
      </div>

      {loading ? (
        <p className='text-sm text-link dark:text-darklink italic'>{t('consent.loading')}</p>
      ) : error ? (
        <p className='text-sm text-error italic'>{t('consent.error')}</p>
      ) : rows.length === 0 ? (
        <EmptyBlock icon='solar:document-add-line-duotone' text={t('consent.empty')} />
      ) : (
        rows.map((c) => {
          const signed = c.status === 'firmado'
          return (
            <div key={c.id} className='rounded-md border border-border dark:border-darkborder p-4'>
              <div className='flex items-center justify-between gap-2 mb-1'>
                <p className='text-sm font-medium text-dark dark:text-white truncate'>{c.title}</p>
                <div className='flex items-center gap-2 shrink-0'>
                  {!signed && (
                    <button
                      type='button'
                      onClick={() => setSigning(c)}
                      className='text-xs font-medium text-primary hover:underline'>
                      {t('consent.sign.action')}
                    </button>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      signed ? 'bg-lightsuccess text-success' : 'bg-lightwarning text-warning'
                    }`}>
                    {signed ? t('consent.status.signed') : t('consent.status.pending')}
                  </span>
                </div>
              </div>
              <p className='text-xs text-link dark:text-darklink'>
                {formatDateTime(c.createdAt, locale)}
                {c.professionalName ? ` · ${c.professionalName}` : ''}
                {signed && c.signerName ? ` · ${t('consent.signedBy', { name: c.signerName })}` : ''}
              </p>
              {c.pdfUrl && (
                <a
                  href={c.pdfUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline'>
                  <Icon icon='solar:file-text-line-duotone' height={14} width={14} />
                  {t('consent.viewPdf')}
                </a>
              )}
            </div>
          )
        })
      )}

      <ConsentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void reload()}
        patientId={patientId}
      />
      <ConsentSignDialog
        open={!!signing}
        onClose={() => setSigning(null)}
        onSigned={() => void reload()}
        consent={signing}
      />
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

// ---------- Patient tag bar (assign/remove indicator tags) ----------

function PatientTagBar({ patientId, t }: { patientId: string; t: TFn }) {
  const [all, setAll] = useState<Tag[]>([])
  const [assigned, setAssigned] = useState<Tag[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([fetchTags(false), fetchEntityTags('patient', patientId)]).then(
      ([tagsRes, ent]) => {
        if (!active) return
        // Only patient- and general-scope tags are relevant to a patient.
        setAll(tagsRes.data.filter((x) => x.scope === 'patient' || x.scope === 'general'))
        setAssigned(ent)
      }
    )
    return () => {
      active = false
    }
  }, [patientId])

  const assignedIds = new Set(assigned.map((x) => x.id))
  const available = all.filter((x) => !assignedIds.has(x.id))

  async function add(tag: Tag) {
    if (busy) return
    setBusy(true)
    setAssigned((prev) => [...prev, tag])
    const err = await assignTag(tag.id, 'patient', patientId)
    if (err) setAssigned((prev) => prev.filter((x) => x.id !== tag.id))
    setBusy(false)
  }
  async function remove(tag: Tag) {
    if (busy) return
    setBusy(true)
    setAssigned((prev) => prev.filter((x) => x.id !== tag.id))
    const err = await unassignTag(tag.id, 'patient', patientId)
    if (err) setAssigned((prev) => [...prev, tag])
    setBusy(false)
  }

  return (
    <div className='flex items-center gap-2 flex-wrap'>
      {assigned.map((tag) => (
        <span
          key={tag.id}
          style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
          className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'>
          <span className='h-1.5 w-1.5 rounded-full' style={{ backgroundColor: tag.color }} />
          {tag.name}
          <button
            type='button'
            aria-label={`Quitar ${tag.name}`}
            onClick={() => remove(tag)}
            className='ml-0.5 hover:opacity-70'>
            <Icon icon='tabler:x' height={12} width={12} />
          </button>
        </span>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-border dark:border-darkborder text-xs font-medium text-link dark:text-darklink hover:border-primary hover:text-primary transition-colors'>
            <Icon icon='tabler:plus' height={12} width={12} />
            {t('patientDetail.tags.add')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='min-w-[200px] max-h-72 overflow-y-auto'>
          {available.length === 0 ? (
            <div className='px-2 py-2 text-xs text-link dark:text-darklink'>
              {all.length === 0 ? t('patientDetail.tags.none') : t('patientDetail.tags.allAssigned')}
            </div>
          ) : (
            available.map((tag) => (
              <DropdownMenuItem key={tag.id} onClick={() => add(tag)} className='gap-2'>
                <span className='h-2.5 w-2.5 rounded-full shrink-0' style={{ backgroundColor: tag.color }} />
                <span className='truncate'>{tag.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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

  function handleContactSaved(fullName: string, email: string, dni: string) {
    setDetail((prev) => (prev ? { ...prev, contact: { ...prev.contact, fullName, email, dni } } : prev))
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

      {/* Indicator tags */}
      <PatientTagBar patientId={c.id} t={t} />

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
          {tab === 'ficha' && <FichaTab patientId={c.id} t={t} locale={locale} />}
          {tab === 'consents' && <ConsentsTab patientId={c.id} t={t} locale={locale} />}
          {tab === 'notes' && (
            <NotesTab patientId={c.id} notes={detail.notes} onAdded={handleNoteAdded} t={t} locale={locale} />
          )}
        </div>
      </div>
    </div>
  )
}
