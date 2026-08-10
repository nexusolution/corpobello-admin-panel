'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
import { fetchFunnelCounts, type FunnelCounts } from './data'
import {
  fetchCalendarEvents,
  getCurrentUserId,
  STATUS_COLORS,
  type CalendarEvent,
  type TurnoStatus,
} from '@/lib/data/calendar-events'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { getTreatmentColorBySlug } from '@/lib/treatment-colors'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function sucursalLabel(s: string | null): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function greetingKey(hour: number | null): TranslationKey {
  if (hour === null) return 'greeting.hello'
  if (hour < 12) return 'greeting.morning'
  if (hour < 20) return 'greeting.afternoon'
  return 'greeting.evening'
}

function underDev(name: string, t: TFn) {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  Swal.fire({
    title: t('alerts.underDevelopmentTitle'),
    text: t('alerts.underDevelopmentBody', { section: name }),
    icon: 'info',
    iconColor: '#5d87ff',
    confirmButtonText: t('alerts.underDevelopmentButton'),
    confirmButtonColor: '#5d87ff',
    background: dark ? '#2a3547' : '#ffffff',
    color: dark ? '#ffffff' : '#2a3547',
    width: '360px',
    customClass: { popup: '!rounded-lg', title: '!text-base', htmlContainer: '!text-sm' },
  })
}

// ── Funnel stages (wireframe: Embudo operativo) ───────────────────────────────
const FUNNEL_STAGES: { key: string; labelKey: TranslationKey; icon: string; color: string }[] = [
  { key: 'awaitingPhoto', labelKey: 'dashboard.funnel.awaitingPhoto', icon: 'solar:camera-line-duotone', color: '#ffae1f' },
  { key: 'quoteSent', labelKey: 'dashboard.funnel.quoteSent', icon: 'solar:bill-list-line-duotone', color: '#fa896b' },
  { key: 'awaitingDeposit', labelKey: 'dashboard.funnel.awaitingDeposit', icon: 'solar:wallet-money-line-duotone', color: '#ec4899' },
  { key: 'preReservation', labelKey: 'dashboard.funnel.preReservation', icon: 'solar:calendar-mark-line-duotone', color: '#7c4dff' },
  { key: 'confirmed', labelKey: 'dashboard.funnel.confirmed', icon: 'solar:check-circle-line-duotone', color: '#13deb9' },
  { key: 'attended', labelKey: 'dashboard.funnel.attended', icon: 'solar:check-read-line-duotone', color: '#5d87ff' },
]

// ── Work queue (wireframe: Mi cola de trabajo). MOCK rows — the actions
// (verify deposit, register charge, sign consent) map to modules that arrive in
// Etapa 3/4, so the buttons open an "in development" note for now. ──────────────
type QueueItem = {
  id: string
  priority: string // left bar color
  dot: string // task colour
  labelKey: TranslationKey
  params?: Record<string, string>
  when: string
  actionKey: TranslationKey
}
const QUEUE: QueueItem[] = [
  { id: 'q1', priority: '#fa896b', dot: '#ffae1f', labelKey: 'opDash.task.verifyDeposit', when: 'hace 2 h', actionKey: 'opDash.action.verify' },
  { id: 'q2', priority: '#fa896b', dot: '#fa896b', labelKey: 'opDash.task.confirmAttendance', params: { time: '15:00' }, when: 'hoy', actionKey: 'opDash.action.confirm' },
  { id: 'q3', priority: '#ffae1f', dot: '#539bff', labelKey: 'opDash.task.replyWhatsapp', when: '1 h 40', actionKey: 'opDash.action.reply' },
  { id: 'q4', priority: '#ffae1f', dot: '#13deb9', labelKey: 'opDash.task.registerCharge', params: { amount: '$ 18.000' }, when: '13:00', actionKey: 'opDash.action.register' },
  { id: 'q5', priority: '#8a94a6', dot: '#ffae1f', labelKey: 'opDash.task.signConsent', when: '', actionKey: 'opDash.action.sign' },
]

// Small building blocks -------------------------------------------------------
function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className='flex items-center gap-2 mb-3'>
      <span className='inline-flex items-center justify-center h-5 min-w-5 px-1 rounded bg-lightprimary text-primary text-[11px] font-bold'>{n}</span>
      <h5 className='text-sm font-semibold text-dark dark:text-white'>{children}</h5>
    </div>
  )
}

