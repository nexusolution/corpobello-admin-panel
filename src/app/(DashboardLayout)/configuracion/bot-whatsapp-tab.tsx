'use client'

import { useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import {
  INITIAL_BOT_SETTINGS,
  BOT_TIMEOUT_OPTIONS,
  type BotSettings,
  type BotTimeout,
} from './mock-data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const TIMEOUT_LABEL_KEYS: Record<BotTimeout, TranslationKey> = {
  '5min': 'configuracion.bot.timeout.5min',
  '15min': 'configuracion.bot.timeout.15min',
  '30min': 'configuracion.bot.timeout.30min',
  '1h': 'configuracion.bot.timeout.1h',
  '4h': 'configuracion.bot.timeout.4h',
}

const TAG_KEYS: { tag: string; labelKey: TranslationKey; sample: string }[] = [
  { tag: '{nombre}', labelKey: 'configuracion.bot.welcome.tag.name', sample: 'Ana' },
  { tag: '{clínica}', labelKey: 'configuracion.bot.welcome.tag.clinic', sample: 'Corpo Bello' },
  { tag: '{sucursal}', labelKey: 'configuracion.bot.welcome.tag.sucursal', sample: 'Caballito' },
]

function isDarkMode(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
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

function showUnderDevAlert(itemName: string, t: TFn) {
  const isDark = isDarkMode()
  Swal.fire({
    title: t('alerts.underDevelopmentTitle'),
    text: t('alerts.underDevelopmentBody', { section: itemName }),
    icon: 'info',
    iconColor: '#5d87ff',
    confirmButtonText: t('alerts.underDevelopmentButton'),
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-1 [&_.swal2-icon-content]:!text-2xl',
      confirmButton: '!text-sm !px-4 !py-1.5',
      popup: '!rounded-lg',
    },
  })
}

function renderPreview(template: string): string {
  let out = template
  for (const { tag, sample } of TAG_KEYS) out = out.split(tag).join(sample)
  return out
}

