'use client'

import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  fetchConsentTemplates,
  createConsent,
  type ConsentTemplate,
} from '@/lib/data/consents'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import { getCurrentUserId } from '@/lib/data/calendar-events'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }

const FIELD =
  'w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

// Create a pending consent from a template (text snapshotted into the consent).
export function ConsentForm({
  open,
  onClose,
  onSaved,
  patientId,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  patientId: string
}) {
  const { t } = useTranslation() as { t: TFn }
  const { role } = useCurrentUser()
  const isProfesional = role === 'profesional'

  const [templates, setTemplates] = useState<ConsentTemplate[]>([])
  const [professionals, setProfessionals] = useState<Option[]>([])
  const [templateId, setTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [treatmentSlug, setTreatmentSlug] = useState<string | null>(null)
  const [professionalId, setProfessionalId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTemplateId('')
    setTitle('')
    setBody('')
    setTreatmentSlug(null)
    void fetchConsentTemplates(true).then(({ data }) => setTemplates(data))
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: u.fullName })),
      ),
    )
    if (isProfesional) {
      void getCurrentUserId().then((uid) => setProfessionalId(uid ?? ''))
    } else {
      setProfessionalId('')
    }
  }, [open, isProfesional])

  function pickTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find((x) => x.id === id)
    if (tpl) {
      setTitle(tpl.title)
      setBody(tpl.body)
      setTreatmentSlug(tpl.treatmentSlug)
    }
  }

  async function save() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    const { error } = await createConsent({
      patientId,
      title: title.trim(),
      body: body.trim(),
      treatmentSlug,
      professionalId: professionalId || null,
    })
    setSaving(false)
    if (error) {
      await Swal.fire({ icon: 'error', title: t('consent.saveError'), text: error })
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('consent.newTitle')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-3'>
          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('consent.template')}</label>
            <select value={templateId} onChange={(e) => pickTemplate(e.target.value)} className={FIELD}>
              <option value=''>{t('consent.templatePlaceholder')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.title}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className='mt-1 text-xs text-warning'>{t('consent.noTemplates')}</p>
            )}
          </div>

          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('consent.title')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
          </div>

          {!isProfesional && (
            <div>
              <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('consent.professional')}</label>
              <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={FIELD}>
                <option value=''>{t('consent.none')}</option>
                {professionals.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>{t('consent.body')}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className={FIELD} />
          </div>
        </div>

        <div className='mt-4 flex items-center justify-end gap-2'>
          <button type='button' onClick={onClose} className='px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
            {t('consent.cancel')}
          </button>
          <button type='button' onClick={save} disabled={saving || !title.trim() || !body.trim()} className='px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors'>
            {t('consent.create')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
