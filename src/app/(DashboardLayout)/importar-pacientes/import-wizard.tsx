'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'

import {
  parseCsv,
  guessMapping,
  buildRecords,
  fetchExistingPhoneDigits,
  importPatients,
  TARGET_FIELDS,
  type TargetField,
  type ParsedPatient,
} from '@/lib/data/patient-import'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'

type Step = 'upload' | 'map' | 'preview' | 'done'
type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const FIELD_LABEL: Record<TargetField, TranslationKey> = {
  firstName: 'import.field.firstName',
  lastName: 'import.field.lastName',
  phone: 'import.field.phone',
  email: 'import.field.email',
  dni: 'import.field.dni',
  sucursal: 'import.field.sucursal',
}

const STATUS_STYLE: Record<ParsedPatient['status'], { cls: string; key: TranslationKey }> = {
  new: { cls: 'bg-lightsuccess text-success', key: 'import.status.new' },
  duplicate: { cls: 'bg-lightwarning text-warning', key: 'import.status.duplicate' },
  invalid: { cls: 'bg-lighterror text-error', key: 'import.status.invalid' },
}

function StepDots({ step, t }: { step: Step; t: TFn }) {
  const steps: Step[] = ['upload', 'map', 'preview']
  const idx = step === 'done' ? 3 : steps.indexOf(step)
  return (
    <div className='flex items-start mb-8 px-2 sm:px-6'>
      {steps.map((s, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <Fragment key={s}>
            <div className='flex flex-col items-center gap-2 shrink-0'>
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  done
                    ? 'bg-primary border-primary text-white'
                    : active
                      ? 'border-primary text-primary bg-lightprimary'
                      : 'border-border dark:border-darkborder text-link dark:text-darklink'
                }`}>
                {done ? <Icon icon='tabler:check' height={17} width={17} /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active || done ? 'text-dark dark:text-white' : 'text-link dark:text-darklink'
                }`}>
                {t(`import.step.${s}` as TranslationKey)}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 sm:mx-3 mt-[18px] rounded-full transition-colors ${
                  done ? 'bg-primary' : 'bg-border dark:bg-darkborder'
                }`}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export function ImportWizard({
  onImported,
  onClose,
}: {
  /** Fired after a successful import, so an embedding list can refresh. */
  onImported?: () => void
  /** When set (modal mode), the done step shows a Close button instead of a
   *  link to /pacientes. */
  onClose?: () => void
} = {}) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<TargetField, number>>(
    {} as Record<TargetField, number>,
  )
  const [records, setRecords] = useState<ParsedPatient[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ inserted: number; error: string | null } | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length < 2) {
      setHeaders([])
      setDataRows([])
      return
    }
    const hdr = rows[0]!
    setHeaders(hdr)
    setDataRows(rows.slice(1))
    setMapping(guessMapping(hdr))
    setStep('map')
  }

  async function goToPreview() {
    setBusy(true)
    const existing = await fetchExistingPhoneDigits()
    setRecords(buildRecords(dataRows, mapping, existing))
    setBusy(false)
    setStep('preview')
  }

  async function runImport() {
    setBusy(true)
    const res = await importPatients(records)
    setResult(res)
    setBusy(false)
    setStep('done')
    if (!res.error && res.inserted > 0) onImported?.()
  }

  function reset() {
    setStep('upload')
    setFileName('')
    setHeaders([])
    setDataRows([])
    setRecords([])
    setResult(null)
  }

  const counts = {
    new: records.filter((r) => r.status === 'new').length,
    duplicate: records.filter((r) => r.status === 'duplicate').length,
    invalid: records.filter((r) => r.status === 'invalid').length,
  }

  // Embedded (modal) mode drops the card chrome — the dialog already provides it.
  const embedded = !!onClose

  return (
    <div className={embedded ? '' : 'rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'}>
      <StepDots step={step} t={t} />

      {/* Step 1 — upload */}
      {step === 'upload' && (
        <label className='flex flex-col items-center justify-center gap-3 py-16 rounded-lg border-2 border-dashed border-border dark:border-darkborder cursor-pointer hover:border-primary transition-colors text-center'>
          <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
            <Icon icon='solar:upload-square-line-duotone' height={28} width={28} className='text-primary' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('import.upload.title')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[380px]'>{t('import.upload.hint')}</p>
          <span className='mt-1 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium'>{t('import.upload.button')}</span>
          <input type='file' accept='.csv,text/csv' className='hidden' onChange={handleFile} />
        </label>
      )}

      {/* Step 2 — map columns */}
      {step === 'map' && (
        <div className='space-y-5'>
          <div>
            <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('import.map.title')}</h3>
            <p className='text-xs text-link dark:text-darklink mt-0.5'>{t('import.map.subtitle', { file: fileName, rows: String(dataRows.length) })}</p>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {TARGET_FIELDS.map((field) => (
              <div key={field}>
                <label className='text-xs font-medium text-dark dark:text-white mb-1 block'>
                  {t(FIELD_LABEL[field])}
                  {(field === 'firstName' || field === 'phone') && <span className='text-error'> *</span>}
                </label>
                <select
                  value={mapping[field]}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: Number(e.target.value) }))}
                  className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'>
                  <option value={-1}>{t('import.map.unmapped')}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className='flex items-center justify-between'>
            <button type='button' onClick={reset} className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('import.back')}
            </button>
            <button
              type='button'
              disabled={busy || mapping.firstName < 0 || mapping.phone < 0}
              onClick={goToPreview}
              className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
              {busy ? t('import.checking') : t('import.map.continue')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — preview + import */}
      {step === 'preview' && (
        <div className='space-y-4'>
          <div className='flex items-center gap-3 flex-wrap text-sm'>
            <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lightsuccess text-success font-medium'>{t('import.status.new')}: {counts.new}</span>
            <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lightwarning text-warning font-medium'>{t('import.status.duplicate')}: {counts.duplicate}</span>
            <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lighterror text-error font-medium'>{t('import.status.invalid')}: {counts.invalid}</span>
          </div>

          <div className='rounded-md border border-border dark:border-darkborder overflow-x-auto max-h-[400px] overflow-y-auto'>
            <table className='w-full text-sm'>
              <thead className='sticky top-0 bg-muted/40 dark:bg-darkmuted/30'>
                <tr className='text-link dark:text-darklink text-xs'>
                  <th className='py-2 px-3 text-left font-semibold'>{t('import.col.name')}</th>
                  <th className='py-2 px-3 text-left font-semibold'>{t('import.col.phone')}</th>
                  <th className='py-2 px-3 text-left font-semibold'>{t('import.col.dni')}</th>
                  <th className='py-2 px-3 text-left font-semibold'>{t('import.col.email')}</th>
                  <th className='py-2 px-3 text-left font-semibold'>{t('import.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const s = STATUS_STYLE[r.status]
                  return (
                    <tr key={i} className='border-t border-border dark:border-darkborder'>
                      <td className='py-2 px-3 text-dark dark:text-white'>{r.fullName || ''}</td>
                      <td className='py-2 px-3 text-link dark:text-darklink'>{r.phone || ''}</td>
                      <td className='py-2 px-3 text-link dark:text-darklink'>{r.dni || ''}</td>
                      <td className='py-2 px-3 text-link dark:text-darklink truncate max-w-[180px]'>{r.email || ''}</td>
                      <td className='py-2 px-3'>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{t(s.key)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className='flex items-center justify-between'>
            <button type='button' onClick={() => setStep('map')} className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('import.back')}
            </button>
            <button
              type='button'
              disabled={busy || counts.new === 0}
              onClick={runImport}
              className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
              {busy ? t('import.importing') : t('import.preview.import', { count: String(counts.new) })}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — done */}
      {step === 'done' && (
        <div className='py-12 flex flex-col items-center text-center gap-3'>
          <div className={`size-16 rounded-full flex items-center justify-center ${result?.error ? 'bg-lighterror/60' : 'bg-lightsuccess/60'}`}>
            <Icon icon={result?.error ? 'solar:close-circle-line-duotone' : 'solar:check-circle-line-duotone'} height={32} width={32} className={result?.error ? 'text-error' : 'text-success'} />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>
            {result?.error ? t('import.done.errorTitle') : t('import.done.title')}
          </p>
          <p className='text-sm text-link dark:text-darklink max-w-[380px]'>
            {result?.error ? t('import.done.errorBody') : t('import.done.body', { count: String(result?.inserted ?? 0) })}
          </p>
          <div className='flex items-center gap-2 mt-2'>
            <button type='button' onClick={reset} className='px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 transition-colors'>
              {t('import.done.again')}
            </button>
            {onClose ? (
              <button type='button' onClick={onClose} className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
                {t('import.done.close')}
              </button>
            ) : (
              <Link href='/pacientes' className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
                {t('import.done.toPatients')}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
