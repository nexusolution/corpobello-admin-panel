// Initials + deterministic color for user-friendly avatars (no placeholder
// images). A person with no uploaded photo gets their initials on a stable,
// per-name colored circle instead of a generic stock image.

export function getInitials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// A small, pleasant palette (all with enough contrast for white text).
const AVATAR_COLORS = [
  '#7c4dff', // violet
  '#5d87ff', // blue
  '#13deb9', // teal
  '#ffae1f', // amber
  '#fa896b', // salmon
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#22c55e', // green
  '#f97316', // orange
] as const

// Stable background color derived from the name, so the same person always
// gets the same tint across the app.
export function avatarColor(seed: string): string {
  const s = seed && seed.length > 0 ? seed : '?'
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}