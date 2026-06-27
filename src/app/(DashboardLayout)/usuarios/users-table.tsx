'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import Swal from 'sweetalert2'

import {
  MOCK_USERS,
  SUCURSAL_LABELS,
  type AppUser,
  type UserRole,
  type UserSucursal,
} from './mock-data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

// ---------- Search box (icon-button that expands) ----------

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  function handleBlur() {
    if (!value) setExpanded(false)
  }
  function handleClear() {
    onChange('')
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            aria-label={placeholder}
            onClick={() => setExpanded(true)}
            className='h-9 w-9 flex items-center justify-center rounded-md text-link dark:text-darklink hover:text-primary transition-colors'>
            <Icon icon='solar:magnifer-linear' height={20} width={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{placeholder}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className='relative flex-1 sm:flex-none sm:w-[280px]'>
      <Icon
        icon='solar:magnifer-linear'
        height={16}
        width={16}
        className='absolute left-3 top-1/2 -translate-y-1/2 text-link dark:text-darklink pointer-events-none'
      />
      <input
        ref={inputRef}
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className='w-full min-w-0 pl-9 pr-9 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
      />
      <button
        type='button'
        aria-label='Cerrar'
        onClick={handleClear}
        className='absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-link dark:text-darklink hover:text-primary'>
        <Icon icon='solar:close-circle-line-duotone' height={16} width={16} />
      </button>
    </div>
  )
}

// ---------- Role pill ----------

function RoleBadge({ role, t }: { role: UserRole; t: TFn }) {
  const styles =
    role === 'admin'
      ? 'bg-lightprimary text-primary'
      : role === 'operador'
      ? 'bg-lightsuccess text-success'
      : 'bg-lightwarning text-warning'
  const labelKey: TranslationKey =
    role === 'admin'
      ? 'users.role.admin'
      : role === 'operador'
      ? 'users.role.operador'
      : 'users.role.profesional'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {t(labelKey)}
    </span>
  )
}

// ---------- Status pill ----------

function StatusBadge({
  status,
  t,
}: {
  status: 'active' | 'inactive'
  t: TFn
}) {
  if (status === 'active') {
    return (
      <span className='inline-flex items-center gap-1.5 text-xs font-medium text-success'>
        <span className='h-2 w-2 rounded-full bg-success' />
        {t('users.status.active')}
      </span>
    )
  }
  return (
    <span className='inline-flex items-center gap-1.5 text-xs font-medium text-link dark:text-darklink'>
      <span className='h-2 w-2 rounded-full bg-link dark:bg-darklink' />
      {t('users.status.inactive')}
    </span>
  )
}

// ---------- Page-size select (Show [10 ▾]) ----------

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

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
          <Icon
            icon='tabler:chevron-down'
            height={14}
            width={14}
            className='text-link dark:text-darklink'
          />
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

// ---------- Add User dialog ----------

type DraftUser = {
  fullName: string
  email: string
  role: UserRole
  sucursal: UserSucursal
  avatarUrl?: string
}

const EMPTY_DRAFT: DraftUser = {
  fullName: '',
  email: '',
  role: 'operador',
  sucursal: null,
}

const ROLE_OPTIONS: ReadonlyArray<{
  value: UserRole
  labelKey: TranslationKey
  descriptionKey: TranslationKey
}> = [
  {
    value: 'admin',
    labelKey: 'users.role.admin',
    descriptionKey: 'users.role.adminDescription',
  },
  {
    value: 'operador',
    labelKey: 'users.role.operador',
    descriptionKey: 'users.role.operadorDescription',
  },
  {
    value: 'profesional',
    labelKey: 'users.role.profesional',
    descriptionKey: 'users.role.profesionalDescription',
  },
]

