'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import CardBox from '../shared/CardBox'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
import {
  fetchCalendarEvents,
  getCurrentUserId,
  STATUS_COLORS,
  type CalendarEvent,
  type TurnoStatus,
} from '@/lib/data/calendar-events'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { fetchSucursalHours } from '@/lib/data/sucursal-hours'
import { getTreatmentColorBySlug } from '@/lib/treatment-colors'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function sucursalLabel(s: string | null): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}
function greetingKey(hour: number | null): TranslationKey {
  if (hour === null) return 'greeting.hello'
  if (hour < 12) return 'greeting.morning'
  if (hour < 20) return 'greeting.afternoon'
  return 'greeting.evening'
}
function statusLabelKey(s: TurnoStatus): TranslationKey {
  const map: Record<TurnoStatus, TranslationKey> = {
    reservado: 'agenda.status.reserved',
    pendiente: 'agenda.status.pending',
    confirmado: 'agenda.status.confirmed',
    atendido: 'agenda.status.attended',
    ausente: 'agenda.status.absent',
    cancelado: 'agenda.status.cancelled',
  }
  return map[s]
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
    primary ? 'bg-primary text-white hover:bg-primaryemphasis' : 'border border-border dark:border-darkborder text-dark dark:text-white hover:bg-lightprimary/40'
  }`
  if (href) return <Link href={href} className={cls}>{label}</Link>
  return <button type='button' onClick={onClick} className={cls}>{label}</button>
}

export function ProfesionalDashboard() {
  const { t } = useTranslation()
  const { name } = useCurrentUser()
  const [hour, setHour] = useState<number | null>(null)
  const [turnos, setTurnos] = useState<CalendarEvent[]>([])
  const [sucursal, setSucursal] = useState<string | null>(null)
  const [todayHours, setTodayHours] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => setHour(new Date().getHours()), [])

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: events }, { data: users }, myId] = await Promise.all([
        fetchCalendarEvents(),
        fetchAppUsers(),
        getCurrentUserId(),
      ])
      if (!active) return
      const mySuc = users.find((u) => u.id === myId)?.sucursal ?? null
      setSucursal(mySuc)

      const now = new Date()
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      // RLS already scopes a profesional to their own turnos; filter defensively too.
      setTurnos(
        events.filter(
          (e) => e.start <= dayEnd && e.end >= dayStart && (!myId || e.professionalId === myId),
        ),
      )
      setLoading(false)

      if (mySuc) {
        const hrs = await fetchSucursalHours(mySuc as 'caballito' | 'merlo' | 'moreno')
        if (!active) return
        const today = hrs.find((h) => h.weekday === now.getDay())
        setTodayHours(today && today.isOpen ? `${today.open} a ${today.close}` : t('autoGestion.horarios.closed'))
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [t])

  const suc = sucursalLabel(sucursal)
  const hello = t(greetingKey(hour))

  const c = useMemo(() => {
    const by = (s: TurnoStatus) => turnos.filter((x) => x.status === s).length
    const atendido = by('atendido')
    return {
      total: turnos.length,
      confirmado: by('confirmado'),
      pendiente: by('pendiente') + by('reservado'),
      atendido,
      remaining: turnos.length - atendido,
    }
  }, [turnos])

  const load = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of turnos) {
      const slug = x.treatmentSlug || 'other'
      m.set(slug, (m.get(slug) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [turnos])

  // Section-2 clinical tiles. The first four are real (from today's turnos);
  // the last two are Etapa 2/3 modules → shown disabled.
  const tiles = [
    { icon: 'solar:check-circle-line-duotone', label: t('opDash.confirmedTurns'), value: c.confirmado, color: '#13deb9' },
    { icon: 'solar:clock-circle-line-duotone', label: t('proDash.pending'), value: c.pendiente, color: '#ffae1f' },
    { icon: 'solar:check-read-line-duotone', label: t('opDash.attended'), value: c.atendido, color: '#5d87ff' },
    { icon: 'solar:clipboard-list-line-duotone', label: t('proDash.fichasPend'), value: c.atendido, color: '#fa896b' },
    { icon: 'solar:pen-new-square-line-duotone', label: t('proDash.consentsPend'), value: null, color: '#7c4dff', stage: 'Etapa 3' },
    { icon: 'solar:gallery-line-duotone', label: t('proDash.evolutionsPend'), value: null, color: '#8a94a6', stage: 'Etapa 2' },
  ]

  // Section-3 clinical task queue (Fichas/Consentimientos/Evoluciones arrive in
  // Etapa 3; actions open an "in development" note for now).
  const tasks = [
    { icon: 'solar:clipboard-list-line-duotone', color: '#fa896b', label: t('proDash.task.fichas'), sub: t('proDash.task.fichasSub'), count: String(c.atendido), action: t('proDash.action.open') },
    { icon: 'solar:pen-new-square-line-duotone', color: '#ffae1f', label: t('proDash.task.consents'), sub: t('proDash.task.consentsSub'), count: '', action: t('proDash.action.view'), stage: true },
    { icon: 'solar:users-group-rounded-line-duotone', color: '#7c4dff', label: t('proDash.task.followup'), sub: t('proDash.task.followupSub'), count: '', action: t('proDash.action.view'), stage: true },
    { icon: 'solar:gallery-line-duotone', color: '#8a94a6', label: t('proDash.task.evolutions'), sub: t('proDash.task.evolutionsSub'), count: '', action: t('proDash.action.stage2'), stage: true },
  ]

  return (
    <div className='space-y-5'>
      {/* 1 · Header */}
      <div className='flex items-start justify-between gap-4 flex-wrap'>
        <div className='min-w-0'>
          <h1 className='text-xl sm:text-2xl font-semibold text-dark dark:text-white'>
            {name ? `${hello}, ${name}.` : `${hello}.`}
          </h1>
          <div className='mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-link dark:text-darklink'>
            <span className='inline-flex items-center gap-1.5'>
              <Icon icon='solar:users-group-rounded-line-duotone' height={16} width={16} className='text-primary' />
              {t('proDash.patientsToday', { n: String(c.total) })}
            </span>
            {suc && (
              <span className='inline-flex items-center gap-1.5'>
                <Icon icon='solar:map-point-line-duotone' height={16} width={16} className='text-primary' />
                {suc}{todayHours ? ` · ${todayHours}` : ''}
              </span>
            )}
            <span className='inline-flex items-center gap-1.5'>
              <Icon icon='solar:clipboard-list-line-duotone' height={16} width={16} className='text-primary' />
              {t('proDash.fichasToComplete', { n: String(c.atendido) })}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Icon icon='solar:pen-new-square-line-duotone' height={16} width={16} className='text-primary' />
              {t('proDash.consentsToSign', { n: '0' })}
            </span>
          </div>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          <ActionBtn label={t('proDash.completeFicha')} onClick={() => underDev(t('proDash.completeFicha'), t)} primary />
          <ActionBtn label={t('proDash.myAgenda')} href='/agenda' />
          <ActionBtn label={t('proDash.myPatients')} onClick={() => underDev(t('proDash.myPatients'), t)} />
        </div>
      </div>

      {/* 2 · Mi jornada clínica */}
      <CardBox>
        <div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
          <SectionTitle n={2}>{t('proDash.journeyTitle')}</SectionTitle>
          <span className='text-xs text-link dark:text-darklink'>{t('proDash.noCommercial')}</span>
        </div>
        <div className='grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3'>
          {tiles.map((tl, i) => (
            <div
              key={i}
              className={`rounded-lg border border-border dark:border-darkborder p-3 text-center ${tl.stage ? 'opacity-60' : ''}`}
              style={tl.stage ? undefined : { backgroundColor: `${tl.color}12` }}>
              <div className='flex justify-center mb-1.5'>
                <div className='h-9 w-9 rounded-full flex items-center justify-center' style={{ backgroundColor: `${tl.color}26`, color: tl.color }}>
                  <Icon icon={tl.icon} height={18} width={18} />
                </div>
              </div>
              <p className='text-xs font-medium text-dark dark:text-white'>{tl.label}</p>
              {tl.stage ? (
                <p className='text-xs font-semibold text-link dark:text-darklink'>{tl.stage}</p>
              ) : (
                <p className='text-lg font-bold' style={{ color: tl.color }}>{loading ? '…' : tl.value}</p>
              )}
            </div>
          ))}
        </div>
      </CardBox>

      {/* 3 · Mis tareas clínicas */}
      <CardBox>
        <div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
          <SectionTitle n={3}>
            {t('proDash.tasksTitle')}
            <span className='ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-lighterror text-error text-[11px] font-bold'>{tasks.length}</span>
          </SectionTitle>
          <span className='text-xs text-link dark:text-darklink'>{t('opDash.byPriority')}</span>
        </div>
        <div className='divide-y divide-border dark:divide-darkborder'>
          {tasks.map((tk, i) => (
            <div key={i} className={`flex items-center gap-3 py-2.5 ${tk.stage ? 'opacity-60' : ''}`}>
              <span className='w-1 self-stretch rounded-full shrink-0' style={{ backgroundColor: tk.color }} />
              <span className='h-8 w-8 rounded-md flex items-center justify-center shrink-0' style={{ backgroundColor: `${tk.color}1f`, color: tk.color }}>
                <Icon icon={tk.icon} height={16} width={16} />
              </span>
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-medium text-dark dark:text-white truncate'>{tk.label}</div>
                <div className='text-xs text-link dark:text-darklink truncate'>{tk.sub}</div>
              </div>
              {tk.count && <span className='text-sm font-bold text-dark dark:text-white shrink-0 w-8 text-right'>{tk.count}</span>}
              <button
                type='button'
                onClick={() => underDev(tk.label, t)}
                className='shrink-0 px-3 py-1.5 rounded-md bg-lightprimary text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors'>
                {tk.action}
              </button>
            </div>
          ))}
        </div>
        <p className='text-[11px] text-link dark:text-darklink mt-3 flex items-start gap-1.5'>
          <Icon icon='solar:info-circle-line-duotone' height={13} width={13} className='mt-0.5 shrink-0' />
          {t('proDash.tasksNote')}
        </p>
      </CardBox>

      {/* 4 · Mi día de un vistazo + carga del día */}
      <CardBox>
        <SectionTitle n={4}>{t('proDash.glanceSection')}</SectionTitle>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
            <GlanceTile value={c.total} label={t('proDash.patientsTodayTile')} tint='bg-lightprimary text-primary' />
            <GlanceTile value={c.atendido} label={t('proDash.attendedTile')} tint='bg-lightsuccess text-success' />
            <GlanceTile value={c.remaining} label={t('proDash.remaining')} tint='bg-lightwarning text-warning' />
            <div className='rounded-md border border-dashed border-border dark:border-darkborder p-3 flex flex-col justify-center opacity-70'>
              <div className='text-sm font-semibold text-dark dark:text-white'>{t('proDash.noEconomic')}</div>
              <div className='text-[11px] text-link dark:text-darklink'>{t('proDash.noEconomicNote')}</div>
            </div>
          </div>
          <div>
            <p className='text-xs font-medium text-link dark:text-darklink mb-2'>{t('opDash.loadTitle')}</p>
            {load.length === 0 ? (
              <p className='text-sm text-link dark:text-darklink italic'>{t('agenda.empty')}</p>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {load.map(([slug, n]) => {
                  const col = getTreatmentColorBySlug(slug)
                  return (
                    <span key={slug} className='inline-flex items-center gap-1.5 rounded-full border border-border dark:border-darkborder px-2.5 py-1 text-xs'>
                      <span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: col.hex }} />
                      <span className='font-semibold text-dark dark:text-white'>{n}</span>
                      <span className='text-link dark:text-darklink'>{t(col.labelKey as TranslationKey)}</span>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </CardBox>

      {/* 5 · Mi agenda del día */}
      <CardBox>
        <div className='flex items-start justify-between mb-3 gap-3 flex-wrap'>
          <div>
            <SectionTitle n={5}>{t('proDash.agendaTitle')}</SectionTitle>
            <p className='text-xs text-link dark:text-darklink'>{t('proDash.agendaSub')}</p>
          </div>
          <Link href='/agenda' className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
            {t('proDash.openMyAgenda')}
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
              const col = getTreatmentColorBySlug(x.treatmentSlug || 'other')
              const bg = STATUS_COLORS[x.status]
              return (
                <div key={x.id} className='flex items-center gap-3 rounded-md overflow-hidden pr-3 py-2' style={{ backgroundColor: `${bg}1f` }}>
                  <span className='w-1.5 self-stretch shrink-0' style={{ backgroundColor: col.hex }} />
                  <span className='flex-1 min-w-0 text-sm font-medium text-dark dark:text-white truncate pl-1'>{x.patientName || x.title}</span>
                  <span className='shrink-0 text-xs font-medium' style={{ color: bg }}>{t(statusLabelKey(x.status))}</span>
                  <button
                    type='button'
                    onClick={() => underDev(t('proDash.action.ficha'), t)}
                    className='shrink-0 px-3 py-1.5 rounded-md bg-lightprimary text-primary text-sm font-medium hover:bg-primary hover:text-white transition-colors'>
                    {x.status === 'atendido' ? t('proDash.action.completeFicha') : t('proDash.action.ficha')}
                  </button>
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

export default ProfesionalDashboard
