import { FullPageSpinner } from '@/app/components/shared/FullPageSpinner'

// Loading fallback for the auth routes (login/register) — a spinner instead of
// a blank screen while the page streams in.
export default function Loading() {
  return <FullPageSpinner />
}
