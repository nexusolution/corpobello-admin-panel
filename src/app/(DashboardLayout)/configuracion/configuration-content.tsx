'use client'

import { useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import {
  INITIAL_CLINIC_SETTINGS,
  TIMEZONE_OPTIONS,
  CURRENCY_OPTIONS,
  type ClinicSettings,
} from './mock-data'
import { ServicesTab } from './services-tab'
import { BotWhatsappTab } from './bot-whatsapp-tab'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const TABS: { key: string; labelKey: TranslationKey }[] = [
  { key: 'clinic', labelKey: 'configuracion.tab.clinic' },
  { key: 'branches', labelKey: 'configuracion.tab.branches' },
  { key: 'services', labelKey: 'configuracion.tab.services' },
  { key: 'bot', labelKey: 'configuracion.tab.bot' },
  { key: 'templates', labelKey: 'configuracion.tab.templates' },
]

// ---------- SweetAlert helpers ----------

function isDarkMode(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
}

async function confirmDiscardChanges(t: TFn): Promise<boolean> {
  const isDark = isDarkMode()
  const result = await Swal.fire({
    title: t('configuracion.discardConfirm.title'),
    text: t('configuracion.discardConfirm.body'),
    icon: 'warning',
    iconColor: '#ffae1f',
    iconHtml:
      '<span style="font-size:30px;line-height:1;color:#ffae1f;font-weight:700;">!</span>',
    showCancelButton: true,
    confirmButtonText: t('configuracion.discardConfirm.yes'),
    cancelButtonText: t('configuracion.discardConfirm.no'),
    confirmButtonColor: '#5d87ff',
    cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1.5rem 1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0 !mt-3',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-2',
      actions: '!gap-2 !mt-5',
      confirmButton: '!text-sm !px-4 !py-1.5 !rounded-md',
      cancelButton: `!text-sm !px-4 !py-1.5 !rounded-md ${
        isDark ? '!text-white' : '!text-dark'
      }`,
      popup: '!rounded-lg',
    },
  })
  return result.isConfirmed
}

function showSavedToast(t: TFn) {
  const isDark = isDarkMode()
  Swal.fire({
    title: t('configuracion.saved.toast'),
    icon: 'success',
    iconColor: '#13deb9',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    customClass: {
      title: '!text-sm !font-medium !pb-0',
      popup: '!rounded-lg',
    },
  })
}

// ---------- Reusable bits ----------

type SectionTint = 'primary' | 'success' | 'warning' | 'error'

const SECTION_TINT: Record<SectionTint, { bg: string; text: string }> = {
  primary: { bg: 'bg-lightprimary', text: 'text-primary' },
  success: { bg: 'bg-lightsuccess', text: 'text-success' },
  warning: { bg: 'bg-lightwarning', text: 'text-warning' },
  error: { bg: 'bg-lighterror', text: 'text-error' },
}

