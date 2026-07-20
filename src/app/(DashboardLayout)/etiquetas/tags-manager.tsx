'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  fetchTags,
  createTag,
  updateTag,
  setTagArchived,
  TAG_COLORS,
  type Tag,
  type TagScope,
} from '@/lib/data/tags'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

const SCOPES: TagScope[] = ['patient', 'treatment', 'visit', 'appointment', 'lead_status', 'general']

function scopeKey(s: TagScope): TranslationKey {
  return `tags.scope.${s}` as TranslationKey
}

// ---------- Create / edit dialog ----------

function TagDialog({
  open,
  onOpenChange,
  editing,
  onCreate,
  onUpdate,
  t,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  editing: Tag | null
  onCreate: (fields: { name: string; color: string; scope: TagScope; description: string }) => void
  onUpdate: (id: string, fields: { name: string; color: string; description: string }) => void
  t: TFn
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(TAG_COLORS[0])
  const [scope, setScope] = useState<TagScope>('patient')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setColor(editing.color)
      setScope(editing.scope)
      setDescription(editing.description ?? '')
    } else {
      setName('')
      setColor(TAG_COLORS[0])
      setScope('patient')
      setDescription('')
    }
  }, [open, editing])

  const valid = name.trim().length > 0

  function submit() {
    if (!valid) return
    if (editing) onUpdate(editing.id, { name: name.trim(), color, description: description.trim() })
    else onCreate({ name: name.trim(), color, scope, description: description.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-[460px]'>
        <DialogHeader className='border-b border-border dark:border-darkborder pb-3 mb-2'>
          <DialogTitle className='text-lg text-dark dark:text-white'>
            {t(editing ? 'tags.dialog.editTitle' : 'tags.dialog.title')}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-5 mt-2'>
          <div>
            <Label htmlFor='tag-name' className='font-medium mb-1.5 block'>{t('tags.dialog.nameLabel')}</Label>
            <input
              id='tag-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('tags.dialog.namePlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          <div>
            <Label className='font-medium mb-2 block'>{t('tags.dialog.colorLabel')}</Label>
            <div className='flex flex-wrap gap-2'>
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type='button'
                  aria-label={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`size-7 rounded-full transition-transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary ring-offset-card' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <Label className='font-medium mb-1.5 block'>{t('tags.dialog.scopeLabel')}</Label>
            {editing ? (
              // Scope is part of the tag's unique key — keep it fixed on edit.
              <div className='px-3 py-2 rounded-md border border-border dark:border-darkborder bg-muted/40 dark:bg-darkmuted/40 text-sm text-link dark:text-darklink'>
                {t(scopeKey(scope))}
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type='button'
                    className='w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm font-medium text-dark dark:text-white hover:border-primary transition-colors'>
                    <span>{t(scopeKey(scope))}</span>
                    <Icon icon='tabler:chevron-down' height={14} width={14} className='text-link dark:text-darklink' />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start' className='w-[var(--radix-dropdown-menu-trigger-width)]'>
                  {SCOPES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setScope(s)}>
                      {t(scopeKey(s))}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div>
            <Label htmlFor='tag-desc' className='font-medium mb-1.5 block'>{t('tags.dialog.descLabel')}</Label>
            <input
              id='tag-desc'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          {/* Live preview */}
          <div className='flex items-center gap-2'>
            <span className='text-xs text-link dark:text-darklink'>{t('tags.dialog.preview')}</span>
            <span
              style={{ backgroundColor: `${color}1f`, color }}
              className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'>
              <span className='h-1.5 w-1.5 rounded-full' style={{ backgroundColor: color }} />
              {name.trim() || t('tags.dialog.previewName')}
            </span>
          </div>

          <div className='flex items-center justify-end gap-3 pt-1'>
            <button
              type='button'
              onClick={() => onOpenChange(false)}
              className='px-4 py-2 rounded-md text-sm font-medium text-dark dark:text-white border border-border dark:border-darkborder hover:bg-muted/40 transition-colors'>
              {t('tags.dialog.cancel')}
            </button>
            <button
              type='button'
              disabled={!valid}
              onClick={submit}
              className='px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-50 transition-colors'>
              {t(editing ? 'tags.dialog.save' : 'tags.dialog.create')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Manager ----------

export function TagsManager() {
  const { t } = useTranslation()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)

  useEffect(() => {
    let active = true
    void fetchTags(true).then(({ data, error }) => {
      if (!active) return
      setTags(data)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleCreate(fields: { name: string; color: string; scope: TagScope; description: string }) {
    const { tag } = await createTag(fields)
    if (tag) setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setDialogOpen(false)
  }
  async function handleUpdate(id: string, fields: { name: string; color: string; description: string }) {
    setTags((prev) => prev.map((x) => (x.id === id ? { ...x, ...fields } : x)))
    await updateTag(id, fields)
    setDialogOpen(false)
    setEditing(null)
  }
  async function handleArchive(tag: Tag) {
    // Currently active → archive; currently archived → restore.
    const archive = tag.active
    setTags((prev) =>
      prev.map((x) =>
        x.id === tag.id
          ? { ...x, active: !archive, archivedAt: archive ? new Date().toISOString() : null }
          : x
      )
    )
    await setTagArchived(tag.id, archive)
  }

  const activeTags = tags.filter((x) => x.active)
  const archivedTags = tags.filter((x) => !x.active)

  return (
    <div className='rounded-lg border border-border dark:border-darkborder bg-card p-5 sm:p-6'>
      <div className='flex items-center justify-between mb-5 gap-3 flex-wrap'>
        <div>
          <h3 className='text-sm font-semibold text-dark dark:text-white'>{t('tags.heading')}</h3>
          <p className='text-xs text-link dark:text-darklink mt-0.5'>{t('tags.subtitle')}</p>
        </div>
        <button
          type='button'
          onClick={() => { setEditing(null); setDialogOpen(true) }}
          className='inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
          <Icon icon='tabler:plus' height={16} width={16} />
          {t('tags.new')}
        </button>
      </div>

      {loading ? (
        <div className='py-16 flex flex-col items-center gap-3'>
          <Icon icon='tabler:loader-2' height={30} width={30} className='text-primary animate-spin' />
          <p className='text-sm text-link dark:text-darklink'>{t('tags.loading')}</p>
        </div>
      ) : loadError ? (
        <div className='py-16 flex flex-col items-center gap-2 text-center'>
          <Icon icon='solar:cloud-cross-line-duotone' height={30} width={30} className='text-error' />
          <p className='text-sm text-link dark:text-darklink'>{t('tags.error')}</p>
        </div>
      ) : tags.length === 0 ? (
        <div className='py-16 flex flex-col items-center gap-2 text-center'>
          <div className='size-14 rounded-full bg-lightprimary/60 flex items-center justify-center'>
            <Icon icon='solar:tag-line-duotone' height={26} width={26} className='text-primary' />
          </div>
          <p className='text-base font-semibold text-dark dark:text-white'>{t('tags.empty.title')}</p>
          <p className='text-sm text-link dark:text-darklink max-w-[340px]'>{t('tags.empty.body')}</p>
        </div>
      ) : (
        <div className='space-y-6'>
          <TagGroup tags={activeTags} onEdit={(tg) => { setEditing(tg); setDialogOpen(true) }} onArchive={handleArchive} t={t} archived={false} />
          {archivedTags.length > 0 && (
            <div>
              <p className='text-xs font-semibold uppercase tracking-wide text-link dark:text-darklink mb-2'>{t('tags.archivedGroup')}</p>
              <TagGroup tags={archivedTags} onEdit={(tg) => { setEditing(tg); setDialogOpen(true) }} onArchive={handleArchive} t={t} archived />
            </div>
          )}
        </div>
      )}

      <TagDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null) }}
        editing={editing}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        t={t}
      />
    </div>
  )
}

function TagGroup({
  tags,
  onEdit,
  onArchive,
  t,
  archived,
}: {
  tags: Tag[]
  onEdit: (t: Tag) => void
  onArchive: (t: Tag) => void
  t: TFn
  archived: boolean
}) {
  if (tags.length === 0) {
    return <p className='text-sm text-link dark:text-darklink'>{t('tags.empty.activeNone')}</p>
  }
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
      {tags.map((tag) => (
        <div
          key={tag.id}
          className={`rounded-md border border-border dark:border-darkborder p-3 flex items-center gap-3 ${archived ? 'opacity-60' : ''}`}>
          <span className='h-8 w-8 rounded-md shrink-0 flex items-center justify-center' style={{ backgroundColor: `${tag.color}1f` }}>
            <span className='h-3.5 w-3.5 rounded-full' style={{ backgroundColor: tag.color }} />
          </span>
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-medium text-dark dark:text-white truncate'>{tag.name}</p>
            <p className='text-[11px] text-link dark:text-darklink'>{t(scopeKey(tag.scope))}</p>
          </div>
          <div className='flex items-center gap-1 shrink-0'>
            <button
              type='button'
              aria-label={t('tags.action.edit')}
              onClick={() => onEdit(tag)}
              className='h-8 w-8 inline-flex items-center justify-center rounded-full bg-lightprimary text-primary hover:bg-primary hover:text-white transition-colors'>
              <Icon icon='solar:pen-line-duotone' height={15} width={15} />
            </button>
            <button
              type='button'
              aria-label={archived ? t('tags.action.restore') : t('tags.action.archive')}
              onClick={() => onArchive(tag)}
              className='h-8 w-8 inline-flex items-center justify-center rounded-full bg-muted/50 dark:bg-darkmuted/40 text-link dark:text-darklink hover:bg-warning hover:text-white transition-colors'>
              <Icon icon={archived ? 'solar:restart-line-duotone' : 'solar:archive-down-line-duotone'} height={15} width={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
