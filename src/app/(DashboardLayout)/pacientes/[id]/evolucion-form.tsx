'use client'

import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchTreatmentPrices } from '@/lib/data/treatment-prices'
import { fetchAppUsers } from '@/app/(DashboardLayout)/usuarios/data'
import {
  createEvolucion,
  updateEvolucion,
  closeEvolucion,
  type Evolucion,
} from '@/lib/data/evoluciones'
import { getCurrentUserId } from '@/lib/data/calendar-events'
import { useCurrentUser } from '@/lib/auth/useCurrentUser'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type Option = { value: string; label: string }

const FIELD_CLS =
  'w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'

function isoToDateInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dateInputToIso(dateStr: string): string | undefined {
  if (!dateStr) return undefined
  return new Date(`${dateStr}T00:00:00`).toISOString()
}
function todayInput(): string {
  return isoToDateInput(new Date().toISOString())
}

// Create a draft evolution or edit an existing one, then optionally sign+close.
export function EvolucionForm({
  open,
  onClose,
  onSaved,
  patientId,
  evolucion,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  patientId: string
  evolucion: Evolucion | null
}) {
  const { t } = useTranslation() as { t: TFn }
  const { role } = useCurrentUser()
  const isProfesional = role === 'profesional'
  const editing = !!evolucion

  const [treatments, setTreatments] = useState<Option[]>([])
  const [professionals, setProfessionals] = useState<Option[]>([])
  const [treatmentSlug, setTreatmentSlug] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [notes, setNotes] = useState('')
  const [nextFollowup, setNextFollowup] = useState('')
  const [saving, setSaving] = useState(false)

  // Lookups + field init whenever the dialog opens for a (new/edit) record.
  useEffect(() => {
    if (!open) return
    void fetchTreatmentPrices().then(({ data }) =>
      setTreatments(data.map((p) => ({ value: p.slug, label: p.displayName }))),
    )
    void fetchAppUsers().then(({ data }) =>
      setProfessionals(
        data.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: u.fullName })),
      ),
    )
    setTreatmentSlug(evolucion?.treatmentSlug ?? '')
    setSessionDate(evolucion ? isoToDateInput(evolucion.sessionDate) : todayInput())
    setNotes(evolucion?.notes ?? '')
    setNextFollowup(evolucion?.nextFollowup ?? '')
    // A profesional can only file their own record (RLS) — lock it to them.
    if (isProfesional) {
      void getCurrentUserId().then((uid) => setProfessionalId(uid ?? ''))
    } else {
      setProfessionalId(evolucion?.professionalId ?? '')
    }
  }, [open, evolucion, isProfesional])

  function draft() {
    return {
      patientId,
      treatmentSlug: treatmentSlug || null,
      professionalId: professionalId || null,
      sessionDate: dateInputToIso(sessionDate),
      notes: notes.trim() || null,
      nextFollowup: nextFollowup || null,
    }
  }

  // Persist (create or update) and return the record id, or null on error.
  async function persist(): Promise<string | null> {
    if (editing && evolucion) {
      const { error } = await updateEvolucion(evolucion.id, draft())
      if (error) {
        await Swal.fire({ icon: 'error', title: t('ficha.form.saveError'), text: error })
        return null
      }
      return evolucion.id
    }
    const { id, error } = await createEvolucion(draft())
    if (error || !id) {
      await Swal.fire({ icon: 'error', title: t('ficha.form.saveError'), text: error ?? '' })
      return null
    }
    return id
  }

  async function handleSaveDraft() {
    setSaving(true)
    const id = await persist()
    setSaving(false)
    if (id) {
      onSaved()
      onClose()
    }
  }

  async function handleSignClose() {
    const confirm = await Swal.fire({
      icon: 'question',
      title: t('ficha.form.closeConfirmTitle'),
      text: t('ficha.form.closeConfirmText'),
      showCancelButton: true,
      confirmButtonText: t('ficha.form.close'),
      cancelButtonText: t('ficha.form.cancel'),
      confirmButtonColor: '#5d87ff',
    })
    if (!confirm.isConfirmed) return
    setSaving(true)
    const id = await persist()
    if (id) {
      const { error } = await closeEvolucion(id)
      if (error) {
        setSaving(false)
        await Swal.fire({ icon: 'error', title: t('ficha.form.saveError'), text: error })
        return
      }
    }
    setSaving(false)
    if (id) {
      onSaved()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {editing ? t('ficha.form.editTitle') : t('ficha.form.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-3'>
          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>
              {t('ficha.form.treatment')}
            </label>
            <select
              value={treatmentSlug}
              onChange={(e) => setTreatmentSlug(e.target.value)}
              className={FIELD_CLS}>
              <option value=''>{t('ficha.form.none')}</option>
              {treatments.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {!isProfesional && (
            <div>
              <label className='block text-xs font-medium text-dark dark:text-white mb-1'>
                {t('ficha.form.professional')}
              </label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className={FIELD_CLS}>
                <option value=''>{t('ficha.form.none')}</option>
                {professionals.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>
              {t('ficha.form.date')}
            </label>
            <input
              type='date'
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className={FIELD_CLS}
            />
          </div>

          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>
              {t('ficha.form.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className={FIELD_CLS}
              placeholder={t('ficha.form.notesPlaceholder')}
            />
          </div>

          <div>
            <label className='block text-xs font-medium text-dark dark:text-white mb-1'>
              {t('ficha.form.followup')}
            </label>
            <input
              type='date'
              value={nextFollowup}
              onChange={(e) => setNextFollowup(e.target.value)}
              className={FIELD_CLS}
            />
          </div>
        </div>

        <div className='mt-4 flex items-center justify-end gap-2'>
          <button
            type='button'
            onClick={handleSaveDraft}
            disabled={saving}
            className='px-3 py-2 rounded-md text-sm font-medium border border-border dark:border-darkborder text-dark dark:text-white hover:border-primary disabled:opacity-50 transition-colors'>
            {t('ficha.form.saveDraft')}
          </button>
          <button
            type='button'
            onClick={handleSignClose}
            disabled={saving}
            className='px-3 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors'>
            {t('ficha.form.close')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