function SectionHeader({
  icon,
  title,
  subtitle,
  tint,
}: {
  icon: string
  title: string
  subtitle?: string
  tint: SectionTint
}) {
  const style = SECTION_TINT[tint]
  return (
    <div className='flex items-start gap-3 mb-4'>
      <div className={`size-9 shrink-0 rounded-md flex items-center justify-center ${style.bg}`}>
        <Icon icon={icon} height={18} width={18} className={style.text} />
      </div>
      <div className='min-w-0'>
        <h3 className='text-sm font-semibold text-dark dark:text-white leading-tight'>{title}</h3>
        {subtitle && (
          <p className='text-xs text-link dark:text-darklink mt-0.5 leading-tight'>{subtitle}</p>
        )}
      </div>
    </div>
  )
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'tel'
}) {
  return (
    <div>
      <Label className='font-medium mb-1.5 block'>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
      />
    </div>
  )
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <Label className='font-medium mb-1.5 block'>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm font-medium text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
            <span className='truncate text-left'>{value}</span>
            <Icon
              icon='tabler:chevron-down'
              height={14}
              width={14}
              className='text-link dark:text-darklink shrink-0'
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          className='w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto'>
          {options.map((opt) => {
            const isSelected = opt === value
            return (
              <DropdownMenuItem
                key={opt}
                onClick={() => onChange(opt)}
                className={
                  isSelected
                    ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                    : ''
                }>
                {opt}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ---------- Clinic tab ----------

function ClinicTab({
  draft,
  setDraft,
  t,
}: {
  draft: ClinicSettings
  setDraft: (next: ClinicSettings) => void
  t: TFn
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setDraft({ ...draft, logoUrl: result })
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      {/* Left column — Datos de la clínica */}
      <div className='space-y-5'>
        <SectionHeader
          icon='solar:buildings-3-line-duotone'
          title={t('configuracion.clinic.section.info')}
          subtitle={t('configuracion.clinic.section.info.subtitle')}
          tint='primary'
        />

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
          <FieldInput
            label={t('configuracion.clinic.field.name')}
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
            placeholder={t('configuracion.clinic.field.namePlaceholder')}
          />
          <FieldInput
            label={t('configuracion.clinic.field.phone')}
            value={draft.phone}
            onChange={(v) => setDraft({ ...draft, phone: v })}
            placeholder={t('configuracion.clinic.field.phonePlaceholder')}
            type='tel'
          />
        </div>

        <FieldInput
          label={t('configuracion.clinic.field.email')}
          value={draft.email}
          onChange={(v) => setDraft({ ...draft, email: v })}
          placeholder={t('configuracion.clinic.field.emailPlaceholder')}
          type='email'
        />

        <FieldInput
          label={t('configuracion.clinic.field.address')}
          value={draft.address}
          onChange={(v) => setDraft({ ...draft, address: v })}
          placeholder={t('configuracion.clinic.field.addressPlaceholder')}
        />

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
          <FieldSelect
            label={t('configuracion.clinic.field.timezone')}
            value={draft.timezone}
            options={TIMEZONE_OPTIONS}
            onChange={(v) => setDraft({ ...draft, timezone: v })}
          />
          <FieldSelect
            label={t('configuracion.clinic.field.currency')}
            value={draft.currency}
            options={CURRENCY_OPTIONS}
            onChange={(v) => setDraft({ ...draft, currency: v })}
          />
        </div>
      </div>

      {/* Right column — Identidad + Horario */}
      <div className='space-y-6'>
        <div>
          <SectionHeader
            icon='solar:pallete-2-line-duotone'
            title={t('configuracion.clinic.section.identity')}
            subtitle={t('configuracion.clinic.section.identity.subtitle')}
            tint='warning'
          />
          <div className='flex items-start gap-4'>
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              className='size-24 border-2 border-dashed border-border dark:border-darkborder rounded-md flex items-center justify-center text-link dark:text-darklink text-xs hover:border-primary hover:text-primary transition-colors overflow-hidden shrink-0'>
              {draft.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.logoUrl}
                  alt='logo'
                  className='size-full object-contain'
                />
              ) : (
                t('configuracion.clinic.logo.placeholder')
              )}
            </button>
            <div className='flex-1 min-w-0'>
              <p className='text-sm text-link dark:text-darklink'>
                {t('configuracion.clinic.logo.hint')}
              </p>
              {draft.logoUrl && (
                <button
                  type='button'
                  onClick={() => setDraft({ ...draft, logoUrl: undefined })}
                  className='inline-flex items-center gap-1 mt-2 text-xs text-error hover:underline'>
                  <Icon icon='tabler:x' height={14} width={14} />
                  {t('configuracion.clinic.logo.remove')}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type='file'
              accept='.png,.svg,image/png,image/svg+xml'
              className='hidden'
              onChange={handleLogoFile}
            />
          </div>
        </div>

        <div>
          <SectionHeader
            icon='solar:clock-circle-line-duotone'
            title={t('configuracion.clinic.section.schedule')}
            subtitle={t('configuracion.clinic.section.schedule.subtitle')}
            tint='success'
          />
          <div className='space-y-3 rounded-md border border-border dark:border-darkborder p-4'>
            <ScheduleRow
              label={t('configuracion.clinic.schedule.weekdays')}
              value={draft.schedule.weekdays}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  schedule: { ...draft.schedule, weekdays: v },
                })
              }
              t={t}
            />
            <ScheduleRow
              label={t('configuracion.clinic.schedule.saturday')}
              value={draft.schedule.saturday}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  schedule: { ...draft.schedule, saturday: v },
                })
              }
              t={t}
            />
            <ScheduleRow
              label={t('configuracion.clinic.schedule.sunday')}
              value={draft.schedule.sunday}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  schedule: { ...draft.schedule, sunday: v },
                })
              }
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ScheduleRow({
  label,
  value,
  onChange,
  t,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  t: TFn
}) {
  return (
    <div className='flex items-center gap-3'>
      <Label className='font-medium text-sm w-20 shrink-0'>{label}</Label>
      <input
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('configuracion.clinic.schedule.placeholder')}
        className='flex-1 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
      />
    </div>
  )
}