export function BotWhatsappTab() {
  const { t } = useTranslation()
  const [initial, setInitial] = useState<BotSettings>(INITIAL_BOT_SETTINGS)
  const [draft, setDraft] = useState<BotSettings>(INITIAL_BOT_SETTINGS)
  const welcomeRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = useMemo(
    () => JSON.stringify(initial) !== JSON.stringify(draft),
    [initial, draft]
  )

  function insertTag(tag: string) {
    const el = welcomeRef.current
    if (!el) {
      setDraft({ ...draft, welcomeMessage: `${draft.welcomeMessage} ${tag}`.trim() })
      return
    }
    const startPos = el.selectionStart ?? draft.welcomeMessage.length
    const endPos = el.selectionEnd ?? draft.welcomeMessage.length
    const before = draft.welcomeMessage.slice(0, startPos)
    const after = draft.welcomeMessage.slice(endPos)
    const newValue = `${before}${tag}${after}`
    setDraft({ ...draft, welcomeMessage: newValue })
    // After re-render, restore caret position right after the inserted tag
    setTimeout(() => {
      if (welcomeRef.current) {
        const newPos = startPos + tag.length
        welcomeRef.current.focus()
        welcomeRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }

  function handleSave() {
    if (!isDirty) return
    setInitial(draft)
    showSavedToast(t)
  }

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        {/* ---------- Left column ---------- */}
        <div className='space-y-5'>
          {/* Conexión de WhatsApp */}
          <div className='rounded-md border border-border dark:border-darkborder p-5'>
            <div className='flex items-center justify-between mb-3 gap-2'>
              <h3 className='text-base font-semibold text-dark dark:text-white'>
                {t('configuracion.bot.connection.title')}
              </h3>
              {draft.connected && (
                <span className='inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-lightsuccess text-success text-xs font-medium'>
                  <span className='h-1.5 w-1.5 rounded-full bg-success' />
                  {t('configuracion.bot.connection.connected')}
                </span>
              )}
            </div>

            <div className='flex items-center gap-3 mb-4'>
              <div className='size-16 rounded-md border-2 border-dashed border-border dark:border-darkborder flex items-center justify-center text-xs text-link dark:text-darklink shrink-0'>
                {t('configuracion.bot.connection.qrPlaceholder')}
              </div>
              <div className='flex-1 min-w-0 text-xs text-link dark:text-darklink'>
                <p>{t('configuracion.bot.connection.connected')}</p>
                <p className='truncate mt-0.5 text-dark dark:text-white font-medium'>
                  {draft.connectedNumber}
                </p>
              </div>
              <button
                type='button'
                onClick={() => showUnderDevAlert(t('configuracion.bot.connection.reconnect'), t)}
                className='px-3 py-1.5 rounded-md border border-border dark:border-darkborder text-sm font-medium text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors shrink-0'>
                {t('configuracion.bot.connection.reconnect')}
              </button>
            </div>

            <div>
              <Label className='font-medium mb-1.5 block'>
                {t('configuracion.bot.connection.connectedNumber')}
              </Label>
              <input
                type='tel'
                value={draft.connectedNumber}
                onChange={(e) => setDraft({ ...draft, connectedNumber: e.target.value })}
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
            </div>
          </div>

          {/* Comportamiento del bot */}
          <div className='rounded-md border border-border dark:border-darkborder p-5'>
            <h3 className='text-base font-semibold text-dark dark:text-white mb-4'>
              {t('configuracion.bot.behavior.title')}
            </h3>

            <div className='space-y-3'>
              <ToggleRow
                label={t('configuracion.bot.behavior.auto247')}
                checked={draft.auto247}
                onCheckedChange={(v) => setDraft({ ...draft, auto247: v })}
              />
              <ToggleRow
                label={t('configuracion.bot.behavior.handoff')}
                checked={draft.handoffOnBooking}
                onCheckedChange={(v) => setDraft({ ...draft, handoffOnBooking: v })}
              />
              <ToggleRow
                label={t('configuracion.bot.behavior.survey')}
                checked={draft.surveyAfterAppointment}
                onCheckedChange={(v) => setDraft({ ...draft, surveyAfterAppointment: v })}
              />
            </div>

            <div className='mt-4'>
              <Label className='font-medium mb-1.5 block'>
                {t('configuracion.bot.behavior.timeout')}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type='button'
                    className='w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm font-medium text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
                    <span>{t(TIMEOUT_LABEL_KEYS[draft.timeout])}</span>
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
                  className='w-[var(--radix-dropdown-menu-trigger-width)]'>
                  {BOT_TIMEOUT_OPTIONS.map((opt) => {
                    const isSelected = opt === draft.timeout
                    return (
                      <DropdownMenuItem
                        key={opt}
                        onClick={() => setDraft({ ...draft, timeout: opt })}
                        className={
                          isSelected
                            ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                            : ''
                        }>
                        {t(TIMEOUT_LABEL_KEYS[opt])}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ---------- Right column ---------- */}
        <div className='space-y-5'>
          {/* Mensaje de bienvenida */}
          <div className='rounded-md border border-border dark:border-darkborder p-5'>
            <h3 className='text-base font-semibold text-dark dark:text-white mb-3'>
              {t('configuracion.bot.welcome.title')}
            </h3>
            <textarea
              ref={welcomeRef}
              value={draft.welcomeMessage}
              onChange={(e) => setDraft({ ...draft, welcomeMessage: e.target.value })}
              placeholder={t('configuracion.bot.welcome.placeholder')}
              rows={6}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors resize-y min-h-[140px]'
            />
            <div className='flex flex-wrap gap-2 mt-3'>
              {TAG_KEYS.map(({ tag, labelKey }) => (
                <button
                  key={tag}
                  type='button'
                  onClick={() => insertTag(tag)}
                  className='inline-flex items-center px-2.5 py-1 rounded-md bg-lightprimary text-primary text-xs font-medium hover:bg-primary hover:text-white transition-colors'>
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Vista previa */}
          <div className='rounded-md border border-border dark:border-darkborder p-5 bg-muted/30 dark:bg-darkmuted/20'>
            <h3 className='text-xs font-semibold text-link dark:text-darklink uppercase tracking-wide mb-3'>
              {t('configuracion.bot.welcome.preview')}
            </h3>
            <div className='flex items-start gap-2'>
              <div className='h-8 w-8 rounded-full bg-lightsuccess text-success flex items-center justify-center shrink-0'>
                <Icon icon='ic:baseline-whatsapp' height={16} width={16} />
              </div>
              <div className='flex-1 rounded-md rounded-tl-none bg-card border border-border dark:border-darkborder px-3 py-2 text-sm text-dark dark:text-white whitespace-pre-wrap break-words'>
                {renderPreview(draft.welcomeMessage) || (
                  <span className='text-link dark:text-darklink italic'>
                    {t('configuracion.bot.welcome.placeholder')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer save bar */}
      <div className='flex items-center justify-between gap-3 flex-wrap pt-2'>
        <span className='text-xs text-link dark:text-darklink italic'>
          {t('configuracion.bot.footer.hint')}
        </span>
        <button
          type='button'
          onClick={handleSave}
          disabled={!isDirty}
          className='px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
          {t('configuracion.bot.footer.save')}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <label className='flex items-center justify-between gap-3 cursor-pointer'>
      <span className='text-sm text-dark dark:text-white'>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}