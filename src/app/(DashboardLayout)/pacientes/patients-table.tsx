'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'
import { Icon } from '@iconify/react'

import {
  SUCURSAL_LABELS,
  type Patient,
  type PatientStatus,
  type Sucursal,
} from './mock-data'
import { fetchPatients, createPatient, updatePatient, deletePatient, deletePatients } from './data'
import { ImportWizard } from '../importar-pacientes/import-wizard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getTreatmentColor } from '@/lib/treatment-colors'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string
type StatusFilter = 'all' | PatientStatus

// ---------- SweetAlert helpers ----------

function isDarkMode(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
}

function showUnderDevelopmentAlert(itemName: string, t: TFn) {
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

async function confirmDeletePatient(name: string, t: TFn): Promise<boolean> {
  const isDark = isDarkMode()
  const result = await Swal.fire({
    title: t('pacientes.deleteConfirm.title'),
    text: t('pacientes.deleteConfirm.body', { name }),
    icon: 'warning',
    iconColor: '#ef4444',
    iconHtml:
      '<span style="font-size:30px;line-height:1;color:#ef4444;font-weight:700;">!</span>',
    showCancelButton: true,
    confirmButtonText: t('pacientes.deleteConfirm.yes'),
    cancelButtonText: t('pacientes.deleteConfirm.no'),
    confirmButtonColor: '#ef4444',
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

function showDeleteErrorAlert(t: TFn) {
  const isDark = isDarkMode()
  Swal.fire({
    title: t('pacientes.deleteError.title'),
    text: t('pacientes.deleteError.body'),
    icon: 'error',
    iconColor: '#ef4444',
    confirmButtonText: t('pacientes.deleteError.button'),
    confirmButtonColor: '#5d87ff',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '360px',
    padding: '1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-1',
      confirmButton: '!text-sm !px-4 !py-1.5',
      popup: '!rounded-lg',
    },
  })
}

async function confirmBulkDeletePatients(count: number, t: TFn): Promise<boolean> {
  const isDark = isDarkMode()
  const result = await Swal.fire({
    title: t('pacientes.bulkDelete.title'),
    text: t('pacientes.bulkDelete.body', { n: String(count) }),
    icon: 'warning',
    iconColor: '#ef4444',
    iconHtml:
      '<span style="font-size:30px;line-height:1;color:#ef4444;font-weight:700;">!</span>',
    showCancelButton: true,
    confirmButtonText: t('pacientes.bulkDelete.yes', { n: String(count) }),
    cancelButtonText: t('pacientes.deleteConfirm.no'),
    confirmButtonColor: '#ef4444',
    cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
    background: isDark ? '#2a3547' : '#ffffff',
    color: isDark ? '#ffffff' : '#2a3547',
    width: '380px',
    padding: '1.5rem 1rem',
    customClass: {
      title: '!text-base !font-semibold !pb-0 !mt-3',
      htmlContainer: '!text-sm !mt-2',
      icon: '!w-12 !h-12 !mt-2 !mb-2',
      actions: '!gap-2 !mt-5',
      confirmButton: '!text-sm !px-4 !py-1.5 !rounded-md',
      cancelButton: `!text-sm !px-4 !py-1.5 !rounded-md ${isDark ? '!text-white' : '!text-dark'}`,
      popup: '!rounded-lg',
    },
  })
  return result.isConfirmed
}

// ---------- Helpers ----------

function relativeLastVisit(days: number | null, t: TFn): string {
  if (days === null) return t('pacientes.lastVisit.never')
  if (days === 0) return t('pacientes.lastVisit.today')
  if (days === 1) return t('pacientes.lastVisit.yesterday')
  return t('pacientes.lastVisit.daysAgo', { n: String(days) })
}

const STATUS_STYLE: Record<PatientStatus, { bg: string; text: string; dot: string; labelKey: TranslationKey }> = {
  activo: {
    bg: 'bg-lightsuccess',
    text: 'text-success',
    dot: 'bg-success',
    labelKey: 'pacientes.status.activo',
  },
  en_tratamiento: {
    bg: 'bg-lightprimary',
    text: 'text-primary',
    dot: 'bg-primary',
    labelKey: 'pacientes.status.en_tratamiento',
  },
  sin_contacto: {
    bg: 'bg-lightwarning',
    text: 'text-warning',
    dot: 'bg-warning',
    labelKey: 'pacientes.status.sin_contacto',
  },
  archivado: {
    bg: 'bg-muted/60 dark:bg-darkmuted/40',
    text: 'text-link dark:text-darklink',
    dot: 'bg-link dark:bg-darklink',
    labelKey: 'pacientes.status.archivado',
  },
}

// ---------- Search box (collapses to icon when empty/closed) ----------

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className='relative w-full sm:w-[280px]'>
      <Icon
        icon='solar:magnifer-linear'
        height={16}
        width={16}
        className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink pointer-events-none'
      />
      <input
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='w-full pl-9 pr-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
      />
    </div>
  )
}

// ---------- Page-size select (Show [N ▾]) ----------

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const

function PageSizeSelect({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border dark:border-darkborder text-sm text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
          <span>{value}</span>
          <Icon icon='tabler:chevron-down' height={14} width={14} className='text-link dark:text-darklink' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='min-w-[80px]'>
        {PAGE_SIZE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => onChange(opt)}
            className={
              opt === value
                ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                : ''
            }>
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------- New patient dialog ----------

const SUCURSAL_OPTIONS: Sucursal[] = ['caballito', 'merlo', 'moreno']

function NewPatientDialog({
  open,
  onOpenChange,
  onCreated,
  t,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  onCreated: (p: Patient) => void
  t: TFn
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dni, setDni] = useState('')
  const [sucursal, setSucursal] = useState<Sucursal | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (open) {
      setFullName('')
      setPhone('')
      setEmail('')
      setDni('')
      setSucursal('')
      setError(false)
    }
  }, [open])

  const valid = fullName.trim().length > 0 && phone.replace(/\D/g, '').length >= 7

  async function submit() {
    if (!valid) return
    setSaving(true)
    setError(false)
    const { patient, error: err } = await createPatient({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      dni: dni.trim(),
      sucursal: sucursal || null,
    })
    setSaving(false)
    if (err || !patient) {
      setError(true)
      return
    }
    onCreated(patient)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-[460px]'>
        <DialogHeader className='border-b border-border dark:border-darkborder pb-3 mb-2'>
          <DialogTitle className='text-lg text-dark dark:text-white'>{t('pacientes.newDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className='space-y-4 mt-2'>
          <div>
            <Label htmlFor='np-name' className='font-medium mb-1.5 block'>
              {t('pacientes.newDialog.name')} <span className='text-error'>*</span>
            </Label>
            <input
              id='np-name'
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('pacientes.newDialog.namePlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='np-phone' className='font-medium mb-1.5 block'>
                {t('pacientes.newDialog.phone')} <span className='text-error'>*</span>
              </Label>
              <input
                id='np-phone'
                type='tel'
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder='+54 9 11 …'
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
            </div>
            <div>
              <Label htmlFor='np-sucursal' className='font-medium mb-1.5 block'>{t('pacientes.newDialog.sucursal')}</Label>
              <select
                id='np-sucursal'
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value as Sucursal | '')}
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'>
                <option value=''>{t('pacientes.newDialog.sucursalNone')}</option>
                {SUCURSAL_OPTIONS.map((s) => (
                  <option key={s} value={s}>{SUCURSAL_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='np-email' className='font-medium mb-1.5 block'>{t('pacientes.newDialog.email')}</Label>
              <input
                id='np-email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='email@ejemplo.com'
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
            </div>
            <div>
              <Label htmlFor='np-dni' className='font-medium mb-1.5 block'>{t('pacientes.newDialog.dni')}</Label>
              <input
                id='np-dni'
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder='12345678'
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
            </div>
          </div>
          {error && <p className='text-xs text-error'>{t('pacientes.newDialog.error')}</p>}
          <div className='flex items-center justify-end gap-3 pt-1'>
            <button
              type='button'
              onClick={() => onOpenChange(false)}
              className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('pacientes.newDialog.cancel')}
            </button>
            <button
              type='button'
              disabled={!valid || saving}
              onClick={submit}
              className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
              {saving ? t('pacientes.newDialog.saving') : t('pacientes.newDialog.create')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Edit patient dialog ----------

function EditPatientDialog({
  patient,
  onOpenChange,
  onSaved,
  t,
}: {
  patient: Patient | null
  onOpenChange: (next: boolean) => void
  onSaved: (p: Patient) => void
  t: TFn
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [sucursal, setSucursal] = useState<Sucursal | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  // Re-seed the form each time a different patient opens the dialog.
  useEffect(() => {
    if (patient) {
      setFullName(patient.fullName)
      setPhone(patient.phoneFull)
      setSucursal(patient.sucursal ?? '')
      setError(false)
    }
  }, [patient])

  const valid =
    fullName.trim().length > 0 && phone.replace(/\D/g, '').length >= 7

  async function submit() {
    if (!valid || !patient) return
    setSaving(true)
    setError(false)
    const err = await updatePatient(patient.id, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      sucursal: sucursal || null,
    })
    setSaving(false)
    if (err) {
      setError(true)
      return
    }
    onSaved({
      ...patient,
      fullName: fullName.trim(),
      phoneFull: phone.trim(),
      phoneLast4: phone.replace(/\D/g, '').slice(-4),
      sucursal: sucursal || null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={patient !== null} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-[460px]'>
        <DialogHeader className='border-b border-border dark:border-darkborder pb-3 mb-2'>
          <DialogTitle className='text-lg text-dark dark:text-white'>{t('pacientes.editDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className='space-y-4 mt-2'>
          <div>
            <Label htmlFor='ep-name' className='font-medium mb-1.5 block'>
              {t('pacientes.newDialog.name')} <span className='text-error'>*</span>
            </Label>
            <input
              id='ep-name'
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('pacientes.newDialog.namePlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='ep-phone' className='font-medium mb-1.5 block'>
                {t('pacientes.newDialog.phone')} <span className='text-error'>*</span>
              </Label>
              <input
                id='ep-phone'
                type='tel'
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder='+54 9 11 …'
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
              />
            </div>
            <div>
              <Label htmlFor='ep-sucursal' className='font-medium mb-1.5 block'>{t('pacientes.newDialog.sucursal')}</Label>
              <select
                id='ep-sucursal'
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value as Sucursal | '')}
                className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'>
                <option value=''>{t('pacientes.newDialog.sucursalNone')}</option>
                {SUCURSAL_OPTIONS.map((s) => (
                  <option key={s} value={s}>{SUCURSAL_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className='text-xs text-error'>{t('pacientes.editDialog.error')}</p>}
          <div className='flex items-center justify-end gap-3 pt-1'>
            <button
              type='button'
              onClick={() => onOpenChange(false)}
              className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('pacientes.newDialog.cancel')}
            </button>
            <button
              type='button'
              disabled={!valid || saving}
              onClick={submit}
              className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
              {saving ? t('pacientes.editDialog.saving') : t('pacientes.editDialog.save')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Main table ----------

export function PatientsTable() {
  const { t } = useTranslation()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(5)
  const [currentPage, setCurrentPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)

  // Re-fetch after a bulk import so the new rows appear.
  function reloadPatients() {
    void fetchPatients().then(({ data, error }) => {
      setPatients(data)
      setLoadError(error)
    })
  }

  // Load real patients from Supabase on mount. Delete stays local (optimistic)
  // for now; create/edit are still under-development stubs.
  useEffect(() => {
    let active = true
    void fetchPatients().then(({ data, error }) => {
      if (!active) return
      setPatients(data)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  // Tab counts (from raw data, not filtered)
  const counts = useMemo(
    () => ({
      all: patients.length,
      activo: patients.filter((p) => p.status === 'activo').length,
      en_tratamiento: patients.filter((p) => p.status === 'en_tratamiento').length,
      sin_contacto: patients.filter((p) => p.status === 'sin_contacto').length,
      archivado: patients.filter((p) => p.status === 'archivado').length,
    }),
    [patients]
  )

  // Filter + sort by lastVisit ascending (most recent first; never = end)
  const filtered = useMemo(() => {
    let list = patients
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.phoneLast4.includes(q) ||
          p.phoneFull.includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      const av = a.lastVisitDays ?? Number.MAX_SAFE_INTEGER
      const bv = b.lastVisitDays ?? Number.MAX_SAFE_INTEGER
      return av - bv
    })
    return list
  }, [patients, statusFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, filtered.length)
  const paged = filtered.slice(start, end)

  const allOnPageSelected =
    paged.length > 0 && paged.every((p) => selected.has(p.id))

  function togglePageSelection() {
    const next = new Set(selected)
    if (allOnPageSelected) {
      paged.forEach((p) => next.delete(p.id))
    } else {
      paged.forEach((p) => next.add(p.id))
    }
    setSelected(next)
  }
  function toggleRow(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function handleDeletePatient(p: Patient) {
    const ok = await confirmDeletePatient(p.fullName, t)
    if (!ok) return
    // Persist the delete to Supabase FIRST; only drop it from the UI once the
    // DB confirms. A failure (RLS no-op for non-admins, or any error) keeps
    // the row and surfaces an alert instead of silently "deleting" locally.
    const err = await deletePatient(p.id)
    if (err) {
      showDeleteErrorAlert(t)
      return
    }
    setPatients((prev) => prev.filter((x) => x.id !== p.id))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(p.id)
      return next
    })
  }

  // Select-all applies to every row matching the current filters/search (across
  // pages), not just the visible page.
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id))
  const selectedInFilter = filtered.filter((p) => selected.has(p.id)).length

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filtered.forEach((p) => next.delete(p.id))
      } else {
        filtered.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  async function handleBulkDelete() {
    const ids = filtered.filter((p) => selected.has(p.id)).map((p) => p.id)
    if (ids.length === 0) return
    const ok = await confirmBulkDeletePatients(ids.length, t)
    if (!ok) return
    const { deleted, error } = await deletePatients(ids)
    if (error || deleted === 0) {
      showDeleteErrorAlert(t)
      if (deleted === 0) return
    }
    const removed = new Set(ids.slice(0, deleted))
    setPatients((prev) => prev.filter((x) => !removed.has(x.id)))
    setSelected((prev) => {
      const next = new Set(prev)
      removed.forEach((id) => next.delete(id))
      return next
    })
  }

  // Filter tabs config
  const tabs: { value: StatusFilter; labelKey: TranslationKey; count: number; activeClass: string; badgeClass: string }[] = [
    { value: 'all', labelKey: 'pacientes.filter.all', count: counts.all, activeClass: 'bg-lightprimary text-primary', badgeClass: 'bg-lightprimary text-primary' },
    { value: 'activo', labelKey: 'pacientes.filter.active', count: counts.activo, activeClass: 'bg-lightsuccess text-success', badgeClass: 'bg-lightsuccess text-success' },
    { value: 'en_tratamiento', labelKey: 'pacientes.filter.inTreatment', count: counts.en_tratamiento, activeClass: 'bg-lightprimary text-primary', badgeClass: 'bg-lightprimary text-primary' },
    { value: 'sin_contacto', labelKey: 'pacientes.filter.uncontacted', count: counts.sin_contacto, activeClass: 'bg-lightwarning text-warning', badgeClass: 'bg-lightwarning text-warning' },
    { value: 'archivado', labelKey: 'pacientes.filter.archived', count: counts.archivado, activeClass: 'bg-muted/60 text-dark dark:bg-darkmuted/40 dark:text-white', badgeClass: 'bg-muted/60 text-link dark:bg-darkmuted/40 dark:text-darklink' },
  ]

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-4 sm:p-6'>
      {/* Tabs + New button */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3'>
        <div className='-mx-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
          <div className='inline-flex items-center gap-1 mx-1'>
            {tabs.map((tab) => {
              const active = tab.value === statusFilter
              return (
                <button
                  key={tab.value}
                  type='button'
                  onClick={() => {
                    setStatusFilter(tab.value)
                    setCurrentPage(1)
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? tab.activeClass
                      : 'text-link dark:text-darklink hover:text-primary'
                  }`}>
                  <span>{t(tab.labelKey)}</span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${tab.badgeClass}`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className='flex items-center gap-2 w-full sm:w-auto'>
          <button
            type='button'
            onClick={() => setImportOpen(true)}
            className='flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:border-primary hover:text-primary transition-colors'>
            <Icon icon='solar:import-line-duotone' height={16} width={16} />
            {t('sidebar.import')}
          </button>
          <button
            type='button'
            onClick={() => setCreateOpen(true)}
            className='flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
            <Icon icon='tabler:plus' height={16} width={16} />
            {t('pacientes.new')}
          </button>
        </div>
      </div>

      {/* Search + filter chips */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-2 mb-5 flex-wrap'>
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v)
            setCurrentPage(1)
          }}
          placeholder={t('pacientes.search.placeholder')}
        />
        <button
          type='button'
          onClick={() => showUnderDevelopmentAlert(t('pacientes.filter.dateCreated'), t)}
          className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
          <Icon icon='solar:calendar-mark-line-duotone' height={14} width={14} />
          {t('pacientes.filter.dateCreated')}
        </button>
        <button
          type='button'
          onClick={() => showUnderDevelopmentAlert(t('pacientes.filter.lastVisit'), t)}
          className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
          <Icon icon='solar:clock-circle-line-duotone' height={14} width={14} />
          {t('pacientes.filter.lastVisit')}
        </button>

        {/* Bulk actions — select every filtered row (across pages) + delete. */}
        <div className='flex items-center gap-2 sm:ml-auto'>
          <label className='inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border dark:border-darkborder text-sm text-dark dark:text-white cursor-pointer select-none hover:border-primary transition-colors'>
            <Checkbox
              checked={allFilteredSelected}
              onCheckedChange={toggleSelectAllFiltered}
              aria-label={t('pacientes.selectAll')}
            />
            {t('pacientes.selectAll')}
          </label>
          <button
            type='button'
            onClick={handleBulkDelete}
            disabled={selectedInFilter === 0}
            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-error text-white text-sm font-medium hover:bg-error/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
            <Icon icon='solar:trash-bin-trash-line-duotone' height={15} width={15} />
            {selectedInFilter > 0
              ? t('pacientes.deleteSelected', { n: String(selectedInFilter) })
              : t('pacientes.deleteSelectedEmpty')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className='rounded-md border border-border dark:border-darkborder overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border dark:border-darkborder text-link dark:text-darklink bg-muted/30 dark:bg-darkmuted/20'>
              <th className='py-3 px-3 w-10'>
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePageSelection}
                  aria-label='Seleccionar todos en la página'
                />
              </th>
              <th className='py-3 px-3 text-left font-semibold'>{t('pacientes.col.id')}</th>
              <th className='py-3 px-3 text-left font-semibold'>{t('pacientes.col.name')}</th>
              <th className='py-3 px-3 text-left font-semibold'>{t('pacientes.col.phone')}</th>
              <th className='py-3 px-3 text-left font-semibold'>{t('pacientes.col.sucursal')}</th>
              <th className='py-3 px-3 text-left font-semibold'>{t('pacientes.col.mainTreatment')}</th>
              <th className='py-3 px-3 text-left font-semibold'>{t('pacientes.col.status')}</th>
              <th className='py-3 px-3 text-left font-semibold'>{t('pacientes.col.lastVisit')}</th>
              <th className='py-3 px-3 text-center font-semibold w-32'>{t('pacientes.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className='py-16 px-3'>
                  <div className='flex flex-col items-center justify-center text-center gap-3'>
                    <Icon icon='tabler:loader-2' height={32} width={32} className='text-primary animate-spin' />
                    <p className='text-sm text-link dark:text-darklink'>{t('pacientes.loading')}</p>
                  </div>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={9} className='py-16 px-3'>
                  <div className='flex flex-col items-center justify-center text-center gap-3'>
                    <div className='size-16 rounded-full bg-lighterror/60 flex items-center justify-center'>
                      <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
                    </div>
                    <div className='space-y-1'>
                      <p className='text-base font-semibold text-dark dark:text-white'>{t('pacientes.error.title')}</p>
                      <p className='text-sm text-link dark:text-darklink max-w-[340px]'>{t('pacientes.error.body')}</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={9} className='py-16 px-3'>
                  {patients.length === 0 ? (
                    <div className='flex flex-col items-center justify-center text-center gap-3'>
                      <div className='size-16 rounded-full bg-lightprimary/60 flex items-center justify-center'>
                        <Icon icon='solar:user-heart-rounded-line-duotone' height={32} width={32} className='text-primary' />
                      </div>
                      <div className='space-y-1'>
                        <p className='text-base font-semibold text-dark dark:text-white'>{t('pacientes.empty.title')}</p>
                        <p className='text-sm text-link dark:text-darklink max-w-[340px]'>{t('pacientes.empty.body')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className='flex flex-col items-center justify-center text-center gap-3'>
                      <div className='size-16 rounded-full bg-muted/60 dark:bg-darkmuted/40 flex items-center justify-center'>
                        <Icon icon='solar:magnifer-line-duotone' height={28} width={28} className='text-link dark:text-darklink' />
                      </div>
                      <div className='space-y-1'>
                        <p className='text-base font-semibold text-dark dark:text-white'>{t('pacientes.noResults.title')}</p>
                        <p className='text-sm text-link dark:text-darklink max-w-[340px]'>{t('pacientes.noResults.body')}</p>
                      </div>
                      {(search || statusFilter !== 'all') && (
                        <button
                          type='button'
                          onClick={() => {
                            setSearch('')
                            setStatusFilter('all')
                            setCurrentPage(1)
                          }}
                          className='mt-1 px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 dark:hover:bg-darkmuted/40 transition-colors'>
                          {t('pacientes.noResults.clearFilters')}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paged.map((patient) => {
                const tColor = getTreatmentColor(patient.mainTreatmentLabel)
                const sStyle = STATUS_STYLE[patient.status]
                return (
                  <tr
                    key={patient.id}
                    className='border-b border-border dark:border-darkborder hover:bg-muted/30 dark:hover:bg-darkmuted/30 transition-colors'>
                    <td className='py-3 px-3'>
                      <Checkbox
                        checked={selected.has(patient.id)}
                        onCheckedChange={() => toggleRow(patient.id)}
                        aria-label={`Seleccionar ${patient.fullName}`}
                      />
                    </td>
                    <td className='py-3 px-3 text-link dark:text-darklink font-mono text-xs'>{patient.id}</td>
                    <td className='py-3 px-3 text-dark dark:text-white font-medium'>{patient.fullName}</td>
                    <td className='py-3 px-3 text-link dark:text-darklink whitespace-nowrap'>
                      ···{patient.phoneLast4}
                    </td>
                    <td className='py-3 px-3 text-link dark:text-darklink'>
                      {patient.sucursal ? SUCURSAL_LABELS[patient.sucursal] : '—'}
                    </td>
                    <td className='py-3 px-3'>
                      <span className='inline-flex items-center gap-1.5 text-link dark:text-darklink'>
                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${tColor.dotClass}`} />
                        <span className='truncate max-w-[180px]'>{patient.mainTreatmentLabel}</span>
                      </span>
                    </td>
                    <td className='py-3 px-3'>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sStyle.bg} ${sStyle.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sStyle.dot}`} />
                        {t(sStyle.labelKey)}
                      </span>
                    </td>
                    <td className='py-3 px-3 text-link dark:text-darklink whitespace-nowrap'>
                      {relativeLastVisit(patient.lastVisitDays, t)}
                    </td>
                    <td className='py-3 px-3'>
                      <div className='flex items-center justify-center gap-1.5'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type='button'
                              onClick={() => setEditing(patient)}
                              aria-label={t('pacientes.action.edit')}
                              className='h-8 w-8 inline-flex items-center justify-center rounded-full bg-lightprimary text-primary hover:bg-primary hover:text-white transition-colors'>
                              <Icon icon='solar:pen-line-duotone' height={16} width={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t('pacientes.action.edit')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type='button'
                              onClick={() => router.push(`/pacientes/${patient.id}`)}
                              aria-label={t('pacientes.action.view')}
                              className='h-8 w-8 inline-flex items-center justify-center rounded-full bg-lightsecondary text-secondary hover:bg-secondary hover:text-white transition-colors'>
                              <Icon icon='solar:eye-line-duotone' height={16} width={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t('pacientes.action.view')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type='button'
                              onClick={() => handleDeletePatient(patient)}
                              aria-label={t('pacientes.action.delete')}
                              className='h-8 w-8 inline-flex items-center justify-center rounded-full bg-lighterror text-error hover:bg-error hover:text-white transition-colors'>
                              <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t('pacientes.action.delete')}</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: page size + range + pagination */}
      <div className='flex items-center justify-between mt-4 flex-wrap gap-3 text-sm text-link dark:text-darklink'>
        <div className='flex items-center gap-2'>
          <span>{t('pacientes.pagination.show')}</span>
          <PageSizeSelect value={pageSize} onChange={(v) => { setPageSize(v); setCurrentPage(1) }} />
          <span>{t('pacientes.pagination.perPage')}</span>
        </div>

        <div className='flex items-center gap-2'>
          <span>
            {t('pacientes.pagination.range', {
              start: String(filtered.length === 0 ? 0 : start + 1),
              end: String(end),
              total: String(filtered.length),
            })}
          </span>
          <button
            type='button'
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className='h-8 w-8 inline-flex items-center justify-center rounded hover:bg-lightprimary hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-link transition-colors'>
            <Icon icon='tabler:chevron-left' height={18} width={18} />
          </button>
          <span className='inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded bg-lightprimary text-primary text-sm font-medium'>
            {safePage}
          </span>
          <button
            type='button'
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className='h-8 w-8 inline-flex items-center justify-center rounded hover:bg-lightprimary hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-link transition-colors'>
            <Icon icon='tabler:chevron-right' height={18} width={18} />
          </button>
        </div>
      </div>

      <NewPatientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(p) => {
          setPatients((prev) => [p, ...prev])
          setStatusFilter('all')
          setCurrentPage(1)
        }}
        t={t}
      />

      <EditPatientDialog
        patient={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        onSaved={(updated) => {
          setPatients((prev) =>
            prev.map((x) => (x.id === updated.id ? updated : x)),
          )
          setEditing(null)
        }}
        t={t}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader className='border-b border-border dark:border-darkborder pb-3 mb-2'>
            <DialogTitle className='text-lg text-dark dark:text-white'>{t('import.title')}</DialogTitle>
          </DialogHeader>
          <ImportWizard
            onImported={reloadPatients}
            onClose={() => setImportOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}