function DialogSucursalSelect({
  value,
  onChange,
  noneLabel,
}: {
  value: UserSucursal
  onChange: (next: UserSucursal) => void
  noneLabel: string
}) {
  const options: Array<{ value: UserSucursal; label: string }> = [
    { value: null, label: noneLabel },
    { value: 'caballito', label: SUCURSAL_LABELS.caballito },
    { value: 'merlo', label: SUCURSAL_LABELS.merlo },
    { value: 'moreno', label: SUCURSAL_LABELS.moreno },
  ]
  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm font-medium text-dark dark:text-white hover:border-primary focus:outline-none focus:border-primary transition-colors'>
          <span>{current.label}</span>
          <Icon
            icon='tabler:chevron-down'
            height={14}
            width={14}
            className='text-link dark:text-darklink'
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='start'
        className='w-[var(--radix-dropdown-menu-trigger-width)]'>
        {options.map((opt) => {
          const isSelected = opt.value === value
          const key = opt.value ?? '__none__'
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onChange(opt.value)}
              className={
                isSelected
                  ? 'bg-lightprimary text-primary focus:bg-lightprimary focus:text-primary'
                  : ''
              }>
              <Icon
                icon='tabler:check'
                height={16}
                width={16}
                className={`mr-2 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
              />
              {opt.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function userToDraft(u: AppUser): DraftUser {
  return {
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    sucursal: u.sucursal,
    avatarUrl: u.avatarUrl,
  }
}

function AddUserDialog({
  open,
  onOpenChange,
  editingUser,
  onCreate,
  onUpdate,
  t,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  editingUser: AppUser | null
  onCreate: (user: DraftUser) => void
  onUpdate: (id: string, user: DraftUser) => void
  t: TFn
}) {
  const baseline = editingUser ? userToDraft(editingUser) : EMPTY_DRAFT
  const [draft, setDraft] = useState<DraftUser>(baseline)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // When the user picks "No, volver" in the cancel-confirm, we reopen the
  // dialog with the draft still in place. The reset effect below would wipe
  // it, so skip the reset for that one reopen.
  const skipNextResetRef = useRef(false)

  // Reset draft state every time the dialog opens (except after a reopen).
  // In edit mode, "reset" means re-seed from editingUser; in create mode it
  // means clear to EMPTY_DRAFT.
  useEffect(() => {
    if (!open) return
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false
      return
    }
    setDraft(editingUser ? userToDraft(editingUser) : EMPTY_DRAFT)
  }, [open, editingUser])

  const isValid =
    draft.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())

  const isDirty =
    draft.fullName !== baseline.fullName ||
    draft.email !== baseline.email ||
    draft.avatarUrl !== baseline.avatarUrl ||
    draft.role !== baseline.role ||
    draft.sucursal !== baseline.sucursal

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true)
      return
    }
    if (!isDirty) {
      onOpenChange(false)
      return
    }
    // Close the Radix dialog BEFORE opening SweetAlert. Otherwise Radix's
    // modal focus scope blocks pointer events on the swal buttons. If the
    // user picks "No, volver" we reopen and the skipNextResetRef preserves
    // the draft.
    onOpenChange(false)
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    Swal.fire({
      title: t(
        editingUser
          ? 'users.dialog.cancelEditConfirmTitle'
          : 'users.dialog.cancelConfirmTitle'
      ),
      icon: 'warning',
      iconColor: '#ffae1f',
      showCancelButton: true,
      confirmButtonText: t('users.dialog.cancelConfirmYes'),
      cancelButtonText: t('users.dialog.cancelConfirmNo'),
      confirmButtonColor: '#5d87ff',
      cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
      background: isDark ? '#2a3547' : '#ffffff',
      color: isDark ? '#ffffff' : '#2a3547',
      width: '360px',
      padding: '1.5rem 1rem',
      reverseButtons: false,
      customClass: {
        title: '!text-base !font-semibold !pb-0 !mt-3',
        icon: '!w-12 !h-12 !mt-2 !mb-2',
        actions: '!gap-2 !mt-5',
        confirmButton: '!text-sm !px-4 !py-1.5 !rounded-md',
        cancelButton: `!text-sm !px-4 !py-1.5 !rounded-md ${
          isDark ? '!text-white' : '!text-dark'
        }`,
        popup: '!rounded-lg',
      },
    }).then((res) => {
      if (res.isConfirmed) return // discard — stay closed
      // User chose "No, volver" or dismissed the popup → reopen with draft.
      skipNextResetRef.current = true
      onOpenChange(true)
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setDraft((d) => ({ ...d, avatarUrl: result }))
      }
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    const normalized: DraftUser = {
      ...draft,
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
    }
    if (editingUser) {
      onUpdate(editingUser.id, normalized)
    } else {
      onCreate(normalized)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-[560px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='border-b border-border dark:border-darkborder pb-3 mb-2'>
          <DialogTitle className='text-lg text-dark dark:text-white'>
            {t(editingUser ? 'users.dialog.editTitle' : 'users.dialog.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-5 mt-2'>
          {/* Avatar */}
          <div>
            <Label className='font-medium'>{t('users.dialog.avatarLabel')}</Label>
            <div className='flex items-start gap-4 mt-2'>
              <div className='relative'>
                <Avatar
                  key={draft.avatarUrl ?? 'empty'}
                  className='size-28 !rounded-xl ring-1 ring-border dark:ring-darkborder'>
                  {draft.avatarUrl && (
                    <AvatarImage
                      src={draft.avatarUrl}
                      alt='Avatar'
                      className='object-cover'
                    />
                  )}
                  <AvatarFallback className='!rounded-xl bg-lightprimary text-primary'>
                    <Icon
                      icon='solar:user-bold-duotone'
                      height={56}
                      width={56}
                    />
                  </AvatarFallback>
                </Avatar>
                <button
                  type='button'
                  aria-label={t('users.dialog.avatarEdit')}
                  onClick={() => fileInputRef.current?.click()}
                  className='absolute -top-1 -right-1 h-7 w-7 inline-flex items-center justify-center rounded-full bg-background border border-border dark:border-darkborder shadow-sm text-link dark:text-darklink hover:text-primary hover:border-primary transition-colors'>
                  <Icon icon='solar:pen-line-duotone' height={14} width={14} />
                </button>
                {draft.avatarUrl && (
                  <button
                    type='button'
                    aria-label={t('users.dialog.avatarRemove')}
                    onClick={() =>
                      setDraft((d) => ({ ...d, avatarUrl: undefined }))
                    }
                    className='absolute -bottom-1 -right-1 h-7 w-7 inline-flex items-center justify-center rounded-full bg-background border border-border dark:border-darkborder shadow-sm text-link dark:text-darklink hover:text-error hover:border-error transition-colors'>
                    <Icon icon='tabler:x' height={14} width={14} />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.png,.jpg,.jpeg,image/png,image/jpeg'
                  className='hidden'
                  onChange={handleFile}
                />
              </div>
            </div>
            <p className='text-xs text-link dark:text-darklink mt-3'>
              {t('users.dialog.avatarAllowed')}
            </p>
          </div>

          {/* Full name */}
          <div>
            <Label htmlFor='draft-name' className='font-medium mb-1.5 block'>
              {t('users.dialog.nameLabel')}{' '}
              <span className='text-error'>*</span>
            </Label>
            <input
              id='draft-name'
              type='text'
              value={draft.fullName}
              onChange={(e) =>
                setDraft({ ...draft, fullName: e.target.value })
              }
              placeholder={t('users.dialog.namePlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor='draft-email' className='font-medium mb-1.5 block'>
              {t('users.dialog.emailLabel')}{' '}
              <span className='text-error'>*</span>
            </Label>
            <input
              id='draft-email'
              type='email'
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder={t('users.dialog.emailPlaceholder')}
              className='w-full px-3 py-2 rounded-md border border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          {/* Role */}
          <div>
            <Label className='font-medium mb-2 block'>
              {t('users.dialog.roleLabel')}{' '}
              <span className='text-error'>*</span>
            </Label>
            <RadioGroup
              value={draft.role}
              onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}
              className='space-y-0 rounded-md border border-border dark:border-darkborder overflow-hidden'>
              {ROLE_OPTIONS.map((opt, i) => (
                <div
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 ${
                    i < ROLE_OPTIONS.length - 1
                      ? 'border-b border-border dark:border-darkborder'
                      : ''
                  } ${
                    draft.role === opt.value
                      ? 'bg-lightprimary/30'
                      : 'hover:bg-muted/40'
                  } transition-colors`}>
                  <RadioGroupItem value={opt.value} id={`role-${opt.value}`} className='mt-0.5' />
                  <Label
                    htmlFor={`role-${opt.value}`}
                    className='flex-1 cursor-pointer'>
                    <div className='text-sm font-semibold text-dark dark:text-white'>
                      {t(opt.labelKey)}
                    </div>
                    <div className='text-xs text-link dark:text-darklink font-normal mt-0.5'>
                      {t(opt.descriptionKey)}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Sucursal */}
          <div>
            <Label className='font-medium mb-1.5 block'>
              {t('users.dialog.sucursalLabel')}
            </Label>
            <DialogSucursalSelect
              value={draft.sucursal}
              onChange={(next) => setDraft({ ...draft, sucursal: next })}
              noneLabel={t('users.dialog.sucursalNone')}
            />
          </div>

          {/* Footer buttons */}
          <div className='flex items-center justify-end gap-3 pt-2'>
            <button
              type='button'
              onClick={() => handleOpenChange(false)}
              className='px-4 py-2 rounded-md text-sm font-medium text-dark dark:text-white border border-border dark:border-darkborder hover:bg-muted/40 transition-colors'>
              {t('users.dialog.discard')}
            </button>
            <button
              type='submit'
              disabled={!isValid || (editingUser !== null && !isDirty)}
              className='px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primaryemphasis disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
              {t(
                editingUser
                  ? 'users.dialog.saveChanges'
                  : 'users.dialog.submit'
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Main table ----------

type RoleFilter = 'all' | UserRole
type SortDir = 'asc' | 'desc'
type SortableColumn = 'name' | 'role' | 'email' | 'sucursal' | 'status'
type ToggleableColumn = SortableColumn

const SORTABLE_COLUMNS: readonly SortableColumn[] = [
  'name',
  'role',
  'email',
  'sucursal',
  'status',
] as const

const COLUMN_LABEL_KEY: Record<SortableColumn, TranslationKey> = {
  name: 'users.col.name',
  role: 'users.col.role',
  email: 'users.col.email',
  sucursal: 'users.col.sucursal',
  status: 'users.col.status',
}

export function UsersTable() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<AppUser[]>(MOCK_USERS)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortColumn, setSortColumn] = useState<SortableColumn>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [visibleColumns, setVisibleColumns] = useState<Set<ToggleableColumn>>(
    () => new Set(SORTABLE_COLUMNS)
  )
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)

  function toggleSort(col: SortableColumn) {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
  }

  function toggleColumn(col: ToggleableColumn) {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let list = users
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case 'name':
          cmp = a.fullName.localeCompare(b.fullName, 'es')
          break
        case 'role':
          cmp = a.role.localeCompare(b.role, 'es')
          break
        case 'email':
          cmp = a.email.localeCompare(b.email, 'es')
          break
        case 'sucursal': {
          const al = a.sucursal ? SUCURSAL_LABELS[a.sucursal] : ''
          const bl = b.sucursal ? SUCURSAL_LABELS[b.sucursal] : ''
          cmp = al.localeCompare(bl, 'es')
          break
        }
        case 'status':
          // active < inactive when ascending
          cmp = a.status.localeCompare(b.status, 'es')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [users, roleFilter, search, sortColumn, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, filtered.length)
  const paged = filtered.slice(start, end)

  // Selection helpers
  const allOnPageSelected =
    paged.length > 0 && paged.every((u) => selected.has(u.id))

  function togglePageSelection() {
    const next = new Set(selected)
    if (allOnPageSelected) {
      paged.forEach((u) => next.delete(u.id))
    } else {
      paged.forEach((u) => next.add(u.id))
    }
    setSelected(next)
  }
  function toggleRow(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  // Row actions
  function toggleActive(id: string) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
          : u
      )
    )
  }
  function deleteUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }
  function deleteSelected() {
    setUsers((prev) => prev.filter((u) => !selected.has(u.id)))
    setSelected(new Set())
  }

  // Destructive-action confirm. No Radix Dialog is open at this layer, so we
  // can call Swal.fire directly without the close-then-show dance used in
  // AddUserDialog's cancel-confirm.
  async function confirmDelete(
    titleKey: TranslationKey,
    body: string
  ): Promise<boolean> {
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    const result = await Swal.fire({
      title: t(titleKey),
      text: body,
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonText: t('users.delete.confirmYes'),
      cancelButtonText: t('users.delete.confirmNo'),
      confirmButtonColor: '#ef4444',
      cancelButtonColor: isDark ? '#3f4a5d' : '#e5e7eb',
      background: isDark ? '#2a3547' : '#ffffff',
      color: isDark ? '#ffffff' : '#2a3547',
      width: '360px',
      padding: '1.5rem 1rem',
      reverseButtons: false,
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

  async function handleDeleteUser(user: AppUser) {
    const ok = await confirmDelete(
      'users.delete.confirmTitle',
      t('users.delete.confirmBody', { name: user.fullName })
    )
    if (ok) deleteUser(user.id)
  }

  async function handleDeleteSelected() {
    const count = selected.size
    if (count === 0) return
    const ok = await confirmDelete(
      'users.delete.confirmTitleBulk',
      t('users.delete.confirmBodyBulk', { count: String(count) })
    )
    if (ok) deleteSelected()
  }
  function createUser(draft: DraftUser) {
    const newUser: AppUser = {
      id: `new-${Date.now()}`,
      fullName: draft.fullName,
      email: draft.email,
      role: draft.role,
      sucursal: draft.sucursal,
      avatarUrl: draft.avatarUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    setUsers((prev) => [newUser, ...prev])
    setCurrentPage(1)
  }
  function updateUser(id: string, draft: DraftUser) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              fullName: draft.fullName,
              email: draft.email,
              role: draft.role,
              sucursal: draft.sucursal,
              avatarUrl: draft.avatarUrl,
            }
          : u
      )
    )
    setEditingUser(null)
  }
  function changeRole(id: string, role: UserRole) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role } : u))
    )
  }
  function openCreate() {
    setEditingUser(null)
    setCreateOpen(true)
  }
  function openEdit(user: AppUser) {
    setEditingUser(user)
    setCreateOpen(true)
  }

  // Filter pills config
  const filterPills: { value: RoleFilter; labelKey: TranslationKey }[] = [
    { value: 'all', labelKey: 'users.filter.all' },
    { value: 'admin', labelKey: 'users.filter.admin' },
    { value: 'operador', labelKey: 'users.filter.operador' },
    { value: 'profesional', labelKey: 'users.filter.profesional' },
  ]

  return (
    <div className='space-y-6'>
      {/* Page header */}
      <div>
        <h1 className='text-2xl font-semibold text-dark dark:text-white'>
          {t('users.pageTitle')}
        </h1>
        <p className='text-sm text-link dark:text-darklink mt-1'>
          {t('users.pageSubtitle')}
        </p>
      </div>

      {/* Card container */}
      <div className='rounded-lg border border-border dark:border-darkborder bg-card p-4 sm:p-6'>
        {/* Top row: title + icon actions — stacks on mobile */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6'>
          <h2 className='text-lg font-semibold text-dark dark:text-white'>
            {t('users.pageTitle')}
          </h2>
          <div className='flex items-center gap-2 w-full sm:w-auto justify-end'>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder={t('users.search.placeholder')}
            />
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type='button'
                      aria-label={t('users.col.toggleColumns')}
                      className='h-9 w-9 flex items-center justify-center rounded-md text-link dark:text-darklink hover:text-primary transition-colors'>
                      <Icon icon='solar:settings-line-duotone' height={20} width={20} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t('users.col.toggleColumns')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align='end' className='w-48'>
                {SORTABLE_COLUMNS.map((col) => {
                  const isVisible = visibleColumns.has(col)
                  return (
                    <DropdownMenuItem
                      key={col}
                      onSelect={(e) => {
                        e.preventDefault()
                        toggleColumn(col)
                      }}>
                      <Icon
                        icon='tabler:check'
                        height={16}
                        width={16}
                        className={`mr-2 ${
                          isVisible ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      {t(COLUMN_LABEL_KEY[col])}
                    </DropdownMenuItem>
                  )
                })}
                <div className='h-px bg-border dark:bg-darkborder my-1' />
                <DropdownMenuItem
                  disabled
                  onSelect={(e) => e.preventDefault()}
                  className='opacity-50 cursor-not-allowed'>
                  <Icon
                    icon='tabler:check'
                    height={16}
                    width={16}
                    className='mr-2'
                  />
                  {t('users.col.actions')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  aria-label={t('users.download')}
                  className='h-9 w-9 flex items-center justify-center rounded-md text-link dark:text-darklink hover:text-primary transition-colors'>
                  <Icon icon='solar:download-minimalistic-line-duotone' height={20} width={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('users.action.exportCsv')}</TooltipContent>
            </Tooltip>
            {selected.size > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    aria-label={t('users.action.deleteSelected')}
                    onClick={handleDeleteSelected}
                    className='h-9 w-9 flex items-center justify-center rounded-md bg-error text-white hover:bg-error/90 transition-colors'>
                    <Icon icon='solar:trash-bin-trash-line-duotone' height={20} width={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('users.action.deleteSelected')} ({selected.size})
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Filter pills + Create user button — stack on mobile */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3'>
          <div className='-mx-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
            <div className='inline-flex p-1 mx-1 rounded-md bg-muted/50 dark:bg-darkmuted/40'>
              {filterPills.map((pill) => {
                const active = pill.value === roleFilter
                return (
                  <button
                    key={pill.value}
                    type='button'
                    onClick={() => {
                      setRoleFilter(pill.value)
                      setCurrentPage(1)
                    }}
                    className={`px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-primary text-white'
                        : 'text-link dark:text-darklink hover:text-primary'
                    }`}>
                    {t(pill.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type='button'
            onClick={openCreate}
            className='w-full sm:w-auto px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
            {t('users.create')}
          </button>
        </div>

        {/* Table */}
        <div className='rounded-md border border-border dark:border-darkborder overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border dark:border-darkborder text-link dark:text-darklink'>
                <th className='py-3 px-3 w-10'>
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={togglePageSelection}
                    aria-label='Seleccionar todos en la página'
                  />
                </th>
                {SORTABLE_COLUMNS.map((col) =>
                  visibleColumns.has(col) ? (
                    <th
                      key={col}
                      className='py-3 px-3 text-left font-medium'>
                      <button
                        type='button'
                        onClick={() => toggleSort(col)}
                        className='inline-flex items-center gap-1 hover:text-primary'>
                        {t(COLUMN_LABEL_KEY[col])}
                        <Icon
                          icon={
                            sortColumn !== col
                              ? 'tabler:arrows-sort'
                              : sortDir === 'asc'
                              ? 'tabler:arrow-up'
                              : 'tabler:arrow-down'
                          }
                          height={12}
                          width={12}
                        />
                      </button>
                    </th>
                  ) : null
                )}
                <th className='py-3 px-3 text-right font-medium w-16'>
                  {t('users.col.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={1 + visibleColumns.size + 1}
                    className='py-16 px-3'>
                    {users.length === 0 ? (
                      <div className='flex flex-col items-center justify-center text-center gap-3'>
                        <div className='size-16 rounded-full bg-lightprimary/60 flex items-center justify-center'>
                          <Icon
                            icon='solar:users-group-rounded-line-duotone'
                            height={32}
                            width={32}
                            className='text-primary'
                          />
                        </div>
                        <div className='space-y-1'>
                          <p className='text-base font-semibold text-dark dark:text-white'>
                            {t('users.empty.title')}
                          </p>
                          <p className='text-sm text-link dark:text-darklink max-w-[320px]'>
                            {t('users.empty.body')}
                          </p>
                        </div>
                        <button
                          type='button'
                          onClick={openCreate}
                          className='mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
                          <Icon icon='tabler:plus' height={16} width={16} />
                          {t('users.create')}
                        </button>
                      </div>
                    ) : (
                      <div className='flex flex-col items-center justify-center text-center gap-3'>
                        <div className='size-16 rounded-full bg-muted/60 dark:bg-darkmuted/40 flex items-center justify-center'>
                          <Icon
                            icon='solar:magnifer-line-duotone'
                            height={28}
                            width={28}
                            className='text-link dark:text-darklink'
                          />
                        </div>
                        <div className='space-y-1'>
                          <p className='text-base font-semibold text-dark dark:text-white'>
                            {t('users.noResults.title')}
                          </p>
                          <p className='text-sm text-link dark:text-darklink max-w-[340px]'>
                            {t('users.noResults.body')}
                          </p>
                        </div>
                        {(search || roleFilter !== 'all') && (
                          <button
                            type='button'
                            onClick={() => {
                              setSearch('')
                              setRoleFilter('all')
                              setCurrentPage(1)
                            }}
                            className='mt-1 px-4 py-2 rounded-md border border-border dark:border-darkborder text-sm font-medium text-dark dark:text-white hover:bg-muted/40 dark:hover:bg-darkmuted/40 transition-colors'>
                            {t('users.noResults.clearFilters')}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paged.map((user) => (
                  <tr
                    key={user.id}
                    className='border-b border-border dark:border-darkborder hover:bg-muted/30 dark:hover:bg-darkmuted/30 transition-colors'>
                    <td className='py-3 px-3'>
                      <Checkbox
                        checked={selected.has(user.id)}
                        onCheckedChange={() => toggleRow(user.id)}
                        aria-label={`Seleccionar ${user.fullName}`}
                      />
                    </td>
                    {visibleColumns.has('name') && (
                      <td className='py-3 px-3'>
                        <div className='flex items-center gap-3'>
                          <Avatar className='size-10 ring-1 ring-border dark:ring-darkborder'>
                            {user.avatarUrl && (
                              <AvatarImage
                                src={user.avatarUrl}
                                alt={user.fullName}
                                className='object-cover'
                              />
                            )}
                            <AvatarFallback className='bg-lightprimary text-primary'>
                              <Icon
                                icon='solar:user-bold-duotone'
                                height={22}
                                width={22}
                              />
                            </AvatarFallback>
                          </Avatar>
                          <span className='text-dark dark:text-white font-medium'>
                            {user.fullName}
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.has('role') && (
                      <td className='py-3 px-3'>
                        <RoleBadge role={user.role} t={t} />
                      </td>
                    )}
                    {visibleColumns.has('email') && (
                      <td className='py-3 px-3 text-link dark:text-darklink'>
                        {user.email}
                      </td>
                    )}
                    {visibleColumns.has('sucursal') && (
                      <td className='py-3 px-3 text-link dark:text-darklink'>
                        {user.sucursal
                          ? SUCURSAL_LABELS[user.sucursal]
                          : t('users.sucursal.none')}
                      </td>
                    )}
                    {visibleColumns.has('status') && (
                      <td className='py-3 px-3'>
                        <StatusBadge status={user.status} t={t} />
                      </td>
                    )}
                    <td className='py-3 px-3 text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type='button'
                            aria-label={t('users.col.actions')}
                            className='h-8 w-8 inline-flex items-center justify-center rounded text-link dark:text-darklink hover:text-primary'>
                            <Icon icon='tabler:dots' height={18} width={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-44'>
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Icon icon='solar:pen-line-duotone' height={16} width={16} className='mr-2' />
                            {t('users.action.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Icon icon='solar:shield-user-line-duotone' height={16} width={16} className='mr-2' />
                              {t('users.action.changeRole')}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className='w-44'>
                              {(['admin', 'operador', 'profesional'] as const).map((r) => {
                                const isCurrent = user.role === r
                                const labelKey: TranslationKey =
                                  r === 'admin'
                                    ? 'users.role.admin'
                                    : r === 'operador'
                                    ? 'users.role.operador'
                                    : 'users.role.profesional'
                                return (
                                  <DropdownMenuItem
                                    key={r}
                                    disabled={isCurrent}
                                    onClick={() => changeRole(user.id, r)}>
                                    <Icon
                                      icon='tabler:check'
                                      height={14}
                                      width={14}
                                      className={`mr-2 ${
                                        isCurrent ? 'opacity-100' : 'opacity-0'
                                      }`}
                                    />
                                    {t(labelKey)}
                                  </DropdownMenuItem>
                                )
                              })}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuItem onClick={() => toggleActive(user.id)}>
                            <Icon
                              icon={
                                user.status === 'active'
                                  ? 'solar:pause-line-duotone'
                                  : 'solar:play-line-duotone'
                              }
                              height={16}
                              width={16}
                              className='mr-2'
                            />
                            {user.status === 'active'
                              ? t('users.action.deactivate')
                              : t('users.action.activate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user)}
                            className='text-error focus:text-error focus:bg-error/10'>
                            <Icon icon='solar:trash-bin-trash-line-duotone' height={16} width={16} className='mr-2' />
                            {t('users.action.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: page size + range + pagination */}
        <div className='flex items-center justify-between mt-4 flex-wrap gap-3 text-sm text-link dark:text-darklink'>
          <div className='flex items-center gap-2'>
            <span>{t('users.pagination.show')}</span>
            <PageSizeSelect
              value={pageSize}
              onChange={(v) => {
                setPageSize(v)
                setCurrentPage(1)
              }}
            />
            <span>{t('users.pagination.perPage')}</span>
          </div>

          <div className='flex items-center gap-2'>
            <span>
              {t('users.pagination.range', {
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
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              className='h-8 w-8 inline-flex items-center justify-center rounded hover:bg-lightprimary hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-link transition-colors'>
              <Icon icon='tabler:chevron-right' height={18} width={18} />
            </button>
          </div>
        </div>

      </div>

      {/* Create / edit user dialog */}
      <AddUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editingUser={editingUser}
        onCreate={createUser}
        onUpdate={updateUser}
        t={t}
      />
    </div>
  )
}