// ---------- Coming-soon placeholder for non-clinic tabs ----------

function ComingSoonTab({ t }: { t: TFn }) {
  return (
    <div className='flex flex-col items-center justify-center text-center py-16 px-4 gap-3'>
      <div className='size-16 rounded-full bg-lightprimary text-primary flex items-center justify-center'>
        <Icon icon='solar:hammer-line-duotone' height={32} width={32} />
      </div>
      <h3 className='text-base font-semibold text-dark dark:text-white'>
        {t('configuracion.comingSoon.title')}
      </h3>
      <p className='text-sm text-link dark:text-darklink max-w-md'>
        {t('configuracion.comingSoon.body')}
      </p>
    </div>
  )
}

// ---------- Main client component ----------

export function ConfigurationContent() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>('clinic')
  const [initial, setInitial] = useState<ClinicSettings>(INITIAL_CLINIC_SETTINGS)
  const [draft, setDraft] = useState<ClinicSettings>(INITIAL_CLINIC_SETTINGS)

  const isDirty = useMemo(
    () => JSON.stringify(initial) !== JSON.stringify(draft),
    [initial, draft]
  )

  async function handleDiscard() {
    if (!isDirty) return
    const ok = await confirmDiscardChanges(t)
    if (ok) setDraft(initial)
  }

  function handleSave() {
    if (!isDirty) return
    // Mock save — just promote draft to initial. Real impl will POST to Supabase.
    setInitial(draft)
    showSavedToast(t)
  }

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card overflow-hidden'>
      {/* Tab bar */}
      <div className='border-b border-border dark:border-darkborder overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
        <div className='inline-flex'>
          {TABS.map((tab) => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type='button'
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-link dark:text-darklink hover:text-primary'
                }`}>
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className='p-5 sm:p-6'>
        {activeTab === 'clinic' ? (
          <ClinicTab draft={draft} setDraft={setDraft} t={t} />
        ) : activeTab === 'services' ? (
          <ServicesTab />
        ) : activeTab === 'bot' ? (
          <BotWhatsappTab />
        ) : (
          <ComingSoonTab t={t} />
        )}
      </div>

      {/* Sticky footer — only active for the clinic tab (the only one with editable state) */}
      {activeTab === 'clinic' && (
        <div className='sticky bottom-0 border-t border-border dark:border-darkborder bg-card px-5 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap'>
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              isDirty
                ? 'text-warning'
                : 'text-link dark:text-darklink'
            }`}>
            <span
              className={`h-2 w-2 rounded-full ${
                isDirty ? 'bg-warning' : 'bg-success'
              }`}
            />
            {isDirty
              ? t('configuracion.footer.dirty')
              : t('configuracion.footer.saved')}
          </span>
          <div className='flex items-center gap-2 ml-auto'>
            <button
              type='button'
              onClick={handleDiscard}
              disabled={!isDirty}
              className='px-4 py-2 rounded-md text-sm font-medium text-dark dark:text-white border border-border dark:border-darkborder hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
              {t('configuracion.footer.discard')}
            </button>
            <button
              type='button'
              onClick={handleSave}
              disabled={!isDirty}
              className='px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
              {t('configuracion.footer.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}