function ActionBtn({ label, onClick, href, primary }: { label: string; onClick?: () => void; href?: string; primary?: boolean }) {
  const cls = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    primary
      ? 'bg-primary text-white hover:bg-primaryemphasis'
      : 'border border-border dark:border-darkborder text-dark dark:text-white hover:bg-lightprimary/40'
  }`
  if (href) return <Link href={href} className={cls}>{label}</Link>
  return <button type='button' onClick={onClick} className={cls}>{label}</button>
}

export function OperadorDashboard() {
  const { t } = useTranslation()
  const { name } = useCurrentUser()
  const [hour, setHour] = useState<number | null>(null)
  const [funnel, setFunnel] = useState<FunnelCounts | null>(null)
  const [turnos, setTurnos] = useState<CalendarEvent[]>([])
  const [proMap, setProMap] = useState<Map<string, string>>(new Map())
  const [sucursal, setSucursal] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => setHour(new Date().getHours()), [])

  useEffect(() => {
    let active = true
    async function load() {
      const [funnelRes, { data: events }, { data: users }, myId] = await Promise.all([
        fetchFunnelCounts(),
        fetchCalendarEvents(),
        fetchAppUsers(),
        getCurrentUserId(),
      ])
      if (!active) return
      setFunnel(funnelRes.counts)
      setProMap(new Map(users.map((u) => [u.id, u.fullName])))
      setSucursal(users.find((u) => u.id === myId)?.sucursal ?? null)

      const now = new Date()
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      setTurnos(events.filter((e) => e.start <= dayEnd && e.end >= dayStart))
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const suc = sucursalLabel(sucursal)
  const hello = t(greetingKey(hour))

  const glance = useMemo(() => {
    const by = (s: TurnoStatus) => turnos.filter((x) => x.status === s).length
    return {
      total: turnos.length,
      confirmado: by('confirmado'),
      cancelado: by('cancelado'),
      atendido: by('atendido'),
      pendiente: by('pendiente') + by('reservado'),
      chargesToRegister: turnos.filter((x) => x.status === 'atendido' && !x.charged).length,
    }
  }, [turnos])

  // Carga del día por tratamiento (grouped counts).
  const load = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of turnos) {
      const slug = x.treatmentSlug || 'other'
      m.set(slug, (m.get(slug) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [turnos])

  const funnelCount = (k: string) => (funnel ? funnel[k] ?? 0 : 0)

  return (
    <div className='space-y-5'>
      {/* 1 · Header ------------------------------------------------------------ */}
      <div className='flex items-start justify-between gap-4 flex-wrap'>
        <div className='min-w-0'>
          <h1 className='text-xl sm:text-2xl font-semibold text-dark dark:text-white'>
            {name ? `${hello}, ${name}.` : `${hello}.`}
          </h1>
          <div className='mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-link dark:text-darklink'>
            {suc && (
              <span className='inline-flex items-center gap-1.5'>
                <Icon icon='solar:map-point-line-duotone' height={16} width={16} className='text-primary' />
                {suc}
              </span>
            )}
            <span className='inline-flex items-center gap-1.5'>
              <Icon icon='solar:calendar-mark-line-duotone' height={16} width={16} className='text-primary' />
              {t('opDash.turnosHoy', { n: String(glance.total) })}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Icon icon='solar:clipboard-check-line-duotone' height={16} width={16} className='text-primary' />
              {t('opDash.toConfirm', { n: String(glance.pendiente) })}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Icon icon='solar:wallet-money-line-duotone' height={16} width={16} className='text-primary' />
              {t('opDash.depositsToReview', { n: String(funnelCount('preReservation')) })}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Icon icon='solar:chat-round-line-duotone' height={16} width={16} className='text-primary' />
              {t('opDash.awaitingReply', { n: String(funnelCount('followUp')) })}
            </span>
          </div>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          <ActionBtn label={t('opDash.newPatient')} href='/pacientes' primary />
          <ActionBtn label={t('opDash.search')} href='/pacientes' />
          <ActionBtn label={t('opDash.whatsapp')} onClick={() => underDev(t('opDash.whatsapp'), t)} />
          <ActionBtn label={t('opDash.charge')} onClick={() => underDev(t('opDash.charge'), t)} />
          <ActionBtn label={t('opDash.import')} href='/importar-pacientes' />
        </div>
      </div>

      {/* 2 · Embudo operativo ------------------------------------------------- */}
      <CardBox>
        <div className='flex items-center justify-between mb-3'>
          <SectionTitle n={2}>{t('opDash.funnelTitle')}{suc ? ` · ${suc}` : ''}</SectionTitle>
          <span className='text-xs text-link dark:text-darklink'>{t('opDash.scrollable')} →</span>
        </div>
        <div className='flex gap-3 overflow-x-auto pb-1'>
          {FUNNEL_STAGES.map((s) => (
            <Link
              key={s.key}
              href={`/kanban?stage=${s.key}`}
              className='shrink-0 w-[150px] rounded-lg border border-border dark:border-darkborder p-3 text-center hover:border-primary transition-colors'
              style={{ backgroundColor: `${s.color}14` }}>
              <div className='flex justify-center mb-1.5'>
                <div className='h-9 w-9 rounded-full flex items-center justify-center' style={{ backgroundColor: `${s.color}26`, color: s.color }}>
                  <Icon icon={s.icon} height={20} width={20} />
                </div>
              </div>
              <p className='text-xs font-medium text-dark dark:text-white'>{t(s.labelKey)}</p>
              <p className='text-lg font-bold' style={{ color: s.color }}>{loading ? '…' : funnelCount(s.key)}</p>
            </Link>
          ))}
        </div>
      </CardBox>

      {/* 3 · Mi cola de trabajo ---------------------------------------------- */}
      <CardBox>
        <div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
          <SectionTitle n={3}>
            {t('opDash.queueTitle')}
            <span className='ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-lighterror text-error text-[11px] font-bold'>{QUEUE.length}</span>
          </SectionTitle>
          <span className='text-xs text-link dark:text-darklink'>{t('opDash.byPriority')}</span>
        </div>
        <div className='divide-y divide-border dark:divide-darkborder'>
          {QUEUE.map((q) => (
            <div key={q.id} className='flex items-center gap-3 py-2.5'>
              <span className='w-1 self-stretch rounded-full shrink-0' style={{ backgroundColor: q.priority }} />
              <span className='h-2.5 w-2.5 rounded-sm shrink-0' style={{ backgroundColor: q.dot }} />
              <span className='flex-1 min-w-0 text-sm text-dark dark:text-white truncate'>
                {t(q.labelKey, q.params)}
              </span>
              <span className='text-xs text-link dark:text-darklink shrink-0 w-16 text-right'>{q.when}</span>
              <button
                type='button'
                onClick={() => underDev(t(q.actionKey), t)}
                className='shrink-0 px-3 py-1.5 rounded-md bg-lightprimary text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors'>
                {t(q.actionKey)}
              </button>
            </div>
          ))}
        </div>
        <p className='text-[11px] text-link dark:text-darklink mt-3 flex items-start gap-1.5'>
          <Icon icon='solar:info-circle-line-duotone' height={13} width={13} className='mt-0.5 shrink-0' />
          {t('opDash.queueNote')}
        </p>
      </CardBox>

      {/* 4 · Mi jornada de un vistazo + carga del día ------------------------- */}
      <CardBox>
        <SectionTitle n={4}>{t('opDash.glanceSection')}</SectionTitle>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
            <GlanceTile value={glance.confirmado} label={t('opDash.confirmedTurns')} tint='bg-lightsuccess text-success' />
            <GlanceTile value={glance.cancelado} label={t('opDash.cancelled')} tint='bg-lighterror text-error' />
            <GlanceTile value={glance.atendido} label={t('opDash.attended')} tint='bg-lightprimary text-primary' />
            <GlanceTile value={glance.chargesToRegister} label={t('opDash.chargesToRegister')} tint='bg-lightwarning text-warning' />
            <div className='rounded-md border border-dashed border-border dark:border-darkborder p-3 flex flex-col justify-center opacity-70'>
              <div className='text-sm font-semibold text-dark dark:text-white'>{t('opDash.cashClose')}</div>
              <div className='text-[11px] text-link dark:text-darklink'>{t('opDash.cashCloseNote')}</div>
            </div>
          </div>
          <div>
            <p className='text-xs font-medium text-link dark:text-darklink mb-2'>{t('opDash.loadTitle')}</p>
            {load.length === 0 ? (
              <p className='text-sm text-link dark:text-darklink italic'>{t('agenda.empty')}</p>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {load.map(([slug, n]) => {
                  const c = getTreatmentColorBySlug(slug)
                  return (
                    <span key={slug} className='inline-flex items-center gap-1.5 rounded-full border border-border dark:border-darkborder px-2.5 py-1 text-xs'>
                      <span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: c.hex }} />
                      <span className='font-semibold text-dark dark:text-white'>{n}</span>
                      <span className='text-link dark:text-darklink'>{t(c.labelKey as TranslationKey)}</span>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </CardBox>

      {/* 5 · Agenda del día -------------------------------------------------- */}
      <CardBox>
        <div className='flex items-start justify-between mb-3 gap-3 flex-wrap'>
          <div>
            <SectionTitle n={5}>{t('opDash.agendaSection')}{suc ? ` · ${suc}` : ''}</SectionTitle>
            <p className='text-xs text-link dark:text-darklink'>{t('opDash.agendaSub', { n: String(glance.total) })}</p>
          </div>
          <Link href='/agenda' className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
            {t('opDash.openFull')}
            <Icon icon='tabler:arrow-up-right' height={14} width={14} />
          </Link>
        </div>
        {loading ? (
          <div className='py-6 flex justify-center'><Icon icon='tabler:loader-2' height={22} width={22} className='text-primary animate-spin' /></div>
        ) : turnos.length === 0 ? (
          <p className='text-sm text-link dark:text-darklink italic py-4'>{t('agenda.empty')}</p>
        ) : (
          <div className='space-y-2'>
            {turnos.map((x) => {
              const c = getTreatmentColorBySlug(x.treatmentSlug || 'other')
              const bg = STATUS_COLORS[x.status]
              return (
                <div key={x.id} className='flex items-center gap-3 rounded-md overflow-hidden pr-3 py-2' style={{ backgroundColor: `${bg}1f` }}>
                  <span className='w-1.5 self-stretch shrink-0' style={{ backgroundColor: c.hex }} />
                  <span className='flex-1 min-w-0 text-sm font-medium text-dark dark:text-white truncate pl-1'>{x.patientName || x.title}</span>
                  {x.professionalId && proMap.get(x.professionalId) && (
                    <span className='hidden sm:block text-xs text-link dark:text-darklink shrink-0'>
                      {t('agenda.with')} {proMap.get(x.professionalId)}
                    </span>
                  )}
                  {x.charged && <span className='shrink-0 text-success font-bold' title={t('agenda.charged')}>$</span>}
                  <AgendaRowAction status={x.status} charged={x.charged} t={t} />
                </div>
              )
            })}
          </div>
        )}
      </CardBox>
    </div>
  )
}

function GlanceTile({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <div className='rounded-md border border-border dark:border-darkborder p-3'>
      <div className={`inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded ${tint} text-sm font-bold mb-1`}>{value}</div>
      <div className='text-xs text-link dark:text-darklink leading-tight'>{label}</div>
    </div>
  )
}

// Per-row reception action, mirroring the wireframe (Cobrar / Confirmar / etc.).
// Opens the full agenda to act (real status/charge edits live there).
function AgendaRowAction({ status, charged, t }: { status: TurnoStatus; charged: boolean; t: TFn }) {
  let label: string | null = null
  if (status === 'atendido' && !charged) label = t('opDash.action.cobrar')
  else if (status === 'pendiente' || status === 'reservado') label = t('opDash.action.confirm')

  if (!label) {
    return (
      <span className='shrink-0 text-xs font-medium' style={{ color: STATUS_COLORS[status] }}>
        {t(`agenda.status.${status === 'confirmado' ? 'confirmed' : status === 'atendido' ? 'attended' : status === 'cancelado' ? 'cancelled' : status === 'ausente' ? 'absent' : status === 'reservado' ? 'reserved' : 'pending'}` as TranslationKey)}
      </span>
    )
  }
  return (
    <Link href='/agenda' className='shrink-0 px-3 py-1.5 rounded-md bg-lightprimary text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors'>
      {label}
    </Link>
  )
}

export default OperadorDashboard
