'use client'

import { Icon } from '@iconify/react'
import { cn } from '@/lib/utils'
import { avatarColor, getInitials } from '@/lib/initials'

// A user-friendly avatar: shows the uploaded photo when there is one, otherwise
// the person's initials on a stable per-name colored circle (never a generic
// placeholder image). Falls back to a person glyph only when there is no name.
export function UserAvatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const dims = { width: size, height: size }

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || 'Perfil'}
        style={dims}
        className={cn('rounded-full object-cover shrink-0', className)}
      />
    )
  }

  const initials = getInitials(name)
  return (
    <span
      role='img'
      aria-label={name || 'Perfil'}
      style={{ ...dims, backgroundColor: avatarColor(name) }}
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 font-semibold text-white select-none leading-none',
        className,
      )}>
      {initials ? (
        <span style={{ fontSize: Math.round(size * 0.4) }}>{initials}</span>
      ) : (
        <Icon
          icon='solar:user-bold-duotone'
          height={Math.round(size * 0.55)}
          width={Math.round(size * 0.55)}
        />
      )}
    </span>
  )
}
