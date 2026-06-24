'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'

import {
  MOCK_USERS,
  SUCURSAL_LABELS,
  type AppUser,
  type UserRole,
} from './mock-data'
import { useTranslation } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/dictionaries'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type TFn = (key: TranslationKey, params?: Record<string, string>) => string

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

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
    <div className='relative w-[280px]'>
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
        className='w-full pl-9 pr-9 py-2 rounded-md border-2 border-border dark:border-darkborder bg-background text-sm text-dark dark:text-white focus:outline-none focus:border-primary transition-colors'
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
      : 'bg-lightsuccess text-success'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {t(role === 'admin' ? 'users.role.admin' : 'users.role.operador')}
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
          className='inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border dark:border-darkborder text-sm text-dark dark:text-white hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40'>
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

// ---------- Main table ----------

type RoleFilter = 'all' | UserRole
type SortDir = 'asc' | 'desc'

export function UsersTable() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<AppUser[]>(MOCK_USERS)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [nameSort, setNameSort] = useState<SortDir>('asc')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

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
      const cmp = a.fullName.localeCompare(b.fullName, 'es')
      return nameSort === 'asc' ? cmp : -cmp
    })
    return list
  }, [users, roleFilter, search, nameSort])

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

  // Filter pills config
  const filterPills: { value: RoleFilter; labelKey: TranslationKey }[] = [
    { value: 'all', labelKey: 'users.filter.all' },
    { value: 'admin', labelKey: 'users.filter.admin' },
    { value: 'operador', labelKey: 'users.filter.operador' },
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
      <div className='rounded-lg border border-border dark:border-darkborder bg-card p-6'>
        {/* Top row: title + icon actions */}
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-lg font-semibold text-dark dark:text-white'>
            {t('users.pageTitle')}
          </h2>
          <div className='flex items-center gap-2'>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder={t('users.search.placeholder')}
            />
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
                    onClick={deleteSelected}
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

        {/* Filter pills + Create user button */}
        <div className='flex items-center justify-between mb-6 flex-wrap gap-3'>
          <div className='inline-flex p-1 rounded-md bg-muted/50 dark:bg-darkmuted/40'>
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
                  className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-white'
                      : 'text-link dark:text-darklink hover:text-primary'
                  }`}>
                  {t(pill.labelKey)}
                </button>
              )
            })}
          </div>

          <button
            type='button'
            className='px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primaryemphasis transition-colors'>
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
                <th className='py-3 px-3 text-left font-medium'>
                  <button
                    type='button'
                    onClick={() =>
                      setNameSort((d) => (d === 'asc' ? 'desc' : 'asc'))
                    }
                    className='inline-flex items-center gap-1 hover:text-primary'>
                    {t('users.col.name')}
                    <Icon
                      icon={
                        nameSort === 'asc'
                          ? 'tabler:arrow-up'
                          : 'tabler:arrow-down'
                      }
                      height={12}
                      width={12}
                    />
                  </button>
                </th>
                <th className='py-3 px-3 text-left font-medium'>
                  {t('users.col.role')}
                </th>
                <th className='py-3 px-3 text-left font-medium'>
                  {t('users.col.email')}
                </th>
                <th className='py-3 px-3 text-left font-medium'>
                  {t('users.col.sucursal')}
                </th>
                <th className='py-3 px-3 text-left font-medium'>
                  {t('users.col.status')}
                </th>
                <th className='py-3 px-3 text-right font-medium w-16'>
                  {t('users.col.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className='py-12 text-center text-link dark:text-darklink italic'>
                    {t('users.empty')}
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
                    <td className='py-3 px-3'>
                      <div className='flex items-center gap-3'>
                        <div className='h-8 w-8 rounded-full bg-lightprimary text-primary flex items-center justify-center text-xs font-semibold'>
                          {initials(user.fullName)}
                        </div>
                        <span className='text-dark dark:text-white font-medium'>
                          {user.fullName}
                        </span>
                      </div>
                    </td>
                    <td className='py-3 px-3'>
                      <RoleBadge role={user.role} t={t} />
                    </td>
                    <td className='py-3 px-3 text-link dark:text-darklink'>
                      {user.email}
                    </td>
                    <td className='py-3 px-3 text-link dark:text-darklink'>
                      {user.sucursal
                        ? SUCURSAL_LABELS[user.sucursal]
                        : t('users.sucursal.none')}
                    </td>
                    <td className='py-3 px-3'>
                      <StatusBadge status={user.status} t={t} />
                    </td>
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
                          <DropdownMenuItem>
                            <Icon icon='solar:pen-line-duotone' height={16} width={16} className='mr-2' />
                            {t('users.action.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Icon icon='solar:shield-user-line-duotone' height={16} width={16} className='mr-2' />
                            {t('users.action.changeRole')}
                          </DropdownMenuItem>
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
                            onClick={() => deleteUser(user.id)}
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
    </div>
  )
}