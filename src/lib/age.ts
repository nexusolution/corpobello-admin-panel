// Compute age from a 'YYYY-MM-DD' birthdate — always current, so we store the
// birthdate (migration 0043) and derive age instead of storing age (Andrés).
export function computeAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null
  const b = new Date(`${birthdate}T00:00:00`)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 ? age : null
}
